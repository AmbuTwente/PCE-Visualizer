#!/usr/bin/env node
// Copyright (C) 2026 Sten Tijhuis
// SPDX-License-Identifier: MIT

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, basename } from "path";

const MODULES_DIR = new URL("../../modules", import.meta.url).pathname;
const PUBLIC_DIR = new URL("../public", import.meta.url).pathname;
const OUT_FILE = join(PUBLIC_DIR, "graph.json");
const URL_FILE = join(PUBLIC_DIR, "graph-url.txt");

mkdirSync(PUBLIC_DIR, { recursive: true });

const RESOURCE_RE = /^resource\s+(\w+)\s+'([^']+)@[^']+'/gm;

function parseModule(filePath) {
  const src = readFileSync(filePath, "utf8");
  const moduleName = basename(filePath, ".bicep");
  const resources = [];
  const resourceNames = new Set();

  let m;
  while ((m = RESOURCE_RE.exec(src)) !== null) {
    resources.push({ symbolicName: m[1], type: m[2].toLowerCase() });
    resourceNames.add(m[1]);
  }

  const edges = [];
  for (const res of resources) {
    const others = [...resourceNames].filter(n => n !== res.symbolicName);
    if (others.length === 0) continue;
    const depRe = new RegExp(`\\b(${others.join("|")})\\.(id|name|properties)\\b`, "g");
    let d;
    while ((d = depRe.exec(src)) !== null) {
      const edge = { sourceId: `${moduleName}::${res.symbolicName}`, targetId: `${moduleName}::${d[1]}` };
      if (!edges.some(e => e.sourceId === edge.sourceId && e.targetId === edge.targetId)) {
        edges.push(edge);
      }
    }
  }

  return { moduleName, resources, edges };
}

const files = readdirSync(MODULES_DIR).filter(f => f.endsWith(".bicep"));

const nodes = [];
const edges = [];

for (const file of files) {
  const { moduleName, resources, edges: moduleEdges } = parseModule(join(MODULES_DIR, file));
  nodes.push({ id: moduleName, type: "<module>", hasChildren: true });
  for (const res of resources) {
    nodes.push({ id: `${moduleName}::${res.symbolicName}`, type: res.type });
  }
  edges.push(...moduleEdges);
}

const graph = { nodes, edges };

writeFileSync(OUT_FILE, JSON.stringify(graph, null, 2), "utf8");

const base64 = Buffer.from(JSON.stringify(graph)).toString("base64");
const url = `https://pce-poc.b-cdn.net/bicep-visualizer/?graph=${base64}`;

writeFileSync(URL_FILE, url, "utf8");

console.log(`graph.json geschreven naar ${OUT_FILE}`);
console.log(`Visualizer URL: ${url}`);
