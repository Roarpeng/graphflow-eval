/** 订单状态 / Lifecycle status of an order. */
export type OrderStatus = "pending" | "paid" | "cancelled" | "timed_out";

/**
 * 订单 / Order aggregate.
 * Amounts are integer cents so fixtures never depend on floating point.
 */
export interface Order {
  id: string;
  /** 买家 / buyer id */
  buyerId: string;
  amountCents: number;
  status: OrderStatus;
  createdAt: number;
  paidAt?: number;
  cancelReason?: string;
  note?: string;
}

export class OrderClosedError extends Error {
  readonly orderId: string;
  readonly status: OrderStatus;

  constructor(orderId: string, status: OrderStatus) {
    super(`order ${orderId} cannot transition from ${status}`);
    this.name = "OrderClosedError";
    this.orderId = orderId;
    this.status = status;
  }
}

/** Reject anything that is no longer awaiting payment. */
export function assertPending(order: Order): void {
  if (order.status !== "pending") {
    throw new OrderClosedError(order.id, order.status);
  }
}
