#!/usr/bin/env node
// Rendert public/graph.json naar een statische SVG-momentopname.
//
// Het project is afgerond en de live-site is offline, dus deze snapshot is wat
// er van de visualizer overblijft: één bestand zonder JavaScript, zonder CDN en
// zonder netwerkverkeer, dat rechtstreeks in de README getoond kan worden.
//
// De opmaak volgt bewust dezelfde regels als de interactieve versie:
//  - ELK "layered" met de layout-opties uit src/visualizer/components/Graph/Graph.tsx
//  - het donkere thema uit src/visualizer/themes.ts
//  - de Azure-iconen en tekstafkapping uit src/visualizer/components/Graph/style.ts

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import ELK from "elkjs/lib/elk.bundled.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ICONS_DIR = join(ROOT, "src/visualizer/assets/icons/azure");
const GRAPH_FILE = process.env.GRAPH_FILE ?? join(ROOT, "public/graph.json");
const OUT_FILE = process.env.OUT_FILE ?? join(ROOT, "docs/graph-snapshot.svg");

// Overgenomen uit themes.ts (darkTheme) — de weergave waarin de visualizer
// tijdens het project ook daadwerkelijk gebruikt is.
const theme = {
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif",
  foreground: "#ffffff",
  foregroundSecondary: "#c1c1c1",
  canvasBackground: "#111111",
  canvasDot: "#3f3f3f",
  childlessBackground: "#333333",
  containerBackground: "#000000",
  containerBackgroundOpacity: 0.2,
  border: "#c1c1c1",
  borderOpacity: 0.6,
  edge: "#c1c1c1",
  edgeOpacity: 0.6,
  edgeWidth: 2,
};

const NODE_WIDTH = 300;
const NODE_HEIGHT = 80;
const NODE_RADIUS = 8;
const CONTAINER_RADIUS = 12;
// Ruimte bovenin een module zodat de koptekst niet over de resources valt.
const CONTAINER_PADDING = { top: 44, right: 16, bottom: 16, left: 16 };
const CANVAS_PADDING = 48;

/* ------------------------------------------------------------------ iconen */

// index.ts mapt resourcetypes op iconbestanden via een switch met dynamic
// imports. Die switch is de enige bron van waarheid, dus lezen we hem uit in
// plaats van de mapping hier te dupliceren.
function loadIconMap() {
  const source = readFileSync(join(ICONS_DIR, "index.ts"), "utf8");
  const map = new Map();

  const caseRe = /case\s+"([^"]+)":\s*\n\s*return \(await import\("\.\/([^"]+)\?raw"\)\)/g;
  let match;
  while ((match = caseRe.exec(source)) !== null) {
    map.set(match[1].toLowerCase(), match[2]);
  }

  const fallbackRe = /default:\s*\n\s*return \(await import\("\.\/([^"]+)\?raw"\)\)/;
  const fallback = source.match(fallbackRe);
  if (!fallback) {
    throw new Error("Geen default-case gevonden in icons/azure/index.ts");
  }

  return { map, fallback: fallback[1] };
}

const { map: iconMap, fallback: fallbackIcon } = loadIconMap();
const MODULE_ICON = "general/10802-icon-service-Folder-Blank.svg";

// Verzamelt elk gebruikt icoon één keer als <symbol>, zodat het bestand niet
// per resource een kopie van dezelfde SVG meesleept.
const symbols = new Map();

function useIcon(relativePath) {
  const existing = symbols.get(relativePath);
  if (existing) {
    return existing.symbolId;
  }

  const raw = readFileSync(join(ICONS_DIR, relativePath), "utf8");
  const symbolId = `icon-${symbols.size}`;

  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 18 18";
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

  // De iconen dragen hun eigen id's (gradients, clip paths). In één gedeeld
  // document zouden die elkaar kunnen overschrijven, dus krijgt elk icoon een
  // eigen prefix.
  const prefix = `${symbolId}-`;
  const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  let body = inner;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body
      .replace(new RegExp(`(\\sid=")${escaped}(")`, "g"), `$1${prefix}${id}$2`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${prefix}${id})`)
      .replace(new RegExp(`((?:xlink:)?href=")#${escaped}(")`, "g"), `$1#${prefix}${id}$2`);
  }

  symbols.set(relativePath, { symbolId, viewBox, body });
  return symbolId;
}

/* ------------------------------------------------------------------- tekst */

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
}

// Identiek aan truncate() in Graph/style.ts, zodat labels in de snapshot exact
// zo afgekapt worden als in de interactieve visualizer.
function truncate(text, lengthLimit) {
  if (text.length <= lengthLimit) {
    return text;
  }

  const charsLength = lengthLimit - 3;
  const headLength = Math.ceil(charsLength / 2);
  const tailLength = Math.floor(charsLength / 2);

  return text.slice(0, headLength) + "..." + text.slice(text.length - tailLength);
}

/* ------------------------------------------------------------------ layout */

const graph = JSON.parse(readFileSync(GRAPH_FILE, "utf8"));

