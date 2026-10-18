import type { Order } from "@order/domain/order";
import { OrderService } from "@order/services/order-service";

/**
 * Buyer abandons checkout.
 * Receiver type is `OrderService`, so this call belongs to `OrderService.cancel`.
 */
export function buyerCancels(orders: OrderService, order: Order): Order {
  return orders.cancel(order, "buyer-request");
}
