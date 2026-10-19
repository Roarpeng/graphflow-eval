import type { Order } from "@order/domain/order";
import { VipOrderService } from "@order/services/vip-order-service";

/**
 * VIP desk. Receiver is the subclass, which overrides `cancel`,
 * so this call is `VipOrderService.cancel` rather than the base method.
 */
export function vipCancels(vip: VipOrderService, order: Order): Order {
  return vip.cancel(order, "vip-request");
}
