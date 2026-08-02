import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import visualizerConfig from "./visualizer.config.json" with { type: "json" };

// https://vite.dev/config/
export default defineConfig({
  // base bepaalt onder welk pad de gebouwde site draait. Op GitHub Pages is dat
  // "/<repository-naam>/" en niet "/", dus staat het in visualizer.config.json.
  base: visualizerConfig.site.basePath || "/",
  plugins: [
    react(),
    {
      // De paginatitel hoort bij het project en niet in de HTML: zo hoeft wie
      // deze repository als template gebruikt alleen de config aan te passen.
      name: "titel-uit-config",
      transformIndexHtml: (html) => html.replace(/<title>.*?<\/title>/, `<title>${visualizerConfig.title}</title>`),
    },
  ],
});
