"""开票，并把两种退款入口放在稳定的导入路径上。"""

from billing.invoice import Invoice
from billing.settle_full import settle_full
from billing.settle_partial import settle_partial
from billing.tax import apply_tax

__all__ = ["issue_invoice", "settle_full", "settle_partial"]


def issue_invoice(invoice_id: str, buyer: str, subtotal_cents: int, rate_bp: int) -> Invoice:
    """开票并写入税额。"""
    if subtotal_cents <= 0:
        raise ValueError("subtotal_cents must be positive")
    draft = Invoice(id=invoice_id, buyer=buyer, subtotal_cents=subtotal_cents)
    return apply_tax(draft, rate_bp)
