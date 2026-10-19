# graphflow-eval

评测 [GraphFlow](https://github.com/Roarpeng/GraphFlow) 3.x 的 Token-First 工具（`gf_read`、`gf_edit`、`gf_exec`、`gf_macro`），对照朴素基线（整文件读取 + 字面量搜索）。本仓库是被测对象的夹具，不替代 GraphFlow。

English: a fixture monorepo so a person or an agent can measure GraphFlow against that naive baseline. The packages build and test on their own. GraphFlow is optional and is never imported by `npm test`.

## Results / 实测

Token method for every row is `ceil(chars/4)`. Pass/fail is `scripts/score.mjs` against `fixtures/tasks`. Numbers below are measurements, not a forecast.

### GraphFlow 3.6.1 on this repo

`node scripts/score.mjs results/run-3.6.1.json` after the `ts-rename-safe` rubric fix (see below): **6 pass / 10**, safety gate fail. The scorer prints mean token savings **−0.368** (the unrounded mean of the ten ratios is −0.3678). Artifact: `results/run-3.6.1.md` (that file still lists the old `checkout.test.ts` check; the re-score does not). The reflex suite is separate: `results/run-3.6.1-reflex.md`, **5/5**, safety gate pass, **750 → 252** tokens over 3 replays (savings 0.664).

| Task | 3.6.1 tokens | Savings | Result |
| --- | --- | ---: | --- |
| ts-read-symbol-slice | 938 → 552 | 0.4115 | pass |
| ts-blast-disambiguate | 1573 → 552 | 0.6491 | pass |
| ts-rename-safe | 938 → 158 | 0.8316 | fail |
| ts-zh-search | 1245 → 5872 | −3.7165 | pass |
| ts-affected-tests | 304 → 33 | 0.8914 | pass |
| py-super-blast | 218 → 674 | −2.0917 | fail |
| py-task-harvest-doc | 117 → 166 | −0.4188 | pass |
| go-embed-read | 415 → 931 | −1.2434 | pass |
| rs-trait-dispatch | 523 → 450 | 0.1396 | fail |
| cross-doc-link | 237 → 31 | 0.8692 | fail |

Failures, from the recorded commands:

- `ts-rename-safe`: `graphflow edit --symbol OrderService.cancel` returned `ERR [symbol-not-found]`. Retry `--symbol cancel` returned `REJECTED [ambiguous-symbol]` because `vip-order-service.ts` also declares `cancel`. Zero files changed, so `tests_green` stayed false. Re-scoring with the fixed rubric still fails those checks. It no longer also demands an edit of `checkout.test.ts`.
- `py-super-blast`: same pair for `RefundPolicy.refund` / bare `refund` (`symbol-not-found`, then `ambiguous-symbol` on `partial.py`). The pre-rename read did include `super().refund` and `settle_full`.
- `rs-trait-dispatch`: `Device.read` blast listed `poll_reading` (`&dyn Device`) only. `describe` (`impl Device`) was absent.
- `cross-doc-link`: `docs/订单超时.md` linked `handleDingDanChaoShi`, `OrderService`, and `OrderService.timeout`, plus `业务背景 -> RefundTests.setUp`. `TIMEOUT_WINDOW_MS` was missing. Four links exceeded the cap of 3.

### GraphFlow 3.6.2 and 3.7.0, measured on these fixtures elsewhere

These runs were executed by GraphFlow pull requests against a local checkout of this harness. The run JSON was not committed here, so this README does not re-score them.

- [GraphFlow PR #65](https://github.com/Roarpeng/GraphFlow/pull/65) (3.6.2): **9/10**, mean savings **+0.281**, before this rubric fix. The PR says the only failed check was `edited:packages/order-ts/__tests__/checkout.test.ts`, while `order-service.ts`, `vip-order-service.ts` (`super.cancelOrder`), `checkout.ts`, and `order-service.test.ts` were edited and `npm test --prefix packages/order-ts` stayed green. That artifact is not in this repo. After the rubric fix, that one check no longer exists, and a new pass count was **not** measured here.
- [GraphFlow PR #66](https://github.com/Roarpeng/GraphFlow/pull/66) (3.7.0, stacked on that 3.6.2 branch): held-out Chinese recall **P@1 0.813** (L1+L2, 80 phrasings absent from the L0 glossary). `ts-zh-search` on this fixture went from **3198** tokens (3.6.2, savings −1.569 vs the 1245-token files) to **1077** (savings **0.135**). Required hits stayed correct.

### Gaps that stay true

- A GraphFlow slice of a small file can be larger than reading the file. The 3.6.1 mean is negative for that reason (`ts-zh-search` 1245 → 5872, `go-embed-read` 415 → 931, `py-super-blast` 218 → 674).
- Task harvest still needs something that appends `.graphflow/instruction-log.jsonl`. The 3.6.1 reflex run called `graphflow task log` itself. There is no daemon inside this harness. PR #65 adds an install hook and a `gf_exec` `run: true` harvest path; this repo has not re-run that hook.
- The L3 Chinese model is not bundled. PR #66 keeps `registerZhEnModel` behind `GRAPHFLOW_ZH_EN_MODEL=1` and does not ship opus-mt.

## Layout

```
graphflow-eval/
  README.md                 how to run evals
  EVAL.md                   task catalog and scoring rubric
  LICENSE                   Apache-2.0
  scripts/
    run-tasks.mjs           checklist runner, writes a metrics JSON
    baseline-naive.mjs      whole-file and literal-search token estimates
    score.mjs               compare a run artifact with fixtures/tasks
    run-reflex.mjs          GraphFlow 3.6.1 reflex-arc run (CLI + MCP stdio)
  packages/
    order-ts/               TypeScript order service
    billing-py/             Python invoice, tax, refund
    inventory-go/           Go warehouse stock and reservation
    device-rs/              Rust device trait and impls
  fixtures/tasks/           one JSON file per task
  results/                  example-run.json, template.json, generated runs
```

## Packages / 夹具

| Package | Domain | What it stresses | Test |
| --- | --- | --- | --- |
| `packages/order-ts` | Cancel / pay / timeout | Two `cancel()` methods, `extends` + `super.cancel()`, 中文/English docs, pinyin `handleDingDanZhiFu`, `@order/*` paths, nested `extends` tsconfig | `npm test` |
| `packages/billing-py` | Invoice / tax / refund | 中文 synonym docstrings, `super().refund()`, `test_*.py` | `python3 -m unittest` |
| `packages/inventory-go` | Stock + reservation | Struct embedding, several files in one package | `go test ./...` |
| `packages/device-rs` | Sensor / actuator | `Device::read` vs concrete impl, `&dyn Device`, `impl Device` | `cargo test` |

Tests import the module they cover. They do not import `packages/order-ts/src/index.ts`, so affected-test routing stays specific.

`npm test` at the repo root runs the scorer self-test only. It does not install GraphFlow and it does not compile the four packages.

## Install GraphFlow (optional)

Node 18+. The fixture tests do not need this.

```bash
npm install -g @roarpeng/graphflow@3.6.1
graphflow version
```

Or, without a global install:

```bash
npx --yes @roarpeng/graphflow@3.6.1 version
```

Set `GRAPHFLOW_BIN` if `scripts/run-tasks.mjs --execute` should call something other than `graphflow`. MCP shape, for an agent that already has the server:

```json
{ "mcpServers": { "graphflow": { "command": "graphflow-mcp" } } }
```

Product source and docs: <https://github.com/Roarpeng/GraphFlow>

## Run the fixture tests

From the repo root:

```bash
npm test
npm run test:fixtures
```

Per package:

```bash
npm test --prefix packages/order-ts
cd packages/billing-py && python3 -m unittest discover -s tests
go test -C packages/inventory-go ./...
cargo test --manifest-path packages/device-rs/Cargo.toml
```

`packages/order-ts` needs one `npm ci --prefix packages/order-ts` first (`vitest`, `typescript`). Python, Go, and Rust fixtures have no extra dependencies. CI is `.github/workflows/fixtures.yml` (scorer plus the four packages).

## Run the task checklist

`EVAL.md` is the catalog. Each `fixtures/tasks/*.json` file has `id`, `package`, `tool`, `steps` (CLI command and MCP arguments), and `expected`.

Record a baseline without GraphFlow:

```bash
node scripts/run-tasks.mjs
node scripts/score.mjs
```

`results/latest.json` is gitignored. `graphflow.invoked` is false, so the score is `skipped` (exit 2), not a pass.

Run the CLI steps when GraphFlow is installed:

```bash
node scripts/run-tasks.mjs --execute --id ts-read-symbol-slice
```

`--execute` stores stdout in `observed.raw_output` and estimates `tokens_graphflow` from that text. Copy symbol ids, callers, edited files, and test status into the `observed` fields before you treat the score as final. Snippet checks also read `raw_output`. Caller, safety, and doc-link checks use the structured fields.

Score a filled artifact:

```bash
node scripts/score.mjs results/your-run.json
node scripts/score.mjs --example
```

`results/example-run.json` is a passing slice. `results/template.json` is the empty shape. Exit codes: `0` pass, `1` fail, `2` skipped or missing artifact.

### Normalized `observed` fields

| Field | Use |
| --- | --- |
| `symbol_ids` | `path#Qualified.name` or the qualified name alone |
| `snippets` | Exact source fragments you still need, such as a signature |
| `callers` | Blast-radius sites. Rust uses `Device.read <- poll_reading` |
| `hits` | `{ "q", "symbol_ids" }` for bilingual search |
| `affected_tests` | Paths listed by `gf_exec` `affected-tests` |
| `edited_files` / `unchanged_symbols` / `renamed_to` | Rename safety |
| `false_positives` | Any entry fails the task |
| `fields` / `methods` / `parent_class` | Go embed and Rust trait |
| `doc_links` | `section -> Symbol` strings |
| `harvest` / `steps` | `HIT` plus the promoted shell steps |
| `learn` | Log lines, promotion, compiled `.mjs`, idle harvest, MCP byte offset |
| `reflect` / `exit_code` | Reflex HIT and the exit code parsed from `PASS [exit=` |
| `near_score` / `below_miss` / `unrelated_miss` | Jaccard threshold checks |
| `mcp_actions` | `gf_macro` actions actually called over MCP |
| `tests_green` | `true` only after the package tests pass on the edited tree |
| `metrics.tokens_baseline` / `tokens_graphflow` | `ceil(chars/4)` estimates |

Do rename tasks on a git worktree and restore the fixture names afterwards. The committed tests expect `OrderService.cancel` and `RefundPolicy.refund`.

### Token estimate

`scripts/baseline-naive.mjs` uses `ceil(characterLength / 4)`. The same function scores `tokens_graphflow` when you put a number on the run. It is a stable ratio, not a model tokenizer. Published GraphFlow savings on its own large `ast-engine.ts` are a different corpus; this repo's slice task asks for at least 30% versus `order-service.ts`. A 3.6.1 read of that method landed near 41% once the linked-doc appendix was included.

Literal search (`naiveSearch`) is the ripgrep stand-in: fixed string, two lines of context, each line counted once. The spaced query `dingdan zhifu` hits nothing in `packages/order-ts/src`. GraphFlow's pinyin query should still find `handleDingDanZhiFu`.

## First eval / 第一次评测

1. `npm run test:fixtures` — confirm the four packages pass without GraphFlow.
2. `npm install -g @roarpeng/graphflow@3.6.1` and `graphflow version`.
3. `node scripts/run-tasks.mjs --id ts-read-symbol-slice` — read `tokens_baseline` in `results/latest.json`.
4. `graphflow read packages/order-ts/src/services/order-service.ts#OrderService.cancel` — copy the symbol id, the `cancel(order: Order, reason: string)` snippet, and `ceil(stdout.length / 4)` into a copy of `results/template.json`. Set `graphflow.invoked` to `true`.
5. `node scripts/score.mjs results/your-run.json` — then work through `EVAL.md` in task order. Run renames on a worktree.

## License

Apache-2.0. See `LICENSE`. GraphFlow itself is Apache-2.0 at <https://github.com/Roarpeng/GraphFlow>.
