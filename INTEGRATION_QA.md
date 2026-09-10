# INTEGRATION QA — Ramban Dashboard V9

## Release status

**PASS — V9 release package is ready.**

V9 is a provenance/identity correction built on V8. The visual CSS of both the integrated dashboard and the embedded old V2 dashboard is byte-for-byte identical to V8; changes are limited to corrected identities, data population logic, corrected reports, V9 notices, and the UI logic required to distinguish the marginal layer.

## Canonical identity

- PASS — no active Da'at Chacham Vatican 114 entity.
- PASS — `DaatChacham_Vat107_Main` = דעת החכם — ותיקן 107.
- PASS — `DaatChacham_Vat214_Main` = דעת החכם — ותיקן 214, main commentary.
- PASS — `DaatChacham_Vat214_Marginalia` = הערות בשולי דעת החכם — ותיקן 214.
- PASS — marginalia are excluded from the default commentator/witness population.
- PASS — corrected global old-dashboard clusters exclude marginalia; the historical V8 clusters are retained separately for audit.

## Source verification

Verified again against `Sources-Ramban.xlsx`, sheet `מקורות`:

- column J: `דעת החכם - ותיקן 107`
- column K: `דעת החכם ותיקן 214`
- column L: `הערות בשולי דעת החכם - ותיקן 214`
- no source header contains Vatican 114.

## Quantitative package

- Archive ranked rows: **1,534**.
- Default V9 ranked rows excluding marginalia: **1,459**.
- Archive dispersion rows: **1,869**.
- Default V9 dispersion rows excluding marginalia: **1,786**.
- raw median (default V9 population): **0.2009**.
- raw >= 0.50: **44 / 1,459 = 3.02%**.
- locus-overlap median: **0.080**.
- reading-agreement median: **0.000**.
- shared concept(s) but zero comparable claims: **395 / 1,786 = 22.12%**.
- zero reading agreement among rows with comparable claims: **763 / 1,306 = 58.42%**.

## Population-dependent measures

- PASS — all new-pipeline active `co_cluster_rate` values are suspended in V9; all 105 V8 values are retained in `legacy_co_cluster_rate` for audit only.
- PASS — affected within-section Z values are suspended and legacy values retained.
- PASS — direct Ramban dimensions D1 / D5 / register are retained; co-cluster is suspended; the V9 displayed combined ranking uses only the three direct dimensions.
- PASS — old E3 Da'at Chacham signature was recomputed from the available matrix: **Vat107 main ↔ Vat214 main = 0.9839**; corrected corpus mean = **0.7936**.
- PASS — old-dashboard global cluster containing the marginalia was recomputed without marginalia where the available E3 matrix permits an exact reconstruction.

## Reports

- PASS — all six new Markdown reports contain a visible `⟦תיקון V9⟧` notice.
- PASS — `01_ממצאים_לפי_שאלותיכם` was rewritten using corrected default-population counts and interpretations.
- PASS — `03_מפתח_חיבורים.pdf` was rebuilt as a landscape table so rows are readable and never split across pages.
- PASS — all six PDFs were regenerated/verified; total page counts: 2, 3, 6, 3, 2, 7.
- PASS — all PDF files pass structural checks and were visually inspected after rendering.
- PASS — old E3 reports are explicitly marked historical where population-dependent claims were not rerun.
- PASS — substantive corrections remain visibly marked with `⟦תיקון V9⟧`.

## Dashboard integrity

- PASS — integrated dashboard JavaScript syntax.
- PASS — old V2 dashboard JavaScript syntax.
- PASS — all 37 section data files referenced by the integrated index exist.
- PASS — all 21 commentator/textual-unit data files referenced by the integrated index exist.
- PASS — navigation from new dashboard to old dashboard and back resolves to existing local files.
- PASS — no legacy `DaatChachamVatokan114` commentator file remains active.
- PASS — overlap visualization filenames for the two main Da'at Chacham witnesses were migrated to canonical IDs.
- PASS — V8 CSS is preserved exactly in both dashboards.

Automated release QA: **126 / 126 checks passed**.

## Browser-render limitation

An automated Chromium screenshot smoke test was attempted again. Chromium in this container hangs on missing DBus/system services and was terminated after 30 seconds. This is an environment limitation rather than a detected dashboard error. Because of that, no claim is made that a full automated browser-render smoke test passed. Static reference checks, JavaScript syntax checks, data-integrity checks, PDF rendering, and package checks did pass.

## Known issues not caused by V9

- §1 Ramban graph remains a known source-data error retained as a control.
- The historical coverage archive contains 385 records while the sum of section counts in the commentator key is 383. V9 does not silently resolve this unrelated discrepancy.
- §7_2 exists in the newer quantitative package but lacks the corresponding full old-dashboard text/graph object.

## V9 interpretation rule

Direct pairwise measurements may be read after identity remapping. Population-dependent measurements that cannot be exactly reconstructed from the supplied material are shown as suspended / awaiting rerun rather than replaced by estimates.
