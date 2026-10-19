#!/usr/bin/env node
/**
 * Execute the GraphFlow 3.6.1 reflex-arc suite and write results/run-3.6.1-reflex.*.
 *
 * Uses the real CLI plus an MCP stdio session (`graphflow-mcp`). Does not
 * modify the GraphFlow package. Task state is written in a detached git
 * worktree and removed afterwards.
 *
 *   GRAPHFLOW_BIN=/path/to/graphflow node scripts/run-reflex.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "./baseline-naive.mjs";
import { formatReport, loadTaskFiles, scoreRun } from "./score.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GF = process.env.GRAPHFLOW_BIN || "graphflow";
const MCP_BIN = process.env.GRAPHFLOW_MCP || path.join(path.dirname(GF), "graphflow-mcp");
const WT = process.env.GRAPHFLOW_REFLEX_ROOT || path.join(os.tmpdir(), "gf-reflex-eval");
const SHIM = path.join(os.tmpdir(), "gf-bin");
const INSTRUCTION = "format lint and test billing package before release";
const NEAR_HIT = "format lint and test billing package before release quietly";
const NEAR_MISS = "format lint and test billing before release";
const UNRELATED = "ship the warehouse reservation hold";
const ARG_INSTRUCTION = "print the billing batch tag";
const STEP_COMPILE = "cd packages/billing-py && python3 -m compileall -q billing";
const STEP_TEST = "cd packages/billing-py && python3 -m unittest discover -s tests -v";
const STEPS = [STEP_COMPILE, STEP_TEST];
const ARG_STEP = "echo PASS batch={{arg1}}";
const ROUNDS = 3;

function ensurePythonShim() {
  fs.mkdirSync(SHIM, { recursive: true });
  const dest = path.join(SHIM, "python");
  if (!fs.existsSync(dest)) fs.symlinkSync("/usr/bin/python3", dest);
}

function envWithShim() {
  return { ...process.env, PATH: `${SHIM}${path.delimiter}${process.env.PATH}` };
}

function spawnText(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    env: envWithShim(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    command: [cmd, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" "),
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? String(result.error.message) : "",
  };
}

function gf(args) {
  const result = spawnText(GF, args, WT);
  result.command = `graphflow ${args.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ")}`;
  return result;
}

class McpSession {
  constructor(bin, cwd) {
    this.child = spawn(bin, [], { cwd, env: envWithShim(), stdio: ["pipe", "pipe", "pipe"] });
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.stderr = "";
    this.nextId = 1;
    this.child.stdout.on("data", (chunk) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      while (true) {
        const nl = this.buf.indexOf(0x0a);
        if (nl < 0) break;
        const line = this.buf.subarray(0, nl).toString("utf8").replace(/\r$/, "");
        this.buf = this.buf.subarray(nl + 1);
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id != null && this.pending.has(msg.id)) {
          const pending = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          pending.resolve(msg);
        }
      }
    });
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString("utf8");
    });
    this.child.on("error", (error) => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  request(method, params, timeoutMs = 120000) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP timeout waiting for ${method} id=${id}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.child.stdin.write(payload);
    });
  }

  notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async close() {
    this.child.stdin.end();
    await new Promise((resolve) => {
      if (this.child.exitCode != null) resolve();
      else this.child.once("exit", resolve);
    });
  }
}

function toolText(message) {
  const content = message?.result?.content;
  if (Array.isArray(content) && typeof content[0]?.text === "string") return content[0].text;
  if (message?.error) return `ERR [mcp] ${message.error.message ?? JSON.stringify(message.error)}`;
  return JSON.stringify(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function harvestOffset() {
  const statePath = path.join(WT, ".graphflow", "task-harvest.json");
  if (!fs.existsSync(statePath)) return null;
  const state = readJson(statePath);
  return state.logs?.[".graphflow/instruction-log.jsonl"]?.offset ?? null;
}

function logBytes() {
  const logPath = path.join(WT, ".graphflow", "instruction-log.jsonl");
  if (!fs.existsSync(logPath)) return 0;
  return fs.statSync(logPath).size;
}

function logLineCount() {
  const logPath = path.join(WT, ".graphflow", "instruction-log.jsonl");
  if (!fs.existsSync(logPath)) return 0;
  return fs.readFileSync(logPath, "utf8").split(/\n/).filter((line) => line.trim()).length;
}

function loadStore() {
  const storePath = path.join(WT, ".graphflow", "tasks.json");
  if (!fs.existsSync(storePath)) return null;
  return readJson(storePath);
}

function findTaskByInstruction(instruction) {
  const store = loadStore();
  const tasks = store?.tasks ?? [];
  return tasks.find((task) => task.instructionRaw === instruction) ?? null;
}

function parseExit(text) {
  const match = String(text).match(/\[exit=(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseNearScore(text) {
  const match = String(text).match(/near match score=([0-9.]+)/);
  return match ? Number(match[1]) : null;
}

function isMiss(text) {
  return String(text).includes("MISS [no-reflected-task]");
}

function ratio(baseline, graphflow) {
  if (!(baseline > 0) || typeof graphflow !== "number") return null;
  return Number((1 - graphflow / baseline).toFixed(4));
}

function transcript(blocks) {
  return blocks.map((block) => `$ ${block.command}\nexit ${block.exitCode}\n${block.stdout}${block.stderr ? `\n${block.stderr}` : ""}`).join("\n\n");
}

async function main() {
  ensurePythonShim();
  const pythonProbe = spawnText(path.join(SHIM, "python"), ["-c", "import sys; print(sys.version.split()[0])"], REPO);
  if (fs.existsSync(WT)) spawnText("git", ["worktree", "remove", "--force", WT], REPO);
  const added = spawnText("git", ["worktree", "add", "--detach", WT, "HEAD"], REPO);
  if (added.exitCode !== 0) {
    throw new Error(`worktree add failed: ${added.stderr || added.stdout}`);
  }

  const version = gf(["version"]);
  const mcp = new McpSession(MCP_BIN, WT);
  const calls = [];
  try {
    const init = await mcp.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "graphflow-eval", version: "0.1.0" },
    });
    mcp.notify("notifications/initialized");
    const listed = await mcp.request("tools/list", {});
    const toolNames = (listed.result?.tools ?? []).map((tool) => tool.name);

    async function macro(arguments_) {
      const params = { name: "gf_macro", arguments: { ...arguments_, rootDir: WT } };
      const message = await mcp.request("tools/call", params);
      const text = toolText(message);
      calls.push({ arguments: arguments_, text, message });
      return { command: `MCP tools/call gf_macro ${JSON.stringify(arguments_)}`, exitCode: message.error ? 1 : 0, stdout: text, stderr: "" };
    }

    const baselineOutputs = STEPS.map((step) => spawnText("bash", ["-lc", step], WT));

    function logOnce() {
      return gf(["task", "log", INSTRUCTION, "--step", STEP_COMPILE, "--step", STEP_TEST, "--root", WT]);
    }

    const log1 = logOnce();
    const harvest1 = gf(["task", "harvest", "--json", "--root", WT]);
    const harvest1Json = JSON.parse(harvest1.stdout);
    const afterFirst = findTaskByInstruction(INSTRUCTION);
    const log2 = logOnce();
    const harvest2 = gf(["task", "harvest", "--json", "--root", WT]);
    const harvest2Json = JSON.parse(harvest2.stdout);
    const promoted = findTaskByInstruction(INSTRUCTION);
    const scriptAbs = promoted?.scriptPath ? path.join(WT, promoted.scriptPath) : "";
    const scriptText = scriptAbs && fs.existsSync(scriptAbs) ? fs.readFileSync(scriptAbs, "utf8") : "";
    const idle = gf(["task", "harvest", "--json", "--root", WT]);
    const idleJson = JSON.parse(idle.stdout);
    const offsetBeforeMcp = harvestOffset();
    const log3 = logOnce();
    const mcpHarvest = await macro({ action: "task-harvest" });
    const offsetAfterMcp = harvestOffset();
    const bytesAfter = logBytes();
    const storedAfter = findTaskByInstruction(INSTRUCTION);
    const store = loadStore();

    const taskList = await macro({ action: "task-list" });
    const taskRun = await macro({ action: "task-run", instruction: INSTRUCTION });
    const cliReflect = gf(["reflect", INSTRUCTION, "--json", "--root", WT]);
    const cliReflectJson = JSON.parse(cliReflect.stdout);

    const nearRun = await macro({ action: "task-run", instruction: NEAR_HIT });
    const belowMcp = await macro({ action: "task-run", instruction: NEAR_MISS });
    const unrelatedMcp = await macro({ action: "task-run", instruction: UNRELATED });
    const belowCli = gf(["reflect", NEAR_MISS, "--json", "--root", WT]);
    const unrelatedCli = gf(["reflect", UNRELATED, "--json", "--root", WT]);
    const belowCliJson = JSON.parse(belowCli.stdout);
    const unrelatedCliJson = JSON.parse(unrelatedCli.stdout);

    let probe = { hit: null, miss: null, unrelated: null, threshold: null };
    try {
      const require = createRequire(path.join(path.dirname(GF), "..", "@roarpeng/graphflow/package.json"));
      const graphflow = require("@roarpeng/graphflow");
      const baseTokens = graphflow.tokenizeInstruction(INSTRUCTION);
      probe = {
        threshold: graphflow.TASK_NEAR_MATCH_THRESHOLD,
        hit: graphflow.jaccardSimilarity(baseTokens, graphflow.tokenizeInstruction(NEAR_HIT)),
        miss: graphflow.jaccardSimilarity(baseTokens, graphflow.tokenizeInstruction(NEAR_MISS)),
        unrelated: graphflow.jaccardSimilarity(baseTokens, graphflow.tokenizeInstruction(UNRELATED)),
      };
    } catch (error) {
      probe.error = String(error.message ?? error);
    }

    const recordMcp = await macro({ action: "task-record", instruction: ARG_INSTRUCTION, steps: [ARG_STEP] });
    const recordCli = gf(["task", "record", ARG_INSTRUCTION, "--step", ARG_STEP, "--json", "--root", WT]);
    const recordCliJson = JSON.parse(recordCli.stdout);
    const argScriptAbs = recordCliJson.scriptPath ? path.join(WT, recordCliJson.scriptPath) : "";
    const argScript = argScriptAbs && fs.existsSync(argScriptAbs) ? fs.readFileSync(argScriptAbs, "utf8") : "";
    const argRun = await macro({ action: "task-run", instruction: ARG_INSTRUCTION, args: ["R3"] });

    const tokenRuns = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      tokenRuns.push(await macro({ action: "task-run", instruction: INSTRUCTION }));
    }

    const fullOutput = baselineOutputs.map((item) => `${item.stdout}${item.stderr}`).join("\n");
    const baselineRound = [INSTRUCTION, ...STEPS, fullOutput].join("\n");
    const baselineTokens = estimateTokens(baselineRound) * ROUNDS;
    const reflexRoundTokens = tokenRuns.map((item) => estimateTokens(`${item.command}\n${item.stdout}`));
    const reflexTokens = reflexRoundTokens.reduce((sum, value) => sum + value, 0);
    const savings = ratio(baselineTokens, reflexTokens);

    const mcpExit = parseExit(taskRun.stdout);
    const nearScore = parseNearScore(nearRun.stdout);
    const nearHit = nearRun.stdout.includes("near match") && nearScore != null && parseExit(nearRun.stdout) === 0;
    const belowMiss = isMiss(belowMcp.stdout) && !belowMcp.stdout.includes("PASS [exit=0");
    const unrelatedMiss = isMiss(unrelatedMcp.stdout) && !unrelatedMcp.stdout.includes("PASS [exit=0");
    const falseHit = !belowMiss || !unrelatedMiss || belowCliJson.hit === true || unrelatedCliJson.hit === true;

    const learnRaw = transcript([log1, harvest1, log2, harvest2, idle, log3, mcpHarvest]);
    const invokeRaw = transcript([taskList, taskRun, cliReflect]);
    const nearRaw = transcript([nearRun, belowMcp, unrelatedMcp, belowCli, unrelatedCli]);
    const argRaw = `${transcript([recordMcp, recordCli, argRun])}\n\n# compiled runner\n${argScript}`;
    const tokenRaw = transcript(tokenRuns);

    const run = {
      run_id: "run-3.6.1-reflex",
      created_at: new Date().toISOString(),
      graphflow: {
        version: version.stdout.trim(),
        invoked: true,
        mode: "cli+mcp-stdio",
        bin: version.stdout.trim() === "3.6.1" ? "@roarpeng/graphflow@3.6.1" : version.stdout.trim(),
      },
      estimation: {
        method: "ceil(chars/4)",
        note: "Reflex tokens are one gf_macro tools/call plus the dehydrated tool text, summed over N rounds. Baseline tokens are the same N copies of the instruction, the planned shell commands, and the full stdout/stderr of those commands.",
      },
      workspace: WT,
      python_shim: pythonProbe.stdout.trim(),
      mcp_tools: toolNames,
      mcp_server: init.result?.serverInfo ?? null,
      probe_jaccard: probe,
      gaps: [
        "Auto-harvest still needs an external writer. This run called `graphflow task log` itself. GraphFlow 3.6.1 has no host hook or daemon that appends the instruction log.",
        "A MISS payload does not include the Jaccard score. The 0.857 figure is GraphFlow's exported jaccardSimilarity on the same strings. The HIT score is parsed from the MCP text `near match score=`.",
        "MCP task-run returns dehydrated text, not a JSON exitCode. Exit 0 is read from `PASS [exit=0`. CLI `reflect --json` is recorded beside it.",
        "{{argN}} is written by hand into the recorded step. The reflector does not infer parameters.",
        "Concurrent cross-process records (last writer wins) were not exercised.",
      ],
      tasks: [
        {
          id: "reflex-learn-loop",
          package: "billing-py",
          tool: "gf_macro",
          commands: [log1, harvest1, log2, harvest2, idle, log3, mcpHarvest].map((item) => ({ command: item.command, exitCode: item.exitCode })),
          metrics: { tokens_baseline: null, tokens_graphflow: estimateTokens(learnRaw), token_savings_ratio: null },
          observed: {
            harvest: harvest2Json.tasksPromoted?.length > 0 ? "HIT" : "MISS",
            steps: storedAfter?.steps?.map((step) => (typeof step === "string" ? step : step.cmd)) ?? [],
            learn: {
              log_lines: logLineCount(),
              promoted: (harvest2Json.tasksPromoted ?? []).length > 0,
              compiled: Boolean(scriptText && storedAfter?.scriptPath),
              script_path: storedAfter?.scriptPath ?? "",
              tasks_json: Boolean(store?.tasks?.length),
              first_compiled: Boolean(afterFirst?.scriptPath),
              idle_entries: idleJson.entriesRead,
              mcp_entries: Number((mcpHarvest.stdout.match(/entries=(\d+)/) ?? [])[1]),
              offset_before_mcp: offsetBeforeMcp,
              offset_after_mcp: offsetAfterMcp,
              log_bytes: bytesAfter,
              first_entries: harvest1Json.entriesRead,
              second_entries: harvest2Json.entriesRead,
              uses_after_mcp: storedAfter?.count ?? null,
            },
            false_positives: [],
            raw_output: `${learnRaw}\n\n# tasks.json\n${JSON.stringify(store, null, 2)}\n\n# runner excerpt\n${scriptText.slice(0, 800)}`,
          },
          evidence: learnRaw.slice(0, 2500),
        },
        {
          id: "reflex-mcp-invoke",
          package: "billing-py",
          tool: "gf_macro",
          commands: [taskList, taskRun, cliReflect].map((item) => ({ command: item.command, exitCode: item.exitCode })),
          metrics: { tokens_baseline: null, tokens_graphflow: estimateTokens(invokeRaw), token_savings_ratio: null },
          observed: {
            reflect: taskRun.stdout.includes("local-runner") && mcpExit === 0 ? "HIT" : "MISS",
            exit_code: mcpExit,
            cli_exit_code: cliReflectJson.exitCode,
            mcp_actions: ["task-list", "task-run"],
            snippets: ["PASS [exit=0", "local-runner"],
            false_positives: [],
            raw_output: invokeRaw,
          },
          evidence: invokeRaw.slice(0, 2500),
        },
        {
          id: "reflex-near-threshold",
          package: "billing-py",
          tool: "gf_macro",
          commands: [nearRun, belowMcp, unrelatedMcp, belowCli, unrelatedCli].map((item) => ({ command: item.command, exitCode: item.exitCode })),
          metrics: {
            tokens_baseline: null,
            tokens_graphflow: null,
            token_savings_ratio: null,
            near_score: nearScore,
            probe_hit: probe.hit,
            probe_miss: probe.miss,
            probe_unrelated: probe.unrelated,
          },
          observed: {
            near_hit: nearHit,
            near_score: nearScore,
            below_miss: belowMiss && belowCliJson.hit === false && belowCliJson.exitCode === 1,
            unrelated_miss: unrelatedMiss && unrelatedCliJson.hit === false && unrelatedCliJson.exitCode === 1,
            false_hit: falseHit,
            false_positives: falseHit ? [UNRELATED] : [],
            snippets: ["near match score=", "MISS [no-reflected-task]"],
            raw_output: nearRaw,
          },
          evidence: nearRaw.slice(0, 2500),
        },
        {
          id: "reflex-arg-record",
          package: "billing-py",
          tool: "gf_macro",
          commands: [recordMcp, recordCli, argRun].map((item) => ({ command: item.command, exitCode: item.exitCode })),
          metrics: { tokens_baseline: null, tokens_graphflow: estimateTokens(argRaw), token_savings_ratio: null },
          observed: {
            compiled: Boolean(recordCliJson.scriptPath) && argScript.includes("{{arg1}}"),
            exit_code: parseExit(argRun.stdout),
            mcp_actions: ["task-record", "task-run"],
            snippets: ["{{arg1}}", "not-compiled-yet"],
            false_positives: [],
            raw_output: argRaw,
          },
          evidence: transcript([recordMcp, recordCli, argRun]).slice(0, 2000),
        },
        {
          id: "reflex-token-rounds",
          package: "billing-py",
          tool: "gf_macro",
          commands: tokenRuns.map((item) => ({ command: item.command, exitCode: item.exitCode })),
          metrics: {
            tokens_baseline: baselineTokens,
            tokens_graphflow: reflexTokens,
            token_savings_ratio: savings,
            rounds: ROUNDS,
            per_round_baseline: estimateTokens(baselineRound),
            per_round_graphflow: reflexRoundTokens,
          },
          observed: {
            exit_code: tokenRuns.every((item) => parseExit(item.stdout) === 0) ? 0 : 1,
            snippets: ["PASS [exit=0"],
            false_positives: [],
            raw_output: tokenRaw,
          },
          evidence: tokenRaw.slice(0, 2000),
        },
      ],
    };

    const { byId } = loadTaskFiles();
    const report = scoreRun(run, byId);
    const jsonPath = path.join(REPO, "results", "run-3.6.1-reflex.json");
    fs.writeFileSync(jsonPath, `${JSON.stringify(run, null, 2)}\n`);

    const lines = [];
    lines.push("# GraphFlow 3.6.1 reflex-arc evaluation");
    lines.push("");
    lines.push(`Recorded ${run.created_at}. Binary \`@roarpeng/graphflow@${version.stdout.trim()}\`. MCP server \`${init.result?.serverInfo?.name ?? "graphflow"} ${init.result?.serverInfo?.version ?? ""}\` over stdio. Tools listed: ${toolNames.join(", ")}.`);
    lines.push("");
    lines.push(`Python shim: \`PATH\` prefixed with \`${SHIM}\` so \`python\` resolves to ${pythonProbe.stdout.trim() || "unavailable"}. Recorded steps call \`python3\` directly. Workspace for the run was a detached worktree \`${WT}\`, removed after the commands.`);
    lines.push("");
    lines.push(formatReport(report));
    lines.push("");
    lines.push("## Token comparison");
    lines.push("");
    lines.push(`N=${ROUNDS} steady-state replays after the runner was already compiled.`);
    lines.push("");
    lines.push(`- Baseline (instruction + both commands + full stdout/stderr) × ${ROUNDS}: **${baselineTokens}** tokens, ${estimateTokens(baselineRound)} per round.`);
    lines.push(`- Reflex (one \`gf_macro\` \`task-run\` tools/call + dehydrated text) × ${ROUNDS}: **${reflexTokens}** tokens (${reflexRoundTokens.join(", ")}).`);
    lines.push(`- Savings: **${savings}**.`);
    lines.push("");
    lines.push("## Jaccard probe");
    lines.push("");
    lines.push(`Threshold constant \`${probe.threshold}\`. Library scores: near hit ${probe.hit}, dropped-token miss ${probe.miss}, unrelated ${probe.unrelated}.`);
    lines.push(`MCP near-hit score parsed from the tool text: ${nearScore}.`);
    lines.push("");
    lines.push("## Gaps");
    lines.push("");
    for (const gap of run.gaps) lines.push(`- ${gap}`);
    lines.push("");
    lines.push("## Per task");
    lines.push("");
    for (const task of report.tasks) {
      const source = run.tasks.find((item) => item.id === task.id);
      lines.push(`### ${task.id} — ${task.status}`);
      lines.push("");
      lines.push("Commands:");
      for (const command of source.commands) lines.push(`- \`${command.command}\` (exit ${command.exitCode})`);
      const failed = (task.checks ?? []).filter((item) => !item.ok);
      if (failed.length === 0) lines.push("Rubric: all checks passed.");
      else {
        lines.push("Failed checks:");
        for (const item of failed) lines.push(`- \`${item.id}\` — ${item.detail}`);
      }
      lines.push("");
      lines.push("```");
      lines.push(source.evidence);
      lines.push("```");
      lines.push("");
    }
    lines.push("## Harvest state");
    lines.push("");
    lines.push(`Log lines: ${logLineCount()}. Bytes: ${bytesAfter}. Offset before the MCP harvest: ${offsetBeforeMcp}. Offset after: ${offsetAfterMcp}.`);
    lines.push(`First CLI harvest entries=${harvest1Json.entriesRead} promoted=${JSON.stringify(harvest1Json.tasksPromoted)}.`);
    lines.push(`Second CLI harvest entries=${harvest2Json.entriesRead} promoted=${JSON.stringify(harvest2Json.tasksPromoted)}.`);
    lines.push(`Idle CLI harvest entries=${idleJson.entriesRead}.`);
    lines.push(`MCP harvest text: ${mcpHarvest.stdout.split("\n")[0]}`);
    lines.push("");
    fs.writeFileSync(path.join(REPO, "results", "run-3.6.1-reflex.md"), `${lines.join("\n")}\n`);
    console.log(formatReport(report));
    console.log("--- near", nearScore, "probe", JSON.stringify(probe));
    console.log("--- tokens", baselineTokens, reflexTokens, savings);
    console.log("--- mcp exit", mcpExit, "cli", cliReflectJson.exitCode, "arg", parseExit(argRun.stdout));
  } finally {
    await mcp.close().catch(() => {});
    spawnText("git", ["worktree", "remove", "--force", WT], REPO);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
