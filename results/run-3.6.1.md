# GraphFlow 3.6.1 evaluation run

Recorded 2026-10-19T00:42:20.413Z. Binary `@roarpeng/graphflow@3.6.1`. Token estimate is `ceil(chars/4)`: baseline is the task's whole files, GraphFlow is the tool stdout an agent would read.

```
GraphFlow v3.6.1 — parser backends
  TS/JS: @babel/parser (engine "babel")
  tree-sitter core: 0.22.4
  python  tree-sitter-python: 0.23.6
  go      tree-sitter-go: 0.23.4
  rust    tree-sitter-rust: 0.24.0
  c       tree-sitter-c: 0.23.6
  cpp     tree-sitter-cpp: 0.23.4
  csharp  tree-sitter-c-sharp: 0.23.1
  default engine: tree-sitter
```

# GraphFlow eval score: fail
safety_gate: fail
passed 6  failed 4  skipped 0
mean_token_savings: -0.368
- ts-read-symbol-slice: pass
- ts-blast-disambiguate: pass
- ts-rename-safe: fail
    fail edited:packages/order-ts/src/services/order-service.ts (packages/order-ts/src/services/order-service.ts)
    fail edited:packages/order-ts/src/services/vip-order-service.ts (packages/order-ts/src/services/vip-order-service.ts)
    fail edited:packages/order-ts/src/app/checkout.ts (packages/order-ts/src/app/checkout.ts)
    fail edited:packages/order-ts/__tests__/order-service.test.ts (packages/order-ts/__tests__/order-service.test.ts)
    fail edited:packages/order-ts/__tests__/checkout.test.ts (packages/order-ts/__tests__/checkout.test.ts)
    fail renamed_to (cancelOrder)
    fail tests_green (tests_green)
- ts-zh-search: pass
- ts-affected-tests: pass
- py-super-blast: fail
    fail edited:packages/billing-py/billing/refund.py (packages/billing-py/billing/refund.py)
    fail edited:packages/billing-py/billing/partial.py (packages/billing-py/billing/partial.py)
    fail edited:packages/billing-py/billing/settle_full.py (packages/billing-py/billing/settle_full.py)
    fail renamed_to (refundInvoice)
    fail tests_green (tests_green)
- py-task-harvest-doc: pass
- go-embed-read: pass
- rs-trait-dispatch: fail
    fail caller:Device.read <- describe (Device.read <- describe)
- cross-doc-link: fail
    fail doc-link:TIMEOUT_WINDOW_MS (TIMEOUT_WINDOW_MS)
    fail doc-unlink:RefundTests.setUp (RefundTests.setUp)
    fail doc-cap (links 4 <= 3)

## Per task

### ts-read-symbol-slice — pass

- Tool output tokens: baseline 938, GraphFlow 552, savings 0.4115
- False positives recorded: none
- Commands:
  - `graphflow read packages/order-ts/src/services/order-service.ts#OrderService.cancel` (exit 0)
- Rubric: all checks passed.

```
  17:   note?: string;
  18: }
// [Blast Radius: 5 call site(s)]
// -> packages/order-ts/__tests__/order-service.test.ts:10 [args=2]
   9:   it("cancels a pending order", () => {
  10:     const next = service.cancel(pendingOrder(), "buyer-request");
  11:     expect(next.status).toBe("cancelled");
// -> packages/order-ts/__tests__/order-service.test.ts:32 [args=2]
  31:   it("rejects a second cancel", () => {
  32:     const cancelled = service.cancel(pendingOrder(), "duplicate");
  33:     expect(() => service.cancel(cancelled, "again")).toThrow(OrderClosedError);
// -> packages/order-ts/__tests__/order-service.test.ts:33 [args=2]
  32:     const cancelled = service.cancel(pendingOrder(), "duplicate");
  33:     expect(() => service.cancel(cancelled, "again")).toThrow(OrderClosedError);
  34:   });
// -> packages/order-ts/src/app/checkout.ts:9 in buyerCancels() [args=2]
   8: export function buyerCancels(orders: OrderService, order: Order): Order {
   9:   return orders.cancel(order, "buyer-request");
  10: }
// -> packages/order-ts/src/services/vip-order-service.ts:14 in cancel() [args=2]
  13:     const audited = reason.startsWith("vip:") ? reason : `vip:${reason}`;
  14:     return super.cancel(order, audited);
  15:   }
// [Linked Spec Doc] EVAL.md#3. `ts-rename-safe` (explicit ref `cancel`): 看什么：把 `OrderService.cancel` 重命名为 `cancelOrder`，外类的 `cancel` 保持原名，测试仍绿。 ```bash graphflow edit packages/order-ts/src/services/order-service.ts \ --symbol OrderService.cancel --rename cancelOrder ``` - Edit: `order-service

