// Leest visualizer.config.json en controleert of de velden ingevuld zijn.
//
// Alles wat per project verschilt staat in dat ene bestand, zodat iemand die
// deze repository als template gebruikt niet door de scripts hoeft te spitten
// om zijn eigen repo en site-URL erin te krijgen.

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONFIG_FILE = join(ROOT, "visualizer.config.json");

function fail(message) {
  console.error(`\nvisualizer.config.json: ${message}\n`);
  console.error(`Zie het kopje "Zelf gebruiken als template" in README.md.\n`);
  process.exit(1);
}

function loadConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG_FILE, "utf8");
  } catch {
    fail(`niet gevonden op ${CONFIG_FILE}`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    fail(`bevat geen geldige JSON (${e.message})`);
  }

  // Alleen de velden waar een script echt op stukloopt worden hier afgedwongen.
  // site.url mag leeg blijven: dat betekent simpelweg "er is geen live site",
  // wat voor een gearchiveerd project de normale situatie is.
  const required = [
    ["title", config.title],
    ["source.repository", config.source?.repository],
    ["source.modulesPath", config.source?.modulesPath],
  ];

  for (const [key, value] of required) {
    if (typeof value !== "string" || value.trim() === "") {
      fail(`"${key}" is nog niet ingevuld.`);
    }
    if (/VUL|INVULLEN|TODO|<.*>/i.test(value)) {
      fail(`"${key}" staat nog op de placeholder "${value}".`);
    }
  }

  return {
    title: config.title,
    source: {
      repository: config.source.repository,
      modulesPath: config.source.modulesPath,
    },
    site: {
      url: config.site?.url ?? "",
      basePath: config.site?.basePath || "/",
    },
    footer: {
      label: config.footer?.label ?? config.title,
      url: config.footer?.url ?? "",
    },
    snapshotDate: config.snapshotDate ?? "",
  };
}

export const config = loadConfig();
