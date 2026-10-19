import { RefundClosedError, type RefundRequest } from "@order/domain/refund";

/**
 * 退款服务 / Refund desk.
 * `cancel` here withdraws a refund ticket. It is not `OrderService.cancel`.
 */
export class RefundService {
  /**
   * 取消退款申请 / Cancel a pending refund request.
   * Support synonyms: 撤销退款, 撤回退款单. Not 取消订单.
   */
  cancel(request: RefundRequest): RefundRequest {
    if (request.status !== "requested") {
      throw new RefundClosedError(request.id);
    }
    return { ...request, status: "cancelled" };
  }

  /** Mark a requested refund as settled after the ledger posts. */
  settle(request: RefundRequest): RefundRequest {
    if (request.status !== "requested") {
      throw new RefundClosedError(request.id);
    }
    if (request.amountCents <= 0) {
      throw new Error(`refund ${request.id} amount must be positive`);
    }
    return { ...request, status: "settled" };
  }
}