```

### ts-blast-disambiguate — pass

- Tool output tokens: baseline 1573, GraphFlow 552, savings 0.6491
- False positives recorded: none
- Commands:
  - `graphflow read packages/order-ts/src/services/order-service.ts#OrderService.cancel` (exit 0)
- Rubric: all checks passed.

```
  17:   note?: string;
  18: }
// [Blast Radius: 5 call site(s)]
// -> packages/order-ts/__tests__/order-service.test.ts:10 [args=2]
   9:   it("cancels a pending order", () => {
  10:     const next = service.cancel(pendingOrder(), "buyer-request");
  11:     expect(next.status).toBe("cancelled");
// -> packages/order-ts/__tests__/order-service.test.ts:32 [args=2]
  31:   it("rejects a second cancel", () => {
  32:     const cancelled = service.cancel(pendingOrder(), "duplicate");
  33:     expect(() => service.cancel(cancelled, "again")).toThrow(OrderClosedError);
// -> packages/order-ts/__tests__/order-service.test.ts:33 [args=2]
  32:     const cancelled = service.cancel(pendingOrder(), "duplicate");
  33:     expect(() => service.cancel(cancelled, "again")).toThrow(OrderClosedError);
  34:   });
// -> packages/order-ts/src/app/checkout.ts:9 in buyerCancels() [args=2]
   8: export function buyerCancels(orders: OrderService, order: Order): Order {
   9:   return orders.cancel(order, "buyer-request");
  10: }
// -> packages/order-ts/src/services/vip-order-service.ts:14 in cancel() [args=2]
  13:     const audited = reason.startsWith("vip:") ? reason : `vip:${reason}`;
  14:     return super.cancel(order, audited);
  15:   }
// [Linked Spec Doc] EVAL.md#3. `ts-rename-safe` (explicit ref `cancel`): 看什么：把 `OrderService.cancel` 重命名为 `cancelOrder`，外类的 `cancel` 保持原名，测试仍绿。 ```bash graphflow edit packages/order-ts/src/services/order-service.ts \ --symbol OrderService.cancel --rename cancelOrder ``` - Edit: `order-service

```

### ts-rename-safe — fail

- Tool output tokens: baseline 938, GraphFlow 158, savings 0.8316
- False positives recorded: none
- Commands:
  - `graphflow edit packages/order-ts/src/services/order-service.ts --symbol OrderService.cancel --rename cancelOrder --root /tmp/gf-wt  &&  graphflow edit packages/order-ts/src/services/order-service.ts --symbol cancel --rename cancelOrder --root /tmp/gf-wt` (exit 0)
  - `npm test --prefix packages/order-ts` (exit 0)
- Failed checks:
  - `edited:packages/order-ts/src/services/order-service.ts` — packages/order-ts/src/services/order-service.ts
  - `edited:packages/order-ts/src/services/vip-order-service.ts` — packages/order-ts/src/services/vip-order-service.ts
  - `edited:packages/order-ts/src/app/checkout.ts` — packages/order-ts/src/app/checkout.ts
  - `edited:packages/order-ts/__tests__/order-service.test.ts` — packages/order-ts/__tests__/order-service.test.ts
  - `edited:packages/order-ts/__tests__/checkout.test.ts` — packages/order-ts/__tests__/checkout.test.ts
  - `renamed_to` — cancelOrder
  - `tests_green` — tests_green

```
# task command
ERR [symbol-not-found] 'OrderService.cancel' in packages/order-ts/src/services/order-service.ts

# retry --symbol cancel
REJECTED [ambiguous-symbol] 'cancel' is also declared in packages/order-ts/src/services/vip-order-service.ts:12; renaming 'packages/order-ts/src/services/order-service.ts' would rewrite that unrelated symbol too. Rename it manually.


