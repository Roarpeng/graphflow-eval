# graphflow-eval

评测 [GraphFlow](https://github.com/Roarpeng/GraphFlow) 3.x 的 Token-First 工具（`gf_read`、`gf_edit`、`gf_exec`、`gf_macro`），对照朴素基线（整文件读取 + 字面量搜索）。本仓库是被测对象的夹具，不替代 GraphFlow。

English: a fixture monorepo so a person or an agent can measure GraphFlow against that naive baseline. The packages build and test on their own. GraphFlow is optional and is never imported by `npm test`.

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
python3 -m unittest discover -s packages/billing-py/tests -t packages/billing-py
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
| `tests_green` | `true` only after the package tests pass on the edited tree |
| `metrics.tokens_baseline` / `tokens_graphflow` | `ceil(chars/4)` estimates |

Do rename tasks on a git worktree and restore the fixture names afterwards. The committed tests expect `OrderService.cancel` and `RefundPolicy.refund`.

### Token estimate

`scripts/baseline-naive.mjs` uses `ceil(characterLength / 4)`. The same function scores `tokens_graphflow` when you put a number on the run. It is a stable ratio, not a model tokenizer. Published GraphFlow savings on its own large `ast-engine.ts` are a different corpus; this repo's slice task asks for at least 40% versus `order-service.ts`.

Literal search (`naiveSearch`) is the ripgrep stand-in: fixed string, two lines of context, each line counted once. The spaced query `dingdan zhifu` hits nothing in `packages/order-ts/src`. GraphFlow's pinyin query should still find `handleDingDanZhiFu`.

## First eval / 第一次评测

1. `npm run test:fixtures` — confirm the four packages pass without GraphFlow.
2. `npm install -g @roarpeng/graphflow@3.6.1` and `graphflow version`.
3. `node scripts/run-tasks.mjs --id ts-read-symbol-slice` — read `tokens_baseline` in `results/latest.json`.
4. `graphflow read packages/order-ts/src/services/order-service.ts#OrderService.cancel` — copy the symbol id, the `cancel(order: Order, reason: string)` snippet, and `ceil(stdout.length / 4)` into a copy of `results/template.json`. Set `graphflow.invoked` to `true`.
5. `node scripts/score.mjs results/your-run.json` — then work through `EVAL.md` in task order. Run renames on a worktree.

## License

Apache-2.0. See `LICENSE`. GraphFlow itself is Apache-2.0 at <https://github.com/Roarpeng/GraphFlow>.
