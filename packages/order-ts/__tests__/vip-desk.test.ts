import { describe, expect, it } from "vitest";
import { VipOrderService } from "@order/services/vip-order-service";
import { vipCancels } from "@order/app/vip-desk";
import { pendingOrder } from "./helpers";

describe("vipCancels", () => {
  it("hits the override, which records a vip reason", () => {
    const next = vipCancels(new VipOrderService(), pendingOrder());
    expect(next.cancelReason).toBe("vip:vip-request");
  });
});
