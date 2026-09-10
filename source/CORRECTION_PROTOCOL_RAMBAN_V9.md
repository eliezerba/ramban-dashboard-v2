# CORRECTION_PROTOCOL.md
## Ramban Supercommentaries — Da'at Chacham Identity / Provenance Correction

### STATUS
This protocol is authoritative for all future work on the Ramban supercommentaries dashboards, E2/E3 data, quantitative datasets, research reports, and derived visualizations.

Do not preserve legacy Da'at Chacham identifiers if they conflict with this protocol.

---

# 1. Canonical correction

There is **no Da'at Chacham witness from Vatican 114** in the supplied source corpus.

The canonical source units are:

1. **Da'at Chacham — Vatican 107 — main commentary**
2. **Da'at Chacham — Vatican 214 — main commentary**
3. **Marginal notes on Da'at Chacham — Vatican 214**

Legacy identifiers were mapped incorrectly:

| Legacy identifier | Actual source unit | Canonical identifier |
|---|---|---|
| `DaatChachamVatokan107` | Da'at Chacham, Vatican 107, main text | `DaatChacham_Vat107_Main` |
| `DaatChachamVatokan114` | Da'at Chacham, Vatican 214, main text | `DaatChacham_Vat214_Main` |
| `DaatChachamVatokan214` | Marginal notes on Da'at Chacham, Vatican 214 | `DaatChacham_Vat214_Marginalia` |

Never create or display a Da'at Chacham entity called Vatican 114.

---

# 2. Source provenance

Canonical provenance derives from `Sources-Ramban`.

Expected mapping:

- source column J → `DaatChacham_Vat107_Main`
- source column K → `DaatChacham_Vat214_Main`
- source column L → `DaatChacham_Vat214_Marginalia`

Validation already established:

- 26/26 legacy Vat107 text units match source column J.
- 25/25 detailed legacy Vat114 graph/text units match source column K.
- The additional source-K unit is §7_2, which is present in the newer quantitative package but lacks a full old-dashboard graph/text object.
- 8/8 legacy Vat214 graph/text units match source column L.

Therefore:
- legacy `114` = Vatican 214 main text.
- legacy `214` = Vatican 214 marginalia.

---

# 3. Required entity schema

Every textual unit must carry explicit provenance fields.

Minimum schema:

```yaml
stable_id:
display_name:
work:
manuscript:
unit_role:
source_file:
source_sheet:
source_column:
legacy_id:
```

Canonical values:

```yaml
- stable_id: DaatChacham_Vat107_Main
  display_name: דעת החכם — ותיקן 107
  work: דעת החכם
  manuscript: Vatican 107
  unit_role: commentary_witness
  source_column: J
  legacy_id: DaatChachamVatokan107

- stable_id: DaatChacham_Vat214_Main
  display_name: דעת החכם — ותיקן 214
  work: דעת החכם
  manuscript: Vatican 214
  unit_role: commentary_witness
  source_column: K
  legacy_id: DaatChachamVatokan114

- stable_id: DaatChacham_Vat214_Marginalia
  display_name: הערות בשולי דעת החכם — ותיקן 214
  work: דעת החכם
  manuscript: Vatican 214
  unit_role: marginalia
  source_column: L
  legacy_id: DaatChachamVatokan214
```

---

# 4. Population rule

Default corpus analyses of "commentators", "commentary witnesses", "all commentators", clustering, dendrograms, section populations, and comparative rankings must include:

- `DaatChacham_Vat107_Main`
- `DaatChacham_Vat214_Main`

and must **exclude by default**:

- `DaatChacham_Vat214_Marginalia`

Marginalia may be included only in an explicit analytical mode such as:

`include_marginalia = true`

The dashboard must visually distinguish:
- commentary witness
- marginalia

Marginalia must never be silently counted as an independent commentary witness.

---

# 5. What can be preserved by remapping

Direct pairwise calculations performed on the same underlying graph objects can normally be preserved after renaming.

Examples:

- raw similarity
- bits
- direct graph overlap
- shared concepts
- comparable claims count
- shared claims
- direct edge/node comparison
- graph-level similarity between two fixed units

Example:

Legacy:
`DaatChachamVatokan107 ↔ DaatChachamVatokan114`

Correct interpretation:
`DaatChacham_Vat107_Main ↔ DaatChacham_Vat214_Main`

The numeric pairwise value may remain unchanged if it was computed only from those two graph objects.

---

# 6. What MUST be recomputed

Recompute every measure that depends on corpus population, ranking, normalization, clustering, or the presence/absence of other units.

At minimum recompute:

- within-section Z-scores
- percentiles
- section-relative ranks
- corpus-relative ranks
- global distributions when marginalia were included
- local clusters
- global clustering
- dendrograms
- network communities
- co-cluster / קו-אשכול when derived from cluster membership
- cluster significance
- number of commentators per section
- section medians/means affected by population membership
- global medians/means affected by population membership
- proximity rankings to Ramban when rank is relative
- any "top N", percentile, outlier, anomaly, or rank-based claim
- any visualization based on the recomputed measures above

Do not assume a legacy aggregate remains valid merely because its component pairwise values are valid.

