function degreeMap(nodes, edges) {
  const map = new Map(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    map.set(edge.source, (map.get(edge.source) || 0) + 1);
    map.set(edge.target, (map.get(edge.target) || 0) + 1);
  }
  return map;
}

function sampleGraph(nodes, edges, maxNodes = 110) {
  if (nodes.length <= maxNodes) return { nodes, edges, sampled: false };

  const deg = degreeMap(nodes, edges);
  const top = [...nodes]
    .sort((a, b) => (deg.get(b.id) || 0) - (deg.get(a.id) || 0))
    .slice(0, maxNodes);

  const keep = new Set(top.map((n) => n.id));
  const filteredEdges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));

  return { nodes: top, edges: filteredEdges, sampled: true };
}

function colorForType(type) {
  const palette = {
    TheologicalConcept: '#7a3e1d',
    BiblicalQuotation: '#4b7a78',
    RabbinicAuthority: '#6b5a2e',
    MidrashicOrRabbinicWork: '#9c6d2a',
    KabbalisticConcept: '#3d5f8a',
    HistoricalEventOrPeriod: '#6d4f82',
    PhysicalObject: '#8b6b47',
    Place: '#53724f',
    TalmudicSource: '#91685d',
    TraditionOrAttribution: '#5e6b8a',
    BiblicalFigure: '#2f6d8a',
    OtherConcept: '#576060',
    Unknown: '#7a7a7a',
  };
  return palette[type] || palette.Unknown;
}

function colorForPredicate(predicate) {
  const value = String(predicate || '').toLowerCase();
  if (value.includes('דמיון')) return '#7d3f20';
  if (value.includes('מושג')) return '#285c54';
  if (value.includes('מופיע')) return '#6d4f82';
  if (value.includes('cites') || value.includes('quote')) return '#9c6d2a';
  if (value.includes('related')) return '#5e6b8a';
  return '#8b6b47';
}

