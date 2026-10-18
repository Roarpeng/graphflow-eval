import unittest

from billing.invoice import Invoice, InvoiceError
from billing.workflow import issue_invoice


class InvoiceTests(unittest.TestCase):
    def test_issue_adds_tax(self) -> None:
        invoice = issue_invoice("inv-1", "买家甲", 10_000, 1_300)
        self.assertEqual(invoice.tax_cents, 1_300)
        self.assertEqual(invoice.total_cents, 11_300)
        self.assertEqual(invoice.balance_cents, 11_300)

    def test_refund_cannot_exceed_balance(self) -> None:
        invoice = Invoice(id="inv-2", buyer="买家乙", subtotal_cents=100)
        with self.assertRaises(InvoiceError):
            invoice.with_refund(101)


if __name__ == "__main__":
    unittest.main()
