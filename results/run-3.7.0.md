# GraphFlow 3.7.0 evaluation run

Recorded `2026-10-19T04:53:06.697Z`. Binary built from GraphFlow `main` commit `b21c027f4c4918c97f716a40766008fca96b4545` (`node /tmp/gf-370/dist/cli.js version` prints `3.7.0`). `@roarpeng/graphflow@3.7.0` was not on npm, so this is a source build, not an npm install. Each task ran in a throwaway `git worktree` (`git worktree add --detach`); the main working tree was not edited. Token estimate is `ceil(chars/4)` of step stdout.

`node scripts/score.mjs results/run-3.7.0.json`:

```
# GraphFlow eval score: fail
safety_gate: fail
passed 0  failed 15  skipped 0
mean_token_savings: 0.409
```

The mean is the unrounded average of the ten original tasks' ratios (0.40948), printed to three decimals. Reflex tasks have baseline 0, so their ratio stays null and is outside that mean.

The runner fills `edited_files`, `renamed_to`, `tests_green`, and `unchanged_symbols` from the worktree. It does not transcribe `symbol_ids`, `callers`, `snippets`, `hits`, `affected_tests`, `doc_links`, or `harvest`. Those arrays stay empty, so the scorer fails those checks. That is 未提取, not a hand-filled pass and not a claim that the CLI printed nothing. `raw_output` and `cli[].exitCode` in the JSON are the executed evidence. `gf_macro ...` steps are not shell commands; they exited 127 (`gf_macro: not found`) and are 未实际执行.

## Per task

| Task | Tokens | Savings | Scorer | What actually ran |
| --- | --- | ---: | --- | --- |
| ts-read-symbol-slice | 938 → 559 | 0.4041 | fail | CLI exit 0. Slice of `OrderService.cancel` is in stdout. `symbol_ids` 未提取. |
| ts-blast-disambiguate | 1592 → 559 | 0.6489 | fail | CLI exit 0. Blast lists `buyerCancels` and `vip-order-service.ts` `super.cancel`. Callers 未提取. |
| ts-rename-safe | 938 → 127 | 0.8646 | fail | CLI rename exit 0. Typecheck exit 2, TS4113. See below. |
| ts-zh-search | 1245 → 1077 | 0.1349 | fail | Three queries exit 0. Sliced hits include `handleDingDanChaoShi`, `TIMEOUT_WINDOW_MS`, `timeout`, `handleDingDanZhiFu`, `OrderService`, `pay`. `hits` 未提取. |
| ts-affected-tests | 304 → 19 | 0.9375 | fail | CLI on a clean worktree: `0 changed file(s)`. MCP `changedFiles` 未实际执行. |
| py-super-blast | 218 → 243 | −0.1147 | fail | Rename exit 0 (`refund` → `refundInvoice`, 3 files). Unittest `Ran 7 tests` OK. `PartialRefundPolicy.refund` still declared. `symbol_ids` / callers 未提取. |
| py-task-harvest-doc | 117 → 166 | −0.4188 | fail | Harvest promoted `t_0e1024b35c`. Reflect exit 1: compiled step runs `python` (`python: not found`). `harvest` 未提取. |
| go-embed-read | 415 → 354 | 0.147 | fail | CLI exit 0. `Reservation` struct is in stdout. Fields 未提取. |
| rs-trait-dispatch | 523 → 191 | 0.6348 | fail | CLI exit 0. Blast lists `poll_reading`, `describe`, and `sensor_reading`. Callers 未提取. |
| cross-doc-link | 237 → 34 | 0.8565 | fail | `graphflow graph` exit 0 wrote an HTML file only. Doc-link list 未提取; stdout has no `section -> Symbol` lines. |
| reflex-learn-loop | — | — | fail | `task log` and `task harvest` ran (1 log line, nothing promoted). `gf_macro task-harvest` 未实际执行. |
| reflex-mcp-invoke | — | — | fail | Both `gf_macro` steps 未实际执行 (exit 127). |
| reflex-near-threshold | — | — | fail | Both `gf_macro task-run` steps 未实际执行. Unrelated `reflect` ran: MISS, score 0, exit 1. |
| reflex-arg-record | — | — | fail | `gf_macro task-record` and `gf_macro task-run` 未实际执行. CLI `task record` exit 0 (`uses=1/2`, not compiled). |
| reflex-token-rounds | — | — | fail | `gf_macro task-run` 未实际执行. `tokens_graphflow` is null. |

## ts-rename-safe

Command:

```
graphflow edit packages/order-ts/src/services/order-service.ts --symbol OrderService.cancel --rename cancelOrder
```

Stdout (exit 0):

```
OK [renamed 'cancel' -> 'cancelOrder'] 6 occurrence(s) across 4 file(s): packages/order-ts/src/services/order-service.ts, packages/order-ts/__tests__/order-service.test.ts, packages/order-ts/src/app/checkout.ts, packages/order-ts/src/services/vip-order-service.ts
```

`git diff --name-only` matches those four files. `vip-desk.ts` and `vip-order-service.test.ts` were not edited, so the new must-edit checks fail. `RefundService.cancel` is still declared. `renamed_to` is `cancelOrder`.

Test step `npm run typecheck --prefix packages/order-ts && npm test --prefix packages/order-ts` exited 2 before vitest. `tests_green` is false:

```
src/services/vip-order-service.ts(13,12): error TS4113: This member cannot have an 'override' modifier because it is not declared in the base class 'OrderService'.
```

GraphFlow renamed the base method and the `super.cancel` call inside `vip-order-service.ts`, and left the `override cancel` declaration in place. That is the option-A failure this rubric now records. A GraphFlow 3.7.1 override-chain fix was not found on GitHub at record time (latest merged product PRs are #66 and #65). That rerun is 未实际执行.

## py-super-blast evidence

```
OK [renamed 'refund' -> 'refundInvoice'] 3 occurrence(s) across 3 file(s): packages/billing-py/billing/refund.py, packages/billing-py/billing/partial.py, packages/billing-py/billing/settle_full.py
```

`python3 -m unittest` stderr: `Ran 7 tests in 0.000s` / `OK` (exit 0). The scorer still fails the task because `symbol_ids` and callers were not copied out of that stdout.
