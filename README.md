# Ramban Dashboard V9

V9 is the corrected provenance release of the integrated Ramban supercommentaries dashboard. **Its visual design is intentionally the same as V8.** The correction affects identities, population logic, reports, and derived interpretations — not the dashboard's basic layout or visual language.

## Open the dashboard

- Windows: run `OPEN_DASHBOARD.cmd`.
- Or open `index.html` directly in a modern browser.
- The small button at the top opens the embedded **old dashboard (V2)**; that dashboard contains a reciprocal button back to V9.

## ⟦תיקון V9⟧ Da'at Chacham

There is no Da'at Chacham Vatican 114 witness in the supplied source corpus.

Canonical identities:

- `DaatChacham_Vat107_Main` — **דעת החכם — ותיקן 107**.
- `DaatChacham_Vat214_Main` — **דעת החכם — ותיקן 214** (main commentary).
- `DaatChacham_Vat214_Marginalia` — **הערות בשולי דעת החכם — ותיקן 214**.

The marginalia remain available as a separate textual layer, but they are **not counted by default as an independent commentator/commentary witness**.

## What changed

- Legacy “Vat114” was remapped to the main text of Vat214.
- Legacy “Vat214” in the Da'at Chacham slot was remapped to Vat214 marginalia.
- Both the integrated dashboard and the embedded old dashboard were corrected.
- Reports and evidence sheets were corrected and marked with `⟦תיקון V9⟧` at changed passages.
- Direct pairwise metrics were preserved where mathematically valid after remapping.
- Population-dependent metrics that cannot be reconstructed exactly from the supplied outputs are suspended rather than guessed.
- The old E3 signature comparison that can be reconstructed exactly gives **Vat107 ↔ Vat214 main = 0.9839**.
- The previous narrative of an “anomalous Vat214 witness” is invalid. The new research question concerns the relationship between **Vat214 marginalia** and the anonymous tradition.

## Documentation

- `CHANGELOG_V9.md` — concise change log.
- `INTEGRATION_QA.md` — release QA and remaining limitations.
- `source/CORRECTION_PROTOCOL_RAMBAN_V9.md` — authoritative correction protocol / reusable prompt.
- `source/new_reports/` — corrected Markdown and PDF reports.

## Important methodological rule

V9 distinguishes between:

1. direct measurements between fixed graph pairs, which can generally survive identity remapping; and
2. population-dependent statistics (cluster membership, co-cluster, Z/percentile/rank and related aggregates), which require recomputation when the population changes.

Where the original pipeline cannot be reconstructed exactly from the supplied files, the value is displayed as **pending rerun** and its V8 value is kept only for audit.
