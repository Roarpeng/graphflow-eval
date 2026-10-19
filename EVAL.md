# EVAL / 任务目录与评分

How this repo scores GraphFlow 3.x. Headers are bilingual. Task text is English so a run artifact can quote it. 中文说明放在每节的「看什么」里。

GraphFlow is the subject. `npm test` does not call it. A run is a JSON file shaped like `results/template.json`. `scripts/score.mjs` compares that file with `fixtures/tasks/*.json`.

## Rubric / 评分

| Check | Pass | Fail |
| --- | --- | --- |
| Tokens | `tokens_graphflow < tokens_baseline` and `1 - graphflow/baseline` ≥ the task's `min_token_savings_ratio` | Missing numbers on an invoked run, or savings below the bar |
| Correctness | Every required symbol, snippet, caller, hit, field, method, parent, doc link, affected test, or harvest step is present | A required id is missing |
| Exclusions | Excluded symbols, callers, unaffected tests, and doc links are absent | A rejected name shows up in the kept set |
| Safety | `renamed_to` matches, `unchanged_symbols` still name the foreign receivers, `must_not_edit_files` are absent from `edited_files`, `tests_green` is true, `false_positives` is empty | A foreign receiver was edited, or the package tests went red |
| Reflex | Learn-loop promotion and byte offset, MCP `task-run` exit 0, Jaccard near-hit vs miss, and `{{arg1}}` substitution match `observed` | A required replay missed, an unrelated instruction hit, or the offset did not advance |
| Skip | `graphflow.invoked` is false or `observed` is null | — |

Safety tasks (`metric_focus` contains `safety`) are a gate. One safety fail makes `safety_gate` fail even if other tasks pass.

Exit codes from `node scripts/score.mjs`: `0` at least one pass and zero fails, `1` any fail, `2` every task skipped.

Token method: `ceil(chars / 4)`, implemented in `scripts/baseline-naive.mjs`. Use it for both sides. Do not mix in a model tokenizer for only one side.

Caller names are the normalized form you write into `observed`, not a promise that CLI stdout already uses that spelling. Rust callers use `TraitOrType.method <- function`.

## Maintenance macro / billing-py

These two commands are the repeated shell steps for task `py-task-harvest-doc`. They are the format + lint + test stand-in: `compileall` checks syntax, unittest runs the suite. The fixture does not depend on ruff or black. Do not run them from the repo root; `cwd` is `packages/billing-py`.

```bash
python -m compileall -q billing
python -m unittest discover -s tests
```

The committed log `fixtures/instruction-logs/billing-maintenance.jsonl` already contains that instruction twice, in the `{ instruction, steps, at }` shape `graphflow task log` writes. `node scripts/run-tasks.mjs` simulates promotion (`eval-harvest-v1`: two whitespace-normalized repeats → `HIT`). That simulation is not a GraphFlow score. The score reads `observed.harvest` from a real harvest + reflect.

Equivalent CLI, from the repo root, after the log is in place:

```bash
graphflow task harvest --log fixtures/instruction-logs/billing-maintenance.jsonl --json
graphflow reflect "format lint and test billing" --json
```

`reflect` runs the steps. A HIT is `hit: true` (text contains `# Reflected Task`). One recording stays a MISS.

To record from scratch instead of using the fixture log:

```bash
graphflow task log "format lint and test billing" \
  --step "python -m compileall -q billing" \
  --step "python -m unittest discover -s tests" \
  --root packages/billing-py
```

Run that twice, then `graphflow task harvest --root packages/billing-py` and `graphflow reflect "format lint and test billing" --root packages/billing-py --json`.

## Tasks

### 1. `ts-read-symbol-slice`

看什么：只读 `OrderService.cancel`，不要为了这一个方法吞掉整个 `order-service.ts`。

- Tool: `gf_read`
- Target: `packages/order-ts/src/services/order-service.ts#OrderService.cancel`
- Baseline file: that service file
- Pass: symbol id kept, snippet `cancel(order: Order, reason: string)` present, `RefundService.cancel` absent, savings ≥ 0.30
- Naive baseline: whole-file `ceil(chars/4)`

### 2. `ts-blast-disambiguate`

看什么：`OrderService.cancel` 的爆炸半径不要算上 `RefundService.cancel`。

- Include caller `buyerCancels` (`checkout.ts`, receiver `OrderService`)
- Include the `super.cancel` site in `vip-order-service.ts`
- Exclude `buyerWithdrawsRefund` and `vipCancels` (`vipCancels` calls the override on `VipOrderService`)
- Exclude symbol `RefundService.cancel`

### 3. `ts-rename-safe`

看什么：把 `OrderService.cancel` 重命名为 `cancelOrder`，外类的 `cancel` 保持原名，测试仍绿。

```bash
graphflow edit packages/order-ts/src/services/order-service.ts \
  --symbol OrderService.cancel --rename cancelOrder
```

