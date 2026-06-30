function splitHighlights(text, terms) {
  if (!text || !Array.isArray(terms) || !terms.length) {
    return [{ type: 'text', value: text || '' }];
  }

  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);

  if (!escaped.length) return [{ type: 'text', value: text }];

  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return String(text).split(re).filter(Boolean).map((part) => {
    const matchedTerm = terms.find((term) => new RegExp(`^${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(part));
    return {
      type: matchedTerm ? 'mark' : 'text',
      value: part,
      term: matchedTerm || null,
    };
  });
}

function stripNiqqud(text) {
  return String(text || '').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
}

function toHighlightedHtml(chunks, termColors = null) {
  const resolveColor = (term) => {
    if (!termColors) return null;
    const key = String(term || '').toLowerCase();
    if (termColors instanceof Map) {
      return termColors.get(key) || null;
    }
    if (typeof termColors === 'object') {
      return termColors[key] || null;
    }
    return null;
  };

  return chunks
    .map((chunk) => {
      const safe = String(chunk.value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
      if (chunk.type === 'mark') {
        const color = resolveColor(chunk.term || chunk.value) || '#7d3f20';
        return `<mark class="term-mark" data-highlight-term="${String(chunk.term || chunk.value).replaceAll('"', '&quot;')}" style="--term-color:${color};--term-bg:${color}22;--term-bg-strong:${color}33;">${safe}</mark>`;
      }
      return safe;
    })
    .join('');
}

function toMultiHighlightedHtml(chunksList, termColors = null) {
  return chunksList
    .map((chunks, idx) => {
      const wrapped = toHighlightedHtml(chunks, termColors);
      return `<section class="parallel-highlight parallel-highlight-${idx}">${wrapped}</section>`;
    })
    .join('');
}

window.RV2Text = {
  splitHighlights,
  stripNiqqud,
  toHighlightedHtml,
  toMultiHighlightedHtml,
};
