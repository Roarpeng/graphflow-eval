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
 * --execute runs each task in a temporary git worktree, then deletes it.
 * edited_files, renamed_to, tests_green, and unchanged_symbols are filled
 * from that worktree. Install the CLI first, or set GRAPHFLOW_BIN.
 * Fixture unit tests do not use this flag.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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
  if (bin.includes("/") || bin.includes("\\")) return fs.existsSync(bin);
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
  return probe.status === 0;
}

const RENAMED_RE = /OK \[renamed '([^']*)' -> '([^']*)'\]/g;
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".go", ".rs"]);

/** Last `OK [renamed 'old' -> 'new']` new-name, or null when GraphFlow did not rename. */
export function parseRenamedTo(text) {
  let name = null;
  for (const match of String(text ?? "").matchAll(RENAMED_RE)) name = match[2];
  return name;
}

/** A shell step whose exit code is the task's tests_green bit. */
export function isTestStep(command) {
  return /(?:^|[\s;&|])(?:npm(?:\s+run)?\s+(?:test|typecheck)|python3?\s+-m\s+unittest|pytest|go\s+test|cargo\s+test)\b/.test(String(command ?? ""));
}

/** True when every test/typecheck step exited 0. Null when the task has no such step. */
export function testsGreenFromSteps(outputs) {
  const tests = (outputs ?? []).filter((item) => isTestStep(item.command));
  if (tests.length === 0) return null;
  return tests.every((item) => item.exitCode === 0);
}