const parentOf = (id) => (id.includes("::") ? id.split("::").slice(0, -1).join("::") : null);
const symbolOf = (id) => id.split("::").pop();

const containers = new Map();
for (const node of graph.nodes) {
  if (node.hasChildren) {
    containers.set(node.id, { ...node, children: [] });
  }
}
for (const node of graph.nodes) {
  if (node.hasChildren) continue;
  const parent = parentOf(node.id);
  const container = parent ? containers.get(parent) : null;
  if (container) {
    container.children.push(node);
  } else {
    // Losse resource zonder module: laat hem op het hoogste niveau meedoen.
    containers.set(node.id, { ...node, standalone: true, children: [] });
  }
}

// ELK verwacht een edge in de dichtstbijzijnde gemeenschappelijke ouder.
const rootEdges = [];
const edgesByContainer = new Map();
for (const edge of graph.edges) {
  const sourceParent = parentOf(edge.sourceId);
  const targetParent = parentOf(edge.targetId);
  const elkEdge = { id: `${edge.sourceId}>${edge.targetId}`, sources: [edge.sourceId], targets: [edge.targetId] };

  if (sourceParent && sourceParent === targetParent) {
    if (!edgesByContainer.has(sourceParent)) edgesByContainer.set(sourceParent, []);
    edgesByContainer.get(sourceParent).push(elkEdge);
  } else {
    rootEdges.push(elkEdge);
  }
}

// Binnen een module dezelfde "layered"-opstelling als Graph.tsx: van boven naar
// beneden, afhankelijkheden onder hun afnemer. Eén afwijking: de interactieve
// versie gebruikt layering.strategy INTERACTIVE, die zich baseert op de posities
// die de gebruiker op dat moment op het canvas ziet. Zonder canvas bestaan die
// posities niet, dus valt de snapshot terug op de standaardstrategie.
const containerLayoutOptions = {
  "elk.algorithm": "layered",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "40",
  "elk.layered.spacing.nodeNodeBetweenLayers": "60",
  "elk.spacing.componentComponent": "60",
};

