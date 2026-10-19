import { describe, expect, it } from "vitest";
import { buyerCancels } from "@order/app/checkout";
import { VipOrderService } from "@order/services/vip-order-service";
import { pendingOrder } from "./helpers";

describe("VipOrderService", () => {
  it("prefixes the reason and delegates with super.cancel", () => {
    const next = new VipOrderService().cancel(pendingOrder(), "late");
    expect(next.status).toBe("cancelled");
    expect(next.cancelReason).toBe("vip:late");
  });

  it("does not double-prefix an audited reason", () => {
    const next = new VipOrderService().cancel(pendingOrder(), "vip:already");
    expect(next.cancelReason).toBe("vip:already");
  });

  it("prefixes the reason when checkout calls through a VipOrderService", () => {
    const next = buyerCancels(new VipOrderService(), pendingOrder());
    expect(next.status).toBe("cancelled");
    expect(next.cancelReason?.startsWith("vip:")).toBe(true);
  });
});
