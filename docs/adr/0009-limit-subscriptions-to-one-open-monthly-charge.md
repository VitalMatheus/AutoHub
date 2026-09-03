# Limit subscriptions to one open monthly charge

The commercial MVP permits at most one open Subscription Charge per Organization and does not accrue new monthly charges while that charge remains unpaid. This deliberately favors a simple access-subscription model over debt accumulation: after five complete overdue days the Organization is payment-blocked, and full settlement restores access without retrospectively billing the blocked interval.

## Consequences

Partial settlement, concurrent monthly debt, and billing for blocked periods are outside the MVP. Reconciliation must not issue a new charge while one is open, while cancellation stops future charges without forgiving the existing one, and gateway reversals reopen that same charge.