const elkChildren = [...containers.values()].map((container) => {
  if (container.standalone) {
    return { id: container.id, width: NODE_WIDTH, height: NODE_HEIGHT };
  }

  return {
    id: container.id,
    layoutOptions: {
      ...containerLayoutOptions,
      "elk.padding": `[top=${CONTAINER_PADDING.top},left=${CONTAINER_PADDING.left},bottom=${CONTAINER_PADDING.bottom},right=${CONTAINER_PADDING.right}]`,
    },
    children: container.children.map((child) => ({ id: child.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: edgesByContainer.get(container.id) ?? [],
  };
});

// De modules zelf hebben onderling geen afhankelijkheden zolang alle edges
// binnen één module blijven. "layered" laat dan grote gaten vallen, dus in dat
// geval pakken we de modules als losse blokken. Zijn er wel edges tussen
// modules, dan is de gelaagde opstelling juist wat je wilt zien.
const rootLayoutOptions =
  rootEdges.length > 0
    ? { ...containerLayoutOptions, "elk.aspectRatio": "2.5", "elk.spacing.nodeNode": "80" }
    : {
        "elk.algorithm": "rectpacking",
        "elk.aspectRatio": "2.2",
        "elk.spacing.nodeNode": "60",
        "elk.rectpacking.widthApproximation.targetWidth": "-1",
      };

const elkGraph = {
  id: "root",
  layoutOptions: rootLayoutOptions,
  children: elkChildren,
  edges: rootEdges,
};

const layout = await new ELK().layout(elkGraph);

// ELK levert coördinaten relatief aan de ouder; de SVG heeft absolute nodig.
const boxes = new Map();
function collect(node, offsetX, offsetY) {
  for (const child of node.children ?? []) {
    const x = offsetX + (child.x ?? 0);
    const y = offsetY + (child.y ?? 0);
    boxes.set(child.id, { x, y, width: child.width, height: child.height, isContainer: !!child.children?.length });
    collect(child, x, y);
  }
}
collect(layout, CANVAS_PADDING, CANVAS_PADDING);

/* --------------------------------------------------------------- tekenwerk */

// Knipt een lijn tussen twee middelpunten af op de rand van de rechthoek, zodat
// pijlen netjes tegen de node aan stoppen in plaats van eronder te verdwijnen.
function clipToBox(box, towardX, towardY) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const scaleX = dx === 0 ? Infinity : box.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : box.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return { x: cx + dx * scale, y: cy + dy * scale };
}

function renderEdge(edge) {
  const source = boxes.get(edge.sourceId);
  const target = boxes.get(edge.targetId);
  if (!source || !target) {
    console.warn(`snapshot: edge ${edge.sourceId} -> ${edge.targetId} overgeslagen, node onbekend`);
    return "";
  }

  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const start = clipToBox(source, targetCenter.x, targetCenter.y);
  const end = clipToBox(target, sourceCenter.x, sourceCenter.y);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;

  // Pijlpunt: driehoek van 10 lang en 8 breed, net als de triangle-arrow in de
  // interactieve versie.
  const tipX = end.x;
  const tipY = end.y;
  const baseX = tipX - ux * 10;
  const baseY = tipY - uy * 10;
  const points = [
    `${tipX.toFixed(2)},${tipY.toFixed(2)}`,
    `${(baseX - uy * 4).toFixed(2)},${(baseY + ux * 4).toFixed(2)}`,
    `${(baseX + uy * 4).toFixed(2)},${(baseY - ux * 4).toFixed(2)}`,
  ].join(" ");

  return [
    `<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${baseX.toFixed(2)}" y2="${baseY.toFixed(2)}" />`,
    `<polygon points="${points}" />`,
  ].join("\n      ");
}

function renderContainer(node) {
  const box = boxes.get(node.id);
  const iconId = useIcon(MODULE_ICON);
  const label = truncate(node.id + (node.isCollection ? " <collection>" : ""), 37);

  return `    <g>
      <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${CONTAINER_RADIUS}"
            fill="${theme.containerBackground}" fill-opacity="${theme.containerBackgroundOpacity}"
            stroke="${theme.border}" stroke-opacity="${theme.borderOpacity}" stroke-width="1" />
      <use href="#${iconId}" x="${box.x + 12}" y="${box.y + 14}" width="18" height="18" />
      <text x="${box.x + 40}" y="${box.y + 28}" font-size="12" fill="${theme.foregroundSecondary}">${escapeXml(label)}</text>
    </g>`;
}

function renderChildlessNode(node) {
  const box = boxes.get(node.id);
  const iconId = useIcon(node.type === "<module>" ? MODULE_ICON : (iconMap.get(node.type.toLowerCase()) ?? fallbackIcon));

  const symbol = truncate(symbolOf(node.id), 24);
  const typeLabel = truncate((node.type.split("/").pop() ?? node.type) + (node.isCollection ? "[]" : ""), 32);

  return `    <g>
      <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${NODE_RADIUS}"
            fill="${theme.childlessBackground}"
            stroke="${theme.border}" stroke-opacity="${theme.borderOpacity}" stroke-width="1" />
      <use href="#${iconId}" x="${box.x + 12}" y="${box.y + 16}" width="48" height="48" />
      <text x="${box.x + 72}" y="${box.y + 36}" font-size="16" fill="${theme.foreground}">${escapeXml(symbol)}</text>
      <text x="${box.x + 72}" y="${box.y + 56}" font-size="12" fill="${theme.foregroundSecondary}">${escapeXml(typeLabel)}</text>
    </g>`;
}

const containerNodes = graph.nodes.filter((node) => node.hasChildren && boxes.has(node.id));
const leafNodes = graph.nodes.filter((node) => !node.hasChildren && boxes.has(node.id));

// Volgorde bepaalt de stapeling: eerst de modulevlakken, dan de verbindingen,
// dan de resources er bovenop.
const containerMarkup = containerNodes.map(renderContainer).join("\n");
const edgeMarkup = graph.edges.map(renderEdge).filter(Boolean).join("\n      ");
const leafMarkup = leafNodes.map(renderChildlessNode).join("\n");

const width = Math.round(layout.width + CANVAS_PADDING * 2);
const footerHeight = 44;
const height = Math.round(layout.height + CANVAS_PADDING * 2 + footerHeight);

const symbolMarkup = [...symbols.values()]
  .map(({ symbolId, viewBox, body }) => `    <symbol id="${symbolId}" viewBox="${viewBox}">${body}</symbol>`)
  .join("\n");

// De graaf is bevroren, dus de datum hoort daar ook bij: hij staat vast in
// plaats van "vandaag". Zo levert het script bij elke run hetzelfde bestand op
// en blijft een diff betekenisvol.
const generatedOn = process.env.SNAPSHOT_DATE ?? "2026-08-02";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="PCE-Visualizer momentopname van de Bicep-modules uit PCE-PoC">
  <title>PCE-Visualizer - momentopname ${generatedOn}</title>
  <defs>
    <pattern id="dot-grid" x="12" y="12" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${theme.canvasDot}" />
    </pattern>
${symbolMarkup}
  </defs>
  <g font-family="${escapeXml(theme.fontFamily)}">
    <rect width="${width}" height="${height}" fill="${theme.canvasBackground}" />
    <rect width="${width}" height="${height}" fill="url(#dot-grid)" />
${containerMarkup}
    <g stroke="${theme.edge}" stroke-width="${theme.edgeWidth}" fill="${theme.edge}" stroke-opacity="${theme.edgeOpacity}" fill-opacity="${theme.edgeOpacity}" stroke-linecap="round">
      ${edgeMarkup}
    </g>
${leafMarkup}
    <text x="${CANVAS_PADDING}" y="${height - 18}" font-size="14" fill="${theme.foregroundSecondary}">PCE Visualizer - AmbuTwente (archief) - momentopname ${generatedOn}</text>
  </g>
</svg>
`;

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, svg, "utf8");

console.log(`snapshot geschreven naar ${OUT_FILE} (${width}x${height}, ${leafNodes.length} resources in ${containerNodes.length} modules)`);