export function normalizeDiffPaths(names) {
  const out = [];
  for (const name of names ?? []) {
    const cleaned = String(name).replace(/\\/g, "/").replace(/^\.\//, "").trim();
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
  }
  return out;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkSources(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target" || entry.name === "dist") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSources(abs, out);
    else if (SOURCE_EXTS.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

function languageOf(file) {
  const ext = path.extname(file);
  if (ext === ".py") return "py";
  if (ext === ".go") return "go";
  if (ext === ".rs") return "rs";
  return "ts";
}

function methodDeclaration(method, language) {
  const name = escapeRegExp(method);
  if (language === "py") return new RegExp(`^\\s*(?:async\\s+)?def\\s+${name}\\s*\\(`, "m");
  if (language === "go") return new RegExp(`^func\\s*\\([^\\n]*\\)\\s*${name}\\s*\\(`, "m");
  if (language === "rs") return new RegExp(`^\\s*(?:pub(?:\\([^)]*\\))?\\s+)?(?:async\\s+)?fn\\s+${name}\\s*\\(`, "m");
  return new RegExp(`^\\s*(?:export\\s+)?(?:public\\s+|private\\s+|protected\\s+|override\\s+|async\\s+|static\\s+|abstract\\s+|readonly\\s+)*${name}\\s*\\(`, "m");
}

function classBody(source, className, language) {
  const name = escapeRegExp(className);
  if (language === "py") {
    const lines = source.split(/\n/);
    const start = new RegExp(`^(\\s*)class\\s+${name}\\b`);
    for (let i = 0; i < lines.length; i += 1) {
      const match = start.exec(lines[i]);
      if (!match) continue;
      const indent = match[1].length;
      const body = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j];
        if (!line.trim()) {
          body.push(line);
          continue;
        }
        if ((line.match(/^\s*/)[0].length) <= indent) break;
        body.push(line);
      }
      return body.join("\n");
    }
    return null;
  }
  if (language === "go") {
    return new RegExp(`^func\\s*\\(\\s*\\w+\\s+\\*?${name}\\s*\\)[\\s\\S]*`, "m").test(source) ? source : null;
  }
  const start = new RegExp(`(?:^|\\n)([ \\t]*)(?:export\\s+)?(?:abstract\\s+)?class\\s+${name}\\b`);
  const match = start.exec(source);
  if (!match) return null;
  const from = match.index + (source[match.index] === "\n" ? 1 : 0);
  const open = source.indexOf("{", from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** True when `Class.method` (or a bare function name) is still declared in rootDir. */
export function declarationStillPresent(rootDir, symbolId) {
  const text = String(symbolId ?? "");
  const dot = text.lastIndexOf(".");
  const className = dot >= 0 ? text.slice(0, dot) : "";
  const method = dot >= 0 ? text.slice(dot + 1) : text;
  if (!method || !rootDir || !fs.existsSync(rootDir)) return false;
  for (const file of walkSources(rootDir)) {
    const source = fs.readFileSync(file, "utf8");
    const language = languageOf(file);
    const decl = methodDeclaration(method, language);
    if (!className) {
      if (decl.test(source)) return true;
      continue;
    }
    const body = classBody(source, className, language);
    if (body && decl.test(body)) return true;
  }
  return false;
}

export function unchangedSymbolsPresent(rootDir, symbols) {
  return (symbols ?? []).filter((symbol) => declarationStillPresent(rootDir, symbol));
}

/**
 * Safety fields a scorer can trust. `diffNames` is `git diff --name-only` output.
 * `unchangedSymbols` is the task's expected list; only names still declared are kept.
 */
export function observeExecutedTask({ outputs, diffNames, rootDir, unchangedSymbols }) {
  const stdout = (outputs ?? []).map((item) => item.stdout ?? "").join("\n");
  const stderr = (outputs ?? []).map((item) => item.stderr ?? "").join("\n");
  const combined = `${stdout}\n${stderr}`;
  return {
    renamed_to: parseRenamedTo(combined),
    edited_files: normalizeDiffPaths(diffNames),
    tests_green: testsGreenFromSteps(outputs),
    unchanged_symbols: unchangedSymbolsPresent(rootDir, unchangedSymbols),
    raw_output: combined.trim(),
  };
}

function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function linkIgnoredDeps(sourceRoot, worktree) {
  for (const rel of ["node_modules", "packages/order-ts/node_modules"]) {
    const from = path.join(sourceRoot, rel);
    const to = path.join(worktree, rel);
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.symlinkSync(from, to, "dir");
  }
}

function runInWorktree(rootDir, fn) {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), "gf-eval-wt-"));
  const added = git(["worktree", "add", "--detach", wt, "HEAD"], rootDir);
  if (added.status !== 0) {
    fs.rmSync(wt, { recursive: true, force: true });
    throw new Error((added.stderr || added.stdout || "git worktree add failed").trim());
  }
  try {
    linkIgnoredDeps(rootDir, wt);
    return fn(wt);
  } finally {
    git(["worktree", "remove", "--force", wt], rootDir);
    fs.rmSync(wt, { recursive: true, force: true });
  }
}

export function executeRun(run, tasks, rootDir = ROOT, bin = process.env.GRAPHFLOW_BIN || "graphflow") {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const available = commandExists(bin);
  const next = structuredClone(run);
  const version = available
    ? spawnSync(bin, ["version"], { cwd: rootDir, encoding: "utf8" }).stdout?.trim() ?? null
    : null;
  next.graphflow = {
    version: version || null,
    invoked: available,
    mode: available ? "cli" : "cli-missing",
    bin,
  };
  const failures = [];
  for (const entry of next.tasks) {
    const task = byId.get(entry.id);
    if (!available) {
      failures.push(`${entry.id}: ${bin} not on PATH`);
      entry.observed = null;
      continue;
    }
    let captured;
    try {
      captured = runInWorktree(rootDir, (wt) => {
        const outputs = [];
        for (const command of entry.planned_steps ?? []) {
          const rewritten = command.startsWith("graphflow ")
            ? `${bin}${command.slice("graphflow".length)}`
            : command;
          const result = spawnSync(rewritten, {
            cwd: wt,
            shell: true,
            encoding: "utf8",
            timeout: 180_000,
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
        const diff = git(["diff", "--name-only", "HEAD"], wt);
        const observation = observeExecutedTask({
          outputs,
          diffNames: (diff.stdout ?? "").split(/\n/),
          rootDir: wt,
          unchangedSymbols: task?.expected?.unchanged_symbols ?? [],
        });
        return { outputs, observation };
      });
    } catch (error) {
      failures.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
      entry.observed = null;
      continue;
    }
    const stdout = captured.outputs.map((item) => item.stdout ?? "").join("\n");
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
      edited_files: captured.observation.edited_files,
      unchanged_symbols: captured.observation.unchanged_symbols,
      renamed_to: captured.observation.renamed_to,
      affected_tests: [],
      doc_links: [],
      steps: task?.expected?.harvest_steps ?? [],
      harvest: null,
      tests_green: captured.observation.tests_green,
      raw_output: captured.observation.raw_output,
      cli: captured.outputs,
    };
    entry.notes = "edited_files, renamed_to, tests_green, and unchanged_symbols are filled from the worktree. symbol_ids, callers, snippets, affected_tests, doc_links, and harvest are not extracted by this runner.";
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
