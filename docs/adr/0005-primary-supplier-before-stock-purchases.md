---
status: superseded by ADR-0010
---

# Primary supplier before stock purchases

The first supplier capability will associate at most one primary supplier with a Product, while deferring stock purchases and per-unit provenance to a future inventory-entry model. This keeps the immediate warranty lookup simple without preventing a later relationship of Product → Stock entry → Supplier → Work Order item.
