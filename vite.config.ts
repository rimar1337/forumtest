import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { generateMetadataPlugin } from "./oauthdev.mts";

const prodURL = "https://forumtest.whey.party"
const devURL = "https://local3768forumtest.whey.party"

function shp(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    generateMetadataPlugin({
      prod: prodURL,
      dev: devURL,
    }),
    tailwindcss(),
    tanstackRouter({ autoCodeSplitting: true }),
    viteReact(),
  ],
  // test: {
  //   globals: true,
  //   environment: 'jsdom',
  // },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: [shp(prodURL),shp(devURL)],
  },
});
