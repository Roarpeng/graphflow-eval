import unittest

from billing.tax import calc_shui_e


class TaxTests(unittest.TestCase):
    def test_basis_points_round_down(self) -> None:
        self.assertEqual(calc_shui_e(199, 1_000), 19)

    def test_rejects_rate_above_100_percent(self) -> None:
        with self.assertRaises(ValueError):
            calc_shui_e(100, 10_001)


if __name__ == "__main__":
    unittest.main()
