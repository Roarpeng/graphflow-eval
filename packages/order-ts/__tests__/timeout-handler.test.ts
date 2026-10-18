import { describe, expect, it } from "vitest";
import { OrderService, TIMEOUT_WINDOW_MS } from "@order/services/order-service";
import { handleDingDanChaoShi } from "@order/handlers/timeout-handler";
import { pendingOrder } from "./helpers";

describe("handleDingDanChaoShi", () => {
  it("closes only pending orders past the window", () => {
    const fresh = pendingOrder({ id: "fresh" });
    const stale = pendingOrder({ id: "stale", createdAt: fresh.createdAt - TIMEOUT_WINDOW_MS });
    const paid = pendingOrder({ id: "paid", status: "paid", paidAt: fresh.createdAt });
    const result = handleDingDanChaoShi(new OrderService(), [fresh, stale, paid], fresh.createdAt);
    expect(result.closed.map((order) => order.id)).toEqual(["stale"]);
    expect(result.kept.map((order) => order.id).sort()).toEqual(["fresh", "paid"]);
  });
});
