"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Rows3,
  GalleryHorizontal,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cx } from "@/components/ui";
import { loadPdfjs } from "@/lib/pdfjs";

/**
 * A PDF viewer that works on a phone. Browsers' built-in PDF embedding is
 * unreliable on mobile — iOS Safari shows only the first page of an iframe —
 * so every page is drawn onto a canvas with pdf.js instead, and only when it
 * scrolls into view.
 *
 * Two layouts: slides (one page at a time, swipe or arrow keys — for the
 * deck) and scroll (a continuous column — for papers).
 */

type Mode = "slides" | "scroll";

/* -------------------------------------------------------------------------- */

function PageCanvas({
  doc,
  n,
  width,
  ratio,
  eager,
  onVisible,
}: {
  doc: PDFDocumentProxy;
  n: number;
  /** CSS pixels */
  width: number;
  /** height / width of this page */
  ratio: number;
  eager?: boolean;
  onVisible?: (n: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inView, setInView] = useState(Boolean(eager));
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
        if (e.intersectionRatio > 0.5) onVisible?.(n);
      },
      { rootMargin: "600px 0px", threshold: [0, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n, onVisible]);

  useEffect(() => {
    if (!inView || width < 10) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const t = page.render({ canvasContext: ctx, viewport });
      task = t;
      try {
        await t.promise;
        if (!cancelled) setDrawn(true);
      } catch {
        /* cancelled by a resize or a page change */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, n, width, inView]);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto overflow-hidden rounded-md bg-white shadow-[0_10px_40px_-18px_rgba(0,0,0,0.45)]"
      style={{ width, height: width * ratio }}
    >
      {!drawn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="mono text-[11px] text-ink-3">page {n}</span>
        </div>
      )}
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function PdfViewer({
  src,
  title,
  initialMode = "scroll",
  height = 640,
}: {
  src: string;
  title: string;
  initialMode?: Mode;
  /** height of the viewer in the page (it fills the screen in full screen) */
  height?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratios, setRatios] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [stageW, setStageW] = useState(0);
  const [full, setFull] = useState(false);

  /* ---- load ------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const lib = await loadPdfjs();
        const task = lib.getDocument({ url: src });
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (p.total) setProgress(p.loaded / p.total);
        };
        const d = await task.promise;
        loaded = d;
        if (cancelled) return d.destroy();
        // page shapes up front, so the layout never jumps as pages draw
        const rs: number[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const p = await d.getPage(i);
          const v = p.getViewport({ scale: 1 });
          rs.push(v.height / v.width);
        }
        if (cancelled) return;
        setRatios(rs);
        setDoc(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not open this PDF.");
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [src]);

  /* ---- size --------------------------------------------------------------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /* ---- full screen -------------------------------------------------------- */
  const toggleFull = useCallback(() => {
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      setFull(false);
    } else {
      // iPhones do not support element full screen; the fixed overlay covers it
      rootRef.current?.requestFullscreen?.().catch(() => {});
      setFull(true);
    }
  }, [full]);
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!full) return;
    const body = document.body.style;
    const prev = body.overflow;
    body.overflow = "hidden";
    return () => {
      body.overflow = prev;
    };
  }, [full]);

  const count = doc?.numPages ?? 0;

  /* ---- slides: keys and swipes ------------------------------------------- */
  const go = useCallback(
    (p: number) => setPage(() => Math.max(1, Math.min(count || 1, p))),
    [count],
  );
  useEffect(() => {
    if (mode !== "slides") return;
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      // only when this viewer is on screen, so two viewers do not both turn
      const r = rootRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
      if (e.key === "Escape" && full) toggleFull();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mode, page, go, full, toggleFull]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t || mode !== "slides" || zoom > 1) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) go(page + (dx < 0 ? 1 : -1));
  };

  const onVisible = useCallback((n: number) => setPage(n), []);

  /* ---- layout -------------------------------------------------------------- */
  const pad = stageW < 500 ? 8 : 24;
  const fitW = Math.max(100, stageW - pad * 2);
  const slideRatio = ratios[page - 1] ?? 0.5625;
  // in slides, fit the page inside the stage both ways
  const stageH = full
    ? typeof window !== "undefined"
      ? window.innerHeight - 112
      : height
    : height - 100;
  const slideW = Math.min(fitW, (stageH - pad * 2) / slideRatio) * zoom;
  const scrollW = Math.min(fitW, 980) * zoom;

  return (
    <div
      ref={rootRef}
      className={cx(
        "flex flex-col overflow-hidden bg-[#1b2230] text-slate-200",
        full ? "fixed inset-0 z-[70] h-[100dvh] w-screen" : "rounded-2xl border border-[#2a3444]",
      )}
      style={full ? undefined : { height }}
    >
      {/* ---- toolbar ---------------------------------------------------------- */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#141a25] px-3 py-2">
        <span className="mr-auto min-w-0 truncate text-[12.5px] font-semibold text-slate-100">
          {title}
        </span>
        <div className="flex items-center rounded-lg border border-white/10 p-0.5">
          <button
            onClick={() => setMode("slides")}
            title="One page at a time"
            className={cx(
              "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px]",
              mode === "slides" ? "bg-white/15 text-white" : "text-slate-400",
            )}
          >
            <GalleryHorizontal size={13} /> <span className="hidden sm:inline">Slides</span>
          </button>
          <button
            onClick={() => setMode("scroll")}
            title="All pages in a column"
            className={cx(
              "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px]",
              mode === "scroll" ? "bg-white/15 text-white" : "text-slate-400",
            )}
          >
            <Rows3 size={13} /> <span className="hidden sm:inline">Scroll</span>
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-white/10">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="cursor-pointer p-1.5 text-slate-300 hover:text-white"
            aria-label="Zoom out"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="mono w-11 cursor-pointer text-center text-[10.5px] text-slate-300"
            title="Fit"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="cursor-pointer p-1.5 text-slate-300 hover:text-white"
            aria-label="Zoom in"
          >
            <Plus size={13} />
          </button>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener"
          download
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 hover:text-white"
          title="Download the PDF"
        >
          <Download size={13} />
          <span className="hidden sm:inline">PDF</span>
        </a>
        <button
          onClick={toggleFull}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 hover:text-white"
          title={full ? "Exit full screen" : "Full screen"}
        >
          {full ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* ---- pages ----------------------------------------------------------- */}
      <div
        ref={stageRef}
        className={cx(
          "relative min-h-0 flex-1",
          mode === "scroll" || zoom > 1 ? "overflow-auto" : "overflow-hidden",
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ padding: pad }}
      >
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-[13px] text-rose-300">This PDF would not open here.</span>
            <a
              href={src}
              target="_blank"
              rel="noopener"
              className="text-[12.5px] text-teal-300 underline"
            >
              Open it directly
            </a>
          </div>
        ) : !doc ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <span className="mono text-[11px] text-slate-400">
              loading {progress > 0 ? `${Math.round(progress * 100)}%` : "…"}
            </span>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-teal-400 transition-[width]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        ) : mode === "slides" ? (
          <div className="flex min-h-full items-center justify-center">
            <PageCanvas
              key={`s-${page}-${Math.round(slideW)}`}
              doc={doc}
              n={page}
              width={slideW}
              ratio={slideRatio}
              eager
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {ratios.map((r, i) => (
              <PageCanvas
                key={`p-${i}-${Math.round(scrollW)}`}
                doc={doc}
                n={i + 1}
                width={scrollW}
                ratio={r}
                onVisible={onVisible}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- page bar ---------------------------------------------------------- */}
      {doc && mode === "slides" && (
        <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#141a25] px-3 py-2">
          <button
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            className="cursor-pointer rounded-lg border border-white/10 p-1.5 text-slate-200 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="range"
            min={1}
            max={count}
            value={page}
            onChange={(e) => go(Number(e.target.value))}
            className="flex-1"
            style={{ color: "#2dd4bf" }}
            aria-label="Page"
          />
          <span className="mono w-[64px] text-center text-[11px] text-slate-300">
            {page} / {count}
          </span>
          <button
            onClick={() => go(page + 1)}
            disabled={page >= count}
            className="cursor-pointer rounded-lg bg-teal-500 p-1.5 text-white disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {doc && mode === "scroll" && (
        <div className="mono shrink-0 border-t border-white/10 bg-[#141a25] px-3 py-1.5 text-center text-[11px] text-slate-400">
          page {page} of {count}
        </div>
      )}
    </div>
  );
}
