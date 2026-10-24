import { defineConfig } from "vite";

// Base relative : le site marche aussi sous un sous-dossier (GitHub Pages) et dans une app (Capacitor).
export default defineConfig({ base: "./" });
