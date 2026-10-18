import type { Order } from "@order/domain/order";
import type { RefundRequest } from "@order/domain/refund";

export function pendingOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord-1",
    buyerId: "buyer-1",
    amountCents: 2599,
    status: "pending",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

export function openRefund(overrides: Partial<RefundRequest> = {}): RefundRequest {
  return {
    id: "rf-1",
    orderId: "ord-1",
    amountCents: 500,
    status: "requested",
    ...overrides,
  };
}
