function sortByNumeric(rows, key, descending = true) {
  const sorted = [...rows].sort((a, b) => {
    const aa = Number(a[key]);
    const bb = Number(b[key]);
    const av = Number.isFinite(aa) ? aa : -Infinity;
    const bv = Number.isFinite(bb) ? bb : -Infinity;
    return descending ? bv - av : av - bv;
  });
  return sorted;
}

function filterRows(rows, predicate) {
  return rows.filter(predicate);
}

window.RV2Tables = {
  sortByNumeric,
  filterRows,
};
