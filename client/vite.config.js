import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta fixa facilita integracao com backend local e docker compose.
    port: 5173
  }
});
