import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	base: "/",
	plugins: [react()],
	preview: {
		port: 8081,
		host: "0.0.0.0",
		strictPort: true,
	},
	server: {
		port: 3000,
		host: "0.0.0.0",
		strictPort: true,
	},
	css: {
		postcss: {
			plugins: [tailwindcss()],
		},
	},
});
