import { describe, expect, it } from "vitest";
import { RefundService } from "@order/services/refund-service";
import { buyerWithdrawsRefund } from "@order/app/refund-desk";
import { openRefund } from "./helpers";

describe("buyerWithdrawsRefund", () => {
  it("cancels through RefundService", () => {
    const next = buyerWithdrawsRefund(new RefundService(), openRefund());
    expect(next.status).toBe("cancelled");
    expect(next.orderId).toBe("ord-1");
  });
});
