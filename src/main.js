// Proof of Concept-code voor het Cloud Engineering-project.
import { createVisualizer } from "./lib";

// Fallback-graaf wanneer er geen ?graph= parameter is en graph.json (nog) niet
// beschikbaar is. Voorkomt een lege pagina bij een eerste/koude deploy.
const DEMO_GRAPH = {
  nodes: [
    { id: "backend", type: "<module>", hasChildren: true },
    { id: "backend::azureIdentity", type: "microsoft.managedidentity/identities" },
    { id: "backend::azureCosmoDB", type: "microsoft.sql/servers/databases" },
    { id: "frontend", type: "<module>", hasChildren: true },
    { id: "frontend::webApp", type: "microsoft.app/containerapps" },
    { id: "frontend::azureCDN", type: "microsoft.cdn/service" },
  ],
  edges: [
    { sourceId: "backend::azureCosmoDB", targetId: "backend::azureIdentity" },
    { sourceId: "frontend::azureCDN", targetId: "frontend::webApp" },
    { sourceId: "frontend", targetId: "backend" },
  ],
};

function loadInitialGraph() {
  // 1. Expliciete graaf via ?graph=<base64> (gebruikt o.a. in PR-comments).
  try {
    const param = new URLSearchParams(window.location.search).get("graph");
    if (param) {
      return Promise.resolve(JSON.parse(atob(param)));
    }
  } catch (e) {
    console.warn("[bicep-visualizer] Kon ?graph= parameter niet laden:", e);
  }

  // 2. De graph.json die de CI genereert uit de Bicep-modules.
  return fetch("./graph.json")
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error("graph.json niet beschikbaar");
    })
    .catch((e) => {
      console.warn("[bicep-visualizer] Kon graph.json niet laden, val terug op demo:", e);
      return DEMO_GRAPH;
    });
}

loadInitialGraph().then((initialGraph) => {
  createVisualizer(document.getElementById("root"), initialGraph);
});