function hashColor(seed) {
  const palette = ['#7d3f20', '#285c54', '#6d4f82', '#9c6d2a', '#3d5f8a', '#53724f', '#91685d', '#5e6b8a'];
  let hash = 0;
  const text = String(seed || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function renderGraph(container, graph, handlers = {}) {
  container.innerHTML = '';

  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    container.innerHTML = '<p class="muted">אין נתוני גרף זמינים.</p>';
    return;
  }

  const sampled = sampleGraph(graph.nodes, graph.edges || []);
  const deg = degreeMap(sampled.nodes, sampled.edges || []);
  const ranked = [...sampled.nodes].sort((a, b) => (deg.get(b.id) || 0) - (deg.get(a.id) || 0));
  const layoutMode = graph.layoutMode || 'radial';
  const width = Math.max(320, Math.round(container.clientWidth || 1000));
  const height = Math.max(320, Math.round(container.clientHeight || width));
  const centerX = width / 2;
  const centerY = height / 2;
  const boundaryPad = Math.max(44, Math.min(140, Math.round(Math.min(width, height) * 0.14)));
  const spokes = 8;
  const areaRadius = Math.max(100, (Math.min(width, height) / 2) - boundaryPad - 16);
  const nodeCount = ranked.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const nodeRadius = (n) => Math.max(9, Math.min(16, 7 + Math.log2((n.freq || n.instances || 1) + 1)));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function fitToViewport() {
    if (!nodes.length) return;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const boxW = Math.max(1, maxX - minX);
    const boxH = Math.max(1, maxY - minY);
    const safeW = width - (boundaryPad * 2);
    const safeH = height - (boundaryPad * 2);
    const scale = clamp(Math.min(safeW / boxW, safeH / boxH), 0.82, 1.42);
    const compactScale = scale * 0.9;

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    for (const n of nodes) {
      n.x = clamp(centerX + ((n.x - midX) * compactScale), boundaryPad, width - boundaryPad);
      n.y = clamp(centerY + ((n.y - midY) * compactScale), boundaryPad, height - boundaryPad);
      n.vx = 0;
      n.vy = 0;
    }
  }

  const nodes = ranked.map((n, i) => {
    if (i === 0) {
      return { ...n, x: centerX, y: centerY, vx: 0, vy: 0 };
    }

    if (layoutMode === 'star') {
      const spoke = (i - 1) % spokes;
      const ring = 1 + Math.floor((i - 1) / spokes);
      const angle = (Math.PI * 2 * spoke) / spokes;
      const radius = Math.min(areaRadius, 110 + (ring * 56));
      const jitter = ((spoke % 2 === 0 ? 1 : -1) * 16) + ((ring % 2 === 0 ? 1 : -1) * 8);
      return {
        ...n,
        x: centerX + Math.cos(angle) * (radius + jitter),
        y: centerY + Math.sin(angle) * (radius - jitter),
        vx: 0,
        vy: 0,
      };
    }

    const k = i;
    const ratio = Math.sqrt(k / Math.max(1, nodeCount - 1));
    const angle = k * goldenAngle;
    const radius = ratio * areaRadius;
    const jitter = ((k % 5) - 2) * 3;
    return {
      ...n,
      x: centerX + Math.cos(angle) * (radius + jitter),
      y: centerY + Math.sin(angle) * (radius - jitter),
      vx: 0,
      vy: 0,
    };
  });
  const edges = sampled.edges;
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const svgNS = 'http://www.w3.org/2000/svg';

  const wrapper = document.createElement('div');
  wrapper.className = 'graph-wrapper';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'graph-svg');

  const defs = document.createElementNS(svgNS, 'defs');
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'rv2-arrow');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '6');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const arrowPath = document.createElementNS(svgNS, 'path');
  arrowPath.setAttribute('d', 'M0,0 L6,3 L0,6 Z');
  arrowPath.setAttribute('fill', '#9d6a42');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const linkLayer = document.createElementNS(svgNS, 'g');
  const nodeLayer = document.createElementNS(svgNS, 'g');

  const edgeEls = edges.map((edge) => {
    const g = document.createElementNS(svgNS, 'g');
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('class', 'graph-edge');
    line.setAttribute('marker-end', 'url(#rv2-arrow)');
    if (Number.isFinite(edge.weight)) {
      line.setAttribute('stroke-width', String(Math.max(1.1, 1.1 + edge.weight * 4)));
    }
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('class', 'graph-edge-label');
    label.textContent = edge.predicate || 'relatedTo';
    label.setAttribute('text-anchor', 'middle');
    line.addEventListener('click', () => handlers.onEdgeClick && handlers.onEdgeClick(edge));
    g.appendChild(line);
    g.appendChild(label);
    linkLayer.appendChild(g);
    return { edge, line, label };
  });

  const nodeEls = nodes.map((node) => {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'graph-node');

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('r', String(nodeRadius(node)));
    circle.setAttribute('fill', node.color || colorForType(node.type));
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1.5');

    const label = document.createElementNS(svgNS, 'text');
    label.textContent = node.label;
    label.setAttribute('x', '14');
    label.setAttribute('y', '4');
    label.setAttribute('class', 'graph-node-label');

    g.appendChild(circle);
    g.appendChild(label);

    let dragging = false;
    g.addEventListener('pointerdown', (ev) => {
      dragging = true;
      g.setPointerCapture(ev.pointerId);
    });
    g.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      node.x = ((ev.clientX - rect.left) / rect.width) * width;
      node.y = ((ev.clientY - rect.top) / rect.height) * height;
      node.vx = 0;
      node.vy = 0;
      draw();
    });
    g.addEventListener('pointerup', () => {
      dragging = false;
    });

    g.addEventListener('click', () => handlers.onNodeClick && handlers.onNodeClick(node));
    g.setAttribute('data-type', node.type || 'Unknown');

    nodeLayer.appendChild(g);
    return { node, g };
  });

  svg.appendChild(linkLayer);
  svg.appendChild(nodeLayer);
  wrapper.appendChild(svg);

  if (sampled.sampled) {
    const warn = document.createElement('p');
    warn.className = 'muted';
    warn.textContent = `הגרף מוצג במדגם של ${nodes.length} צמתים לצורך קריאות.`;
    wrapper.appendChild(warn);
  }

  container.appendChild(wrapper);

  function draw() {
    for (const { edge, line, label } of edgeEls) {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) continue;
      const edgeColor = edge.color || ((source.color && target.color && source.color !== target.color) ? source.color : hashColor(`${edge.source}|${edge.target}|${edge.predicate || ''}`)) || colorForPredicate(edge.predicate);
      line.setAttribute('stroke', edgeColor);
      line.setAttribute('stroke-opacity', edge.predicate ? '0.68' : '0.5');
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const sourcePad = Math.max(12, nodeRadius(source) + 4);
      const targetPad = Math.max(12, nodeRadius(target) + 4);
      const x1 = source.x + (ux * sourcePad);
      const y1 = source.y + (uy * sourcePad);
      const x2 = target.x - (ux * targetPad);
      const y2 = target.y - (uy * targetPad);
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const offset = angle > 90 || angle < -90 ? 180 : 0;
      label.setAttribute('x', midX.toFixed(2));
      label.setAttribute('y', (midY - 4).toFixed(2));
      label.setAttribute('transform', `rotate(${angle + offset} ${midX.toFixed(2)} ${midY.toFixed(2)})`);
    }

    for (const { node, g } of nodeEls) {
      g.setAttribute('transform', `translate(${node.x.toFixed(2)}, ${node.y.toFixed(2)})`);
    }
  }

  function tick() {
    const repulsionBase = 1900 / Math.max(1, Math.sqrt(nodeCount / 8));
    const collisionGap = 9;
    const centerPull = layoutMode === 'star' ? 0.0046 : 0.0032;

    for (const n of nodes) {
      n.vx *= 0.9;
      n.vy *= 0.9;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(dist2);
        const force = repulsionBase / dist2;
        const fx = force * dx;
        const fy = force * dy;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;

        const minDist = nodeRadius(a) + nodeRadius(b) + collisionGap;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.11;
          const ux = dx / dist;
          const uy = dy / dist;
          a.vx += ux * push;
          a.vy += uy * push;
          b.vx -= ux * push;
          b.vy -= uy * push;
        }
      }
    }

    for (const e of edges) {
      const s = nodesById.get(e.source);
      const t = nodesById.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = layoutMode === 'star' ? 112 : 96;
      const spring = (dist - desired) * 0.018;
      const fx = (dx / dist) * spring;
      const fy = (dy / dist) * spring;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    for (const n of nodes) {
      const dx = centerX - n.x;
      const dy = centerY - n.y;
      n.vx += dx * centerPull;
      n.vy += dy * centerPull;
    }

    for (const n of nodes) {
      const r = nodeRadius(n) + 2;
      const minX = boundaryPad + r;
      const maxX = width - boundaryPad - r;
      const minY = boundaryPad + r;
      const maxY = height - boundaryPad - r;

      if (n.x < minX) n.vx += (minX - n.x) * 0.06;
      if (n.x > maxX) n.vx -= (n.x - maxX) * 0.06;
      if (n.y < minY) n.vy += (minY - n.y) * 0.06;
      if (n.y > maxY) n.vy -= (n.y - maxY) * 0.06;

      n.x = clamp(n.x + n.vx, minX, maxX);
      n.y = clamp(n.y + n.vy, minY, maxY);
    }

    draw();
  }

  let frames = 0;
  const maxFrames = Math.max(260, Math.min(560, 260 + (nodes.length * 2)));
  function animate() {
    tick();
    frames += 1;
    if (frames < maxFrames) {
      requestAnimationFrame(animate);
      return;
    }
    fitToViewport();
    draw();
  }

  animate();
}

window.RV2Graph = {
  renderGraph,
};
