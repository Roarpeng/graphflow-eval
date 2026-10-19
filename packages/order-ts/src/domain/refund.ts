/** 退款单状态 / Status of a refund ticket, distinct from order status. */
export type RefundStatus = "requested" | "cancelled" | "settled";

export interface RefundRequest {
  id: string;
  orderId: string;
  amountCents: number;
  status: RefundStatus;
}

export class RefundClosedError extends Error {
  readonly refundId: string;

  constructor(refundId: string) {
    super(`refund ${refundId} is no longer open`);
    this.name = "RefundClosedError";
    this.refundId = refundId;
  }
}
