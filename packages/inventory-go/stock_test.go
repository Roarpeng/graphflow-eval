package inventory

import "testing"

func TestStockItemAvailableAndCommit(t *testing.T) {
	item := &StockItem{SKU: "sku-1", OnHand: 10, Reserved: 4}
	if got := item.Available(); got != 6 {
		t.Fatalf("Available() = %d, want 6", got)
	}
	if err := item.Commit(4); err != nil {
		t.Fatal(err)
	}
	if item.OnHand != 6 || item.Reserved != 0 {
		t.Fatalf("after commit: onHand=%d reserved=%d", item.OnHand, item.Reserved)
	}
	if err := item.Commit(1); err != ErrInsufficient {
		t.Fatalf("Commit() err = %v, want ErrInsufficient", err)
	}
}

func TestStockItemRejectsBadQty(t *testing.T) {
	item := &StockItem{SKU: "sku-1", OnHand: 2}
	if err := item.Release(0); err != ErrBadQty {
		t.Fatalf("Release() err = %v, want ErrBadQty", err)
	}
}
