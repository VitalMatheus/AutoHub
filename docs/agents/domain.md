# Domain Docs

How engineering skills consume this repository’s domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- Relevant ADRs under `docs/adr/`.

If these files do not exist, proceed silently. The `domain-modeling` skill creates them when terminology or decisions are resolved.

## File structure

This repository uses a single-context layout:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary’s vocabulary

When naming a domain concept in an issue, proposal, hypothesis, or test, use the term defined in `CONTEXT.md`.

If the concept is missing, reconsider whether it belongs to the project or record the gap for `domain-modeling`.

## Flag ADR conflicts

Explicitly identify output that contradicts an existing ADR rather than silently overriding it.
