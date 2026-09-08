#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeId(value) {
  return String(value || '').trim().replace(/\s+/g, '_');
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/[\u05F3\u05F4"']/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCsv(text) {
  const rows = [];
  const clean = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] || '').trim();
    });
    return obj;
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(stripBom(raw));
}

async function readCsv(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return parseCsv(raw);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(rootDir, extension) {
  const out = [];
  const ext = String(extension || '').toLowerCase();

  async function walk(curr) {
    const entries = await fs.readdir(curr, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(curr, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ext || path.extname(entry.name).toLowerCase() === ext) {
        out.push(full);
      }
    }
  }

  await walk(rootDir);
  return out;
}

function sanitizeFileName(id) {
  return String(id || 'unknown').replace(/[^\w\u0590-\u05FF.-]+/g, '_');
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((acc, x) => acc + x, 0) / values.length;
}

function summarizeMarkdown(text, limit = 420) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return '';
  return clean.length > limit ? `${clean.slice(0, limit).trim()}…` : clean;
}

function parseSimilarityMatrix(rows) {
  if (!rows.length) return { ids: [], pairs: [] };
  const ids = Object.keys(rows[0]).filter((x) => x !== '');
  const pairs = [];
  for (let i = 0; i < rows.length; i += 1) {
    const source = ids[i];
    if (!source) continue;
    for (let j = i + 1; j < ids.length; j += 1) {
      const target = ids[j];
      const sim = toNumber(rows[i][target], NaN);
      if (Number.isFinite(sim)) {
        pairs.push({ source, target, similarity: sim });
      }
    }
  }
  return { ids, pairs };
}

