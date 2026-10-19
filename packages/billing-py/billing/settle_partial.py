"""Call site whose receiver is the overriding subclass."""

from billing.invoice import Invoice
from billing.partial import PartialRefundPolicy


def settle_partial(policy: PartialRefundPolicy, invoice: Invoice, amount_cents: int) -> Invoice:
    """子类接收者上的退款。调用的是覆写，不是基类方法本身。"""
    return policy.refund(invoice, amount_cents)
