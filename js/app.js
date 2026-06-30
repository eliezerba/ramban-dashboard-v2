const RV2LoadSectionData = window.RV2DataLoader.loadSectionData;
const RV2LoadCommentatorData = window.RV2DataLoader.loadCommentatorData;
const RV2RenderGraph = window.RV2Graph.renderGraph;
const RV2SortByNumeric = window.RV2Tables.sortByNumeric;
const RV2FilterRows = window.RV2Tables.filterRows;
const RV2SplitHighlights = window.RV2Text.splitHighlights;
const RV2ToHighlightedHtml = window.RV2Text.toHighlightedHtml;
const RV2StripNiqqud = window.RV2Text.stripNiqqud;

const index = window.RAMBAN_V2_INDEX;
if (!index) {
  throw new Error('data-index.js לא נטען.');
}

const app = {
  currentTab: 'by-source',
  currentSectionId: index.sections[0]?.id || null,
  currentCommentatorId: index.commentators[0]?.id || null,
  currentGraphCommentator: 'RAMBAN',
  sourceSortKey: 'align',
  sourceFilterText: '',
  sourceSimilarityMetric: 'align',
  sourceComparisonSource: null,
  sourceComparisonTarget: null,
  selectedPairCommentator: null,
  selectedTextCommentatorsBySection: {},
  flowMetric: 'free',
  flowStatusFilter: 'all',
  atlasBridgesOnly: false,
  radarCommentatorId: 'RAMBAN',
  currentCorpusDocId: null,
};

const el = {
  sourceView: document.getElementById('view-by-source'),
  commentatorView: document.getElementById('view-by-commentator'),
  flowAtlasView: document.getElementById('view-flow-atlas'),
  overviewView: document.getElementById('view-overview'),
  corpusAnalysisView: document.getElementById('view-corpus-analysis'),
  dataArchiveView: document.getElementById('view-data-archive'),
  tabs: [...document.querySelectorAll('.tab')],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatMetric(value, digits = 3) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

function average(values) {
  const arr = (values || []).filter((v) => Number.isFinite(v));
  if (!arr.length) return 0;
  return arr.reduce((acc, v) => acc + v, 0) / arr.length;
}

function normalizedString(value) {
  return String(value || '').trim().toLowerCase();
}

const FIELD_HELP = {
  'קרבת פרשנים לרמב"ן': 'ממוצע align בין גרף הרמב"ן לגרפי הפרשנים באותו מקור. ערך גבוה מצביע על חפיפה מושגית גבוהה יותר לרמב"ן.',
  'הסכמה בין פרשנים': 'ממוצע align בין כל זוג פרשנים בתוך אותו מקור, ללא הרמב"ן. מציג עד כמה הפרשנים קרובים זה לזה.',
  'פער': 'הפרש בין קרבת הפרשנים לרמב"ן לבין ההסכמה בינם לבין עצמם. פער חיובי מעיד לרוב על Fan-Out, פער שלילי על Convergence.',
  'דגל איכות': 'תיוג אוטומטי שמסמן דפוס חריג: FAN-OUT, CONVERGENCE, THIN-RAMBAN, RAMBAN-OUTLIER וכדומה.',
  'מספר פרשנים': 'מספר הפרשנים הזמינים במקור זה (n_commentators).',
  'צמתי רמב"ן': 'מספר מושגי הרמב"ן (free concepts) בגרף המקור. ערך נמוך מאוד עשוי להעיד על גרף דל (THIN-RAMBAN).',
  'טבלת דמיון (רמב"ן מול פרשנים)': 'השוואה ישירה של כל פרשן לרמב"ן במקור הנבחר, על בסיס חפיפת מושגים (align) ורשימות shared/unique.',
  'מדד דמיון': 'align סימטרי בטווח 0-1: ממוצע הכיסוי הדו-כיווני בין אוצר המושגים של הפרשן והרמב"ן.',
  'מושגים משותפים': 'מספר המושגים שמופיעים גם אצל הרמב"ן וגם אצל הפרשן במקור זה.',
  'מושגים ייחודיים': 'מספר המושגים שמופיעים אצל הפרשן בלבד (unique_commentary), ואינם מופיעים בגרף הרמב"ן.',
  'השוואה בין פרשנים בתוך מקור': 'השוואת דמיון מושגי בין פרשנים באותו מקור (ללא הרמב"ן), כדי לזהות קרבה/ריחוק בין פרשנויות.',
  'דמיון ביניהם': 'דמיון Jaccard בין קבוצות מושגים מנורמלות של שני פרשנים באותו מקור.',
  'דוגמת מושגים משותפים': 'דוגמה קצרה מהמושגים המשותפים בין שני הפרשנים, לצורך בדיקה איכותנית מהירה.',
  'גרף אינטראקטיבי לפי מקור': 'גרף הידע של הפרשן הנבחר בתוך המקור: צמתים הם מושגים וקשתות הן יחסים סמאנטיים מתוך E2.',
  'טקסטים במבט מקביל': 'השוואה טקסטואלית בין הרמב"ן לפרשנים שנבחרו, עם הדגשת מונחים משותפים וסנכרון עם מצב הבחירה.',
  'סימון פעיל': 'רשימת הפרשנים והמונחים הפעילים כרגע בהדגשה. לחיצה על מונח מדגישה מופעים שלו בטקסטים.',
  'טופ-מתודות': 'התפלגות יחסי הידע הנפוצים ביותר אצל הפרשן: אילו פעולות פרשניות דומיננטיות (למשל appearsIn, correspondsTo).',
  'מונחי פרשנות': 'סימני שפה מתודיים שמופיעים אצל הפרשן (למשל רמז, פירוש, דרך הפשט) ומרמזים על סגנון עבודה.',
  'מושגי ליבה': 'מושגים חוזרים שמופיעים בתדירות גבוהה במיוחד אצל הפרשן ומשמשים את מרכז החשיבה שלו.',
  'מושגי גישור': 'מושגים שמחברים בין תתי-נושאים בגרף של הפרשן (תפקיד ביניים גבוה ברשת).',
  'זוגות קרובים לפרשן זה': 'הפרשנים עם הדמיון הגבוה ביותר לפרשן הנבחר במבט רוחבי על כל הקורפוס.',
  'מספר מקורות': 'מספר המקורות שבהם לפרשן יש נוכחות בקורפוס.',
  'דמיון ממוצע לרמב"ן': 'ממוצע align של הפרשן מול הרמב"ן לאורך כל המקורות שבהם מופיע הפרשן.',
  'צמתים באגרגציה': 'מספר הצמתים בגרף האגרגטיבי של הפרשן (איחוד כל המקורות).',
  'קשרים באגרגציה': 'מספר הקשתות בגרף האגרגטיבי של הפרשן (איחוד כל המקורות).',
  'פריסה לפי מקורות': 'טבלת מקורות עבור הפרשן: לכל מקור מוצגים דמיון לרמב"ן ומספר מושגים משותפים.',
  'מבט כללי / אשכולות': 'תמונת-על של אשכולות פרשנים, דגלי מקור, זוגות דומים ומסמכי סיכום מחקרי.',
  'חתימות עדים / כתבי יד': 'בדיקת קרבה בין עדי-נוסח/כתבי-יד לפי חתימה מושגית. TWINS מציין זוג עדים קרוב במיוחד.',
  'זוגות דומים מובילים': 'הזוגות בעלי דמיון גבוה במיוחד מתוך מטריצת הדמיון הכוללת בין פרשנים.',
  'מדדי רשת לפי מקור-פרשן (E3)': 'מדדי מבנה גרף לכל זוג מקור-פרשן: גודל, צפיפות, פיצול פנימי ומספר קהילות מושגיות.',
  'ויזואליזציות קיימות ב-DATA (core/full)': 'גלריית מפות מושגים מוכנות לכל פרשן: תצוגת core ממוקדת מול תצוגת full רחבה.',
  'Overlap Viz לפי מקור': 'קישורים לגרפי חפיפה RAMBAN-vs-commentator לכל מקור, כפי שנוצרו בתיקיית overlap_viz.',
  'סטטוס כיסוי (coverage)': 'כיסוי נתונים לפי מקור-פרשן: כמה concepts/free/relations יש והאם הסטטוס תקין (ok/tiny/empty).',
  'דמיון פנימי': 'within_group_sim: ממוצע דמיון בתוך קבוצת עדים/כתבי-יד.',
  'פסק': 'סיווג אוטומטי מול ממוצע הקורפוס (למשל TWINS או NOT close).',
  'צפיפות': 'density: יחס בין מספר קשתות בפועל לבין מספר הקשתות האפשרי בגרף.',
  'רכיבים': 'components: מספר תתי-הגרפים הלא-מחוברים.',
  'ענק': 'giant: גודל הרכיב המחובר הגדול ביותר בגרף.',
  'קהילות': 'communities: מספר אשכולות קהילתיים בגרף לפי אלגוריתם קהילה.',
  'חופשיים': 'free concepts: מושגים פרשניים ללא BiblicalQuotation; אלו המושגים שמשמשים בחישובי הדמיון.',
  'קשרים': 'relations: מספר יחסי הידע שנחלצו בגרף.',
  'סטטוס': 'איכות תוצר הגרף: ok=שימושי, tiny=דל מאוד, empty=ריק.',
  'מסקנות ותובנות כלליות': 'תקציר פרשני של המגמות הבולטות בקורפוס: התכנסות, התפזרות, ודפוסי קרבה בין פרשנים.',
  'גופי ידע שאינם מעוגנים בטקסט': 'ישויות שנחלצו לגרף אך אינן מקושרות ישירות למקטע טקסט מסוים; עשויות לשקף הכללה או רמת הפשטה גבוהה.',
  'מסמכי מקור ופרשנות': 'תקצירי מסמכי המחקר שמסבירים את המתודולוגיה והפרשנות של המדדים המופיעים בדשבורד.',
  'אשכולות פרשנים': 'קבוצות פרשנים שנמצאו קרובות יחסית בדפוסי מושגים לאורך הקורפוס.',
  'זוגות דמיון מובילים': 'זוגות פרשנים עם הדמיון הגבוה ביותר, המשמשים אינדיקציה לקרבה פרשנית.',
  'דגלי איכות וחתכים רוחביים': 'ריכוז מקורות שסומנו בדגלים חריגים כדי לאפשר קריאה ביקורתית מהירה.',
  'גרף גופי ידע טבלאיים': 'המרת גופי ידע לרשת אינטראקטיבית, כדי לראות חיבורים בין מושגים למקורות בצורה חזותית.',
  'מה נוסף מתוך DATA': 'רכיבי מידע נוספים שנוספו לתצוגה כדי להרחיב את הכיסוי מעבר למבט הראשי.',
  'קבוצות חתימה (witness)': 'מספר קבוצות עדים/כתבי-יד שנבדקו ברמת דמיון חתימה.',
  'רשומות מדדי רשת': 'מספר הרשומות הכולל של מדדי מבנה רשת בקורפוס.',
  'פריטי overlap_viz': 'מספר פריטי חפיפה זמינים במבט המקור-פרשן.',
  'קובצי HTML ב-DATA': 'מספר כל קובצי ה-HTML שנמצאו פיזית בתיקיית DATA.',
  'HTML שטרם קוטלגו': 'קובצי HTML שזוהו ב-DATA אך טרם חוברו לקטגוריית תצוגה ייעודית בדשבורד.',
  'מפות חום ומטריצות דמיון': 'תצוגת מטריצה מלאה של דמיון בין כל הפרשנים בקורפוס, עם קידוד צבע לפי עוצמת הקרבה.',
  'קבצי אינדקס, דנדרוגרמות ומדדי חתימה': 'קישורים לארטיפקטי E3 מסכמים (index/dendrogram/matrix) לצורך ביקורת חיצונית מהירה.',
  'מטריצת חתימה (CSV)': 'טבלת דמיון חתימה בין פרשנים/עדים, כפי שהופקה בשלב validation.',
  'ספריית HTML של גרפי E2 (source graph visualizations)': 'מאגר קישורים לכל גרפי ה-HTML הגולמיים של E2 ברמת מקור-פרשן.',
  'קבצי HTML שטרם קוטלגו': 'דוח שקיפות של קבצים שעדיין לא ממופים לתצוגה ייעודית בדשבורד.',
  'אטלס זרימות': 'מפת זרימה אינטראקטיבית שמקשרת בין מקור, פרשן וסטטוס איכות כדי לחשוף דפוסים רוחביים.',
  'גרף זרימות מקור-פרשן-סטטוס': 'כל סרט מייצג נפח ידע (מושגים/חופשיים/קשרים) שעובר ממקור לפרשן ומשם לסטטוס איכות.',
  'משקל זרימה': 'המדד שקובע את עובי הסרט בגרף: concepts, free, או relations.',
  'סינון סטטוס': 'סינון זרימות לפי status של coverage (ok/tiny/empty) לזיהוי אזורים חזקים או חלשים בקורפוס.',
  'Sankey מקורות-מושגים-פרשנים': 'מפת זרימה תלת-שכבתית: כל סרט מתאר מעבר רעיוני ממקור דרך מושג מרכזי אל פרשנים שבהם המושג בולט.',
  'אטלס מושגי דו-שכבתי': 'רשת מושגים בשתי שכבות: מעוגני-טקסט מול לא-מעוגנים, עם הדגשת קישורי גישור בין השכבות.',
  'bridges only': 'מצב תצוגה שמציג רק קישורים שמחברים מושג מעוגן-טקסט למושג לא-מעוגן.',
  'Fingerprint Radar': 'חתימה משווה של פרשן על צירי מדדים מרכזיים, מול רמב"ן בלחיצה אחת.',
  'Timeline Heat Ribbon': 'רצועת חום לפי מקורות שמדגישה דגלי איכות ועוצמת פער, עם מעבר ישיר לחקירה במקור.',
  'Story Mode למקור': 'נרטיב מובנה בן 5 תחנות שמוביל מהדמיון והחריגות ועד משמעות מחקרית של המקור.',
  'ניתוח קורפוס': 'תצוגת מסמכי התובנות המלאים עם מעבר בין גרסאות, קישורי עומק בדשבורד והטמעת גרפים מתיקיית DATA.',
};

function normalizeFieldLabel(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[：:]+$/g, '')
    .trim();
}

function findFieldHelp(label) {
  const clean = normalizeFieldLabel(label);
  if (!clean) return null;
  if (FIELD_HELP[clean]) return FIELD_HELP[clean];

  const keys = Object.keys(FIELD_HELP);
  for (const key of keys) {
    if (clean.includes(key) || key.includes(clean)) {
      return FIELD_HELP[key];
    }
  }

  return 'השדה מתאר מדד מחקרי בהקשר הכרטיס הנוכחי. פרשנותו המדויקת נקבעת לפי יחסי הגומלין עם שאר המדדים באותה טבלה או גרף.';
}

function closeInfoPopovers() {
  document.querySelectorAll('.info-hint.is-open').forEach((elHint) => {
    elHint.classList.remove('is-open');
  });
}

function attachInfoHints(rootEl) {
  if (!rootEl) return;

  const targets = rootEl.querySelectorAll('.card strong, .card th, .card label, .card h3, .card h4, .card summary');
  targets.forEach((target) => {
    if (target.querySelector('.info-hint')) return;
    const label = normalizeFieldLabel(target.textContent);
    const help = findFieldHelp(label);
    if (!help) return;

    const hint = document.createElement('span');
    hint.className = 'info-hint';
    hint.innerHTML = `
      <button type="button" class="info-dot" aria-label="הסבר על ${escapeHtml(label)}">i</button>
      <span class="info-pop" role="tooltip">${escapeHtml(help)}</span>
    `;

    const button = hint.querySelector('.info-dot');
    button.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const isOpen = hint.classList.contains('is-open');
      closeInfoPopovers();
      if (!isOpen) hint.classList.add('is-open');
    });

    target.append(' ', hint);
  });
}

