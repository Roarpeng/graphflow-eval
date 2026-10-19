import { describe, expect, it } from "vitest";
import { OrderService } from "@order/services/order-service";
import { handleDingDanZhiFu } from "@order/handlers/pay-handler";
import { pendingOrder } from "./helpers";

describe("handleDingDanZhiFu", () => {
  it("pays through the pinyin entry point", () => {
    const paidAt = 1_700_000_200_000;
    const next = handleDingDanZhiFu(new OrderService(), pendingOrder(), paidAt);
    expect(next.status).toBe("paid");
    expect(next.paidAt).toBe(paidAt);
  });

  it("rejects an expired order", () => {
    const order = pendingOrder();
    const service = new OrderService();
    expect(() => handleDingDanZhiFu(service, order, order.createdAt + 60 * 60 * 1000)).toThrow(/not payable/);
  });
});
