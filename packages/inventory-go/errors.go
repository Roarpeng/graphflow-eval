package inventory

import "errors"

var (
	// ErrBadQty means the requested quantity is not a positive count.
	ErrBadQty = errors.New("quantity must be positive")
	// ErrInsufficient means available units cannot cover the request.
	ErrInsufficient = errors.New("insufficient available stock")
	// ErrUnknownReservation means the warehouse has no such hold.
	ErrUnknownReservation = errors.New("unknown reservation")
)