function sectionMetaById(sectionId) {
  return index.sections.find((s) => s.id === sectionId) || null;
}

function commentatorMetaById(commentatorId) {
  return index.commentators.find((c) => c.id === commentatorId) || null;
}

function buildGlobalKnowledgeGraph(knowledgeBodies) {
  const nodes = [];
  const edges = [];
  const topBodies = [...knowledgeBodies].slice(0, 28);
  topBodies.forEach((body, idx) => {
    const id = `kb_${idx}`;
    nodes.push({ id, label: body.label, type: body.type || 'OtherConcept', freq: body.count, instances: body.count });
    (body.sections || []).slice(0, 4).forEach((sectionId) => {
      edges.push({ id: `${id}_${sectionId}`, source: id, target: `sec_${sectionId}`, predicate: 'מופיע-ב', evidenceText: `מקור ${sectionId}` });
    });
  });
  return { nodes, edges };
}

function commentaryColor(indexValue) {
  const palette = ['#7d3f20', '#285c54', '#6d4f82', '#9c6d2a', '#3d5f8a', '#53724f', '#91685d', '#5e6b8a'];
  return palette[indexValue % palette.length];
}

function buildRambanSimilarityGraph(sectionData) {
  const rows = [...(sectionData.pairwise || [])].sort((a, b) => b.align - a.align).slice(0, 14);
  const nodes = [{ id: 'RAMBAN', label: 'רמב"ן', type: 'TheologicalConcept', color: '#7d3f20', freq: 40, instances: 40 }];
  const edges = [];

  rows.forEach((row, idx) => {
    nodes.push({
      id: row.commentatorId,
      label: row.commentatorId,
      type: 'RabbinicAuthority',
      color: commentaryColor(idx),
      freq: row.shared.length + 1,
      instances: row.shared.length + 1,
    });
    edges.push({
      id: `ramban_${row.commentatorId}`,
      source: 'RAMBAN',
      target: row.commentatorId,
      predicate: 'דמיון',
      evidenceText: `מדד דמיון ${formatMetric(row.align, 4)} | ${row.shared.length} מושגים משותפים`,
      weight: row.align,
    });
  });

  return { nodes, edges };
}

function buildCommentatorComparisonGraph(sectionData) {
  const rows = (sectionData.comparisonsBetweenCommentators || []).slice(0, 24);
  const nodeIds = new Set();
  const nodes = [];
  const edges = [];

  rows.forEach((row) => {
    if (!nodeIds.has(row.source)) {
      nodeIds.add(row.source);
      nodes.push({
        id: row.source,
        label: row.source,
        type: 'RabbinicAuthority',
        color: '#285c54',
        freq: 10,
        instances: 10,
      });
    }
    if (!nodeIds.has(row.target)) {
      nodeIds.add(row.target);
      nodes.push({
        id: row.target,
        label: row.target,
        type: 'RabbinicAuthority',
        color: '#6d4f82',
        freq: 10,
        instances: 10,
      });
    }

    edges.push({
      id: `${row.source}_${row.target}`,
      source: row.source,
      target: row.target,
      predicate: 'דמיון',
      evidenceText: `${formatMetric(row.similarity, 4)} | ${row.sharedSample?.slice(0, 4).join(' | ') || 'אין דוגמה'}`,
      weight: row.similarity,
    });
  });

  return { nodes, edges };
}

function buildSimilarityHeatmapRows(sectionData, metricKey) {
  const rows = [...(sectionData.pairwise || [])].sort((a, b) => {
    const metricA = metricKey === 'sharedCount' ? a.shared.length : metricKey === 'uniqueCount' ? a.uniqueCommentary.length : a.align;
    const metricB = metricKey === 'sharedCount' ? b.shared.length : metricKey === 'uniqueCount' ? b.uniqueCommentary.length : b.align;
    return metricB - metricA;
  });

  const maxValue = rows.length
    ? Math.max(...rows.map((row) => (metricKey === 'sharedCount' ? row.shared.length : metricKey === 'uniqueCount' ? row.uniqueCommentary.length : row.align)))
    : 1;

  return rows.map((row) => {
    const value = metricKey === 'sharedCount'
      ? row.shared.length
      : metricKey === 'uniqueCount'
        ? row.uniqueCommentary.length
        : row.align;

    const label = metricKey === 'sharedCount'
      ? `${row.shared.length}`
      : metricKey === 'uniqueCount'
        ? `${row.uniqueCommentary.length}`
        : formatMetric(row.align, 3);

    return {
      ...row,
      value,
      label,
      widthPct: maxValue > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) : 8,
    };
  });
}

function buildGlobalSimilarityMatrix(similarityData) {
  const ids = [...(similarityData?.ids || [])].sort((a, b) => a.localeCompare(b));
  const pairMap = new Map();
  for (const row of (similarityData?.pairs || [])) {
    const key = [row.source, row.target].sort().join('||');
    pairMap.set(key, row.similarity);
  }

  const matrix = ids.map((source) => ({
    source,
    values: ids.map((target) => {
      if (source === target) return 1;
      const key = [source, target].sort().join('||');
      const value = pairMap.get(key);
      return Number.isFinite(value) ? value : null;
    }),
  }));

  return { ids, matrix };
}

function flowMetricValue(row, metric) {
  if (metric === 'concepts') return Number(row.concepts) || 0;
  if (metric === 'relations') return Number(row.relations) || 0;
  return Number(row.free) || 0;
}

function buildFlowAtlasData(coverageRows, metric, statusFilter) {
  const rows = (coverageRows || []).filter((row) => {
    const status = String(row.status || 'unknown').toLowerCase();
    if (statusFilter === 'all') return true;
    return status === statusFilter;
  });

  const nodes = new Map();
  const linksMap = new Map();

  const upsertNode = (id, label, type, column) => {
    const prev = nodes.get(id) || { id, label, type, column, total: 0 };
    nodes.set(id, prev);
    return prev;
  };

  const addLink = (source, target, value, meta) => {
    const key = `${source}=>${target}`;
    const prev = linksMap.get(key) || { source, target, value: 0, meta: [] };
    prev.value += value;
    if (meta) prev.meta.push(meta);
    linksMap.set(key, prev);
  };

  rows.forEach((row) => {
    const value = flowMetricValue(row, metric);
    if (!value) return;
    const section = String(row.section);
    const commentator = String(row.commentator);
    const status = String(row.status || 'unknown').toLowerCase();

    upsertNode(`sec:${section}`, `מקור ${section}`, 'section', 0).total += value;
    upsertNode(`com:${commentator}`, commentator, 'commentator', 1).total += value;
    upsertNode(`sts:${status}`, status, 'status', 2).total += value;

    addLink(`sec:${section}`, `com:${commentator}`, value, { section, commentator, status });
    addLink(`com:${commentator}`, `sts:${status}`, value, { section, commentator, status });
  });

  const nodeList = [...nodes.values()]
    .filter((n) => n.total > 0)
    .sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      return b.total - a.total;
    });

  const keepIds = new Set(nodeList.map((n) => n.id));
  const linkList = [...linksMap.values()].filter((l) => keepIds.has(l.source) && keepIds.has(l.target));
  return { nodes: nodeList, links: linkList };
}

function renderFlowAtlasSvg(container, data, onNodeClick, onLinkClick) {
  const width = Math.max(560, Math.round(container.clientWidth || 940));
  const height = Math.max(520, Math.round(container.clientHeight || 620));
  const padTop = 28;
  const padBottom = 24;
  const sidePad = Math.max(76, Math.min(140, Math.round(width * 0.16)));
  const columnsX = [sidePad, width * 0.5, width - sidePad];
  const colNodes = [0, 1, 2].map((col) => data.nodes.filter((n) => n.column === col));

  const positions = new Map();
  colNodes.forEach((nodesInCol, col) => {
    const area = height - padTop - padBottom;
    const gap = 10;
    const total = nodesInCol.reduce((acc, n) => acc + Math.sqrt(n.total || 1), 0) || 1;
    const scale = Math.max(0.9, (area - Math.max(0, nodesInCol.length - 1) * gap) / total);
    let y = padTop;

    nodesInCol.forEach((node) => {
      const h = Math.max(12, Math.sqrt(node.total || 1) * scale);
      positions.set(node.id, {
        x: columnsX[col],
        y,
        h,
        cx: columnsX[col],
        cy: y + h / 2,
      });
      y += h + gap;
    });
  });

  const maxLinkValue = Math.max(1, ...data.links.map((l) => l.value));

  const nodeRects = data.nodes.map((node) => {
    const pos = positions.get(node.id);
    const cls = node.type === 'section' ? 'flow-node-section' : node.type === 'commentator' ? 'flow-node-commentator' : 'flow-node-status';
    return `
      <g class="flow-node ${cls}" data-node-id="${escapeHtml(node.id)}" data-node-label="${escapeHtml(node.label)}" transform="translate(${pos.x - 56}, ${pos.y})">
        <rect width="112" height="${pos.h.toFixed(1)}" rx="9" ry="9"></rect>
        <text x="56" y="${(pos.h / 2 + 4).toFixed(1)}" text-anchor="middle">${escapeHtml(node.label)}</text>
      </g>
    `;
  }).join('');

  const linkPaths = data.links.map((link, idx) => {
    const from = positions.get(link.source);
    const to = positions.get(link.target);
    if (!from || !to) return '';

    const c1x = from.cx + 120;
    const c2x = to.cx - 120;
    const d = `M ${from.cx + 56} ${from.cy} C ${c1x} ${from.cy}, ${c2x} ${to.cy}, ${to.cx - 56} ${to.cy}`;
    const strokeWidth = Math.max(1.6, (link.value / maxLinkValue) * 18);
    return `<path class="flow-link" data-link-index="${idx}" data-source="${escapeHtml(link.source)}" data-target="${escapeHtml(link.target)}" d="${d}" stroke-width="${strokeWidth.toFixed(2)}"></path>`;
  }).join('');

  container.innerHTML = `
    <svg class="flow-atlas-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="גרף זרימות מקור-פרשן-סטטוס">
      <g class="flow-labels">
        <text x="${columnsX[0]}" y="18" text-anchor="middle">מקורות</text>
        <text x="${columnsX[1]}" y="18" text-anchor="middle">פרשנים</text>
        <text x="${columnsX[2]}" y="18" text-anchor="middle">סטטוס</text>
      </g>
      <g class="flow-links">${linkPaths}</g>
      <g class="flow-nodes">${nodeRects}</g>
    </svg>
  `;

  container.querySelectorAll('.flow-node').forEach((nodeEl) => {
    nodeEl.addEventListener('click', () => {
      const id = nodeEl.getAttribute('data-node-id');
      const row = data.nodes.find((n) => n.id === id);
      if (row) onNodeClick(row);
    });
  });

  container.querySelectorAll('.flow-link').forEach((linkEl) => {
    linkEl.addEventListener('click', () => {
      const idx = Number(linkEl.getAttribute('data-link-index'));
      const row = data.links[idx];
      if (row) onLinkClick(row);
    });
  });
}

function wireDynamicFlowSelection(host, resetBtn, allLinksBtn) {
  if (!host) return;
  const nodeEls = [...host.querySelectorAll('.flow-node')];
  const linkEls = [...host.querySelectorAll('.flow-link')];
  const activeNodes = new Set();

  const apply = () => {
    const showAll = activeNodes.size === 0;

    nodeEls.forEach((nodeEl) => {
      const id = nodeEl.dataset.nodeId;
      const isActive = activeNodes.has(id);
      nodeEl.classList.toggle('is-active', isActive);
      nodeEl.classList.toggle('is-dim', !showAll && !isActive);
    });

    linkEls.forEach((linkEl) => {
      const source = linkEl.dataset.source;
      const target = linkEl.dataset.target;
      const related = showAll || activeNodes.has(source) || activeNodes.has(target);
      const stronglyRelated = !showAll && activeNodes.has(source) && activeNodes.has(target);
      linkEl.classList.toggle('is-dim', !related);
      linkEl.classList.toggle('is-active', stronglyRelated || (related && activeNodes.size === 1 && (activeNodes.has(source) || activeNodes.has(target))));
    });
  };

  nodeEls.forEach((nodeEl) => {
    nodeEl.addEventListener('click', () => {
      const id = nodeEl.dataset.nodeId;
      if (activeNodes.has(id)) activeNodes.delete(id);
      else activeNodes.add(id);
      apply();
    });
  });

  linkEls.forEach((linkEl) => {
    linkEl.addEventListener('click', () => {
      const source = linkEl.dataset.source;
      const target = linkEl.dataset.target;
      if (activeNodes.has(source) && activeNodes.has(target)) {
        activeNodes.clear();
      } else {
        activeNodes.clear();
        activeNodes.add(source);
        activeNodes.add(target);
      }
      apply();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeNodes.clear();
      apply();
    });
  }
  if (allLinksBtn) {
    allLinksBtn.addEventListener('click', () => {
      activeNodes.clear();
      apply();
      host.querySelectorAll('.flow-link').forEach((elLink) => {
        elLink.classList.add('flash-all');
        window.setTimeout(() => elLink.classList.remove('flash-all'), 700);
      });
    });
  }

  apply();
}

async function ensureAllSectionsLoaded() {
  if (app._allSectionsCache) return app._allSectionsCache;
  const loaded = await Promise.all(index.sections.map((meta) => RV2LoadSectionData(meta)));
  app._allSectionsCache = loaded.filter(Boolean);
  return app._allSectionsCache;
}

function topConceptsForSection(sectionData, limit = 4) {
  const concepts = new Map();

  Object.entries(sectionData.graphs || {}).forEach(([commentatorId, graph]) => {
    if (!graph?.nodes) return;
    graph.nodes.forEach((node) => {
      const label = String(node.label || '').trim();
      if (!label || label.length < 2) return;
      const key = RV2StripNiqqud(label).toLowerCase();
      const prev = concepts.get(key) || {
        key,
        label,
        count: 0,
        anchoredCount: 0,
        unanchoredCount: 0,
        commentators: new Map(),
      };
      prev.count += 1;
      const anchored = Array.isArray(node.sourceInstanceIds) && node.sourceInstanceIds.length > 0;
      if (anchored) prev.anchoredCount += 1;
      else prev.unanchoredCount += 1;
      prev.commentators.set(commentatorId, (prev.commentators.get(commentatorId) || 0) + 1);
      concepts.set(key, prev);
    });
  });

  return [...concepts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

async function buildSankeyConceptData() {
  if (app._sankeyConceptCache) return app._sankeyConceptCache;

  const sections = await ensureAllSectionsLoaded();
  const linksMap = new Map();
  const nodes = new Map();

  const addNode = (id, label, column, type) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, column, type, total: 0 });
    return nodes.get(id);
  };

  const addLink = (source, target, value, meta) => {
    const key = `${source}=>${target}`;
    const prev = linksMap.get(key) || { source, target, value: 0, meta: [] };
    prev.value += value;
    if (meta) prev.meta.push(meta);
    linksMap.set(key, prev);
  };

  sections.forEach((sectionData) => {
    const concepts = topConceptsForSection(sectionData, 5);
    const sectionId = sectionData.id;
    const secNode = addNode(`sec:${sectionId}`, `מקור ${sectionId}`, 0, 'section');

    concepts.forEach((concept) => {
      const conceptId = `cn:${concept.key.slice(0, 80)}`;
      const conceptNode = addNode(conceptId, concept.label, 1, 'concept');
      const conceptWeight = Math.max(1, concept.count);
      secNode.total += conceptWeight;
      conceptNode.total += conceptWeight;
      addLink(secNode.id, conceptNode.id, conceptWeight, {
        sectionId,
        concept: concept.label,
      });

      [...concept.commentators.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .forEach(([commentatorId, cnt]) => {
          const comNode = addNode(`com:${commentatorId}`, commentatorId, 2, 'commentator');
          comNode.total += cnt;
          addLink(conceptNode.id, comNode.id, cnt, {
            sectionId,
            concept: concept.label,
            commentatorId,
          });
        });
    });
  });

  const data = {
    nodes: [...nodes.values()].sort((a, b) => a.column - b.column || b.total - a.total),
    links: [...linksMap.values()],
  };
  app._sankeyConceptCache = data;
  return data;
}

async function buildDualLayerConceptAtlas() {
  if (app._dualLayerAtlasCache) return app._dualLayerAtlasCache;

  const sections = await ensureAllSectionsLoaded();
  const nodeMap = new Map();
  const edgeMap = new Map();

  const ensureNode = (key, label, anchored, typeHint) => {
    const prev = nodeMap.get(key) || {
      id: `atlas:${key.slice(0, 120)}`,
      key,
      label,
      anchoredHits: 0,
      unanchoredHits: 0,
      count: 0,
      typeHint,
    };
    prev.count += 1;
    if (anchored) prev.anchoredHits += 1;
    else prev.unanchoredHits += 1;
    nodeMap.set(key, prev);
    return prev;
  };

  sections.forEach((sectionData) => {
    Object.values(sectionData.graphs || {}).forEach((graph) => {
      const local = new Map();
      (graph.nodes || []).forEach((node) => {
        const label = String(node.label || '').trim();
        if (!label || label.length < 2) return;
        const key = RV2StripNiqqud(label).toLowerCase();
        const anchored = Array.isArray(node.sourceInstanceIds) && node.sourceInstanceIds.length > 0;
        const saved = ensureNode(key, label, anchored, node.type || 'OtherConcept');
        local.set(node.id, saved.key);
      });

      (graph.edges || []).forEach((edge) => {
        const sKey = local.get(edge.source);
        const tKey = local.get(edge.target);
        if (!sKey || !tKey || sKey === tKey) return;
        const key = `${sKey}=>${tKey}=>${edge.predicate || 'relatedTo'}`;
        const prev = edgeMap.get(key) || { sKey, tKey, predicate: edge.predicate || 'relatedTo', weight: 0 };
        prev.weight += 1;
        edgeMap.set(key, prev);
      });
    });
  });

  const topNodes = [...nodeMap.values()].sort((a, b) => b.count - a.count).slice(0, 140);
  const keep = new Set(topNodes.map((n) => n.key));
  const nodes = topNodes.map((n) => ({
    id: n.id,
    label: n.label,
    anchored: n.anchoredHits >= n.unanchoredHits,
    type: n.anchoredHits >= n.unanchoredHits ? 'TheologicalConcept' : 'OtherConcept',
    freq: n.count,
    instances: n.count,
  }));

  const keyToId = new Map(topNodes.map((n) => [n.key, n.id]));
  const edges = [...edgeMap.values()]
    .filter((e) => keep.has(e.sKey) && keep.has(e.tKey))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 260)
    .map((e, idx) => {
      const source = keyToId.get(e.sKey);
      const target = keyToId.get(e.tKey);
      const sNode = nodes.find((n) => n.id === source);
      const tNode = nodes.find((n) => n.id === target);
      const bridge = !!(sNode && tNode && sNode.anchored !== tNode.anchored);
      return {
        id: `atlas_edge_${idx}`,
        source,
        target,
        predicate: bridge ? 'bridge' : e.predicate,
        evidenceText: bridge ? 'קישור גישור בין שכבה מעוגנת לשכבה לא-מעוגנת' : e.predicate,
        weight: e.weight,
        bridge,
      };
    })
    .filter((e) => e.source && e.target);

  app._dualLayerAtlasCache = { nodes, edges };
  return app._dualLayerAtlasCache;
}

