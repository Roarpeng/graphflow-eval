"""基类退款策略 / Base refund policy.

同义词：退货、返款、冲正。
子类在 `partial.py`，避免和基类方法挤在同一个文件里。
"""

from billing.invoice import Invoice


class RefundPolicy:
    """全额限额内的退款。同义词：退货、返款、冲正。"""

    def refund(self, invoice: Invoice, amount_cents: int) -> Invoice:
        """按请求金额退款，不超过发票余额。"""
        return invoice.with_refund(amount_cents)
