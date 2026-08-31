# Consume stock when a Work Order is completed

Product stock is consumed only when a Work Order reaches COMPLETED, using its final Product quantities. This avoids changing stock for drafts, abandoned edits, or cancelled work, while preserving the operational distinction between authorization, execution, completion, and delivery; corrections after completion must be explicit and historical.
