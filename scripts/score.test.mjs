import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens, naiveSearch } from "./baseline-naive.mjs";
import { buildDocumentedRun, simulateHarvest } from "./run-tasks.mjs";
import { loadTaskFiles, scoreRun } from "./score.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("token estimate is ceil(chars/4)", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("task catalog has the required ids", () => {
  const { tasks } = loadTaskFiles();
  const ids = tasks.map((task) => task.id);
  assert.deepEqual(ids, [
    "cross-doc-link",
    "go-embed-read",
    "py-super-blast",
    "py-task-harvest-doc",
    "reflex-arg-record",
    "reflex-learn-loop",
    "reflex-mcp-invoke",
    "reflex-near-threshold",
    "reflex-token-rounds",
    "rs-trait-dispatch",
    "ts-affected-tests",
    "ts-blast-disambiguate",
    "ts-read-symbol-slice",
    "ts-rename-safe",
    "ts-zh-search",
  ]);
  for (const task of tasks) {
    assert.equal(task.id, path.basename(task.id));
    assert.ok(task.package);
    assert.ok(task.tool);
    assert.ok(Array.isArray(task.steps) && task.steps.length > 0);
    assert.ok(task.expected);
    assert.ok(task.steps.every((step) => step.mcp || step.command));
  }
});

test("fixture sources still carry the stress points", () => {
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
  const order = read("packages/order-ts/src/services/order-service.ts");
  const refund = read("packages/order-ts/src/services/refund-service.ts");
  const vip = read("packages/order-ts/src/services/vip-order-service.ts");
  assert.match(order, /cancel\(order: Order, reason: string\)/);
  assert.match(refund, /cancel\(request: RefundRequest\)/);
  assert.match(vip, /super\.cancel\(order, audited\)/);
  assert.match(read("packages/order-ts/src/handlers/pay-handler.ts"), /function handleDingDanZhiFu/);
  assert.match(read("packages/order-ts/src/handlers/timeout-handler.ts"), /function handleDingDanChaoShi/);
  assert.match(read("packages/order-ts/docs/订单超时.md"), /OrderService\.timeout/);
  assert.match(read("packages/order-ts/tsconfig.base.json"), /@order\/\*/);
  assert.match(read("packages/order-ts/tsconfig.json"), /tsconfig\.base\.json/);
  assert.match(read("packages/order-ts/src/handlers/tsconfig.json"), /tsconfig\.base\.json/);
  assert.match(read("packages/billing-py/billing/partial.py"), /super\(\)\.refund/);
  assert.match(read("packages/inventory-go/reservation.go"), /StockItem/);
  const dispatch = read("packages/device-rs/src/dispatch.rs");
  assert.match(dispatch, /&dyn Device/);
  assert.match(dispatch, /impl Device/);
  assert.match(dispatch, /fn sensor_reading/);
});

test("pinyin query is invisible to the literal baseline", () => {
  const found = naiveSearch(ROOT, "dingdan zhifu", ["packages/order-ts/src"]);
  assert.equal(found.hitCount, 0);
});

test("documented run records baseline tokens and a harvest HIT simulation", () => {
  const { tasks } = loadTaskFiles();
  const run = buildDocumentedRun(tasks, ROOT, "2026-10-18T00:00:00.000Z");
  assert.equal(run.graphflow.invoked, false);
  const slice = run.tasks.find((task) => task.id === "ts-read-symbol-slice");
  assert.ok(slice.metrics.tokens_baseline > 50);
  assert.equal(slice.metrics.tokens_graphflow, null);
  const search = run.tasks.find((task) => task.id === "ts-zh-search");
  assert.equal(search.metrics.naive_search_hits, 0);
  const harvest = run.tasks.find((task) => task.id === "py-task-harvest-doc");
  assert.equal(harvest.simulator.harvest, "HIT");
  assert.equal(harvest.simulator.promoted[0].uses, 2);
  const report = scoreRun(run, loadTaskFiles().byId);
  assert.equal(report.status, "skipped");
  assert.equal(report.summary.failed, 0);
});

test("one instruction-log line stays a MISS", () => {
  const once = simulateHarvest(`${JSON.stringify({
    instruction: "format lint and test billing",
    steps: ["python -m compileall -q billing"],
    at: "2026-10-18T00:00:00.000Z",
  })}\n`);
  assert.equal(once.harvest, "MISS");
});

test("example run passes the slice task", () => {
  const run = JSON.parse(fs.readFileSync(path.join(ROOT, "results", "example-run.json"), "utf8"));
  const report = scoreRun(run, loadTaskFiles().byId);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.passed, 1);
  assert.equal(report.summary.failed, 0);
});

test("template is not a measured pass", () => {
  const run = JSON.parse(fs.readFileSync(path.join(ROOT, "results", "template.json"), "utf8"));
  const report = scoreRun(run, loadTaskFiles().byId);
  assert.equal(report.status, "fail");
});

test("a foreign-receiver edit fails the safety gate", () => {
  const { byId } = loadTaskFiles();
  const run = {
    graphflow: { invoked: true, mode: "cli", version: "3.6.1" },
    tasks: [
      {
        id: "ts-rename-safe",
        metrics: { tokens_baseline: 100, tokens_graphflow: 100, token_savings_ratio: 0 },
        observed: {
          renamed_to: "cancelOrder",
          unchanged_symbols: ["VipOrderService.cancel"],
          edited_files: [
            "packages/order-ts/src/services/order-service.ts",
            "packages/order-ts/src/services/vip-order-service.ts",
            "packages/order-ts/src/app/checkout.ts",
            "packages/order-ts/__tests__/order-service.test.ts",
            "packages/order-ts/src/services/refund-service.ts",
          ],
          false_positives: ["RefundService.cancel"],
          tests_green: true,
        },
      },
    ],
  };
  const report = scoreRun(run, byId);
  assert.equal(report.status, "fail");
  assert.equal(report.safety_gate, "fail");
});

