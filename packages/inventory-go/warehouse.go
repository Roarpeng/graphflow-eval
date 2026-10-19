package inventory

// Warehouse stores reservations keyed by id.
// Same-package helpers in stock.go are used with no file-level import.
type Warehouse struct {
	Bins map[string]*Reservation
}

// Reserve creates a hold against a freshly counted bin.
func (w *Warehouse) Reserve(id, sku, buyer string, onHand, qty int) (*Reservation, error) {
	if w.Bins == nil {
		w.Bins = map[string]*Reservation{}
	}
	reservation := &Reservation{
		StockItem: StockItem{SKU: sku, OnHand: onHand},
		ID:        id,
		Qty:       qty,
		Buyer:     buyer,
	}
	if err := reservation.Hold(); err != nil {
		return nil, err
	}
	w.Bins[id] = reservation
	return reservation, nil
}

// Commit ships a held reservation and removes it from the book.
func (w *Warehouse) Commit(id string) (*Reservation, error) {
	reservation, ok := w.Bins[id]
	if !ok {
		return nil, ErrUnknownReservation
	}
	if err := reservation.Commit(reservation.Qty); err != nil {
		return nil, err
	}
	delete(w.Bins, id)
	return reservation, nil
}
