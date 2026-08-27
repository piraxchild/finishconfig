import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites from /<repo-name>/ — set BASE_PATH in the
// workflow (done automatically below) or change the fallback to your repo name.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "/finish-configurator/",
});