test("normalized blast, search, embed, trait, doc, and harvest observations pass", () => {
  const { byId } = loadTaskFiles();
  const run = {
    graphflow: { invoked: true, mode: "mcp", version: "3.6.1" },
    tasks: [
      {
        id: "ts-zh-search",
        metrics: {},
        observed: {
          hits: [
            { q: "订单超时", symbol_ids: ["handleDingDanChaoShi", "OrderService.timeout"] },
            { q: "dingdan zhifu", symbol_ids: ["packages/order-ts/src/handlers/pay-handler.ts#handleDingDanZhiFu"] },
            { q: "支付订单", symbol_ids: ["handleDingDanZhiFu", "OrderService.pay"] },
          ],
        },
      },
      {
        id: "go-embed-read",
        metrics: {},
        observed: {
          symbol_ids: ["packages/inventory-go/reservation.go#Reservation"],
          fields: ["SKU", "OnHand", "Reserved", "ID", "Qty", "Buyer"],
          methods: ["Hold", "Available"],
          callers: ["Reservation.Hold"],
        },
      },
      {
        id: "rs-trait-dispatch",
        metrics: {},
        observed: {
          symbol_ids: [
            "packages/device-rs/src/device.rs#Device.read",
            "packages/device-rs/src/sensor.rs#Sensor.read",
          ],
          parent_class: { "Device.read": "Device", "Sensor.read": "Sensor" },
          callers: [
            "Device.read <- poll_reading",
            "Device.read <- describe",
            "Sensor.read <- sensor_reading",
          ],
        },
      },
      {
        id: "cross-doc-link",
        metrics: {},
        observed: {
          doc_links: [
            "订单超时.md#关单路径 -> handleDingDanChaoShi",
            "订单超时.md#关单路径 -> OrderService.timeout",
            "订单超时.md#关单路径 -> TIMEOUT_WINDOW_MS",
          ],
        },
      },
      {
        id: "py-task-harvest-doc",
        metrics: {},
        observed: {
          harvest: "HIT",
          steps: [
            "python -m compileall -q billing",
            "python -m unittest discover -s tests",
          ],
        },
      },
    ],
  };
  const report = scoreRun(run, byId);
  assert.equal(report.status, "pass", JSON.stringify(report.tasks, null, 2));
});

test("reflex observations pass and a false near-hit fails the safety gate", () => {
  const { byId } = loadTaskFiles();
  const passing = {
    graphflow: { invoked: true, mode: "cli+mcp-stdio", version: "3.6.1" },
    tasks: [
      {
        id: "reflex-learn-loop",
        metrics: {},
        observed: {
          harvest: "HIT",
          steps: [
            "cd packages/billing-py && python3 -m compileall -q billing",
            "cd packages/billing-py && python3 -m unittest discover -s tests -v",
          ],
          learn: {
            log_lines: 3,
            promoted: true,
            compiled: true,
            script_path: ".graphflow/tasks/t_0123456789.mjs",
            tasks_json: true,
            first_compiled: false,
            idle_entries: 0,
            mcp_entries: 1,
            offset_before_mcp: 100,
            offset_after_mcp: 180,
            log_bytes: 180,
          },
        },
      },
      {
        id: "reflex-mcp-invoke",
        metrics: {},
        observed: {
          reflect: "HIT",
          exit_code: 0,
          cli_exit_code: 0,
          mcp_actions: ["task-list", "task-run"],
          snippets: ["PASS [exit=0", "local-runner"],
          raw_output: "PASS [exit=0, 12ms] OK\nlocal-runner",
        },
      },
      {
        id: "reflex-near-threshold",
        metrics: {},
        observed: {
          near_hit: true,
          near_score: 0.875,
          below_miss: true,
          unrelated_miss: true,
          false_hit: false,
          false_positives: [],
          raw_output: "near match score=0.875\nMISS [no-reflected-task]",
        },
      },
      {
        id: "reflex-arg-record",
        metrics: {},
        observed: {
          compiled: true,
          exit_code: 0,
          mcp_actions: ["task-record", "task-run"],
          snippets: ["{{arg1}}", "not-compiled-yet"],
          raw_output: "not-compiled-yet\n{{arg1}}\nPASS batch=R3",
        },
      },
      {
        id: "reflex-token-rounds",
        metrics: { tokens_baseline: 900, tokens_graphflow: 300, token_savings_ratio: 0.6667, rounds: 3 },
        observed: { exit_code: 0, raw_output: "PASS [exit=0, 4ms] OK" },
      },
    ],
  };
  const passReport = scoreRun(passing, byId);
  assert.equal(passReport.status, "pass", JSON.stringify(passReport.tasks, null, 2));
  assert.equal(passReport.safety_gate, "pass");

  const missed = {
    graphflow: { invoked: true, version: "3.6.1" },
    tasks: [
      {
        id: "reflex-near-threshold",
        metrics: {},
        observed: {
          near_hit: true,
          near_score: 0.875,
          below_miss: true,
          unrelated_miss: false,
          false_hit: true,
          false_positives: ["ship the warehouse reservation hold"],
        },
      },
    ],
  };
  const failReport = scoreRun(missed, byId);
  assert.equal(failReport.status, "fail");
  assert.equal(failReport.safety_gate, "fail");
});