function buildClusters(ids, pairs, threshold = 0.55) {
  const adjacency = new Map(ids.map((id) => [id, new Set()]));
  for (const pair of pairs) {
    if (pair.similarity >= threshold) {
      adjacency.get(pair.source)?.add(pair.target);
      adjacency.get(pair.target)?.add(pair.source);
    }
  }

  const visited = new Set();
  const clusters = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    const stack = [id];
    visited.add(id);
    const members = [];

    while (stack.length) {
      const curr = stack.pop();
      members.push(curr);
      for (const next of adjacency.get(curr) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    if (members.length < 2) continue;
    const memberSet = new Set(members);
    const sims = pairs
      .filter((p) => memberSet.has(p.source) && memberSet.has(p.target))
      .map((p) => p.similarity);

    clusters.push({
      id: `cluster_${clusters.length + 1}`,
      threshold,
      members: members.sort(),
      meanSimilarity: Number(average(sims).toFixed(4)),
      edgeCount: sims.length,
    });
  }

  return clusters.sort((a, b) => b.meanSimilarity - a.meanSimilarity);
}

function pickTopPairs(pairs, limit = 20) {
  return [...pairs].sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

function parseGraphFolderName(name, commentatorIds) {
  if (!name.startsWith('kg_')) return null;
  const rest = name.slice(3);
  const sortedCommentators = [...commentatorIds].sort((a, b) => b.length - a.length);

  for (const commentatorId of sortedCommentators) {
    const suffix = `_${commentatorId}`;
    if (rest.endsWith(suffix)) {
      return {
        sectionId: rest.slice(0, -suffix.length),
        commentatorId,
      };
    }
  }

  return null;
}

function parseGraphFolderLoose(name) {
  const match = String(name || '').match(/^kg_(\d+(?:_\d+)?)_(.+)$/);
  if (!match) return null;
  return {
    sectionId: match[1],
    commentatorId: match[2],
  };
}

function simplifyGraph(graph, sectionId, commentatorId) {
  const base = graph?.consolidated_graph || {};
  const concepts = Array.isArray(base.concepts) ? base.concepts : [];
  const relations = Array.isArray(base.relation_objects) ? base.relation_objects : [];

  const nodes = concepts.map((c) => ({
    id: c.id,
    label: c.prefLabel || c.id,
    type: c.entity_type || 'Unknown',
    description: c.conceptDescription || '',
    sourceInstanceIds: Array.isArray(c.source_instance_ids) ? c.source_instance_ids : [],
  }));

  const validNodeIds = new Set(nodes.map((n) => n.id));
  const edges = relations
    .filter((r) => validNodeIds.has(r.subject_id) && validNodeIds.has(r.object_id))
    .map((r, idx) => ({
      id: `${sectionId}_${commentatorId}_${idx}`,
      source: r.subject_id,
      target: r.object_id,
      predicate: r.predicate || 'relatedTo',
      evidenceText: r.evidence_text || '',
    }));

  return {
    sectionId,
    commentatorId,
    text: base.text || '',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
}

function jaccardSimilarity(aSet, bSet) {
  if (!aSet.size && !bSet.size) return 0;
  let intersection = 0;
  for (const x of aSet) {
    if (bSet.has(x)) intersection += 1;
  }
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildLabelMaps(graph) {
  const normalized = new Set();
  const prettyByNormalized = new Map();
  for (const node of graph.nodes || []) {
    const norm = normalizeText(node.label);
    if (!norm) continue;
    normalized.add(norm);
    if (!prettyByNormalized.has(norm)) {
      prettyByNormalized.set(norm, node.label);
    }
  }
  return { normalized, prettyByNormalized };
}

function buildSectionComparisons(section) {
  const commentators = section.commentators;
  const maps = new Map();
  for (const commentatorId of commentators) {
    const graph = section.graphs[commentatorId];
    maps.set(commentatorId, buildLabelMaps(graph));
  }

  const comparisons = [];
  for (let i = 0; i < commentators.length; i += 1) {
    for (let j = i + 1; j < commentators.length; j += 1) {
      const a = commentators[i];
      const b = commentators[j];
      const mapA = maps.get(a);
      const mapB = maps.get(b);
      const similarity = jaccardSimilarity(mapA.normalized, mapB.normalized);

      const shared = [];
      for (const token of mapA.normalized) {
        if (mapB.normalized.has(token)) {
          shared.push(mapA.prettyByNormalized.get(token) || mapB.prettyByNormalized.get(token) || token);
        }
      }

      comparisons.push({
        source: a,
        target: b,
        similarity: Number(similarity.toFixed(4)),
        sharedCount: shared.length,
        sharedSample: shared.slice(0, 12),
      });
    }
  }

  return comparisons.sort((x, y) => y.similarity - x.similarity);
}

function buildSimilarityMatrix(section) {
  const commentators = [...section.commentators].sort((a, b) => a.localeCompare(b));
  const lookup = new Map();
  for (const row of section.pairwise || []) {
    const key = [row.commentatorId, 'RAMBAN'].sort().join('||');
    lookup.set(key, row);
  }

  const matrix = commentators.map((commentatorId) => {
    const row = { commentatorId };
    for (const target of commentators) {
      if (commentatorId === target) {
        row[target] = 1;
        continue;
      }
      const pair = (section.comparisonsBetweenCommentators || []).find((x) =>
        (x.source === commentatorId && x.target === target) || (x.source === target && x.target === commentatorId)
      );
      row[target] = pair ? pair.similarity : null;
    }
    const rambanPair = lookup.get([commentatorId, 'RAMBAN'].sort().join('||'));
    row.RAMBAN = rambanPair ? rambanPair.align : null;
    return row;
  });

  return { commentators, matrix };
}

function buildLocalClusters(commentators, comparisons, threshold = 0.16) {
  const adjacency = new Map(commentators.map((id) => [id, new Set()]));
  for (const row of comparisons) {
    if (row.similarity < threshold) continue;
    adjacency.get(row.source)?.add(row.target);
    adjacency.get(row.target)?.add(row.source);
  }

  const visited = new Set();
  const clusters = [];
  for (const id of commentators) {
    if (visited.has(id)) continue;
    const stack = [id];
    visited.add(id);
    const members = [];
    while (stack.length) {
      const curr = stack.pop();
      members.push(curr);
      for (const next of adjacency.get(curr) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    if (members.length < 2) continue;

    const memberSet = new Set(members);
    const sims = comparisons
      .filter((p) => memberSet.has(p.source) && memberSet.has(p.target))
      .map((p) => p.similarity);

    clusters.push({
      id: `local_cluster_${clusters.length + 1}`,
      members: members.sort(),
      meanSimilarity: Number(average(sims).toFixed(4)),
      threshold,
      edgeCount: sims.length,
    });
  }

  return clusters.sort((a, b) => b.meanSimilarity - a.meanSimilarity);
}

function enrichGlobalClusters(clusters, sections) {
  return clusters.map((cluster) => {
    const memberSet = new Set(cluster.members);
    const supports = [];

    for (const section of sections) {
      const sectionMembers = section.commentators.filter((c) => memberSet.has(c));
      if (sectionMembers.length < 2) continue;

      const pairEvidence = (section.comparisonsBetweenCommentators || [])
        .filter((row) => memberSet.has(row.source) && memberSet.has(row.target))
        .sort((a, b) => b.similarity - a.similarity)[0] || null;

      supports.push({
        sectionId: section.id,
        clusterMemberCountInSection: sectionMembers.length,
        membersInSection: sectionMembers,
        metrics: {
          rambanCoherence: section.metrics.rambanCoherence,
          commentatorAgreement: section.metrics.commentatorAgreement,
          gap: section.metrics.gap,
          flag: section.metrics.flag,
        },
        strongestInnerPair: pairEvidence
          ? {
              source: pairEvidence.source,
              target: pairEvidence.target,
              similarity: pairEvidence.similarity,
              sharedSample: pairEvidence.sharedSample,
            }
          : null,
      });
    }

    supports.sort((a, b) => {
      const aScore = (a.clusterMemberCountInSection * 100) + toNumber(a.metrics.commentatorAgreement, 0);
      const bScore = (b.clusterMemberCountInSection * 100) + toNumber(b.metrics.commentatorAgreement, 0);
      return bScore - aScore;
    });

    const supportsMeanAgreement = supports.length
      ? Number(average(supports.map((s) => toNumber(s.metrics.commentatorAgreement, 0))).toFixed(4))
      : null;

    return {
      ...cluster,
      supportingSections: supports,
      supportingSectionsCount: supports.length,
      meanSectionAgreement: supportsMeanAgreement,
      explanation: 'האשכול מחושב מדמיון בין פרשנים ומגובה ברשימת מקורות שבהם חברי האשכול מופיעים יחד עם מדדים מקומיים.',
    };
  });
}

function stableSectionSort(a, b) {
  const normalize = (s) => String(s).split('_').map((x) => toNumber(x, Number.MAX_SAFE_INTEGER));
  const pa = normalize(a);
  const pb = normalize(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return String(a).localeCompare(String(b));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function writeJsAssignment(filePath, globalPath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const serialized = JSON.stringify(data);
  const content = `${globalPath} = ${serialized};\n`;
  await fs.writeFile(filePath, content, 'utf8');
}

function toRelUrl(root, targetPath) {
  return path.relative(root, targetPath).replace(/\\/g, '/');
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(root, '..');
  const dataRoot = path.resolve(workspaceRoot, 'Data');
  const e2Root = path.join(dataRoot, 'E2_full_corpus');
  const e3Root = path.join(dataRoot, 'E3_comparative_analysis');

  const outputDataRoot = path.join(root, 'data');
  const sectionsOutputRoot = path.join(outputDataRoot, 'sections');
  const commentatorsOutputRoot = path.join(outputDataRoot, 'commentators');

  const coherenceRows = await readCsv(path.join(e3Root, 'coherence_by_section.csv'));
  const coverageRows = await readCsv(path.join(e3Root, 'coverage.csv'));
  const corpusGraphMetricsRows = await readCsv(path.join(e3Root, 'corpus_graph_metrics.csv'));
  const methodRows = await readCsv(path.join(e3Root, 'commentator', 'method_profile.csv'));
  const sourceRows = await readCsv(path.join(e3Root, 'commentator', 'source_profile.csv'));
  const scripturalRows = await readCsv(path.join(e3Root, 'commentator', 'scriptural_range.csv'));
  const structureRows = await readCsv(path.join(e3Root, 'commentator', 'commentator_structure.csv'));
  const similarityRows = await readCsv(path.join(e3Root, 'matrices', 'commentator_similarity.csv'));
  const signatureValidationRows = await readCsv(path.join(e3Root, 'commentator', 'signature', 'witness_validation.csv'));
  const signatureMatrixRows = await readCsv(path.join(e3Root, 'commentator', 'signature', 'commentator_signature_matrix.csv'));
  const corpusAnalysisPath = path.join(e3Root, 'E3_corpus_analysis.md');
  const sourceDocPaths = [
    path.join(e3Root, 'E3_coherence_analysis.md'),
    path.join(e3Root, 'E3_commentator_analysis.md'),
    path.join(e3Root, 'E3_corpus_analysis.md'),
    path.join(e3Root, 'scholar_guide.md'),
  ];
  const corpusDocSpecs = [
    {
      id: 'professional',
      title: 'E3 — Comparative Corpus Analysis',
      audienceLabel: 'גרסה מקצועית',
      language: 'en',
      direction: 'ltr',
      filePath: path.join(e3Root, 'E3_corpus_analysis.md'),
    },
    {
      id: 'he-accessible',
      title: 'E3 Corpus Analysis (Hebrew Accessible)',
      audienceLabel: 'גרסה נגישה בעברית',
      language: 'he',
      direction: 'rtl',
      filePath: path.join(root, 'corpus_docs', 'E3_corpus_analysis_accessible_HE.md'),
    },
  ];

  const pairwiseRoot = path.join(e3Root, 'pairwise');
  const aggregateRoot = path.join(e3Root, 'commentator', 'aggregate');
  const commentatorVizRoot = path.join(e3Root, 'commentator', 'viz');
  const overlapVizRoot = path.join(e3Root, 'overlap_viz');
  const graphsRoot = path.join(e2Root, 'graphs');
  const globalSimilarity = parseSimilarityMatrix(similarityRows);
  const extraKnowledgeMap = new Map();
  const referenceDocs = [];
  const commentatorVisuals = [];
  const overlapVisuals = [];
  const e2GraphVisualizations = [];
  const corpusDocuments = [];
  const knownHtmlRelSet = new Set();

  const registerKnownHtml = (filePath) => {
    knownHtmlRelSet.add(toRelUrl(root, filePath));
  };

  const commentatorVizIndexHtml = path.join(commentatorVizRoot, 'index.html');
  const overlapVizIndexHtml = path.join(overlapVizRoot, 'index.html');
  const matricesDendrogramPng = path.join(e3Root, 'matrices', 'dendrogram.png');
  const signatureDendrogramPng = path.join(e3Root, 'commentator', 'signature', 'dendrogram.png');

  const overlapEntries = await fs.readdir(overlapVizRoot, { withFileTypes: true });
  for (const entry of overlapEntries) {
    if (!entry.isDirectory()) continue;
    const sectionDir = path.join(overlapVizRoot, entry.name);
    const files = await fs.readdir(sectionDir);
    const grouped = {};
    for (const fileName of files) {
      const ext = path.extname(fileName).slice(1).toLowerCase();
      const baseName = path.basename(fileName, path.extname(fileName));
      const commentatorId = baseName
        .replace(/^Overlap_RAMBAN_/, '')
        .replace(new RegExp(`^${entry.name}_`), '')
        .replace(/_graph$/, '');
      if (!grouped[commentatorId]) grouped[commentatorId] = {};
      if (ext === 'html' || ext === 'json') {
        grouped[commentatorId][ext] = toRelUrl(root, path.join(sectionDir, fileName));
        if (ext === 'html') {
          registerKnownHtml(path.join(sectionDir, fileName));
        }
      }
    }
    overlapVisuals.push({
      sectionId: entry.name,
      items: Object.entries(grouped)
        .map(([commentatorId, filesByType]) => ({ commentatorId, ...filesByType }))
        .sort((a, b) => a.commentatorId.localeCompare(b.commentatorId)),
    });
  }

  for (const docPath of sourceDocPaths) {
    if (!(await exists(docPath))) continue;
    const raw = await fs.readFile(docPath, 'utf8');
    const text = stripBom(raw);
    const firstHeading = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(docPath);
    referenceDocs.push({
      fileName: path.basename(docPath),
      title: firstHeading,
      summary: summarizeMarkdown(text),
    });
  }

  for (const spec of corpusDocSpecs) {
    if (!(await exists(spec.filePath))) continue;
    const raw = await fs.readFile(spec.filePath, 'utf8');
    const text = stripBom(raw);
    const firstHeading = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || spec.title;
    corpusDocuments.push({
      id: spec.id,
      title: firstHeading,
      audienceLabel: spec.audienceLabel,
      language: spec.language || null,
      direction: spec.direction || null,
      fileName: path.basename(spec.filePath),
      relPath: toRelUrl(root, spec.filePath),
      baseDirRelPath: toRelUrl(root, path.dirname(spec.filePath)),
      summary: summarizeMarkdown(text),
      content: text,
    });
  }

  const commentatorIds = new Set();
  coverageRows.forEach((r) => commentatorIds.add(normalizeId(r.commentator)));
  methodRows.forEach((r) => commentatorIds.add(normalizeId(r.commentator)));
  structureRows.forEach((r) => commentatorIds.add(normalizeId(r.commentator)));

  const sectionMap = new Map();
  for (const row of coherenceRows) {
    const sectionId = normalizeId(row.section);
    sectionMap.set(sectionId, {
      id: sectionId,
      metrics: {
        rambanCoherence: toNumber(row.ramban_coherence),
        coherenceZ: toNumber(row.coherence_z),
        commentatorAgreement: toNumber(row.commentator_agreement, NaN),
        gap: toNumber(row.gap, NaN),
        rambanConcepts: toNumber(row.ramban_concepts),
        nCommentators: toNumber(row.n_commentators),
        rambanPeriphRank: toNumber(row.ramban_periph_rank),
        nMembers: toNumber(row.n_members),
        flag: row.flag || '',
      },
      coverage: [],
      pairwise: [],
      graphs: {},
      commentators: [],
      textAvailability: { ramban: false, commentators: 0 },
      dataFile: null,
    });
  }

  for (const row of coverageRows) {
    const sectionId = normalizeId(row.section);
    const commentatorId = normalizeId(row.commentator);
    if (!sectionMap.has(sectionId)) continue;
    const section = sectionMap.get(sectionId);
    section.coverage.push({
      commentatorId,
      concepts: toNumber(row.concepts),
      free: toNumber(row.free),
      relations: toNumber(row.relations),
      status: row.status || 'unknown',
    });
  }

  for (const sectionId of sectionMap.keys()) {
    const filePath = path.join(pairwiseRoot, `${sectionId}.json`);
    if (!(await exists(filePath))) continue;
    const pairwise = await readJson(filePath);
    const list = [];
    for (const [commentatorId, data] of Object.entries(pairwise.vs_ramban || {})) {
      list.push({
        commentatorId: normalizeId(commentatorId),
        align: toNumber(data.align),
        shared: Array.isArray(data.shared) ? data.shared : [],
        uniqueCommentary: Array.isArray(data.unique_commentary) ? data.unique_commentary : [],
        uniqueRamban: Array.isArray(data.unique_ramban) ? data.unique_ramban : [],
      });
    }
    sectionMap.get(sectionId).pairwise = list.sort((a, b) => b.align - a.align);
  }

  const graphDirs = await fs.readdir(graphsRoot, { withFileTypes: true });
  for (const dir of graphDirs) {
    if (!dir.isDirectory()) continue;
    const parsed = parseGraphFolderName(dir.name, commentatorIds);
    if (!parsed) continue;

    const section = sectionMap.get(parsed.sectionId);
    if (!section) continue;

    const graphFilePath = path.join(graphsRoot, dir.name, 'C-1_O1', 'singleStepRelations', 'final_knowledge_graph.json');
    if (!(await exists(graphFilePath))) continue;

    const graphHtmlPath = path.join(graphsRoot, dir.name, 'C-1_O1', 'singleStepRelations', 'knowledge_graph_visualization.html');
    if (await exists(graphHtmlPath)) {
      e2GraphVisualizations.push({
        folder: dir.name,
        sectionId: parsed.sectionId,
        commentatorId: parsed.commentatorId,
        html: toRelUrl(root, graphHtmlPath),
      });
      registerKnownHtml(graphHtmlPath);
    }

    const graphRaw = await readJson(graphFilePath);
    const graph = simplifyGraph(graphRaw, parsed.sectionId, parsed.commentatorId);
    section.graphs[parsed.commentatorId] = graph;

    for (const node of graph.nodes) {
      if (Array.isArray(node.sourceInstanceIds) && node.sourceInstanceIds.length > 0) continue;
      const key = `${node.label}||${node.type}`;
      const prev = extraKnowledgeMap.get(key) || {
        label: node.label,
        type: node.type,
        count: 0,
        sections: new Set(),
        commentators: new Set(),
        examples: [],
      };
      prev.count += 1;
      prev.sections.add(parsed.sectionId);
      prev.commentators.add(parsed.commentatorId);
      if (prev.examples.length < 6) prev.examples.push(`${parsed.sectionId}:${parsed.commentatorId}`);
      extraKnowledgeMap.set(key, prev);
    }

    if (graph.text && parsed.commentatorId === 'RAMBAN') {
      section.textAvailability.ramban = true;
    }
    if (graph.text && parsed.commentatorId !== 'RAMBAN') {
      section.textAvailability.commentators += 1;
    }
  }

  const sections = [...sectionMap.values()].sort((a, b) => stableSectionSort(a.id, b.id));
  for (const section of sections) {
    section.commentators = Object.keys(section.graphs).sort((a, b) => a.localeCompare(b));
    section.comparisonsBetweenCommentators = buildSectionComparisons(section);
    section.localClusters = buildLocalClusters(section.commentators, section.comparisonsBetweenCommentators, 0.16);
    section.similarityMatrix = buildSimilarityMatrix(section);

    const topRamban = [...section.pairwise].sort((a, b) => b.align - a.align).slice(0, 3);
    const strongestPair = section.comparisonsBetweenCommentators[0] || null;
    section.localInsights = {
      strongestRambanLinks: topRamban.map((x) => ({ commentatorId: x.commentatorId, align: x.align })),
      strongestPair: strongestPair
        ? {
            source: strongestPair.source,
            target: strongestPair.target,
            similarity: strongestPair.similarity,
            sharedSample: strongestPair.sharedSample,
          }
        : null,
      note: 'אשכול מקומי מחושב מתוך חיתוך מושגים בין גרפים של אותו מקור, ככלי עזר פרשני.',
    };

    const sectionFile = `data/sections/section_${sanitizeFileName(section.id)}.js`;
    section.dataFile = sectionFile;

    await writeJsAssignment(
      path.join(root, sectionFile),
      `window.RAMBAN_V2_SECTIONS[${JSON.stringify(section.id)}]`,
      section
    );
  }

  const commentatorMap = new Map();
  for (const id of commentatorIds) {
    const peers = globalSimilarity.pairs
      .filter((p) => p.source === id || p.target === id)
      .map((p) => ({
        commentatorId: p.source === id ? p.target : p.source,
        similarity: p.similarity,
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8);

    commentatorMap.set(id, {
      id,
      sections: [],
      avgAlignVsRamban: null,
      methodProfile: methodRows.find((r) => normalizeId(r.commentator) === id) || null,
      sourceProfile: sourceRows.find((r) => normalizeId(r.commentator) === id) || null,
      scripturalProfile: scripturalRows.find((r) => normalizeId(r.commentator) === id) || null,
      structureProfile: structureRows.find((r) => normalizeId(r.commentator) === id) || null,
      peerSimilarities: peers,
      aggregateGraph: null,
      dataFile: null,
    });

    const visualKinds = ['core', 'full'];
    const visualEntry = { id };
    for (const kind of visualKinds) {
      const kindDir = path.join(commentatorVizRoot, kind);
      const htmlPath = path.join(kindDir, `${id}_${kind}.html`);
      const pngPath = path.join(kindDir, `${id}_${kind}.png`);
      const svgPath = path.join(kindDir, `${id}_${kind}.svg`);
      if (await exists(htmlPath)) {
        registerKnownHtml(htmlPath);
        visualEntry[kind] = {
          html: toRelUrl(root, htmlPath),
          png: (await exists(pngPath)) ? toRelUrl(root, pngPath) : null,
          svg: (await exists(svgPath)) ? toRelUrl(root, svgPath) : null,
        };
      }
    }
    if (Object.keys(visualEntry).length > 1) {
      commentatorVisuals.push(visualEntry);
    }
  }

  for (const section of sections) {
    for (const row of section.pairwise) {
      const commentator = commentatorMap.get(row.commentatorId);
      if (!commentator) continue;
      commentator.sections.push({
        sectionId: section.id,
        align: row.align,
        sharedCount: row.shared.length,
      });
    }

    if (section.graphs.RAMBAN) {
      for (const commentatorId of Object.keys(section.graphs)) {
        if (commentatorId === 'RAMBAN') continue;
        const commentator = commentatorMap.get(commentatorId);
        if (!commentator) continue;
        if (!commentator.sections.some((x) => x.sectionId === section.id)) {
          commentator.sections.push({ sectionId: section.id, align: NaN, sharedCount: 0 });
        }
      }
    }
  }

  for (const [id, commentator] of commentatorMap.entries()) {
    const aligns = commentator.sections.map((x) => x.align).filter((x) => Number.isFinite(x));
    commentator.avgAlignVsRamban = aligns.length ? Number(average(aligns).toFixed(4)) : null;
    commentator.sections.sort((a, b) => stableSectionSort(a.sectionId, b.sectionId));

    const aggregateFile = path.join(aggregateRoot, `${id}.json`);
    if (await exists(aggregateFile)) {
      const aggregateRaw = await readJson(aggregateFile);
      const nodes = Array.isArray(aggregateRaw.nodes)
        ? aggregateRaw.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            type: n.type,
            freq: toNumber(n.freq),
            instances: toNumber(n.instances),
          }))
        : [];
      const edges = Array.isArray(aggregateRaw.edges)
        ? aggregateRaw.edges.map((e, idx) => ({
            id: `${id}_${idx}`,
            source: e.s,
            target: e.o,
            predicate: e.pred,
            weight: toNumber(e.w, 1),
          }))
        : [];

      commentator.aggregateGraph = {
        commentatorId: id,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodes,
        edges,
      };
    }

    const commentatorFile = `data/commentators/commentator_${sanitizeFileName(id)}.js`;
    commentator.dataFile = commentatorFile;

    await writeJsAssignment(
      path.join(root, commentatorFile),
      `window.RAMBAN_V2_COMMENTATORS[${JSON.stringify(id)}]`,
      commentator
    );
  }

  const topPairs = pickTopPairs(globalSimilarity.pairs, 30);
  const clusters = enrichGlobalClusters(buildClusters(globalSimilarity.ids, globalSimilarity.pairs, 0.55), sections);

  if (await exists(commentatorVizIndexHtml)) registerKnownHtml(commentatorVizIndexHtml);
  if (await exists(overlapVizIndexHtml)) registerKnownHtml(overlapVizIndexHtml);

  const allDataHtmlAbs = await listFilesRecursive(dataRoot, '.html');
  const allDataHtml = allDataHtmlAbs.map((p) => toRelUrl(root, p)).sort((a, b) => a.localeCompare(b));

  const knownE2Html = new Set(e2GraphVisualizations.map((row) => row.html));
  for (const rel of allDataHtml) {
    const match = rel.match(/Data\/E2_full_corpus\/graphs\/([^/]+)\/C-1_O1\/singleStepRelations\/knowledge_graph_visualization\.html$/);
    if (!match) continue;
    if (knownE2Html.has(rel)) continue;
    const folder = match[1];
    const parsed = parseGraphFolderLoose(folder);
    e2GraphVisualizations.push({
      folder,
      sectionId: parsed?.sectionId || 'unknown',
      commentatorId: parsed?.commentatorId || 'unknown',
      html: rel,
    });
    knownE2Html.add(rel);
    knownHtmlRelSet.add(rel);
  }

  const uncataloguedHtml = allDataHtml.filter((rel) => !knownHtmlRelSet.has(rel));

  let corpusFindings = [];
  if (await exists(corpusAnalysisPath)) {
    const corpusText = stripBom(await fs.readFile(corpusAnalysisPath, 'utf8'));
    corpusFindings = corpusText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('![') && line.length > 25)
      .slice(0, 6);
  }

  const flagGroups = {};
  for (const section of sections) {
    const flag = section.metrics.flag || 'ללא_דגל';
    flagGroups[flag] = flagGroups[flag] || [];
    flagGroups[flag].push(section.id);
  }

  const keyFindings = [
    'הדשבורד משתמש בנתונים קיימים בלבד (E2/E3), ללא חישוב מחקרי מחדש.',
    'אשכולות כלליים נגזרים ממטריצת דמיון בין פרשנים, ומשמשים כלי עזר פרשני.',
    'כל פריט במבט הכללי מחובר בחזרה למקורות, לגרפים ולטקסטים הרלוונטיים.',
    ...corpusFindings,
  ];

  const index = {
    generatedAt: new Date().toISOString(),
    source: {
      dataRoot: path.relative(root, dataRoot).replace(/\\/g, '/'),
      e2: path.relative(root, e2Root).replace(/\\/g, '/'),
      e3: path.relative(root, e3Root).replace(/\\/g, '/'),
    },
    stats: {
      sections: sections.length,
      commentators: commentatorMap.size,
      pairwisePairs: globalSimilarity.pairs.length,
      clusters: clusters.length,
    },
    sections: sections.map((s) => ({
      id: s.id,
      metrics: s.metrics,
      commentatorCount: s.commentators.length,
      dataFile: s.dataFile,
    })),
    commentators: [...commentatorMap.values()].map((c) => ({
      id: c.id,
      sectionsCount: c.sections.length,
      avgAlignVsRamban: c.avgAlignVsRamban,
      dataFile: c.dataFile,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    global: {
      clusters,
      topPairs,
      commentatorSimilarity: globalSimilarity,
      flagGroups,
      keyFindings,
      referenceDocs,
      corpusDocuments,
      coverageRows,
      corpusGraphMetricsRows,
      signatureValidationRows,
      signatureMatrixRows,
      commentatorVisuals,
      overlapVisuals,
      e2GraphVisualizations: e2GraphVisualizations.sort((a, b) => {
        const bySection = stableSectionSort(a.sectionId, b.sectionId);
        if (bySection !== 0) return bySection;
        return a.commentatorId.localeCompare(b.commentatorId);
      }),
      visualIndexes: {
        commentatorVizHtml: (await exists(commentatorVizIndexHtml)) ? toRelUrl(root, commentatorVizIndexHtml) : null,
        overlapVizHtml: (await exists(overlapVizIndexHtml)) ? toRelUrl(root, overlapVizIndexHtml) : null,
      },
      dendrograms: {
        matrices: (await exists(matricesDendrogramPng)) ? toRelUrl(root, matricesDendrogramPng) : null,
        signature: (await exists(signatureDendrogramPng)) ? toRelUrl(root, signatureDendrogramPng) : null,
      },
      htmlCoverage: {
        totalHtmlInData: allDataHtml.length,
        cataloguedHtml: knownHtmlRelSet.size,
        uncataloguedHtmlCount: uncataloguedHtml.length,
        uncataloguedSample: uncataloguedHtml.slice(0, 30),
      },
      knowledgeBodies: [...extraKnowledgeMap.values()]
        .map((v) => ({
          label: v.label,
          type: v.type,
          count: v.count,
          sections: [...v.sections],
          commentators: [...v.commentators],
          examples: v.examples,
        }))
        .sort((a, b) => b.count - a.count),
    },
  };

  await writeJson(path.join(root, 'data-index.json'), index);
  await writeJson(path.join(outputDataRoot, 'data-index.json'), index);
  await writeJsAssignment(path.join(outputDataRoot, 'data-index.js'), 'window.RAMBAN_V2_INDEX', index);

  await fs.mkdir(sectionsOutputRoot, { recursive: true });
  await fs.mkdir(commentatorsOutputRoot, { recursive: true });

  console.log(`Built index for ${index.stats.sections} sections and ${index.stats.commentators} commentators.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
