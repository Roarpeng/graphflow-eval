import type { Order } from "@order/domain/order";
import { OrderService } from "@order/services/order-service";

export interface TimeoutSweepResult {
  closed: Order[];
  kept: Order[];
}

/**
 * 订单超时扫描。
 * Pinyin entry point `handleDingDanChaoShi` calls {@link OrderService.timeout}.
 */
export function handleDingDanChaoShi(
  service: OrderService,
  orders: readonly Order[],
  now = Date.now(),
): TimeoutSweepResult {
  const closed: Order[] = [];
  const kept: Order[] = [];
  for (const order of orders) {
    if (order.status !== "pending") {
      kept.push(order);
      continue;
    }
    const next = service.timeout(order, now);
    if (next.status === "timed_out") closed.push(next);
    else kept.push(next);
  }
  return { closed, kept };
}