function normalizeSeries(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  return values.map((v) => {
    if (!Number.isFinite(v)) return 0;
    if (max === min) return 1;
    return (v - min) / (max - min);
  });
}

async function buildFingerprintDataset() {
  if (app._fingerprintCache) return app._fingerprintCache;

  const sections = await ensureAllSectionsLoaded();
  const metricsRows = index.global?.corpusGraphMetricsRows || [];
  const coherenceRows = index.sections || [];

  const densityByCom = {};
  const communitiesByCom = {};
  metricsRows.forEach((row) => {
    const id = String(row.commentator);
    densityByCom[id] = densityByCom[id] || [];
    communitiesByCom[id] = communitiesByCom[id] || [];
    densityByCom[id].push(Number(row.density) || 0);
    communitiesByCom[id].push(Number(row.communities) || 0);
  });

  const sharedByCom = {};
  const uniqueByCom = {};
  let rambanSharedVals = [];
  let rambanUniqueVals = [];

  sections.forEach((sectionData) => {
    (sectionData.pairwise || []).forEach((row) => {
      const id = String(row.commentatorId);
      const shared = (row.shared || []).length;
      const uniqueC = (row.uniqueCommentary || []).length;
      const uniqueR = (row.uniqueRamban || []).length;
      const denomC = shared + uniqueC;
      const denomR = shared + uniqueR;

      if (denomC > 0) {
        sharedByCom[id] = sharedByCom[id] || [];
        uniqueByCom[id] = uniqueByCom[id] || [];
        sharedByCom[id].push(shared / denomC);
        uniqueByCom[id].push(uniqueC / denomC);
      }
      if (denomR > 0) {
        rambanSharedVals.push(shared / denomR);
        rambanUniqueVals.push(uniqueR / denomR);
      }
    });
  });

  const bridgeConceptCount = {};
  (index.commentators || []).forEach((meta) => {
    const row = (window.RAMBAN_V2_COMMENTATORS?.[meta.id]?.structureProfile) || null;
    const raw = String(row?.bridge_concepts || row?.bridgeConcepts || '');
    const count = raw ? raw.split(';').map((x) => x.trim()).filter(Boolean).length : 0;
    bridgeConceptCount[meta.id] = count;
  });

  const rambanPeriph = coherenceRows
    .map((s) => Number(s.metrics?.rambanPeriphRank))
    .filter((v) => Number.isFinite(v));
  const rambanPeriphAvg = rambanPeriph.length ? rambanPeriph.reduce((a, b) => a + b, 0) / rambanPeriph.length : 0;

  const ids = [...new Set([...index.commentators.map((c) => c.id), 'RAMBAN'])];
  const rows = ids.map((id) => {
    const commentatorMeta = commentatorMetaById(id);
    const align = id === 'RAMBAN'
      ? 1
      : Number(commentatorMeta?.avgAlignVsRamban || window.RAMBAN_V2_COMMENTATORS?.[id]?.avgAlignVsRamban || 0);
    const density = average(densityByCom[id] || [0]);
    const communities = average(communitiesByCom[id] || [0]);
    const sharedRatio = id === 'RAMBAN' ? average(rambanSharedVals || [0]) : average(sharedByCom[id] || [0]);
    const uniqueRatio = id === 'RAMBAN' ? average(rambanUniqueVals || [0]) : average(uniqueByCom[id] || [0]);
    const peripheral = id === 'RAMBAN' ? rambanPeriphAvg : (bridgeConceptCount[id] || 0);
    return { id, align, density, communities, sharedRatio, uniqueRatio, peripheral };
  });

  const aligned = {
    align: normalizeSeries(rows.map((r) => r.align)),
    density: normalizeSeries(rows.map((r) => r.density)),
    communities: normalizeSeries(rows.map((r) => r.communities)),
    sharedRatio: normalizeSeries(rows.map((r) => r.sharedRatio)),
    uniqueRatio: normalizeSeries(rows.map((r) => r.uniqueRatio)),
    peripheral: normalizeSeries(rows.map((r) => r.peripheral)),
  };

  const data = rows.map((row, idx) => ({
    id: row.id,
    raw: row,
    axes: {
      align: aligned.align[idx],
      density: aligned.density[idx],
      communities: aligned.communities[idx],
      sharedRatio: aligned.sharedRatio[idx],
      uniqueRatio: aligned.uniqueRatio[idx],
      peripheral: aligned.peripheral[idx],
    },
  }));

  app._fingerprintCache = data;
  return data;
}

function buildTimelineRibbonData() {
  return [...index.sections]
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
    .map((row) => ({
      sectionId: row.id,
      flag: String(row.metrics.flag || 'normal'),
      gap: Number(row.metrics.gap) || 0,
      coherence: Number(row.metrics.rambanCoherence) || 0,
    }));
}

function polarPoint(cx, cy, radius, ratio, idx, total) {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * idx) / total);
  return {
    x: cx + (radius * ratio * Math.cos(angle)),
    y: cy + (radius * ratio * Math.sin(angle)),
  };
}

