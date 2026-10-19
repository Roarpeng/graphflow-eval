"""发票 / Invoice aggregate. Amounts are integer cents."""

from dataclasses import dataclass, replace


class InvoiceError(Exception):
    """发票无法完成该流转。"""


@dataclass(frozen=True)
class Invoice:
    """一张发票。

    `subtotal_cents` 是税前金额，`tax_cents` 由税额函数写入，
    `refunded_cents` 由退款策略累加。
    """

    id: str
    buyer: str
    subtotal_cents: int
    tax_cents: int = 0
    refunded_cents: int = 0

    @property
    def total_cents(self) -> int:
        return self.subtotal_cents + self.tax_cents

    @property
    def balance_cents(self) -> int:
        return self.total_cents - self.refunded_cents

    def with_tax(self, tax_cents: int) -> "Invoice":
        if tax_cents < 0:
            raise InvoiceError("tax cannot be negative")
        return replace(self, tax_cents=tax_cents)

    def with_refund(self, amount_cents: int) -> "Invoice":
        if amount_cents <= 0:
            raise InvoiceError("refund amount must be positive")
        if amount_cents > self.balance_cents:
            raise InvoiceError(f"invoice {self.id} balance exceeded")
        return replace(self, refunded_cents=self.refunded_cents + amount_cents)
