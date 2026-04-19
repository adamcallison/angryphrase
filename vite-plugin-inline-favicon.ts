import { readFileSync, unlinkSync } from "fs";
import { resolve, join } from "path";
import type { Plugin } from "vite";

/**
 * Vite plugin that inlines the favicon as a data URI in index.html
 * so the built output is a single self-contained HTML file.
 *
 * Reads the favicon file at build time, base64-encodes it,
 * and replaces the <link rel="icon"> href with a data URI.
 * Also removes the copied favicon from the output directory
 * since it's no longer needed as a separate file.
 */
export function inlineFavicon(): Plugin {
  return {
    name: "inline-favicon",
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        const faviconPath = resolve(process.cwd(), "public/favicon.png");
        const faviconBuffer = readFileSync(faviconPath);
        const base64 = faviconBuffer.toString("base64");
        const dataUri = `data:image/png;base64,${base64}`;

        return html.replace(
          /<link\s+[^>]*rel="icon"[^>]*>/,
          `<link rel="icon" type="image/png" href="${dataUri}" />`,
        );
      },
    },
    closeBundle() {
      const distFavicon = resolve(process.cwd(), "dist/favicon.png");
      try {
        unlinkSync(distFavicon);
      } catch {
        // File may not exist if already removed or build failed
      }
    },
  };
}