> @graphflow-eval/order-ts@0.1.0 test
> vitest run


 RUN  v5.0.5 /tmp/gf-wt/packages/order-ts


 Test Files  8 passed (8)
      Tests  16 passed (16)
   Start at  00:42:19
   Duration  289ms (import 44%, transform 26%, worker 16%, tests 14%, environment 1%)


```

### ts-zh-search — pass

- Tool output tokens: baseline 1245, GraphFlow 5872, savings -3.7165
- Literal search hits for `dingdan zhifu`: 0
- False positives recorded: none
- Commands:
  - `graphflow read -q 订单超时` (exit 0)
  - `graphflow read -q dingdan zhifu` (exit 0)
  - `graphflow read -q 支付订单` (exit 0)
- Rubric: all checks passed.

```
  58:     return {
  59:       ...order,
// [Blast Radius: 1 call site(s)]
// -> packages/order-ts/__tests__/timeout-handler.test.ts:11 [args=3]
  10:     const paid = pendingOrder({ id: "paid", status: "paid", paidAt: fresh.createdAt });
  11:     const result = handleDingDanChaoShi(new OrderService(), [fresh, stale, paid], fresh.createdAt);
  12:     expect(result.closed.map((order) => order.id)).toEqual(["stale"]);

### packages/order-ts/src/services/order-service.ts:7-7 [export variable TIMEOUT_WINDOW_MS]
   7: export const TIMEOUT_WINDOW_MS = 30 * 60 * 1000;
// [Blast Radius: imported by 3 file(s)]
// -> packages/order-ts/__tests__/order-service.test.ts:3: import { OrderService, TIMEOUT_WINDOW_MS } from "@order/services/order-service";
// -> packages/order-ts/__tests__/timeout-handler.test.ts:2: import { OrderService, TIMEOUT_WINDOW_MS } from "@order/services/order-service";
// -> packages/order-ts/src/index.ts:5: export { OrderService, TIMEOUT_WINDOW_MS } from "@order/services/order-service";

### packages/order-ts/src/services/order-service.ts:69-77 [export method timeout]
  69:   timeout(order: Order, now = Date.now()): Order {
  70:     assertPending(order);
  71:     if (!this.isExpired(order, now)) return order;
  72:     return {
  73:       ...order,
  74:       status: "timed_out",
  75:       cancelReason: "timeout",
  76:     };
  77:   }
// [Type Closure] packages/order-ts/src/domain/order.ts:8-18 (interface Order)
   8: export interface Order {
   9:   id: string;
…
```

### ts-affected-tests — pass

- Tool output tokens: baseline 304, GraphFlow 33, savings 0.8914
- False positives recorded: none
- Commands:
  - `gf_exec {"cmd":"affected-tests","changedFiles":["packages/order-ts/src/handlers/pay-handler.ts"],"run":false}` (exit 0)
- Rubric: all checks passed.

```
# Affected Tests (1 test file(s) from 1 changed file(s)):
- packages/order-ts/__tests__/pay-handler.test.ts
Run Command: npm test
```

### py-super-blast — fail

- Tool output tokens: baseline 218, GraphFlow 674, savings -2.0917
- False positives recorded: none
- Commands:
  - `graphflow read packages/billing-py/billing/refund.py#RefundPolicy.refund` (exit 0)
  - `graphflow edit packages/billing-py/billing/refund.py --symbol RefundPolicy.refund --rename refundInvoice --root /tmp/gf-wt  &&  graphflow edit packages/billing-py/billing/refund.py --symbol refund --rename refundInvoice --root /tmp/gf-wt` (exit 0)
  - `python3 -m unittest discover -s tests` (exit 0)
- Failed checks:
  - `edited:packages/billing-py/billing/refund.py` — packages/billing-py/billing/refund.py
  - `edited:packages/billing-py/billing/partial.py` — packages/billing-py/billing/partial.py
  - `edited:packages/billing-py/billing/settle_full.py` — packages/billing-py/billing/settle_full.py
  - `renamed_to` — refundInvoice
  - `tests_green` — tests_green

```
  39:             raise InvoiceError("refund amount must be positive")
  40:         if amount_cents > self.balance_cents:
// [Blast Radius: 2 call site(s)]
// -> packages/billing-py/billing/partial.py:15 in refund() [args=2]
  14:         allowed = amount_cents if amount_cents < cap else cap
  15:         return super().refund(invoice, allowed)
  16: 
// -> packages/billing-py/billing/settle_full.py:9 in settle_full() [args=2]
   8:     """基类接收者上的退款。应计入 `RefundPolicy.refund` 的爆炸半径。"""
   9:     return policy.refund(invoice, amount_cents)
  10: 
// [Linked Spec Doc] EVAL.md#6. `py-super-blast` (explicit ref `refund`): 看什么：Python 的爆炸半径和重命名认 `super()`，不把子类接收者算成基类方法。 - Symbol: `packages/billing-py/billing/refund.py#RefundPolicy.refund` - Include caller `settle_full` - Exclude caller `settle_partial` - Snippet from the pre-rename read: `s
// [Linked Spec Doc] EVAL.md#Expected outcome (explicit ref `refund`): A careful transcription of GraphFlow 3.6.1 on this tree should pass receiver disambiguation, Python `super()`, `@order/*` affected tests, Chinese/pinyin search, and the Go embed read. The slice of `OrderService.cancel` m

# task command
ERR [symbol-not-found] 'RefundPolicy.refund' in packages/billing-py/billing/refund.py

# retry --symbol refund
REJECTED [ambiguous-symbol] 'refund' is also declared in packages/billing-py/billing/partial.py:10; renaming 'packages/billing-py/billing/refund.py' would rewrite that unrelated symbol too. Rename it manually.


```

### py-task-harvest-doc — pass

- Tool output tokens: baseline 117, GraphFlow 166, savings -0.4188
- False positives recorded: none
- Commands:
  - `graphflow task harvest --log fixtures/instruction-logs/billing-maintenance.jsonl --json` (exit 0)
  - `graphflow reflect format lint and test billing --json` (exit 1)
- Rubric: all checks passed.

```
{
  "logPath": "fixtures/instruction-logs/billing-maintenance.jsonl",
  "entriesRead": 2,
  "entriesInvalid": 0,
  "usesRecorded": 2,
  "tasksPromoted": [
    "t_0e1024b35c"
  ]
}

{
  "hit": true,
  "text": "# Reflected Task t_0e1024b35c [uses=3, local-runner] exact normalized match\nInstruction: format lint and test billing\n\nFAIL [exit=1, 29ms] cmd: task t_0e1024b35c format lint and test billing\n\n# step 1/2: python -m compileall -q billing\n/bin/sh: 1: python: not found\n# step 1/2: python -m compileall -q billing\n/bin/sh: 1: python: not found",
  "exitCode": 1,
  "durationMs": 29,
  "taskId": "t_0e1024b35c",
  "matchedBy": "exact",
  "score": 1
}

```

### go-embed-read — pass

- Tool output tokens: baseline 415, GraphFlow 931, savings -1.2434
- False positives recorded: none
- Commands:
  - `graphflow read packages/inventory-go/reservation.go#Reservation packages/inventory-go/reservation.go#Reservation.Hold packages/inventory-go/stock.go#StockItem.Available` (exit 0)
- Rubric: all checks passed.

```
   9: 	Reserved int
  10: }
// [Blast Radius] 0 external callers/importers for Reservation

### packages/inventory-go/reservation.go:13-25 [export method Hold]
  13: func (r *Reservation) Hold() error {
  14: 	if r == nil {
  15: 		return ErrUnknownReservation
  16: 	}
  17: 	if r.Qty <= 0 {
  18: 		return ErrBadQty
  19: 	}
  20: 	if r.Available() < r.Qty {
  21: 		return ErrInsufficient
  22: 	}
  23: 	r.Reserved += r.Qty
  24: 	return nil
  25: }
// [Type Closure] packages/inventory-go/reservation.go:5-10 (struct Reservation)
   5: type Reservation struct {
   6: 	StockItem
   7: 	ID    string
   8: 	Qty   int
   9: 	Buyer string
  10: }
// [Blast Radius: 3 call site(s)]
// -> packages/inventory-go/reservation_test.go:12 in TestReservationHoldPromotesEmbeddedStock() [args=0]
  11: 	}
…
```

### rs-trait-dispatch — fail

- Tool output tokens: baseline 523, GraphFlow 450, savings 0.1396
- False positives recorded: none
- Commands:
  - `graphflow read packages/device-rs/src/device.rs#Device.read packages/device-rs/src/sensor.rs#Sensor.read` (exit 0)
- Failed checks:
  - `caller:Device.read <- describe` — Device.read <- describe

```
### packages/device-rs/src/device.rs:7-7 [export method read]
   7:     fn read(&self) -> i32;
// [Blast Radius: 1 call site(s)]
// -> packages/device-rs/src/dispatch.rs:7 in poll_reading() [args=0]
   6: pub fn poll_reading(device: &dyn Device) -> i32 {
   7:     device.read()
   8: }
// [Linked Spec Doc] EVAL.md#1. `ts-read-symbol-slice` (explicit ref `read`): 看什么：只读 `OrderService.cancel`，不要为了这一个方法吞掉整个 `order-service.ts`。 - Tool: `gf_read` - Target: `packages/order-ts/src/services/order-service.ts#OrderService.cancel` - Baseline file: that service file - Pass: symbol id kept, 
// [Linked Spec Doc] EVAL.md#8. `go-embed-read` (explicit ref `read`): 看什么：读 `Reservation` 时能看到嵌入的 `StockItem` 字段和提升上来的方法。 - Fields: `SKU`, `OnHand`, `Reserved`, `ID`, `Qty`, `Buyer` - Methods: `Hold`, `Available` - `StockItem.Available` must list the promoted call inside `Reservation.Hold`

### packages/device-rs/src/sensor.rs:23-25 [export method read]
  23:     fn read(&self) -> i32 {
  24:         self.reading
  25:     }
// [Blast Radius: 1 call site(s)]
// -> packages/device-rs/src/dispatch.rs:17 in sensor_reading() [args=0]
  16: pub fn sensor_reading(sensor: &Sensor) -> i32 {
  17:     sensor.read()
  18: }
// [Linked Spec Doc] EVAL.md#1. `ts-read-symbol-slice` (explicit ref `read`): 看什么：只读 `OrderService.cancel`，不要为了这一个方法吞掉整个 `order-service.ts`。 - Tool: `gf_read` - Target: `packages/order-ts/src/services/order-service.ts#OrderService.cancel` - Baseline file: that service file - Pass: symbol id kept, 
// [Linked Spec Doc] EVAL.md#8. `go-embed-read` (explicit ref `read`): 看什么：读 `Reservation` 时能看到嵌入的 `StockItem` 字段和提升上来的方法。 - Fields: `SKU`, `OnHand`, `Reserved`, `ID`, `Qty`, `Buyer` - Methods: `Hold`, `Available` - `StockItem.Available` must list the promoted call inside `Reservation.Hold`

```

### cross-doc-link — fail

- Tool output tokens: baseline 237, GraphFlow 31, savings 0.8692
- False positives recorded: none
- Commands:
  - `graphflow graph` (exit 0)
- Failed checks:
  - `doc-link:TIMEOUT_WINDOW_MS` — TIMEOUT_WINDOW_MS
  - `doc-unlink:RefundTests.setUp` — RefundTests.setUp
  - `doc-cap` — links 4 <= 3

```
OK [knowledge-graph] Generated interactive HTML graph (206 nodes, 356 edges) -> /workspace/.graphflow/knowledge-graph.html

```

## Rename evidence

TypeScript diff files: (none)

Python diff files: (none)

CLI affected-tests with only `pay-handler.ts` dirty:

```
# Affected Tests (1 test file(s) from 1 changed file(s)):
- packages/order-ts/__tests__/pay-handler.test.ts
Run Command: npm test

```

Doc links from `docs/订单超时.md`:

- 关单路径 -> handleDingDanChaoShi
- 关单路径 -> OrderService
- 关单路径 -> OrderService.timeout
- 业务背景 -> RefundTests.setUp

Neither rename changed the tree. The qualified symbol command returned `symbol-not-found` because rename looks up `symbol.name` (`cancel` / `refund`), not `Class.method`. The bare-name retry returned `REJECTED [ambiguous-symbol]` and wrote nothing, so the override in the other file was not rewritten. `tests_green` is false because there was no post-rename tree to test; the unmodified package tests were still run and passed.

Worktrees were removed. The fixture tree was restored.