- Edit: `order-service.ts`, `vip-order-service.ts` (`super.cancel` → `super.cancelOrder`; the override declaration stays), `checkout.ts`, `order-service.test.ts`
- Do not require an edit of `__tests__/checkout.test.ts`. That file has no standalone `cancel` identifier (`cancels`, `cancelled`, `cancelReason` only). Rewriting `cancelReason` would turn the package tests red.
- Leave untouched: `RefundService.cancel`, `VipOrderService.cancel` (the override declaration), refund desk, vip desk, and their tests
- `tests_green: true` via `npm test --prefix packages/order-ts`
- Any path in `false_positives`, or an edit under `must_not_edit_files`, fails the safety gate
- Do this on a worktree. Restore the names before committing.

### 4. `ts-zh-search`

看什么：中文和拼音查询能找到支付与超时处理函数。

| Query | Must hit |
| --- | --- |
| `订单超时` | `handleDingDanChaoShi`, `OrderService.timeout` |
| `dingdan zhifu` | `handleDingDanZhiFu` |
| `支付订单` | `handleDingDanZhiFu`, `OrderService.pay` |

The literal baseline for `dingdan zhifu` is 0 hits. Record that under `metrics.naive_search_hits`.

### 5. `ts-affected-tests`

看什么：改一个走 `@order/*` 别名的模块，受影响测试只有对应那一个。

- Changed file: `packages/order-ts/src/handlers/pay-handler.ts`
- The test imports it as `@order/handlers/pay-handler`
- Alias config: `tsconfig.base.json` (`baseUrl` + `paths`) ← `tsconfig.json` and `src/handlers/tsconfig.json`
- Root `tsconfig.json` references `packages/order-ts` for the project-reference walk
- Affected: `packages/order-ts/__tests__/pay-handler.test.ts`
- Unaffected: the other seven `__tests__/*.test.ts` files

MCP passes `changedFiles`. The CLI form `graphflow exec affected-tests` uses `git status --porcelain` when `changedFiles` is omitted, so leave only that file dirty or use MCP.

Residual: the suggested shell command is chosen from the workspace-root `package.json`. This repo's root `npm test` is the scorer, not vitest. Score the listed files. Run the routed file with:

```bash
npm test --prefix packages/order-ts -- __tests__/pay-handler.test.ts
```

### 6. `py-super-blast`

看什么：Python 的爆炸半径和重命名认 `super()`，不把子类接收者算成基类方法。

- Symbol: `packages/billing-py/billing/refund.py#RefundPolicy.refund`
- Include caller `settle_full`
- Exclude caller `settle_partial`
- Snippet from the pre-rename read: `super().refund` in `billing/partial.py`
- Rename base method to `refundInvoice`
- `PartialRefundPolicy.refund` stays
- Edit `refund.py`, `partial.py`, `settle_full.py`
- Do not edit `settle_partial.py` or the test modules
- From `packages/billing-py`: `python3 -m unittest discover -s tests` passes on the worktree

`RefundPolicy` and `PartialRefundPolicy` live in different files so a same-file sibling declaration does not force an ambiguous reject before the super call can be updated.

### 7. `py-task-harvest-doc`

看什么：同一条维护指令记录两次后，reflect 走 HIT，而不是 MISS。

- Log: `fixtures/instruction-logs/billing-maintenance.jsonl`
- Tool: `gf_macro` `task-harvest`, then `graphflow reflect`
- Pass: `observed.harvest` is `HIT`, and `observed.steps` contains both commands above
- The local simulator in `run-tasks.mjs` only checks the log shape

### 8. `go-embed-read`

看什么：读 `Reservation` 时能看到嵌入的 `StockItem` 字段和提升上来的方法。

- Fields: `SKU`, `OnHand`, `Reserved`, `ID`, `Qty`, `Buyer`
- Methods: `Hold`, `Available`
- `StockItem.Available` must list the promoted call inside `Reservation.Hold` (`callers` contains `Hold`)
- Residual: `stock.go` and `reservation.go` are the same package and contain no import statements. GraphFlow 3.6.1 does not invent a file-level `imports` edge for that. A missing `stock.go → reservation.go` import edge is expected. A missing embedded field or a missing `Available` is a failure. Deeper embedding chains are outside this fixture (one embedded type).

### 9. `rs-trait-dispatch`

看什么：trait 方法、`dyn` / `impl Trait` 接收者，和具体类型上的 impl 要分开。

| Receiver | Resolves to | Parent |
| --- | --- | --- |
| `poll_reading(device: &dyn Device)` | `Device.read` | `Device` |
| `describe(device: impl Device)` | `Device.read` | `Device` |
| `sensor_reading(sensor: &Sensor)` | `Sensor.read` | `Sensor` |

Write callers as `Device.read <- poll_reading`, `Device.read <- describe`, `Sensor.read <- sensor_reading`.

Excluded: attaching `sensor_reading` or `actuator_reading` to `Device.read`, and attaching `poll_reading`, `describe`, or `actuator_reading` to `Sensor.read`.

This task is read/blast. GraphFlow may still reject an atomic trait+impl rename; that reject is out of scope here.

### 10. `cross-doc-link`

