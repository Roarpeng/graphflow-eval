import unittest

from billing.partial import PartialRefundPolicy
from billing.refund import RefundPolicy
from billing.workflow import issue_invoice, settle_full, settle_partial


class RefundTests(unittest.TestCase):
    def setUp(self) -> None:
        self.invoice = issue_invoice("inv-9", "买家丙", 10_000, 0)

    def test_full_refund_posts_the_requested_amount(self) -> None:
        next_invoice = settle_full(RefundPolicy(), self.invoice, 4_000)
        self.assertEqual(next_invoice.refunded_cents, 4_000)
        self.assertEqual(next_invoice.balance_cents, 6_000)

    def test_partial_refund_caps_at_half_then_calls_super(self) -> None:
        next_invoice = settle_partial(PartialRefundPolicy(), self.invoice, 9_000)
        self.assertEqual(next_invoice.refunded_cents, 5_000)
        self.assertEqual(next_invoice.balance_cents, 5_000)

    def test_partial_keeps_a_smaller_request(self) -> None:
        next_invoice = settle_partial(PartialRefundPolicy(), self.invoice, 100)
        self.assertEqual(next_invoice.refunded_cents, 100)


if __name__ == "__main__":
    unittest.main()
