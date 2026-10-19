import type { Order } from "@order/domain/order";
import { OrderService } from "@order/services/order-service";

/**
 * VIP 订单服务 / VIP subclass.
 * The override is declared as `cancel` and delegates with `super.cancel`.
 * Renaming `OrderService.cancel` renames this override to the same name.
 */
export class VipOrderService extends OrderService {
  /**
   * VIP 取消：给原因加 `vip:` 前缀，再 `super.cancel` 走基类关单。
   */
  override cancel(order: Order, reason: string): Order {
    const audited = reason.startsWith("vip:") ? reason : `vip:${reason}`;
    return super.cancel(order, audited);
  }
}
