# Ramban Dashboard V8

V8 is a focused performance and responsive-layout refinement of V7. No research data, report, tab, visualization, glossary entry, or old-dashboard navigation was removed.

## Responsive graphs

- SVG charts now scale to the width of their actual panel instead of retaining fixed pixel heights.
- Knowledge-graph canvases use viewport-aware `clamp()` heights and refit automatically through `ResizeObserver` when their container changes size.
- Grid children are allowed to shrink correctly (`min-width: 0`), avoiding charts forcing a panel wider than the browser window.
- The main network, cluster networks, dispersion plots, dendrograms, histograms, bar charts and profile charts all use responsive sizing.
- Heatmaps and large tables retain horizontal scrolling where shrinking cells would make the data unreadable.

## Performance changes

- Knowledge-graph layouts are cached. Switching labels, relation filters, or “מה זה? / מי זה?” no longer recomputes the expensive force layout when the graph itself is unchanged.
- First-time force-layout iterations were reduced for large networks while preserving the same soft-boundary layout logic.
- The “אשכולות ופיזור” page renders charts only for the currently visible research sub-tab instead of drawing every hidden visualization on entry.
- The 1,534-row ranked-pairs table and the 1,869-row dispersion table are now lazy-loaded only when their `<details>` section is opened.
- Technical-term decoration is restricted to the active tab, deferred to browser idle time, and skips large table bodies.
- Live hover tooltip work is throttled to one update per animation frame.
- Window resize work is also animation-frame throttled.

## Source preservation

The contents of `data/`, `source/`, and `legacy/ramban-dashboard-V2/` remain unchanged from V7. The old dashboard is still bundled and navigation works in both directions.

Open `index.html` (or `OPEN_DASHBOARD.cmd` on Windows).