function radarPolygonPoints(cx, cy, radius, axesValues) {
  const entries = Object.entries(axesValues);
  return entries.map(([, value], idx) => {
    const p = polarPoint(cx, cy, radius, value, idx, entries.length);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

function renderFingerprintRadar(host, primary, baseline) {
  const axes = [
    ['align', 'align'],
    ['density', 'density'],
    ['communities', 'communities'],
    ['sharedRatio', 'shared ratio'],
    ['uniqueRatio', 'unique ratio'],
    ['peripheral', 'peripheral rank'],
  ];
  const width = 520;
  const height = 360;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 122;

  const rings = [0.25, 0.5, 0.75, 1].map((r) => {
    const points = axes.map((_, idx) => {
      const p = polarPoint(cx, cy, radius, r, idx, axes.length);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    return `<polygon class="radar-ring" points="${points}"></polygon>`;
  }).join('');

  const spokes = axes.map(([, label], idx) => {
    const p = polarPoint(cx, cy, radius, 1, idx, axes.length);
    const t = polarPoint(cx, cy, radius + 26, 1, idx, axes.length);
    return `
      <line class="radar-spoke" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"></line>
      <text class="radar-axis-label" x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" text-anchor="middle">${label}</text>
    `;
  }).join('');

  const primaryPoints = radarPolygonPoints(cx, cy, radius, primary.axes);
  const baselinePoints = radarPolygonPoints(cx, cy, radius, baseline.axes);

  host.innerHTML = `
    <svg class="radar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Fingerprint Radar">
      <g>${rings}</g>
      <g>${spokes}</g>
      <polygon class="radar-fill-baseline" points="${baselinePoints}"></polygon>
      <polygon class="radar-fill-primary" points="${primaryPoints}"></polygon>
    </svg>
  `;
}

function storyMeaning(flag, gap) {
  if (String(flag || '').includes('FAN-OUT')) {
    return 'הממצאים מצביעים על פיזור רעיוני: הפרשנים נוגעים במשפחות מושגים שונות יחסית לרמב"ן.';
  }
  if (String(flag || '').includes('CONVERGENCE')) {
    return 'הממצאים מצביעים על התכנסות תת-מסורתית: קבוצת פרשנים קרובה זה לזה ואף לרמב"ן בחלק מהמושגים.';
  }
  if (String(flag || '').includes('THIN')) {
    return 'המקור דל יחסית במושגי רמב"ן ולכן יש להיזהר מהסקת יתר.';
  }
  if ((Number(gap) || 0) > 0.08) {
    return 'הפער החיובי הגבוה מרמז שהפרשנים מפוצלים יותר ביחס לקרבתם לרמב"ן.';
  }
  return 'המקור מציג איזון יחסי בין קרבה לרמב"ן לבין ההסכמה הפנימית בין הפרשנים.';
}

function buildSectionStory(sectionData) {
  const top = [...(sectionData.pairwise || [])].sort((a, b) => b.align - a.align)[0] || null;
  const outlier = [...(sectionData.pairwise || [])].sort((a, b) => a.align - b.align)[0] || null;
  const bestPair = (sectionData.comparisonsBetweenCommentators || [])[0] || null;
  return {
    top,
    outlier,
    bestPair,
    meaning: storyMeaning(sectionData.metrics.flag, sectionData.metrics.gap),
  };
}

function buildPairResearchGraph(sectionData, sourceId, targetId) {
  const pair = (sectionData.comparisonsBetweenCommentators || []).find(
    (row) => (row.source === sourceId && row.target === targetId) || (row.source === targetId && row.target === sourceId)
  ) || null;
  const sharedTerms = pair ? (pair.sharedSample || []).slice(0, 10) : [];

  const nodes = [
    { id: sourceId, label: sourceId, type: 'RabbinicAuthority', color: commentaryColor(0), freq: 12, instances: 12 },
    { id: targetId, label: targetId, type: 'RabbinicAuthority', color: commentaryColor(1), freq: 12, instances: 12 },
  ];
  const edges = [
    {
      id: `${sourceId}_${targetId}`,
      source: sourceId,
      target: targetId,
      predicate: 'דמיון בין פרשנים',
      evidenceText: pair ? `דמיון ${formatMetric(pair.similarity, 4)}` : 'לא נמצא זוג בנתונים',
      weight: pair ? pair.similarity : 0.08,
      color: pair ? '#7d3f20' : '#9b8a76',
    },
  ];

  sharedTerms.forEach((term, idx) => {
    const termId = `shared_${idx}_${term.replace(/\s+/g, '_').slice(0, 32)}`;
    nodes.push({
      id: termId,
      label: term,
      type: idx % 2 === 0 ? 'TheologicalConcept' : 'OtherConcept',
      color: idx % 2 === 0 ? '#4b7a78' : '#6d4f82',
      freq: 4,
      instances: 4,
    });
    edges.push({
      id: `${sourceId}_${termId}`,
      source: sourceId,
      target: termId,
      predicate: 'מושג משותף',
      evidenceText: term,
      weight: 0.28,
      color: '#285c54',
    });
    edges.push({
      id: `${targetId}_${termId}`,
      source: targetId,
      target: termId,
      predicate: 'מושג משותף',
      evidenceText: term,
      weight: 0.28,
      color: '#285c54',
    });
  });

  return { nodes, edges, pair };
}

function activateTab(tabName) {
  app.currentTab = tabName;
  el.tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle('is-active', active);
  });
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('is-active'));

  if (tabName === 'by-source') el.sourceView.classList.add('is-active');
  if (tabName === 'by-commentator') el.commentatorView.classList.add('is-active');
  if (tabName === 'flow-atlas') el.flowAtlasView.classList.add('is-active');
  if (tabName === 'overview') el.overviewView.classList.add('is-active');
  if (tabName === 'corpus-analysis') el.corpusAnalysisView.classList.add('is-active');
  if (tabName === 'data-archive') el.dataArchiveView.classList.add('is-active');
}

function topItemsFromStatString(raw, limit = 6) {
  return String(raw || '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function renderDataArchive() {
  const coverageRows = (index.global?.coverageRows || []).slice(0, 24);
  const graphMetricRows = (index.global?.corpusGraphMetricsRows || []).slice(0, 30);
  const witnessRows = index.global?.signatureValidationRows || [];
  const signatureMatrixRows = index.global?.signatureMatrixRows || [];
  const visuals = Object.values((index.global?.commentatorVisuals || []).reduce((acc, item) => {
    if (!acc[item.id]) acc[item.id] = item;
    return acc;
  }, {}));
  const overlapRows = index.global?.overlapVisuals || [];
  const e2GraphVisualizations = index.global?.e2GraphVisualizations || [];
  const visualIndexes = index.global?.visualIndexes || {};
  const dendrograms = index.global?.dendrograms || {};
  const htmlCoverage = index.global?.htmlCoverage || {};
  const seenPairs = new Set();
  const similarityPairs = (index.global?.commentatorSimilarity?.pairs || [])
    .filter((row) => {
      const key = [row.source, row.target].sort().join('||');
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .slice(0, 20);
  const matrixData = buildGlobalSimilarityMatrix(index.global?.commentatorSimilarity || {});

  el.dataArchiveView.innerHTML = `
    <div class="card">
      <h2>מה נוסף מתוך DATA</h2>
      <p class="muted">כאן מוצגים פריטי נתונים ומסקנות שהיו קיימים בתיקיית DATA אך לא נחשפו באופן ברור בדשבורד הראשי.</p>
      <div class="stats-grid">
        <div><strong>זוגות דמיון בין פרשנים</strong><span>${escapeHtml(index.global?.commentatorSimilarity?.pairs?.length ?? 0)}</span></div>
        <div><strong>קבוצות חתימה (witness)</strong><span>${escapeHtml(witnessRows.length)}</span></div>
        <div><strong>רשומות מדדי רשת</strong><span>${escapeHtml(index.global?.corpusGraphMetricsRows?.length ?? 0)}</span></div>
        <div><strong>פריטי overlap_viz</strong><span>${escapeHtml(overlapRows.reduce((acc, x) => acc + (x.items?.length || 0), 0))}</span></div>
        <div><strong>קובצי HTML ב-DATA</strong><span>${escapeHtml(htmlCoverage.totalHtmlInData ?? 0)}</span></div>
        <div><strong>HTML שטרם קוטלגו</strong><span>${escapeHtml(htmlCoverage.uncataloguedHtmlCount ?? 0)}</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>מפות חום ומטריצות דמיון</h3>
        <p class="muted">תצוגה מלאה של מטריצת דמיון בין פרשנים מתוך DATA (מעבר לרשימת top pairs).</p>
        <div class="table-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>פרשן</th>
                ${matrixData.ids.map((id) => `<th><button class="link-btn" data-archive-commentator="${escapeHtml(id)}">${escapeHtml(id)}</button></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${matrixData.matrix.map((row) => `
                <tr>
                  <td><button class="link-btn" data-archive-commentator="${escapeHtml(row.source)}">${escapeHtml(row.source)}</button></td>
                  ${row.values.map((v) => {
                    const numeric = Number(v);
                    const alpha = Number.isFinite(numeric) ? Math.max(0.08, Math.min(0.92, numeric)) : 0.04;
                    const bg = Number.isFinite(numeric) ? `rgba(11, 143, 132, ${alpha})` : 'rgba(180, 190, 190, 0.18)';
                    return `<td class="matrix-cell" style="background:${bg}">${Number.isFinite(numeric) ? formatMetric(numeric, 2) : '-'}</td>`;
                  }).join('')}
                </tr>
              `).join('') || '<tr><td>אין נתונים</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>קבצי אינדקס, דנדרוגרמות ומדדי חתימה</h3>
        <p class="muted">גישה ישירה לארטיפקטים שמופקים ב-E3 ואינם חלק מתצוגת ברירת המחדל.</p>
        <p><strong>Index commentator viz:</strong> ${visualIndexes.commentatorVizHtml ? `<a href="${escapeHtml(visualIndexes.commentatorVizHtml)}" target="_blank" rel="noopener">פתיחה</a>` : '-'}</p>
        <p><strong>Index overlap viz:</strong> ${visualIndexes.overlapVizHtml ? `<a href="${escapeHtml(visualIndexes.overlapVizHtml)}" target="_blank" rel="noopener">פתיחה</a>` : '-'}</p>
        <p><strong>Dendrogram matrices:</strong> ${dendrograms.matrices ? `<a href="${escapeHtml(dendrograms.matrices)}" target="_blank" rel="noopener">PNG</a>` : '-'}</p>
        <p><strong>Dendrogram signature:</strong> ${dendrograms.signature ? `<a href="${escapeHtml(dendrograms.signature)}" target="_blank" rel="noopener">PNG</a>` : '-'}</p>
        <h4>מטריצת חתימה (CSV)</h4>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                ${Object.keys(signatureMatrixRows[0] || {}).slice(0, 8).map((k) => `<th>${escapeHtml(k)}</th>`).join('') || '<th>אין עמודות</th>'}
              </tr>
            </thead>
            <tbody>
              ${(signatureMatrixRows.slice(0, 12).map((row) => `
                <tr>
                  ${Object.keys(signatureMatrixRows[0] || {}).slice(0, 8).map((k) => `<td>${escapeHtml(row[k])}</td>`).join('')}
                </tr>
              `).join('')) || '<tr><td>אין נתונים</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>חתימות עדים / כתבי יד</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>קבוצה</th><th>חברים</th><th>דמיון פנימי</th><th>פסק</th></tr>
            </thead>
            <tbody>
              ${witnessRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.group)}</td>
                  <td>${escapeHtml(row.members_present)}</td>
                  <td>${escapeHtml(row.within_group_sim)}</td>
                  <td>${escapeHtml(row.verdict)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">אין נתונים</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>זוגות דומים מובילים</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>פרשן א</th><th>פרשן ב</th><th>דמיון</th></tr>
            </thead>
            <tbody>
              ${similarityPairs.map((row) => `
                <tr>
                  <td><button class="link-btn" data-archive-commentator="${escapeHtml(row.source)}">${escapeHtml(row.source)}</button></td>
                  <td><button class="link-btn" data-archive-commentator="${escapeHtml(row.target)}">${escapeHtml(row.target)}</button></td>
                  <td>${formatMetric(row.similarity, 4)}</td>
                </tr>
              `).join('') || '<tr><td colspan="3">אין נתונים</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>מדדי רשת לפי מקור-פרשן (E3)</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>מקור</th><th>פרשן</th><th>צמתים</th><th>קשתות</th><th>צפיפות</th><th>רכיבים</th><th>ענק</th><th>קהילות</th></tr>
          </thead>
          <tbody>
            ${graphMetricRows.map((row) => `
              <tr data-archive-section="${escapeHtml(row.section)}" data-archive-commentator="${escapeHtml(row.commentator)}">
                <td><button class="link-btn" data-archive-section="${escapeHtml(row.section)}">${escapeHtml(row.section)}</button></td>
                <td><button class="link-btn" data-archive-commentator="${escapeHtml(row.commentator)}">${escapeHtml(row.commentator)}</button></td>
                <td>${escapeHtml(row.nodes)}</td>
                <td>${escapeHtml(row.edges)}</td>
                <td>${escapeHtml(row.density)}</td>
                <td>${escapeHtml(row.components)}</td>
                <td>${escapeHtml(row.giant)}</td>
                <td>${escapeHtml(row.communities)}</td>
              </tr>
            `).join('') || '<tr><td colspan="8">אין נתונים</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>ויזואליזציות קיימות ב-DATA (core/full)</h3>
      <div class="archive-viz-grid">
        ${visuals.map((entry) => {
          const core = entry.core;
          const full = entry.full;
          return `
            <article class="doc-card">
              <h4>${escapeHtml(entry.id)}</h4>
              <p><strong>Core:</strong> ${core?.html ? `<a href="${escapeHtml(core.html)}" target="_blank" rel="noopener">HTML</a>` : '-'} ${core?.png ? `| <a href="${escapeHtml(core.png)}" target="_blank" rel="noopener">PNG</a>` : ''} ${core?.svg ? `| <a href="${escapeHtml(core.svg)}" target="_blank" rel="noopener">SVG</a>` : ''}</p>
              <p><strong>Full:</strong> ${full?.html ? `<a href="${escapeHtml(full.html)}" target="_blank" rel="noopener">HTML</a>` : '-'} ${full?.png ? `| <a href="${escapeHtml(full.png)}" target="_blank" rel="noopener">PNG</a>` : ''} ${full?.svg ? `| <a href="${escapeHtml(full.svg)}" target="_blank" rel="noopener">SVG</a>` : ''}</p>
            </article>
          `;
        }).join('') || '<p class="muted">לא נמצאו ויזואליזציות.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>Overlap Viz לפי מקור</h3>
      <div class="archive-overlap-list">
        ${overlapRows.map((row) => {
          const items = Object.values((row.items || []).reduce((acc, item) => {
            if (!acc[item.commentatorId]) acc[item.commentatorId] = item;
            return acc;
          }, {})).slice(0, 16);
          return `
            <details class="doc-card">
              <summary>מקור ${escapeHtml(row.sectionId)} (${items.length} פריטים)</summary>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>פרשן</th><th>קובץ HTML</th><th>קובץ JSON</th></tr></thead>
                  <tbody>
                    ${items.map((item) => `
                      <tr>
                        <td>${escapeHtml(item.commentatorId)}</td>
                        <td>${item.html ? `<a href="${escapeHtml(item.html)}" target="_blank" rel="noopener">פתיחה</a>` : '-'}</td>
                        <td>${item.json ? `<a href="${escapeHtml(item.json)}" target="_blank" rel="noopener">JSON</a>` : '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </details>
          `;
        }).join('') || '<p class="muted">לא נמצאו קבצי overlap.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>ספריית HTML של גרפי E2 (source graph visualizations)</h3>
      <p class="muted">גישה ישירה לכל קובץ HTML של גרף מקור-פרשן מתוך E2, כולל קפיצה מהירה למקור ולפרשן בדשבורד.</p>
      <div class="archive-overlap-list">
        ${Object.entries(e2GraphVisualizations.reduce((acc, row) => {
          if (!acc[row.sectionId]) acc[row.sectionId] = [];
          acc[row.sectionId].push(row);
          return acc;
        }, {})).map(([sectionId, rows]) => `
          <details class="doc-card">
            <summary>מקור ${escapeHtml(sectionId)} (${rows.length} קבצי HTML)</summary>
            <div class="table-wrap">
              <table>
                <thead><tr><th>פרשן</th><th>קישור HTML</th><th>ניווט בדשבורד</th></tr></thead>
                <tbody>
                  ${rows.slice(0, 30).map((row) => `
                    <tr>
                      <td>${escapeHtml(row.commentatorId)}</td>
                      <td><a href="${escapeHtml(row.html)}" target="_blank" rel="noopener">פתיחה</a></td>
                      <td>
                        <button class="link-btn" data-archive-section="${escapeHtml(row.sectionId)}">מקור</button>
                        <button class="link-btn" data-archive-commentator="${escapeHtml(row.commentatorId)}">פרשן</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </details>
        `).join('') || '<p class="muted">לא נמצאו קבצי HTML ב-E2.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>קבצי HTML שטרם קוטלגו</h3>
      <p class="muted">דוח שקיפות: אם יש כאן רשומות, אלו קבצי HTML ב-DATA שעדיין לא מוצגים כארטיפקטים ייעודיים.</p>
      <ul class="findings-list">
        ${(htmlCoverage.uncataloguedSample || []).map((row) => `<li><a href="${escapeHtml(row)}" target="_blank" rel="noopener">${escapeHtml(row)}</a></li>`).join('') || '<li>אין פערים מדווחים במדגם.</li>'}
      </ul>
    </div>

    <div class="card">
      <h3>סטטוס כיסוי (coverage)</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>מקור</th><th>פרשן</th><th>מושגים</th><th>חופשיים</th><th>קשרים</th><th>סטטוס</th></tr>
          </thead>
          <tbody>
            ${coverageRows.map((row) => `
              <tr>
                <td><button class="link-btn" data-archive-section="${escapeHtml(row.section)}">${escapeHtml(row.section)}</button></td>
                <td><button class="link-btn" data-archive-commentator="${escapeHtml(row.commentator)}">${escapeHtml(row.commentator)}</button></td>
                <td>${escapeHtml(row.concepts)}</td>
                <td>${escapeHtml(row.free)}</td>
                <td>${escapeHtml(row.relations)}</td>
                <td>${escapeHtml(row.status)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6">אין נתונים</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  el.dataArchiveView.querySelectorAll('button[data-archive-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentCommentatorId = btn.dataset.archiveCommentator;
      activateTab('by-commentator');
      await renderByCommentator();
    });
  });

  el.dataArchiveView.querySelectorAll('button[data-archive-section]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentSectionId = btn.dataset.archiveSection;
      app.currentGraphCommentator = 'RAMBAN';
      activateTab('by-source');
      await renderBySource();
    });
  });

  attachInfoHints(el.dataArchiveView);
}

async function renderFlowAtlas() {
  const rows = index.global?.coverageRows || [];
  const [sankeyData, dualAtlas, fingerprints] = await Promise.all([
    buildSankeyConceptData(),
    buildDualLayerConceptAtlas(),
    buildFingerprintDataset(),
  ]);
  const flowData = buildFlowAtlasData(rows, app.flowMetric, app.flowStatusFilter);
  const timeline = buildTimelineRibbonData();
  const totalFlow = flowData.links.reduce((acc, row) => acc + row.value, 0);

  const primary = fingerprints.find((x) => x.id === app.currentCommentatorId) || fingerprints.find((x) => x.id !== 'RAMBAN') || fingerprints[0];
  const baseline = fingerprints.find((x) => x.id === app.radarCommentatorId) || fingerprints.find((x) => x.id === 'RAMBAN') || fingerprints[0];

  el.flowAtlasView.innerHTML = `
    <div class="card">
      <h2>אטלס זרימות</h2>
      <p class="muted">חבילת ויזואליזציות מחקרית: Sankey רעיוני, אטלס דו-שכבתי, Fingerprint Radar, ורצועת זמן איכותית.</p>
      <div class="stats-grid">
        <div><strong>זרימות פעילות</strong><span>${flowData.links.length}</span></div>
        <div><strong>צמתים פעילים</strong><span>${flowData.nodes.length}</span></div>
        <div><strong>נפח מצטבר</strong><span>${formatMetric(totalFlow, 0)}</span></div>
      </div>
    </div>

    <div class="card">
      <h3>Sankey מקורות-מושגים-פרשנים</h3>
      <div class="inline-controls wrap">
        <button type="button" class="link-btn" id="sankey-reset-selection">נקה הדגשות</button>
        <button type="button" class="link-btn" id="sankey-show-all">הצג את כלל הזרימות</button>
      </div>
      <div class="flow-atlas-host" id="sankey-concept-host"></div>
      <div class="detail-box" id="sankey-concept-detail">לחץ על צמתים/זרימות כדי להדגיש מסלולים, לחץ שוב כדי לכבות, או הצג את כלל הזרימות.</div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>אטלס מושגי דו-שכבתי</h3>
        <div class="inline-controls wrap">
          <button type="button" class="link-btn" id="atlas-bridges-only">${app.atlasBridgesOnly ? 'הצג את כל הקישורים' : 'bridges only'}</button>
        </div>
        <div class="graph-host" id="dual-layer-host"></div>
        <div class="detail-box" id="dual-layer-detail">שכבה א: מעוגני-טקסט. שכבה ב: לא-מעוגנים. מצב bridges-only מציג רק קשרי גישור.</div>
      </div>

      <div class="card">
        <h3>Fingerprint Radar</h3>
        <div class="inline-controls wrap">
          <label for="radar-primary">פרשן</label>
          <select id="radar-primary">
            ${fingerprints.map((row) => `<option value="${escapeHtml(row.id)}" ${row.id === primary.id ? 'selected' : ''}>${escapeHtml(row.id)}</option>`).join('')}
          </select>
          <label for="radar-baseline">השוואה מול</label>
          <select id="radar-baseline">
            ${fingerprints.map((row) => `<option value="${escapeHtml(row.id)}" ${row.id === baseline.id ? 'selected' : ''}>${escapeHtml(row.id)}</option>`).join('')}
          </select>
        </div>
        <div id="radar-host"></div>
        <p class="muted">הערכים מנורמלים יחסית לכלל הקורפוס על פני 6 מדדים.</p>
      </div>
    </div>

    <div class="card">
      <h3>Timeline Heat Ribbon</h3>
      <p class="muted">פס חום רציף לפי מקורות ודגלי איכות. לחיצה על מקור פותחת חקירה מלאה במבט המקור.</p>
      <div class="timeline-ribbon" id="timeline-ribbon">
        ${timeline.map((row) => {
          const flag = row.flag || 'normal';
          const gapAbs = Math.min(1, Math.abs(row.gap || 0) / 0.2);
          const tone = flag.includes('FAN-OUT')
            ? `rgba(239, 126, 86, ${0.28 + gapAbs * 0.62})`
            : flag.includes('CONVERGENCE')
              ? `rgba(15, 118, 110, ${0.28 + gapAbs * 0.62})`
              : flag.includes('THIN')
                ? `rgba(170, 130, 70, ${0.28 + gapAbs * 0.62})`
                : `rgba(104, 125, 132, ${0.2 + gapAbs * 0.45})`;
          return `<button class="timeline-segment" data-timeline-section="${escapeHtml(row.sectionId)}" title="${escapeHtml(row.sectionId)} | ${escapeHtml(flag)} | gap=${formatMetric(row.gap, 3)}" style="background:${tone}">${escapeHtml(row.sectionId)}</button>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <h3>גרף זרימות מקור-פרשן-סטטוס</h3>
      <div class="inline-controls wrap">
        <label for="flow-metric">משקל זרימה</label>
        <select id="flow-metric">
          <option value="free" ${app.flowMetric === 'free' ? 'selected' : ''}>חופשיים (free concepts)</option>
          <option value="concepts" ${app.flowMetric === 'concepts' ? 'selected' : ''}>מושגים (concepts)</option>
          <option value="relations" ${app.flowMetric === 'relations' ? 'selected' : ''}>קשרים (relations)</option>
        </select>
        <label for="flow-status">סינון סטטוס</label>
        <select id="flow-status">
          <option value="all" ${app.flowStatusFilter === 'all' ? 'selected' : ''}>הכל</option>
          <option value="ok" ${app.flowStatusFilter === 'ok' ? 'selected' : ''}>ok</option>
          <option value="tiny" ${app.flowStatusFilter === 'tiny' ? 'selected' : ''}>tiny</option>
          <option value="empty" ${app.flowStatusFilter === 'empty' ? 'selected' : ''}>empty</option>
        </select>
      </div>
      <div class="flow-atlas-host" id="flow-atlas-host"></div>
      <div class="detail-box" id="flow-atlas-detail">לחץ על צומת או סרט כדי לקבל פירוש מחקרי וניווט מהיר.</div>
    </div>
  `;

  const flowHost = el.flowAtlasView.querySelector('#flow-atlas-host');
  const flowDetail = el.flowAtlasView.querySelector('#flow-atlas-detail');
  const sankeyHost = el.flowAtlasView.querySelector('#sankey-concept-host');
  const sankeyDetail = el.flowAtlasView.querySelector('#sankey-concept-detail');
  const sankeyResetBtn = el.flowAtlasView.querySelector('#sankey-reset-selection');
  const sankeyAllBtn = el.flowAtlasView.querySelector('#sankey-show-all');

  renderFlowAtlasSvg(sankeyHost, sankeyData, async (node) => {
    if (node.type === 'section') {
      const sectionId = node.id.replace('sec:', '');
      sankeyDetail.innerHTML = `<h4>${escapeHtml(node.label)}</h4><p><strong>עוצמת מושגים:</strong> ${formatMetric(node.total, 0)}</p><p><button class="link-btn" data-flow-open-section="${escapeHtml(sectionId)}">חקירה לפי מקור</button></p>`;
    } else if (node.type === 'commentator') {
      const commentatorId = node.id.replace('com:', '');
      sankeyDetail.innerHTML = `<h4>${escapeHtml(node.label)}</h4><p><strong>נוכחות רעיונית:</strong> ${formatMetric(node.total, 0)}</p><p><button class="link-btn" data-flow-open-commentator="${escapeHtml(commentatorId)}">חקירה לפי פרשן</button></p>`;
    } else {
      sankeyDetail.innerHTML = `<h4>מושג מרכזי</h4><p><strong>${escapeHtml(node.label)}</strong></p><p>המושג מחבר בין מקורות שונים לפרשנים שונים.</p>`;
    }

    sankeyDetail.querySelectorAll('button[data-flow-open-section]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        app.currentSectionId = btn.dataset.flowOpenSection;
        app.currentGraphCommentator = 'RAMBAN';
        activateTab('by-source');
        await renderBySource();
      });
    });
    sankeyDetail.querySelectorAll('button[data-flow-open-commentator]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        app.currentCommentatorId = btn.dataset.flowOpenCommentator;
        activateTab('by-commentator');
        await renderByCommentator();
      });
    });
  }, (link) => {
    const sample = link.meta?.[0] || null;
    sankeyDetail.innerHTML = `<h4>זרימה רעיונית</h4><p><strong>נפח:</strong> ${formatMetric(link.value, 0)}</p><p>${sample ? `${escapeHtml(sample.sectionId || sample.section || '')} | ${escapeHtml(sample.concept || '')} | ${escapeHtml(sample.commentatorId || '')}` : 'ללא דוגמה'}</p>`;
  });
  wireDynamicFlowSelection(sankeyHost, sankeyResetBtn, sankeyAllBtn);

  renderFlowAtlasSvg(flowHost, flowData, async (node) => {
    if (node.type === 'section') {
      const sectionId = node.id.replace('sec:', '');
      flowDetail.innerHTML = `<h4>${escapeHtml(node.label)}</h4><p><strong>נפח כולל:</strong> ${formatMetric(node.total, 0)}</p><p><button class="link-btn" data-flow-open-section="${escapeHtml(sectionId)}">פתיחה בלשונית מקור</button></p>`;
    } else if (node.type === 'commentator') {
      const commentatorId = node.id.replace('com:', '');
      flowDetail.innerHTML = `<h4>${escapeHtml(node.label)}</h4><p><strong>נפח כולל:</strong> ${formatMetric(node.total, 0)}</p><p><button class="link-btn" data-flow-open-commentator="${escapeHtml(commentatorId)}">פתיחה בלשונית פרשן</button></p>`;
    } else {
      flowDetail.innerHTML = `<h4>סטטוס ${escapeHtml(node.label)}</h4><p><strong>נפח כולל:</strong> ${formatMetric(node.total, 0)}</p><p>סטטוס זה מאפשר לזהות במהירות אזורי חוזק/חולשה של הכיסוי בקורפוס.</p>`;
    }

    flowDetail.querySelectorAll('button[data-flow-open-section]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        app.currentSectionId = btn.dataset.flowOpenSection;
        app.currentGraphCommentator = 'RAMBAN';
        activateTab('by-source');
        await renderBySource();
      });
    });
    flowDetail.querySelectorAll('button[data-flow-open-commentator]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        app.currentCommentatorId = btn.dataset.flowOpenCommentator;
        activateTab('by-commentator');
        await renderByCommentator();
      });
    });
  }, (link) => {
    const sample = link.meta?.[0] || null;
    flowDetail.innerHTML = `<h4>זרימה</h4><p><strong>נפח זרימה:</strong> ${formatMetric(link.value, 0)}</p><p><strong>דוגמה:</strong> ${sample ? `${escapeHtml(sample.section)} | ${escapeHtml(sample.commentator)} | ${escapeHtml(sample.status)}` : 'אין דוגמה'}</p>`;
  });

  const atlasDetail = el.flowAtlasView.querySelector('#dual-layer-detail');
  const atlasEdges = app.atlasBridgesOnly ? dualAtlas.edges.filter((e) => e.bridge) : dualAtlas.edges;
  const keepIds = new Set(atlasEdges.flatMap((e) => [e.source, e.target]));
  const atlasNodes = dualAtlas.nodes.filter((n) => keepIds.has(n.id));
  RV2RenderGraph(el.flowAtlasView.querySelector('#dual-layer-host'), { nodes: atlasNodes, edges: atlasEdges }, {
    onNodeClick: (node) => {
      atlasDetail.innerHTML = `<h4>מושג</h4><p><strong>${escapeHtml(node.label)}</strong></p><p><strong>שכבה:</strong> ${node.anchored ? 'מעוגן טקסט' : 'לא מעוגן'}</p>`;
    },
    onEdgeClick: (edge) => {
      atlasDetail.innerHTML = `<h4>קישור מושגי</h4><p><strong>${escapeHtml(edge.source)} -> ${escapeHtml(edge.target)}</strong></p><p><strong>סוג:</strong> ${escapeHtml(edge.predicate)}</p><p><strong>עוצמה:</strong> ${formatMetric(edge.weight, 0)}</p>`;
    },
  });

  const radarHost = el.flowAtlasView.querySelector('#radar-host');
  renderFingerprintRadar(radarHost, primary, baseline);

  el.flowAtlasView.querySelector('#atlas-bridges-only').addEventListener('click', async () => {
    app.atlasBridgesOnly = !app.atlasBridgesOnly;
    await renderFlowAtlas();
  });

  el.flowAtlasView.querySelector('#flow-metric').addEventListener('change', async (ev) => {
    app.flowMetric = ev.target.value;
    await renderFlowAtlas();
  });
  el.flowAtlasView.querySelector('#flow-status').addEventListener('change', async (ev) => {
    app.flowStatusFilter = ev.target.value;
    await renderFlowAtlas();
  });
  el.flowAtlasView.querySelector('#radar-primary').addEventListener('change', async (ev) => {
    app.currentCommentatorId = ev.target.value;
    await renderFlowAtlas();
  });
  el.flowAtlasView.querySelector('#radar-baseline').addEventListener('change', async (ev) => {
    app.radarCommentatorId = ev.target.value;
    await renderFlowAtlas();
  });

  el.flowAtlasView.querySelectorAll('button[data-timeline-section]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentSectionId = btn.dataset.timelineSection;
      app.currentGraphCommentator = 'RAMBAN';
      activateTab('by-source');
      await renderBySource();
    });
  });

  attachInfoHints(el.flowAtlasView);
}

function joinNormalizedPath(basePath, relPath) {
  const base = String(basePath || '').replace(/\\/g, '/');
  const rel = String(relPath || '').replace(/\\/g, '/');
  if (!rel) return base;
  if (/^(?:https?:|mailto:|#)/i.test(rel)) return rel;
  if (rel.startsWith('/')) return rel;

  const root = base.endsWith('/') ? base : `${base}/`;
  const tokens = `${root}${rel}`.split('/');
  const resolved = [];
  tokens.forEach((token) => {
    if (!token || token === '.') return;
    if (token === '..') {
      if (resolved.length && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else {
        resolved.push('..');
      }
      return;
    }
    resolved.push(token);
  });
  return resolved.join('/');
}

function resolveCorpusAssetUrl(doc, rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (/^(?:https?:|mailto:|#)/i.test(url)) return url;
  if (/^(?:\.{0,2}\/)?overlap_viz\//i.test(url)) {
    return joinNormalizedPath('./corpus_assets', url.replace(/^\.?\/?/, ''));
  }
  if (/^(?:\.{0,2}\/)?commentator\/viz\//i.test(url)) {
    return joinNormalizedPath('./corpus_assets', url.replace(/^\.?\/?/, ''));
  }
  if (/^(?:\.{0,2}\/)?(?:overlap_viz|commentator\/viz|matrices|pairwise|commentator\/signature)\//i.test(url)) {
    return joinNormalizedPath(index.source?.e3 || '../Data/E3_comparative_analysis', url.replace(/^\.?\/?/, ''));
  }
  if (url.startsWith('../Data/') || url.startsWith('./data/') || url.startsWith('data/')) return url;
  return joinNormalizedPath(doc?.baseDirRelPath || index.source?.e3 || '../Data/E3_comparative_analysis', url);
}

function extractCorpusActions(rawUrl) {
  const source = String(rawUrl || '');
  const sectionMatch = source.match(/overlap_viz\/([^/]+)/i);
  const commentatorMatch = source.match(/commentator\/viz\/core\/([^/_]+(?:_[^/_]+)*)_core\.(?:png|svg|html)$/i);
  const actions = [];
  if (sectionMatch) {
    actions.push(`<button type="button" class="link-btn" data-corpus-open-section="${escapeHtml(sectionMatch[1])}">פתח מקור ${escapeHtml(sectionMatch[1])} בדשבורד</button>`);
  }
  if (commentatorMatch) {
    actions.push(`<button type="button" class="link-btn" data-corpus-open-commentator="${escapeHtml(commentatorMatch[1])}">פתח פרשן בדשבורד</button>`);
  }
  return actions.join('');
}

function formatInlineMarkdown(rawText, doc) {
  const text = String(rawText || '');
  const imageOrLinkRe = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  const out = [];

  const formatPlain = (chunk) => {
    let safe = escapeHtml(chunk);
    safe = safe.replace(/`([^`]+)`/g, (_, token) => {
      const candidate = String(token || '').trim();
      if (!candidate) return '<code></code>';
      const isPathLike = /(commentator\/viz\/|overlap_viz\/|\.(?:png|svg|html|json|csv)|^matrices\/)/i.test(candidate);
      if (!isPathLike) return `<code>${escapeHtml(candidate)}</code>`;
      const href = resolveCorpusAssetUrl(doc, candidate);
      const actionButtons = extractCorpusActions(candidate);
      return `${actionButtons}<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="corpus-inline-link">${escapeHtml(candidate)}</a>`;
    });
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return safe;
  };

  for (const match of text.matchAll(imageOrLinkRe)) {
    const idx = match.index || 0;
    out.push(formatPlain(text.slice(last, idx)));
    if (match[1] !== undefined) {
      out.push(renderCorpusImage(match[1], match[2], doc));
    } else {
      out.push(renderCorpusLink(match[3], match[4], doc));
    }
    last = idx + match[0].length;
  }
  out.push(formatPlain(text.slice(last)));
  return out.join('');
}

function renderCorpusLink(label, rawUrl, doc) {
  const safeLabel = escapeHtml(label || rawUrl || 'קישור');
  const href = resolveCorpusAssetUrl(doc, rawUrl);
  const actions = extractCorpusActions(rawUrl);

  return `${actions}<a href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="פתיחת קישור: ${safeLabel}">${safeLabel}</a>`;
}

function renderCorpusImage(altText, rawUrl, doc) {
  const alt = escapeHtml(altText || 'Corpus image');
  const src = resolveCorpusAssetUrl(doc, rawUrl);
  const actionButtons = extractCorpusActions(rawUrl);

  return `
    <figure class="corpus-figure">
      <a href="${escapeHtml(src)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />
      </a>
      <figcaption>${alt}${actionButtons ? `<span class="corpus-figure-actions">${actionButtons}</span>` : ''}</figcaption>
    </figure>
  `;
}

function slugifyHeading(text) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s\-_.]+/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return base || 'section';
}

function extractAssetCodePathsFromText(text) {
  const matches = [];
  const pattern = /`([^`]+)`/g;
  for (const match of String(text || '').matchAll(pattern)) {
    const raw = String(match[1] || '').trim();
    if (!raw) continue;
    const isImagePath = /(commentator\/viz\/core\/|overlap_viz\/|\.png$|\.svg$|\.jpg$|\.jpeg$|\.webp$)/i.test(raw);
    if (!isImagePath) continue;
    matches.push(raw);
  }
  return [...new Set(matches)];
}

function renderInlineAssetEmbeds(text, doc) {
  const paths = extractAssetCodePathsFromText(text);
  if (!paths.length) return '';

  return paths.map((rawPath) => {
    if (/\.(?:png|svg|jpg|jpeg|webp)$/i.test(rawPath)) {
      const fileName = rawPath.split('/').pop() || 'diagram';
      const label = fileName.replace(/[_-]+/g, ' ').replace(/\.[^.]+$/, '');
      return renderCorpusImage(`תרשים: ${label}`, rawPath, doc);
    }
    const href = resolveCorpusAssetUrl(doc, rawPath);
    return `
      <div class="corpus-asset-card">
        <p><strong>קישור דינמי:</strong> ${escapeHtml(rawPath)}</p>
        ${extractCorpusActions(rawPath)}
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="corpus-inline-link">פתח ארטיפקט</a>
      </div>
    `;
  }).join('');
}

function parseMarkdownTable(lines, startIndex, doc) {
  const headerRow = lines[startIndex] || '';
  const separatorRow = lines[startIndex + 1] || '';
  if (!headerRow.includes('|') || !/^\s*\|?\s*[:\-]+/.test(separatorRow)) return null;

  const splitRow = (row) => row
    .split('|')
    .map((cell) => cell.trim())
    .filter((_, idx, arr) => !(idx === 0 && arr[0] === '') && !(idx === arr.length - 1 && arr[arr.length - 1] === ''));

  const headers = splitRow(headerRow);
  const bodyRows = [];
  let cursor = startIndex + 2;
  while (cursor < lines.length && lines[cursor].includes('|')) {
    bodyRows.push(splitRow(lines[cursor]));
    cursor += 1;
  }

  const html = `
    <div class="table-wrap corpus-table-wrap">
      <table>
        <thead><tr>${headers.map((cell) => `<th>${formatInlineMarkdown(cell, doc)}</th>`).join('')}</tr></thead>
        <tbody>
          ${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${formatInlineMarkdown(cell, doc)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  return { html, endIndex: cursor - 1 };
}

function renderMarkdownDocument(markdown, doc) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  const toc = [];
  const usedHeadingIds = new Set();
  let inCode = false;
  let listType = null;

  const closeList = () => {
    if (!listType) return;
    chunks.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      closeList();
      if (!inCode) {
        inCode = true;
        chunks.push('<pre class="corpus-code"><code>');
      } else {
        inCode = false;
        chunks.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      chunks.push(`${escapeHtml(line)}\n`);
      continue;
    }

    const table = parseMarkdownTable(lines, i, doc);
    if (table) {
      closeList();
      chunks.push(table.html);
      i = table.endIndex;
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(6, heading[1].length);
      const titleRaw = heading[2];
      const titleHtml = formatInlineMarkdown(titleRaw, doc);
      const baseId = `toc-${slugifyHeading(titleRaw)}`;
      let headingId = baseId;
      let iDup = 2;
      while (usedHeadingIds.has(headingId)) {
        headingId = `${baseId}-${iDup}`;
        iDup += 1;
      }
      usedHeadingIds.add(headingId);
      toc.push({ id: headingId, title: titleRaw, level });
      chunks.push(`<h${level} id="${escapeHtml(headingId)}">${titleHtml}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeList();
      chunks.push('<hr />');
      continue;
    }

    if (trimmed.startsWith('>')) {
      closeList();
      const quoteText = trimmed.replace(/^>\s?/, '');
      chunks.push(`<blockquote>${formatInlineMarkdown(quoteText, doc)}</blockquote>`);
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        chunks.push('<ul class="findings-list">');
      }
      chunks.push(`<li>${formatInlineMarkdown(ul[1], doc)}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        chunks.push('<ol class="story-list">');
      }
      chunks.push(`<li>${formatInlineMarkdown(ol[1], doc)}</li>`);
      continue;
    }

    closeList();
    chunks.push(`<p>${formatInlineMarkdown(trimmed, doc)}</p>${renderInlineAssetEmbeds(trimmed, doc)}`);
  }

  closeList();
  if (inCode) chunks.push('</code></pre>');
  return { html: chunks.join('\n'), toc };
}

function buildTocTree(toc) {
  if (!toc.length) return [];
  const minLevel = Math.min(...toc.map((item) => item.level));
  const root = { level: minLevel - 1, children: [] };
  const stack = [root];

  toc.forEach((item) => {
    const node = { ...item, children: [] };
    while (stack.length > 1 && item.level <= stack[stack.length - 1].level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });

  return root.children;
}

function renderTocNodes(nodes, depth = 0) {
  if (!nodes?.length) return '';
  return `
    <ul class="corpus-toc-tree depth-${depth}">
      ${nodes.map((node) => {
        const title = escapeHtml(node.title);
        const href = `#${escapeHtml(node.id)}`;
        if (node.children?.length) {
          return `
            <li class="toc-lvl-${Math.min(6, node.level)}">
              <details class="corpus-toc-group" ${depth < 1 ? 'open' : ''}>
                <summary><a href="${href}">${title}</a></summary>
                ${renderTocNodes(node.children, depth + 1)}
              </details>
            </li>
          `;
        }
        return `<li class="toc-lvl-${Math.min(6, node.level)}"><a href="${href}">${title}</a></li>`;
      }).join('')}
    </ul>
  `;
}

function buildCorpusTocHtml(toc) {
  if (!toc.length) return '<p class="muted">אין כותרות להצגה.</p>';
  const tree = buildTocTree(toc);
  return renderTocNodes(tree, 0);
}

function renderCorpusAnalysis() {
  const docs = (index.global?.corpusDocuments || []).filter((d) => d && d.content);
  if (!docs.length) {
    el.corpusAnalysisView.innerHTML = `
      <div class="card">
        <h2>ניתוח קורפוס</h2>
        <p class="muted">לא נמצאו קבצי ניתוח קורפוס מלאים באינדקס הנתונים. הרץ את סקריפט הבנייה כדי לטעון את המסמכים המלאים.</p>
      </div>
    `;
    return;
  }

  if (!app.currentCorpusDocId || !docs.some((doc) => doc.id === app.currentCorpusDocId)) {
    app.currentCorpusDocId = docs[0].id;
  }

  const selected = docs.find((doc) => doc.id === app.currentCorpusDocId) || docs[0];
  const docSwitcher = docs.map((doc) => `
    <button type="button" class="tab corpus-doc-tab ${doc.id === selected.id ? 'is-active' : ''}" data-corpus-doc="${escapeHtml(doc.id)}" aria-pressed="${doc.id === selected.id ? 'true' : 'false'}">
      ${escapeHtml(doc.audienceLabel || doc.title)}
    </button>
  `).join('');

  const renderedDoc = renderMarkdownDocument(selected.content, selected);
  const tocHtml = buildCorpusTocHtml(renderedDoc.toc || []);
  const selectedLang = selected.language || (selected.id === 'he-accessible' ? 'he' : 'en');
  const selectedDir = selected.direction || (selectedLang === 'he' ? 'rtl' : 'ltr');
  el.corpusAnalysisView.innerHTML = `
    <div class="card">
      <h2>ניתוח קורפוס</h2>
      <p class="muted">מעבר בין שתי גרסאות תוכן מקבילות, עם קישורי עומק פנימיים והטמעת גרפים מתוך DATA.</p>
      <div class="inline-controls wrap corpus-doc-switcher" role="tablist" aria-label="בחירת גרסת ניתוח קורפוס">${docSwitcher}</div>
      <div class="stats-grid">
        <div><strong>מסמך פעיל</strong><span>${escapeHtml(selected.title || selected.fileName)}</span></div>
        <div><strong>קובץ מקור</strong><span><a href="${escapeHtml(selected.relPath)}" target="_blank" rel="noopener">${escapeHtml(selected.fileName)}</a></span></div>
        <div><strong>תקציר</strong><span>${escapeHtml(selected.summary || '-')}</span></div>
      </div>
    </div>
    <div class="card corpus-doc-card">
      <div class="corpus-layout">
        <aside class="corpus-toc" aria-label="תוכן עניינים">
          <h3>תוכן עניינים</h3>
          <a href="#corpus-doc-top" class="corpus-top-link">קפיצה לראש המסמך</a>
          ${tocHtml}
        </aside>
        <article id="corpus-doc-top" class="corpus-doc-content" lang="${escapeHtml(selectedLang)}" dir="${escapeHtml(selectedDir)}">
          ${renderedDoc.html}
        </article>
      </div>
      <button type="button" class="corpus-back-top" aria-label="חזרה לראש העמוד">חזרה לראש העמוד</button>
    </div>
  `;

  el.corpusAnalysisView.querySelectorAll('button[data-corpus-doc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.currentCorpusDocId = btn.dataset.corpusDoc;
      renderCorpusAnalysis();
    });
  });

  el.corpusAnalysisView.querySelectorAll('button[data-corpus-open-section]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentSectionId = btn.dataset.corpusOpenSection;
      app.currentGraphCommentator = 'RAMBAN';
      activateTab('by-source');
      await renderBySource();
    });
  });

  el.corpusAnalysisView.querySelectorAll('button[data-corpus-open-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentCommentatorId = btn.dataset.corpusOpenCommentator;
      activateTab('by-commentator');
      await renderByCommentator();
    });
  });

  el.corpusAnalysisView.querySelectorAll('.corpus-toc a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (ev) => {
      const href = anchor.getAttribute('href');
      const target = href ? document.querySelector(href) : null;
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', href);
    });
  });

  const backTopBtn = el.corpusAnalysisView.querySelector('.corpus-back-top');
  if (backTopBtn) {
    backTopBtn.addEventListener('click', () => {
      const topTarget = el.corpusAnalysisView.querySelector('#corpus-doc-top');
      if (topTarget) topTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.body?.scrollTo) document.body.scrollTo({ top: 0, behavior: 'smooth' });
      if (el.corpusAnalysisView?.scrollTo) el.corpusAnalysisView.scrollTo({ top: 0, behavior: 'smooth' });
      const contentEl = el.corpusAnalysisView.querySelector('.corpus-doc-content');
      if (contentEl?.scrollTo) contentEl.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  attachInfoHints(el.corpusAnalysisView);
}

function attachGlobalEvents() {
  el.tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      activateTab(tab.dataset.tab);
      if (tab.dataset.tab === 'flow-atlas') {
        await renderFlowAtlas();
      }
      if (tab.dataset.tab === 'corpus-analysis') {
        renderCorpusAnalysis();
      }
    });
  });
}

async function renderBySource() {
  const sectionOptions = index.sections
    .map((s) => `<option value="${escapeHtml(s.id)}" ${s.id === app.currentSectionId ? 'selected' : ''}>מקור ${escapeHtml(s.id)}</option>`)
    .join('');

  el.sourceView.innerHTML = `
    <div class="card controls-card">
      <label for="source-select">בחירת מקור</label>
      <select id="source-select">${sectionOptions}</select>
    </div>
    <div class="card" id="source-summary"></div>
    <div class="card" id="source-table"></div>
    <div class="card" id="source-comparison-graph-block"></div>
    <div class="source-focus-grid">
      <div class="card" id="source-graph-block"></div>
      <div class="card" id="source-text-block"></div>
    </div>
  `;

  el.sourceView.querySelector('#source-select').addEventListener('change', async (ev) => {
    app.currentSectionId = ev.target.value;
    app.currentGraphCommentator = 'RAMBAN';
    await renderBySource();
  });

  const meta = sectionMetaById(app.currentSectionId);
  if (!meta) return;

  const data = await RV2LoadSectionData(meta);
  if (!app.selectedPairCommentator && data.pairwise[0]) {
    app.selectedPairCommentator = data.pairwise[0].commentatorId;
  }
  const sourceStory = buildSectionStory(data);

  const summary = el.sourceView.querySelector('#source-summary');
  summary.innerHTML = `
    <h2>מקור ${escapeHtml(data.id)}</h2>
    <div class="stats-grid">
      <div><strong>קרבת פרשנים לרמב"ן</strong><span>${formatMetric(data.metrics.rambanCoherence)}</span></div>
      <div><strong>הסכמה בין פרשנים</strong><span>${formatMetric(data.metrics.commentatorAgreement)}</span></div>
      <div><strong>פער</strong><span>${formatMetric(data.metrics.gap)}</span></div>
      <div><strong>דגל איכות</strong><span>${escapeHtml(data.metrics.flag || 'ללא')}</span></div>
      <div><strong>מספר פרשנים</strong><span>${escapeHtml(data.metrics.nCommentators)}</span></div>
      <div><strong>צמתי רמב"ן</strong><span>${escapeHtml(data.metrics.rambanConcepts)}</span></div>
    </div>
    <h3>Story Mode למקור</h3>
    <ol class="story-list">
      <li>
        <strong>מי קרוב לרמב"ן:</strong>
        ${sourceStory.top ? `${escapeHtml(sourceStory.top.commentatorId)} (${formatMetric(sourceStory.top.align, 3)})` : 'אין נתון'}
        ${sourceStory.top ? `<button class="link-btn" data-story-commentator="${escapeHtml(sourceStory.top.commentatorId)}">חקור פרשן</button>` : ''}
      </li>
      <li>
        <strong>מי חריג:</strong>
        ${sourceStory.outlier ? `${escapeHtml(sourceStory.outlier.commentatorId)} (${formatMetric(sourceStory.outlier.align, 3)})` : 'אין נתון'}
        ${sourceStory.outlier ? `<button class="link-btn" data-story-commentator="${escapeHtml(sourceStory.outlier.commentatorId)}">חקור פרשן</button>` : ''}
      </li>
      <li>
        <strong>אילו מושגים משותפים:</strong>
        ${escapeHtml((sourceStory.bestPair?.sharedSample || []).slice(0, 8).join(' | ') || 'אין דוגמה זמינה')}
      </li>
      <li>
        <strong>מה ייחודי:</strong>
        ${escapeHtml((sourceStory.outlier?.uniqueCommentary || []).slice(0, 6).join(' | ') || 'אין דוגמת ייחוד מובהקת')}
      </li>
      <li>
        <strong>מה המשמעות המחקרית:</strong>
        ${escapeHtml(sourceStory.meaning)}
      </li>
    </ol>
  `;

  summary.querySelectorAll('button[data-story-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentCommentatorId = btn.dataset.storyCommentator;
      app.currentGraphCommentator = btn.dataset.storyCommentator;
      app.selectedPairCommentator = btn.dataset.storyCommentator;
      await renderBySource();
    });
  });

  const table = el.sourceView.querySelector('#source-table');
  const heatmapRows = buildSimilarityHeatmapRows(data, app.sourceSimilarityMetric);
  const sorted = RV2SortByNumeric(data.pairwise, app.sourceSortKey, true);
  const filtered = RV2FilterRows(sorted, (row) => {
    if (!app.sourceFilterText) return true;
    return normalizedString(row.commentatorId).includes(normalizedString(app.sourceFilterText));
  });

  const rows = filtered
    .map((p) => `
      <tr data-commentator="${escapeHtml(p.commentatorId)}" class="${p.commentatorId === app.selectedPairCommentator ? 'is-selected' : ''}">
        <td>${escapeHtml(p.commentatorId)}</td>
        <td>${formatMetric(p.align)}</td>
        <td>${p.shared.length}</td>
        <td>${p.uniqueCommentary.length}</td>
      </tr>
    `)
    .join('');

  table.innerHTML = `
    <h3>טבלת דמיון (רמב"ן מול פרשנים)</h3>
    <div class="inline-controls">
      <label for="source-filter">סינון פרשן</label>
      <input id="source-filter" value="${escapeHtml(app.sourceFilterText)}" placeholder="הקלד שם פרשן" />
      <label for="source-sort">מיון לפי</label>
      <select id="source-sort">
        <option value="align" ${app.sourceSortKey === 'align' ? 'selected' : ''}>מדד דמיון</option>
        <option value="sharedCount" ${app.sourceSortKey === 'sharedCount' ? 'selected' : ''}>מושגים משותפים</option>
        <option value="uniqueCount" ${app.sourceSortKey === 'uniqueCount' ? 'selected' : ''}>מושגים ייחודיים</option>
      </select>
    </div>
    <div class="heatmap-toolbar">
      <label for="source-heatmap-metric">תצוגה</label>
      <select id="source-heatmap-metric">
        <option value="align" ${app.sourceSimilarityMetric === 'align' ? 'selected' : ''}>דמיון רמב"ן מול פרשנים</option>
        <option value="sharedCount" ${app.sourceSimilarityMetric === 'sharedCount' ? 'selected' : ''}>מושגים משותפים</option>
        <option value="uniqueCount" ${app.sourceSimilarityMetric === 'uniqueCount' ? 'selected' : ''}>מושגים ייחודיים</option>
      </select>
    </div>
    <div class="source-heatmap" id="source-heatmap"></div>
  `;

  const heatmapBlock = table.querySelector('#source-heatmap');
  heatmapBlock.innerHTML = heatmapRows.map((row) => {
    const intensity = row.label === '-' ? 0 : Number(row.value) || 0;
    const tone = app.sourceSimilarityMetric === 'align'
      ? `rgba(125, 63, 32, ${Math.min(0.85, 0.15 + intensity)})`
      : app.sourceSimilarityMetric === 'sharedCount'
        ? `rgba(40, 92, 84, ${Math.min(0.85, 0.15 + intensity / 12)})`
        : `rgba(109, 79, 130, ${Math.min(0.85, 0.15 + intensity / 35)})`;
    return `
      <button class="heatmap-row ${row.commentatorId === app.selectedPairCommentator ? 'is-selected' : ''}" data-heat-commentator="${escapeHtml(row.commentatorId)}" title="${escapeHtml(row.commentatorId)}">
        <span class="heatmap-label">${escapeHtml(row.commentatorId)}</span>
        <span class="heatmap-bar" style="width:${row.widthPct}%; background:${tone}"></span>
        <span class="heatmap-value">${escapeHtml(row.label)}</span>
      </button>
    `;
  }).join('');

  table.querySelector('#source-heatmap-metric').addEventListener('change', async (ev) => {
    app.sourceSimilarityMetric = ev.target.value;
    await renderBySource();
  });

  heatmapBlock.querySelectorAll('button[data-heat-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.selectedPairCommentator = btn.dataset.heatCommentator;
      await renderBySource();
    });
  });

  const comparisonGraphBlock = el.sourceView.querySelector('#source-comparison-graph-block');
  comparisonGraphBlock.innerHTML = `
    <h3>השוואה בין פרשנים בתוך מקור</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>פרשן א</th>
            <th>פרשן ב</th>
            <th>דמיון ביניהם</th>
            <th>דוגמת מושגים משותפים</th>
          </tr>
        </thead>
        <tbody>
          ${data.comparisonsBetweenCommentators.slice(0, 12).map((row) => `
            <tr data-pair-source="${escapeHtml(row.source)}" data-pair-target="${escapeHtml(row.target)}">
              <td><button class="link-btn" data-commentator="${escapeHtml(row.source)}">${escapeHtml(row.source)}</button></td>
              <td><button class="link-btn" data-commentator="${escapeHtml(row.target)}">${escapeHtml(row.target)}</button></td>
              <td>${formatMetric(row.similarity)}</td>
              <td>${escapeHtml((row.sharedSample || []).slice(0, 4).join(' | ') || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="graph-host graph-host-tall" id="source-comparison-graph-host"></div>
    <div class="detail-box" id="source-comparison-graph-detail">לחץ על צומת או קשר כדי לראות את חיבורי הדמיון בין פרשנים.</div>
  `;

  comparisonGraphBlock.querySelectorAll('tbody tr[data-pair-source]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const pair = data.comparisonsBetweenCommentators.find(
        (row) => row.source === tr.dataset.pairSource && row.target === tr.dataset.pairTarget
      );
      if (!pair) return;
      comparisonGraphBlock.querySelector('#source-comparison-graph-detail').innerHTML = `
        <h4>זוג פרשנים</h4>
        <p><strong>פרשן א:</strong> ${escapeHtml(pair.source)}</p>
        <p><strong>פרשן ב:</strong> ${escapeHtml(pair.target)}</p>
        <p><strong>דמיון:</strong> ${formatMetric(pair.similarity)}</p>
        <p><strong>מושגים משותפים:</strong> ${escapeHtml((pair.sharedSample || []).join(' | ') || 'אין')}</p>
      `;
    });
  });

  table.querySelector('#source-filter').addEventListener('input', async (ev) => {
    app.sourceFilterText = ev.target.value;
    await renderBySource();
  });

  table.querySelector('#source-sort').addEventListener('change', async (ev) => {
    const raw = ev.target.value;
    if (raw === 'align') app.sourceSortKey = 'align';
    if (raw === 'sharedCount') {
      data.pairwise.forEach((row) => {
        row.sharedCount = row.shared.length;
      });
      app.sourceSortKey = 'sharedCount';
    }
    if (raw === 'uniqueCount') {
      data.pairwise.forEach((row) => {
        row.uniqueCount = row.uniqueCommentary.length;
      });
      app.sourceSortKey = 'uniqueCount';
    }
    await renderBySource();
  });

  table.querySelectorAll('tbody tr[data-commentator]').forEach((tr) => {
    tr.addEventListener('click', async () => {
      app.currentCommentatorId = tr.dataset.commentator;
      app.currentGraphCommentator = tr.dataset.commentator;
      app.selectedPairCommentator = tr.dataset.commentator;
      await renderBySource();
    });
  });

  table.querySelectorAll('button[data-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentCommentatorId = btn.dataset.commentator;
      activateTab('by-commentator');
      await renderByCommentator();
    });
  });

  const comparisonGraph = buildCommentatorComparisonGraph(data);
  RV2RenderGraph(comparisonGraphBlock.querySelector('#source-comparison-graph-host'), comparisonGraph, {
    onNodeClick: (node) => {
      comparisonGraphBlock.querySelector('#source-comparison-graph-detail').innerHTML = `
        <h4>צומת פרשן</h4>
        <p><strong>שם:</strong> ${escapeHtml(node.label)}</p>
        <p><strong>חיבורים:</strong> ${comparisonGraph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length}</p>
      `;
    },
    onEdgeClick: (edge) => {
      comparisonGraphBlock.querySelector('#source-comparison-graph-detail').innerHTML = `
        <h4>קשר בין פרשנים</h4>
        <p><strong>מה מחובר למה:</strong> ${escapeHtml(edge.source)} -> ${escapeHtml(edge.target)}</p>
        <p><strong>דמיון:</strong> ${escapeHtml(edge.evidenceText)}</p>
      `;
    },
  });

  const pairSelectRow = document.createElement('div');
  pairSelectRow.className = 'inline-controls wrap';
  pairSelectRow.innerHTML = `
    <label for="pair-source-select">פרשן א</label>
    <select id="pair-source-select">
      ${data.commentators.map((c) => `<option value="${escapeHtml(c)}" ${c === (app.sourceComparisonSource || data.commentators[0]) ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
    </select>
    <label for="pair-target-select">פרשן ב</label>
    <select id="pair-target-select">
      ${data.commentators.map((c) => `<option value="${escapeHtml(c)}" ${c === (app.sourceComparisonTarget || data.commentators[1] || data.commentators[0]) ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
    </select>
  `;
  comparisonGraphBlock.prepend(pairSelectRow);

  const pairGraphRender = () => {
    const sourceId = pairSelectRow.querySelector('#pair-source-select').value;
    const targetId = pairSelectRow.querySelector('#pair-target-select').value;
    app.sourceComparisonSource = sourceId;
    app.sourceComparisonTarget = targetId;
    const pairGraph = buildPairResearchGraph(data, sourceId, targetId);
    const detailEl = comparisonGraphBlock.querySelector('#source-comparison-graph-detail');
    if (pairGraph.pair) {
      detailEl.innerHTML = `
        <h4>זוג נבחר</h4>
        <p><strong>פרשן א:</strong> ${escapeHtml(sourceId)}</p>
        <p><strong>פרשן ב:</strong> ${escapeHtml(targetId)}</p>
        <p><strong>דמיון:</strong> ${formatMetric(pairGraph.pair.similarity)}</p>
        <p><strong>מושגים משותפים:</strong> ${escapeHtml((pairGraph.pair.sharedSample || []).slice(0, 6).join(' | ') || 'אין')}</p>
      `;
    }
    RV2RenderGraph(comparisonGraphBlock.querySelector('#source-comparison-graph-host'), pairGraph, {
      onNodeClick: (node) => {
        const detail = comparisonGraphBlock.querySelector('#source-comparison-graph-detail');
        if (node.id === sourceId || node.id === targetId) {
          detail.innerHTML = `
            <h4>פרשן</h4>
            <p><strong>שם:</strong> ${escapeHtml(node.label)}</p>
            <p><strong>תפקיד:</strong> ${escapeHtml(node.id === sourceId ? 'פרשן א' : 'פרשן ב')}</p>
          `;
        } else {
          detail.innerHTML = `
            <h4>מושג משותף</h4>
            <p><strong>מונח:</strong> ${escapeHtml(node.label)}</p>
            <p><strong>מחבר:</strong> משותף לשני הפרשנים</p>
          `;
        }
      },
      onEdgeClick: (edge) => {
        comparisonGraphBlock.querySelector('#source-comparison-graph-detail').innerHTML = `
          <h4>קשר מחקרי</h4>
          <p><strong>מה מחובר למה:</strong> ${escapeHtml(edge.source)} -> ${escapeHtml(edge.target)}</p>
          <p><strong>${escapeHtml(edge.predicate)}</strong></p>
          <p><strong>בסיס:</strong> ${escapeHtml(edge.evidenceText)}</p>
        `;
      },
    });
  };

  pairSelectRow.querySelector('#pair-source-select').addEventListener('change', pairGraphRender);
  pairSelectRow.querySelector('#pair-target-select').addEventListener('change', pairGraphRender);
  pairGraphRender();

  const graphBlock = el.sourceView.querySelector('#source-graph-block');
  const graphOptions = data.commentators
    .map((c) => `<option value="${escapeHtml(c)}" ${c === app.currentGraphCommentator ? 'selected' : ''}>${escapeHtml(c)}</option>`)
    .join('');

  graphBlock.innerHTML = `
    <h3>גרף אינטראקטיבי לפי מקור</h3>
    <div class="inline-controls">
      <label for="graph-commentator-select">הצג גרף של</label>
      <select id="graph-commentator-select">${graphOptions}</select>
    </div>
    <div class="graph-host graph-host-square" id="graph-host"></div>
    <div class="detail-box" id="graph-detail">לחץ על צומת או קשר כדי לראות פירוט.</div>
  `;

  graphBlock.querySelector('#graph-commentator-select').addEventListener('change', (ev) => {
    app.currentGraphCommentator = ev.target.value;
    renderBySource();
  });

  const graphData = data.graphs[app.currentGraphCommentator] || data.graphs.RAMBAN;
  const detailEl = graphBlock.querySelector('#graph-detail');

  const activeComparison = data.pairwise.find((p) => p.commentatorId === app.currentGraphCommentator) || null;

  RV2RenderGraph(graphBlock.querySelector('#graph-host'), { ...graphData, layoutMode: 'star' }, {
    onNodeClick: (node) => {
      const incidentEdges = (graphData.edges || []).filter((e) => e.source === node.id || e.target === node.id);
      const inClusters = (data.localClusters || []).filter((cluster) => cluster.members.includes(app.currentGraphCommentator));
      detailEl.innerHTML = `
        <h4>פרטי צומת</h4>
        <p><strong>טקסט:</strong> ${escapeHtml(node.label)}</p>
        <p><strong>סוג:</strong> ${escapeHtml(node.type)}</p>
        <p><strong>מקור:</strong> ${escapeHtml(data.id)}</p>
        <p><strong>פרשן:</strong> ${escapeHtml(app.currentGraphCommentator)}</p>
        <p><strong>מספר קשרים לצומת:</strong> ${incidentEdges.length}</p>
        <p><strong>אשכולות רלוונטיים:</strong> ${escapeHtml(inClusters.map((c) => c.id).join(', ') || 'אין')}</p>
        <p><strong>דמיון לרמב"ן:</strong> ${formatMetric(activeComparison?.align)}</p>
      `;
    },
    onEdgeClick: (edge) => {
      const inLocalCluster = (data.localClusters || []).some((cluster) =>
        cluster.members.includes(app.currentGraphCommentator)
      );
      detailEl.innerHTML = `
        <h4>פרטי קשר</h4>
        <p><strong>מקור:</strong> ${escapeHtml(data.id)}</p>
        <p><strong>פרשן:</strong> ${escapeHtml(app.currentGraphCommentator)}</p>
        <p><strong>מה מחובר למה:</strong> ${escapeHtml(edge.source)} -> ${escapeHtml(edge.target)}</p>
        <p><strong>סוג קשר:</strong> ${escapeHtml(edge.predicate)}</p>
        <p><strong>עוצמת קשר:</strong> לא סופקה עוצמה מספרית בקובץ המקור.</p>
        <p><strong>האם משתתף באשכול:</strong> ${inLocalCluster ? 'כן, ברמת הפרשן במקור זה' : 'לא זוהה'}</p>
        <p><strong>טקסט תומך:</strong> ${escapeHtml(edge.evidenceText || 'לא זמין')}</p>
      `;
    },
  });

  const textBlock = el.sourceView.querySelector('#source-text-block');
  const rambanText = data.graphs.RAMBAN?.text || '';
  const selected = data.pairwise.find((x) => x.commentatorId === app.selectedPairCommentator) || data.pairwise[0] || null;
  const highlightTerms = selected ? selected.shared.slice(0, 12) : [];
  const highlightTermColors = new Map(
    highlightTerms.map((term, idx) => [normalizedString(term), commentaryColor(idx)])
  );

  if (!app.selectedTextCommentatorsBySection[data.id]) {
    app.selectedTextCommentatorsBySection[data.id] = data.pairwise.slice(0, 3).map((x) => x.commentatorId);
  }
  const selectedTextCommentators = app.selectedTextCommentatorsBySection[data.id];
  const activeTermsHtml = highlightTerms.length
    ? highlightTerms.map((term, idx) => `
      <button type="button" class="term-chip is-active" data-highlight-term-chip="${escapeHtml(term)}" style="--term-color:${commentaryColor(idx)}">
        ${escapeHtml(term)}
      </button>
    `).join(' ')
    : '<span class="muted">לא נמצאו מושגים משותפים</span>';

  const commentatorCards = data.pairwise
    .filter((row) => selectedTextCommentators.includes(row.commentatorId))
    .map((row) => {
    const text = RV2StripNiqqud(data.graphs[row.commentatorId]?.text || 'טקסט לא זמין');
    const chunks = RV2SplitHighlights(text.slice(0, 1400), highlightTerms);
    const colorIndex = data.pairwise.findIndex((item) => item.commentatorId === row.commentatorId);
    const selectedClass = selectedTextCommentators.includes(row.commentatorId) ? 'is-selected' : '';
    return `<article class="text-col text-col-selectable ${selectedClass}" data-text-commentator-card="${escapeHtml(row.commentatorId)}" style="border-color:${commentaryColor(Math.max(colorIndex, 0))}; background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,240,231,0.88)); box-shadow: inset 0 0 0 1px ${commentaryColor(Math.max(colorIndex, 0))}22;"><h4 style="color:${commentaryColor(Math.max(colorIndex, 0))}">${escapeHtml(row.commentatorId)}</h4><p>${RV2ToHighlightedHtml(chunks, highlightTermColors)}</p></article>`;
    })
    .join('');

  const rambanChunks = RV2SplitHighlights(RV2StripNiqqud(rambanText).slice(0, 1400), highlightTerms);
  const commentatorPicker = data.pairwise
    .map((row) => {
      const checked = selectedTextCommentators.includes(row.commentatorId) ? 'checked' : '';
      return `<label class="check-chip"><input type="checkbox" data-text-commentator="${escapeHtml(row.commentatorId)}" ${checked} /> ${escapeHtml(row.commentatorId)}</label>`;
    })
    .join(' ');

  textBlock.innerHTML = `
    <h3>טקסטים במבט מקביל</h3>
    <p class="active-highlight-line"><strong>סימון פעיל:</strong> ${escapeHtml(selectedTextCommentators.join(' | ') || 'ללא')}</p>
    <div class="active-term-chips">${activeTermsHtml}</div>
    <div class="inline-controls wrap">
      <span>בחר טקסטים להשוואה:</span>
      ${commentatorPicker}
    </div>
    <div class="text-grid">
      <article class="text-col">
        <h4>רמב"ן</h4>
        <p>${RV2ToHighlightedHtml(rambanChunks, highlightTermColors)}</p>
      </article>
      ${commentatorCards}
    </div>
    <p class="muted">לחיצה על כרטיס טקסט תשאיר אותו פעיל ותסנכרן את מצב ההדגשה עם הגרף.</p>
    <p class="muted">אם אין סימון מדויק, הסימון מוצג כהתאמת מושגים בסיסית בלבד.</p>
    <p class="muted">כדי לשמור על ביצועים מוצג קטע עד 1400 תווים לכל טקסט.</p>
  `;

  textBlock.querySelectorAll('input[data-text-commentator]').forEach((input) => {
    input.addEventListener('change', async () => {
      const selectedIds = [...textBlock.querySelectorAll('input[data-text-commentator]:checked')].map((x) => x.dataset.textCommentator);
      app.selectedTextCommentatorsBySection[data.id] = selectedIds.length ? selectedIds : [data.pairwise[0]?.commentatorId].filter(Boolean);
      await renderBySource();
    });
  });

  textBlock.querySelectorAll('article[data-text-commentator-card]').forEach((card) => {
    card.addEventListener('click', async () => {
      const id = card.dataset.textCommentatorCard;
      const current = new Set(app.selectedTextCommentatorsBySection[data.id] || []);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      const fallback = data.pairwise[0]?.commentatorId;
      const next = [...current];
      app.selectedTextCommentatorsBySection[data.id] = next.length ? next : (fallback ? [fallback] : []);
      app.currentGraphCommentator = id;
      await renderBySource();
    });
  });

  textBlock.querySelectorAll('button[data-highlight-term-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const term = normalizedString(chip.dataset.highlightTermChip);
      const marks = [...textBlock.querySelectorAll('[data-highlight-term]')].filter(
        (mark) => normalizedString(mark.dataset.highlightTerm) === term
      );
      marks.forEach((mark) => mark.classList.add('is-pulsed'));
      if (marks[0]) {
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
          marks.forEach((mark) => mark.classList.remove('is-pulsed'));
        }, 900);
      }
    });
  });

  textBlock.querySelectorAll('input[data-text-commentator]').forEach((input) => {
    input.closest('.check-chip')?.classList.toggle('is-active', input.checked);
    input.addEventListener('change', () => {
      input.closest('.check-chip')?.classList.toggle('is-active', input.checked);
    });
  });

  attachInfoHints(el.sourceView);
}

async function renderByCommentator() {
  const options = index.commentators
    .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === app.currentCommentatorId ? 'selected' : ''}>${escapeHtml(c.id)}</option>`)
    .join('');

  el.commentatorView.innerHTML = `
    <div class="card controls-card">
      <label for="commentator-select">בחירת פרשן</label>
      <select id="commentator-select">${options}</select>
    </div>
    <div class="grid-2">
      <div class="card" id="commentator-summary"></div>
      <div class="card" id="commentator-sections"></div>
    </div>
    <div class="card" id="commentator-graph"></div>
  `;

  el.commentatorView.querySelector('#commentator-select').addEventListener('change', async (ev) => {
    app.currentCommentatorId = ev.target.value;
    await renderByCommentator();
  });

  const meta = commentatorMetaById(app.currentCommentatorId);
  if (!meta) return;

  const data = await RV2LoadCommentatorData(meta);
  const summary = el.commentatorView.querySelector('#commentator-summary');

  summary.innerHTML = `
    <h2>${escapeHtml(data.id)}</h2>
    <div class="stats-grid">
      <div><strong>מספר מקורות</strong><span>${data.sections.length}</span></div>
      <div><strong>דמיון ממוצע לרמב"ן</strong><span>${formatMetric(data.avgAlignVsRamban)}</span></div>
      <div><strong>צמתים באגרגציה</strong><span>${data.aggregateGraph?.nodeCount ?? '-'}</span></div>
      <div><strong>קשרים באגרגציה</strong><span>${data.aggregateGraph?.edgeCount ?? '-'}</span></div>
    </div>
    <p><strong>טופ-מתודות:</strong> ${escapeHtml(data.methodProfile?.top_predicates || 'לא זמין')}</p>
    <p><strong>מונחי פרשנות:</strong> ${escapeHtml(data.methodProfile?.method_terms || 'לא זמין')}</p>
    <p><strong>מושגי ליבה:</strong> ${escapeHtml(data.structureProfile?.core_concepts || 'לא זמין')}</p>
    <p><strong>מושגי גישור:</strong> ${escapeHtml(data.structureProfile?.bridge_concepts || 'לא זמין')}</p>
    <p><strong>זוגות קרובים לפרשן זה:</strong> ${data.peerSimilarities.map((p) => `${escapeHtml(p.commentatorId)} (${formatMetric(p.similarity)})`).join(' | ') || 'לא זמין'}</p>
  `;

  const sectionsEl = el.commentatorView.querySelector('#commentator-sections');
  const rows = data.sections
    .map((s) => `
      <tr data-section="${escapeHtml(s.sectionId)}">
        <td>${escapeHtml(s.sectionId)}</td>
        <td>${formatMetric(s.align)}</td>
        <td>${s.sharedCount}</td>
      </tr>
    `)
    .join('');

  sectionsEl.innerHTML = `
    <h3>פריסה לפי מקורות</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>מקור</th>
            <th>דמיון לרמב"ן</th>
            <th>מושגים משותפים</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="3">אין נתונים</td></tr>'}</tbody>
      </table>
    </div>
  `;

  sectionsEl.querySelectorAll('tbody tr[data-section]').forEach((tr) => {
    tr.addEventListener('click', async () => {
      app.currentSectionId = tr.dataset.section;
      app.currentGraphCommentator = app.currentCommentatorId;
      activateTab('by-source');
      await renderBySource();
    });
  });

  const graphEl = el.commentatorView.querySelector('#commentator-graph');
  graphEl.innerHTML = `
    <h3>גרף אגרגטיבי של הפרשן</h3>
    <div class="graph-host" id="commentator-graph-host"></div>
    <div class="detail-box" id="commentator-graph-detail">לחץ על צומת או קשר כדי לראות מידע.</div>
  `;

  const detail = graphEl.querySelector('#commentator-graph-detail');
  RV2RenderGraph(graphEl.querySelector('#commentator-graph-host'), data.aggregateGraph, {
    onNodeClick: (node) => {
      detail.innerHTML = `
        <h4>צומת אגרגטיבי</h4>
        <p><strong>תווית:</strong> ${escapeHtml(node.label)}</p>
        <p><strong>סוג:</strong> ${escapeHtml(node.type)}</p>
      `;
    },
    onEdgeClick: (edge) => {
      detail.innerHTML = `
        <h4>קשר אגרגטיבי</h4>
        <p><strong>צד א:</strong> ${escapeHtml(edge.source)}</p>
        <p><strong>צד ב:</strong> ${escapeHtml(edge.target)}</p>
        <p><strong>סוג קשר:</strong> ${escapeHtml(edge.predicate)}</p>
      `;
    },
  });

  const peerGraph = document.createElement('div');
  peerGraph.className = 'card';
  peerGraph.innerHTML = `
    <h3>השוואה לפרשנים אחרים כגרף</h3>
    <div class="graph-host" id="peer-graph-host"></div>
    <div class="detail-box" id="peer-graph-detail">לחץ על צומת או קשר כדי לראות את החיבור הטבלאי.</div>
  `;
  el.commentatorView.appendChild(peerGraph);
  const peerNodes = [{ id: data.id, label: data.id, type: 'RabbinicAuthority', freq: data.sections.length, instances: data.sections.length }]
    .concat(data.peerSimilarities.slice(0, 8).map((p) => ({ id: p.commentatorId, label: p.commentatorId, type: 'RabbinicAuthority', freq: 10, instances: 10 })));
  const peerEdges = data.peerSimilarities.slice(0, 8).map((p) => ({ id: `${data.id}-${p.commentatorId}`, source: data.id, target: p.commentatorId, predicate: 'דמיון', evidenceText: formatMetric(p.similarity, 4) }));
  RV2RenderGraph(peerGraph.querySelector('#peer-graph-host'), { nodes: peerNodes, edges: peerEdges }, {
    onNodeClick: (node) => {
      peerGraph.querySelector('#peer-graph-detail').innerHTML = `<h4>צומת פרשן</h4><p><strong>שם:</strong> ${escapeHtml(node.label)}</p>`;
    },
    onEdgeClick: (edge) => {
      peerGraph.querySelector('#peer-graph-detail').innerHTML = `<h4>קשר פרשנים</h4><p><strong>${escapeHtml(edge.source)} -> ${escapeHtml(edge.target)}</strong></p><p><strong>דמיון:</strong> ${escapeHtml(edge.evidenceText)}</p>`;
    },
  });

  const peersTable = document.createElement('div');
  peersTable.className = 'card';
  peersTable.innerHTML = `
    <h3>השוואה לפרשנים אחרים (רוחבי)</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>פרשן</th><th>דמיון</th></tr></thead>
        <tbody>
          ${data.peerSimilarities.map((p) => `
            <tr>
              <td><button class="link-btn" data-commentator="${escapeHtml(p.commentatorId)}">${escapeHtml(p.commentatorId)}</button></td>
              <td>${formatMetric(p.similarity, 4)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  el.commentatorView.appendChild(peersTable);

  peersTable.querySelectorAll('button[data-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentCommentatorId = btn.dataset.commentator;
      await renderByCommentator();
    });
  });

  attachInfoHints(el.commentatorView);
}

function renderOverview() {
  const knowledgeBodies = index.global.knowledgeBodies || [];
  const referenceDocs = index.global.referenceDocs || [];
  const clusterCards = index.global.clusters
    .map((cluster) => {
      const members = cluster.members
        .map((m) => `<button class="link-btn" data-commentator="${escapeHtml(m)}">${escapeHtml(m)}</button>`)
        .join(' ');

      const supportRows = (cluster.supportingSections || []).slice(0, 8).map((row) => {
        const pair = row.strongestInnerPair
          ? `${escapeHtml(row.strongestInnerPair.source)} <-> ${escapeHtml(row.strongestInnerPair.target)} (${formatMetric(row.strongestInnerPair.similarity)})`
          : 'לא זוהה זוג בולט';
        return `
          <tr>
            <td><button class="link-btn" data-section="${escapeHtml(row.sectionId)}">${escapeHtml(row.sectionId)}</button></td>
            <td>${row.clusterMemberCountInSection}</td>
            <td>${formatMetric(row.metrics.commentatorAgreement)}</td>
            <td>${pair}</td>
          </tr>
        `;
      }).join('');

      return `
        <article class="cluster-card">
          <h4>${escapeHtml(cluster.id)}</h4>
          <p>דמיון ממוצע: ${formatMetric(cluster.meanSimilarity, 4)}</p>
          <p>כיסוי מקורות: ${cluster.supportingSectionsCount}</p>
          <p>הסבר: ${escapeHtml(cluster.explanation || '')}</p>
          <p>חברים: ${members}</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>מקור</th><th>חברי אשכול במקור</th><th>הסכמה במקור</th><th>זוג תומך</th></tr></thead>
              <tbody>${supportRows || '<tr><td colspan="4">אין מקורות תומכים</td></tr>'}</tbody>
            </table>
          </div>
        </article>
      `;
    })
    .join('');

  const flagRows = Object.entries(index.global.flagGroups)
    .map(([flag, sections]) => {
      const secLinks = sections
        .map((s) => `<button class="link-btn" data-section="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
        .join(' ');
      return `<tr><td>${escapeHtml(flag)}</td><td>${secLinks}</td></tr>`;
    })
    .join('');

  const pairRows = index.global.topPairs
    .slice(0, 20)
    .map((p) => `
      <tr>
        <td><button class="link-btn" data-commentator="${escapeHtml(p.source)}">${escapeHtml(p.source)}</button></td>
        <td><button class="link-btn" data-commentator="${escapeHtml(p.target)}">${escapeHtml(p.target)}</button></td>
        <td>${formatMetric(p.similarity, 4)}</td>
      </tr>
    `)
    .join('');

  el.overviewView.innerHTML = `
    <div class="card">
      <h2>מסקנות ותובנות כלליות</h2>
      <ul class="findings-list">
        ${index.global.keyFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
    </div>
    <div class="card">
      <h3>גופי ידע שאינם מעוגנים בטקסט</h3>
      <p class="muted">אלו צמתים שנמצאו בגרפים אך אין להם עוגן טקסטואלי ישיר ב-source_instance_ids.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>גוף ידע</th><th>סוג</th><th>כמות הופעות</th></tr></thead>
          <tbody>
            ${(knowledgeBodies.slice(0, 16).map((body) => `<tr><td>${escapeHtml(body.label)}</td><td>${escapeHtml(body.type)}</td><td>${body.count}</td></tr>`).join('')) || '<tr><td colspan="3">אין גופי ידע לא מעוגנים.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3>מסמכי מקור ופרשנות</h3>
      <p class="muted">מסמכים שנותנים את ההקשר המתודולוגי והנרטיבי לנתונים המחולצים.</p>
      <div class="doc-grid">
        ${referenceDocs.map((doc) => `
          <details class="doc-card">
            <summary>${escapeHtml(doc.title)}</summary>
            <p class="muted">${escapeHtml(doc.fileName)}</p>
            <p>${escapeHtml(doc.summary || 'אין תקציר זמין')}</p>
          </details>
        `).join('') || '<p>אין מסמכי מקור זמינים.</p>'}
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>אשכולות פרשנים</h3>
        <div class="clusters-grid">${clusterCards || '<p>אין אשכולות להצגה.</p>'}</div>
      </div>
      <div class="card">
        <h3>זוגות דמיון מובילים</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>פרשן א</th><th>פרשן ב</th><th>דמיון</th></tr></thead>
            <tbody>${pairRows || '<tr><td colspan="3">אין נתונים</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>דגלי איכות וחתכים רוחביים</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>דגל</th><th>מקורות</th></tr></thead>
          <tbody>${flagRows}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3>גרף גופי ידע טבלאיים</h3>
      <div class="graph-host" id="global-knowledge-graph-host"></div>
      <div class="detail-box" id="global-knowledge-graph-detail">לחץ על צומת כדי לראות מאיזה מקור הוא נלקח.</div>
    </div>
  `;

  const graphData = buildGlobalKnowledgeGraph(knowledgeBodies);
  const nodes = graphData.nodes;
  const edges = [];
  for (const node of nodes) {
    const bodies = knowledgeBodies.find((body) => body.label === node.label);
    (bodies?.sections || []).slice(0, 4).forEach((sectionId) => {
      edges.push({ id: `${node.id}-${sectionId}`, source: node.id, target: `sec_${sectionId}`, predicate: 'מופיע-ב', evidenceText: `מקור ${sectionId}` });
    });
  }
  const sectionNodes = [...new Set(edges.map((e) => e.target))].map((id) => ({ id, label: id.replace('sec_', 'מקור '), type: 'HistoricalEventOrPeriod', freq: 1, instances: 1 }));
  RV2RenderGraph(el.overviewView.querySelector('#global-knowledge-graph-host'), { nodes: nodes.concat(sectionNodes), edges }, {
    onNodeClick: (node) => {
      el.overviewView.querySelector('#global-knowledge-graph-detail').innerHTML = `<h4>גוף ידע</h4><p><strong>${escapeHtml(node.label)}</strong></p><p><strong>סוג:</strong> ${escapeHtml(node.type)}</p>`;
    },
    onEdgeClick: (edge) => {
      el.overviewView.querySelector('#global-knowledge-graph-detail').innerHTML = `<h4>קישור לגוף ידע</h4><p><strong>${escapeHtml(edge.source)} -> ${escapeHtml(edge.target)}</strong></p><p><strong>${escapeHtml(edge.evidenceText)}</strong></p>`;
    },
  });

  el.overviewView.querySelectorAll('button[data-commentator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentCommentatorId = btn.dataset.commentator;
      activateTab('by-commentator');
      await renderByCommentator();
    });
  });

  el.overviewView.querySelectorAll('button[data-section]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      app.currentSectionId = btn.dataset.section;
      app.currentGraphCommentator = 'RAMBAN';
      activateTab('by-source');
      await renderBySource();
    });
  });

  attachInfoHints(el.overviewView);
}

async function bootstrap() {
  document.addEventListener('click', () => {
    closeInfoPopovers();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeInfoPopovers();
  });

  attachGlobalEvents();
  await renderBySource();
  await renderByCommentator();
  await renderFlowAtlas();
  renderOverview();
  renderCorpusAnalysis();
  renderDataArchive();
}

bootstrap();
