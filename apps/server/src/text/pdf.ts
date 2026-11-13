// The text of PDFs, page by page, for Claude to read through MCP.
import { readFile, stat } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const cache = new Map<string, { mtime: number; pages: string[] }>();

export async function pdfPages(path: string): Promise<string[]> {
  const { mtimeMs } = await stat(path);
  const known = cache.get(path);
  if (known && known.mtime === mtimeMs) return known.pages;

  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5] as number;
      if (lastY !== null && Math.abs(y - lastY) > 2) text += "\n";
      text += item.str;
      if (item.hasEOL) text += "\n";
      lastY = y;
    }
    pages.push(text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
    page.cleanup();
  }
  await document.destroy();
  if (cache.size > 50) cache.clear();
  cache.set(path, { mtime: mtimeMs, pages });
  return pages;
}

/** Pages `from` to `to` (1-based, inclusive), each headed by its number. */
export async function pdfText(path: string, from = 1, to?: number): Promise<{ text: string; pageCount: number }> {
  const pages = await pdfPages(path);
  const first = Math.max(1, from);
  const last = Math.min(pages.length, to ?? first + 9);
  const text = pages
    .slice(first - 1, last)
    .map((page, i) => `--- Page ${first + i} ---\n${page}`)
    .join("\n\n");
  return { text, pageCount: pages.length };
}