---

# 7. Required corrections in old dashboard / old data layer

Perform a safe identifier migration in this order:

1. rename legacy `DaatChachamVatokan214`
   → `DaatChacham_Vat214_Marginalia`

2. rename legacy `DaatChachamVatokan114`
   → `DaatChacham_Vat214_Main`

3. rename legacy `DaatChachamVatokan107`
   → `DaatChacham_Vat107_Main`

Update all references in:

- E2 full-corpus outputs
- section graph objects
- commentator profiles
- aggregate graphs
- overlap visualizations
- heatmaps
- data-index files
- UI labels
- dropdowns
- legends
- tooltips
- E3 comparative outputs
- summaries
- README / metadata files

After migration, search recursively for:

- `DaatChachamVatokan114`
- `Vatican 114`
- `Vat. 114`
- `ותיקן 114`
- `דעת החכם 114`
- `דעת חכם 114`

Expected result: **zero valid occurrences**.

If occurrences remain, inspect them manually; do not blind-replace historical audit text that intentionally documents the error.

---

# 8. Required corrections in newer quantitative package

Audit and update at minimum:

- `מפתח_חיבורים.csv`
- `כל_הזוגות_מדורגים.csv`
- `פירוק_התפזרות.csv`
- `קו_אשכול_בין_חיבורים.csv`
- `קרבה_לרמבן.csv`
- all derived CSV/JSON datasets containing legacy Da'at Chacham identifiers

Audit textual reports including:

- `00_קרא_אותי`
- `01_ממצאים_לפי_שאלותיכם`
- `03_מפתח_חיבורים`
- `05_גיליון_ראיות`
- all Markdown/PDF/HTML summaries

The corrected datasets must distinguish:
- Vat107 main
- Vat214 main
- Vat214 marginalia

---

# 9. Mandatory narrative corrections

Invalidate the following legacy narrative:

> "Da'at Chacham 107 and 114 form a close family, while Vatican 214 is anomalous and clusters with the anonymous Escorial commentary."

This narrative is wrong because:
- legacy 114 = Vat214 main text
- legacy 214 = Vat214 marginalia

Correct narrative:

1. Da'at Chacham Vatican 107 and Vatican 214 main texts form a very close pair.
2. The marginal notes in Vatican 214 behave differently from the main text.
3. In several sections, those marginal notes are relatively close to the anonymous Escorial commentary.
4. This raises a new philological question about the origin, transmission, or textual affiliation of the marginalia.

Do not describe Vat214 main as anomalous.

---

# 10. Research findings to preserve with corrected labels

The strong legacy 107–114 similarity must be relabeled as:

**Da'at Chacham Vatican 107 ↔ Da'at Chacham Vatican 214 main text**

Previously observed examples include approximately:

- §27 raw ≈ 0.799
- §14 raw ≈ 0.677
- §32 raw ≈ 0.638
- §26_1 raw ≈ 0.875
- §12 raw ≈ 0.801

Legacy co-cluster ≈ 0.96 across 25 shared sections refers to:
**Vat107 main ↔ Vat214 main**

Recompute co-cluster if marginalia removal changes the clustering population.

---

# 11. New philological hypothesis to test

The legacy relationship:

`DaatChachamVatokan214 ↔ Anonymous Escorial`

actually means:

`DaatChacham_Vat214_Marginalia ↔ Anonymous Escorial`

Previously observed local raw similarities include approximately:

- §21 ≈ 0.694
- §22 ≈ 0.672
- §23 ≈ 0.718
- §25_2 ≈ 0.644
- §30 ≈ 0.731

Treat this as a hypothesis-generating result only.

Required interpretation:

> The Vatican 214 marginalia may preserve or reflect a tradition related to the anonymous Escorial commentary.

Do NOT infer:
- direct dependence
- common authorship
- identity of recension
- date/direction of transmission

without philological collation.

---

# 12. Required dashboard UI changes

The new dashboard must:

1. Show `דעת החכם — ותיקן 107`.
2. Show `דעת החכם — ותיקן 214`.
3. Show `הערות בשולי דעת החכם — ותיקן 214` as a different unit type.
4. Never show Da'at Chacham Vatican 114.
5. Mark marginalia visually and semantically.
6. Add a filter such as:
   `כלול שכבות שוליים`
   default = OFF.
7. Exclude marginalia from default all-commentator clustering and rankings.
8. Allow explicit analysis of marginalia in dedicated views.
9. Add provenance/tooltips explaining unit role and source.
10. Rebuild all affected cluster/dendrogram/heatmap views using corrected populations.

---

# 13. Required replacement visualization

Remove or rewrite the legacy visualization:
**"Anomaly of Da'at Chacham Vatican 214"**

Replace with a view such as:

## "One manuscript, two interpretive layers"

Display together:

- Da'at Chacham — Vatican 107 main
- Da'at Chacham — Vatican 214 main
- Vatican 214 marginalia
- Anonymous Escorial commentary
- optionally anonymous Vatican commentary

Visual goals:

