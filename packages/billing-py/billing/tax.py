"""税额 / Tax calculation."""

from billing.invoice import Invoice


def calc_shui_e(subtotal_cents: int, rate_bp: int) -> int:
    """计算税额。

    税款 / 税金 / tax amount.
    `rate_bp` 是基点，10000 表示 100%。不足 1 分的部分向下取整。
    """
    if subtotal_cents < 0:
        raise ValueError("subtotal_cents must be >= 0")
    if rate_bp < 0 or rate_bp > 10_000:
        raise ValueError("rate_bp must be between 0 and 10000")
    return (subtotal_cents * rate_bp) // 10_000


def apply_tax(invoice: Invoice, rate_bp: int) -> Invoice:
    """把税额写回发票。"""
    return invoice.with_tax(calc_shui_e(invoice.subtotal_cents, rate_bp))
