"""部分退款 / Partial refund subclass."""

from billing.invoice import Invoice
from billing.refund import RefundPolicy


class PartialRefundPolicy(RefundPolicy):
    """部分退款：最多退掉当前余额的一半，再 `super().refund` 走基类冲正。"""

    def refund(self, invoice: Invoice, amount_cents: int) -> Invoice:
        cap = max(invoice.balance_cents // 2, 0)
        if cap == 0:
            raise ValueError(f"invoice {invoice.id} has nothing left to refund")
        allowed = amount_cents if amount_cents < cap else cap
        return super().refund(invoice, allowed)
