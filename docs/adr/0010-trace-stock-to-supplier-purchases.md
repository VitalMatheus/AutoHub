---
status: accepted
---

# Trace consumed stock to supplier purchases

Stock acquired from a Supplier will enter through a Purchase and remain identifiable through Stock entries allocated to Work Order Items when the Work Order is completed or to Direct Sale Items when a sale is confirmed. A Product may have several Suppliers and one preferred Supplier, but that preference cannot stand in for historical provenance. This supersedes ADR-0005 because warranty lookup requires knowing which acquisition supplied a consumed piece, while confirming a Purchase must update stock and create its payable Expense atomically. Existing untraceable stock remains as Opening stock and is consumed only after traceable entries are exhausted.
