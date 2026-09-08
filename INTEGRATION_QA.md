# V8 Integration QA

## Scope

V8 changes only presentation/performance code and version labels. Research data and reports are not recomputed or corrected. All V7 functionality is retained.

## Responsive checks

- fixed chart-height overrides are superseded by responsive SVG rules;
- network canvases use viewport-aware heights;
- knowledge graphs register a `ResizeObserver` and re-run `fit()` after container resize;
- responsive breakpoints reduce dashboard padding and collapse multi-column grids on narrow screens;
- heatmaps/tables remain scrollable rather than becoming illegibly small.

## Performance checks

- network layout cache added with bounded size (64 layouts);
- large-network force iterations reduced;
- cluster research views are rendered on demand per active sub-tab;
- 1,534-row and 1,869-row full tables are lazy-loaded on `<details>` open;
- help/glossary decoration is idle-scheduled and scoped to the active tab;
- large table bodies are excluded from term-decoration scanning;
- live tooltip pointer movement is `requestAnimationFrame`-throttled;
- resize handling is `requestAnimationFrame`-throttled.

## Static checks

- `node --check app.js`: passed.
- source/data/legacy trees compared against V7: expected to be byte-identical.
- internal new ↔ old dashboard link paths remain local in the package.
- ZIP integrity is checked before delivery.

A full Chromium screenshot smoke test is not claimed because Chromium rendering in this runtime has previously failed on DBus/runtime initialization.
