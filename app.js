(() => {
  'use strict';

  const OLD = window.RV3_OLD_INDEX;
  const PACK = window.RV3_QUANT_REPORTS;
  if (!OLD || !PACK) throw new Error('Dashboard data did not load.');

  const Q = PACK.quant;
  const sectionMap = Object.fromEntries(Object.entries(PACK.sectionMap || {}).map(([k,v]) => [String(k), v]));
  const nameMap = PACK.nameMap || {};
  const reports = PACK.reports || {};

  const state = {
    tab: 'journey',
    section: sectionMap['15'] ? '15' : Object.keys(sectionMap)[0],
    a: 'MeiratEinayim',
    b: 'SaportaOxford1645',
    selectedTerm: '',
    netMode: 'ramban-overlay',
    netLabels: true,
    netEdgeLabels: true,
    netPredicate: 'all',
    netColorMode: 'type',
    textTagMode: 'all',
    textActiveTypes: [],
    netFull: false,
    sectionMatrixMetric: 'raw',
    corpusMatrixMetric: 'co_cluster',
    focalMetric: 'raw',
    clusterLocalMetric: 'raw',
    clusterLocalThreshold: 0.42,
    clusterGlobalThreshold: 0.60,
    clusterGlobalMetric: 'co_cluster',
    clusterSectionMetric: 'raw',
    clusterView: 'overview',
    dispersionMetricX: 'locus_overlap',
    dispersionMetricY: 'reading_agreement',
    dispersionColorBy: 'quadrant',
    dispersionSizeBy: 'shared',
    dispersionFocus: 'all',
    dispersionSectionFilter: 'all',
    dispersionSelection: null,
    dispersionGroupScope: 'all',
    dispersionGroupMatch: 'both',
    dispersionManualIds: [],
    dispersionMinShared: 0,
    dispersionMinClaims: 0,
    dispersionEvidence: 'all',
    reportId: Object.keys(reports).find(k => k.includes('01_ממצאים')) || Object.keys(reports)[0],
    rawTable: 'כל_הזוגות_מדורגים',
    rawSearch: '',
  };

  const loadedScripts = new Set();
  const networkLayoutCache = new Map();
  const NETWORK_LAYOUT_CACHE_MAX = 64;
  let viewportRefreshRaf = 0;
  const bySectionPairs = groupBy(Q['כל_הזוגות_מדורגים'] || [], r => String(r.section));
  const bySectionDecomp = groupBy(Q['פירוק_התפזרות'] || [], r => String(r.section));
  const bySectionConcepts = groupBy(Q['מושגים_משותפים_לרבים'] || [], r => String(r.section));
  const coClusterMap = new Map((Q['קו_אשכול_בין_חיבורים'] || []).map(r => [pairKey(r.comm_a, r.comm_b), r]));
  const closenessMap = new Map((Q['קרבה_לרמבן'] || []).map(r => [canon(r.commentator), r]));
  const oldSectionSummary = OLD.sectionSummary || {};
  const oldCommentatorSummary = OLD.commentatorSummary || {};
  const TYPE_COLOR_MAP = {
    BiblicalFigure:'#3f78a8', BiblicalQuotation:'#b25f38', BiblicalSource:'#8c6b3f', Book:'#6d7f8d',
    CommentaryTypeOrMethod:'#9b5f8d', HalakhicConcept:'#a17b16', HistoricalEventOrPeriod:'#7661a8',
    KabbalisticConcept:'#744b8e', KabbalisticWork:'#915f82', LegalReference:'#8b7046', TalmudicSource:'#526e9e', MidrashicOrRabbinicWork:'#5f7e9a', OtherConcept:'#7f8582',
    PhysicalObject:'#a66d52', Place:'#4b8b76', RabbinicAuthority:'#97622d', ReligiousPractice:'#3f8e99',
    SpiritualEntity:'#5772b5', TheologicalConcept:'#b04f65', TraditionOrAttribution:'#628052', Unknown:'#7d8580'
  };
  const PREDICATE_COLOR_MAP = {
    appearsIn:'#6587a2', causes:'#c44e52', cites:'#7a68a6', commentedOn:'#8172b3', correspondsTo:'#3f8d78', disagreedWith:'#b84747', forbids:'#9d3f52', permits:'#4e8a68', requires:'#a67239',
    derivedFrom:'#9a6a3a', explains:'#d06d36', hasChild:'#8d6a5e', hasPart:'#4f7e94', isA:'#536a7a',
    isCalled:'#a45d84', locatedIn:'#4b8f64', livedDuring:'#657b93', mentions:'#7e7f86', relatedTo:'#8b8f91', studiedUnder:'#8e6b45', symbolizes:'#a45568', hasSibling:'#6f8175', signature:'#6a5f9c',
    co_cluster:'#365f83', mean_raw:'#9a5b3d', mean_locus:'#4d826d', mean_reading:'#865f91', local_similarity:'#8a5b39'
  };
  const PREDICATE_LABELS = {
    appearsIn:'מופיע ב־', causes:'גורם ל־', cites:'מצטט / מפנה ל־', commentedOn:'מפרש את', correspondsTo:'מקביל ל־', disagreedWith:'חולק על', forbids:'אוסר', permits:'מתיר', requires:'מחייב',
    derivedFrom:'נגזר מ־', explains:'מסביר', hasChild:'בן / צאצא של', hasPart:'כולל / חלק של', isA:'הוא סוג של',
    isCalled:'נקרא', locatedIn:'נמצא ב־', livedDuring:'חי בתקופת', mentions:'מזכיר', relatedTo:'קשור ל־', studiedUnder:'למד אצל', symbolizes:'מסמל', hasSibling:'אח / אחות של', signature:'חתימת קורפוס',
    co_cluster:'קו־אשכול', mean_raw:'דמיון תוכן ממוצע', mean_locus:'חפיפת מוקדים ממוצעת', mean_reading:'הסכמת קריאה ממוצעת', local_similarity:'דמיון בקטע'
  };

  const pairMeans = buildPairMeans();
  const allSections = sortSections([...new Set([...Object.keys(sectionMap), ...Object.keys(oldSectionSummary)])]);
  const allCommentators = buildCommentatorList();
  const quantCommentators = (Q['מפתח_חיבורים'] || []).map(r => canon(r.identifier));

  const els = {
    sectionSelect: document.getElementById('sectionSelect'),
    aSelect: document.getElementById('commentatorASelect'),
    bSelect: document.getElementById('commentatorBSelect'),
    sectionCaption: document.getElementById('sectionCaption'),
    contextStatus: document.getElementById('contextStatus'),
    contextBar: document.getElementById('contextBar'),
    workspaceSticky: document.getElementById('workspaceSticky'),
    tabs: [...document.querySelectorAll('.main-tab')],
    views: {
      journey: document.getElementById('tab-journey'),
      commentator: document.getElementById('tab-commentator'),
      corpus: document.getElementById('tab-corpus'),
      clusters: document.getElementById('tab-clusters'),
      dispersion: document.getElementById('tab-dispersion'),
      reports: document.getElementById('tab-reports'),
      data: document.getElementById('tab-data'),
    }
  };

  init();

  function init() {
    populateControls();
    bindGlobalEvents();
    updateContextCaption();
    updateContextBarVisibility();
    setupInfoSystem();
    renderActive();
  }

  function populateControls() {
    els.sectionSelect.innerHTML = allSections.map(s => {
      const m = sectionMap[s];
      const label = m ? `§${s} · ${m.passage_suggested || ''} · ${truncate(m.lemma || '', 58)}` : `§${s}`;
      return `<option value="${escAttr(s)}">${esc(label)}</option>`;
    }).join('');
    els.sectionSelect.value = state.section;

    const commentatorOptions = allCommentators.map(c => `<option value="${escAttr(c.id)}">${esc(c.name)}</option>`).join('');
    els.aSelect.innerHTML = commentatorOptions;
    els.bSelect.innerHTML = commentatorOptions;
    if (allCommentators.some(x => x.id === state.a)) els.aSelect.value = state.a;
    if (allCommentators.some(x => x.id === state.b)) els.bSelect.value = state.b;
  }

  function bindGlobalEvents() {
    els.sectionSelect.addEventListener('change', () => {
      state.section = String(els.sectionSelect.value);
      state.selectedTerm = '';
      updateContextCaption();
      renderActive();
    });
    els.aSelect.addEventListener('change', () => {
      state.a = canon(els.aSelect.value);
      if (state.a === state.b) state.b = pickAlternative(state.a);
      els.bSelect.value = state.b;
      state.selectedTerm = '';
      updateContextCaption();
      renderActive();
    });
    els.bSelect.addEventListener('change', () => {
      state.b = canon(els.bSelect.value);
      if (state.a === state.b) state.a = pickAlternative(state.b);
      els.aSelect.value = state.a;
      state.selectedTerm = '';
      updateContextCaption();
      renderActive();
    });
    els.tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    window.addEventListener('resize', scheduleViewportRefresh, {passive:true});
  }

  function scheduleViewportRefresh() {
    if (viewportRefreshRaf) cancelAnimationFrame(viewportRefreshRaf);
    viewportRefreshRaf = requestAnimationFrame(() => {
      viewportRefreshRaf = 0;
      updateContextBarVisibility();
      document.querySelectorAll('.network-canvas,.cluster-network-host').forEach(el => el.__rvFit?.());
    });
  }

  function switchTab(tab) {
    state.tab = tab;
    els.tabs.forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
    Object.entries(els.views).forEach(([k,v]) => v.classList.toggle('is-active', k === tab));
    updateContextBarVisibility();
    renderActive();
  }

  function updateContextBarVisibility() {
    if (!els.contextBar) return;
    const visibleByTab = {
      journey: ['section','a','b','status'],
      commentator: ['a'],
      corpus: ['section','a'],
      clusters: ['section','a','b','status'],
      dispersion: [],
      reports: [],
      data: [],
    };
    const visible = new Set(visibleByTab[state.tab] || []);
    els.contextBar.querySelectorAll('[data-context-field]').forEach(el => {
      el.hidden = !visible.has(el.dataset.contextField);
    });
    els.contextBar.classList.toggle('is-hidden', visible.size === 0);
    requestAnimationFrame(() => {
      const h = els.workspaceSticky?.offsetHeight || 58;
      document.documentElement.style.setProperty('--workspace-sticky-height', `${h}px`);
    });
  }

  async function renderActive() {
    updateContextCaption();
    if (state.tab === 'journey') await renderJourney();
    else if (state.tab === 'commentator') await renderCommentator();
    else if (state.tab === 'corpus') renderCorpus();
    else if (state.tab === 'clusters') await renderClusters();
    else if (state.tab === 'dispersion') await renderDispersionLab();
    else if (state.tab === 'reports') renderReports();
    else if (state.tab === 'data') renderDataQA();
  }

  function updateContextCaption() {
    const m = sectionMap[state.section] || {};
    els.sectionCaption.textContent = [m.passage_suggested, m.lemma].filter(Boolean).join(' · ');
    const oldGraphs = oldSectionSummary[state.section]?.graphIds || [];
    const aOld = oldGraphs.includes(toOldId(state.a));
    const bOld = oldGraphs.includes(toOldId(state.b));
    const pr = getPairRow(state.section, state.a, state.b);
    const dc = getDecompRow(state.section, state.a, state.b);
    els.contextStatus.innerHTML = `
      <span class="badge badge-net">טקסט/רשת: ${aOld ? 'א׳ ✓' : 'א׳ —'} · ${bOld ? 'ב׳ ✓' : 'ב׳ —'}</span>
      <span class="badge badge-quant">כימות זוגי: ${pr || dc ? '✓' : '—'}</span>
      ${state.section === '7_2' ? '<span class="badge badge-warn">§7_2: אין שכבת טקסט/רשת בנתונים הישנים</span>' : ''}
    `;
  }

  /* -------------------- JOURNEY -------------------- */
  async function renderJourney() {
    const root = els.views.journey;
    root.innerHTML = skeleton('טוען את שכבת הטקסט והרשת…');
    await ensureSection(state.section);

    const s = window.RAMBAN_V2_SECTIONS[state.section] || null;
    const gR = s?.graphs?.RAMBAN || null;
    const gA = s?.graphs?.[toOldId(state.a)] || null;
    const gB = s?.graphs?.[toOldId(state.b)] || null;
    const meta = sectionMap[state.section] || {};

    root.innerHTML = `
      <div class="journey-rail">
        <button class="journey-step" data-scroll="#layer-text"><strong>1 · טקסטים ותיוגים</strong><small>מה נאמר ומה חולץ מן הטקסט</small></button>
        <button class="journey-step" data-scroll="#layer-network"><strong>2 · רשת היחסים</strong><small>איך המושגים והטענות מתחברים</small></button>
        <button class="journey-step" data-scroll="#layer-quant"><strong>3 · כימות</strong><small>כמה היחסים דומים, שונים או חוזרים</small></button>
      </div>
      ${meta.note ? `<div class="notice ${state.section === '1' ? 'error':''}" style="margin-bottom:18px">${esc(meta.note)}</div>` : ''}
      <section id="layer-text" class="panel layer-section">
        <div class="layer-kicker"><span class="layer-number">1</span><span class="badge badge-text">נתונים ישנים · טקסט + מושגים שחולצו</span></div>
        <div class="panel-head">
          <div><h2>הטקסטים באותו קטע</h2><p>הרמב״ן וטקסטי הפרשנים. לחיצה על מושג מדגישה את הופעתו המילולית בטקסטים.</p></div>
          ${state.selectedTerm ? `<button class="small-btn" id="clearTerm">נקה הדגשה: ${esc(state.selectedTerm)}</button>` : ''}
        </div>
        ${renderTextTagControls([gR, gA, gB])}
        ${renderTexts(gR, gA, gB)}
        ${renderLiteralShared(gA, gB)}
      </section>

      <section id="layer-network" class="panel layer-network">
        <div class="layer-kicker"><span class="layer-number">2</span><span class="badge badge-net">נתונים ישנים · גרפי E2</span></div>
        <div class="panel-head">
          <div><h2>רשת היחסים</h2><p>אותם טקסטים מיוצגים כמושגים וקשתות. תצוגת ההשוואה מאחדת רק תוויות זהות מילולית — היא איננה תחליף לזיהוי המושגים הכמותי.</p></div>
        </div>
        <div class="split-main">
          <div id="networkHost"></div>
          <aside id="networkDetail" class="network-detail"><h4>פרטי צומת / קשר</h4><p class="muted">לחצו על צומת או על קשר כדי לראות תיאור וראיית טקסט.</p></aside>
        </div>
      </section>

      <section id="layer-quant" class="panel layer-quant">
        <div class="layer-kicker"><span class="layer-number">3</span><span class="badge badge-quant">נתונים חדשים · כימות</span></div>
        <div class="panel-head">
          <div><h2>כימות של היחסים</h2><p>הזוג שנבחר מקבל כאן ערכים מספריים. מדדים מן הנתונים הישנים ומדדים מן הנתונים החדשים מסומנים בנפרד.</p></div>
        </div>
        ${renderQuantCards()}
        ${renderContextEvidence()}
        <div class="grid-2" style="margin-top:16px">
          <div class="chart-box">
            <div class="panel-head"><div><h3>אותו זוג לאורך הקטעים</h3><p>האם הקרבה יציבה, או תלויה בקטע מסוים?</p></div>
              <select id="trajectoryMetric" class="small-btn">
                ${metricOptions(state.sectionMatrixMetric, ['raw','bits','locus_overlap','reading_agreement'])}
              </select>
            </div>
            <div id="pairTrajectory"></div>
          </div>
          <div>
            <div class="panel-head"><div><h3>הזוגות הבולטים ב־§${esc(state.section)}</h3><p>דירוג מתוך חבילת הנתונים החדשים; לחיצה מחליפה את פרשן א׳ ו־ב׳.</p></div></div>
            ${renderSectionRanking(state.section)}
          </div>
        </div>
        <div style="margin-top:20px">
          <div class="panel-head"><div><h3>מטריצת פרשנים לקטע הנבחר</h3><p>כל תא הוא זוג פרשנים באותו קטע. לחיצה מחזירה מן המספר אל הטקסט והרשת.</p></div>
            <select id="sectionMatrixMetric" class="small-btn">${metricOptions(state.sectionMatrixMetric, ['raw','bits','locus_overlap','reading_agreement'])}</select>
          </div>
          <div id="sectionPairHeatmap"></div>
        </div>
      </section>
    `;

    root.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'})));
    root.querySelectorAll('[data-concept]').forEach(b => b.addEventListener('click', () => { state.selectedTerm = b.dataset.concept; renderJourney(); }));
    root.querySelector('#tagsAll')?.addEventListener('click',()=>{state.textTagMode='all';state.textActiveTypes=[];renderJourney();});
    root.querySelector('#tagsNone')?.addEventListener('click',()=>{state.textTagMode='custom';state.textActiveTypes=[];renderJourney();});
    root.querySelectorAll('[data-tag-type]').forEach(inp=>inp.addEventListener('change',()=>{
      const available=textTagTypesForGraphs([gR,gA,gB]);
      let active=new Set(state.textTagMode==='all'?available:state.textActiveTypes);
      state.textTagMode='custom'; if(inp.checked)active.add(inp.dataset.tagType);else active.delete(inp.dataset.tagType);state.textActiveTypes=[...active];renderJourney();
    }));
    root.querySelectorAll('[data-paira]').forEach(r => r.addEventListener('click', () => { state.a=canon(r.dataset.paira); state.b=canon(r.dataset.pairb); syncSelectors(); renderJourney(); }));
    root.querySelector('#clearTerm')?.addEventListener('click', () => { state.selectedTerm=''; renderJourney(); });

    setupNetworkPanel(gR, gA, gB);
    const traj = root.querySelector('#trajectoryMetric');
    if (traj) traj.addEventListener('change', () => { state.sectionMatrixMetric = traj.value; renderJourney(); });
    const sm = root.querySelector('#sectionMatrixMetric');
    if (sm) sm.addEventListener('change', () => { state.sectionMatrixMetric = sm.value; renderJourney(); });
    renderPairTrajectory(root.querySelector('#pairTrajectory'), state.a, state.b, state.sectionMatrixMetric);
    renderSectionPairHeatmap(root.querySelector('#sectionPairHeatmap'), state.section, state.sectionMatrixMetric);
    const evidenceKey = Object.keys(reports).find(k => k.includes('05_גיליון_ראיות'));
    root.querySelector('#openEvidenceReport')?.addEventListener('click',()=>{ if(evidenceKey) state.reportId=evidenceKey; switchTab('reports'); });
  }

  function renderTextTagControls(graphs) {
    const types=textTagTypesForGraphs(graphs); if(!types.length)return '';
    const active=new Set(state.textTagMode==='all'?types:state.textActiveTypes);
    return `<div class="tag-toolbar">
      <div class="tag-toolbar-head"><div><strong>תיוג הטקסט</strong><span class="tiny muted"> כל סוג תג מקבל צבע קבוע; אפשר להציג כמה שכבות במקביל.</span></div><div class="controls"><button id="tagsAll" class="small-btn ${state.textTagMode==='all'?'is-active':''}">הדלק הכל</button><button id="tagsNone" class="small-btn">כבה הכל</button></div></div>
      <div class="tag-type-list">${types.map(t=>`<label class="tag-type-toggle ${active.has(t)?'is-on':''}" style="--tag-color:${typeColor(t)}"><input type="checkbox" data-tag-type="${escAttr(t)}" ${active.has(t)?'checked':''}><i></i><span>${esc(typeLabel(t))}</span><small>${esc(t)}</small></label>`).join('')}</div>
    </div>`;
  }
  function textTagTypesForGraphs(graphs){return [...new Set(graphs.filter(Boolean).flatMap(g=>(g.nodes||[]).map(n=>n.type||'Unknown')))].sort((a,b)=>typeLabel(a).localeCompare(typeLabel(b),'he'))}
  function activeTextTypes(graph){const available=textTagTypesForGraphs([graph]);return new Set(state.textTagMode==='all'?available:state.textActiveTypes)}

  function renderTexts(gR, gA, gB) {
    const items = uniqueBy([
      {id:'RAMBAN', graph:gR},
      {id:state.a, graph:gA},
      {id:state.b, graph:gB},
    ], x => canon(x.id));
    return `<div class="text-grid">${items.map(({id,graph}) => renderTextCard(id, graph)).join('')}</div>`;
  }

  function renderTextCard(id, graph) {
    const label = displayName(id);
    if (!graph) return `<article class="text-card"><div class="text-card-head"><h4>${esc(label)}</h4><span class="badge badge-warn">אין נתון בנתונים הישנים · שכבת הטקסט</span></div><div class="text-empty">החיבור אינו מופיע בקטע זה בנתונים הישנים · E2.</div></article>`;
    const top = topGraphConcepts(graph, 13);
    return `<article class="text-card">
      <div class="text-card-head"><h4>${esc(label)}</h4><span class="badge badge-net">${graph.nodeCount || graph.nodes?.length || 0} מושגים · ${graph.edgeCount || graph.edges?.length || 0} קשרים</span></div>
      <div class="text-card-body tagged-text">${annotateText(graph.text || '', graph, state.selectedTerm)}</div>
      <div class="concept-summary">
        <div class="tiny muted">מושגים בולטים ברשת · הצבע מציין את סוג המושג</div>
        <div class="concept-strip">${top.map(n => `<button class="concept-chip ${state.selectedTerm === n.label ? 'is-active':''}" data-concept="${escAttr(n.label)}" title="${escAttr(typeLabel(n.type))}" style="--chip-color:${typeColor(n.type)}"><i class="concept-dot"></i>${esc(truncate(n.label,34))}</button>`).join('')}</div>
      </div>
    </article>`;
  }

  function renderLiteralShared(gA, gB) {
    if (!gA || !gB) return '';
    const shared = literalSharedConcepts(gA, gB).slice(0, 40);
    return `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
      <div class="tiny"><span class="badge badge-net">בדיקת תצוגה</span> תוויות מושג זהות מילולית בין ${esc(displayName(state.a))} ל־${esc(displayName(state.b))}: <strong>${shared.length}</strong>${literalSharedConcepts(gA,gB).length > 40 ? ' (מוצגים 40)' : ''}</div>
      <div class="concept-strip">${shared.map(x => `<button class="concept-chip" data-concept="${escAttr(x)}">${esc(truncate(x,40))}</button>`).join('')}</div>
    </div>`;
  }

  function setupNetworkPanel(gR,gA,gB) {
    const host = document.getElementById('networkHost');if (!host) return;
    const modes = [
      ['ramban-overlay','רמב״ן + א׳ + ב׳', !!(gR&&(gA||gB))],
      ['overlay','השוואה א׳↔ב׳', !!(gA&&gB)],
      ['a',displayName(state.a),!!gA],['b',displayName(state.b),!!gB],['r','רמב״ן',!!gR],
    ].filter(x => x[2]);
    if (!modes.length) { host.innerHTML = `<div class="notice">אין גרף E2 זמין לקטע ולבחירות הנוכחיות.</div>`; return; }
    if (!modes.some(m => m[0] === state.netMode)) state.netMode = modes[0][0];
    const triple=state.netMode==='ramban-overlay';
    const graph = triple ? overlayManyGraphs([{graph:gR,owner:'RAMBAN'},{graph:gA,owner:canon(state.a)},{graph:gB,owner:canon(state.b)}]) : state.netMode === 'overlay' ? overlayGraphs(gA,gB,state.a,state.b) : state.netMode === 'a' ? gA : state.netMode === 'b' ? gB : gR;
    const predicates=[...new Set((graph?.edges||[]).map(e=>e.predicate||'relatedTo'))].sort((a,b)=>predicateLabel(a).localeCompare(predicateLabel(b),'he'));if(state.netPredicate!=='all'&&!predicates.includes(state.netPredicate))state.netPredicate='all';
    host.innerHTML = `<div class="network-shell">
      <div class="network-toolbar"><div class="network-toolbar-groups"><div class="segmented">${modes.map(m => `<button data-netmode="${m[0]}" class="${state.netMode===m[0]?'is-active':''}">${esc(m[1])}</button>`).join('')}</div><div class="segmented net-color-toggle" aria-label="שיטת צביעה"><button data-netcolor="type" class="${state.netColorMode==='type'?'is-active':''}">מה זה?</button><button data-netcolor="owner" class="${state.netColorMode==='owner'?'is-active':''}">מי זה?</button></div></div><div class="controls"><select id="netPredicate" class="small-btn relation-select" title="סינון לפי סוג קשר"><option value="all">כל סוגי הקשרים</option>${predicates.map(p=>`<option value="${escAttr(p)}" ${state.netPredicate===p?'selected':''}>${esc(predicateLabel(p))} · ${esc(p)}</option>`).join('')}</select><label class="tiny"><input type="checkbox" id="netLabels" ${state.netLabels?'checked':''}> תוויות צמתים</label><label class="tiny"><input type="checkbox" id="netEdgeLabels" ${state.netEdgeLabels?'checked':''}> סוג קשר על הקשת</label><label class="tiny"><input type="checkbox" id="netFull" ${state.netFull?'checked':''}> רשת רחבה</label><button class="small-btn" id="netFit">התאם למסגרת</button></div></div>
      ${triple?`<div class="notice overlap-note"><strong>רשת חפיפה תלת־שכבתית.</strong> הרמב״ן הוא שכבת הבסיס; פרשן א׳ ופרשן ב׳ מונחים עליה. במצב <strong>“מה זה?”</strong> הצבע הראשי מסמן סוג ישות/יחס והמסגרת שומרת את הבעלות; במצב <strong>“מי זה?”</strong> הצבע הראשי מסמן רמב״ן/א׳/ב׳ והחפיפות, והמסגרת שומרת את סוג הישות. דפוס הקו ממשיך לסמן בעלות על הקשר. איחוד מושגים בתצוגה זו מבוסס על תווית מנורמלת לצורך המחשה.</div>${tripleOverlapSummary(gR,gA,gB)}`:state.netMode==='overlay'?`<div class="notice" style="margin:8px 10px 0">בתצוגת ההשוואה, איחוד צמתים נעשה לפי תווית מנורמלת לצורכי המחשה בלבד. עברו בין “מה זה?” ל“מי זה?” כדי לקרוא את אותה רשת לפי סוגי ישויות/יחסים או לפי בעלות פרשנית.</div>`:''}
      <div class="network-key"><strong>גרף־ידע:</strong> ${state.netColorMode==='owner'?'צבע הצומת והקשת = מי משתמש/אומר · מסגרת הצומת = סוג הישות · תווית הקשת = סוג היחס':'צבע הצומת = סוג ישות · צבע הקשת והחץ = סוג היחס · בחפיפה מסגרת הצומת = מי משתמש במושג'} · לחיצה על קשת מציגה את הראיה הטקסטואלית.</div><div class="network-canvas" id="networkCanvas"></div>
    </div>`;
    host.querySelectorAll('[data-netmode]').forEach(b => b.addEventListener('click',()=>{state.netMode=b.dataset.netmode;state.netPredicate='all';renderJourney();}));host.querySelectorAll('[data-netcolor]').forEach(b=>b.addEventListener('click',()=>{state.netColorMode=b.dataset.netcolor;renderJourney();}));host.querySelector('#netLabels')?.addEventListener('change',e=>{state.netLabels=e.target.checked;renderJourney();});host.querySelector('#netEdgeLabels')?.addEventListener('change',e=>{state.netEdgeLabels=e.target.checked;renderJourney();});host.querySelector('#netFull')?.addEventListener('change',e=>{state.netFull=e.target.checked;renderJourney();});host.querySelector('#netPredicate')?.addEventListener('change',e=>{state.netPredicate=e.target.value;renderJourney();});
    requestAnimationFrame(() => {const api = renderNetwork(document.getElementById('networkCanvas'), graph, {labels:state.netLabels, edgeLabels:state.netEdgeLabels, predicate:state.netPredicate, maxNodes: state.netFull ? 260 : 155,onSelect: showNetworkDetail,colorMode:state.netColorMode,ownerStyle:(triple||state.netMode==='overlay'),ownerLayout:(triple||state.netMode==='overlay')?{base:'RAMBAN',a:state.a,b:state.b}:null,defaultOwner:state.netMode==='a'?state.a:state.netMode==='b'?state.b:state.netMode==='r'? 'RAMBAN':null,layoutKey:`journey|${state.section}|${state.netMode}|${state.a}|${state.b}|${state.netFull?'full':'sample'}`});host.querySelector('#netFit')?.addEventListener('click',()=>api?.fit());});
  }

  function showNetworkDetail(item) {
    const d = document.getElementById('networkDetail');
    if (!d || !item) return;
    if (item.kind === 'node') {
      const n = item.node;
      const edges = item.edges || [];
      d.innerHTML = `<h4>${esc(n.label)}</h4><div class="tag-list"><span class="tag" style="border-color:${typeColor(n.type)}"><i class="legend-dot" style="background:${typeColor(n.type)}"></i>${esc(typeLabel(n.type))}</span>${n.owners?`<span class="tag">${esc(n.owners.map(displayName).join(' · '))}</span>`:''}</div>
        ${n.description ? `<p>${esc(n.description)}</p>`:''}<div class="tiny muted">קשרים נראים: ${edges.length}</div>
        <div class="detail-list">${edges.slice(0,40).map(e=>`<div class="evidence-row"><span class="relation-swatch" style="--rel-color:${predicateColor(e.predicate)}"></span><strong>${esc(predicateLabel(e.predicate))}</strong> <code>${esc(e.predicate||'relatedTo')}</code><br>${esc(e.evidenceText||'אין ראיית טקסט זמינה')}</div>`).join('')}</div>`;
    } else {
      const e=item.edge;
      d.innerHTML=`<h4><span class="relation-swatch" style="--rel-color:${predicateColor(e.predicate)}"></span>${esc(predicateLabel(e.predicate))}</h4><div class="tiny muted ltr">${esc(e.predicate||'relatedTo')}</div><p><strong>${esc(item.sourceLabel||e.source)}</strong> <span class="relation-arrow">←</span> <strong>${esc(item.targetLabel||e.target)}</strong></p>${e.owners?`<p class="tiny"><span class="badge badge-net">${esc(e.owners.map(displayName).join(' · '))}</span></p>`:''}<div class="notice">${esc(e.evidenceText||'אין evidenceText לקשר זה')}</div>`;
    }
  }

  function renderContextEvidence() {
    const evidenceKey = Object.keys(reports).find(k => k.includes('05_גיליון_ראיות'));
    const content = evidenceKey ? (reports[evidenceKey]?.content || '') : '';
    const oa = toOldId(state.a), ob = toOldId(state.b);
    const ida = `kg_${state.section}_${oa}`, idb = `kg_${state.section}_${ob}`;
    const blocks = content.split(/\n(?=### )/);
    const block = blocks.find(x => x.includes(ida) && x.includes(idb));
    if (!block) return `<div class="data-source-card" style="margin-top:14px"><span class="badge badge-quant">גיליון הראיות</span><strong style="margin-right:8px">אין מקרה ראיה מפורט לזוג הזה בגיליון הנבחר.</strong>${evidenceKey?` <button class="small-btn" id="openEvidenceReport">פתח את גיליון הראיות המלא</button>`:''}</div>`;
    return `<div class="data-source-card" style="margin-top:14px"><div class="panel-head"><div><span class="badge badge-quant">ראיה מילולית מחוברת לזוג</span><h3 style="margin-top:6px">המספר חוזר לראיה</h3></div><button class="small-btn" id="openEvidenceReport">גיליון הראיות המלא</button></div><div class="markdown" style="min-height:0;padding:16px;border:0;background:#fbfaf6">${markdownToHtml(block)}</div></div>`;
  }

  function renderQuantCards() {
    const p = getPairRow(state.section,state.a,state.b);
    const d = getDecompRow(state.section,state.a,state.b);
    const cc = coClusterMap.get(pairKey(state.a,state.b));
    const oldA = oldAlign(state.section,state.a);
    const oldB = oldAlign(state.section,state.b);
    const cards = [
      qCard('D1 / raw', p?.raw, 'דמיון תוכן בסעיף', 'נתונים חדשים · כימות'),
      qCard('bits', p?.bits, 'כמות ראיה מכוילת', 'נתונים חדשים · כימות'),
      qCard('חפיפת מוקדים', d?.locus_overlap, 'כמה מן המושגים חופפים', 'נתונים חדשים · כימות'),
      qCard('הסכמת קריאה', d?.reading_agreement, 'הסכמה בטענות בנות־השוואה', 'נתונים חדשים · כימות'),
      qCard('קו־אשכול', cc?.co_cluster_rate, cc ? `${cc.shared_sections} סעיפים משותפים` : 'אין נתון רוחבי לזוג', 'נתונים חדשים · כימות'),
      qCard('חריגות בתוך הסעיף', p?.within_section_z, 'within-section z', 'נתונים חדשים · כימות'),
      oldCard(`${displayName(state.a)} ↔ רמב״ן`, oldA, 'align מן הדשבורד הישן'),
      oldCard(`${displayName(state.b)} ↔ רמב״ן`, oldB, 'align מן הדשבורד הישן'),
    ];
    return `<div class="grid-4">${cards.join('')}</div>
      <div class="tiny muted" style="margin-top:10px">${d ? `לזוג הנבחר: ${fmt(d.n_shared_concepts,0)} מושגים משותפים · ${fmt(d.n_comparable_claims,0)} טענות בנות־השוואה.` : 'אין שורת פירוק התפזרות לזוג הנבחר בסעיף זה.'}</div>`;
  }

  function qCard(label,value,note,src){return `<div class="metric-card quant"><span class="badge badge-quant">${esc(src)}</span><div class="metric-value">${fmt(value)}</div><div class="metric-label">${esc(label)}</div><div class="metric-note">${esc(note)}</div></div>`}
  function countCard(label,value,note,src){return `<div class="metric-card quant"><span class="badge badge-quant">${esc(src)}</span><div class="metric-value">${fmt(value,0)}</div><div class="metric-label">${esc(label)}</div><div class="metric-note">${esc(note)}</div></div>`}
  function oldCard(label,value,note){return `<div class="metric-card old"><span class="badge badge-net">נתונים ישנים</span><div class="metric-value">${fmt(value)}</div><div class="metric-label">${esc(label)}</div><div class="metric-note">${esc(note)}</div></div>`}

  function renderSectionRanking(section) {
    const rows=(bySectionPairs.get(String(section))||[]).slice().sort((a,b)=>(num(b.bits)??-999)-(num(a.bits)??-999)).slice(0,12);
    if(!rows.length)return `<div class="notice">אין זוגות מדורגים בקטע זה.</div>`;
    return `<div class="table-wrap" style="max-height:330px"><table class="data-table"><thead><tr><th>זוג</th><th>raw</th><th>bits</th><th>z</th></tr></thead><tbody>${rows.map(r=>`<tr class="clickable" data-paira="${escAttr(canon(r.comm_a))}" data-pairb="${escAttr(canon(r.comm_b))}"><td>${esc(displayName(r.comm_a))} ↔ ${esc(displayName(r.comm_b))}</td><td class="num">${fmt(r.raw)}</td><td class="num">${fmt(r.bits)}</td><td class="num">${fmt(r.within_section_z)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPairTrajectory(container,a,b,metric){
    if(!container)return;
    const points=[];
    for(const s of allSections){const v=sectionPairValue(s,a,b,metric); if(Number.isFinite(v))points.push({section:s,value:v});}
    if(!points.length){container.innerHTML='<div class="notice">אין סדרת קטעים לזוג ולמדד הנבחר.</div>';return;}
    const width=700,height=245,pad={l:35,r:15,t:15,b:48}; const vals=points.map(p=>p.value); let min=Math.min(...vals),max=Math.max(...vals); if(min===max){min-=.05;max+=.05}
    const x=i=>pad.l+i*(width-pad.l-pad.r)/Math.max(1,points.length-1); const y=v=>pad.t+(max-v)*(height-pad.t-pad.b)/(max-min);
    const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    container.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img"><line class="chart-axis" x1="${pad.l}" y1="${height-pad.b}" x2="${width-pad.r}" y2="${height-pad.b}"/><path class="chart-line" d="${path}"/>${points.map((p,i)=>`<circle class="chart-dot" data-section="${escAttr(p.section)}" cx="${x(i)}" cy="${y(p.value)}" r="4"><title>§${esc(p.section)} · ${metricLabel(metric)}: ${fmt(p.value)}</title></circle>`).join('')}${points.map((p,i)=>i%Math.ceil(points.length/10)===0?`<text class="chart-label" x="${x(i)}" y="${height-20}" text-anchor="middle">§${esc(p.section)}</text>`:'').join('')}<text class="chart-label" x="${pad.l}" y="12">${fmt(max)}</text><text class="chart-label" x="${pad.l}" y="${height-pad.b-4}">${fmt(min)}</text></svg>`;
    container.querySelectorAll('[data-section]').forEach(c=>c.addEventListener('click',()=>{state.section=c.dataset.section;els.sectionSelect.value=state.section;updateContextCaption();renderJourney();}));
  }

  function renderSectionPairHeatmap(container,section,metric){
    if(!container)return;
    const rows = metric==='raw'||metric==='bits' ? (bySectionPairs.get(String(section))||[]) : (bySectionDecomp.get(String(section))||[]);
    const cs=[...new Set(rows.flatMap(r=>metric==='raw'||metric==='bits'?[canon(r.comm_a),canon(r.comm_b)]:[canon(r.a),canon(r.b)]))].sort((a,b)=>displayName(a).localeCompare(displayName(b),'he'));
    if(!cs.length){container.innerHTML='<div class="notice">אין מטריצה כמותית לקטע זה.</div>';return;}
    renderHeatmap(container,cs,cs,(r,c)=>r===c?(metric==='bits'?null:1):sectionPairValue(section,r,c,metric),{
      min:metric==='bits'?-1:0,max:metric==='bits'?6.5:1,diagonal:true,
      rowName:displayName,colName:displayName,
      onClick:(r,c,v)=>{if(r===c)return;state.a=r;state.b=c;syncSelectors();renderJourney();},
      title:(r,c,v)=>`${displayName(r)} ↔ ${displayName(c)} · ${metricLabel(metric)}: ${fmt(v)}`
    });
  }

  /* -------------------- COMMENTATOR -------------------- */
  async function renderCommentator(){
    const root=els.views.commentator;root.innerHTML=skeleton('טוען פרופיל פרשן…');
    await ensureCommentator(state.a);
    const c=window.RAMBAN_V2_COMMENTATORS[toOldId(state.a)] || null;
    const summary=oldCommentatorSummary[toOldId(state.a)] || null;
    const close=closenessMap.get(canon(state.a));
    const method=c?.methodProfile||summary?.methodProfile;
    const struct=c?.structureProfile||summary?.structureProfile;
    const source=c?.sourceProfile||summary?.sourceProfile;
    const scriptural=c?.scripturalProfile||summary?.scripturalProfile;
    const peers=commentatorPeerRows(state.a,c);
    const graph=c?.aggregateGraph||null;
    const topPeer=peers.filter(x=>Number.isFinite(x.meanRaw)).sort((a,b)=>b.meanRaw-a.meanRaw)[0];
    const topCluster=peers.filter(x=>Number.isFinite(x.coCluster)).sort((a,b)=>b.coCluster-a.coCluster)[0];
    const oldPeer=peers.filter(x=>Number.isFinite(x.oldSimilarity)).sort((a,b)=>b.oldSimilarity-a.oldSimilarity)[0];
    const secRows=commentatorSectionAnalytics(c||summary,state.a);
    const bestSec=secRows.filter(x=>Number.isFinite(x.align)).sort((a,b)=>b.align-a.align)[0];
    const lowSec=secRows.filter(x=>Number.isFinite(x.align)).sort((a,b)=>a.align-b.align)[0];
    root.innerHTML=`
      <section class="panel commentator-hero">
        <div class="profile-header">
          <div class="profile-title"><span class="badge badge-text">פרופיל מלא</span><h2>${esc(displayName(state.a))}</h2><p class="muted">מבט אנכי על החיבור לאורך הקורפוס: נוכחות, טקסט ורשת, חתימה פרשנית, קרבה לרמב״ן, יחסים עם שאר הפרשנים ומקומו במבנה האשכולות.</p></div>
          <div class="grid-4">
            ${oldCard('קטעים בשכבת E2',summary?.sections?.length ?? c?.sections?.length,'נוכחות טקסט/גרף')}
            ${oldCard('align ממוצע לרמב״ן',summary?.avgAlignVsRamban ?? c?.avgAlignVsRamban,'מדד E3 מן הנתונים הישנים')}
            ${qCard('D1 לרמב״ן',close?.content_D1cov,'קרבה רוחבית לטקסט הבסיס','נתונים חדשים · כימות')}
            ${qCard('דירוג ממוצע',close?.mean_rank,'קרבה לרמב״ן במספר מדדים','נתונים חדשים · כימות')}
          </div>
        </div>
      </section>
      <section class="panel"><div class="panel-head"><div><h3>תקציר אנליטי</h3><p>מסקנות תיאוריות שמחושבות מכל שכבות הנתונים הזמינות לחיבור זה.</p></div></div>
        <div class="profile-insight-grid">
          ${profileInsight('הקרוב ביותר בתוכן',topPeer?displayName(topPeer.peer):'—',topPeer?`mean raw ${fmt(topPeer.meanRaw)} · ${topPeer.sections} קטעים`:'אין נתון כמותי')}
          ${profileInsight('הקשר החוזר ביותר',topCluster?displayName(topCluster.peer):'—',topCluster?`קו־אשכול ${fmt(topCluster.coCluster)} · ${topCluster.sharedSections||0} סעיפים`:'אין קו־אשכול')}
          ${profileInsight('הקרוב בחתימת E3',oldPeer?displayName(oldPeer.peer):'—',oldPeer?`דמיון ${fmt(oldPeer.oldSimilarity)}`:'אין נתון')}
          ${profileInsight('הקטע הקרוב ביותר לרמב״ן',bestSec?`§${bestSec.section}`:'—',bestSec?`${esc(sectionMap[bestSec.section]?.passage_suggested||'')} · align ${fmt(bestSec.align)}`:'אין נתון')}
          ${profileInsight('הקטע הרחוק ביותר מהרמב״ן',lowSec?`§${lowSec.section}`:'—',lowSec?`${esc(sectionMap[lowSec.section]?.passage_suggested||'')} · align ${fmt(lowSec.align)}`:'אין נתון')}
          ${profileInsight('היקף הרשת המצטברת',graph?`${fmt(graph.nodeCount||graph.nodes?.length,0)} מושגים`:'—',graph?`${fmt(graph.edgeCount||graph.edges?.length,0)} קשרים · ${fmt(num(struct?.communities),0)} קהילות־רשת`:'אין רשת מצטברת')}
        </div>
      </section>
      <div class="grid-2">
        <section class="panel layer-network"><div class="panel-head"><div><h3>חתימה פרשנית, מקורות ומבנה</h3><p>הנתונים המקוריים של E2/E3 מפוענחים כאן גם כאשר נשמרו כמחרוזות ולא כמערכים.</p></div><span class="badge badge-net">נתונים ישנים · E2/E3</span></div>
          ${renderProfiles(method,struct,source,scriptural)}
        </section>
        <section class="panel layer-quant"><div class="panel-head"><div><h3>קרבה לרמב״ן — פירוק מדדים</h3><p>מדדי הקרבה החדשים מוצגים לצד align, ללא ערבוב בין שיטות החישוב.</p></div><span class="badge badge-quant">נתונים חדשים · כימות</span></div>
          ${close?`<div class="grid-2">${qCard('D1 תוכן',close.content_D1cov,'חפיפת תוכן','נתונים חדשים · כימות')}${qCard('D5 סדר',close.order_D5,'סדר רעיונות','נתונים חדשים · כימות')}${qCard('קו־אשכול',close.co_cluster,'התקבצות חוזרת','נתונים חדשים · כימות')}${qCard('רגיסטר',close.register_sim,'דמיון רגיסטר','נתונים חדשים · כימות')}</div>`:'<div class="notice">אין שורת קרבה לרמב״ן לחיבור זה בנתונים החדשים.</div>'}
        </section>
      </div>
      <section class="panel"><div class="panel-head"><div><h3>הפרשן לאורך הקורפוס — שני מבטים</h3><p>הקו הכהה הוא align לרמב״ן; הקו השני הוא הדמיון הממוצע של הפרשן לכל שאר הפרשנים באותו קטע. כך רואים אם קרבה לטקסט הבסיס וקרבה למסורת נעות יחד.</p></div></div><div id="commentatorTrajectory" class="chart-box"></div></section>
      <section class="panel layer-network"><div class="panel-head"><div><h3>הרשת המצטברת של הפרשן</h3><p>איחוד יחסי הידע מכל הקטעים שבהם החיבור מופיע. סוגי הקודקודים והקשרים נשמרים.</p></div></div><div id="commentatorNetwork" class="network-canvas" style="height:650px;border:1px solid var(--line);border-radius:14px"></div></section>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><div><h3>סוגי מושגים</h3><p>התפלגות סוגי הקודקודים ברשת המצטברת.</p></div></div><div id="commentatorTypeBars"></div></section>
        <section class="panel"><div class="panel-head"><div><h3>סוגי יחסים</h3><p>הקשרים שבהם החיבור משתמש בתדירות הגבוהה ביותר.</p></div></div><div id="commentatorRelationBars"></div></section>
      </div>
      <section class="panel"><div class="panel-head"><div><h3>מיקום ביחס לכל שאר הפרשנים</h3><p>כל שורה מחברת את הדמיון מן הנתונים הישנים, דמיון התוכן החדש, חפיפת המוקדים, הסכמת הקריאה וקו־האשכול. אין חיבור מלאכותי לציון אחד.</p></div></div>${renderCommentatorPeerTable(peers)}</section>
      <section class="panel"><div class="panel-head"><div><h3>כל הקטעים שבהם הפרשן מופיע</h3><p>לכל קטע: הקרבה לרמב״ן, היקף החפיפה עמו, הדמיון הממוצע לשאר הפרשנים והפרשן הקרוב ביותר באותו מקור.</p></div></div>${renderCommentatorSections(c||summary)}</section>
    `;
    if(graph) requestAnimationFrame(()=>renderNetwork(document.getElementById('commentatorNetwork'),graph,{labels:true,edgeLabels:false,maxNodes:170,onSelect:()=>{},layoutKey:`commentator|${state.a}`}));
    else document.getElementById('commentatorNetwork').innerHTML='<div class="text-empty">אין רשת מצטברת זמינה.</div>';
    renderCommentatorTrajectory(root.querySelector('#commentatorTrajectory'),secRows);
    renderDistributionBars(root.querySelector('#commentatorTypeBars'),graphTypeCounts(graph),typeLabel,typeColor);
    renderDistributionBars(root.querySelector('#commentatorRelationBars'),graphPredicateCounts(graph),predicateLabel,predicateColor);
    root.querySelectorAll('[data-section]').forEach(r=>r.addEventListener('click',()=>{state.section=r.dataset.section;syncSelectors();switchTab('journey');}));
    root.querySelectorAll('[data-peer]').forEach(r=>r.addEventListener('click',()=>{state.b=canon(r.dataset.peer);syncSelectors();switchTab('journey');}));
  }

  function profileInsight(title,value,note){return `<div class="profile-insight"><small>${esc(title)}</small><strong>${value}</strong><span>${note}</span></div>`}
  function parseProfileEntries(value){
    if(!value)return [];
    if(Array.isArray(value))return value.map(x=>{if(typeof x==='string')return parseProfileToken(x);if(Array.isArray(x))return {label:String(x[0]??''),count:num(x[1])};if(typeof x==='object')return {label:String(x.label??x.term??x.predicate??x.concept??x.source??''),count:num(x.count??x.n??x.value)};return {label:String(x),count:null}}).filter(x=>x.label);
    if(typeof value==='string')return value.split(/\s*;\s*/).filter(Boolean).map(parseProfileToken);
    return [];
  }
  function parseProfileToken(x){const s=String(x||'').trim();const m=s.match(/^(.*?):\s*(-?\d+(?:\.\d+)?)\s*$/);return m?{label:m[1].trim(),count:num(m[2])}:{label:s,count:null}}
  function renderProfileTags(value,limit=12){const rows=parseProfileEntries(value).slice(0,limit);return rows.length?`<div class="tag-list">${rows.map(x=>`<span class="tag">${esc(x.label)}${Number.isFinite(x.count)?` <b>${fmt(x.count,0)}</b>`:''}</span>`).join('')}</div>`:'<span class="muted">—</span>'}
  function renderProfiles(method,struct,source,scriptural){
    return `<div class="profile-detail-grid">
      <div><div class="tiny muted">יחסים / מתודות בולטים</div>${renderProfileTags(method?.top_predicates,10)}</div>
      <div><div class="tiny muted">מונחי פרשנות</div>${renderProfileTags(method?.method_terms,12)}</div>
      <div><div class="tiny muted">מושגי ליבה</div>${renderProfileTags(struct?.core_concepts,15)}</div>
      <div><div class="tiny muted">מושגי גישור</div>${renderProfileTags(struct?.bridge_concepts,15)}</div>
      <div><div class="tiny muted">מקורות בולטים</div>${renderProfileTags(source?.top_sources,12)}</div>
      <div><div class="tiny muted">ספרי מקרא / עוגנים</div>${renderProfileTags(scriptural?.books,12)}</div>
    </div>`;
  }

  function commentatorPeerRows(id,c){
    const cid=canon(id), oldMap=new Map();
    for(const r of c?.peerSimilarities||[])oldMap.set(canon(r.commentatorId),num(r.similarity));
    for(const r of OLD.global.commentatorSimilarity?.pairs||[]){const a=canon(r.source),b=canon(r.target);if(a===cid)oldMap.set(b,num(r.similarity));else if(b===cid)oldMap.set(a,num(r.similarity));}
    return clusterIdsGlobal().filter(x=>x!==cid).map(peer=>{const pm=pairMeans.get(pairKey(cid,peer))||{},cc=coClusterMap.get(pairKey(cid,peer));return {peer,oldSimilarity:oldMap.get(peer),meanRaw:num(pm.mean_raw),meanBits:num(pm.mean_bits),meanLocus:num(pm.mean_locus),meanReading:num(pm.mean_reading),coCluster:num(cc?.co_cluster_rate),sharedSections:num(cc?.shared_sections),sections:pairSectionCount(cid,peer)}}).sort((a,b)=>(b.coCluster??b.meanRaw??-1)-(a.coCluster??a.meanRaw??-1));
  }
  function pairSectionCount(a,b){const set=new Set();for(const r of Q['כל_הזוגות_מדורגים']||[])if(pairKey(r.comm_a,r.comm_b)===pairKey(a,b))set.add(String(r.section));return set.size}
  function renderCommentatorPeerTable(rows){if(!rows.length)return '<div class="notice">אין נתוני עמיתים.</div>';return `<div class="table-wrap"><table class="data-table"><thead><tr><th>פרשן אחר</th><th>דמיון E3</th><th>ממוצע raw</th><th>ממוצע bits</th><th>ממוצע חפיפת מוקדים</th><th>ממוצע הסכמת קריאה</th><th>קו־אשכול</th><th>סעיפים</th></tr></thead><tbody>${rows.map(r=>`<tr class="clickable" data-peer="${escAttr(r.peer)}"><td>${esc(displayName(r.peer))}</td><td class="num">${fmt(r.oldSimilarity)}</td><td class="num">${fmt(r.meanRaw)}</td><td class="num">${fmt(r.meanBits)}</td><td class="num">${fmt(r.meanLocus)}</td><td class="num">${fmt(r.meanReading)}</td><td class="num">${fmt(r.coCluster)}</td><td class="num">${fmt(r.sharedSections??r.sections,0)}</td></tr>`).join('')}</tbody></table></div>`}
  function commentatorSectionAnalytics(c,id){
    const rows=(c?.sections||[]).map(r=>{const sid=String(r.sectionId),stats=sectionPeerStats(sid,id);return {section:sid,align:num(r.align),shared:num(r.sharedCount),meanRaw:stats.meanRaw,bestPeer:stats.bestPeer,bestRaw:stats.bestRaw,nPeers:stats.nPeers}});return rows.sort((a,b)=>sectionSortKey(a.section)-sectionSortKey(b.section));
  }
  function sectionPeerStats(section,id){const cid=canon(id),rows=joinedSectionPairs(section).filter(r=>r.a===cid||r.b===cid),vals=rows.map(r=>r.raw).filter(Number.isFinite);const best=rows.filter(r=>Number.isFinite(r.raw)).sort((a,b)=>b.raw-a.raw)[0];return {meanRaw:mean(vals),bestPeer:best?(best.a===cid?best.b:best.a):null,bestRaw:best?.raw,nPeers:rows.length}}
  function renderCommentatorSections(c){
    const rows=commentatorSectionAnalytics(c,state.a);if(!rows.length)return '<div class="notice">אין פירוט קטעים בשכבה הישנה.</div>';
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>קטע</th><th>פסוק / דיבור</th><th>align לרמב״ן</th><th>מושגים משותפים עם הרמב״ן</th><th>ממוצע raw לעמיתים</th><th>העמית הקרוב בקטע</th><th>raw מרבי</th></tr></thead><tbody>${rows.map(r=>{const m=sectionMap[r.section]||{};return `<tr class="clickable" data-section="${escAttr(r.section)}"><td>§${esc(r.section)}</td><td>${esc(m.passage_suggested||'')}<div class="tiny muted">${esc(truncate(m.lemma||'',70))}</div></td><td class="num">${fmt(r.align)}</td><td class="num">${fmt(r.shared,0)}</td><td class="num">${fmt(r.meanRaw)}</td><td>${r.bestPeer?esc(displayName(r.bestPeer)):'—'}</td><td class="num">${fmt(r.bestRaw)}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  function renderCommentatorTrajectory(container,rows){if(!container||!rows.length)return;const W=1000,H=300,p={l:48,r:25,t:24,b:58},x=i=>p.l+i*(W-p.l-p.r)/Math.max(1,rows.length-1),y=v=>H-p.b-Math.max(0,Math.min(1,v))*(H-p.t-p.b);const path=(key)=>rows.map((r,i)=>Number.isFinite(r[key])?`${i?'L':'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`:'').filter(Boolean).join(' ');container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="profile-trajectory"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/><path d="${path('align')}" class="profile-line align-line"/><path d="${path('meanRaw')}" class="profile-line peer-line"/>${rows.map((r,i)=>`<g class="profile-point" data-section="${escAttr(r.section)}">${Number.isFinite(r.align)?`<circle cx="${x(i)}" cy="${y(r.align)}" r="4" class="align-dot"><title>§${esc(r.section)} · align ${fmt(r.align)}</title></circle>`:''}${Number.isFinite(r.meanRaw)?`<circle cx="${x(i)}" cy="${y(r.meanRaw)}" r="3.5" class="peer-dot"><title>§${esc(r.section)} · ממוצע raw ${fmt(r.meanRaw)}</title></circle>`:''}${i%Math.ceil(rows.length/12)===0?`<text x="${x(i)}" y="${H-22}" class="chart-label" text-anchor="middle">§${esc(r.section)}</text>`:''}</g>`).join('')}<text x="${p.l-26}" y="${p.t+5}" class="chart-label">1</text><text x="${p.l-18}" y="${H-p.b+4}" class="chart-label">0</text></svg><div class="trajectory-legend"><span><i class="line-key align-key"></i>align לרמב״ן</span><span><i class="line-key peer-key"></i>ממוצע raw לשאר הפרשנים</span></div>`;container.querySelectorAll('[data-section]').forEach(g=>g.addEventListener('click',()=>{state.section=g.dataset.section;syncSelectors();switchTab('journey')}))}
  function graphTypeCounts(graph){const m=new Map();for(const n of graph?.nodes||[]){const k=n.type||'Unknown';m.set(k,(m.get(k)||0)+(num(n.freq)||1))}return [...m.entries()].sort((a,b)=>b[1]-a[1])}
  function graphPredicateCounts(graph){const m=new Map();for(const e of graph?.edges||[]){const k=e.predicate||'relatedTo';m.set(k,(m.get(k)||0)+(num(e.weight)||1))}return [...m.entries()].sort((a,b)=>b[1]-a[1])}
  function renderDistributionBars(container,rows,labelFn,colorFn){if(!container)return;const top=(rows||[]).slice(0,14),max=Math.max(1,...top.map(x=>x[1]));container.innerHTML=top.length?`<div class="mini-bars">${top.map(([k,v])=>`<div class="mini-bar-row"><span>${esc(labelFn(k))}</span><i><b style="width:${Math.max(2,100*v/max)}%;background:${colorFn(k)}"></b></i><strong>${fmt(v,0)}</strong></div>`).join('')}</div>`:'<div class="notice">אין נתון.</div>'}

  /* -------------------- CORPUS -------------------- */
  function renderCorpus(){
    const root=els.views.corpus;
    root.innerHTML=`
      <section class="panel">
        <div class="panel-head"><div><h2>מפות רוחב של הקורפוס</h2><p>המפות אינן מחליפות את הקריאה בקטע: כל תא לחיץ ומחזיר אל הטקסט, הרשת והכימות שמאחוריו.</p></div></div>
        <div class="grid-3">
          <div class="data-source-card"><h4>פרשן × פרשן</h4><p class="tiny muted">קשר רוחבי בין חיבורים, על פני כמה קטעים.</p></div>
          <div class="data-source-card"><h4>קטע × פרשן</h4><p class="tiny muted">הקרבה לרמב״ן לפי קטע — מדד align מן הדשבורד הישן.</p></div>
          <div class="data-source-card"><h4>קטע × שותף לפרשן נבחר</h4><p class="tiny muted">איך הקרבה של ${esc(displayName(state.a))} משתנה מקטע לקטע ומול כל פרשן.</p></div>
        </div>
      </section>
      <section class="panel layer-quant"><div class="panel-head"><div><h3>מטריצת פרשן × פרשן — מבט רוחבי</h3><p>אפשר להחליף מדד; מקור המדד מצוין ליד הבחירה.</p></div><select id="globalMetric" class="small-btn">${globalMetricOptions(state.corpusMatrixMetric)}</select></div><div id="globalPairMatrix"></div></section>
      <section class="panel layer-network"><div class="panel-head"><div><h3>קטעים × פרשנים — קרבה לרמב״ן</h3><p>כל שורה היא קטע; כל עמודה פרשן. זהו ה־align שהיה כבר בדשבורד הישן.</p></div><span class="badge badge-net">נתונים ישנים · E3</span></div><div id="rambanHeatmap"></div></section>
      <section class="panel layer-quant"><div class="panel-head"><div><h3>${esc(displayName(state.a))} × פרשנים × קטעים</h3><p>מפת חום שמראה מתי קשר בין שני חיבורים הוא עקבי ומתי הוא מקומי.</p></div><select id="focalMetric" class="small-btn">${metricOptions(state.focalMetric,['raw','bits','locus_overlap','reading_agreement'])}</select></div><div id="focalHeatmap"></div></section>
      <section class="panel layer-network"><div class="panel-head"><div><h3>אשכולות, דגלים וסט־זהב מן הדשבורד הישן</h3><p>המקבילה ל״מבט כללי / אשכולות״ הישן נשמרת כחלק ממבט הרוחב.</p></div><span class="badge badge-net">נתונים ישנים · E3</span></div>${renderOldPatterns()}</section>
      <section class="panel"><div class="panel-head"><div><h3>מושגים משותפים לרבים — בקטע הנבחר</h3><p>המושגים הגלובליים של חבילת הנתונים החדשים; קליק על קטע במפות האחרות מעדכן גם טבלה זו.</p></div><span class="badge badge-quant">נתונים חדשים · כימות</span></div>${renderSharedConceptsTable(state.section)}</section>
    `;
    root.querySelector('#globalMetric').addEventListener('change',e=>{state.corpusMatrixMetric=e.target.value;renderCorpus();});
    root.querySelector('#focalMetric').addEventListener('change',e=>{state.focalMetric=e.target.value;renderCorpus();});
    renderGlobalPairMatrix(root.querySelector('#globalPairMatrix'),state.corpusMatrixMetric);
    renderRambanHeatmap(root.querySelector('#rambanHeatmap'));
    renderFocalHeatmap(root.querySelector('#focalHeatmap'),state.a,state.focalMetric);
  }

  function renderGlobalPairMatrix(container,metric){
    let cs = metric==='signature' ? allCommentators.map(x=>x.id) : quantCommentators.filter(x=>x!=='RAMBAN');
    cs = cs.filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>displayName(a).localeCompare(displayName(b),'he'));
    let min=0,max=1;if(metric==='mean_bits'){min=-1;max=6.5}
    renderHeatmap(container,cs,cs,(a,b)=>a===b?(metric==='mean_bits'?null:1):globalPairValue(a,b,metric),{min,max,rowName:displayName,colName:displayName,onClick:(a,b)=>{if(a===b)return;state.a=a;state.b=b;syncSelectors();switchTab('journey');},title:(a,b,v)=>`${displayName(a)} ↔ ${displayName(b)} · ${globalMetricLabel(metric)}: ${fmt(v)}`});
  }

  function renderRambanHeatmap(container){
    const cols=quantCommentators.filter(x=>x!=='RAMBAN' && Object.values(oldSectionSummary).some(s=>(s.pairwise||[]).some(p=>canon(p.commentatorId)===x))).sort((a,b)=>displayName(a).localeCompare(displayName(b),'he'));
    const rows=allSections.filter(s=>oldSectionSummary[s]);
    renderHeatmap(container,rows,cols,(s,c)=>oldAlign(s,c),{min:0,max:.7,rowName:s=>`§${s} · ${sectionMap[s]?.passage_suggested||''}`,colName:displayName,onClick:(s,c)=>{state.section=String(s);state.a=c;syncSelectors();switchTab('journey');},title:(s,c,v)=>`§${s} · ${displayName(c)} ↔ רמב״ן · align ${fmt(v)}`});
  }

  function renderFocalHeatmap(container,focal,metric){
    const cols=quantCommentators.filter(c=>c!==focal && c!=='RAMBAN').sort((a,b)=>displayName(a).localeCompare(displayName(b),'he'));
    const rows=sortSections(Object.keys(sectionMap));
    renderHeatmap(container,rows,cols,(s,c)=>sectionPairValue(s,focal,c,metric),{min:metric==='bits'?-1:0,max:metric==='bits'?6.5:1,rowName:s=>`§${s} · ${sectionMap[s]?.passage_suggested||''}`,colName:displayName,onClick:(s,c,v)=>{if(!Number.isFinite(v))return;state.section=String(s);state.b=c;syncSelectors();switchTab('journey');},title:(s,c,v)=>`§${s} · ${displayName(focal)} ↔ ${displayName(c)} · ${metricLabel(metric)}: ${fmt(v)}`});
  }

  function renderOldPatterns(){
    const clusters=OLD.global.clusters||[];
    const sig=OLD.global.signatureValidationRows||[];
    const flags=OLD.global.flagGroups||{};
    const flagRows=Object.entries(flags).map(([k,v])=>({flag:k,count:Array.isArray(v)?v.length:(v&&typeof v==='object'?Object.keys(v).length:0)}));
    const clusterTable=clusters.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>אשכול</th><th>חברים</th><th>דמיון ממוצע</th><th>סעיפים תומכים</th></tr></thead><tbody>${clusters.map(c=>`<tr><td>${esc(c.id||'')}</td><td>${esc((c.members||[]).map(displayName).join(' · '))}</td><td class="num">${fmt(c.meanSimilarity)}</td><td>${esc((c.supportingSections||[]).map(x=>typeof x==='string'?x:(x.sectionId||'')).filter(Boolean).join(', '))}</td></tr>`).join('')}</tbody></table></div>`:'—';
    const sigTable=sig.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>קבוצת עד</th><th>חברים</th><th>דמיון פנימי</th><th>ממוצע קורפוס</th><th>פסק</th></tr></thead><tbody>${sig.map(r=>`<tr><td>${esc(r.group)}</td><td>${esc(r.members_present)}</td><td class="num">${fmt(r.within_group_sim)}</td><td class="num">${fmt(r.corpus_mean_sim)}</td><td>${esc(r.verdict)}</td></tr>`).join('')}</tbody></table></div>`:'—';
    return `<div class="grid-2"><div><h4>אשכולות פרשנים</h4>${clusterTable}</div><div><h4>אימות חתימות עדים</h4>${sigTable}<h4 style="margin-top:14px">דגלי קטעים</h4><div class="tag-list">${flagRows.map(r=>`<span class="tag">${esc(r.flag)} · ${r.count}</span>`).join('')}</div></div></div>`;
  }

  function renderSharedConceptsTable(section){
    const rows=(bySectionConcepts.get(String(section))||[]).slice().sort((a,b)=>num(b.n_graphs_with)-num(a.n_graphs_with));
    if(!rows.length)return '<div class="notice">אין רשומות מושגים משותפים לקטע זה.</div>';
    return `<div class="table-wrap" style="max-height:430px"><table class="data-table"><thead><tr><th>מושג גלובלי</th><th>תוויות</th><th>גרפים עם המושג</th><th>גרפים בקטע</th><th>שיעור</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="ltr">${esc(r.global_key)}</td><td>${esc(r.labels)}</td><td class="num">${fmt(r.n_graphs_with,0)}</td><td class="num">${fmt(r.n_graphs_in_section,0)}</td><td class="num">${fmt(num(r.n_graphs_with)/num(r.n_graphs_in_section))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* -------------------- CLUSTERS / DISPERSION -------------------- */
  async function renderClusters(){
    const root=els.views.clusters;root.innerHTML=skeleton('טוען את נתוני האשכולות מכל הקטעים…');
    await ensureAllSections();
    const meta=sectionMap[state.section]||{};
    root.innerHTML=`
      <section class="panel cluster-hero">
        <div class="panel-head"><div><div class="eyebrow">V7 · Research questions as visual evidence</div><h2>אשכולות, קרבה ופיזור של הפרשנים</h2><p>עמוד זה מרכז את השאלות המחקריות של חבילת הנתונים החדשים ומציג אותן בשתי רמות: <strong>מקור בודד (§)</strong> ו<strong>הקורפוס כולו</strong>. כל תצוגה מסומנת לפי שכבת הנתונים שממנה היא נגזרת.</p></div></div>
        <div class="research-question-grid">
          ${researchQuestionCard('q-distance','1','מי קרוב ומי רחוק?','התפלגות המרחקים, זוגות קצה ורשת קרבה.')}
          ${researchQuestionCard('q-cluster','2','האם נוצרים אשכולות?','אשכול נקודתי בתוך קטע לעומת קשר שחוזר לאורך הקורפוס.')}
          ${researchQuestionCard('q-dispersion','3','איך מתרחשת ההתפזרות?','מוקדים שונים לעומת קריאות שונות של אותו מוקד.')}
          ${researchQuestionCard('q-ramban','4','האם יש מרכז?','קרבה לרמב״ן בארבעה מדדים — לא דומיננטיות היסטורית.')}
          ${researchQuestionCard('q-types','5','מה אופי הקודקודים?','אילו סוגי מושגים משותפים ואיך משתנה הפרופיל בין פרשנים.')}
          ${researchQuestionCard('q-evidence','6','במה בדיוק הם דומים?','מעבר מן הציון אל הזוג, הקטע והראיה הטקסטואלית.')}
        </div>
      </section>
      <div class="cluster-subnav" role="tablist" aria-label="ניווט בתוך עמוד אשכולות ופיזור">
        <button data-cluster-view="overview">סקירה</button>
        <button data-cluster-view="distance">קרבה ומרחק</button>
        <button data-cluster-view="cluster">אשכולות</button>
        <button data-cluster-view="dispersion">פיזור</button>
        <button data-cluster-view="ramban">קרבה לרמב״ן</button>
        <button data-cluster-view="types">סוגי מושגים</button>
        <button data-cluster-view="evidence">ראיות</button>
      </div>
      <div id="clusterOverviewGuide" class="panel cluster-overview-guide">
        <h3>איך לקרוא את העמוד הזה?</h3>
        <p>העמוד מאורגן לפי שש שאלות המחקר של חבילת הנתונים החדשים. בחרו תחום מן הכפתורים למעלה. בכל תחום נשמרים גם המבט המקומי על קטע בודד וגם המבט הרחב על כלל הקורפוס. שום תצוגה לא הוסרה; היא פשוט מוצגת רק כאשר התחום שלה פעיל.</p>
        <div class="cluster-reading-path"><span><b>1</b> התחילו בשאלה</span><span><b>2</b> בחרו מדד/סף</span><span><b>3</b> בדקו קבוצה או זוג</span><span><b>4</b> חזרו לטקסט ולרשת</span></div>
      </div>

      <section id="q-distance" class="panel layer-quant cluster-pane" data-cluster-pane="distance">
        <div class="panel-head"><div><span class="badge badge-quant">חבילת הנתונים החדשים · 1,534 זוגות־קטע</span><h2>מי קרוב ומי רחוק?</h2><p>התפלגות מלאה של ציוני הדמיון. הציון הגולמי משמש לסדר, ואילו <em>bits</em> מראה כמה ראיה יש ביחס לזוגות הביקורת.</p></div><button class="small-btn" data-open-report="01_ממצאים">פתח את הדוח המלא</button></div>
        <div class="report-kpi-row"><div><strong>45</strong><span>שילובי שיטה × מדד שנבדקו</span></div><div><strong>29</strong><span>צירים בלתי־תלויים לפי הדוח</span></div><div><strong>600</strong><span>זוגות ביקורת</span></div><div><strong>96.8%</strong><span>האחוזון של raw=0.50</span></div></div><div class="tiny muted" style="margin-bottom:12px">45→29 ו־600 הם נתוני סיכום מן הדוח; חומר הגלם של בדיקות התלות וזוגות הביקורת אינו נכלל ב־CSV ולכן אינו מחושב מחדש כאן.</div><div class="grid-2"><div class="chart-box"><h3>D1 / raw — כל הזוגות</h3><div id="rawHistogram"></div></div><div class="chart-box"><h3>bits — כל הזוגות</h3><div id="bitsHistogram"></div></div></div>
        ${renderDistanceSummary()}
        <div class="details-grid"><details class="data-details"><summary>כל 49 הזוגות שמעל raw=0.50</summary>${renderThresholdPairs()}</details><details class="data-details"><summary>הקצוות: 25 הקרובים + 25 הרחוקים</summary>${renderDistanceExtremes()}</details></div><details class="data-details"><summary>פתח את מלוא 1,534 זוגות־הקטע</summary><div class="lazy-table-placeholder" data-lazy-table="all-ranked">הטבלה תיטען בעת הפתיחה.</div></details>
      </section>

      <section id="q-cluster" class="panel cluster-workbench cluster-pane" data-cluster-pane="cluster">
        <div class="panel-head"><div><h2>אשכולות: נקודתי מול קבוע</h2><p>אותו מושג “אשכול” נבדק כאן בשתי רמות שונות. הכפתורים והספים הם כלי חקירה; הם אינם מחליפים את מבחני המובהקות המתוארים בדוח.</p></div><span class="badge badge-quant">נתונים חדשים + נתונים ישנים</span></div>
        <div class="report-finding-strip"><div><strong>לפי דוח הכימות:</strong> ב־13 מתוך 36 סעיפים נמצא מבנה קבוצתי מעבר למקרה; 3 שורדים את התיקון המחמיר. הפיצול המאוזן הבולט ביותר הוא §18 (5+5).</div><div><strong>קביעות:</strong> הקשרים החוזרים ביותר הם בעיקר משפחות עדי נוסח; חציון קו־האשכול הוא 0.32.</div></div>

        <div class="cluster-level-block">
          <div class="panel-head"><div><h3>א. הקורפוס כולו — רשת קרבה/קו־אשכול</h3><p>כל צומת הוא פרשן; קשת מופיעה רק אם הזוג עובר את הסף. עובי הקשת מייצג את עוצמת המדד.</p></div><div class="controls"><select id="clusterGlobalMetric" class="small-btn">${clusterGlobalMetricOptions(state.clusterGlobalMetric)}</select><label class="threshold-control">סף <output id="globalThresholdOut">${fmt(state.clusterGlobalThreshold,2)}</output><input id="clusterGlobalThreshold" type="range" min="0" max="1" step="0.02" value="${state.clusterGlobalThreshold}"></label></div></div>
          <div class="split-main cluster-split"><div><div id="globalClusterNetwork" class="cluster-network-host"></div></div><aside><div id="globalClusterComponents"></div></aside></div>
          <div style="margin-top:16px"><h4>אותם נתונים כמטריצה מלאה</h4><div id="clusterGlobalMatrix"></div></div><div class="cluster-dendro-grid"><div class="chart-box"><h4>דנדרוגרמה — כל הפרשנים יחד</h4><p class="tiny muted">Average-linkage על המדד שנבחר. בניגוד לרשת הסף, אף פרשן אינו נעלם גם כאשר הוא רחוק מן האחרים.</p><div id="globalDendrogram"></div></div><div class="chart-box"><h4>מקרה מבחן: דעת חכם והלא־נודע</h4><p class="tiny muted">מטריצת קו־אשכול שמבליטה את אנומליית ותיקן 214 שעליה מצביע הדוח.</p><div id="anomalyHeatmap"></div></div></div>
          <details class="data-details"><summary>פתח את 105 זוגות קו־האשכול המלאים</summary>${renderCoClusterTable()}</details>
        </div>

        <div class="cluster-level-block local-level">
          <div class="panel-head"><div><h3>ב. מקור בודד — §${esc(state.section)} · ${esc(meta.passage_suggested||'')}</h3><p>אשכול חקרני מתוך כל הזוגות באותו קטע. אפשר להחליף את הגדרת הקרבה ולראות כיצד הרכב הקבוצות משתנה.</p></div><div class="controls"><select id="clusterLocalMetric" class="small-btn">${clusterLocalMetricOptions(state.clusterLocalMetric)}</select><label class="threshold-control">סף <output id="localThresholdOut">${fmt(state.clusterLocalThreshold,2)}</output><input id="clusterLocalThreshold" type="range" min="0" max="1" step="0.02" value="${state.clusterLocalThreshold}"></label></div></div>
          <div class="split-main cluster-split"><div><div id="localClusterNetwork" class="cluster-network-host"></div></div><aside><div id="localClusterComponents"></div>${renderOldLocalClusters(state.section)}</aside></div>
          <div style="margin-top:16px"><h4>כל הזוגות בקטע הנבחר</h4><div id="localClusterMatrix"></div></div><div class="chart-box" style="margin-top:14px"><h4>דנדרוגרמה מקומית — כל הפרשנים ב־§${esc(state.section)}</h4><p class="tiny muted">כל הפרשנים הקיימים במקור נכנסים לעץ; גובה החיבור מראה את מידת הקרבה לפי המדד המקומי שנבחר.</p><div id="localDendrogram"></div></div>
          <details class="data-details"><summary>פתח את כל נתוני הזוגות של §${esc(state.section)}</summary>${renderJoinedSectionPairTable(state.section)}</details>
        </div>

        <div class="cluster-level-block"><div class="panel-head"><div><h3>ג. כל הקטעים — תמונת המבנה המקומי</h3><p>הפסים הבאים נגזרים מן ה־localClusters של שכבת E3 הישנה. הם מאפשרים לראות במבט אחד היכן נוצרים רכיבים גדולים, זוגות או בעיקר יחידים.</p></div><span class="badge badge-net">נתונים ישנים · E3</span></div>${renderSectionClusterOverview()}</div>
      </section>

      <section id="q-dispersion" class="panel layer-quant cluster-pane" data-cluster-pane="dispersion">
        <div class="panel-head"><div><h2>אופי ההתפזרות: מוקד לעומת קריאה</h2><p>כל נקודה היא זוג חיבורים בתוך קטע. ציר X = חפיפת מוקדים; ציר Y = הסכמת קריאה. הנקודות של §${esc(state.section)} מודגשות.</p></div><div class="controls"><span class="badge badge-quant">פירוק_התפזרות.csv · 1,869 שורות</span><button class="small-btn" id="openDispersionLab">פתח במעבדת הפיזור</button></div></div>
        ${renderDispersionSummary()}
        <div class="chart-box scatter-box"><div id="dispersionScatter"></div></div><div class="grid-2" style="margin-top:14px"><div class="chart-box"><h3>אטלס פיזור של כל הקטעים</h3><p class="tiny muted">כל נקודה היא קטע שלם: X = חציון חפיפת מוקדים; Y = חציון הסכמת קריאה; הגודל משקף את מספר הזוגות. לחיצה עוברת לקטע.</p><div id="sectionDispersionAtlas"></div></div><div class="chart-box"><h3>עושר פרשני מול התפזרות</h3><p class="tiny muted">X = מספר מושגים ממוצע לפרשן בקטע (E3); Y = 1 − mean raw (נתונים חדשים · כימות). זהו המבט הישיר על טענת הדוח שככל שאומרים יותר, מתרחקים.</p><div id="richnessDivergence"></div></div></div>
        <details class="data-details"><summary>פתח את מלוא 1,869 רשומות ההתפזרות</summary><div class="lazy-table-placeholder" data-lazy-table="decomp-full">הטבלה תיטען בעת הפתיחה.</div></details>
      </section>

      <section id="q-ramban" class="panel layer-quant cluster-pane" data-cluster-pane="ramban">
        <div class="panel-head"><div><h2>קרבה לרמב״ן — לא דומיננטיות</h2><p>הדוח מדגיש שמרחק סימטרי אינו יכול לענות מי השפיע על מי. כאן מוצגת השאלה שכן ניתנת למדידה: מי נשאר קרוב יותר לטקסט הבסיס.</p></div><span class="badge badge-quant">קרבה_לרמבן.csv · 12 חיבורים</span></div>
        <div class="notice">אין לפרש את התרשים ככיוון של השפעה. לצורך דומיננטיות היסטורית נדרשים כרונולוגיה ויחסי ציטוט שאינם כלולים בגרפים.</div>
        <div id="rambanClosenessViz" style="margin-top:14px"></div>
        ${renderRambanClosenessTable()}
      </section>

      <section id="q-types" class="panel cluster-pane" data-cluster-pane="types">
        <div class="panel-head"><div><h2>אופי הקודקודים: מה המסורת חולקת?</h2><p>משמאל: שיעורי השיתוף לפי סוג כפי שדווחו בחבילת הנתונים החדשים. מימין: פרופיל סוגי המושגים של כל פרשן מתוך 7,117 רשומות מושגים בשכבת E3 הישנה.</p></div></div>
        <div class="grid-2"><div class="chart-box"><h3>שיעור שיתוף לפי סוג מושג</h3><div id="typeShareBars"></div><div class="tiny muted">מקור: טבלת “סוג / שיעור שיתוף” בדוח הממצאים.</div></div><div class="chart-box"><h3>חתימת סוגי מושגים לפי פרשן</h3><div id="typeProfileHeatmap"></div><div class="tiny muted">כל תא = שיעור סוג המושג מתוך רשומות המושגים הייחודיות שבהן הפרשן מופיע; מקור: רשומות המושגים של E3 בנתונים הישנים.</div></div></div><div class="chart-box" style="margin-top:14px"><h3>סגנון מול תוכן — האם הם אותו ציר?</h3><p class="tiny muted">כל נקודה היא זוג פרשנים: X = mean raw תוכני; Y = דמיון חתימה של E3. מקדם המתאם מוצג בתרשים.</p><div id="styleContentScatter"></div></div>
      </section>

      <section id="q-evidence" class="panel cluster-pane" data-cluster-pane="evidence">
        <div class="panel-head"><div><h2>מן המספר אל הראיה</h2><p>הזוג הנבחר בהקשר העליון: <strong>${esc(displayName(state.a))}</strong> ↔ <strong>${esc(displayName(state.b))}</strong>, §${esc(state.section)}. כאן אפשר לראות את כל המדדים, ואז לחזור בלחיצה אחת לטקסט ולגרף.</p></div><button id="clusterOpenJourney" class="small-btn">פתח טקסט → רשת → כימות</button></div>
        ${renderQuantCards()}${renderContextEvidence()}
      </section>`;

    installClusterWorkspace(root);
    root.querySelectorAll('[data-cluster-scroll]').forEach(b=>b.addEventListener('click',()=>{const v=(b.dataset.clusterScroll||'').replace('#q-','');state.clusterView=v==='cluster'?'cluster':v;applyClusterWorkspace(root);requestAnimationFrame(()=>renderClusterPaneViews(root,state.clusterView));root.querySelector('.cluster-subnav')?.scrollIntoView({behavior:'smooth',block:'start'});}));
    root.querySelectorAll('[data-cluster-view]').forEach(b=>b.addEventListener('click',()=>{state.clusterView=b.dataset.clusterView;applyClusterWorkspace(root);requestAnimationFrame(()=>renderClusterPaneViews(root,state.clusterView));}));
    root.querySelector('#openDispersionLab')?.addEventListener('click',()=>switchTab('dispersion'));
    root.querySelectorAll('[data-open-report]').forEach(b=>b.addEventListener('click',()=>{const key=Object.keys(reports).find(k=>k.includes(b.dataset.openReport));if(key)state.reportId=key;switchTab('reports')}));
    root.querySelector('#clusterOpenJourney')?.addEventListener('click',()=>switchTab('journey'));
    root.querySelector('#openEvidenceReport')?.addEventListener('click',()=>{const k=Object.keys(reports).find(x=>x.includes('05_גיליון_ראיות'));if(k)state.reportId=k;switchTab('reports')});
    root.querySelectorAll('[data-set-section]').forEach(b=>b.addEventListener('click',()=>{state.section=String(b.dataset.setSection);syncSelectors();renderClusters()}));
    root.addEventListener('click',ev=>{
      const groupBtn=ev.target.closest?.('[data-disp-group]');
      if(groupBtn){state.dispersionManualIds=(groupBtn.dataset.dispGroup||'').split('|').map(canon).filter(Boolean);state.dispersionGroupScope='manual';state.dispersionGroupMatch='both';switchTab('dispersion');return;}
      const b=ev.target.closest?.('[data-cluster-pair]');if(!b)return;state.a=canon(b.dataset.a);state.b=canon(b.dataset.b);if(b.dataset.section)state.section=String(b.dataset.section);if(state.a===state.b)state.b=pickAlternative(state.a);syncSelectors();renderClusters();
    });

    root.querySelector('#clusterGlobalMetric')?.addEventListener('change',e=>{state.clusterGlobalMetric=e.target.value;renderClusters()});
    root.querySelector('#clusterGlobalThreshold')?.addEventListener('input',e=>{state.clusterGlobalThreshold=Number(e.target.value);root.querySelector('#globalThresholdOut').value=Number(e.target.value).toFixed(2);renderGlobalClusterViews(root)});
    root.querySelector('#clusterLocalMetric')?.addEventListener('change',e=>{state.clusterLocalMetric=e.target.value;renderClusters()});
    root.querySelector('#clusterLocalThreshold')?.addEventListener('input',e=>{state.clusterLocalThreshold=Number(e.target.value);root.querySelector('#localThresholdOut').value=Number(e.target.value).toFixed(2);renderLocalClusterViews(root)});

    setupLazyClusterDetails(root);
    renderClusterPaneViews(root,state.clusterView);
  }

  function renderClusterPaneViews(root,view){
    if(!root)return;const v=view||state.clusterView||'overview';
    if(v==='distance'){
      renderHistogram(root.querySelector('#rawHistogram'),(Q['כל_הזוגות_מדורגים']||[]).map(r=>num(r.raw)).filter(Number.isFinite),{min:0,max:1,bins:20,threshold:.5,label:'raw'});
      const bits=(Q['כל_הזוגות_מדורגים']||[]).map(r=>num(r.bits)).filter(Number.isFinite);renderHistogram(root.querySelector('#bitsHistogram'),bits,{bins:22,label:'bits'});
    } else if(v==='cluster'){
      renderGlobalClusterViews(root);renderLocalClusterViews(root);renderAnomalyHeatmap(root.querySelector('#anomalyHeatmap'));
    } else if(v==='dispersion'){
      renderDispersionScatter(root.querySelector('#dispersionScatter'));renderSectionDispersionAtlas(root.querySelector('#sectionDispersionAtlas'));renderRichnessDivergence(root.querySelector('#richnessDivergence'));
    } else if(v==='ramban'){
      renderRambanClosenessViz(root.querySelector('#rambanClosenessViz'));
    } else if(v==='types'){
      renderTypeShareBars(root.querySelector('#typeShareBars'));renderTypeProfileHeatmap(root.querySelector('#typeProfileHeatmap'));renderStyleContentScatter(root.querySelector('#styleContentScatter'));
    }
  }
  function setupLazyClusterDetails(root){
    if(!root)return;root.querySelectorAll('details.data-details').forEach(d=>{
      const ph=d.querySelector('[data-lazy-table]');if(!ph)return;
      d.addEventListener('toggle',()=>{if(!d.open||ph.dataset.loaded==='1')return;ph.dataset.loaded='1';
        requestAnimationFrame(()=>{ph.innerHTML=ph.dataset.lazyTable==='all-ranked'?renderAllRankedPairs():ph.dataset.lazyTable==='decomp-full'?renderDecompFullTable():'';});
      });
    });
  }

  function installClusterWorkspace(root){if(!root)return;applyClusterWorkspace(root)}
  function applyClusterWorkspace(root){if(!root)return;const v=state.clusterView||'overview';root.querySelectorAll('[data-cluster-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.clusterView===v));root.querySelectorAll('[data-cluster-pane]').forEach(p=>p.classList.toggle('is-visible',p.dataset.clusterPane===v));const guide=root.querySelector('#clusterOverviewGuide');if(guide)guide.classList.toggle('is-visible',v==='overview')}
  function researchQuestionCard(anchor,n,title,desc){return `<button class="research-question" data-cluster-scroll="#${anchor}"><span>${n}</span><strong>${esc(title)}</strong><small>${esc(desc)}</small></button>`}
  function clusterGlobalMetricOptions(sel){return [['co_cluster','קו־אשכול · חדש'],['mean_raw','דמיון תוכן ממוצע · חדש'],['mean_locus','חפיפת מוקדים ממוצעת · חדש'],['mean_reading','הסכמת קריאה ממוצעת · חדש'],['signature','חתימת קורפוס · נתונים ישנים']].map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('')}
  function clusterLocalMetricOptions(sel){return [['raw','D1 / raw · חדש'],['locus_overlap','חפיפת מוקדים · חדש'],['reading_agreement','הסכמת קריאה · חדש'],['old_similarity','חיתוך מושגים מקומי · נתונים ישנים']].map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('')}
  function clusterMetricLabel(m){return ({co_cluster:'קו־אשכול',mean_raw:'דמיון תוכן ממוצע',mean_locus:'חפיפת מוקדים ממוצעת',mean_reading:'הסכמת קריאה ממוצעת',signature:'חתימת קורפוס',raw:'D1 / raw',locus_overlap:'חפיפת מוקדים',reading_agreement:'הסכמת קריאה',old_similarity:'חיתוך מושגים E3'})[m]||m}

  function globalClusterValue(a,b,metric){return metric==='signature'?signatureValue(a,b):globalPairValue(a,b,metric)}
  function localClusterValue(section,a,b,metric){
    if(metric==='old_similarity'){const sec=window.RAMBAN_V2_SECTIONS[String(section)];const row=(sec?.comparisonsBetweenCommentators||[]).find(r=>pairKey(r.source,r.target)===pairKey(a,b));return num(row?.similarity)}
    return sectionPairValue(section,a,b,metric);
  }
  function similarityGraph(ids,valueFn,threshold,predicate){const nodes=ids.map(id=>({id,label:displayName(id),type:'Commentator'})),edges=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const v=valueFn(ids[i],ids[j]);if(Number.isFinite(v)&&v>=threshold)edges.push({id:`sim_${hash(ids[i]+ids[j]+predicate)}`,source:ids[i],target:ids[j],predicate,weight:v,evidenceText:`${clusterMetricLabel(predicate)}: ${fmt(v)}`})}return {nodes,edges,nodeCount:nodes.length,edgeCount:edges.length}}
  function clusterIdsGlobal(){return [...new Set(quantCommentators.filter(c=>c!=='RAMBAN'))].sort((a,b)=>displayName(a).localeCompare(displayName(b),'he'))}
  function clusterIdsLocal(section,metric){const ids=new Set();if(metric==='old_similarity'){const sec=window.RAMBAN_V2_SECTIONS[String(section)];(sec?.comparisonsBetweenCommentators||[]).forEach(r=>{if(canon(r.source)!=='RAMBAN')ids.add(canon(r.source));if(canon(r.target)!=='RAMBAN')ids.add(canon(r.target))})}else{const rows=metric==='raw'?(bySectionPairs.get(String(section))||[]):(bySectionDecomp.get(String(section))||[]);for(const r of rows){const a=canon(r.comm_a||r.a),b=canon(r.comm_b||r.b);if(a!=='RAMBAN')ids.add(a);if(b!=='RAMBAN')ids.add(b)}}return [...ids].sort((a,b)=>displayName(a).localeCompare(displayName(b),'he'))}
  function renderGlobalClusterViews(root){
    const ids=clusterIdsGlobal(),m=state.clusterGlobalMetric,t=state.clusterGlobalThreshold,g=similarityGraph(ids,(a,b)=>globalClusterValue(a,b,m),t,m);const host=root.querySelector('#globalClusterNetwork');if(host)renderNetwork(host,g,{labels:true,edgeLabels:false,maxNodes:40,onSelect:item=>clusterGraphSelect(item)});const comps=graphComponents(g.nodes,g.edges);const c=root.querySelector('#globalClusterComponents');if(c)c.innerHTML=renderComponentCards(comps,g,`סף ${fmt(t,2)} · ${clusterMetricLabel(m)}`);
    const matrix=root.querySelector('#clusterGlobalMatrix');if(matrix)renderHeatmap(matrix,ids,ids,(a,b)=>a===b?1:globalClusterValue(a,b,m),{min:0,max:1,rowName:displayName,colName:displayName,onClick:(a,b)=>{if(a===b)return;state.a=a;state.b=b;syncSelectors();renderClusters()},title:(a,b,v)=>`${displayName(a)} ↔ ${displayName(b)} · ${clusterMetricLabel(m)}: ${fmt(v)}`,showValues:true});renderDendrogram(root.querySelector('#globalDendrogram'),ids,(a,b)=>globalClusterValue(a,b,m),clusterMetricLabel(m));
  }
  function renderLocalClusterViews(root){
    const ids=clusterIdsLocal(state.section,state.clusterLocalMetric),m=state.clusterLocalMetric,t=state.clusterLocalThreshold,g=similarityGraph(ids,(a,b)=>localClusterValue(state.section,a,b,m),t,'local_similarity');const host=root.querySelector('#localClusterNetwork');if(host)renderNetwork(host,g,{labels:true,edgeLabels:false,maxNodes:40,onSelect:item=>clusterGraphSelect(item)});const comps=graphComponents(g.nodes,g.edges);const c=root.querySelector('#localClusterComponents');if(c)c.innerHTML=renderComponentCards(comps,g,`§${state.section} · סף ${fmt(t,2)} · ${clusterMetricLabel(m)}`);const matrix=root.querySelector('#localClusterMatrix');if(matrix)renderHeatmap(matrix,ids,ids,(a,b)=>a===b?1:localClusterValue(state.section,a,b,m),{min:0,max:1,rowName:displayName,colName:displayName,onClick:(a,b)=>{if(a===b)return;state.a=a;state.b=b;syncSelectors();renderClusters()},title:(a,b,v)=>`§${state.section} · ${displayName(a)} ↔ ${displayName(b)} · ${clusterMetricLabel(m)}: ${fmt(v)}`,showValues:true});renderDendrogram(root.querySelector('#localDendrogram'),ids,(a,b)=>localClusterValue(state.section,a,b,m),`§${state.section} · ${clusterMetricLabel(m)}`);
  }
  function clusterGraphSelect(item){if(item?.kind==='edge'){state.a=canon(item.edge.source);state.b=canon(item.edge.target);syncSelectors();renderClusters()}else if(item?.kind==='node'){state.a=canon(item.node.id);if(state.a===state.b)state.b=pickAlternative(state.a);syncSelectors();renderClusters()}}
  function renderComponentCards(comps,g,label){const edgeMap=new Map();for(const e of g.edges||[])edgeMap.set(pairKey(e.source,e.target),num(e.weight));return `<div class="component-panel"><div class="tiny muted">${esc(label)}</div><h4>${comps.filter(c=>c.length>1).length} אשכולות מחוברים · ${comps.filter(c=>c.length===1).length} יחידים</h4>${comps.map((ids,i)=>{const vals=[];for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const v=edgeMap.get(pairKey(ids[a],ids[b]));if(Number.isFinite(v))vals.push(v)}return `<div class="component-card ${ids.length===1?'singleton':''}"><span class="component-index">${i+1}</span><div><strong>${ids.length>1?`קבוצה של ${ids.length}`:'יחיד'}</strong><div>${ids.map(x=>`<button data-cluster-pair="1" data-a="${escAttr(x)}" data-b="${escAttr(state.a===x?state.b:state.a)}" class="inline-link">${esc(displayName(x))}</button>`).join(' · ')}</div>${vals.length?`<small>ממוצע קשתות: ${fmt(mean(vals))}</small>`:''}${ids.length>1?`<button class="component-dispersion-btn" data-disp-group="${escAttr(ids.join('|'))}">פתח את הקבוצה במעבדת הפיזור</button>`:''}</div></div>`}).join('')}</div>`}

  function renderOldLocalClusters(section){const sec=window.RAMBAN_V2_SECTIONS[String(section)],cls=sec?.localClusters||[];if(!cls.length)return `<div class="data-source-card" style="margin-top:12px"><span class="badge badge-net">נתונים ישנים · E3</span><p class="tiny">לא נשמר localCluster לקטע זה בשכבה הישנה.</p></div>`;return `<div class="data-source-card" style="margin-top:12px"><span class="badge badge-net">נתונים ישנים · E3</span><h4>האשכולות המקומיים שנשמרו במקור</h4>${cls.map(c=>`<div class="old-cluster-row"><strong>${esc(c.id)}</strong><span>${(c.members||[]).map(x=>esc(displayName(x))).join(' · ')}</span><small>mean=${fmt(c.meanSimilarity)} · threshold=${fmt(c.threshold)}</small></div>`).join('')}</div>`}
  function renderSectionClusterOverview(){const rows=(OLD.index.sections||[]).map(x=>String(x.id)).map(id=>{const sec=window.RAMBAN_V2_SECTIONS[id],members=(oldSectionSummary[id]?.metrics?.nMembers||sec?.similarityMatrix?.commentators?.length||0),cls=sec?.localClusters||[],assigned=new Set(cls.flatMap(c=>c.members||[])),single=Math.max(0,members-assigned.size),sizes=cls.map(c=>(c.members||[]).length);if(single)sizes.push(...Array(single).fill(1));return {id,members,sizes,clusters:cls.length,flag:oldSectionSummary[id]?.metrics?.flag||''}});return `<div class="section-cluster-overview">${rows.map(r=>`<button class="section-cluster-row ${String(state.section)===r.id?'is-active':''}" data-set-section="${escAttr(r.id)}"><span class="section-cluster-label">§${esc(r.id)}<small>${esc(sectionMap[r.id]?.passage_suggested||'')}</small></span><span class="cluster-strip">${r.sizes.length?r.sizes.map((z,i)=>`<i class="cluster-segment ${z===1?'single':''}" style="flex:${z}" title="${z===1?'יחיד':`קבוצה: ${z}`} מפרשים"></i>`).join(''):'<i class="cluster-segment single" style="flex:1"></i>'}</span><span class="section-cluster-meta">${r.clusters} קבוצות${r.flag?` · ${esc(r.flag)}`:''}</span></button>`).join('')}</div>`}

  function agglomerativeTree(ids,valueFn){
    let clusters=ids.map(id=>({members:[id],leaf:id,sim:1,left:null,right:null}));
    const avgSim=(a,b)=>{const vals=[];for(const x of a.members)for(const y of b.members){const v=valueFn(x,y);if(Number.isFinite(v))vals.push(v)}return vals.length?mean(vals):0};
    while(clusters.length>1){let bi=0,bj=1,best=-Infinity;for(let i=0;i<clusters.length;i++)for(let j=i+1;j<clusters.length;j++){const v=avgSim(clusters[i],clusters[j]);if(v>best){best=v;bi=i;bj=j}}const a=clusters[bi],b=clusters[bj],node={members:[...a.members,...b.members],sim:Number.isFinite(best)?best:0,left:a,right:b};clusters=clusters.filter((_,k)=>k!==bi&&k!==bj);clusters.push(node)}return clusters[0]||null
  }
  function renderDendrogram(container,ids,valueFn,label){if(!container)return;if(!ids?.length){container.innerHTML='<div class="notice">אין פרשנים לעץ זה.</div>';return}const tree=agglomerativeTree(ids,valueFn),leaves=[];(function walk(n){if(!n)return;if(n.leaf)leaves.push(n.leaf);else{walk(n.left);walk(n.right)}})(tree);const W=1040,rowH=30,H=Math.max(210,leaves.length*rowH+70),p={l:45,r:260,t:22,b:34},treeW=W-p.l-p.r,leafY=new Map(leaves.map((id,i)=>[id,p.t+18+i*rowH])),parts=[];function draw(n){if(n.leaf)return {x:p.l+treeW,y:leafY.get(n.leaf)};const L=draw(n.left),R=draw(n.right),x=p.l+Math.max(0,Math.min(1,n.sim))*treeW,y=(L.y+R.y)/2;parts.push(`<g class="dendro-merge"><path d="M${x},${L.y} H${L.x} M${x},${R.y} H${R.x} M${x},${L.y} V${R.y}" class="dendro-line"/><text x="${x+4}" y="${y-3}" class="dendro-sim">${fmt(n.sim,2)}</text><title>חיבור קבוצות ברמת דמיון ${fmt(n.sim,2)} · ${n.members.length} פרשנים בקבוצה המאוחדת</title></g>`);return {x,y}}draw(tree);container.innerHTML=`<div class="dendro-caption">${esc(label)} · כל ${ids.length} הפרשנים</div><svg viewBox="0 0 ${W} ${H}" class="dendrogram-svg">${parts.join('')}${leaves.map(id=>`<g class="dendro-leaf" data-peer="${escAttr(id)}"><circle cx="${p.l+treeW}" cy="${leafY.get(id)}" r="4"/><text x="${p.l+treeW+10}" y="${leafY.get(id)+4}">${esc(displayName(id))}</text></g>`).join('')}<line x1="${p.l}" y1="${H-p.b}" x2="${p.l+treeW}" y2="${H-p.b}" class="chart-axis"/>${[0,.25,.5,.75,1].map(v=>`<text x="${p.l+v*treeW}" y="${H-10}" text-anchor="middle" class="chart-label">${v.toFixed(2)}</text>`).join('')}</svg><div class="tiny muted">ציר תחתון = דמיון. זוגות חסרים נכנסים לעץ ברמת 0; העץ הוא כלי תיאורי ולא מבחן מובהקות.</div>`;container.querySelectorAll('[data-peer]').forEach(x=>x.addEventListener('click',()=>{state.a=canon(x.dataset.peer);if(state.a===state.b)state.b=pickAlternative(state.a);syncSelectors();state.tab==='dispersion'?renderDispersionLab():renderClusters()}))}
  function renderAnomalyHeatmap(container){if(!container)return;const ids=['DaatChachamVatokan107','DaatChachamVatokan114','DaatChachamVatokan214','UnKnownEskorial'];renderHeatmap(container,ids,ids,(a,b)=>a===b?1:num(coClusterMap.get(pairKey(a,b))?.co_cluster_rate),{min:0,max:1,rowName:displayName,colName:displayName,showValues:true,title:(a,b,v)=>`${displayName(a)} ↔ ${displayName(b)} · קו־אשכול ${fmt(v)}`,onClick:(a,b)=>{if(a===b)return;state.a=a;state.b=b;syncSelectors();renderClusters()}})}
  function sectionDispersionRows(){return allSections.map(section=>{const d=bySectionDecomp.get(String(section))||[],p=bySectionPairs.get(String(section))||[],l=d.map(r=>num(r.locus_overlap)).filter(Number.isFinite),rd=d.map(r=>num(r.reading_agreement)).filter(Number.isFinite),raw=p.map(r=>num(r.raw)).filter(Number.isFinite),cov=(oldSectionSummary[String(section)]?.coverage||[]).filter(r=>canon(r.commentatorId)!=='RAMBAN'),rich=cov.map(r=>num(r.concepts)).filter(Number.isFinite);return {section,medianLocus:median(l),medianReading:median(rd),meanRaw:mean(raw),pairs:p.length,richness:mean(rich),nCommentators:cov.length,flag:oldSectionSummary[String(section)]?.metrics?.flag||'',localClusters:(window.RAMBAN_V2_SECTIONS[String(section)]?.localClusters||[]).length}}).filter(r=>Number.isFinite(r.medianLocus)&&Number.isFinite(r.medianReading))}
  function renderSectionDispersionAtlas(container){if(!container)return;const rows=sectionDispersionRows(),W=760,H=420,p={l:52,r:22,t:24,b:46},sx=x=>p.l+x*(W-p.l-p.r),sy=y=>H-p.b-y*(H-p.t-p.b);container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="section-atlas-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/><text x="${W/2-60}" y="${H-12}" class="axis-title">חציון חפיפת מוקדים →</text><text transform="translate(15 ${H/2+50}) rotate(-90)" class="axis-title">חציון הסכמת קריאה →</text>${rows.map(r=>{const hot=String(r.section)===String(state.section),special=['18','32','5','7_1','26','30_1'].includes(String(r.section)),rad=Math.max(4,Math.min(12,3+Math.sqrt(r.pairs)*.42));return `<g class="atlas-point ${hot?'is-selected':''}" data-section="${escAttr(r.section)}"><circle cx="${sx(r.medianLocus)}" cy="${sy(r.medianReading)}" r="${rad}"/><title>§${esc(r.section)} · מוקד ${fmt(r.medianLocus)} · קריאה ${fmt(r.medianReading)} · ${r.pairs} זוגות · ${r.localClusters} אשכולות מקומיים</title>${(hot||special)?`<text x="${sx(r.medianLocus)+rad+3}" y="${sy(r.medianReading)+4}">§${esc(r.section)}</text>`:''}</g>`}).join('')}</svg>`;container.querySelectorAll('[data-section]').forEach(x=>x.addEventListener('click',()=>{state.section=String(x.dataset.section);syncSelectors();state.tab==='dispersion'?renderDispersionLab():renderClusters()}))}
  function renderRichnessDivergence(container){if(!container)return;const rows=sectionDispersionRows().filter(r=>Number.isFinite(r.richness)&&Number.isFinite(r.meanRaw)),xs=rows.map(r=>r.richness),ys=rows.map(r=>1-r.meanRaw),W=760,H=420,p={l:58,r:25,t:28,b:50},minX=Math.min(...xs),maxX=Math.max(...xs),sx=x=>p.l+(x-minX)/(maxX-minX||1)*(W-p.l-p.r),sy=y=>H-p.b-y*(H-p.t-p.b),corr=pearson(xs,ys),reg=linearRegression(xs,ys);container.innerHTML=`<div class="tiny"><strong>r = ${fmt(corr,3)}</strong> · חיובי פירושו: יותר מושגים ↔ יותר התפזרות.</div><svg viewBox="0 0 ${W} ${H}" class="section-atlas-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/>${Number.isFinite(reg?.slope)?`<line x1="${sx(minX)}" y1="${sy(Math.max(0,Math.min(1,reg.intercept+reg.slope*minX)))}" x2="${sx(maxX)}" y2="${sy(Math.max(0,Math.min(1,reg.intercept+reg.slope*maxX)))}" class="trend-line"/>`:''}${rows.map(r=>`<g class="atlas-point ${String(r.section)===String(state.section)?'is-selected':''}" data-section="${escAttr(r.section)}"><circle cx="${sx(r.richness)}" cy="${sy(1-r.meanRaw)}" r="5"/><title>§${esc(r.section)} · עושר ${fmt(r.richness,1)} · התפזרות ${fmt(1-r.meanRaw)}</title></g>`).join('')}<text x="${W/2-65}" y="${H-12}" class="axis-title">מושגים ממוצעים לפרשן →</text><text transform="translate(15 ${H/2+45}) rotate(-90)" class="axis-title">1 − mean raw →</text></svg>`;container.querySelectorAll('[data-section]').forEach(x=>x.addEventListener('click',()=>{state.section=String(x.dataset.section);syncSelectors();state.tab==='dispersion'?renderDispersionLab():renderClusters()}))}
  function renderStyleContentScatter(container){if(!container)return;const ids=clusterIdsGlobal(),rows=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const x=globalPairValue(ids[i],ids[j],'mean_raw'),y=signatureValue(ids[i],ids[j]);if(Number.isFinite(x)&&Number.isFinite(y))rows.push({a:ids[i],b:ids[j],x,y})}const xs=rows.map(r=>r.x),ys=rows.map(r=>r.y),corr=pearson(xs,ys),W=820,H=430,p={l:54,r:25,t:25,b:48},sx=x=>p.l+Math.max(0,Math.min(1,x))*(W-p.l-p.r),sy=y=>H-p.b-Math.max(0,Math.min(1,y))*(H-p.t-p.b);container.innerHTML=`<div class="tiny"><strong>r = ${fmt(corr,3)}</strong> · n=${rows.length} זוגות עם שני המדדים.</div><svg viewBox="0 0 ${W} ${H}" class="style-content-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/>${rows.map(r=>`<circle cx="${sx(r.x)}" cy="${sy(r.y)}" r="3.3" class="style-point" data-style-a="${escAttr(r.a)}" data-style-b="${escAttr(r.b)}"><title>${esc(displayName(r.a))} ↔ ${esc(displayName(r.b))} · תוכן ${fmt(r.x)} · חתימה ${fmt(r.y)}</title></circle>`).join('')}<text x="${W/2-45}" y="${H-12}" class="axis-title">mean raw תוכני →</text><text transform="translate(15 ${H/2+45}) rotate(-90)" class="axis-title">דמיון חתימה E3 →</text></svg>`;container.querySelectorAll('[data-style-a]').forEach(pt=>{pt.addEventListener('click',()=>{state.a=canon(pt.dataset.styleA);state.b=canon(pt.dataset.styleB);syncSelectors();renderClusters()});pt.addEventListener('dblclick',()=>{state.a=canon(pt.dataset.styleA);state.b=canon(pt.dataset.styleB);syncSelectors();switchTab('journey')})})}
  function pearson(xs,ys){if(xs.length!==ys.length||xs.length<2)return null;const mx=mean(xs),my=mean(ys),a=xs.map((x,i)=>(x-mx)*(ys[i]-my)).reduce((s,v)=>s+v,0),bx=Math.sqrt(xs.map(x=>(x-mx)**2).reduce((s,v)=>s+v,0)),by=Math.sqrt(ys.map(y=>(y-my)**2).reduce((s,v)=>s+v,0));return bx&&by?a/(bx*by):null}
  function linearRegression(xs,ys){if(xs.length!==ys.length||xs.length<2)return null;const mx=mean(xs),my=mean(ys),den=xs.map(x=>(x-mx)**2).reduce((s,v)=>s+v,0);if(!den)return null;const slope=xs.map((x,i)=>(x-mx)*(ys[i]-my)).reduce((s,v)=>s+v,0)/den;return {slope,intercept:my-slope*mx}}

  function renderDistanceSummary(){const rows=Q['כל_הזוגות_מדורגים']||[],raw=rows.map(r=>num(r.raw)).filter(Number.isFinite),bits=rows.map(r=>num(r.bits)).filter(Number.isFinite),above=rows.filter(r=>num(r.raw)>=.5).length,zero=rows.filter(r=>num(r.bits)<=0).length;return `<div class="grid-4" style="margin-top:14px">${qCard('חציון raw',median(raw),'כל 1,534 זוגות','נתונים חדשים · כימות')}${countCard('raw ≥ 0.50',above,`${(100*above/rows.length).toFixed(1)}% מן הזוגות`,'נתונים חדשים · כימות')}${qCard('חציון bits',median(bits),'כמות ראיה מכוילת','נתונים חדשים · כימות')}${countCard('bits ≤ 0',zero,`${(100*zero/rows.length).toFixed(1)}% ללא ראיה חיובית`,'נתונים חדשים · כימות')}</div><div class="notice" style="margin-top:12px">ה־CSV המלא בחבילה זו חושף raw ו־bits לכל זוג־קטע. המדדים D2–D5 המלאים לכל 1,534 הזוגות אינם נמסרים כטבלת שורות בחבילה; V7 אינו ממציא אותם.</div>`}
  function renderDistanceExtremes(){const rows=(Q['כל_הזוגות_מדורגים']||[]).slice().sort((a,b)=>num(b.raw)-num(a.raw)),pick=[...rows.slice(0,25),...rows.slice(-25).reverse()];return `<div class="table-wrap" style="max-height:520px"><table class="data-table"><thead><tr><th>קטע</th><th>א׳</th><th>ב׳</th><th>raw</th><th>bits</th><th>z בתוך הקטע</th></tr></thead><tbody>${pick.map(r=>`<tr class="clickable" data-cluster-pair="1" data-section="${escAttr(r.section)}" data-a="${escAttr(r.comm_a)}" data-b="${escAttr(r.comm_b)}"><td>§${esc(r.section)}</td><td>${esc(displayName(r.comm_a))}</td><td>${esc(displayName(r.comm_b))}</td><td class="num">${fmt(r.raw)}</td><td class="num">${fmt(r.bits)}</td><td class="num">${fmt(r.within_section_z)}</td></tr>`).join('')}</tbody></table></div>`}
  function renderThresholdPairs(){const rows=(Q['כל_הזוגות_מדורגים']||[]).filter(r=>num(r.raw)>=.5).sort((a,b)=>num(b.raw)-num(a.raw));return `<div class="table-wrap" style="max-height:520px"><table class="data-table"><thead><tr><th>#</th><th>קטע</th><th>א׳</th><th>ב׳</th><th>raw</th><th>bits</th><th>z</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="clickable" data-cluster-pair="1" data-section="${escAttr(r.section)}" data-a="${escAttr(r.comm_a)}" data-b="${escAttr(r.comm_b)}"><td>${i+1}</td><td>§${esc(r.section)}</td><td>${esc(displayName(r.comm_a))}</td><td>${esc(displayName(r.comm_b))}</td><td class="num">${fmt(r.raw)}</td><td class="num">${fmt(r.bits)}</td><td class="num">${fmt(r.within_section_z)}</td></tr>`).join('')}</tbody></table></div>`}
  function renderAllRankedPairs(){const rows=(Q['כל_הזוגות_מדורגים']||[]).slice().sort((a,b)=>sectionSortKey(a.section)-sectionSortKey(b.section)||num(b.raw)-num(a.raw));return `<div class="table-wrap" style="max-height:600px"><table class="data-table"><thead><tr><th>קטע</th><th>א׳</th><th>ב׳</th><th>raw</th><th>bits</th><th>z בתוך הקטע</th><th>n זוגות בקטע</th></tr></thead><tbody>${rows.map(r=>`<tr class="clickable" data-cluster-pair="1" data-section="${escAttr(r.section)}" data-a="${escAttr(r.comm_a)}" data-b="${escAttr(r.comm_b)}"><td>§${esc(r.section)}</td><td>${esc(displayName(r.comm_a))}</td><td>${esc(displayName(r.comm_b))}</td><td class="num">${fmt(r.raw)}</td><td class="num">${fmt(r.bits)}</td><td class="num">${fmt(r.within_section_z)}</td><td class="num">${fmt(r.n_pairs_in_section,0)}</td></tr>`).join('')}</tbody></table></div>`}
  function renderCoClusterTable(){const rows=(Q['קו_אשכול_בין_חיבורים']||[]).slice().sort((a,b)=>num(b.co_cluster_rate)-num(a.co_cluster_rate));return `<div class="table-wrap" style="max-height:520px"><table class="data-table"><thead><tr><th>א׳</th><th>ב׳</th><th>קו־אשכול</th><th>סעיפים משותפים</th></tr></thead><tbody>${rows.map(r=>`<tr class="clickable" data-cluster-pair="1" data-a="${escAttr(r.comm_a)}" data-b="${escAttr(r.comm_b)}"><td>${esc(displayName(r.comm_a))}</td><td>${esc(displayName(r.comm_b))}</td><td class="num">${fmt(r.co_cluster_rate)}</td><td class="num">${fmt(r.shared_sections,0)}</td></tr>`).join('')}</tbody></table></div>`}
  function joinedSectionPairs(section){const m=new Map();for(const r of bySectionPairs.get(String(section))||[])m.set(pairKey(r.comm_a,r.comm_b),{section:String(section),a:canon(r.comm_a),b:canon(r.comm_b),raw:num(r.raw),bits:num(r.bits),z:num(r.within_section_z)});for(const r of bySectionDecomp.get(String(section))||[]){const k=pairKey(r.a,r.b);if(!m.has(k))m.set(k,{section:String(section),a:canon(r.a),b:canon(r.b)});Object.assign(m.get(k),{locus:num(r.locus_overlap),reading:num(r.reading_agreement),shared:num(r.n_shared_concepts),comparable:num(r.n_comparable_claims)})}return [...m.values()].filter(r=>r.a!=='RAMBAN'&&r.b!=='RAMBAN')}
  function renderJoinedSectionPairTable(section){const rows=joinedSectionPairs(section).sort((a,b)=>(b.raw??-1)-(a.raw??-1));return `<div class="table-wrap" style="max-height:520px"><table class="data-table"><thead><tr><th>א׳</th><th>ב׳</th><th>raw</th><th>bits</th><th>חפיפת מוקדים</th><th>הסכמת קריאה</th><th>מושגים משותפים</th><th>טענות בנות־השוואה</th></tr></thead><tbody>${rows.map(r=>`<tr class="clickable" data-cluster-pair="1" data-a="${escAttr(r.a)}" data-b="${escAttr(r.b)}"><td>${esc(displayName(r.a))}</td><td>${esc(displayName(r.b))}</td><td class="num">${fmt(r.raw)}</td><td class="num">${fmt(r.bits)}</td><td class="num">${fmt(r.locus)}</td><td class="num">${fmt(r.reading)}</td><td class="num">${fmt(r.shared,0)}</td><td class="num">${fmt(r.comparable,0)}</td></tr>`).join('')}</tbody></table></div>`}

  function renderDispersionSummary(){const rows=Q['פירוק_התפזרות']||[],l=rows.map(r=>num(r.locus_overlap)).filter(Number.isFinite),rd=rows.map(r=>num(r.reading_agreement)).filter(Number.isFinite),sharedNoComp=rows.filter(r=>num(r.n_shared_concepts)>0&&num(r.n_comparable_claims)===0).length,comparable=rows.filter(r=>num(r.n_comparable_claims)>0),zeroAgree=comparable.filter(r=>num(r.reading_agreement)===0).length;return `<div class="grid-4">${qCard('חציון חפיפת מוקדים',median(l),'האם עוסקים באותו חומר','נתונים חדשים · כימות')}${qCard('חציון הסכמת קריאה',median(rd),'האם אומרים אותו דבר','נתונים חדשים · כימות')}${countCard('משותף, בלי טענה בת־השוואה',sharedNoComp,`${(100*sharedNoComp/rows.length).toFixed(1)}% בחישוב הישיר מן CSV`,'נתונים חדשים · כימות')}${countCard('אפס הסכמה כשיש השוואה',zeroAgree,`${(100*zeroAgree/comparable.length).toFixed(1)}% מתוך ${comparable.length}`,'נתונים חדשים · כימות')}</div><div class="notice" style="margin-top:12px">הדוח המילולי כותב 27% עבור “מושגים משותפים ללא טענה בת־השוואה”; החישוב הישיר מ־1,869 שורות ה־CSV מוצג כאן ואינו מוסתר. זהו פער מקור שדורש בירור.</div>`}
  function renderDecompFullTable(){const rows=Q['פירוק_התפזרות']||[];return `<div class="table-wrap" style="max-height:560px"><table class="data-table"><thead><tr><th>קטע</th><th>א׳</th><th>ב׳</th><th>חפיפת מוקדים</th><th>הסכמת קריאה</th><th>מושגים משותפים</th><th>טענות בנות־השוואה</th></tr></thead><tbody>${rows.map(r=>`<tr><td>§${esc(r.section)}</td><td>${esc(displayName(r.a))}</td><td>${esc(displayName(r.b))}</td><td class="num">${fmt(r.locus_overlap)}</td><td class="num">${fmt(r.reading_agreement)}</td><td class="num">${fmt(r.n_shared_concepts,0)}</td><td class="num">${fmt(r.n_comparable_claims,0)}</td></tr>`).join('')}</tbody></table></div>`}

  function renderRambanClosenessTable(){const rows=(Q['קרבה_לרמבן']||[]).slice().sort((a,b)=>num(a.mean_rank)-num(b.mean_rank));return `<div class="table-wrap" style="margin-top:14px"><table class="data-table"><thead><tr><th>דירוג</th><th>חיבור</th><th>סעיפים</th><th>D1 content</th><th>D5 order</th><th>co-cluster</th><th>register</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="clickable" data-cluster-pair="1" data-a="${escAttr(r.commentator)}" data-b="RAMBAN"><td>${i+1}</td><td>${esc(displayName(r.commentator))}</td><td class="num">${fmt(r.sections,0)}</td><td class="num">${fmt(r.content_D1cov)}</td><td class="num">${fmt(r.order_D5)}</td><td class="num">${fmt(r.co_cluster)}</td><td class="num">${fmt(r.register_sim)}</td></tr>`).join('')}</tbody></table></div>`}

  function renderHistogram(container,values,opts={}){if(!container||!values.length)return;const min=Number.isFinite(opts.min)?opts.min:Math.min(...values),max=Number.isFinite(opts.max)?opts.max:Math.max(...values),bins=opts.bins||20,w=720,h=250,pad={l:42,r:18,t:18,b:34},counts=Array(bins).fill(0);for(const v of values){let i=Math.floor((v-min)/(max-min||1)*bins);if(i===bins)i--;if(i>=0&&i<bins)counts[i]++}const ymax=Math.max(...counts),bw=(w-pad.l-pad.r)/bins;let bars='';counts.forEach((c,i)=>{const bh=(h-pad.t-pad.b)*c/ymax,x=pad.l+i*bw,y=h-pad.b-bh;bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1,bw-1).toFixed(1)}" height="${bh.toFixed(1)}" class="hist-bar"><title>${(min+i*(max-min)/bins).toFixed(3)}–${(min+(i+1)*(max-min)/bins).toFixed(3)}: ${c}</title></rect>`});let threshold='';if(Number.isFinite(opts.threshold)){const x=pad.l+(opts.threshold-min)/(max-min)*(w-pad.l-pad.r);threshold=`<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${h-pad.b}" class="threshold-line"/><text x="${x+4}" y="${pad.t+12}" class="chart-label">0.50</text>`}container.innerHTML=`<svg class="histogram" viewBox="0 0 ${w} ${h}">${bars}${threshold}<line x1="${pad.l}" y1="${h-pad.b}" x2="${w-pad.r}" y2="${h-pad.b}" class="chart-axis"/><text x="${pad.l}" y="${h-10}" class="chart-label">${fmt(min,2)}</text><text x="${w-pad.r-22}" y="${h-10}" class="chart-label">${fmt(max,2)}</text><text x="8" y="${pad.t+10}" class="chart-label">n=${values.length}</text></svg>`}
  function renderDispersionScatter(container){if(!container)return;const rows=Q['פירוק_התפזרות']||[],W=900,H=470,p={l:58,r:24,t:28,b:52},sx=x=>p.l+Math.max(0,Math.min(1,x))*(W-p.l-p.r),sy=y=>H-p.b-Math.max(0,Math.min(1,y))*(H-p.t-p.b),med=median(rows.map(r=>num(r.locus_overlap)).filter(Number.isFinite));let pts='';for(let ri=0;ri<rows.length;ri++){const r=rows[ri];const x=num(r.locus_overlap),y=num(r.reading_agreement);if(!Number.isFinite(x)||!Number.isFinite(y))continue;const selected=String(r.section)===String(state.section),j=(hash(`${r.section}|${r.a}|${r.b}`)%11-5)*.0016;pts+=`<circle cx="${sx(x)}" cy="${sy(Math.max(0,Math.min(1,y+j)))}" r="${selected?4.2:2.1}" class="scatter-point ${selected?'is-selected':''}" data-cluster-disp="${ri}"><title>§${escAttr(r.section)} · ${escAttr(displayName(r.a))} ↔ ${escAttr(displayName(r.b))} · מוקד ${fmt(x)} · קריאה ${fmt(y)} · לחיצה: בחר מקרה; לחיצה כפולה: פתח טקסט/רשת</title></circle>`}container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="dispersion-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/><line x1="${sx(med)}" y1="${p.t}" x2="${sx(med)}" y2="${H-p.b}" class="median-line"/><text x="${sx(med)+4}" y="${p.t+13}" class="chart-label">חציון מוקד ${fmt(med)}</text>${pts}<text x="${W/2-70}" y="${H-13}" class="axis-title">חפיפת מוקדים →</text><text transform="translate(15 ${H/2+60}) rotate(-90)" class="axis-title">הסכמת קריאה →</text><text x="${p.l}" y="${H-p.b+17}" class="chart-label">0</text><text x="${W-p.r-10}" y="${H-p.b+17}" class="chart-label">1</text><text x="${p.l-20}" y="${p.t+4}" class="chart-label">1</text></svg>`;container.querySelectorAll('[data-cluster-disp]').forEach(pt=>{const pick=()=>{const r=rows[Number(pt.dataset.clusterDisp)];if(!r)return;state.section=String(r.section);state.a=canon(r.a);state.b=canon(r.b);syncSelectors();renderClusters()};pt.addEventListener('click',pick);pt.addEventListener('dblclick',()=>{const r=rows[Number(pt.dataset.clusterDisp)];if(!r)return;state.section=String(r.section);state.a=canon(r.a);state.b=canon(r.b);syncSelectors();switchTab('journey')})})}
  function renderRambanClosenessViz(container){if(!container)return;const rows=(Q['קרבה_לרמבן']||[]).slice().sort((a,b)=>num(a.mean_rank)-num(b.mean_rank)),metrics=[['content_D1cov','D1 תוכן'],['order_D5','D5 סדר'],['co_cluster','קו־אשכול'],['register_sim','רגיסטר']];container.innerHTML=`<div class="metric-heat-table"><div class="metric-heat-head"><span>חיבור</span>${metrics.map(m=>`<b>${m[1]}</b>`).join('')}</div>${rows.map(r=>`<button class="metric-heat-row" data-cluster-pair="1" data-a="${escAttr(r.commentator)}" data-b="RAMBAN"><strong>${esc(displayName(r.commentator))}</strong>${metrics.map(([k])=>{const v=num(r[k]);return `<i style="background:${heatColor(v,0,1)}" title="${metrics.find(x=>x[0]===k)?.[1]}: ${fmt(v)}">${fmt(v)}</i>`}).join('')}</button>`).join('')}</div>`}
  function reportTypeShareRates(){return [{label:'ישות רוחנית',type:'SpiritualEntity',value:.391},{label:'דמות מקראית',type:'BiblicalFigure',value:.390},{label:'עצם פיזי',type:'PhysicalObject',value:.371},{label:'פסוק מקראי',type:'BiblicalQuotation',value:.349},{label:'מושג תיאולוגי',type:'TheologicalConcept',value:.320},{label:'מונח קבלי',type:'KabbalisticConcept',value:.306},{label:'מקור מקראי (ספר)',type:'BiblicalSource',value:.192}]}
  function renderTypeShareBars(container){if(!container)return;const rows=reportTypeShareRates(),W=700,H=300,p={l:190,r:36,t:18,b:25},barH=28,gap=8,max=.42;let out='';rows.forEach((r,i)=>{const y=p.t+i*(barH+gap),w=(W-p.l-p.r)*r.value/max;out+=`<g data-share-type="${escAttr(r.type)}"><text x="${p.l-10}" y="${y+19}" text-anchor="end" class="bar-label">${esc(r.label)}</text><rect x="${p.l}" y="${y}" width="${w}" height="${barH}" rx="5" class="type-share-bar"><title>${esc(r.label)} · שיעור שיתוף ${r.value.toFixed(3)} (${(r.value*100).toFixed(1)}%) · לחיצה: הצג סוג זה בטקסט</title></rect><text x="${p.l+w+7}" y="${y+19}" class="bar-value">${r.value.toFixed(3)}</text></g>`});container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="bar-svg">${out}</svg>`;container.querySelectorAll('[data-share-type]').forEach(g=>g.addEventListener('click',()=>{state.textTagMode='custom';state.textActiveTypes=[g.dataset.shareType];switchTab('journey')}))}
  function typeProfiles(){const rows=OLD.global.knowledgeBodies||[],ids=clusterIdsGlobal(),types=[...new Set(rows.map(r=>r.type||'Unknown'))];const counts=new Map(ids.map(c=>[c,new Map()]));for(const r of rows){for(const c0 of r.commentators||[]){const c=canon(c0);if(!counts.has(c))continue;const m=counts.get(c);m.set(r.type||'Unknown',(m.get(r.type||'Unknown')||0)+1)}}const totals=new Map(ids.map(c=>[c,[...counts.get(c).values()].reduce((a,b)=>a+b,0)]));const typeTotals=types.map(t=>[t,ids.reduce((s,c)=>s+(counts.get(c).get(t)||0),0)]).sort((a,b)=>b[1]-a[1]);const top=typeTotals.slice(0,12).map(x=>x[0]);return {ids,types:top,value:(c,t)=>{const total=totals.get(c)||0;return total?(counts.get(c).get(t)||0)/total:null}}}
  function renderTypeProfileHeatmap(container){if(!container)return;const d=typeProfiles();renderHeatmap(container,d.ids,d.types,(c,t)=>d.value(c,t),{min:0,max:.35,rowName:displayName,colName:typeLabel,title:(c,t,v)=>`${displayName(c)} · ${typeLabel(t)}: ${(v*100).toFixed(1)}% · לחיצה: פתח פרופיל`,onClick:(c,t)=>{state.a=canon(c);state.textTagMode='custom';state.textActiveTypes=[t];syncSelectors();switchTab('commentator')}})}
  function median(arr){const x=(arr||[]).filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}



  /* -------------------- V7: DISPERSION LAB -------------------- */
  async function renderDispersionLab(){
    const root=els.views.dispersion;if(!root)return;
    const allRows=Q['פירוק_התפזרות']||[];
    const sections=sortSections([...new Set(allRows.map(r=>String(r.section)))]);
    const focusOptions=allCommentators.filter(c=>c.id!=='RAMBAN');
    const activeGroup=dispersionActiveGroupIds();
    const manualPicker=state.dispersionGroupScope==='manual'?`<div class="dispersion-manual-picker"><div><strong>בחירה ידנית של פרשנים</strong><small>המסנן פועל על הזוגות לפי האפשרות “שניהם / לפחות אחד”. אפשר גם לשלוח אשכול שלם מן הטאב “אשכולות ופיזור”.</small></div><div class="manual-commentator-chips">${focusOptions.map(c=>`<button type="button" class="manual-commentator-chip ${(state.dispersionManualIds||[]).includes(c.id)?'is-on':''}" data-manual-id="${escAttr(c.id)}"><i style="background:${commentatorColor(c.id)}"></i>${esc(c.name)}</button>`).join('')}</div></div>`:'';
    root.innerHTML=`
      <section class="panel dispersion-hero">
        <div class="panel-head"><div><div class="eyebrow">V8 · Interactive dispersion laboratory</div><h2>מעבדת פיזור: מוקד, קריאה והקשר</h2><p>אותם 1,869 זוגות מן הדוח הופכים כאן למרחב חקר חי. כל נקודה היא זוג פרשנים בתוך קטע. הסרגל הקבוע שלמטה מסנן את <strong>כל התצוגות בעמוד</strong>, כך שאפשר להשוות קטע, פרשן, אשכול או קבוצת פרשנים בלי לאבד את ההקשר.</p></div><button class="small-btn" id="dispBackClusters">חזרה לאשכולות ופיזור</button></div>
      </section>
      <section class="dispersion-sticky-controls" id="dispersionStickyControls">
        <div class="dispersion-controls-head"><div><strong>מסנני מעבדת הפיזור</strong><small>כל המסננים חלים על הגרף, תצוגות הרוחב והטבלה. “אפס” בשדות הכמותיים = ללא סינון.</small></div><button class="small-btn" id="dispReset">איפוס מסננים</button></div>
        <div class="dispersion-controls dispersion-controls-v6">
          <label><span>צבע לפי</span><select id="dispColorBy" class="small-btn"><option value="quadrant" ${state.dispersionColorBy==='quadrant'?'selected':''}>דפוס פיזור</option><option value="section" ${state.dispersionColorBy==='section'?'selected':''}>מקור / קטע</option><option value="commentator" ${state.dispersionColorBy==='commentator'?'selected':''}>פרשן נבחר</option><option value="none" ${state.dispersionColorBy==='none'?'selected':''}>ללא צביעה</option></select></label>
          <label><span>גודל לפי</span><select id="dispSizeBy" class="small-btn"><option value="shared" ${state.dispersionSizeBy==='shared'?'selected':''}>מושגים משותפים</option><option value="claims" ${state.dispersionSizeBy==='claims'?'selected':''}>טענות בנות־השוואה</option><option value="uniform" ${state.dispersionSizeBy==='uniform'?'selected':''}>אחיד</option></select></label>
          <label><span>קטע</span><select id="dispSectionFilter" class="small-btn"><option value="all">כל הקטעים</option>${sections.map(s=>`<option value="${escAttr(s)}" ${String(state.dispersionSectionFilter)===String(s)?'selected':''}>§${esc(s)} · ${esc(sectionMap[s]?.passage_suggested||'')}</option>`).join('')}</select></label>
          <label><span>פרשן</span><select id="dispFocus" class="small-btn"><option value="all">ללא סינון פרשן</option>${focusOptions.map(c=>`<option value="${escAttr(c.id)}" ${state.dispersionFocus===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label><span>קבוצת ניתוח</span><select id="dispGroupScope" class="small-btn"><option value="all" ${state.dispersionGroupScope==='all'?'selected':''}>כל הפרשנים</option><option value="global" ${state.dispersionGroupScope==='global'?'selected':''}>האשכול הגלובלי סביב ${esc(displayName(state.a))}</option><option value="local" ${state.dispersionGroupScope==='local'?'selected':''}>האשכול המקומי סביב ${esc(displayName(state.a))} ב־§${esc(state.section)}</option><option value="manual" ${state.dispersionGroupScope==='manual'?'selected':''}>בחירה מרובה / קבוצה מן העץ</option></select></label>
          <label><span>הכללת קבוצה</span><select id="dispGroupMatch" class="small-btn"><option value="both" ${state.dispersionGroupMatch==='both'?'selected':''}>שני הפרשנים בתוך הקבוצה</option><option value="either" ${state.dispersionGroupMatch==='either'?'selected':''}>לפחות אחד מתוך הקבוצה</option></select></label>
          <label><span>מינ׳ מושגים משותפים</span><input id="dispMinShared" class="small-btn numeric-filter" type="number" min="0" step="1" value="${escAttr(state.dispersionMinShared)}"></label>
          <label><span>מינ׳ טענות להשוואה</span><input id="dispMinClaims" class="small-btn numeric-filter" type="number" min="0" step="1" value="${escAttr(state.dispersionMinClaims)}"></label>
          <label><span>עוצמת ראיה</span><select id="dispEvidence" class="small-btn"><option value="all" ${state.dispersionEvidence==='all'?'selected':''}>הכול</option><option value="positive" ${state.dispersionEvidence==='positive'?'selected':''}>bits &gt; 0</option><option value="strong" ${state.dispersionEvidence==='strong'?'selected':''}>bits ≥ 2</option><option value="verystrong" ${state.dispersionEvidence==='verystrong'?'selected':''}>bits ≥ 4</option><option value="raw50" ${state.dispersionEvidence==='raw50'?'selected':''}>raw ≥ 0.50</option></select></label>
        </div>
        ${manualPicker}
        <div class="dispersion-group-summary"><strong>אוכלוסיית הניתוח:</strong> <span id="dispGroupSummary">${dispersionGroupSummary(activeGroup)}</span></div>
        <div id="dispLegend" class="dispersion-legend"></div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>אופי ההתפזרות: מוקד לעומת קריאה</h2><p><strong>X — חפיפת מוקדים:</strong> כמה מן המושגים משותפים לשני הפרשנים. <strong>Y — הסכמת קריאה:</strong> עד כמה הם מסכימים בטענות כאשר יש בסיס להשוואה. נקודה ימינה ולמטה פירושה “אותו מוקד, קריאה שונה”; ימינה ולמעלה פירושה התכנסות.</p></div><span class="badge badge-quant">פירוק_התפזרות.csv</span></div>
        <div class="dispersion-layout"><div class="chart-box dispersion-live-box"><div id="dispLiveScatter"></div></div><aside id="dispSelection" class="dispersion-selection"></aside></div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>התכנסות ופיזור — שלושה מבטי רוחב חיים</h2><p>שלושת התרשימים משתמשים בדיוק באוכלוסייה שנבחרה בסרגל הקבוע: אפשר לראות כיצד ההרכב משתנה בין מקורות, היכן כל פרשן “יושב” במרחב, ואיך נראים המקורות כמכלול.</p></div></div>
        <div class="grid-2"><div class="chart-box"><h3>הרכב דפוסי הפיזור לפי קטע</h3><p class="tiny muted">כל שורה = קטע; כל צבע = שיעור הזוגות באחד מארבעת דפוסי מוקד×קריאה. התרשים מאפשר לראות מיד אילו מקורות מייצרים התכנסות ואילו פיזור.</p><div id="dispComposition"></div></div><div class="chart-box"><h3>מרכזי פרשנים במרחב מוקד × קריאה</h3><p class="tiny muted">כל נקודה = פרשן; המיקום הוא חציון כל הזוגות שבהם הוא משתתף בתוך המסנן הפעיל. הגודל = מספר ההשוואות.</p><div id="dispCommentatorCentroids"></div></div></div>
        <div class="grid-2" style="margin-top:14px"><div class="chart-box"><h3>אטלס פיזור של הקטעים המסוננים</h3><div id="dispLabAtlas"></div></div><div class="chart-box"><h3>עושר פרשני מול התפזרות</h3><div id="dispLabRichness"></div></div></div>
      </section>
      <section class="panel"><div class="panel-head"><div><h3>הנתונים שמאחורי הנקודות</h3><p>הטבלה משקפת את כל המסננים הפעילים. לחיצה על שורה בוחרת את הזוג והקטע.</p></div><span id="dispCount" class="badge badge-quant"></span></div><div id="dispFilteredTable"></div></section>`;
    const update=()=>renderDispersionLabViews(root);
    root.querySelector('#dispBackClusters')?.addEventListener('click',()=>switchTab('clusters'));
    root.querySelector('#dispReset')?.addEventListener('click',()=>{state.dispersionColorBy='quadrant';state.dispersionSizeBy='shared';state.dispersionFocus='all';state.dispersionSectionFilter='all';state.dispersionGroupScope='all';state.dispersionGroupMatch='both';state.dispersionManualIds=[];state.dispersionMinShared=0;state.dispersionMinClaims=0;state.dispersionEvidence='all';renderDispersionLab()});
    root.querySelector('#dispColorBy')?.addEventListener('change',e=>{state.dispersionColorBy=e.target.value;update()});
    root.querySelector('#dispSizeBy')?.addEventListener('change',e=>{state.dispersionSizeBy=e.target.value;update()});
    root.querySelector('#dispSectionFilter')?.addEventListener('change',e=>{state.dispersionSectionFilter=e.target.value;if(e.target.value!=='all'){state.section=String(e.target.value);syncSelectors()}update()});
    root.querySelector('#dispFocus')?.addEventListener('change',e=>{state.dispersionFocus=e.target.value==='all'?'all':canon(e.target.value);update()});
    root.querySelector('#dispGroupScope')?.addEventListener('change',e=>{state.dispersionGroupScope=e.target.value;renderDispersionLab()});
    root.querySelector('#dispGroupMatch')?.addEventListener('change',e=>{state.dispersionGroupMatch=e.target.value;update()});
    root.querySelector('#dispMinShared')?.addEventListener('change',e=>{state.dispersionMinShared=Math.max(0,Number(e.target.value)||0);update()});
    root.querySelector('#dispMinClaims')?.addEventListener('change',e=>{state.dispersionMinClaims=Math.max(0,Number(e.target.value)||0);update()});
    root.querySelector('#dispEvidence')?.addEventListener('change',e=>{state.dispersionEvidence=e.target.value;update()});
    root.querySelectorAll('[data-manual-id]').forEach(b=>b.addEventListener('click',()=>{const id=canon(b.dataset.manualId),set=new Set(state.dispersionManualIds||[]);set.has(id)?set.delete(id):set.add(id);state.dispersionManualIds=[...set];renderDispersionLab()}));
    root.addEventListener('click',e=>{const row=e.target.closest?.('[data-disp-row]');if(!row)return;const r=allRows[Number(row.dataset.dispRow)];if(!r)return;selectDispersionRow(r,root)});
    renderDispersionLabViews(root);
  }

  function dispersionActiveGroupIds(){
    if(state.dispersionGroupScope==='all')return null;
    if(state.dispersionGroupScope==='manual')return [...new Set((state.dispersionManualIds||[]).map(canon).filter(Boolean))];
    if(state.dispersionGroupScope==='global'){
      const ids=clusterIdsGlobal(),g=similarityGraph(ids,(a,b)=>globalClusterValue(a,b,state.clusterGlobalMetric),state.clusterGlobalThreshold,state.clusterGlobalMetric),comps=graphComponents(g.nodes,g.edges),hit=comps.find(c=>c.includes(canon(state.a)));
      return hit||[canon(state.a)];
    }
    if(state.dispersionGroupScope==='local'){
      const ids=clusterIdsLocal(state.section,state.clusterLocalMetric),g=similarityGraph(ids,(a,b)=>localClusterValue(state.section,a,b,state.clusterLocalMetric),state.clusterLocalThreshold,'local_similarity'),comps=graphComponents(g.nodes,g.edges),hit=comps.find(c=>c.includes(canon(state.a)));
      return hit||[canon(state.a)];
    }
    return null;
  }
  function dispersionGroupSummary(ids){
    if(!ids)return 'כל הפרשנים';
    if(!ids.length)return 'לא נבחרו פרשנים — אין זוגות להצגה';
    const label=state.dispersionGroupScope==='global'?`אשכול גלובלי · ${clusterMetricLabel(state.clusterGlobalMetric)} ≥ ${fmt(state.clusterGlobalThreshold,2)}`:state.dispersionGroupScope==='local'?`אשכול מקומי §${state.section} · ${clusterMetricLabel(state.clusterLocalMetric)} ≥ ${fmt(state.clusterLocalThreshold,2)}`:'קבוצה שנבחרה';
    return `${label} · ${ids.length} פרשנים: ${ids.map(displayName).join(' · ')}`;
  }
  function dispersionFilteredRows(){
    let rows=(Q['פירוק_התפזרות']||[]).map((r,i)=>{const p=getPairRow(r.section,r.a,r.b)||{};return {...r,_index:i,raw:num(p.raw),bits:num(p.bits),within_section_z:num(p.within_section_z)}});
    if(state.dispersionSectionFilter!=='all')rows=rows.filter(r=>String(r.section)===String(state.dispersionSectionFilter));
    if(state.dispersionFocus!=='all')rows=rows.filter(r=>canon(r.a)===canon(state.dispersionFocus)||canon(r.b)===canon(state.dispersionFocus));
    const group=dispersionActiveGroupIds();
    if(group){const set=new Set(group.map(canon));rows=rows.filter(r=>state.dispersionGroupMatch==='either'?(set.has(canon(r.a))||set.has(canon(r.b))):(set.has(canon(r.a))&&set.has(canon(r.b))))}
    if(state.dispersionMinShared>0)rows=rows.filter(r=>num(r.n_shared_concepts)>=state.dispersionMinShared);
    if(state.dispersionMinClaims>0)rows=rows.filter(r=>num(r.n_comparable_claims)>=state.dispersionMinClaims);
    if(state.dispersionEvidence==='positive')rows=rows.filter(r=>Number.isFinite(r.bits)&&r.bits>0);
    else if(state.dispersionEvidence==='strong')rows=rows.filter(r=>Number.isFinite(r.bits)&&r.bits>=2);
    else if(state.dispersionEvidence==='verystrong')rows=rows.filter(r=>Number.isFinite(r.bits)&&r.bits>=4);
    else if(state.dispersionEvidence==='raw50')rows=rows.filter(r=>Number.isFinite(r.raw)&&r.raw>=.5);
    return rows;
  }

  function renderDispersionLabViews(root){
    const rows=dispersionFilteredRows(),all=Q['פירוק_התפזרות']||[];
    const medL=median(all.map(r=>num(r.locus_overlap)).filter(Number.isFinite))||0,medR=median(all.map(r=>num(r.reading_agreement)).filter(Number.isFinite))||0;
    renderDispersionLiveScatter(root.querySelector('#dispLiveScatter'),rows,medL,medR,root);
    root.querySelector('#dispCount').textContent=`${rows.length.toLocaleString('he-IL')} מתוך ${all.length.toLocaleString('he-IL')} נקודות`;
    root.querySelector('#dispLegend').innerHTML=dispersionLegendHtml(rows,medL,medR);
    const summary=root.querySelector('#dispGroupSummary');if(summary)summary.textContent=dispersionGroupSummary(dispersionActiveGroupIds());
    root.querySelector('#dispFilteredTable').innerHTML=renderDispersionFilteredTable(rows.slice(0,300));
    renderDispersionSelection(root);
    renderDispersionComposition(root.querySelector('#dispComposition'),rows,medL,medR);
    renderCommentatorDispersionCentroids(root.querySelector('#dispCommentatorCentroids'),rows);
    renderFilteredSectionDispersionAtlas(root.querySelector('#dispLabAtlas'),rows);
    renderFilteredRichnessDivergence(root.querySelector('#dispLabRichness'),rows);
  }

  function renderDispersionComposition(container,rows,medL,medR){
    if(!container)return;const grouped=groupBy(rows,r=>String(r.section)),sections=sortSections([...grouped.keys()]);if(!sections.length){container.innerHTML='<div class="notice">אין נתונים למסננים הנוכחיים.</div>';return}
    const W=860,rowH=22,H=Math.max(210,sections.length*rowH+58),p={l:118,r:25,t:18,b:32},plotW=W-p.l-p.r,ks=['double_dispersion','same_focus_diff_reading','diff_focus_some_agreement','converge'];let out='';
    sections.forEach((sec,i)=>{const rs=grouped.get(sec)||[],counts=Object.fromEntries(ks.map(k=>[k,rs.filter(r=>dispersionQuadrant(r,medL,medR)===k).length])),y=p.t+i*rowH;let x=p.l;out+=`<g class="composition-row" data-composition-section="${escAttr(sec)}"><text x="${p.l-8}" y="${y+14}" text-anchor="end" class="bar-label">§${esc(sec)}</text>`;for(const k of ks){const w=rs.length?plotW*counts[k]/rs.length:0;out+=`<rect x="${x}" y="${y+2}" width="${w}" height="15" fill="${dispersionQuadrantColor(k)}"><title>§${esc(sec)} · ${esc(dispersionQuadrantLabel(k))}: ${counts[k]} / ${rs.length}</title></rect>`;x+=w}out+=`<text x="${W-p.r+3}" y="${y+14}" class="bar-value">${rs.length}</text></g>`});
    container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="composition-svg">${out}<text x="${p.l}" y="${H-8}" class="chart-label">0%</text><text x="${p.l+plotW-22}" y="${H-8}" class="chart-label">100%</text></svg>`;
    container.querySelectorAll('[data-composition-section]').forEach(g=>g.addEventListener('click',()=>{state.dispersionSectionFilter=String(g.dataset.compositionSection);state.section=String(g.dataset.compositionSection);syncSelectors();renderDispersionLab()}));
  }
  function renderCommentatorDispersionCentroids(container,rows){
    if(!container)return;const m=new Map();for(const r of rows){for(const id0 of [r.a,r.b]){const id=canon(id0);if(id==='RAMBAN')continue;if(!m.has(id))m.set(id,{id,l:[],rd:[],n:0});const x=m.get(id);const lv=num(r.locus_overlap),rv=num(r.reading_agreement);if(Number.isFinite(lv))x.l.push(lv);if(Number.isFinite(rv))x.rd.push(rv);x.n++}}
    const pts=[...m.values()].map(x=>({...x,x:median(x.l),y:median(x.rd)})).filter(x=>Number.isFinite(x.x)&&Number.isFinite(x.y));if(!pts.length){container.innerHTML='<div class="notice">אין פרשנים להצגה במסנן הנוכחי.</div>';return}
    const W=820,H=500,p={l:58,r:28,t:28,b:52},sx=x=>p.l+Math.max(0,Math.min(1,x))*(W-p.l-p.r),sy=y=>H-p.b-Math.max(0,Math.min(1,y))*(H-p.t-p.b),maxN=Math.max(...pts.map(x=>x.n));
    container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="centroid-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/>${pts.map(q=>{const r=4+7*Math.sqrt(q.n/Math.max(1,maxN)),hot=canon(state.dispersionFocus)==='all'?false:canon(state.dispersionFocus)===q.id;return `<g class="centroid-point ${hot?'is-selected':''}" data-centroid-id="${escAttr(q.id)}"><circle cx="${sx(q.x)}" cy="${sy(q.y)}" r="${r}" fill="${commentatorColor(q.id)}"/><text x="${sx(q.x)+r+4}" y="${sy(q.y)+4}">${esc(displayName(q.id))}</text><title>${esc(displayName(q.id))} · חציון מוקד ${fmt(q.x)} · חציון קריאה ${fmt(q.y)} · ${q.n} השוואות</title></g>`}).join('')}<text x="${W/2-70}" y="${H-12}" class="axis-title">חציון חפיפת מוקדים →</text><text transform="translate(15 ${H/2+55}) rotate(-90)" class="axis-title">חציון הסכמת קריאה →</text></svg>`;
    container.querySelectorAll('[data-centroid-id]').forEach(g=>g.addEventListener('click',()=>{state.dispersionFocus=canon(g.dataset.centroidId);state.dispersionColorBy='commentator';renderDispersionLab()}));
  }
  function filteredSectionStats(rows){
    const grouped=groupBy(rows,r=>String(r.section)),oldStats=new Map(sectionDispersionRows().map(r=>[String(r.section),r]));return sortSections([...grouped.keys()]).map(section=>{const rs=grouped.get(section)||[],l=rs.map(r=>num(r.locus_overlap)).filter(Number.isFinite),rd=rs.map(r=>num(r.reading_agreement)).filter(Number.isFinite),raw=rs.map(r=>num(r.raw)).filter(Number.isFinite),o=oldStats.get(section)||{};return {section,medianLocus:median(l),medianReading:median(rd),meanRaw:mean(raw),pairs:rs.length,richness:o.richness}}).filter(r=>Number.isFinite(r.medianLocus)&&Number.isFinite(r.medianReading));
  }
  function renderFilteredSectionDispersionAtlas(container,rows){
    if(!container)return;const stats=filteredSectionStats(rows);if(!stats.length){container.innerHTML='<div class="notice">אין מקורות להצגה במסנן הנוכחי.</div>';return}const W=760,H=420,p={l:52,r:22,t:24,b:46},sx=x=>p.l+x*(W-p.l-p.r),sy=y=>H-p.b-y*(H-p.t-p.b);container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="section-atlas-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/><text x="${W/2-60}" y="${H-12}" class="axis-title">חציון חפיפת מוקדים →</text><text transform="translate(15 ${H/2+50}) rotate(-90)" class="axis-title">חציון הסכמת קריאה →</text>${stats.map(r=>{const rad=Math.max(4,Math.min(12,3+Math.sqrt(r.pairs)*.55));return `<g class="atlas-point" data-filtered-section="${escAttr(r.section)}"><circle cx="${sx(r.medianLocus)}" cy="${sy(r.medianReading)}" r="${rad}"/><text x="${sx(r.medianLocus)+rad+3}" y="${sy(r.medianReading)+4}">§${esc(r.section)}</text><title>§${esc(r.section)} · מוקד ${fmt(r.medianLocus)} · קריאה ${fmt(r.medianReading)} · ${r.pairs} זוגות במסנן</title></g>`}).join('')}</svg>`;container.querySelectorAll('[data-filtered-section]').forEach(g=>g.addEventListener('click',()=>{state.dispersionSectionFilter=String(g.dataset.filteredSection);state.section=String(g.dataset.filteredSection);syncSelectors();renderDispersionLab()}));
  }
  function renderFilteredRichnessDivergence(container,rows){
    if(!container)return;const stats=filteredSectionStats(rows).filter(r=>Number.isFinite(r.richness)&&Number.isFinite(r.meanRaw));if(stats.length<2){container.innerHTML='<div class="notice">נדרשים לפחות שני מקורות עם raw ועושר מושגי כדי לחשב את המבט הזה.</div>';return}const xs=stats.map(r=>r.richness),ys=stats.map(r=>1-r.meanRaw),W=760,H=420,p={l:58,r:25,t:28,b:50},minX=Math.min(...xs),maxX=Math.max(...xs),sx=x=>p.l+(x-minX)/(maxX-minX||1)*(W-p.l-p.r),sy=y=>H-p.b-y*(H-p.t-p.b),corr=pearson(xs,ys),reg=linearRegression(xs,ys);container.innerHTML=`<div class="tiny"><strong>r = ${fmt(corr,3)}</strong> · מחושב מחדש על המקורות שנותרו אחרי הסינון.</div><svg viewBox="0 0 ${W} ${H}" class="section-atlas-svg"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/>${Number.isFinite(reg?.slope)?`<line x1="${sx(minX)}" y1="${sy(Math.max(0,Math.min(1,reg.intercept+reg.slope*minX)))}" x2="${sx(maxX)}" y2="${sy(Math.max(0,Math.min(1,reg.intercept+reg.slope*maxX)))}" class="trend-line"/>`:''}${stats.map(r=>`<g class="atlas-point" data-rich-section="${escAttr(r.section)}"><circle cx="${sx(r.richness)}" cy="${sy(1-r.meanRaw)}" r="5"/><title>§${esc(r.section)} · עושר ${fmt(r.richness,1)} · 1-mean raw ${fmt(1-r.meanRaw)} · ${r.pairs} זוגות מסוננים</title></g>`).join('')}<text x="${W/2-65}" y="${H-12}" class="axis-title">מושגים ממוצעים לפרשן →</text><text transform="translate(15 ${H/2+45}) rotate(-90)" class="axis-title">1 − mean raw (מסונן) →</text></svg>`;container.querySelectorAll('[data-rich-section]').forEach(g=>g.addEventListener('click',()=>{state.dispersionSectionFilter=String(g.dataset.richSection);state.section=String(g.dataset.richSection);syncSelectors();renderDispersionLab()}));
  }

  function sectionColor(section){const palette=['#3f78a8','#bd6a3e','#4f8f72','#86659b','#a17b32','#4b8792','#9a5b72','#657b93','#7a8451','#8d6247','#596b8f','#8a6b88','#607d65','#a05d56'];return palette[Math.abs(hash(String(section)))%palette.length]}
  function dispersionQuadrant(r,medL=.08,medR=.001){const l=num(r.locus_overlap),a=num(r.reading_agreement);if(l>=medL&&a>medR)return 'converge';if(l>=medL)return 'same_focus_diff_reading';if(a>medR)return 'diff_focus_some_agreement';return 'double_dispersion'}
  function dispersionQuadrantLabel(k){return ({converge:'התכנסות: מוקד משותף + הסכמה',same_focus_diff_reading:'אותו מוקד, קריאה שונה',diff_focus_some_agreement:'מוקדים שונים, אך הסכמה היכן שנפגשים',double_dispersion:'פיזור כפול: מוקד שונה + אין הסכמה'})[k]||k}
  function dispersionQuadrantColor(k){return ({converge:'#4f8f72',same_focus_diff_reading:'#b86843',diff_focus_some_agreement:'#557fa0',double_dispersion:'#8a8d89'})[k]||'#7c8580'}
  function dispersionPointColor(r,medL,medR){
    if(state.dispersionColorBy==='quadrant')return dispersionQuadrantColor(dispersionQuadrant(r,medL,medR));
    if(state.dispersionColorBy==='section')return sectionColor(r.section);
    if(state.dispersionColorBy==='commentator'){const f=state.dispersionFocus==='all'?state.a:state.dispersionFocus;return (canon(r.a)===canon(f)||canon(r.b)===canon(f))?commentatorColor(f):'#c8ccc8'}
    return '#687d73';
  }
  function dispersionPointRadius(r,maxShared,maxClaims){
    if(state.dispersionSizeBy==='uniform')return 3.2;
    if(state.dispersionSizeBy==='claims')return 2.2+6*Math.sqrt(Math.max(0,num(r.n_comparable_claims)||0)/Math.max(1,maxClaims));
    return 2.2+6*Math.sqrt(Math.max(0,num(r.n_shared_concepts)||0)/Math.max(1,maxShared));
  }
  function dispersionLegendHtml(rows,medL,medR){
    if(state.dispersionColorBy==='quadrant'){const ks=['converge','same_focus_diff_reading','diff_focus_some_agreement','double_dispersion'];return `<strong>מקרא צבעים</strong>${ks.map(k=>`<span><i style="background:${dispersionQuadrantColor(k)}"></i>${esc(dispersionQuadrantLabel(k))}<small>${rows.filter(r=>dispersionQuadrant(r,medL,medR)===k).length}</small></span>`).join('')}<em>קווי העזר: חציון מוקד ${fmt(medL)} · חציון קריאה ${fmt(medR)}</em>`}
    if(state.dispersionColorBy==='commentator'){const f=state.dispersionFocus==='all'?state.a:state.dispersionFocus;return `<strong>מקרא צבעים</strong><span><i style="background:${commentatorColor(f)}"></i>זוגות הכוללים את ${esc(displayName(f))}</span><span><i style="background:#c8ccc8"></i>זוגות אחרים</span>`}
    if(state.dispersionColorBy==='section'){const secs=[...new Set(rows.map(r=>String(r.section)))];return `<strong>מקרא צבעים</strong>${secs.slice(0,18).map(s=>`<span><i style="background:${sectionColor(s)}"></i>§${esc(s)}</span>`).join('')}${secs.length>18?`<em>מוצגים במקרא 18 מתוך ${secs.length} קטעים; הצבע נשאר קבוע לכל קטע.</em>`:''}`}
    return `<strong>מקרא</strong><span><i style="background:#687d73"></i>כל הזוגות הפעילים</span>`;
  }
  function renderDispersionLiveScatter(container,rows,medL,medR,root){
    if(!container)return;const W=1040,H=620,p={l:70,r:28,t:34,b:62},sx=x=>p.l+Math.max(0,Math.min(1,x))*(W-p.l-p.r),sy=y=>H-p.b-Math.max(0,Math.min(1,y))*(H-p.t-p.b);
    const maxShared=Math.max(1,...rows.map(r=>num(r.n_shared_concepts)||0)),maxClaims=Math.max(1,...rows.map(r=>num(r.n_comparable_claims)||0));
    let pts='';for(const r of rows){const x=num(r.locus_overlap),y=num(r.reading_agreement);if(!Number.isFinite(x)||!Number.isFinite(y))continue;const col=dispersionPointColor(r,medL,medR),rad=dispersionPointRadius(r,maxShared,maxClaims),sel=state.dispersionSelection&&String(state.dispersionSelection.section)===String(r.section)&&pairKey(state.dispersionSelection.a,state.dispersionSelection.b)===pairKey(r.a,r.b);pts+=`<g class="disp-live-point ${sel?'is-selected':''}" data-disp-index="${r._index}" tabindex="0"><circle cx="${sx(x)}" cy="${sy(y)}" r="${rad.toFixed(2)}" fill="${col}"/><title>§${esc(r.section)} · ${esc(displayName(r.a))} ↔ ${esc(displayName(r.b))} · מוקד ${fmt(x)} · קריאה ${fmt(y)} · ${r.n_shared_concepts} מושגים · ${r.n_comparable_claims} טענות</title></g>`}
    container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="dispersion-live-svg"><rect x="${p.l}" y="${p.t}" width="${W-p.l-p.r}" height="${H-p.t-p.b}" class="plot-bg"/><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}" class="chart-axis"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}" class="chart-axis"/><line x1="${sx(medL)}" y1="${p.t}" x2="${sx(medL)}" y2="${H-p.b}" class="median-line"/><line x1="${p.l}" y1="${sy(medR)}" x2="${W-p.r}" y2="${sy(medR)}" class="median-line"/><text x="${sx(medL)+5}" y="${p.t+14}" class="chart-label">חציון מוקד ${fmt(medL)}</text><text x="${p.l+5}" y="${sy(medR)-6}" class="chart-label">חציון קריאה ${fmt(medR)}</text>${pts}<text x="${W/2-85}" y="${H-17}" class="axis-title">חפיפת מוקדים — שונים ← → משותפים</text><text transform="translate(18 ${H/2+90}) rotate(-90)" class="axis-title">הסכמת קריאה — מחלוקת ← → הסכמה</text><text x="${p.l}" y="${H-p.b+20}" class="chart-label">0</text><text x="${W-p.r-10}" y="${H-p.b+20}" class="chart-label">1</text><text x="${p.l-22}" y="${p.t+5}" class="chart-label">1</text></svg>`;
    container.querySelectorAll('[data-disp-index]').forEach(g=>{const pick=()=>{const r=(Q['פירוק_התפזרות']||[])[Number(g.dataset.dispIndex)];if(r)selectDispersionRow(r,root)};g.addEventListener('click',pick);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}});g.addEventListener('dblclick',()=>{const r=(Q['פירוק_התפזרות']||[])[Number(g.dataset.dispIndex)];if(r){selectDispersionRow(r,root);switchTab('journey')}})});
  }
  function selectDispersionRow(r,root){state.dispersionSelection={section:String(r.section),a:canon(r.a),b:canon(r.b)};state.section=String(r.section);state.a=canon(r.a);state.b=canon(r.b);syncSelectors();updateContextCaption();renderDispersionLabViews(root)}
  function renderDispersionSelection(root){const box=root.querySelector('#dispSelection');if(!box)return;const s=state.dispersionSelection;if(!s){box.innerHTML=`<div class="empty-selection"><strong>בחרו נקודה</strong><p>לחיצה על נקודה תציג כאן את הזוג, המקור והמדדים. לאחר הבחירה אפשר לפתוח מכאן את הטקסט, הרשת והכימות של אותו מקרה.</p></div>`;return}const d=getDecompRow(s.section,s.a,s.b),p=getPairRow(s.section,s.a,s.b),m=sectionMap[s.section]||{};box.innerHTML=`<div class="eyebrow">המקרה הנבחר</div><h3>§${esc(s.section)} · ${esc(m.passage_suggested||'')}</h3><p><strong>${esc(displayName(s.a))}</strong> ↔ <strong>${esc(displayName(s.b))}</strong></p><div class="selection-metrics"><span><b>${fmt(d?.locus_overlap)}</b>חפיפת מוקדים</span><span><b>${fmt(d?.reading_agreement)}</b>הסכמת קריאה</span><span><b>${fmt(p?.raw)}</b>raw</span><span><b>${fmt(p?.bits)}</b>bits</span><span><b>${fmt(d?.n_shared_concepts,0)}</b>מושגים משותפים</span><span><b>${fmt(d?.n_comparable_claims,0)}</b>טענות להשוואה</span></div><button class="small-btn primary" id="dispOpenJourney">פתח טקסט → רשת → כימות</button>`;box.querySelector('#dispOpenJourney')?.addEventListener('click',()=>switchTab('journey'))}
  function renderDispersionFilteredTable(rows){if(!rows.length)return '<div class="notice">אין נקודות המתאימות למסננים.</div>';return `<div class="table-wrap" style="max-height:520px"><table class="data-table"><thead><tr><th>קטע</th><th>פרשן א׳</th><th>פרשן ב׳</th><th>מוקד</th><th>קריאה</th><th>raw</th><th>bits</th><th>מושגים</th><th>טענות</th></tr></thead><tbody>${rows.map(r=>`<tr class="clickable" data-disp-row="${r._index}"><td>§${esc(r.section)}</td><td>${esc(displayName(r.a))}</td><td>${esc(displayName(r.b))}</td><td class="num">${fmt(r.locus_overlap)}</td><td class="num">${fmt(r.reading_agreement)}</td><td class="num">${fmt(r.raw)}</td><td class="num">${fmt(r.bits)}</td><td class="num">${fmt(r.n_shared_concepts,0)}</td><td class="num">${fmt(r.n_comparable_claims,0)}</td></tr>`).join('')}</tbody></table></div>${rows.length>=300?'<div class="tiny muted">מוצגות 300 השורות הראשונות של המסנן; כל הנקודות עדיין מופיעות בגרף.</div>':''}`}

  /* -------------------- REPORTS -------------------- */
  function renderReports(){
    const root=els.views.reports;
    const grouped=groupBy(Object.entries(reports),([,r])=>r.group||'מסמכים');
    if(!reports[state.reportId])state.reportId=Object.keys(reports)[0];
    const r=reports[state.reportId];
    const isNew=state.reportId.startsWith('new:');
    const fileBase=(r.file||'').replace(/\.md$/,'');
    root.innerHTML=`<div class="report-layout">
      <aside class="report-menu">${[...grouped.entries()].map(([g,arr])=>`<div class="report-group-title">${esc(g)}</div>${arr.map(([id,rr])=>`<button class="report-link ${id===state.reportId?'is-active':''}" data-report="${escAttr(id)}">${esc(rr.title)}</button>`).join('')}`).join('')}</aside>
      <section>
        <div class="panel flat" style="padding:12px 16px"><div class="panel-head" style="margin:0"><div><span class="badge ${isNew?'badge-quant':'badge-net'}">${isNew?'נתונים חדשים':'נתונים ישנים'}</span><strong style="margin-right:8px">${esc(r.title)}</strong></div><div class="controls">${isNew&&r.file?`<a class="small-btn" href="./source/new_reports/${encodeURIComponent(r.file)}">Markdown מקור</a>${fileBase?`<a class="small-btn" href="./source/new_reports/${encodeURIComponent(fileBase+'.pdf')}">PDF</a>`:''}`:''}</div></div></div>
        <article class="markdown">${markdownToHtml(r.content||'')}</article>
      </section>
    </div>`;
    root.querySelectorAll('[data-report]').forEach(b=>b.addEventListener('click',()=>{state.reportId=b.dataset.report;renderReports();window.scrollTo({top:0,behavior:'smooth'});}));
  }

  /* -------------------- DATA / QA -------------------- */
  function renderDataQA(){
    const root=els.views.data;
    const qa=computeQA();
    const rawOptions=[...Object.keys(Q).map(k=>['q:'+k,'כימות: '+k]),...Object.keys(OLD.global||{}).map(k=>['o:'+k,'ישן: '+k])];
    if(!rawOptions.some(([k])=>k===state.rawTable))state.rawTable='q:כל_הזוגות_מדורגים';
    const rawRows=getRawRows(state.rawTable);
    const filtered=filterRawRows(rawRows,state.rawSearch).slice(0,250);
    root.innerHTML=`
      <section class="panel"><div class="panel-head"><div><h2>מפת מקורות הנתונים</h2><p>הפרדה בין שכבת המקור הפרשנית לבין שכבות המדידה — בלי לאבד את הקישור ביניהן.</p></div></div>
        <div class="grid-3">
          <div class="data-source-card"><span class="badge badge-text">טקסט</span><h4>טקסטי הרמב״ן והפרשנים</h4><p class="tiny muted">37 קטעים בנתונים הישנים; הטקסט נמצא בתוך גרף כל קטע־פרשן.</p></div>
          <div class="data-source-card"><span class="badge badge-net">נתונים ישנים · רשת E2/E3</span><h4>מושגים, קשרים ומדדי גרף</h4><p class="tiny muted">${fmt(OLD.global.coverageRows?.length,0)} רשומות coverage · ${fmt(OLD.global.corpusGraphMetricsRows?.length,0)} רשומות מדדי רשת · ${fmt(OLD.global.knowledgeBodies?.length,0)} גופי ידע.</p></div>
          <div class="data-source-card"><span class="badge badge-quant">נתונים חדשים · כימות</span><h4>זוגות, פירוק התפזרות, אשכולות וראיות</h4><p class="tiny muted">${fmt((Q['כל_הזוגות_מדורגים']||[]).length,0)} זוגות מדורגים · ${fmt((Q['פירוק_התפזרות']||[]).length,0)} רשומות פירוק · ${fmt((Q['מושגים_משותפים_לרבים']||[]).length,0)} מושגים.</p></div>
        </div>
      </section>
      <section class="panel"><div class="panel-head"><div><h3>בדיקות סנכרון</h3><p>בדיקות שמונעות מן הממשק להציג התאמה שאינה קיימת במקור.</p></div></div>
        <div class="grid-2">${qa.map(x=>`<div class="data-source-card"><div class="${x.level==='pass'?'qa-pass':x.level==='fail'?'qa-fail':'qa-warn'}">${x.level==='pass'?'✓':x.level==='fail'?'✕':'⚠'} ${esc(x.title)}</div><p class="tiny muted">${esc(x.detail)}</p></div>`).join('')}</div>
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Crosswalk — קטעים וחיבורים</h3><p>§7_2 נשמר במפורש כקטע כמותי שאין לו שכבת טקסט/רשת בנתונים הישנים.</p></div></div>${renderCrosswalk()}</section>
      <section class="panel"><div class="panel-head"><div><h3>דפדפן נתונים גולמי</h3><p>כל שבע טבלאות ה־CSV של חבילת הנתונים החדשים זמינות כאן; בנוסף טבלאות הליבה של הדשבורד הישן. מוצגות עד 250 שורות בכל פעם.</p></div><div class="controls"><select id="rawTableSelect" class="small-btn">${rawOptions.map(([k,l])=>`<option value="${escAttr(k)}" ${k===state.rawTable?'selected':''}>${esc(l)}</option>`).join('')}</select><input id="rawSearch" class="small-btn" placeholder="חיפוש בטבלה" value="${escAttr(state.rawSearch)}"></div></div>${renderRawTable(filtered)}<p class="tiny muted">${filtered.length} מתוך ${filterRawRows(rawRows,state.rawSearch).length} תוצאות · ${rawRows.length} שורות במקור.</p></section>
    `;
    root.querySelector('#rawTableSelect').addEventListener('change',e=>{state.rawTable=e.target.value;state.rawSearch='';renderDataQA();});
    root.querySelector('#rawSearch').addEventListener('change',e=>{state.rawSearch=e.target.value;renderDataQA();});
  }

  function computeQA(){
    const oldSecs=new Set(Object.keys(oldSectionSummary)),newSecs=new Set(Object.keys(sectionMap));
    const onlyNew=[...newSecs].filter(x=>!oldSecs.has(x));
    const oldComms=new Set(Object.keys(oldCommentatorSummary).map(canon)),newComms=new Set(quantCommentators.map(canon));
    const missingComms=[...oldComms].filter(x=>!newComms.has(x));
    const pairKeys=new Set((Q['כל_הזוגות_מדורגים']||[]).map(r=>`${String(r.section)}|${pairKey(r.comm_a,r.comm_b)}`));
    const decKeys=new Set((Q['פירוק_התפזרות']||[]).map(r=>`${String(r.section)}|${pairKey(r.a,r.b)}`));
    const missingDecomp=[...pairKeys].filter(k=>!decKeys.has(k));
    const detailedKeys=new Set(); Object.entries(oldSectionSummary).forEach(([sid,ss])=>(ss.graphIds||[]).forEach(c=>detailedKeys.add(`${sid}|${canon(c)}`)));
    const coverageKeys=new Set((OLD.global.coverageRows||[]).map(r=>`${String(r.section)}|${canon(r.commentator)}`));
    const coverageWithoutDetail=[...coverageKeys].filter(k=>!detailedKeys.has(k));
    return [
      {level:'pass',title:'כל 7 טבלאות הכימות נטענו',detail:Object.keys(Q).map(k=>`${k}: ${Q[k].length}`).join(' · ')},
      {level:onlyNew.length===1&&onlyNew[0]==='7_2'?'pass':'warn',title:`סנכרון קטעים: ${oldSecs.size} ישנים / ${newSecs.size} חדשים`,detail:`קטעים הקיימים רק בכימות: ${onlyNew.join(', ')||'אין'}.`},
      {level:missingComms.length?'warn':'pass',title:'Crosswalk החיבורים',detail:missingComms.length?`אין התאמה בנתונים החדשים: ${missingComms.join(', ')}`:`כל ${oldComms.size} מזהי החיבורים הישנים ממופים לשמות הנתונים החדשים.`},
      {level:coverageWithoutDetail.length?'warn':'pass',title:'coverage מול גרפי הטקסט המפורטים',detail:coverageWithoutDetail.length?`${coverageWithoutDetail.length} רשומות coverage אינן מחזיקות אובייקט טקסט/גרף מפורט בדשבורד הישן: ${coverageWithoutDetail.join(' ; ')}`:'כל רשומות coverage מחוברות לגרף מפורט.'},
      {level:missingDecomp.length?'warn':'pass',title:'כיסוי זוגות בין טבלת הדירוג לפירוק ההתפזרות',detail:missingDecomp.length?`${missingDecomp.length} זוגות מדורגים אינם מופיעים בטבלת הפירוק. דוגמה: ${missingDecomp.slice(0,3).join(' ; ')}`:'כל הזוגות המדורגים נמצאו גם בפירוק ההתפזרות.'},
      {level:'warn',title:'§1 — שגיאת נתונים ידועה',detail:'גרף הרמב״ן ב־§1 מכיל את הקטע השגוי (תוכן §13). הממשק מציג את האזהרה ואינו מתקן את המקור.'},
      {level:'pass',title:'דוחות מילוליים',detail:`${Object.keys(reports).length} מסמכים/תקצירי מקור מוטמעים בלשונית הדוחות; ששת דוחות חבילת הנתונים החדשים נמצאים במלואם.`},
    ];
  }

  function renderCrosswalk(){
    const rows=PACK.crosswalk?.sections||[];
    return `<div class="grid-2"><div class="table-wrap"><table class="data-table"><thead><tr><th>קטע</th><th>טקסט/רשת</th><th>כימות</th><th>זיהוי</th></tr></thead><tbody>${rows.map(r=>`<tr><td>§${esc(r.id)}</td><td>${r.old?'✓':'—'}</td><td>${r.new?'✓':'—'}</td><td>${esc(sectionMap[r.id]?.passage_suggested||'')}</td></tr>`).join('')}</tbody></table></div><div class="table-wrap"><table class="data-table"><thead><tr><th>חיבור</th><th>מזהה E2</th><th>כימות</th></tr></thead><tbody>${(PACK.crosswalk?.commentators||[]).map(r=>`<tr><td>${esc(r.name||r.new_id)}</td><td class="ltr">${esc(r.old_id)}</td><td>${r.new?'✓':'—'}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function getRawRows(key){
    let v=null;
    if(key.startsWith('q:')) v=Q[key.slice(2)];
    else if(key.startsWith('o:')) v=OLD.global[key.slice(2)];
    if(Array.isArray(v)) return v;
    if(v && typeof v==='object') return Object.entries(v).map(([key,value])=>({key,value}));
    return v===null||v===undefined?[]:[{value:v}];
  }
  function filterRawRows(rows,term){if(!term)return rows;const t=term.toLowerCase();return rows.filter(r=>Object.values(r||{}).some(v=>String(v??'').toLowerCase().includes(t)))}
  function renderRawTable(rows){if(!rows.length)return '<div class="notice">אין שורות להצגה.</div>';const cols=[...new Set(rows.slice(0,50).flatMap(r=>Object.keys(r||{})))];return `<div class="table-wrap" style="max-height:650px"><table class="data-table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(formatCell(r[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}

  /* -------------------- DATA FUNCTIONS -------------------- */
  function getPairRow(section,a,b){return (bySectionPairs.get(String(section))||[]).find(r=>pairKey(r.comm_a,r.comm_b)===pairKey(a,b))||null}
  function getDecompRow(section,a,b){return (bySectionDecomp.get(String(section))||[]).find(r=>pairKey(r.a,r.b)===pairKey(a,b))||null}
  function oldAlign(section,c){if(canon(c)==='RAMBAN')return 1;const s=oldSectionSummary[String(section)];const r=(s?.pairwise||[]).find(x=>canon(x.commentatorId)===canon(c));return num(r?.align)}
  function sectionPairValue(section,a,b,metric){
    if(canon(a)===canon(b))return 1;
    if(metric==='raw'||metric==='bits'){const r=getPairRow(section,a,b);return num(r?.[metric]);}
    const d=getDecompRow(section,a,b);return num(d?.[metric]);
  }
  function buildPairMeans(){
    const acc=new Map();
    for(const r of Q['כל_הזוגות_מדורגים']||[]){const k=pairKey(r.comm_a,r.comm_b);if(!acc.has(k))acc.set(k,{raw:[],bits:[]});if(Number.isFinite(num(r.raw)))acc.get(k).raw.push(num(r.raw));if(Number.isFinite(num(r.bits)))acc.get(k).bits.push(num(r.bits));}
    for(const r of Q['פירוק_התפזרות']||[]){const k=pairKey(r.a,r.b);if(!acc.has(k))acc.set(k,{raw:[],bits:[]});const x=acc.get(k);x.locus_overlap=x.locus_overlap||[];x.reading_agreement=x.reading_agreement||[];if(Number.isFinite(num(r.locus_overlap)))x.locus_overlap.push(num(r.locus_overlap));if(Number.isFinite(num(r.reading_agreement)))x.reading_agreement.push(num(r.reading_agreement));}
    const out=new Map();for(const [k,v] of acc)out.set(k,{mean_raw:mean(v.raw),mean_bits:mean(v.bits),mean_locus:mean(v.locus_overlap),mean_reading:mean(v.reading_agreement)});return out;
  }
  function globalPairValue(a,b,metric){
    if(canon(a)===canon(b))return 1;
    if(metric==='co_cluster')return num(coClusterMap.get(pairKey(a,b))?.co_cluster_rate);
    if(metric==='signature')return signatureValue(a,b);
    return num(pairMeans.get(pairKey(a,b))?.[metric]);
  }
  function signatureValue(a,b){const rows=OLD.global.signatureMatrixRows||[];const row=rows.find(r=>canon(r['']||r.commentator||r.id)===canon(a));if(!row)return null;return num(row[toOldId(b)] ?? row[canon(b)] ?? row[b]);}

  function buildCommentatorList(){
    const ids=new Set();
    (Q['מפתח_חיבורים']||[]).forEach(r=>ids.add(canon(r.identifier)));
    Object.keys(oldCommentatorSummary).forEach(c=>ids.add(canon(c)));
    return [...ids].map(id=>({id,name:displayName(id)})).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  }
  function displayName(id){const c=canon(id);return nameMap[c]||nameMap[toOldId(c)]||({'RAMBAN':'רמב״ן (טקסט הבסיס)'})[c]||c.replaceAll('_',' ')}
  function canon(id){const s=String(id??'');return s==='מערכת_האלוהות'?'מערכת האלוהות':s}
  function toOldId(id){return canon(id)==='מערכת האלוהות'?'מערכת_האלוהות':canon(id)}
  function pairKey(a,b){return [canon(a),canon(b)].sort((x,y)=>x.localeCompare(y,'en')).join('||')}
  function pickAlternative(id){return (allCommentators.find(c=>c.id!==id&&c.id!=='RAMBAN')||allCommentators.find(c=>c.id!==id)||{id:'RAMBAN'}).id}
  function syncSelectors(){els.sectionSelect.value=state.section;els.aSelect.value=state.a;els.bSelect.value=state.b;updateContextCaption();}

  async function ensureSection(section){
    const id=String(section);if(window.RAMBAN_V2_SECTIONS[id])return window.RAMBAN_V2_SECTIONS[id];
    const ent=(OLD.index.sections||[]).find(x=>String(x.id)===id);if(!ent)return null;
    await loadScript(`./data/sections/section_${encodeURIComponent(id)}.js`);return window.RAMBAN_V2_SECTIONS[id]||null;
  }
  async function ensureAllSections(){await Promise.all((OLD.index.sections||[]).map(x=>ensureSection(String(x.id))));return window.RAMBAN_V2_SECTIONS;}
  async function ensureCommentator(commentator){
    const id=toOldId(commentator);if(window.RAMBAN_V2_COMMENTATORS[id])return window.RAMBAN_V2_COMMENTATORS[id];
    await loadScript(`./data/commentators/commentator_${encodeURIComponent(id)}.js`);return window.RAMBAN_V2_COMMENTATORS[id]||null;
  }
  function loadScript(src){if(loadedScripts.has(src))return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>{loadedScripts.add(src);resolve()};s.onerror=()=>reject(new Error('Failed '+src));document.head.appendChild(s);})}

  /* -------------------- GRAPH -------------------- */
  function topGraphConcepts(graph,n=14){
    const degree=new Map((graph.nodes||[]).map(x=>[x.id,0]));(graph.edges||[]).forEach(e=>{degree.set(e.source,(degree.get(e.source)||0)+1);degree.set(e.target,(degree.get(e.target)||0)+1)});
    return (graph.nodes||[]).filter(x=>x.type!=='BiblicalQuotation').slice().sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0)).slice(0,n);
  }
  function literalSharedConcepts(a,b){const bm=new Map((b.nodes||[]).map(n=>[normConcept(n.label),n.label]));const out=[];for(const n of a.nodes||[]){const k=normConcept(n.label);if(k&&bm.has(k))out.push(n.label)}return [...new Set(out)]}
  function normConcept(s){return String(s||'').normalize('NFKD').replace(/[\u0591-\u05C7]/g,'').replace(/["'׳״.,:;!?()\[\]{}\-–—]/g,' ').replace(/\s+/g,' ').trim().toLowerCase()}

  function overlayGraphs(gA,gB,aId,bId){return overlayManyGraphs([{graph:gA,owner:canon(aId)},{graph:gB,owner:canon(bId)}])}
  function overlayManyGraphs(items){
    const valid=(items||[]).filter(x=>x?.graph);if(!valid.length)return null;if(valid.length===1){const g=valid[0].graph;return {...g,nodes:(g.nodes||[]).map(n=>({...n,owners:[valid[0].owner]})),edges:(g.edges||[]).map(e=>({...e,owners:[valid[0].owner]})),overlay:true}}
    const nodes=new Map(),maps=new Map();
    for(const {graph,owner} of valid){const idMap=new Map();maps.set(owner,idMap);for(const n of graph.nodes||[]){const k=normConcept(n.label)||`${owner}:${n.id}`;const id='m_'+hash(k);if(!nodes.has(k))nodes.set(k,{...n,id,owners:[owner]});else{const x=nodes.get(k);if(!x.owners.includes(owner))x.owners.push(owner);if((num(n.freq)||0)>(num(x.freq)||0))x.freq=n.freq}idMap.set(n.id,id)}}
    const edgeMap=new Map();for(const {graph,owner} of valid){const idMap=maps.get(owner);for(const e of graph.edges||[]){const a=idMap.get(e.source),b=idMap.get(e.target);if(!a||!b)continue;const k=`${a}|${b}|${e.predicate||''}`;if(!edgeMap.has(k))edgeMap.set(k,{...e,id:'e_'+hash(k),source:a,target:b,owners:[owner]});else{const x=edgeMap.get(k);if(!x.owners.includes(owner))x.owners.push(owner);x.weight=(num(x.weight)||1)+(num(e.weight)||1)}}}
    return {nodes:[...nodes.values()],edges:[...edgeMap.values()],nodeCount:nodes.size,edgeCount:edgeMap.size,overlay:true,ownerIds:valid.map(x=>x.owner)};
  }
  function ownerGroupKey(owners,layout){const set=new Set((owners||[]).map(canon)),r=layout?.base||'RAMBAN',a=canon(layout?.a),b=canon(layout?.b);return [set.has(r)?'R':'',set.has(a)?'A':'',set.has(b)?'B':''].join('')||'O'}
  function ownerGroupColor(owners,layout){return ({R:'#6f7c82',A:'#3f78a8',B:'#bd6a3e',RA:'#4f8f9c',RB:'#946a86',AB:'#6e8a58',RAB:'#345f54',O:'#8a8f8c'})[ownerGroupKey(owners,layout)]||'#8a8f8c'}
  function commentatorColor(id){const palette=['#3f78a8','#bd6a3e','#4f8f72','#86659b','#a17b32','#4b8792','#9a5b72','#657b93','#7a8451','#8d6247','#596b8f','#8a6b88'];const c=canon(id||'');if(c==='RAMBAN')return '#5f6f75';return palette[Math.abs(hash(c))%palette.length]}
  function ownerVisualColor(owners,layout,defaultOwner){if(Array.isArray(owners)&&owners.length){if(layout)return ownerGroupColor(owners,layout);if(owners.length===1)return commentatorColor(owners[0]);const cols=owners.map(commentatorColor);return cols[0]||'#7d8580'}return commentatorColor(defaultOwner||'RAMBAN')}
  function ownerDash(owners,layout){return ({R:'',A:'9 4',B:'2 4',RA:'10 3',RB:'4 3',AB:'10 3 2 3',RAB:''})[ownerGroupKey(owners,layout)]||'6 4'}
  function ownerLegendHtml(layout,nodes=[]){if(!layout)return '';const present=new Set((nodes||[]).map(n=>ownerGroupKey(n.owners,layout)));const rows=[['R','רמב״ן בלבד'],['A',`${displayName(layout.a)} בלבד`],['B',`${displayName(layout.b)} בלבד`],['RA',`רמב״ן + ${displayName(layout.a)}`],['RB',`רמב״ן + ${displayName(layout.b)}`],['AB',`${displayName(layout.a)} + ${displayName(layout.b)}`],['RAB','משותף לשלושתם']].filter(([k])=>!present.size||present.has(k));return `<div class="network-owner-legend"><b>מי זה? / חפיפה</b>${rows.map(([k,l])=>`<span><i style="background:${ownerGroupColor(k.split('').map(x=>x==='R'?'RAMBAN':x==='A'?layout.a:layout.b),layout)}"></i>${esc(l)}</span>`).join('')}</div>`}
  function tripleOverlapSummary(gR,gA,gB){if(!gR||(!gA&&!gB))return '';const sets=[gR,gA,gB].map(g=>new Set((g?.nodes||[]).map(n=>normConcept(n.label)).filter(Boolean))),inter=(x,y)=>[...x].filter(v=>y.has(v)),rab=gA&&gB?[...sets[0]].filter(v=>sets[1].has(v)&&sets[2].has(v)):[];return `<div class="overlap-summary"><span><b>${gA?inter(sets[0],sets[1]).length:0}</b> רמב״ן ∩ א׳</span><span><b>${gB?inter(sets[0],sets[2]).length:0}</b> רמב״ן ∩ ב׳</span><span><b>${gA&&gB?inter(sets[1],sets[2]).length:0}</b> א׳ ∩ ב׳</span><span><b>${rab.length}</b> משותף לשלושתם</span></div>`}

  function renderNetwork(container,graph,opts={}){
    if(!container||!graph){if(container)container.innerHTML='<div class="text-empty">אין רשת זמינה.</div>';return null}
    const prepared=prepareGraph(graph,opts.maxNodes||135);const nodes=prepared.nodes.map(n=>({...n})),edges=prepared.edges.map(e=>({...e}));
    if(!nodes.length){container.innerHTML='<div class="text-empty">הרשת ריקה.</div>';return null}
    const W=1180,H=720;
    const layoutKey=opts.layoutKey||networkLayoutSignature(nodes,edges,opts);
    const cached=networkLayoutCache.get(layoutKey);
    if(cached&&cached.size===nodes.length&&nodes.every(n=>cached.has(n.id))){
      nodes.forEach(n=>{const q=cached.get(n.id);n.x=q.x;n.y=q.y;n.vx=0;n.vy=0;});
      networkLayoutCache.delete(layoutKey);networkLayoutCache.set(layoutKey,cached);
    }else{
      layoutKnowledge(nodes,edges,W,H,opts);
      const pos=new Map(nodes.map(n=>[n.id,{x:n.x,y:n.y}]));networkLayoutCache.set(layoutKey,pos);
      while(networkLayoutCache.size>NETWORK_LAYOUT_CACHE_MAX)networkLayoutCache.delete(networkLayoutCache.keys().next().value);
    }
    const nodeBy=new Map(nodes.map(n=>[n.id,n]));
    const activeEdges=edges.filter(e=>!opts.predicate||opts.predicate==='all'||e.predicate===opts.predicate);
    const adj=new Map(nodes.map(n=>[n.id,new Set()]));activeEdges.forEach(e=>{adj.get(e.source)?.add(e.target);adj.get(e.target)?.add(e.source)});
    const degree=new Map(nodes.map(n=>[n.id,0]));edges.forEach(e=>{degree.set(e.source,(degree.get(e.source)||0)+1);degree.set(e.target,(degree.get(e.target)||0)+1)});
    const types=[...new Set(nodes.map(n=>n.type||'Unknown'))].sort((a,b)=>typeLabel(a).localeCompare(typeLabel(b),'he'));
    const typeCounts=new Map();nodes.forEach(n=>typeCounts.set(n.type||'Unknown',(typeCounts.get(n.type||'Unknown')||0)+1));
    const predicates=[...new Set(edges.map(e=>e.predicate||'relatedTo'))].sort((a,b)=>predicateLabel(a).localeCompare(predicateLabel(b),'he'));
    const predicateCounts=new Map();edges.forEach(e=>predicateCounts.set(e.predicate||'relatedTo',(predicateCounts.get(e.predicate||'relatedTo')||0)+1));
    const colorMode=opts.colorMode||'type';
    const edgeColor=e=>colorMode==='owner'?ownerVisualColor(e.owners,opts.ownerLayout,opts.defaultOwner):predicateColor(e.predicate||'relatedTo');
    const nodeFill=n=>colorMode==='owner'?ownerVisualColor(n.owners,opts.ownerLayout,opts.defaultOwner):typeColor(n.type);
    const svgNS='http://www.w3.org/2000/svg';container.innerHTML='';
    const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('aria-label','גרף ידע אינטראקטיבי');
    const defs=document.createElementNS(svgNS,'defs');
    [...new Set(edges.map(edgeColor))].forEach(c=>{const m=document.createElementNS(svgNS,'marker');m.setAttribute('id',`arrowClr_${Math.abs(hash(c))}`);m.setAttribute('markerWidth','5.5');m.setAttribute('markerHeight','5.5');m.setAttribute('refX','5.1');m.setAttribute('refY','2.1');m.setAttribute('orient','auto');m.setAttribute('markerUnits','userSpaceOnUse');const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M0,0 L5,2.1 L0,4.2 Z');path.setAttribute('fill',c);m.appendChild(path);defs.appendChild(m)});svg.appendChild(defs);
    const viewport=document.createElementNS(svgNS,'g');svg.appendChild(viewport);const edgeLayer=document.createElementNS(svgNS,'g'),nodeLayer=document.createElementNS(svgNS,'g');viewport.append(edgeLayer,nodeLayer);
    let zoom=1,tx=0,ty=0,pan=false,panStart=null;
    const pairMultiplicity=new Map();for(const e of edges){const k=[e.source,e.target].sort().join('|');pairMultiplicity.set(k,(pairMultiplicity.get(k)||0)+1)}
    const pairSeen=new Map();const edgeEls=[];
    edges.forEach((e,i)=>{const s=nodeBy.get(e.source),t=nodeBy.get(e.target);if(!s||!t)return;const p=e.predicate||'relatedTo';const pair=[e.source,e.target].sort().join('|');const total=pairMultiplicity.get(pair)||1;const seen=pairSeen.get(pair)||0;pairSeen.set(pair,seen+1);const curve=total>1?(seen-(total-1)/2)*20:((hash(`${p}|${e.source}|${e.target}`)%5)-2)*4;const geom={curve};
      const ec=edgeColor(e);const path=document.createElementNS(svgNS,'path');path.setAttribute('class','net-edge');path.setAttribute('stroke',ec);path.style.stroke=ec;if(opts.ownerStyle&&e.owners?.length){const dash=ownerDash(e.owners,opts.ownerLayout);if(dash){path.setAttribute('stroke-dasharray',dash);path.style.strokeDasharray=dash;}}path.setAttribute('marker-end',`url(#arrowClr_${Math.abs(hash(ec))})`);path.dataset.predicate=p;const ew=Number.isFinite(num(e.weight))?1.1+Math.max(0,Math.min(1,num(e.weight)))*4.8:1.35;path.setAttribute('stroke-width',ew.toFixed(2));path.style.strokeWidth=ew.toFixed(2);if(opts.predicate&&opts.predicate!=='all'&&p!==opts.predicate)path.classList.add('is-filtered');if(e.owners?.length>1){path.setAttribute('stroke-width',String(Math.max(2.7,ew)));path.style.strokeWidth=String(Math.max(2.7,ew));path.setAttribute('stroke-opacity','.92');path.style.strokeOpacity='.92'};path.setAttribute('d',curvedPath(s,t,curve));
      const title=document.createElementNS(svgNS,'title');title.textContent=`${s.label} — ${predicateLabel(p)} (${p}) → ${t.label}${e.owners?.length?' · '+e.owners.map(displayName).join(' + '):''}`;path.appendChild(title);path.addEventListener('click',ev=>{ev.stopPropagation();opts.onSelect?.({kind:'edge',edge:e,sourceLabel:s.label,targetLabel:t.label});});edgeLayer.appendChild(path);
      let label=null;const smartLabel=activeEdges.length<=85||opts.predicate&&opts.predicate!=='all'||!['relatedTo','mentions','appearsIn'].includes(p);if(opts.edgeLabels&&smartLabel&&(!opts.predicate||opts.predicate==='all'||p===opts.predicate)){label=document.createElementNS(svgNS,'text');label.setAttribute('class','net-edge-label');label.setAttribute('fill',ec);label.style.fill=ec;const pt=quadraticMidpoint(s,t,curve);label.setAttribute('x',pt.x);label.setAttribute('y',pt.y-5);label.textContent=truncate(predicateLabel(p),22);edgeLayer.appendChild(label)}edgeEls.push({e,path,label,geom});
    });
    const nodeEls=[];
    nodes.forEach(n=>{const g=document.createElementNS(svgNS,'g');g.setAttribute('class','net-node');g.setAttribute('transform',`translate(${n.x},${n.y})`);const r=nodeRadius(n,degree.get(n.id)||0);const shape=document.createElementNS(svgNS,(n.type==='BiblicalQuotation'||n.type==='BiblicalSource')?'rect':'circle');if(shape.tagName==='rect'){shape.setAttribute('x',-r*1.25);shape.setAttribute('y',-r*.72);shape.setAttribute('width',r*2.5);shape.setAttribute('height',r*1.44);shape.setAttribute('rx','4')}else shape.setAttribute('r',r);shape.setAttribute('fill',nodeFill(n));shape.setAttribute('class','net-node-shape');if(opts.ownerStyle){shape.setAttribute('stroke',colorMode==='owner'?typeColor(n.type):ownerVisualColor(n.owners,opts.ownerLayout,opts.defaultOwner));shape.setAttribute('stroke-width','3.0')}else if(n.owners?.length>1){shape.setAttribute('stroke','#183f37');shape.setAttribute('stroke-width','3.3')}const title=document.createElementNS(svgNS,'title');title.textContent=`${n.label} · ${typeLabel(n.type)} (${n.type||''})`;shape.appendChild(title);g.appendChild(shape);if(opts.labels){const t=document.createElementNS(svgNS,'text');t.setAttribute('x',r+5);t.setAttribute('y','4');const d=degree.get(n.id)||0;t.textContent=truncate(n.label,nodes.length>110&&d<3?18:31);g.appendChild(t)}
      g.addEventListener('mouseenter',()=>highlight(n.id));g.addEventListener('mouseleave',clearHighlight);g.addEventListener('click',ev=>{ev.stopPropagation();opts.onSelect?.({kind:'node',node:n,edges:activeEdges.filter(e=>e.source===n.id||e.target===n.id)});});
      let dragging=false;g.addEventListener('pointerdown',ev=>{ev.stopPropagation();dragging=true;g.setPointerCapture(ev.pointerId)});g.addEventListener('pointermove',ev=>{if(!dragging)return;const p=svgPoint(svg,ev.clientX,ev.clientY,zoom,tx,ty,W,H);n.x=p.x;n.y=p.y;g.setAttribute('transform',`translate(${n.x},${n.y})`);redrawEdges()});g.addEventListener('pointerup',()=>dragging=false);nodeLayer.appendChild(g);nodeEls.push({n,g});
    });
    container.appendChild(svg);
    if(prepared.sampled){const msg=document.createElement('div');msg.className='network-sample-note tiny muted';msg.textContent=`מוצגים ${nodes.length} מתוך ${graph.nodes?.length||0} צמתים — נבחרו הצמתים המחוברים ביותר.`;container.appendChild(msg)}
    const legend=document.createElement('div');legend.className='network-legend-panel';
    const ownerLegend=opts.ownerStyle?ownerLegendHtml(opts.ownerLayout,nodes):(opts.defaultOwner?`<div class="network-owner-legend"><b>מי זה?</b><span><i style="background:${commentatorColor(opts.defaultOwner)}"></i>${esc(displayName(opts.defaultOwner))}</span></div>`:'');
    legend.innerHTML=`<div class="network-mode-caption"><strong>${colorMode==='owner'?'מי זה?':'מה זה?'}</strong><span>${colorMode==='owner'?'הצבע הראשי מייצג את בעל הרשת/החפיפה; המסגרת שומרת את סוג הישות.':'צבע הצומת מייצג סוג ישות וצבע הקשת מייצג סוג יחס; בחפיפה המסגרת מראה בעלות.'}</span></div>${colorMode==='owner'?ownerLegend:`<div class="network-legend-row"><b>סוגי צמתים</b>${types.map(t=>`<span><i class="legend-dot" style="background:${typeColor(t)}"></i>${esc(typeLabel(t))}<small>${typeCounts.get(t)||0}</small></span>`).join('')}</div><div class="network-legend-row"><b>סוגי קשרים</b>${predicates.map(p=>`<span class="${opts.predicate&&opts.predicate!=='all'&&opts.predicate!==p?'is-muted':''}"><i class="relation-line" style="--rel-color:${predicateColor(p)}"></i>${esc(predicateLabel(p))}<small>${esc(p)} · ${predicateCounts.get(p)||0}</small></span>`).join('')}</div>${ownerLegend}`}`;container.appendChild(legend);
    function applyTransform(){viewport.setAttribute('transform',`translate(${tx} ${ty}) scale(${zoom})`)}
    function fit(){const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);const minX=Math.min(...xs)-38,maxX=Math.max(...xs)+100,minY=Math.min(...ys)-45,maxY=Math.max(...ys)+70;const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY);zoom=Math.max(.38,Math.min(1.55,Math.min((W-90)/bw,(H-145)/bh)));tx=W/2-((minX+maxX)/2)*zoom;ty=(H-40)/2-((minY+maxY)/2)*zoom;applyTransform()}
    function highlight(id){const hot=adj.get(id)||new Set();nodeEls.forEach(x=>x.g.classList.toggle('is-dim',x.n.id!==id&&!hot.has(x.n.id)));nodeEls.find(x=>x.n.id===id)?.g.classList.add('is-hot');edgeEls.forEach(x=>{const visible=!x.path.classList.contains('is-filtered');const h=visible&&(x.e.source===id||x.e.target===id);x.path.classList.toggle('is-dim',visible&&!h);x.path.classList.toggle('is-hot',h);if(x.label)x.label.classList.toggle('is-dim',!h)});}
    function clearHighlight(){nodeEls.forEach(x=>x.g.classList.remove('is-dim','is-hot'));edgeEls.forEach(x=>{x.path.classList.remove('is-dim','is-hot');x.label?.classList.remove('is-dim')})}
    function redrawEdges(){edgeEls.forEach(({e,path,label,geom})=>{const s=nodeBy.get(e.source),t=nodeBy.get(e.target);path.setAttribute('d',curvedPath(s,t,geom.curve));if(label){const pt=quadraticMidpoint(s,t,geom.curve);label.setAttribute('x',pt.x);label.setAttribute('y',pt.y-5)}})}
    svg.addEventListener('wheel',ev=>{ev.preventDefault();const factor=ev.deltaY<0?1.12:.89;zoom=Math.max(.28,Math.min(4.2,zoom*factor));applyTransform()},{passive:false});
    svg.addEventListener('pointerdown',ev=>{if(ev.target.closest?.('.net-node'))return;pan=true;panStart={x:ev.clientX,y:ev.clientY,tx,ty};svg.setPointerCapture(ev.pointerId)});svg.addEventListener('pointermove',ev=>{if(!pan)return;tx=panStart.tx+(ev.clientX-panStart.x)*(W/svg.clientWidth);ty=panStart.ty+(ev.clientY-panStart.y)*(H/svg.clientHeight);applyTransform()});svg.addEventListener('pointerup',()=>pan=false);svg.addEventListener('dblclick',fit);
    fit();
    container.__rvFit=fit;
    if(container.__rvResizeObserver)container.__rvResizeObserver.disconnect();
    if('ResizeObserver' in window){let resizeRaf=0;const ro=new ResizeObserver(()=>{if(resizeRaf)cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;fit();});});ro.observe(container);container.__rvResizeObserver=ro;}
    return {fit};
  }

  function networkLayoutSignature(nodes,edges,opts={}){
    const ns=nodes.map(n=>n.id).sort().join('|');
    const es=edges.map(e=>`${e.source}>${e.target}:${e.predicate||''}:${(e.owners||[]).join(',')}`).sort().join('|');
    const owner=opts.ownerStyle&&opts.ownerLayout?`${opts.ownerLayout.base||''}|${opts.ownerLayout.a||''}|${opts.ownerLayout.b||''}`:'';
    return `auto|${nodes.length}|${edges.length}|${owner}|${hash(ns)}|${hash(es)}`;
  }

  function prepareGraph(graph,maxNodes){
    const all=graph.nodes||[],edges=graph.edges||[];if(all.length<=maxNodes)return {nodes:all,edges,sampled:false};
    const deg=new Map(all.map(n=>[n.id,0]));edges.forEach(e=>{deg.set(e.source,(deg.get(e.source)||0)+1);deg.set(e.target,(deg.get(e.target)||0)+1)});
    const keep=new Set(all.slice().sort((a,b)=>(deg.get(b.id)||0)-(deg.get(a.id)||0)).slice(0,maxNodes).map(n=>n.id));return {nodes:all.filter(n=>keep.has(n.id)),edges:edges.filter(e=>keep.has(e.source)&&keep.has(e.target)),sampled:true};
  }
  function graphComponents(nodes,edges){const adj=new Map(nodes.map(n=>[n.id,[]]));edges.forEach(e=>{if(adj.has(e.source)&&adj.has(e.target)){adj.get(e.source).push(e.target);adj.get(e.target).push(e.source)}});const seen=new Set(),out=[];for(const n of nodes){if(seen.has(n.id))continue;const q=[n.id],ids=[];seen.add(n.id);while(q.length){const x=q.shift();ids.push(x);for(const y of adj.get(x)||[])if(!seen.has(y)){seen.add(y);q.push(y)}}out.push(ids)}return out.sort((a,b)=>b.length-a.length)}
  function layoutKnowledge(nodes,edges,W,H,opts={}){
    if(!Array.isArray(nodes)||!nodes.length)return;
    const safeW=Math.max(480,Number(W)||1180),safeH=Math.max(360,Number(H)||720),cx=safeW/2,cy=(safeH-40)/2;
    const map=new Map(nodes.map(n=>[n.id,n])),degree=new Map(nodes.map(n=>[n.id,0]));
    for(const e of edges||[]){if(map.has(e.source))degree.set(e.source,(degree.get(e.source)||0)+1);if(map.has(e.target))degree.set(e.target,(degree.get(e.target)||0)+1)}
    const comps=graphComponents(nodes,edges||[]),compCenter=new Map(),golden=Math.PI*(3-Math.sqrt(5));
    const ownerAnchors={R:{x:cx,y:cy},A:{x:safeW*.25,y:safeH*.55},B:{x:safeW*.75,y:safeH*.55},RA:{x:safeW*.40,y:safeH*.48},RB:{x:safeW*.60,y:safeH*.48},AB:{x:cx,y:safeH*.28},RAB:{x:cx,y:safeH*.43}};
    const anchorFor=n=>{
      if(opts.ownerStyle&&opts.ownerLayout&&n?.owners?.length){const k=ownerGroupKey(n.owners,opts.ownerLayout);if(ownerAnchors[k])return ownerAnchors[k]}
      return compCenter.get(n.id)||{x:cx,y:cy};
    };
    comps.forEach((ids,ci)=>{
      let ccx=cx,ccy=cy;
      if(ci>0){const ring=Math.min(safeW,safeH)*(.15+.032*Math.sqrt(ci));const a=(ci-1)*golden;ccx=cx+Math.cos(a)*Math.min(safeW*.30,ring);ccy=cy+Math.sin(a)*Math.min(safeH*.27,ring)}
      ids.forEach(id=>compCenter.set(id,{x:ccx,y:ccy}));
      ids.forEach((id,j)=>{const n=map.get(id);if(!n)return;const base=anchorFor(n),rad=24+Math.sqrt(Math.max(1,ids.length))*9,ang=j*golden;const q=Math.sqrt((j+.65)/Math.max(1,ids.length));n.x=base.x+Math.cos(ang)*rad*q;n.y=base.y+Math.sin(ang)*rad*q;n.vx=0;n.vy=0;});
    });
    // Any node omitted by a malformed component list still gets a stable starting point.
    nodes.forEach((n,i)=>{if(!Number.isFinite(n.x)||!Number.isFinite(n.y)){const a=i*golden;n.x=cx+Math.cos(a)*36*Math.sqrt(i+1);n.y=cy+Math.sin(a)*36*Math.sqrt(i+1);n.vx=0;n.vy=0;if(!compCenter.has(n.id))compCenter.set(n.id,{x:cx,y:cy})}});
    const N=nodes.length,repulsion=N>180?1650:N>110?2100:2650,target=N>170?66:N>100?76:88,iters=N>220?125:N>160?150:N>100?180:Math.min(220,115+N);
    const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const jitter=(a,b)=>{const h=hash(`${a.id}|${b.id}`),ang=(h%360)*Math.PI/180;return {x:Math.cos(ang)*.75,y:Math.sin(ang)*.75}};
    for(let it=0;it<iters;it++){
      for(const n of nodes){
        if(!Number.isFinite(n.vx))n.vx=0;if(!Number.isFinite(n.vy))n.vy=0;n.vx*=.82;n.vy*=.82;
        const a=anchorFor(n),d=degree.get(n.id)||0,gravity=(opts.ownerStyle ? .0062 : .0034)+Math.min(.004,d*.00010);
        n.vx+=(a.x-n.x)*gravity;n.vy+=(a.y-n.y)*gravity;
      }
      for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){
        const a=nodes[i],b=nodes[j];let dx=a.x-b.x,dy=a.y-b.y;if(Math.abs(dx)+Math.abs(dy)<.01){const z=jitter(a,b);dx=z.x;dy=z.y}
        const d2=Math.max(100,dx*dx+dy*dy),d=Math.sqrt(d2),f=Math.min(1.65,repulsion/d2);
        a.vx+=f*dx/d;a.vy+=f*dy/d;b.vx-=f*dx/d;b.vy-=f*dy/d;
        const minD=nodeRadius(a,degree.get(a.id)||0)+nodeRadius(b,degree.get(b.id)||0)+14;
        if(d<minD){const push=Math.min(1.35,(minD-d)*.075);a.vx+=push*dx/d;a.vy+=push*dy/d;b.vx-=push*dx/d;b.vy-=push*dy/d}
      }
      for(const e of edges||[]){
        const a=map.get(e.source),b=map.get(e.target);if(!a||!b)continue;let dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy);if(!Number.isFinite(dist)||dist<.01){const z=jitter(a,b);dx=z.x;dy=z.y;dist=1}
        const localTarget=target+Math.min(34,((degree.get(a.id)||0)+(degree.get(b.id)||0))*1.25),spring=clamp((dist-localTarget)*.0042,-.95,.95),ux=dx/dist,uy=dy/dist;
        a.vx+=spring*ux;a.vy+=spring*uy;b.vx-=spring*ux;b.vy-=spring*uy;
      }
      for(const n of nodes){
        // Soft elliptical boundary: it pulls inward without snapping nodes to a rectangle.
        const ex=(n.x-cx)/(safeW*.45),ey=(n.y-cy)/(safeH*.39),rr=Math.sqrt(ex*ex+ey*ey);
        if(Number.isFinite(rr)&&rr>.94){const pull=Math.min(.16,(rr-.94)*.085);n.vx-=ex*safeW*.45*pull;n.vy-=ey*safeH*.39*pull}
        const speed=Math.sqrt(n.vx*n.vx+n.vy*n.vy);if(Number.isFinite(speed)&&speed>10){n.vx=n.vx/speed*10;n.vy=n.vy/speed*10}
        n.x+=n.vx;n.y+=n.vy;
        if(!Number.isFinite(n.x)||!Number.isFinite(n.y)){const a=anchorFor(n);n.x=a.x+(hash(n.id)%17-8);n.y=a.y+(hash('y'+n.id)%17-8);n.vx=0;n.vy=0}
      }
    }
  }
  function nodeRadius(n,degree){return Math.max(6.5,Math.min(16,6.5+Math.sqrt(Math.max(0,degree))*1.7))}
  function curvedPath(s,t,curve){const dx=t.x-s.x,dy=t.y-s.y,d=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/d,uy=dy/d,r1=11,r2=13,x1=s.x+ux*r1,y1=s.y+uy*r1,x2=t.x-ux*r2,y2=t.y-uy*r2,mx=(x1+x2)/2-uy*curve,my=(y1+y2)/2+ux*curve;return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`}
  function quadraticMidpoint(s,t,curve){const dx=t.x-s.x,dy=t.y-s.y,d=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/d,uy=dy/d,r1=11,r2=13,x1=s.x+ux*r1,y1=s.y+uy*r1,x2=t.x-ux*r2,y2=t.y-uy*r2,cx=(x1+x2)/2-uy*curve,cy=(y1+y2)/2+ux*curve;return {x:.25*x1+.5*cx+.25*x2,y:.25*y1+.5*cy+.25*y2}}
  function svgPoint(svg,clientX,clientY,zoom,tx,ty,W=1180,H=720){const r=svg.getBoundingClientRect();const x=(clientX-r.left)*W/r.width,y=(clientY-r.top)*H/r.height;return {x:(x-tx)/zoom,y:(y-ty)/zoom}}
  function typeColor(type){return TYPE_COLOR_MAP[type]||hslColor(type||'Unknown',58,48)}
  function predicateColor(p){return PREDICATE_COLOR_MAP[p]||hslColor('rel:'+String(p||'relatedTo'),52,46)}
  function predicateLabel(p){return PREDICATE_LABELS[p]||String(p||'relatedTo')}
  function hslColor(s,sat=55,light=48){return `hsl(${hash(s)%360} ${sat}% ${light}%)`}

  /* -------------------- HEATMAP -------------------- */
  function renderHeatmap(container,rows,cols,valueFn,opts={}){
    if(!container)return;const vals=[];for(const r of rows)for(const c of cols){const v=valueFn(r,c);if(Number.isFinite(v))vals.push(v)}let min=Number.isFinite(opts.min)?opts.min:(vals.length?Math.min(...vals):0),max=Number.isFinite(opts.max)?opts.max:(vals.length?Math.max(...vals):1);if(min===max)max=min+1;
    const rowName=opts.rowName||String,colName=opts.colName||String;const grid=document.createElement('div');grid.className='heatmap-shell';const inner=document.createElement('div');inner.className='heatmap-grid';inner.style.gridTemplateColumns=`190px repeat(${cols.length},42px)`;
    inner.insertAdjacentHTML('beforeend',`<div class="hm-corner"></div>${cols.map(c=>`<div class="hm-col" title="${escAttr(colName(c))}">${esc(truncate(colName(c),38))}</div>`).join('')}`);
    rows.forEach(r=>{inner.insertAdjacentHTML('beforeend',`<div class="hm-row" title="${escAttr(rowName(r))}">${esc(rowName(r))}</div>`);cols.forEach(c=>{const v=valueFn(r,c),btn=document.createElement('button');btn.className='hm-cell'+(Number.isFinite(v)?'':' missing');if(Number.isFinite(v)){btn.style.background=heatColor(v,min,max);if(opts.showValues){btn.textContent=fmt(v,2);const tt=(v-min)/(max-min||1);if(tt>.64)btn.style.color='#fff';}btn.title=opts.title?opts.title(r,c,v):`${rowName(r)} × ${colName(c)}: ${fmt(v)}`;btn.addEventListener('click',()=>opts.onClick?.(r,c,v));}else btn.title='אין נתון';inner.appendChild(btn)})});grid.appendChild(inner);container.innerHTML=`<div class="heatmap-legend"><span>${fmt(min)}</span><span class="legend-gradient"></span><span>${fmt(max)}</span><span>· אפור = אין נתון</span></div>`;container.appendChild(grid);
  }
  function heatColor(v,min,max){let t=(v-min)/(max-min);t=Math.max(0,Math.min(1,t));if(min<0&&max>0){if(v<0){const u=Math.min(1,Math.abs(v/min));return `rgb(${Math.round(238-35*u)},${Math.round(238-20*u)},${Math.round(242-5*u)})`}}const a=[246,241,232],b=[132,67,43];const q=t*.92;return `rgb(${Math.round(a[0]+(b[0]-a[0])*q)},${Math.round(a[1]+(b[1]-a[1])*q)},${Math.round(a[2]+(b[2]-a[2])*q)})`}

  /* -------------------- MARKDOWN -------------------- */
  function markdownToHtml(md){
    const lines=String(md||'').replace(/\r/g,'').split('\n');let out=[],i=0,inCode=false,code=[];
    const inline=s=>{let x=esc(s);x=x.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');return x};
    while(i<lines.length){let line=lines[i];if(line.startsWith('```')){if(!inCode){inCode=true;code=[]}else{out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);inCode=false}i++;continue}if(inCode){code.push(line);i++;continue}
      if(/^\s*\|.*\|\s*$/.test(line)&&i+1<lines.length&&/^\s*\|?\s*:?-+/.test(lines[i+1])){const headers=line.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());i+=2;const rows=[];while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i])){rows.push(lines[i].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));i++}out.push(`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue}
      const h=line.match(/^(#{1,4})\s+(.*)$/);if(h){const n=h[1].length;out.push(`<h${n}>${inline(h[2])}</h${n}>`);i++;continue}
      if(/^---+$/.test(line.trim())){out.push('<hr>');i++;continue}
      if(line.startsWith('>')){const arr=[];while(i<lines.length&&lines[i].startsWith('>')){arr.push(lines[i].replace(/^>\s?/,''));i++}out.push(`<blockquote>${arr.map(inline).join('<br>')}</blockquote>`);continue}
      if(/^\s*[-*]\s+/.test(line)){const arr=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i])){arr.push(lines[i].replace(/^\s*[-*]\s+/,''));i++}out.push(`<ul>${arr.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`);continue}
      if(/^\s*\d+[.)]\s+/.test(line)){const arr=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i])){arr.push(lines[i].replace(/^\s*\d+[.)]\s+/,''));i++}out.push(`<ol>${arr.map(x=>`<li>${inline(x)}</li>`).join('')}</ol>`);continue}
      if(!line.trim()){i++;continue}
      const para=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,4})\s+/.test(lines[i])&&!/^\s*[-*]\s+/.test(lines[i])&&!/^\s*\d+[.)]\s+/.test(lines[i])&&!lines[i].startsWith('>')&&!lines[i].startsWith('```')&&!/^\s*\|.*\|\s*$/.test(lines[i])){para.push(lines[i]);i++}out.push(`<p>${inline(para.join(' '))}</p>`);
    }return out.join('\n');
  }

  /* -------------------- GENERAL HELPERS -------------------- */
  function renderSectionCaption(s){const m=sectionMap[s]||{};return `§${s} · ${m.passage_suggested||''} · ${m.lemma||''}`}
  function groupBy(arr,keyFn){const m=new Map();for(const x of arr){const k=keyFn(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return m}
  function uniqueBy(arr,key){const s=new Set(),o=[];for(const x of arr){const k=key(x);if(!s.has(k)){s.add(k);o.push(x)}}return o}
  function mean(a){const x=(a||[]).filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
  function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
  function fmt(v,d=3){const n=num(v);return n===null?'—':n.toFixed(d)}
  function formatCell(v){if(v===null||v===undefined)return '';if(typeof v==='object')return JSON.stringify(v);return String(v)}
  function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
  function escAttr(s){return esc(s).replaceAll("'",'&#39;')}
  function truncate(s,n){s=String(s??'');return s.length>n?s.slice(0,n-1)+'…':s}
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function annotateText(text,graph,selectedTerm){
    const raw=String(text||''); if(!raw)return '';
    const active=activeTextTypes(graph); const candidates=[]; const seen=new Set();
    const addNode=(n,force=false)=>{const label=String(n?.label||'').trim();if(label.length<2||(!force&&!active.has(n.type||'Unknown')))return;const key=(n.type||'Unknown')+'|'+label;if(seen.has(key))return;seen.add(key);let from=0;const hay=raw.toLocaleLowerCase('he'),needle=label.toLocaleLowerCase('he');while(true){const at=hay.indexOf(needle,from);if(at<0)break;candidates.push({start:at,end:at+label.length,label,type:n.type||'Unknown',selected:!!selectedTerm&&normConcept(label)===normConcept(selectedTerm)});from=at+Math.max(1,label.length)}};
    (graph?.nodes||[]).forEach(n=>addNode(n,false));
    if(selectedTerm){const n=(graph?.nodes||[]).find(x=>normConcept(x.label)===normConcept(selectedTerm));if(n)addNode(n,true);else{const label=String(selectedTerm);let at=raw.indexOf(label);while(at>=0){candidates.push({start:at,end:at+label.length,label,type:'Selected',selected:true});at=raw.indexOf(label,at+label.length)}}}
    candidates.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start)||Number(b.selected)-Number(a.selected));const chosen=[];let cursor=-1;for(const c of candidates){if(c.start>=cursor){chosen.push(c);cursor=c.end}}
    if(!chosen.length)return esc(raw);let out='',pos=0;for(const c of chosen){out+=esc(raw.slice(pos,c.start));const col=c.type==='Selected'?'#b3541e':typeColor(c.type);out+=`<span class="text-tag ${c.selected?'is-selected':''}" style="--tag-color:${col}" title="${escAttr(c.label)} · ${escAttr(typeLabel(c.type))}">${esc(raw.slice(c.start,c.end))}</span>`;pos=c.end}out+=esc(raw.slice(pos));return out;
  }
  function highlightText(text,term){const safe=esc(text||'');if(!term)return safe;const e=String(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');try{return safe.replace(new RegExp(e,'gi'),m=>`<mark class="concept-mark">${m}</mark>`)}catch{return safe}}
  function typeLabel(type){return ({BiblicalFigure:'דמות מקראית',BiblicalQuotation:'ציטוט מקראי',BiblicalSource:'מקור מקראי',Book:'ספר',CommentaryTypeOrMethod:'שיטת פרשנות',HalakhicConcept:'מושג הלכתי',HistoricalEventOrPeriod:'אירוע / תקופה',KabbalisticConcept:'מושג קבלי',KabbalisticWork:'חיבור קבלי',LegalReference:'הפניה הלכתית',TalmudicSource:'מקור תלמודי',MidrashicOrRabbinicWork:'חיבור מדרשי / חז״לי',OtherConcept:'מושג אחר',PhysicalObject:'עצם פיזי',Place:'מקום',RabbinicAuthority:'סמכות רבנית',ReligiousPractice:'פרקטיקה דתית',SpiritualEntity:'ישות רוחנית',TheologicalConcept:'מושג תיאולוגי',TraditionOrAttribution:'מסורת / ייחוס',Selected:'מושג נבחר',Unknown:'לא מסווג'})[type]||type||'לא מסווג'}

  function sectionSortKey(s){const m=String(s).match(/^(\d+)(?:_(\d+))?$/);return m?Number(m[1])*100+(m[2]?Number(m[2]):0):999999}
  function sortSections(arr){return arr.slice().sort((a,b)=>sectionSortKey(a)-sectionSortKey(b))}
  function metricLabel(m){return ({raw:'D1 / raw',bits:'bits של ראיה',locus_overlap:'חפיפת מוקדים',reading_agreement:'הסכמת קריאה'})[m]||m}
  function metricOptions(sel,arr){return arr.map(m=>`<option value="${m}" ${m===sel?'selected':''}>${metricLabel(m)}</option>`).join('')}
  function globalMetricLabel(m){return ({co_cluster:'קו־אשכול',mean_raw:'ממוצע raw בין קטעים',mean_bits:'ממוצע bits בין קטעים',mean_locus:'ממוצע חפיפת מוקדים',mean_reading:'ממוצע הסכמת קריאה',signature:'מטריצת חתימה (נתונים ישנים)'})[m]||m}
  function globalMetricOptions(sel){return [['co_cluster','קו־אשכול · נתונים חדשים'],['mean_raw','ממוצע raw · נתונים חדשים'],['mean_bits','ממוצע bits · נתונים חדשים'],['mean_locus','ממוצע חפיפת מוקדים · נתונים חדשים'],['mean_reading','ממוצע הסכמת קריאה · נתונים חדשים'],['signature','מטריצת חתימה · נתונים ישנים']].map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('')}
  function skeleton(t){return `<div class="panel"><p class="muted">${esc(t)}</p></div>`}
  /* -------------------- V7: contextual help -------------------- */
  const TERM_GUIDES = {
    'גרף ידע': 'ייצוג של טקסט כרשת. הצמתים הם מושגים או ישויות שחולצו מן הטקסט, והקשתות הן טענות או יחסים ביניהם.',
    'צומת': 'יחידה בגרף הידע: מושג, דמות, מקור, מקום, ישות רוחנית או סוג ישות אחר שחולץ מן הטקסט.',
    'קשת': 'קשר מכוון או לא־מכוון בין שני צמתים. ברשת הטקסט הקשת מייצגת יחס סמנטי כגון “מסביר”, “מצטט”, “מסמל” או “קשור ל־”.',
    'סוג קשר': 'המשמעות של הקשת בגרף הידע: מה היחס בין שני הצמתים המחוברים.',
    'סוג קודקוד': 'הקטגוריה של הצומת — למשל דמות מקראית, מושג קבלי, מקום או מקור תלמודי. בדשבורד “קודקוד” ו“צומת” הם אותו דבר.',
    'D1 / raw': 'ציון הדמיון התוכני הגולמי של זוג פרשנים באותו קטע, המבוסס בעיקר על חפיפת מושגים. הטווח 0–1. הוא טוב לדירוג מי קרוב יותר, אך הפרש של 0.2 אינו בהכרח “פי שניים” מהפרש של 0.1. בקורפוס הזה raw מעל 0.50 נדיר מאוד.',
    'raw': 'ציון דמיון גולמי. הוא משמש בעיקר לסידור זוגות מקרוב לרחוק. אין לפרש הפרשים קטנים בו כיחידות שוות של ראיה.',
    'bits': 'כמות הראיה המכוילת ביחס לזוגות ביקורת שאינם קשורים. 0 פירושו שהציון אינו מוסיף ראיה חיובית; כל ביט נוסף מכפיל בקירוב את יחס הסיכויים לטובת “קשור”. זה הסולם שבו הפרשים ניתנים להשוואה טוב יותר.',
    'חפיפת מוקדים': 'מדד 0–1 לשאלה האם שני פרשנים עוסקים באותו חומר או באותם מושגים בתוך אותו קטע. ערך גבוה = יותר מוקדים משותפים; ערך נמוך = הם מדברים ברובם על דברים שונים.',
    'הסכמת קריאה': 'מדד 0–1 לשאלה האם שני פרשנים מסכימים כאשר יש להם בסיס משותף להשוואה. הוא נבדק רק על טענות שניתן להשוות ביניהן. ערך גבוה = יותר טענות משותפות; 0 = אין הסכמה בטענות שניתן היה להשוות.',
    'טענות בנות־השוואה': 'טענות שבהן קיימת אפשרות אמיתית להשוות בין שני הפרשנים: המושגים הרלוונטיים זוהו כמשותפים ולכן שני הצדדים יכלו לקשור ביניהם באותו אופן. אם המספר הוא 0, אין בסיס לחשב “הסכמת קריאה” גם אם יש מושגים משותפים.',
    'טענות להשוואה': 'זהה ל“טענות בנות־השוואה”: מספר היחסים שבהם שני הפרשנים פעלו על בסיס מושגים משותפים ולכן ניתן לבדוק האם קישרו אותם באופן דומה.',
    'מושגים משותפים': 'מספר המושגים שזוהו כמשותפים לשני הפרשנים באותו קטע לאחר תהליך זיהוי/התאמת המושגים.',
    'קו־אשכול': 'מתוך כל הקטעים שבהם שני חיבורים מופיעים יחד, החלק שבו הם נופלים באותה קבוצה. 1.00 = תמיד יחד; בקורפוס הזה החציון הוא בערך 0.32. זה מדד לקביעות ההתקבצות לאורך מקורות, לא להוכחת השפעה היסטורית.',
    'co-cluster': 'השם האנגלי של קו־אשכול: באיזה חלק מן הקטעים המשותפים שני הפרשנים נמצאים באותה קבוצה.',
    'אשכול': 'קבוצה של פרשנים שנמצאו קרובים זה לזה לפי מדד וסף מסוימים. אשכול מקומי מתייחס לקטע אחד; אשכול כללי בודק דפוס חוזר לאורך הקורפוס.',
    'אשכול מקומי': 'קבוצת פרשנים המחושבת בתוך קטע אחד בלבד. היא יכולה להשתנות מקטע לקטע ולכן אינה בהכרח “אסכולה” קבועה.',
    'אשכול גלובלי': 'קבוצת פרשנים המחושבת על סמך דפוסי הקרבה החוזרים לאורך הקורפוס כולו.',
    'דנדרוגרמה': 'עץ של clustering היררכי. כל פרשן הוא עלה; קבוצות שמתחברות ברמת דמיון גבוהה יותר קרובות יותר לפי המדד שנבחר. העץ מציג את כל הפרשנים גם כשאין סף חד.',
    'average-linkage': 'שיטה לבניית עץ אשכולות: הקרבה בין שתי קבוצות היא ממוצע הקרבה של כל הזוגות שביניהן.',
    'Average-linkage': 'שיטה לבניית עץ אשכולות: הקרבה בין שתי קבוצות היא ממוצע הקרבה של כל הזוגות שביניהן.',
    'סף': 'ערך חיתוך שנבחר לצורך תצוגה. ברשת אשכולות קשת תוצג רק אם המדד שווה לסף או גבוה ממנו. שינוי הסף הוא כלי חקירה ולא מבחן מובהקות.',
    'D5': 'מדד לרצף/סדר רעיונות: עד כמה שני טקסטים מציגים רעיונות בסדר דומה. בנתונים החדשים מצוין שיש להיזהר בזוגות שאינם מאוזנים בגודל.',
    'register': 'מדד לדמיון ברגיסטר או בפרופיל הסגנוני/סוגי המושגים. זהו ממד אחר מדמיון תוכני.',
    'רגיסטר': 'פרופיל סגנוני/מושגי של חיבור — למשל אילו סוגי ישויות או מושגים מאפיינים אותו. דמיון רגיסטר אינו זהה לדמיון בתוכן.',
    'align': 'מדד מן הנתונים הישנים המתאר קרבה/יישור של פרשן אל רשת הרמב״ן באותו קטע. הוא מוצג בנפרד מן המדדים החדשים ואינו מאוחד איתם לציון אחד.',
    'E2': 'שכבה מן הנתונים הישנים שבה כל טקסט מיוצג כגרף ידע של צמתים וקשרים.',
    'E3': 'שכבת ניתוח מן הנתונים הישנים שמסכמת ומשווה גרפים בין פרשנים ובין קטעים, כולל חתימות, אשכולות מקומיים ומדדי קרבה ישנים.',
    'coverage': 'רשומת כיסוי מן הנתונים הישנים: האם יש לפרשן/קטע נתון זמין וכמה חומר גרפי/מושגי כוסה. היא אינה מדד דמיון כשלעצמה.',
    'localClusters': 'אשכולות מקומיים שנשמרו כבר בניתוח הישן לכל קטע. הם מוצגים בנפרד מן האשכולות החקרניים שמחושבים בדשבורד החדש.',
    'חתימת קורפוס': 'פרופיל מסכם מן הנתונים הישנים המתאר את דפוסי המבנה/השימוש של פרשן לאורך הקורפוס. דמיון חתימה הוא דמיון בפרופיל הזה, לא בהכרח באותם רעיונות.',
    'מטריצה': 'טבלה דו־ממדית שבה השורות והעמודות הן פרשנים/קטעים והצבע בכל תא מייצג ערך מספרי. ריחוף מציג את הערך המדויק; בתאים פעילים לחיצה מחזירה למקרה שמאחוריהם.',
    'מפת חום': 'מטריצה שבה צבע התא מבטא את גודל הערך. צבע חזק יותר משמעו בדרך כלל ערך גבוה יותר לפי המקרא של אותה מפה.',
    'חציון': 'הערך האמצעי לאחר שמסדרים את כל הערכים. חצי מן התצפיות מעליו וחצי מתחתיו. הוא פחות רגיש לערכים קיצוניים מממוצע.',
    'ממוצע': 'סכום הערכים חלקי מספר התצפיות. הוא מסכם את המרכז אך יכול להיות מושפע מערכים קיצוניים.',
    'מקדם המתאם': 'מספר המתאר עד כמה שני משתנים נעים יחד. קרוב ל־1 = קשר חיובי חזק, קרוב ל־0 = אין קשר ליניארי ברור, קרוב ל־−1 = קשר הפוך חזק. מתאם אינו הוכחת סיבתיות.',
    'r =': 'כאן r הוא מקדם מתאם פירסון בין שני הצירים בתרשים. הוא מסכם קשר ליניארי ואינו מעיד כשלעצמו על סיבתיות.',
    'within-section z': 'ציון תקנון בתוך אותו קטע: כמה הזוג חריג ביחס לשאר הזוגות של אותו קטע, ביחידות של סטיית תקן.',
    'זוגות ביקורת': 'זוגות טקסטים מקטעים שונים שנבחרו כבקרה שלילית — ידוע מראש שאינם אמורים להיות קשורים. הם משמשים לכיול מדדי הראיה.',
    'סט זהב': 'קבוצת מקרים שזיהוים ידוע מראש ומשמשת לבדיקת השיטה. כאן היא כוללת, בין היתר, משפחות עדי נוסח שצפויות להיראות קרובות.',
    'p-value': 'ערך מובהקות סטטיסטית: ההסתברות לקבל תוצאה כזו או קיצונית יותר תחת מודל המקרה. ערך קטן יותר מצביע על תוצאה שקשה יותר להסביר כמקרית, אך יש להתחשב בריבוי בדיקות.',
    'silhouette': 'מדד לכידות והפרדה של אשכולות. ערך גבוה מצביע על קבוצות מופרדות יותר; בקורפוס הזה ערכים נמוכים מרמזים שגם כאשר יש מבנה הוא לעיתים רופף.',
    'ρ': 'מתאם דרגות ספירמן: עד כמה שני דירוגים מסכימים. 1 = אותו סדר; סביב 0 = אין התאמה עקבית; שלילי = סדרים הפוכים.',
    'מרחק ז׳נסן־שאנון': 'מדד מרחק בין שתי התפלגויות. 0 = פרופילים זהים; ערך גבוה יותר = פרופילים שונים יותר.',
    'זוג־קטע': 'יחידת השוואה של שני פרשנים על אותו קטע רמב״ן. אותו זוג פרשנים יכול להופיע בכמה קטעים ולכן לייצר כמה זוגות־קטע.',
    'זוגות־קטע': 'השוואות של שני פרשנים בתוך אותו קטע רמב״ן. אותו זוג פרשנים יכול להופיע במספר קטעים.',
    'D1': 'מדד התוכן: עד כמה שני טקסטים חולקים מושגים. כאשר מופיע D1/raw, זהו הציון הגולמי של המדד הזה.',
    'דמיון E3': 'מדד דמיון מן הנתונים הישנים, שחושב בשכבת E3. הוא מוצג בנפרד מן raw, bits ושאר המדדים החדשים.',
    'ממוצע raw': 'הממוצע של ציוני raw על פני כל המקרים הרלוונטיים — למשל כל הקטעים המשותפים לזוג או כל העמיתים של פרשן בתוך קטע.',
    'ממוצע bits': 'הממוצע של ערכי bits על פני המקרים הרלוונטיים. הוא מסכם עוצמת ראיה מכוילת על כמה השוואות.',
    'ממוצע חפיפת מוקדים': 'הממוצע של מדד חפיפת המוקדים על פני כמה קטעים/השוואות.',
    'ממוצע הסכמת קריאה': 'הממוצע של הסכמת הקריאה על פני ההשוואות שבהן היה בסיס להשוואה.',
    'אחוזון': 'מיקום של ערך בתוך ההתפלגות. למשל אחוזון 96.8 פירושו שכ־96.8% מן הערכים נמוכים ממנו.',
    'מובהקות': 'בדיקה סטטיסטית של השאלה עד כמה קשה להסביר תוצאה כמקרית. מובהקות אינה מודדת לבדה את גודל האפקט או את חשיבותו ההיסטורית.',
    'תיקון מחמיר': 'התאמה של סף המובהקות כאשר מבצעים בדיקות רבות, כדי לצמצם תוצאות חיוביות מקריות.',
    'בקרה שלילית': 'מקרים שידוע מראש שאינם אמורים להיות קשורים. הם משמשים לבדיקה שהמדד אכן יודע להבחין בין קשר אמיתי לרעש.',
    'סטיית תקן': 'מדד לפיזור הערכים סביב הממוצע. בציון z, סטיית תקן אחת מעל הממוצע היא z=1.',
    'Crosswalk': 'טבלת התאמה בין מזהים ושמות בשני מרחבי הנתונים, כדי לוודא שאותו קטע או פרשן מחובר נכון בין הנתונים הישנים לחדשים.',
    'QA': 'בדיקות אבטחת איכות וסנכרון: האם קבצים, מזהים, שורות וטבלאות מתחברים כפי שהם אמורים להתחבר.',
    'CSV': 'קובץ טבלאי גולמי שבו כל שורה היא רשומת נתונים. טבלאות הכימות החדשות בדשבורד מגיעות מקובצי CSV אלה.',
    'קהילות־רשת': 'קבוצות צמתים צפופות יחסית בתוך הגרף המצטבר של פרשן. זהו מאפיין מבני של הרשת, לא בהכרח קבוצה רעיונית היסטורית.',
    'צירים בלתי־תלויים': 'מדדים או ממדים שאינם מספרים כמעט את אותו דבר. הדוח בדק תלות בין מדדים כדי לא לספור שוב ושוב אותו סוג מידע.'
  };
  const TERM_ALIASES = Object.keys(TERM_GUIDES).sort((a,b)=>b.length-a.length);
  const INFO_GUIDES = [
    ['הטקסטים באותו קטע', 'כאן מוצגים טקסט הרמב״ן והפרשנים שנבחרו באותו קטע. הצבעים מסמנים את סוגי הישויות שחולצו מן הטקסט. אפשר להדליק כמה סוגי תגים יחד, ללחוץ על מושג, ולראות את הופעתו בטקסטים. זו שכבת המקור שממנה נבנים הגרפים.'],
    ['רשת היחסים', 'כל צומת הוא מושג או ישות שחולצו מן הטקסט; כל קשת היא יחס סמנטי בין שני צמתים. במצב “מה זה?” צבע הצומת מציין סוג ישות וצבע הקשת מציין סוג יחס. במצב “מי זה?” הצבע מציין לאיזה טקסט/פרשן שייך הצומת או הקשר. אפשר לגרור, להתקרב, לסנן יחסים וללחוץ על קשת כדי לראות את הראיה הטקסטואלית.'],
    ['כימות של היחסים', 'כאן אותם יחסים מקבלים ערכים מספריים. raw מודד דמיון תוכני; bits מבטא את עוצמת הראיה המכוילת; חפיפת מוקדים מודדת עד כמה שני פרשנים עוסקים באותם מושגים; הסכמת קריאה בודקת עד כמה הם מסכימים כאשר יש טענה בת־השוואה; קו־אשכול בודק עד כמה הזוג מתקבץ יחד לאורך הקורפוס.'],
    ['אותו זוג לאורך הקטעים', 'כל נקודה/תא מתאר את אותו זוג פרשנים בקטע אחר. כך אפשר להבחין בין קרבה יציבה לאורך הקורפוס לבין קרבה שנוצרת רק סביב מקור מסוים.'],
    ['מפת הזוגות בקטע', 'זוהי מטריצה של כל זוגות הפרשנים בתוך הקטע הנבחר. צבע התא ועוצמתו מבטאים את המדד שנבחר; לחיצה על תא מעבירה את הזוג להקשר הפעיל כדי שאפשר יהיה לחזור לטקסט ולרשת שמאחורי המספר.'],
    ['מי קרוב ומי רחוק', 'האזור מציג את התפלגות ערכי הקרבה בין זוגות פרשנים. הוא נועד לענות לא רק מי הזוג הקרוב ביותר, אלא כיצד כל אוכלוסיית הזוגות מתפלגת: האם רוב הזוגות רחוקים, האם יש זנב קטן של זוגות קרובים, והאם יש סף שמפריד קבוצה בולטת.'],
    ['הקורפוס כולו — רשת קרבה/קו־אשכול', 'כל צומת הוא פרשן וכל קשת היא קרבה בין שני פרשנים לפי המדד שנבחר. הסף קובע אילו קשתות נשארות. שינוי המדד או הסף מאפשר לראות אם אותן קבוצות נשמרות כאשר מגדירים “קרבה” בדרכים שונות.'],
    ['אותם נתונים כמטריצה מלאה', 'המטריצה מציגה את כל הזוגות גם אם הם אינם עוברים את סף הרשת. כך אפשר לראות רצף מלא של קרבה/מרחק ולא רק את הקשרים החזקים שהרשת בוחרת להציג.'],
    ['דנדרוגרמה — כל הפרשנים יחד', 'הדנדרוגרמה מבצעת clustering היררכי בשיטת average-linkage. העלים הם הפרשנים; ענפים שמתחברים מוקדם יותר מייצגים פרשנים או קבוצות קרובים יותר לפי המדד שנבחר. היא אינה מוחקת פרשנים רחוקים ולכן טובה במיוחד להבנת המבנה הכולל.'],
    ['מקור בודד', 'כאן clustering מחושב רק בתוך הקטע הנבחר. הוא מראה כיצד כלל הפרשנים של אותו מקור מתקבצים באותו רגע פרשני. כדאי להשוות אותו ל-clustering הכללי כדי לראות אילו קבוצות יציבות ואילו תלויות מקור.'],
    ['דנדרוגרמה מקומית', 'העץ כולל את כל הפרשנים הזמינים בקטע הנבחר. גובה החיבור מייצג את המרחק לפי המדד המקומי שנבחר. הוא מאפשר לראות קבוצות של יותר משני פרשנים ולא רק זוגות.'],
    ['כל הקטעים — תמונת המבנה המקומי', 'כל שורה היא קטע. הפסים מסכמים את ה-localClusters שנמצאו בשכבת E3: מקטעים ארוכים יותר מייצגים קבוצות גדולות יותר; ריבוי מקטעים קטנים מעיד על פיזור. זו תצוגת סריקה של כל הקורפוס.'],
    ['אופי ההתפזרות: מוקד לעומת קריאה', 'כל נקודה היא זוג פרשנים בתוך קטע. ציר X הוא חפיפת המוקדים: עד כמה הם עוסקים באותם מושגים. ציר Y הוא הסכמת הקריאה: עד כמה הם מסכימים כאשר הם עוסקים באותו מוקד. כך אפשר להבחין בין “מדברים על דברים שונים” לבין “מדברים על אותו דבר אבל מפרשים אותו אחרת”.'],
    ['אטלס פיזור של כל הקטעים', 'כל נקודה מייצגת קטע שלם ולא זוג. X הוא חציון חפיפת המוקדים של הזוגות בקטע; Y הוא חציון הסכמת הקריאה; גודל הנקודה משקף את מספר הזוגות. לחיצה על נקודה עוברת לקטע.'],
    ['עושר פרשני מול התפזרות', 'כל נקודה היא קטע. ציר X הוא מספר המושגים הממוצע לפרשן לפי E3; ציר Y הוא 1 פחות mean raw, כלומר מדד של התרחקות תוכנית. קו המגמה והמתאם בודקים את טענת הדוח שככל שהדיון עשיר יותר, הפרשנים נוטים להתפזר יותר.'],
    ['קרבה לרמב״ן — לא דומיננטיות', 'התרשים משווה את הפרשנים לרמב״ן בארבעה מדדים. זהו מדד קרבה סימטרי לטקסט הבסיס, לא מדד של השפעה היסטורית. כדי להסיק מי השפיע על מי צריך כרונולוגיה, ציטוטים וכיוון יחסים שאינם כלולים כאן.'],
    ['אופי הקודקודים: מה המסורת חולקת', 'האזור בודק אילו סוגי ישויות ומושגים נוטים להיות משותפים לפרשנים. משמאל מוצגים שיעורי השיתוף שחושבו בדוח; מימין מוצג פרופיל סוגי הקודקודים של כל פרשן מתוך knowledgeBodies.'],
    ['שיעור שיתוף לפי סוג מושג', 'כל עמודה מציגה את שיעור השיתוף עבור סוג ישות מסוים. ערך גבוה פירושו שסוג זה נוטה להופיע אצל כמה פרשנים יחד; ערך נמוך פירושו שהוא ייחודי יותר לפרשנים בודדים.'],
    ['חתימת סוגי מושגים לפי פרשן', 'כל שורה היא פרשן וכל עמודה היא סוג קודקוד. צבע התא הוא שיעור אותו סוג מתוך כלל רשומות המושגים של הפרשן. כך רואים חתימה מושגית ולא רק דמיון זוגי.'],
    ['סגנון מול תוכן — האם הם אותו ציר', 'כל נקודה היא זוג פרשנים. X הוא דמיון תוכני ממוצע; Y הוא דמיון החתימה המבנית של E3. אם הנקודות היו נצמדות לאלכסון, שני הממדים היו כמעט אותו דבר; פיזור רחב מלמד שהם תופסים היבטים שונים.'],
    ['מן המספר אל הראיה', 'האזור מחבר את המדדים הכמותיים בחזרה למקרה הפרטני: הזוג, הקטע, המושגים והראיות המילוליות. המטרה היא למנוע מצב שבו מספר מוצג ללא האפשרות לבדוק מה יצר אותו.'],
    ['פרופיל פרשן', 'זהו מבט אורכי על פרשן אחד לאורך הקורפוס: היכן הוא מופיע, עד כמה הוא קרוב לרמב״ן, למי הוא קרוב בין הפרשנים, אילו סוגי מושגים ויחסים מאפיינים אותו, ואיך מיקומו משתנה בין מקורות.'],
    ['מפת מקורות הנתונים', 'האזור מסביר מאיזו שכבה מגיע כל סוג נתון: הטקסטים, גרפי E2/E3 והכימות החדש. ההפרדה חשובה מפני שמדדים שונים נוצרו בשלבים שונים ואינם בני־החלפה.'],
    ['בדיקות סנכרון', 'כאן מופיעות בדיקות QA שמוודאות שהמפתחות, הקטעים, החיבורים והטבלאות אכן מתחברים. אזהרה אינה מוסתרת: היא מסמנת מקום שבו מקור אחד מכיל נתון שהמקור האחר אינו מכיל.'],
    ['Crosswalk', 'טבלת ה-crosswalk מחברת בין מזהי הקטעים והחיבורים במרחבי הנתונים השונים. היא מאפשרת לדעת האם נתון מסוים קיים בטקסט/רשת, בכימות, או בשניהם.'],
    ['דפדפן נתונים גולמי', 'זהו מבט ישיר בטבלאות שעליהן מבוסס הדשבורד. הוא נועד לביקורת, אימות וחקירה פרטנית, ולא רק להצגה מסוכמת.'],
    ['מעבדת פיזור', 'זהו מרחב חקר אינטראקטיבי של פירוק ההתפזרות. כל נקודה היא זוג פרשנים בתוך קטע. אפשר לצבוע לפי סוג הדפוס, לפי קטע, או לפי השתתפות של פרשן נבחר; לשנות את גודל הנקודה; לסנן; וללחוץ על נקודה כדי לעבור למקרה הפרטני.'],
    ['הרכב דפוסי הפיזור לפי קטע', 'כל שורה היא מקור/קטע וכל רוחב השורה הוא 100% מן הזוגות שנותרו אחרי הסינון. ארבעת הצבעים מחלקים את הזוגות לפי חפיפת מוקדים והסכמת קריאה. כך אפשר לזהות במבט אחד מקורות שבהם רוב הפרשנים מתכנסים, מקורות שבהם הם עוסקים באותו מוקד אך חולקים בקריאה, ומקורות מפוזרים במיוחד.'],
    ['מרכזי פרשנים במרחב מוקד × קריאה', 'כל נקודה היא פרשן אחד. מיקום הנקודה הוא החציון של כל ההשוואות שבהן אותו פרשן משתתף בתוך אוכלוסיית הניתוח הנוכחית. ימינה פירושו שבדרך כלל הוא חולק יותר מוקדים עם עמיתיו; למעלה פירושו שבמקומות שבהם יש בסיס להשוואה הוא נוטה להסכים יותר. גודל הנקודה מראה כמה השוואות עומדות מאחורי המיקום.'],
    ['אטלס פיזור של הקטעים המסוננים', 'כל נקודה היא קטע לאחר החלת מסנני המעבדה. X הוא חציון חפיפת המוקדים של הזוגות שנותרו; Y הוא חציון הסכמת הקריאה; גודל הנקודה משקף כמה זוגות נשארו. לכן שינוי קבוצת הפרשנים או סף הראיה משנה גם את מיקום הקטעים.'],
    ['D1 / raw — כל הזוגות', 'היסטוגרמה של ציוני raw. כל עמודה היא טווח ציונים; גובה העמודה הוא מספר זוגות־הקטע בטווח. ריחוף מציג את הטווח ואת מספר המקרים. הקו ב־0.50 מסמן קצה עליון נדיר בקורפוס, לא “קו אמת” אוניברסלי.'],
    ['bits — כל הזוגות', 'היסטוגרמה של עוצמת הראיה המכוילת. כל עמודה היא טווח bits וגובהה מספר המקרים. 0 bits פירושו שאין ראיה חיובית ביחס לבקרה; ערכים חיוביים גבוהים יותר משמעם ראיה חזקה יותר.'],
    ['הרשת המצטברת של הפרשן', 'גרף ידע מצטבר של הפרשן לאורך המקורות שבהם הוא מופיע. הצמתים והקשרים מגיעים מן הנתונים הישנים. ריחוף ולחיצה על צומת/קשת מציגים את פרטיהם.'],
    ['הפרשן לאורך הקורפוס — שני מבטים', 'שתי סדרות לאורך הקטעים: align לרמב״ן מן הנתונים הישנים, ו־mean raw מול שאר הפרשנים מן הנתונים החדשים. כל נקודה היא קטע; לחיצה עוברת לקטע עצמו.'],
    ['מטריצת פרשן × פרשן — מבט רוחבי', 'כל תא הוא זוג פרשנים על פני הקורפוס לפי המדד שנבחר. ריחוף מציג את הערך המדויק; לחיצה בוחרת את הזוג ומאפשרת לחזור לקטעים שמאחוריו.'],
    ['קטעים × פרשנים — קרבה לרמב״ן', 'מפת חום מן הנתונים הישנים. כל שורה היא קטע וכל עמודה פרשן; התא מציג את מדד align של אותו פרשן לרמב״ן באותו קטע.'],
    ['שיעור שיתוף לפי סוג מושג', 'כל פס הוא סוג מושג. אורך הפס הוא שיעור המושגים מאותו סוג שמופיעים אצל יותר מפרשן אחד באותו קטע. ריחוף מציג את הערך המדויק.'],
    ['חתימת סוגי מושגים לפי פרשן', 'כל שורה היא פרשן וכל עמודה סוג מושג. צבע התא הוא חלקו של אותו סוג בפרופיל המושגים של הפרשן. ריחוף מציג אחוז מדויק; לחיצה בוחרת את הפרשן והסוג לצורך המשך חקירה.'],
    ['מקרה מבחן: דעת חכם והלא־נודע', 'מפת חום ממוקדת בארבעה עדים/חיבורים שעליהם הצביע הדוח. כל תא הוא קו־אשכול של זוג. ערך גבוה משמעו שהם נוטים להיכנס לאותה קבוצה באותם קטעים.'],
    ['הרכב דפוסי הפיזור לפי קטע', 'כל שורה היא קטע וכל רוחב השורה הוא 100% מן הזוגות שנותרו. הצבעים מחלקים אותם לארבעה דפוסי מוקד×קריאה. ריחוף מציג מספר ושיעור; לחיצה על שורה מסננת את המעבדה לקטע.'],
    ['הנתונים שמאחורי הנקודות', 'הטבלה היא אותה אוכלוסייה שמוצגת בגרף המעבדה. לחיצה על שורה בוחרת את הזוג ואת הקטע ומעדכנת את כרטיס המקרה.'],
    ['קרבה לרמב״ן — פירוק מדדים', 'ארבעה מדדי קרבה מן הנתונים החדשים מוצגים בנפרד. הם אינם מחוברים לציון אחד, כדי לא לטשטש הבדלים בין תוכן, סדר, התקבצות ורגיסטר.'],
  ];

  function setupInfoSystem(){
    if(document.getElementById('infoOverlay')) return;
    const overlay=document.createElement('div');overlay.id='infoOverlay';overlay.className='info-overlay';overlay.innerHTML=`<div class="info-popover" role="dialog" aria-modal="true" aria-labelledby="infoTitle"><button class="info-close" type="button" aria-label="סגירה">×</button><div class="eyebrow">איך לקרוא את התצוגה</div><h3 id="infoTitle"></h3><div id="infoBody" class="info-body"></div></div>`;document.body.appendChild(overlay);
    const close=()=>overlay.classList.remove('is-open');
    const open=(title,body,html=false)=>{overlay.querySelector('#infoTitle').textContent=title||'הסבר';overlay.querySelector('#infoBody').innerHTML=html?body:`<p>${esc(body||'')}</p>`;overlay.classList.add('is-open')};
    overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.info-close'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('.info-button,.term-info');if(!b)return;e.preventDefault();e.stopPropagation();
      const title=b.dataset.infoTitle||b.dataset.term||'הסבר';const body=b.dataset.infoBody||(b.dataset.term?TERM_GUIDES[b.dataset.term]:'הסבר לתצוגה זו אינו זמין.');open(title,body,false);
    });
    document.getElementById('openGlossary')?.addEventListener('click',()=>open('מילון מונחים בדשבורד',`<div class="glossary-grid">${Object.entries(TERM_GUIDES).filter(([k])=>!['co-cluster','Average-linkage','טענות להשוואה','זוגות־קטע'].includes(k)).map(([k,v])=>`<div class="glossary-entry"><strong>${esc(k)}</strong><p>${esc(v)}</p></div>`).join('')}</div>`,true));
    const decorate=()=>decorateDashboardHelp(els.views[state.tab]||document.getElementById('app'));
    let decoratePending=false;const scheduleDecorate=()=>{if(decoratePending)return;decoratePending=true;const run=()=>{decoratePending=false;decorate()};if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:180});else setTimeout(run,50)};
    const obs=new MutationObserver(scheduleDecorate);obs.observe(document.getElementById('app'),{subtree:true,childList:true});
    setupLiveChartTooltips();scheduleDecorate();
  }

  function decorateDashboardHelp(root){decorateInfoButtons(root);decorateTechnicalTerms(root);decorateLiveElements(root)}

  function contextualInfoExtra(title){
    const pair=`${displayName(state.a)} ↔ ${displayName(state.b)}`;
    if(title.includes('כימות של היחסים')){const p=getPairRow(state.section,state.a,state.b),d=getDecompRow(state.section,state.a,state.b),cc=coClusterMap.get(pairKey(state.a,state.b));return ` במופע הנוכחי: §${state.section}, ${pair}. raw=${fmt(p?.raw)}, bits=${fmt(p?.bits)}, חפיפת מוקדים=${fmt(d?.locus_overlap)}, הסכמת קריאה=${fmt(d?.reading_agreement)}, קו־אשכול=${fmt(cc?.co_cluster_rate)}.`}
    if(title.includes('אותו זוג לאורך הקטעים'))return ` במופע הנוכחי מוצג ${pair}, במדד ${metricLabel(state.sectionMatrixMetric)}.`;
    if(title.includes('מטריצת פרשנים לקטע'))return ` במופע הנוכחי: §${state.section}; המדד הפעיל הוא ${metricLabel(state.sectionMatrixMetric)}.`;
    if(title.includes('הקורפוס כולו — רשת קרבה')){const ids=clusterIdsGlobal(),m=state.clusterGlobalMetric,t=state.clusterGlobalThreshold,g=similarityGraph(ids,(a,b)=>globalClusterValue(a,b,m),t,m);return ` במופע הנוכחי המדד הוא ${clusterMetricLabel(m)}, הסף ${fmt(t,2)}, ומוצגות ${g.edges.length} קשתות בין ${g.nodes.length} פרשנים.`}
    if(title.includes('מקור בודד')){const ids=clusterIdsLocal(state.section,state.clusterLocalMetric),m=state.clusterLocalMetric,t=state.clusterLocalThreshold,g=similarityGraph(ids,(a,b)=>localClusterValue(state.section,a,b,m),t,'local_similarity');return ` במופע הנוכחי: §${state.section}; ${clusterMetricLabel(m)}; סף ${fmt(t,2)}; ${g.edges.length} קשרים עוברים את הסף.`}
    if(title.includes('אופי ההתפזרות: מוקד לעומת קריאה')||title.includes('מעבדת פיזור')){const rows=state.tab==='dispersion'?dispersionFilteredRows():(Q['פירוק_התפזרות']||[]);return ` במופע הנוכחי מוצגות ${rows.length.toLocaleString('he-IL')} נקודות${state.tab==='dispersion'?' לאחר המסננים הפעילים':''}.`}
    if(title.includes('פרופיל פרשן'))return ` במופע הנוכחי הפרופיל הוא של ${displayName(state.a)}.`;
    if(title.includes('דנדרוגרמה —'))return ` במופע הנוכחי העץ משתמש במדד ${clusterMetricLabel(state.clusterGlobalMetric)} על כלל הפרשנים.`;
    if(title.includes('דנדרוגרמה מקומית'))return ` במופע הנוכחי: §${state.section}, לפי ${clusterMetricLabel(state.clusterLocalMetric)}.`;
    if(title.includes('אטלס פיזור')&&state.tab==='dispersion')return ` במופע הנוכחי האטלס מחושב מחדש על ${dispersionFilteredRows().length.toLocaleString('he-IL')} זוגות־קטע שעברו את המסננים.`;
    return '';
  }

  function decorateInfoButtons(root){
    if(!root)return;
    const candidates=[...root.querySelectorAll('.panel-head h2,.panel-head h3,.panel-head h4,.chart-box>h3,.chart-box>h4,.data-source-card>h4,.cluster-level-block>h4')];
    candidates.forEach(h=>{
      if(h.parentElement?.querySelector(':scope > .info-button')||h.nextElementSibling?.classList?.contains('info-button'))return;
      const title=(h.textContent||'').trim();if(!title)return;
      const host=h.closest('.panel,.chart-box,.data-source-card,.cluster-level-block')||h.parentElement;
      const p=host?.querySelector('.panel-head p,:scope>p,.tiny.muted');
      const mapped=INFO_GUIDES.find(([k])=>title.startsWith(k)||title.includes(k));
      let body=mapped?.[1]||((p?.textContent||'').trim()?`${(p.textContent||'').trim()} ריחוף על נקודות, קווים, עמודות או תאים מציג את הערך המדויק. כאשר הרכיב לחיץ, הלחיצה מעדכנת את ההקשר או עוברת למקרה שמאחורי הערך.`:'התצוגה מרכזת נתונים מן השכבה המסומנת באזור זה. ריחוף מציג ערכים פרטניים; לחיצה על רכיבים פעילים מחזירה אל המקרה שמאחוריהם.');
      body+=contextualInfoExtra(title);
      const b=document.createElement('button');b.type='button';b.className='info-button';b.textContent='i';b.setAttribute('aria-label',`מידע על ${title}`);b.dataset.infoTitle=title;b.dataset.infoBody=body;h.insertAdjacentElement('afterend',b);
    });
  }

  function decorateTechnicalTerms(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];let n;
    while(n=walker.nextNode()){
      const p=n.parentElement;if(!p||!n.nodeValue?.trim())continue;
      if(p.closest('.term-explained,.info-popover,.tagged-text,script,style,select,option,textarea,pre,code,button,a,.markdown,.data-table tbody'))continue;
      if(TERM_ALIASES.some(term=>n.nodeValue.includes(term)))nodes.push(n);
    }
    for(const node of nodes){
      const text=node.nodeValue;let pos=0,parts=[];
      const wordChar=ch=>!!ch&&/[A-Za-z0-9_\u0590-\u05FF]/.test(ch);const whole=(i,term)=>{const first=term[0],last=term[term.length-1],prev=text[i-1],next=text[i+term.length];return !(wordChar(first)&&wordChar(prev))&&!(wordChar(last)&&wordChar(next))};const nextIndex=(term,from)=>{let i=text.indexOf(term,from);while(i>=0&&!whole(i,term))i=text.indexOf(term,i+1);return i};
      while(pos<text.length){let best=null,bestIdx=Infinity;for(const term of TERM_ALIASES){const i=nextIndex(term,pos);if(i>=0&&(i<bestIdx||(i===bestIdx&&term.length>(best?.length||0)))){best=term;bestIdx=i}}if(best===null){parts.push(document.createTextNode(text.slice(pos)));break}if(bestIdx>pos)parts.push(document.createTextNode(text.slice(pos,bestIdx)));const span=document.createElement('span');span.className='term-explained';span.appendChild(document.createTextNode(best));const b=document.createElement('button');b.type='button';b.className='term-info';b.textContent='i';b.dataset.term=best;b.dataset.infoTitle=best;b.dataset.infoBody=TERM_GUIDES[best];b.setAttribute('aria-label',`מה זה ${best}?`);span.appendChild(b);parts.push(span);pos=bestIdx+best.length}
      const frag=document.createDocumentFragment();parts.forEach(x=>frag.appendChild(x));node.replaceWith(frag);
    }
  }

  let livePinned=false,liveSource=null;
  function setupLiveChartTooltips(){
    if(document.getElementById('liveChartTooltip'))return;const tip=document.createElement('div');tip.id='liveChartTooltip';tip.className='live-chart-tooltip';document.body.appendChild(tip);
    const sourceFor=(target)=>{let el=target instanceof Element?target:null;for(let i=0;el&&i<5;i++,el=el.parentElement){if(el.dataset?.tip||el.getAttribute?.('title')||el.querySelector?.(':scope > title'))return el;if(el.tagName==='SVG')break}return target.closest?.('.hm-cell[title],.metric-heat-row i[title]')||null};
    const textFor=(el)=>el?.dataset?.tip||el?.getAttribute?.('title')||el?.querySelector?.(':scope > title')?.textContent||'';
    const move=(e)=>{if(!tip.classList.contains('is-visible'))return;const x=Math.min(window.innerWidth-330,e.clientX+14),y=Math.min(window.innerHeight-100,e.clientY+16);tip.style.left=`${Math.max(8,x)}px`;tip.style.top=`${Math.max(8,y)}px`};
    let pointerRaf=0,lastPointerEvent=null;document.addEventListener('pointermove',e=>{lastPointerEvent=e;if(pointerRaf)return;pointerRaf=requestAnimationFrame(()=>{pointerRaf=0;const ev=lastPointerEvent,src=sourceFor(ev.target);if(src){if(liveSource!==src){liveSource?.classList?.remove('is-live-hover');liveSource=src;src.classList?.add('is-live-hover')}if(!livePinned){tip.textContent=textFor(src);tip.classList.add('is-visible');move(ev)}}else if(!livePinned){liveSource?.classList?.remove('is-live-hover');liveSource=null;tip.classList.remove('is-visible')}})});
    document.addEventListener('click',e=>{const src=sourceFor(e.target);if(!src){livePinned=false;tip.classList.remove('is-pinned');tip.classList.remove('is-visible');return}const txt=textFor(src);if(!txt)return;livePinned=!(livePinned&&liveSource===src);liveSource=src;tip.textContent=txt;tip.classList.toggle('is-pinned',livePinned);tip.classList.add('is-visible');move(e)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){livePinned=false;tip.classList.remove('is-visible','is-pinned')}});
  }

  function decorateLiveElements(root){
    if(!root)return;root.querySelectorAll('svg title').forEach(t=>t.parentElement?.classList?.add('live-value'));root.querySelectorAll('[title].hm-cell,.metric-heat-row [title]').forEach(el=>el.classList.add('live-value'));
  }


})();