看什么：`docs/订单超时.md` 的「关单路径」链到它写出的符号，概念句里的「取消 / 退款」不要扩散成一堆边。

- Must link: `handleDingDanChaoShi`, `OrderService.timeout`, `TIMEOUT_WINDOW_MS`
- Must not link: `OrderService.cancel`, `OrderService.pay`, `RefundService.cancel`, `handleDingDanZhiFu`, `StockItem`, `Device.read`, `RefundTests.setUp`
- Cap: at most 3 links from this doc

`graphflow graph` writes `.graphflow/knowledge-graph.html`. Transcribe the kept `doc-links-code` edges into `observed.doc_links` as `section -> Symbol`.

### 11. `reflex-learn-loop`

看什么：外部写入者把同一条维护指令追加到 `.graphflow/instruction-log.jsonl`，CLI `task harvest` 在第二次提升并编译，MCP `task-harvest` 只吃新增字节。

- Writer: `graphflow task log`（GraphFlow 自己不会挂钩宿主，评测脚本就是那个外部写入者）
- Instruction: `format lint and test billing package before release`
- Steps: `cd packages/billing-py && python3 -m compileall -q billing` and `python3 -m unittest discover -s tests -v`
- First harvest records one use and does not compile
- Second harvest promotes `.graphflow/tasks.json` and `.graphflow/tasks/<id>.mjs`
- A harvest with no new bytes reports `entriesRead: 0`
- One more log line, then MCP `gf_macro` `task-harvest`, reads 1 entry and moves the byte offset in `.graphflow/task-harvest.json` to the new file size

### 12. `reflex-mcp-invoke`

看什么：提升之后，MCP stdio 的 `gf_macro` `task-list` / `task-run` 真的执行本地 runner，退出码为 0。

- Replay env: `python3` is on `PATH`. The runner also links `python` → `python3` so a step that says `python` can run. These steps call `python3`.
- MCP result text contains `PASS [exit=0` and `local-runner`
- CLI `graphflow reflect --json` reports `exitCode: 0` for the same instruction

### 13. `reflex-near-threshold`

看什么：token-Jaccard 0.86 附近，一条改写命中，一条差一点的改写和一条无关指令都是 MISS。

| Query | Tokens vs the recorded key | Expected |
| --- | --- | --- |
| `... release quietly` | add `quietly` → 0.875 | HIT, `near match score=`, runner executes |
| `format lint and test billing before release` | drop `package` → 0.857 | MISS, steps do not run |
| `ship the warehouse reservation hold` | 0 | MISS, `hit: false`, CLI exit 1 |

The MISS payload does not carry the score. The 0.857 / 0.000 figures come from GraphFlow's exported `jaccardSimilarity`. The 0.875 figure is parsed from the tool text. A HIT on the unrelated instruction is a false positive and fails the safety gate.

### 14. `reflex-arg-record`

看什么：显式 `task-record`（不是日志收割）第二次编译，`{{arg1}}` 留在 `.mjs` 里，MCP `task-run` 传入 `R3` 后输出 `PASS batch=R3`。

The success dehydrator keeps lines that look like `PASS`. The recorded step is `echo PASS batch={{arg1}}` so the substituted value stays in the text the agent reads.

### 15. `reflex-token-rounds`

看什么：已经编译之后的 N=3 轮。基线是每轮「指令 + 计划的两条命令 + 命令的完整输出」。反射路径是一轮一次 `gf_macro` `task-run` 加上脱水结果。两边都用 `ceil(chars/4)`。节省比例至少 0.35。

`node scripts/run-reflex.mjs` writes `results/run-3.6.1-reflex.json` and `.md`. It needs `GRAPHFLOW_BIN` (and `graphflow-mcp` beside it, or `GRAPHFLOW_MCP`).

## Expected outcome

A careful transcription of GraphFlow 3.6.1 on this tree should pass receiver disambiguation, Python `super()`, `@order/*` affected tests, Chinese/pinyin search, and the Go embed read. The slice of `OrderService.cancel` measured about 938 → 552 tokens (savings about 0.41) after the tool appended a linked excerpt of this file, which is why the bar is 0.30 and not the ~96% figure from GraphFlow's own large-file benchmark.

Two claims stay strict, and a 3.6.1 probe did not clear them:

- `rs-trait-dispatch`: `&dyn Device` (`poll_reading`) attached to `Device.read`, and `&Sensor` (`sensor_reading`) attached to `Sensor.read`. `describe` (`impl Device`) did not appear on `Device.read`. The task still requires that caller.
- `cross-doc-link`: 关单路径 linked `handleDingDanChaoShi`, the `OrderService` class, and `OrderService.timeout`. It did not link the named constant `TIMEOUT_WINDOW_MS`. 业务背景 added a concept edge to `RefundTests.setUp` (shared 买家 / maijia, confidence 0.52). Four edges and that cross-package link fail the cap and the exclusion list.

The missing Go file-level import edge stays a residual, not a failure. Rename tasks that edit a foreign `cancel` or `refund` fail even if the tests happen to pass.
