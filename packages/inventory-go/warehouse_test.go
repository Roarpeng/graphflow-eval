package inventory

import "testing"

func TestWarehouseReserveAndCommit(t *testing.T) {
	warehouse := &Warehouse{}
	held, err := warehouse.Reserve("rsv-3", "sku-3", "buyer-3", 5, 2)
	if err != nil {
		t.Fatal(err)
	}
	if held.Buyer != "buyer-3" || held.OnHand != 5 || held.Reserved != 2 {
		t.Fatalf("hold = %+v", held)
	}
	shipped, err := warehouse.Commit("rsv-3")
	if err != nil {
		t.Fatal(err)
	}
	if shipped.OnHand != 3 || shipped.Reserved != 0 {
		t.Fatalf("shipped = %+v", shipped)
	}
	if _, err := warehouse.Commit("rsv-3"); err != ErrUnknownReservation {
		t.Fatalf("second commit err = %v", err)
	}
}
