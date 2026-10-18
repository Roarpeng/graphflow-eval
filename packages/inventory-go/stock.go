package inventory

// StockItem is the on-hand record for one SKU inside a bin.
// Reservation embeds this struct; there is no import between the files
// because they share package inventory.
type StockItem struct {
	SKU      string
	OnHand   int
	Reserved int
}

// Available is on-hand minus reserved, never negative.
func (s *StockItem) Available() int {
	if s == nil {
		return 0
	}
	n := s.OnHand - s.Reserved
	if n < 0 {
		return 0
	}
	return n
}

// Commit removes previously reserved units from on-hand stock.
func (s *StockItem) Commit(qty int) error {
	if qty <= 0 {
		return ErrBadQty
	}
	if s.Reserved < qty || s.OnHand < qty {
		return ErrInsufficient
	}
	s.OnHand -= qty
	s.Reserved -= qty
	return nil
}

// Release returns reserved units without shipping them.
func (s *StockItem) Release(qty int) error {
	if qty <= 0 {
		return ErrBadQty
	}
	if s.Reserved < qty {
		return ErrInsufficient
	}
	s.Reserved -= qty
	return nil
}
