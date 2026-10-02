/**
 * Turning any PDF — a novel, a textbook, a paper — into a book the Random
 * Access Lab can write into DNA. Everything happens in the browser with
 * pdf.js; the file never leaves the page.
 *
 * Chapters come from the best source available:
 *   1. the PDF's own bookmarks (its outline), which most textbooks and ebooks
 *      have, giving exact chapter boundaries and titles;
 *   2. "Chapter N" headings in the text, as for a plain-text book;
 *   3. otherwise, ranges of pages.
 */

import { Book, Chapter, fitBook, splitChapters } from "./archive";
import { loadPdfjs } from "./pdfjs";

export class PdfBookError extends Error {}

/**
 * PDF text comes out with the marks of typesetting still on it: ligature
 * characters, words hyphenated across lines, page numbers on lines of their
 * own. Undo the ones that can be undone safely.
 */
function clean(text: string) {
  return text
    .replace(/ﬀ/g, "ff")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl")
    .replace(/\u00AD/g, "") // soft hyphens
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/^ ?\d{1,4} ?$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface OutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineItem[];
}

export async function bookFromPdf(
  file: File,
  onProgress?: (page: number, pages: number) => void,
): Promise<Book> {
  const lib = await loadPdfjs();
  let doc;
  try {
    doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    throw new PdfBookError(
      name === "PasswordException"
        ? "This PDF is password-protected, so its text cannot be read."
        : "This file could not be opened as a PDF.",
    );
  }

  try {
    const pages = doc.numPages;
    const pageTexts: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let raw = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        raw += item.str;
        if (item.hasEOL) raw += "\n";
      }
      pageTexts.push(clean(raw));
      page.cleanup();
      onProgress?.(i, pages);
    }

    const all = pageTexts.join("\n\n");
    if (all.replace(/\s/g, "").length < 200) {
      throw new PdfBookError(
        "This PDF has no text in it — it is probably a scan, which is just pictures of pages. Try a PDF where you can select the text.",
      );
    }

    // ---- 1. the PDF's own bookmarks --------------------------------------
    let chapters: Chapter[] = [];
    try {
      let outline = ((await doc.getOutline()) ?? []) as OutlineItem[];
      // a single top-level entry (often the book's title) wrapping the chapters
      if (outline.length === 1 && (outline[0].items?.length ?? 0) >= 2) outline = outline[0].items!;
      const starts: { title: string; page: number }[] = [];
      for (const item of outline) {
        try {
          const dest =
            typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
          if (!Array.isArray(dest) || dest[0] === undefined) continue;
          const ref = dest[0];
          const page =
            typeof ref === "number"
              ? ref
              : await doc.getPageIndex(ref as Parameters<typeof doc.getPageIndex>[0]);
          if (page >= 0 && page < pages) starts.push({ title: item.title.trim(), page });
        } catch {
          /* a bookmark that points nowhere is skipped */
        }
      }
      starts.sort((a, b) => a.page - b.page);
      const unique = starts.filter((s, i) => i === 0 || s.page !== starts[i - 1].page);
      if (unique.length >= 2) {
        // anything before the first bookmark — cover, contents — is kept if it is substantial
        const front = pageTexts.slice(0, unique[0].page).join("\n\n");
        if (front.length > 600) chapters.push({ number: "0", title: "Front matter", text: front });
        unique.forEach((s, k) => {
          const text = pageTexts
            .slice(s.page, unique[k + 1]?.page ?? pages)
            .join("\n\n")
            .trim();
          if (text)
            chapters.push({
              number: String(k + 1),
              title: s.title.slice(0, 80) || `Section ${k + 1}`,
              text,
            });
        });
      }
    } catch {
      chapters = [];
    }

    // ---- 2. "Chapter N" headings -------------------------------------------
    if (chapters.length < 2) {
      const found = splitChapters(all);
      if (!found[0]?.title.startsWith("Part ")) chapters = found;
    }

    // ---- 3. ranges of pages ---------------------------------------------------
    if (chapters.length < 2) {
      // about three pages a section, so even a short document has a few to choose from
      const parts = Math.max(2, Math.min(12, Math.ceil(pages / 3)));
      const per = Math.ceil(pages / parts);
      chapters = [];
      for (let k = 0; k < parts; k++) {
        const from = k * per;
        const to = Math.min(pages, from + per);
        if (from >= to) break;
        const text = pageTexts.slice(from, to).join("\n\n").trim();
        if (text)
          chapters.push({
            number: String(k + 1),
            title: from + 1 === to ? `Page ${to}` : `Pages ${from + 1}–${to}`,
            text,
          });
      }
    }

    let title = file.name.replace(/\.pdf$/i, "");
    let author = "your PDF";
    try {
      const meta = await doc.getMetadata();
      const info = meta.info as { Title?: string; Author?: string };
      if (info?.Title?.trim()) title = info.Title.trim();
      if (info?.Author?.trim()) author = info.Author.trim();
    } catch {
      /* no metadata: keep the file name */
    }

    return fitBook({
      id: "upload-pdf",
      title,
      author,
      source: `uploaded PDF · ${pages} page${pages === 1 ? "" : "s"}`,
      chapters,
    });
  } finally {
    doc.destroy();
  }
}
