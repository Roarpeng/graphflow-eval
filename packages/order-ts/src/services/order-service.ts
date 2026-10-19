import { assertPending, type Order, type OrderStatus } from "@order/domain/order";

/**
 * Unpaid window used by {@link OrderService.timeout}.
 * Named from `docs/订单超时.md`.
 */
export const TIMEOUT_WINDOW_MS = 30 * 60 * 1000;

const CANCEL_REASONS = [
  "buyer-request",
  "buyer-abandon",
  "risk-reject",
  "out-of-stock",
  "duplicate",
] as const;

export type CancelReasonCode = (typeof CANCEL_REASONS)[number];

/**
 * 订单服务 / Order service.
 *
 * Owns three transitions that agents often mix up:
 * - `cancel` 取消订单（作废 / 撤单 / 撤销）
 * - `pay` 支付订单（付款 / 收款 / 结账）
 * - `timeout` 订单超时
 *
 * `RefundService.cancel` is a different method on a different receiver.
 */
export class OrderService {
  constructor(private readonly windowMs = TIMEOUT_WINDOW_MS) {}

  /**
   * 取消订单 / Cancel an unpaid order.
   * Synonyms in support docs: 作废, 撤单, 撤销.
   */
  cancel(order: Order, reason: string): Order {
    assertPending(order);
    const why = normalizeReason(reason);
    return {
      ...order,
      status: "cancelled",
      cancelReason: why,
    };
  }

  /**
   * 支付订单 / Collect payment for a pending order.
   * Synonyms: 付款, 收款, 结账.
   */
  pay(order: Order, paidAt = Date.now()): Order {
    assertPending(order);
    if (!Number.isInteger(order.amountCents) || order.amountCents <= 0) {
      throw new Error(`order ${order.id} amount must be a positive integer`);
    }
    if (!Number.isFinite(paidAt)) {
      throw new Error("paidAt must be a finite timestamp");
    }
    return {
      ...order,
      status: "paid",
      paidAt,
    };
  }

  /**
   * 订单超时 / Time out an unpaid order once the window has elapsed.
   * Orders still inside the window are returned unchanged.
   */
  timeout(order: Order, now = Date.now()): Order {
    assertPending(order);
    if (!this.isExpired(order, now)) return order;
    return {
      ...order,
      status: "timed_out",
      cancelReason: "timeout",
    };
  }

  /** True when a pending order is past the unpaid window. */
  isExpired(order: Order, now = Date.now()): boolean {
    return order.status === "pending" && now - order.createdAt >= this.windowMs;
  }

  /** Adjust the amount of a pending order before payment. */
  reprice(order: Order, amountCents: number): Order {
    assertPending(order);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error("amountCents must be a positive integer");
    }
    return { ...order, amountCents };
  }

  /** Attach an operator note without changing status. */
  annotate(order: Order, note: string): Order {
    const text = note.trim();
    if (!text) throw new Error("note required");
    return { ...order, note: text };
  }

  /** Whether `pay` would accept this order right now. */
  canPay(order: Order, now = Date.now()): boolean {
    return order.status === "pending" && !this.isExpired(order, now) && order.amountCents > 0;
  }

  /** One-line description for logs and the timeout doc cross-check. */
  describe(order: Order): string {
    const reason = order.cancelReason ? ` reason=${order.cancelReason}` : "";
    return `${order.id} ${order.status} ${order.amountCents}c buyer=${order.buyerId}${reason}`;
  }

  /** Statuses an operator is allowed to move into from `pending`. */
  legalTransitions(): readonly OrderStatus[] {
    return ["paid", "cancelled", "timed_out"];
  }

  /** Known machine-readable cancel reasons. Free-text reasons are still accepted. */
  knownCancelReasons(): readonly CancelReasonCode[] {
    return CANCEL_REASONS;
  }
}

function normalizeReason(reason: string): string {
  const why = reason.trim().replace(/\s+/g, " ");
  if (!why) throw new Error("cancel reason required");
  if (why.length > 120) throw new Error("cancel reason too long");
  return why;
}
