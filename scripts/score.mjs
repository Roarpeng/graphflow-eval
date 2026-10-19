#!/usr/bin/env node
/**
 * Score a GraphFlow eval run against fixtures/tasks/*.json.
 *
 * A documented-only run (graphflow.invoked = false, observed = null) is
 * skipped, not passed. Pass/fail applies when a run records an invoked
 * GraphFlow result.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadTaskFiles(tasksDir = path.join(ROOT, "fixtures", "tasks")) {
  const files = fs.readdirSync(tasksDir).filter((name) => name.endsWith(".json")).sort();
  const tasks = files.map((name) => JSON.parse(fs.readFileSync(path.join(tasksDir, name), "utf8")));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return { tasks, byId };
}

function normPath(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

export function symbolKey(value) {
  const text = normPath(value).replace(/^sym:/, "");
  const hash = text.lastIndexOf("#");
  return hash >= 0 ? text.slice(hash + 1) : text;
}

function matchesSymbol(candidate, expected) {
  return symbolKey(candidate) === symbolKey(expected);
}

function matchesPath(candidate, expected) {
  const got = normPath(candidate);
  const want = normPath(expected);
  if (!got || !want) return false;
  return got === want || got.endsWith(`/${want}`) || want.endsWith(`/${got}`);
}

function asList(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function listHasSymbol(list, expected) {
  return list.some((item) => matchesSymbol(item, expected));
}

function listHasPath(list, expected) {
  return list.some((item) => matchesPath(item, expected));
}

function callerText(list) {
  return asList(list).join("\n");
}

function hasCaller(list, expected) {
  const needle = String(expected);
  return asList(list).some((item) => item === needle || item.includes(needle));
}

function check(id, ok, detail) {
  return { id, ok, detail };
}

function scoreExpected(expected, entry) {
  const observed = entry.observed ?? {};
  const metrics = entry.metrics ?? {};
  const checks = [];
  const symbols = asList(observed.symbol_ids);
  const snippets = asList(observed.snippets);
  const raw = typeof observed.raw_output === "string" ? observed.raw_output : "";
  const snippetBlob = `${snippets.join("\n")}\n${raw}`;

  for (const id of expected.symbol_ids ?? []) {
    checks.push(check(`symbol:${symbolKey(id)}`, listHasSymbol(symbols, id), id));
  }
  for (const id of expected.must_exclude_symbols ?? []) {
    checks.push(check(`exclude-symbol:${symbolKey(id)}`, !listHasSymbol(symbols, id), id));
  }
  for (const snippet of expected.snippets ?? []) {
    checks.push(check(`snippet:${snippet}`, snippetBlob.includes(snippet), snippet));
  }
  for (const caller of expected.callers_include ?? []) {
    checks.push(check(`caller:${caller}`, hasCaller(observed.callers, caller), caller));
  }
  if (Array.isArray(expected.hits)) {
    const observedHits = Array.isArray(observed.hits) ? observed.hits : [];
    for (const hit of expected.hits) {
      const match = observedHits.find((item) => item && item.q === hit.q);
      const ids = asList(match?.symbol_ids);
      for (const id of hit.symbol_ids ?? []) {
        checks.push(check(`hit:${hit.q}:${symbolKey(id)}`, Boolean(match) && listHasSymbol(ids, id), `${hit.q} -> ${id}`));
      }
    }
  }
  if (Array.isArray(expected.callers_include_any) && expected.callers_include_any.length > 0) {
    const ok = expected.callers_include_any.some((caller) => hasCaller(observed.callers, caller));
    checks.push(check("caller:any", ok, expected.callers_include_any.join(" | ")));
  }
  for (const caller of expected.callers_exclude ?? []) {
    checks.push(check(`caller-exclude:${caller}`, !hasCaller(observed.callers, caller), caller));
  }
  if (typeof expected.min_token_savings_ratio === "number") {
    const baseline = metrics.tokens_baseline;
    const graphflow = metrics.tokens_graphflow;
    const ratio = typeof baseline === "number" && baseline > 0 && typeof graphflow === "number"
      ? 1 - graphflow / baseline
      : null;
    const ok = ratio !== null && graphflow < baseline && ratio >= expected.min_token_savings_ratio;
    checks.push(check(
      "tokens",
      ok,
      ratio === null
        ? "tokens_baseline and tokens_graphflow are required"
        : `savings ${ratio.toFixed(3)} vs min ${expected.min_token_savings_ratio}`,
    ));
  }
  for (const file of expected.affected_tests ?? []) {
    checks.push(check(`affected:${file}`, listHasPath(observed.affected_tests, file), file));
  }
  for (const file of expected.unaffected_tests ?? []) {
    checks.push(check(`unaffected:${file}`, !listHasPath(observed.affected_tests, file), file));
  }
  for (const file of expected.must_edit_files ?? []) {
    checks.push(check(`edited:${file}`, listHasPath(observed.edited_files, file), file));
  }
  for (const file of expected.must_not_edit_files ?? []) {
    checks.push(check(`untouched:${file}`, !listHasPath(observed.edited_files, file), file));
  }
  for (const id of expected.unchanged_symbols ?? []) {
    checks.push(check(`unchanged:${symbolKey(id)}`, listHasSymbol(observed.unchanged_symbols, id), id));
  }
  if (typeof expected.renamed_to === "string") {
    checks.push(check("renamed_to", observed.renamed_to === expected.renamed_to, expected.renamed_to));
  }
  for (const field of expected.fields ?? []) {
    checks.push(check(`field:${field}`, asList(observed.fields).includes(field), field));
  }
  for (const method of expected.methods ?? []) {
    checks.push(check(`method:${method}`, asList(observed.methods).includes(method), method));
  }
  if (expected.parent_class && typeof expected.parent_class === "object") {
    const parents = observed.parent_class && typeof observed.parent_class === "object" ? observed.parent_class : {};
    for (const [key, value] of Object.entries(expected.parent_class)) {
      const actual = Object.entries(parents).find(([candidate]) => symbolKey(candidate) === symbolKey(key));
      checks.push(check(`parent:${symbolKey(key)}`, actual?.[1] === value, `${key} -> ${value}`));
    }
  }
  const docLinks = asList(observed.doc_links);
  for (const link of expected.doc_must_link ?? []) {
    checks.push(check(`doc-link:${link}`, docLinks.some((item) => item.includes(link)), link));
  }
  for (const link of expected.doc_must_not_link ?? []) {
    checks.push(check(`doc-unlink:${link}`, docLinks.every((item) => !item.includes(link)), link));
  }
  if (typeof expected.max_doc_links === "number") {
    checks.push(check("doc-cap", docLinks.length <= expected.max_doc_links && docLinks.length > 0, `links ${docLinks.length} <= ${expected.max_doc_links}`));
  }
  if (typeof expected.harvest === "string") {
    checks.push(check("harvest", observed.harvest === expected.harvest, expected.harvest));
  }
  for (const step of expected.harvest_steps ?? []) {
    const blob = asList(observed.steps).join("\n");
    checks.push(check(`harvest-step:${step}`, blob.includes(step), step));
  }
  if (expected.learn && typeof expected.learn === "object") {
    const learn = observed.learn && typeof observed.learn === "object" ? observed.learn : {};
    const minLines = expected.learn.min_log_lines ?? 2;
    checks.push(check("log-lines", typeof learn.log_lines === "number" && learn.log_lines >= minLines, String(learn.log_lines ?? "")));
    checks.push(check("promoted", learn.promoted === true, "promoted"));
    checks.push(check("compiled-mjs", learn.compiled === true, learn.script_path ?? ""));
    checks.push(check("tasks-json", learn.tasks_json === true, "tasks.json"));
    checks.push(check("first-uncompiled", learn.first_compiled === false, String(learn.first_compiled)));
    checks.push(check("idle-entries", learn.idle_entries === expected.learn.idle_entries, String(learn.idle_entries ?? "")));
    checks.push(check("mcp-harvest-entries", learn.mcp_entries === expected.learn.mcp_entries, String(learn.mcp_entries ?? "")));
    const advanced = typeof learn.offset_before_mcp === "number"
      && typeof learn.offset_after_mcp === "number"
      && learn.offset_after_mcp > learn.offset_before_mcp;
    checks.push(check("offset-advanced", advanced, `${learn.offset_before_mcp} -> ${learn.offset_after_mcp}`));
    checks.push(check(
      "offset-matches-bytes",
      typeof learn.log_bytes === "number" && learn.offset_after_mcp === learn.log_bytes,
      `${learn.offset_after_mcp}/${learn.log_bytes}`,
    ));
  }
  if (typeof expected.reflect === "string") {
    checks.push(check("reflect", observed.reflect === expected.reflect, expected.reflect));
  }
  if (typeof expected.exit_code === "number") {
    checks.push(check("exit_code", observed.exit_code === expected.exit_code, String(expected.exit_code)));
  }
  if (typeof expected.cli_exit_code === "number") {
    checks.push(check("cli_exit_code", observed.cli_exit_code === expected.cli_exit_code, String(expected.cli_exit_code)));
  }
  for (const action of expected.mcp_actions ?? []) {
    checks.push(check(`mcp:${action}`, asList(observed.mcp_actions).includes(action), action));
  }
  if (expected.compiled === true) {
    checks.push(check("compiled", observed.compiled === true, "compiled"));
  }
  if (typeof expected.arg_rendered === "string") {
    checks.push(check(`arg:${expected.arg_rendered}`, snippetBlob.includes(expected.arg_rendered), expected.arg_rendered));
  }
  if (expected.near && typeof expected.near === "object") {
    const score = observed.near_score;
    const minScore = expected.near.min_score ?? 0.86;
    const scoreOk = typeof score === "number" && score >= minScore && score < 1;
    checks.push(check("near-hit", observed.near_hit === true, "near_hit"));
    checks.push(check("near-score", scoreOk, String(score)));
    checks.push(check("below-miss", observed.below_miss === true, "below_miss"));
    checks.push(check("unrelated-miss", observed.unrelated_miss === true, "unrelated_miss"));
    checks.push(check("false-hit", observed.false_hit !== true, String(observed.false_hit)));
  }
  if (typeof expected.rounds === "number") {
    checks.push(check("rounds", metrics.rounds === expected.rounds, String(metrics.rounds ?? "")));
  }
  if (expected.tests_green === true) {
    checks.push(check("tests_green", observed.tests_green === true, "tests_green"));
  }
  const falsePositives = asList(observed.false_positives);
  if (falsePositives.length > 0) {
    checks.push(check("false-positives", false, falsePositives.join(", ")));
  }
  return checks;
}

export function scoreRun(run, tasksById) {
  const invoked = run?.graphflow?.invoked === true;
  const taskEntries = Array.isArray(run?.tasks) ? run.tasks : [];
  const scored = [];
  for (const entry of taskEntries) {
    const task = tasksById.get(entry.id);
    if (!task) {
      scored.push({ id: entry.id ?? "", status: "fail", checks: [check("known-task", false, "no fixture with this id")] });
      continue;
    }
    if (!invoked || entry.observed == null) {
      scored.push({ id: task.id, status: "skipped", checks: [], metrics: entry.metrics ?? null });
      continue;
    }
    const checks = scoreExpected(task.expected ?? {}, entry);
    const failed = checks.filter((item) => !item.ok);
    scored.push({
      id: task.id,
      status: failed.length === 0 ? "pass" : "fail",
      checks,
      metrics: entry.metrics ?? null,
    });
  }
  const passed = scored.filter((item) => item.status === "pass").length;
  const failed = scored.filter((item) => item.status === "fail").length;
  const skipped = scored.filter((item) => item.status === "skipped").length;
  const savings = scored
    .map((item) => item.metrics)
    .filter((metrics) => metrics && typeof metrics.token_savings_ratio === "number")
    .map((metrics) => metrics.token_savings_ratio);
  const safetyTasks = scored.filter((item) => {
    const task = tasksById.get(item.id);
    return task?.metric_focus?.includes("safety");
  });
  const safetyGate = safetyTasks.length === 0
    ? "skipped"
    : safetyTasks.some((item) => item.status === "fail")
      ? "fail"
      : safetyTasks.every((item) => item.status === "skipped")
        ? "skipped"
        : "pass";
  const status = failed > 0 ? "fail" : passed > 0 ? "pass" : "skipped";
  return {
    status,
    safety_gate: safetyGate,
    summary: {
      passed,
      failed,
      skipped,
      mean_token_savings: savings.length > 0 ? savings.reduce((sum, value) => sum + value, 0) / savings.length : null,
    },
    tasks: scored,
  };
}

export function formatReport(report) {
  const lines = [
    `# GraphFlow eval score: ${report.status}`,
    `safety_gate: ${report.safety_gate}`,
    `passed ${report.summary.passed}  failed ${report.summary.failed}  skipped ${report.summary.skipped}`,
  ];
  if (report.summary.mean_token_savings !== null) {
    lines.push(`mean_token_savings: ${report.summary.mean_token_savings.toFixed(3)}`);
  }
  for (const task of report.tasks) {
    lines.push(`- ${task.id}: ${task.status}`);
    for (const item of task.checks ?? []) {
      if (!item.ok) lines.push(`    fail ${item.id} (${item.detail})`);
    }
  }
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("usage: node scripts/score.mjs [--example] [results/run.json]");
    return;
  }
  const example = args.includes("--example");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  const file = example || !fileArg ? path.join(ROOT, "results", example ? "example-run.json" : "latest.json") : path.resolve(fileArg);
  if (!fs.existsSync(file)) {
    console.error(`No run artifact at ${file}.`);
    console.error("Generate a baseline with: node scripts/run-tasks.mjs");
    console.error("Score the checked-in example with: node scripts/score.mjs --example");
    process.exitCode = 2;
    return;
  }
  const run = JSON.parse(fs.readFileSync(file, "utf8"));
  const { byId } = loadTaskFiles();
  const report = scoreRun(run, byId);
  console.log(formatReport(report));
  if (report.status === "fail") process.exitCode = 1;
  else if (report.status === "skipped") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
