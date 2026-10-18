import { describe, expect, it } from "vitest";
import { OrderService } from "@order/services/order-service";
import { buyerCancels } from "@order/app/checkout";
import { pendingOrder } from "./helpers";

describe("buyerCancels", () => {
  it("cancels through OrderService", () => {
    const next = buyerCancels(new OrderService(), pendingOrder());
    expect(next.status).toBe("cancelled");
    expect(next.cancelReason).toBe("buyer-request");
  });
});