- show strong Vat107 ↔ Vat214 main proximity
- show marginalia as distinct from Vat214 main
- show local marginalia ↔ Escorial proximity
- allow section-level drill-down
- distinguish text witness from marginal layer

---

# 14. Required corrections to research reports / stories

Search every report for:

- `114`
- `ותיקן 114`
- `דעת חכם 114`
- `DaatChachamVatokan114`
- `דעת חכם 214`
- `DaatChachamVatokan214`

For each occurrence determine the underlying legacy entity before editing.

Do NOT perform blind search-and-replace.

Safe replacement pattern:

Legacy statement:
"Da'at Chacham 107 and 114"

when based on legacy 107 + legacy 114

→

"Da'at Chacham, Vatican 107 and Vatican 214"

Unsafe statement requiring rewrite:

"Vatican 214 is an anomalous Da'at Chacham witness"

→ delete/rewrite, because legacy "214" was marginalia.

---

# 15. Mandatory rewrite of the third story in the first story-report

The previous story:
**"The anomaly of Da'at Chacham Vatican 214"**

is invalid.

Replace with:

## "One manuscript, two traditions: Da'at Chacham Vatican 214 and the voices in its margins"

Required story structure:

1. Establish Vat107 and Vat214 main as close witnesses.
2. Demonstrate this in multiple sections.
3. Introduce Vat214 marginalia as a separate textual layer.
4. Compare marginalia against the Vat214 main text.
5. Show local marginalia proximity to the anonymous Escorial commentary.
6. Explain that manuscript 214 contains at least two analytically distinct textual layers.
7. End with a philological research question, not a definitive stemmatic claim.

---

# 16. Validation rules before publishing V9

## Identifier integrity
- no active `DaatChachamVatokan114`
- no active "Vatican 114" for Da'at Chacham
- no collision between Vat214 main and Vat214 marginalia

## Source integrity
For every corrected object:
- text matches canonical source column
- section identifier matches source row/section
- stable_id is unique
- unit_role is populated

## Population integrity
Default commentator population excludes marginalia.

## Quantitative integrity
Recomputed:
- clustering
- dendrograms
- co-cluster where population-dependent
- Z-scores
- percentiles
- ranks
- corpus aggregates affected by population

## Narrative integrity
No report claims:
- three Da'at Chacham witnesses 107/114/214
- anomalous Vat214 main
- Vat114 as a real witness

## UI integrity
Dashboard clearly distinguishes:
- main witness
- marginalia

---

# 17. Automated safeguards for future ingestion

Before E2 generation, implement validation:

1. Every input column/unit must map to exactly one stable_id.
2. Every stable_id must map to exactly one source unit.
3. No manuscript identifier may appear in E2 unless present in source metadata.
4. If a manuscript contains multiple textual layers, each must have a distinct unit_role.
5. Reject duplicate display names with different source columns unless explicitly allowed.
6. Produce a provenance table before graph construction.
7. Compare:
   `input unit count == stable_id count == provenance row count`
8. Fail build if a new manuscript number is introduced without source evidence.

For this corpus, a validation rule should have rejected "Vatican 114" immediately.

---

# 18. V9 build instruction

Build V9 from V8 without removing existing functionality.

Required actions:

1. Preserve all V8 tabs, visualizations, info popups, interactive graphs, old-dashboard link, reports, and exploratory tools unless a component is specifically invalidated by this correction.
2. Apply canonical identity migration.
3. Add explicit provenance and unit_role metadata.
4. Recompute all population-dependent metrics.
5. Regenerate affected visualizations.
6. Update textual reports.
7. Replace the invalid "Vat214 anomaly" story/visualization.
8. Add the new Vat214 main/marginalia comparison.
9. Add `include_marginalia` control where appropriate.
10. Keep a read-only V8 snapshot for audit/history.
11. Add a V9 changelog documenting:
    - error
    - origin
    - mapping
    - calculations recomputed
    - narratives changed
    - values materially changed
12. Run full QA against the canonical source before release.

---

# 19. Acceptance report required after V9 rebuild

Produce a machine-readable and human-readable QA report containing:

- count of legacy 114 occurrences before/after
- count of Vat107 main units
- count of Vat214 main units
- count of Vat214 marginalia units
- section coverage for each
- list of recomputed metrics
- before/after values for materially changed global statistics
- before/after affected cluster memberships
- list of reports updated
- list of visualizations regenerated
- unresolved ambiguities
- confirmation that marginalia are excluded from default commentator population

---

# 20. Short authoritative memory

Use this exact conceptual memory in future work:

> There is no Da'at Chacham Vatican 114 in the supplied corpus. Legacy `DaatChachamVatokan114` is the main Da'at Chacham text of Vatican 214. Legacy `DaatChachamVatokan214` is the marginalia on Da'at Chacham in Vatican 214. The real main witnesses are Vatican 107 and Vatican 214; marginalia are a separate textual layer. Preserve direct pairwise measurements by remapping when mathematically valid, but recompute every population-dependent statistic, cluster, rank, and visualization. Any previous claim about an anomalous Vatican 214 witness is invalid and must be replaced by analysis of Vatican 214 main text versus its marginalia and the marginalia's possible relationship to the anonymous tradition.
