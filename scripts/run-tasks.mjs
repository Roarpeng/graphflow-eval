#!/usr/bin/env node
/**
 * Document or execute the GraphFlow eval checklist.
 *
 * Default mode does not invoke GraphFlow. It records baseline token estimates
 * and, for the harvest fixture, a local instruction-log simulation.
 *
 *   node scripts/run-tasks.mjs
 *   node scripts/run-tasks.mjs --id ts-read-symbol-slice
 *   node scripts/run-tasks.mjs --execute --out results/latest.json
 *
 * --execute runs each step command (usually `graphflow ...`). Install the CLI
 * first, or set GRAPHFLOW_BIN. Fixture unit tests do not use this flag.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESTIMATION_METHOD, ESTIMATION_NOTE, estimateFilesTokens, estimateTokens, naiveSearch } from "./baseline-naive.mjs";
import { loadTaskFiles } from "./score.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function simulateHarvest(jsonlText) {
  const groups = new Map();
  let entriesRead = 0;
  let entriesInvalid = 0;
  for (const line of String(jsonlText).split(/\r?\n/)) {
    if (!line.trim()) continue;
    entriesRead += 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      entriesInvalid += 1;
      continue;
    }
    const instruction = typeof parsed.instruction === "string"
      ? parsed.instruction.trim().replace(/\s+/g, " ").toLowerCase()
      : "";
    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const commands = steps
      .map((step) => {
        if (typeof step === "string") return step.trim();
        if (step && typeof step.cmd === "string") return step.cmd.trim();
        return "";
      })
      .filter(Boolean);
    if (!instruction || commands.length === 0) {
      entriesInvalid += 1;
      continue;
    }
    const current = groups.get(instruction) ?? { count: 0, steps: commands };
    current.count += 1;
    current.steps = commands;
    groups.set(instruction, current);
  }
  const promoted = [...groups.entries()]
    .filter(([, group]) => group.count >= 2)
    .map(([instruction, group]) => ({ instruction, uses: group.count, steps: group.steps }));
  return {
    simulator: "eval-harvest-v1",
    note: "Counts whitespace-normalized repeated instructions. GraphFlow promotes at 2 uses and graphflow reflect returns HIT. This simulator does not compile or run the steps.",
    entriesRead,
    entriesInvalid,
    harvest: promoted.length > 0 ? "HIT" : "MISS",
    promoted,
  };
}

function stepCommands(task) {
  return (task.steps ?? [])
    .map((step) => (typeof step.command === "string" ? step.command : ""))
    .filter(Boolean);
}

export function buildDocumentedRun(tasks, rootDir = ROOT, now = new Date().toISOString()) {
  return {
    run_id: `documented-${now}`,
    created_at: now,
    graphflow: {
      version: null,
      invoked: false,
      mode: "documented-only",
    },
    estimation: {
      method: ESTIMATION_METHOD,
      note: ESTIMATION_NOTE,
    },
    tasks: tasks.map((task) => {
      const baselineFiles = task.baseline?.files ?? [];
      const files = baselineFiles.length > 0 ? estimateFilesTokens(rootDir, baselineFiles) : { tokens: 0, chars: 0, files: [] };
      const search = task.baseline?.search;
      const naive = search
        ? naiveSearch(rootDir, search.query, search.paths ?? baselineFiles)
        : null;
      let simulator = null;
      if (typeof task.instruction_log === "string") {
        const logPath = path.resolve(rootDir, task.instruction_log);
        simulator = simulateHarvest(fs.readFileSync(logPath, "utf8"));
      }
      return {
        id: task.id,
        package: task.package,
        tool: task.tool,
        metrics: {
          tokens_baseline: files.tokens,
          tokens_graphflow: null,
          token_savings_ratio: null,
          naive_search_hits: naive ? naive.hitCount : null,
          naive_search_tokens: naive ? naive.tokens : null,
        },
        planned_steps: stepCommands(task),
        simulator,
        observed: null,
      };
    }),
  };
}

function commandExists(bin) {
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
  return probe.status === 0;
}

export function executeRun(run, tasks, rootDir = ROOT, bin = process.env.GRAPHFLOW_BIN || "graphflow") {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const available = commandExists(bin);
  const next = structuredClone(run);
  next.graphflow = {
    version: null,
    invoked: available,
    mode: available ? "cli" : "cli-missing",
    bin,
  };
  const failures = [];
  for (const entry of next.tasks) {
    const task = byId.get(entry.id);
    const outputs = [];
    if (!available) {
      failures.push(`${entry.id}: ${bin} not on PATH`);
      entry.observed = null;
      continue;
    }
    for (const command of entry.planned_steps ?? []) {
      const rewritten = command.startsWith("graphflow ")
        ? `${bin}${command.slice("graphflow".length)}`
        : command;
      const result = spawnSync(rewritten, {
        cwd: rootDir,
        shell: true,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      outputs.push({
        command: rewritten,
        exitCode: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      });
      if (result.status !== 0) failures.push(`${entry.id}: ${rewritten}`);
    }
    const stdout = outputs.map((item) => item.stdout).join("\n");
    const graphflowTokens = estimateTokens(stdout);
    const baseline = entry.metrics?.tokens_baseline ?? 0;
    entry.metrics.tokens_graphflow = stdout.length > 0 ? graphflowTokens : null;
    entry.metrics.token_savings_ratio = baseline > 0 && stdout.length > 0
      ? Number((1 - graphflowTokens / baseline).toFixed(4))
      : null;
    entry.observed = {
      symbol_ids: [],
      snippets: [],
      callers: [],
      false_positives: [],
      edited_files: [],
      unchanged_symbols: [],
      affected_tests: [],
      doc_links: [],
      steps: task?.expected?.harvest_steps ?? [],
      harvest: null,
      tests_green: null,
      raw_output: stdout,
      cli: outputs,
    };
    entry.notes = "CLI stdout is in observed.raw_output. Copy symbol ids, callers, and safety fields from that output before treating the score as final. Snippet checks also read raw_output.";
  }
  return { run: next, failures };
}

function parseArgs(argv) {
  const ids = [];
  let execute = false;
  let out = path.join(ROOT, "results", "latest.json");
  let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") execute = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--id") ids.push(argv[i + 1]);
    else if (arg === "--out") out = path.resolve(argv[i + 1]);
    if (arg === "--id" || arg === "--out") i += 1;
  }
  return { ids, execute, out, help };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("usage: node scripts/run-tasks.mjs [--id <task>] [--execute] [--out results/latest.json]");
    return;
  }
  const { tasks } = loadTaskFiles();
  const selected = args.ids.length > 0 ? tasks.filter((task) => args.ids.includes(task.id)) : tasks;
  if (selected.length === 0) {
    console.error("No tasks matched.");
    process.exitCode = 1;
    return;
  }
  let run = buildDocumentedRun(selected, ROOT);
  if (args.execute) {
    const executed = executeRun(run, selected, ROOT);
    run = executed.run;
    if (executed.failures.length > 0) {
      console.error(executed.failures.join("\n"));
      process.exitCode = 1;
    }
  }
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, args.out)} (${run.tasks.length} tasks, mode ${run.graphflow.mode})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
