import type { Order } from "@order/domain/order";
import { OrderService } from "@order/services/order-service";

/**
 * 支付订单入口。
 * Legacy gateway still calls the pinyin name `handleDingDanZhiFu`.
 * Synonyms: 付款, 收款, 结账.
 */
export function handleDingDanZhiFu(service: OrderService, order: Order, paidAt = Date.now()): Order {
  if (!service.canPay(order, paidAt)) {
    throw new Error(`order ${order.id} is not payable`);
  }
  return service.pay(order, paidAt);
}
