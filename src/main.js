import "https://esm.sh/gh/aipx-proto/wc-agent-hook@v1.2.0?bundle-deps";
import { createVisualizer } from "./lib";

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
  try {
    const param = new URLSearchParams(window.location.search).get("graph");
    if (param) {
      return Promise.resolve(JSON.parse(atob(param)));
    }
  } catch (e) {
    console.warn("[bicep-visualizer] Kon ?graph= parameter niet laden:", e);
  }

  return fetch("./graph.json")
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error("graph.json niet beschikbaar");
    })
    .catch((e) => {
      console.warn("[bicep-visualizer] Kon graph.json niet laden:", e);
      return DEMO_GRAPH;
    });
}

loadInitialGraph().then((initialGraph) => {
  const { update, getGraph } = createVisualizer(document.getElementById("root"), initialGraph);

  function toStandardNode(node) {
    return {
      id: node.id,
      type: node.type === "group" ? "<module>" : node.type,
      hasChildren: node.type === "group",
    };
  }

  agent.getTools = () => {
    const patchGraphTool = {
      name: "updateGraph",
      description: "Change the nodes and edges of the graph. When you remove a group, its children will be removed as well.",
      parameters: z.object({
        addNodes: z.array(z.object({ id: z.string(), type: z.string(), hasChildren: z.boolean().optional() })),
        addEdges: z.array(z.object({ sourceId: z.string(), targetId: z.string() })),
        removeNodes: z.array(z.string()).describe("The full id of the node to remove, including the group prefix if applicable"),
        removeEdges: z.array(z.object({ sourceId: z.string(), targetId: z.string() })),
      }),
      run: ({ addNodes, addEdges, removeNodes, removeEdges }) => {
        const currentGraph = getGraph();
        const remainingNodes = currentGraph.nodes.filter(
          (node) => !removeNodes.includes(node.id) && !removeNodes.some((rn) => node.id.startsWith(rn))
        );
        const remainingEdges = currentGraph.edges.filter(
          (edge) => !removeEdges.some((re) => edge.sourceId === re.sourceId && edge.targetId === re.targetId)
        );
        const patched = {
          nodes: [...remainingNodes, ...addNodes.map(toStandardNode)],
          edges: [...remainingEdges, ...addEdges],
        };
        const emptyGroups = patched.nodes.filter(
          (node) => node.hasChildren && !patched.nodes.some((n) => n.id.startsWith(node.id) && n.id !== node.id)
        );
        const nonEmptyNodes = patched.nodes.filter((node) => !emptyGroups.includes(node));
        const attachedEdges = patched.edges.filter(
          (edge) => nonEmptyNodes.some((n) => n.id === edge.sourceId) && nonEmptyNodes.some((n) => n.id === edge.targetId)
        );
        update({ nodes: nonEmptyNodes, edges: attachedEdges });
        return `Graph updated`;
      },
    };

    const generateNewGraphTool = {
      name: "generateNewGraph",
      description: "Generate a new graph",
      parameters: z.object({
        nodes: z.array(z.object({ id: z.string(), type: z.string(), hasChildren: z.boolean().optional() })),
        edges: z.array(z.object({ sourceId: z.string(), targetId: z.string() })),
      }),
      run: ({ nodes, edges }) => {
        update({ nodes: nodes.map(toStandardNode), edges });
        return `Graph created`;
      },
    };

    return [patchGraphTool, generateNewGraphTool];
  };

  agent.getState = () => {
    const rawGraph = getGraph();
    const simplifiedGraph = {
      nodes: rawGraph.nodes.map((node) => ({
        id: node.id,
        type: node.hasChildren || node.type === "<module>" ? "group" : node.type,
      })),
      edges: rawGraph.edges,
    };
    return `The current graph looks like this:\n${JSON.stringify(simplifiedGraph, null, 2)}`;
  };
});
