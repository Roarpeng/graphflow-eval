"""Call site whose receiver is the base policy."""

from billing.invoice import Invoice
from billing.refund import RefundPolicy


def settle_full(policy: RefundPolicy, invoice: Invoice, amount_cents: int) -> Invoice:
    """基类接收者上的退款。应计入 `RefundPolicy.refund` 的爆炸半径。"""
    return policy.refund(invoice, amount_cents)
