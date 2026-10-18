import type { RefundRequest } from "@order/domain/refund";
import { RefundService } from "@order/services/refund-service";

/**
 * Buyer withdraws a refund ticket.
 * Receiver type is `RefundService`. This call is not `OrderService.cancel`.
 */
export function buyerWithdrawsRefund(refunds: RefundService, request: RefundRequest): RefundRequest {
  return refunds.cancel(request);
}
