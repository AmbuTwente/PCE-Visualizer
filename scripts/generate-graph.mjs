#!/usr/bin/env node
// Proof of Concept-code voor het Cloud Engineering-project.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { config, ROOT } from "./config.mjs";

// MODULES_DIR wijst naar een uitgecheckte kopie van de repository met de
// Bicep-modules. De workflow zet die naast deze repo neer; lokaal geef je zelf
// een pad mee. Zonder pad wordt de map uit visualizer.config.json naast deze
// repository verwacht.
const MODULES_DIR = process.env.MODULES_DIR ?? join(ROOT, "..", config.source.modulesPath);
const PUBLIC_DIR = join(ROOT, "public");
const OUT_FILE = join(PUBLIC_DIR, "graph.json");

mkdirSync(PUBLIC_DIR, { recursive: true });

// De derde groep is alles wat tussen het resourcetype en het body-blok staat:
// "= ", "existing = ", "= [for i in range(...): ". Bewust ruim gehouden, zodat
// een onbekende variant hooguit een detail kost en nooit de hele resource.
const RESOURCE_RE = /^resource\s+(\w+)\s+'([^']+)@[^']+'([^\n{]*)/gm;

function parseModule(filePath) {
  const src = readFileSync(filePath, "utf8");
  const moduleName = basename(filePath, ".bicep");
  const resources = [];
  const resourceNames = new Set();

  // Verzamel elke resource én de positie van zijn declaratie, zodat we per
  // resource alleen het eigen { ... }-blok op afhankelijkheden kunnen doorzoeken.
  const decls = [];
  let m;
  RESOURCE_RE.lastIndex = 0;
  while ((m = RESOURCE_RE.exec(src)) !== null) {
    resources.push({ symbolicName: m[1], type: m[2].toLowerCase(), isCollection: /\[\s*for\b/.test(m[3]) });
    resourceNames.add(m[1]);
    decls.push({ name: m[1], index: m.index });
  }

  // Geeft het eigen body-blok { ... } van een resource terug via brace-matching,
  // vanaf de declaratiepositie. Voorkomt dat een verwijzing in resource A
  // foutief als afhankelijkheid van resource B wordt geteld.
  function bodyOf(startIndex) {
    const open = src.indexOf("{", startIndex);
    if (open === -1) return "";
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
    }
    return src.slice(open);
  }

  const edges = [];
  for (const decl of decls) {
    const body = bodyOf(decl.index);
    const others = [...resourceNames].filter(n => n !== decl.name);
    if (others.length === 0) continue;
    const names = others.join("|");

    // Twee manieren waarop een resource van een andere afhangt:
    //  1. een verwijzing zoals sqlServer.id — met optionele index, want een
    //     resource uit een [for]-lus spreek je aan als nics[i].id;
    //  2. "parent: sqlServer", de bovenliggende resource van een child.
    const depRes = [
      new RegExp(`\\b(${names})\\s*(?:\\[[^\\]]*\\])?\\.(?:id|name|properties)\\b`, "g"),
      new RegExp(`\\bparent\\s*:\\s*(${names})\\b`, "g"),
    ];

    for (const depRe of depRes) {
      let d;
      while ((d = depRe.exec(body)) !== null) {
        const edge = { sourceId: `${moduleName}::${decl.name}`, targetId: `${moduleName}::${d[1]}` };
        if (!edges.some(e => e.sourceId === edge.sourceId && e.targetId === edge.targetId)) {
          edges.push(edge);
        }
      }
    }
  }

  return { moduleName, resources, edges };
}

let files;
try {
  files = readdirSync(MODULES_DIR, { recursive: true }).filter(f => f.endsWith(".bicep"));
} catch {
  console.error(`\nGeen modules gevonden in ${MODULES_DIR}.`);
  console.error(`Wijs met MODULES_DIR naar de map met .bicep-bestanden, bijvoorbeeld:`);
  console.error(`  MODULES_DIR=/pad/naar/${config.source.repository.split("/").pop()}/${config.source.modulesPath} npm run graph\n`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`\n${MODULES_DIR} bevat geen .bicep-bestanden.\n`);
  process.exit(1);
}

const nodes = [];
const edges = [];

for (const file of files) {
  const { moduleName, resources, edges: moduleEdges } = parseModule(join(MODULES_DIR, file));
  nodes.push({ id: moduleName, type: "<module>", hasChildren: true });
  for (const res of resources) {
    nodes.push({ id: `${moduleName}::${res.symbolicName}`, type: res.type, ...(res.isCollection && { isCollection: true }) });
  }
  edges.push(...moduleEdges);
}

const graph = { nodes, edges };

writeFileSync(OUT_FILE, JSON.stringify(graph, null, 2), "utf8");

console.log(`graph.json geschreven naar ${OUT_FILE} (${nodes.length} nodes, ${edges.length} edges)`);
console.log(`Bekijk het resultaat met "npm run dev", of maak een SVG met "npm run snapshot".`);
