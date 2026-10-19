package inventory

import "testing"

func TestReservationHoldPromotesEmbeddedStock(t *testing.T) {
	reservation := &Reservation{
		StockItem: StockItem{SKU: "sku-9", OnHand: 8},
		ID:        "rsv-1",
		Qty:       3,
		Buyer:     "buyer-1",
	}
	if err := reservation.Hold(); err != nil {
		t.Fatal(err)
	}
	if reservation.SKU != "sku-9" || reservation.Reserved != 3 || reservation.Available() != 5 {
		t.Fatalf("promoted fields: sku=%s reserved=%d available=%d", reservation.SKU, reservation.Reserved, reservation.Available())
	}
	if err := reservation.Cancel(); err != nil {
		t.Fatal(err)
	}
	if reservation.Reserved != 0 || reservation.Available() != 8 {
		t.Fatalf("after cancel reserved=%d available=%d", reservation.Reserved, reservation.Available())
	}
}

func TestReservationHoldRejectsShortage(t *testing.T) {
	reservation := &Reservation{
		StockItem: StockItem{SKU: "sku-9", OnHand: 1, Reserved: 1},
		ID:        "rsv-2",
		Qty:       1,
		Buyer:     "buyer-2",
	}
	if err := reservation.Hold(); err != ErrInsufficient {
		t.Fatalf("Hold() err = %v, want ErrInsufficient", err)
	}
}
