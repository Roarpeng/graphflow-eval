import { describe, expect, it } from "vitest";
import { RefundClosedError } from "@order/domain/refund";
import { RefundService } from "@order/services/refund-service";
import { openRefund } from "./helpers";

describe("RefundService.cancel", () => {
  const refunds = new RefundService();

  it("withdraws a requested refund", () => {
    const next = refunds.cancel(openRefund());
    expect(next.status).toBe("cancelled");
  });

  it("settles a requested refund", () => {
    expect(refunds.settle(openRefund()).status).toBe("settled");
  });

  it("refuses to cancel a settled refund", () => {
    const settled = refunds.settle(openRefund());
    expect(() => refunds.cancel(settled)).toThrow(RefundClosedError);
  });
});
