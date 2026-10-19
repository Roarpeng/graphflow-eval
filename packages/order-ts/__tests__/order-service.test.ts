import { describe, expect, it } from "vitest";
import { OrderClosedError } from "@order/domain/order";
import { OrderService, TIMEOUT_WINDOW_MS } from "@order/services/order-service";
import { pendingOrder } from "./helpers";

describe("OrderService", () => {
  const service = new OrderService();

  it("cancels a pending order", () => {
    const next = service.cancel(pendingOrder(), "buyer-request");
    expect(next.status).toBe("cancelled");
    expect(next.cancelReason).toBe("buyer-request");
  });

  it("pays a pending order", () => {
    const paidAt = 1_700_000_100_000;
    const next = service.pay(pendingOrder(), paidAt);
    expect(next.status).toBe("paid");
    expect(next.paidAt).toBe(paidAt);
  });

  it("times out only after the window", () => {
    const order = pendingOrder();
    const inside = service.timeout(order, order.createdAt + TIMEOUT_WINDOW_MS - 1);
    expect(inside.status).toBe("pending");
    const outside = service.timeout(order, order.createdAt + TIMEOUT_WINDOW_MS);
    expect(outside.status).toBe("timed_out");
    expect(outside.cancelReason).toBe("timeout");
  });

  it("rejects a second cancel", () => {
    const cancelled = service.cancel(pendingOrder(), "duplicate");
    expect(() => service.cancel(cancelled, "again")).toThrow(OrderClosedError);
  });

  it("reprices and describes a pending order", () => {
    const next = service.annotate(service.reprice(pendingOrder(), 100), "gift wrap");
    expect(next.amountCents).toBe(100);
    expect(service.describe(next)).toContain("pending");
    expect(service.canPay(next, next.createdAt)).toBe(true);
  });
});
