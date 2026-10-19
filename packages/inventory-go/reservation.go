package inventory

// Reservation is a buyer hold. StockItem is embedded, so SKU, OnHand,
// Reserved, Available, Commit, and Release are promoted onto Reservation.
type Reservation struct {
	StockItem
	ID    string
	Qty   int
	Buyer string
}

// Hold increases the embedded Reserved count when Available covers Qty.
func (r *Reservation) Hold() error {
	if r == nil {
		return ErrUnknownReservation
	}
	if r.Qty <= 0 {
		return ErrBadQty
	}
	if r.Available() < r.Qty {
		return ErrInsufficient
	}
	r.Reserved += r.Qty
	return nil
}

// Cancel drops the hold and releases the embedded reserved units.
func (r *Reservation) Cancel() error {
	if r == nil {
		return ErrUnknownReservation
	}
	return r.Release(r.Qty)
}
