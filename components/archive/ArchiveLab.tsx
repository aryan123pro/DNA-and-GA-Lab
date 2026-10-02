"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Dna,
  FlaskConical,
  Play,
  RotateCcw,
  ScanLine,
  Upload,
  Wand2,
} from "lucide-react";
import {
  Archive,
  Book,
  Decoded,
  OLIGO_LEN,
  PRIMER_LEN,
  SEG,
  bookFromText,
  decode,
  gcFraction,
  pcr,
  sequence,
  synthesise,
  writeArchive,
} from "@/lib/archive";
import { cx } from "@/components/ui";

const ACCENT = "#7c3aed";
const BASE_HEX: Record<string, string> = { A: "#2563eb", C: "#ea580c", G: "#16a34a", T: "#9333ea" };

/** one colour per chapter, spread round the wheel */
function chapterColor(i: number, n: number, light = 55) {
  return `hsl(${Math.round((i / Math.max(1, n)) * 330 + 260) % 360} 70% ${light}%)`;
}

const SEGMENTS: { key: keyof typeof SEG; label: string; color: string; hint: string }[] = [
  { key: "fwd", label: "Forward primer", color: "#7c3aed", hint: "20 nt · the chapter's own key" },
  { key: "addr", label: "Address", color: "#0891b2", hint: "12 nt · which chapter, which piece" },
  { key: "payload", label: "Payload", color: "#64748b", hint: "80 nt · 20 bytes of the book" },
  { key: "check", label: "Checksum", color: "#d97706", hint: "4 nt · catches a wrong piece" },
  {
    key: "rev",
    label: "Reverse primer",
    color: "#db2777",
    hint: "20 nt · the other half of the key",
  },
];

/* -------------------------------------------------------------------------- */
/* the tube                                                                   */
/* -------------------------------------------------------------------------- */

interface Speck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ch: number;
  born: number;
}

/**
 * A few thousand specks standing in for the strands in the tube, coloured by
 * chapter. The mix follows the real simulation: as PCR runs, specks of the
 * wanted chapter split and take over the tube.
 */
function Tube({
  n,
  share,
  target,
  phase,
  run,
}: {
  n: number;
  /** changes whenever a run is reset, so the tube goes back to a fresh mix */
  run: number;
  /** fraction of the tube that is the target chapter */
  share: number;
  target: number | null;
  phase: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const specks = useRef<Speck[]>([]);
  const want = useRef({ share, target, n });
  useEffect(() => {
    want.current = { share, target, n };
  }, [share, target, n]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const COUNT = 1400;
    const size = { w: 0, h: 0, dpr: 1 };
    const resize = () => {
      size.dpr = Math.min(2, window.devicePixelRatio || 1);
      size.w = canvas.clientWidth;
      size.h = canvas.clientHeight;
      canvas.width = size.w * size.dpr;
      canvas.height = size.h * size.dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { w, h, dpr } = size;
      const { share: s, target: t, n: chapters } = want.current;
      // keep the population in step with the simulation
      const list = specks.current;
      while (list.length < COUNT && chapters > 0) {
        list.push({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.0006,
          vy: (Math.random() - 0.5) * 0.0006,
          ch: Math.floor(Math.random() * chapters),
          born: now - 2000,
        });
      }
      if (t !== null) {
        const mine = list.filter((p) => p.ch === t);
        const others = list.filter((p) => p.ch !== t);
        const need = Math.round(s * COUNT);
        // each new copy is born beside a random strand of the chapter, like a real
        // PCR product, and displaces a strand of some other chapter
        for (let k = mine.length; k < need && others.length; k++) {
          const parent = mine[Math.floor(Math.random() * mine.length)];
          const victim = others.splice(Math.floor(Math.random() * others.length), 1)[0];
          victim.ch = t;
          victim.born = now;
          if (parent) {
            victim.x = Math.min(1, Math.max(0, parent.x + (Math.random() - 0.5) * 0.05));
            victim.y = Math.min(1, Math.max(0, parent.y + (Math.random() - 0.5) * 0.05));
          }
          mine.push(victim);
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // the liquid
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1e1b4b");
      g.addColorStop(1, "#0b0a1f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const p of list) {
        if (!reduced) {
          p.vx += (Math.random() - 0.5) * 0.00008;
          p.vy += (Math.random() - 0.5) * 0.00008;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > 1) p.vx *= -1;
          if (p.y < 0 || p.y > 1) p.vy *= -1;
          p.x = Math.min(1, Math.max(0, p.x));
          p.y = Math.min(1, Math.max(0, p.y));
        }
        const on = t === null || p.ch === t;
        const fresh = Math.max(0, 1 - (now - p.born) / 600);
        ctx.globalAlpha = on ? 0.9 : 0.25;
        ctx.strokeStyle = chapterColor(p.ch, chapters, on && t !== null ? 65 : 55);
        ctx.lineWidth = on && t !== null ? 1.8 : 1.2;
        const x = p.x * w;
        const y = p.y * h;
        const a = Math.atan2(p.vy, p.vx);
        const len = 5 + fresh * 6;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
        if (fresh > 0) {
          ctx.globalAlpha = fresh * 0.8;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x, y, 2 + fresh * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // a new book, or a new run, means a fresh mix
  useEffect(() => {
    specks.current = [];
  }, [n, run]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <canvas ref={ref} className="block h-full w-full" />
      <div className="mono pointer-events-none absolute top-3 left-3 rounded-md bg-black/40 px-2 py-1 text-[10px] tracking-[0.14em] text-violet-200 uppercase backdrop-blur">
        {phase}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* one strand, segment by segment                                             */
/* -------------------------------------------------------------------------- */

function Strand({ seq, compact = false }: { seq: string; compact?: boolean }) {
  return (
    <div className={cx("mono flex flex-wrap leading-none", compact ? "gap-0" : "gap-y-1")}>
      {SEGMENTS.map((s) => {
        const [a, b] = SEG[s.key];
        return (
          <span
            key={s.key}
            className="rounded-[3px] px-[2px] py-[3px]"
            style={{ background: `${s.color}1f`, boxShadow: `inset 0 -2px 0 ${s.color}` }}
            title={`${s.label} — ${s.hint}`}
          >
            {seq
              .slice(a, b)
              .split("")
              .map((c, i) => (
                <span
                  key={i}
                  className={compact ? "text-[9px]" : "text-[10.5px]"}
                  style={{ color: BASE_HEX[c] }}
                >
                  {c}
                </span>
              ))}
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type Phase = "idle" | "primers" | "pcr" | "sequencing" | "decoding" | "done";

const PHASES: { id: Phase; label: string; icon: typeof Dna }[] = [
  { id: "primers", label: "Add primers", icon: FlaskConical },
  { id: "pcr", label: "PCR", icon: Dna },
  { id: "sequencing", label: "Sequence", icon: ScanLine },
  { id: "decoding", label: "Decode", icon: Wand2 },
];

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="mono text-[9.5px] tracking-[0.14em] text-ink-3 uppercase">{label}</div>
      <div className="font-display mt-0.5 text-[20px] leading-tight font-semibold text-ink">
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

export default function ArchiveLab() {
  const [book, setBook] = useState<Book | null>(null);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState(0); // fraction, for the write animation
  const [pick, setPick] = useState<number>(6);
  const [cycles, setCycles] = useState(18);
  const [depth, setDepth] = useState(15);
  const [errorRate, setErrorRate] = useState(0.5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [share, setShare] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [reads, setReads] = useState<{ seq: string; errors: number[] }[]>([]);
  const [readCount, setReadCount] = useState(0);
  const [result, setResult] = useState<Decoded | null>(null);
  const [inspect, setInspect] = useState(1);
  const [runKey, setRunKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* ---- the book ------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    fetch("/books/alice.json")
      .then((r) => r.json())
      .then((b: Book) => {
        if (!cancelled) setBook(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const resetRun = useCallback(() => {
    clearTimers();
    setRunKey((k) => k + 1);
    setPhase("idle");
    setShare(0);
    setHistory([]);
    setReads([]);
    setReadCount(0);
    setResult(null);
  }, []);

  const loadBook = useCallback(
    (b: Book) => {
      resetRun();
      setBook(b);
      setArchive(null);
      setWritten(0);
      setPick(Math.min(6, b.chapters.length - 1));
      setInspect(1);
    },
    [resetRun],
  );

  const onUpload = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    loadBook(bookFromText(f.name, text));
  };

  /* ---- write the whole book into DNA ---------------------------------------- */
  const write = useCallback(() => {
    if (!book) return;
    resetRun();
    setWriting(true);
    setWritten(0);
    // the encoding itself takes a moment; let the progress bar paint first
    setTimeout(() => {
      const a = writeArchive(book);
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        timers.current.push(
          setTimeout(() => {
            setWritten(i / steps);
            if (i === steps) {
              setArchive(a);
              setWriting(false);
            }
          }, i * 45),
        );
      }
    }, 30);
  }, [book, resetRun]);

  const pool = useMemo(() => (archive ? synthesise(archive) : null), [archive]);

  /* ---- random access ---------------------------------------------------------- */
  const run = useCallback(() => {
    if (!archive || !pool) return;
    resetRun();
    const file = Math.min(pick, archive.files.length - 1);
    const p = pcr(archive, pool, file, cycles);
    const total = Math.max(1, Math.round(archive.files[file].count * depth));
    const allReads = sequence(archive, p.abundance, total, errorRate / 100, 31 + file);
    const decoded = decode(archive, file, allReads);

    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    setPhase("primers");
    setShare(p.history[0]);
    let t = 1100;
    at(t, () => setPhase("pcr"));
    p.history.forEach((s, i) =>
      at(t + i * 140, () => {
        setShare(s);
        setHistory(p.history.slice(0, i + 1));
      }),
    );
    t += p.history.length * 140 + 300;
    at(t, () => setPhase("sequencing"));
    const show = 14;
    for (let k = 0; k <= 20; k++)
      at(t + k * 70, () => {
        setReadCount(Math.round((k / 20) * total));
        setReads(
          allReads.slice(Math.max(0, (k / 20) * total - show), (k / 20) * total).slice(-show),
        );
      });
    t += 21 * 70 + 300;
    at(t, () => setPhase("decoding"));
    at(t + 700, () => {
      setResult(decoded);
      setPhase("done");
    });
  }, [archive, pool, pick, cycles, depth, errorRate, resetRun]);

  /* ---- numbers ------------------------------------------------------------------ */
  const totalChars = book ? book.chapters.reduce((s, c) => s + c.text.length, 0) : 0;
  const strands = archive?.oligos.length ?? 0;
  // one nucleotide ≈ 330 Da; ten physical copies of every strand
  const femtograms = (strands * OLIGO_LEN * 330 * 1.6605e-24 * 10) / 1e-15;
  const file = archive?.files[Math.min(pick, (archive?.files.length ?? 1) - 1)];
  const readsTotal = file ? Math.round(file.count * depth) : 0;
  const wholeTube = archive ? archive.oligos.length * depth : 0;
  const sampleStrand =
    archive && file ? archive.oligos[file.start + Math.min(inspect, file.count - 1)] : null;
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);
  const n = book?.chapters.length ?? 0;

  return (
    <div className="space-y-8">
      {/* ======================================================= the book ===== */}
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="eyebrow" style={{ color: ACCENT }}>
              <BookOpen size={12} className="mr-1 inline" /> 1 · The book
            </span>
            <h2 className="mt-1 text-[24px] leading-tight font-semibold text-ink sm:text-[28px]">
              {book ? book.title : "Loading the book…"}
            </h2>
            {book && (
              <p className="mt-1 text-[13.5px] text-ink-2">
                {book.author}
                {book.year ? `, ${book.year}` : ""} ·{" "}
                {book.url ? (
                  <a
                    href={book.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline"
                  >
                    {book.source}
                  </a>
                ) : (
                  book.source
                )}{" "}
                · {n} chapters · {fmt(totalChars)} characters
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 hover:bg-sunken"
            >
              <Upload size={14} /> Use your own .txt
            </button>
            {book?.id === "upload" && (
              <button
                onClick={() =>
                  fetch("/books/alice.json")
                    .then((r) => r.json())
                    .then(loadBook)
                }
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] text-ink-3 hover:bg-sunken"
              >
                <RotateCcw size={14} /> Back to Alice
              </button>
            )}
          </div>
        </div>

        {book && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {book.chapters.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-paper px-3 py-2"
              >
                <span
                  className="mono flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[10.5px] font-bold text-white"
                  style={{ background: chapterColor(i, n) }}
                >
                  {c.number}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {c.title}
                </span>
                <span className="mono shrink-0 text-[10.5px] text-ink-3">
                  {fmt(c.text.length)} ch
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================= write it ===== */}
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow" style={{ color: ACCENT }}>
              <Dna size={12} className="mr-1 inline" /> 2 · Write it into DNA
            </span>
            <h2 className="mt-1 text-[24px] leading-tight font-semibold text-ink sm:text-[28px]">
              The whole book, into one tube
            </h2>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Every chapter gets its own pair of primers. Its text is cut into 20-byte pieces, and
              each piece becomes a 136-base strand carrying the primers, an address, the data and a
              checksum. Then every strand of every chapter is mixed together.
            </p>
          </div>
          <button
            onClick={write}
            disabled={!book || writing}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            <Dna size={16} /> {archive ? "Write it again" : "Write it into DNA"}
          </button>
        </div>

        {(writing || archive) && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <motion.div
                className="h-full rounded-full"
                style={{ background: ACCENT }}
                animate={{ width: `${written * 100}%` }}
              />
            </div>
            <div className="mono mt-1.5 text-[11px] text-ink-3">
              {archive ? "written" : `encoding · ${Math.round(written * 100)}%`}
            </div>
          </div>
        )}

        {archive && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-5"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Strands" value={fmt(strands)} sub={`${OLIGO_LEN} bases each`} />
              <Stat label="Bases" value={fmt(archive.totalBases)} sub="A, C, G and T" />
              <Stat
                label="Primer pairs"
                value={String(archive.files.length)}
                sub="one per chapter"
              />
              <Stat
                label="Weight"
                value={`${femtograms.toFixed(1)} fg`}
                sub="with 10 copies of every strand"
              />
            </div>

            {/* anatomy of one strand */}
            {file && sampleStrand && (
              <div className="rounded-2xl border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-ink">One strand, up close</div>
                    <div className="mono text-[11px] text-ink-3">
                      chapter {file.number} · piece {Math.min(inspect, file.count - 1)} of{" "}
                      {file.count - 1}
                      {Math.min(inspect, file.count - 1) === 0
                        ? " (the header: length and title)"
                        : ""}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={file.count - 1}
                    value={Math.min(inspect, file.count - 1)}
                    onChange={(e) => setInspect(Number(e.target.value))}
                    className="w-48"
                    style={{ color: ACCENT }}
                    aria-label="Which piece to inspect"
                  />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <Strand seq={sampleStrand} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {SEGMENTS.map((s) => (
                    <span
                      key={s.key}
                      className="flex items-center gap-1.5 text-[11.5px] text-ink-2"
                    >
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      <strong className="font-semibold text-ink">{s.label}</strong> {s.hint}
                    </span>
                  ))}
                </div>
                {Math.min(inspect, file.count - 1) > 0 && (
                  <p className="mono mt-3 rounded-lg bg-surface px-3 py-2 text-[11.5px] break-words text-ink-2">
                    this piece holds: “
                    {archive.book.chapters[pick]?.text
                      .slice(
                        (Math.min(inspect, file.count - 1) - 1) * 20,
                        Math.min(inspect, file.count - 1) * 20,
                      )
                      .replace(/\n/g, "⏎")}
                    ”
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </section>

      {/* ======================================================= random access == */}
      <section className="overflow-hidden rounded-3xl border border-[#2e2a5a] bg-[#0f0d24] text-slate-200">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <span className="mono text-[11px] font-semibold tracking-[0.14em] text-violet-300 uppercase">
            3 · Random access
          </span>
          <h2 className="mt-1 text-[24px] leading-tight font-semibold text-white sm:text-[28px]">
            Pull one chapter out of the tube
          </h2>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-slate-400">
            Sequencing the whole tube to read one chapter would be like reading every book in a
            library to find one page. Instead, add only that chapter&apos;s primers and run PCR: its
            strands copy themselves, cycle after cycle, until they are almost all that is left —
            then a small sample is enough.
          </p>
        </div>

        {!archive ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 p-6 text-center">
            <FlaskConical size={28} className="text-violet-300" />
            <p className="text-[14px] text-slate-400">
              Write the book into DNA first — the tube is empty.
            </p>
          </div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* ---- the tube and the pipeline -------------------------------- */}
            <div className="border-white/10 p-4 sm:p-5 lg:border-r">
              <div className="h-[300px] sm:h-[340px]">
                <Tube
                  n={n}
                  run={runKey}
                  share={share}
                  target={phase === "idle" ? null : Math.min(pick, n - 1)}
                  phase={
                    phase === "idle"
                      ? `${fmt(strands)} strands · ${n} chapters mixed`
                      : phase === "pcr"
                        ? `PCR cycle ${Math.max(0, history.length - 1)} · chapter ${file?.number} is ${(share * 100).toFixed(share > 0.99 ? 2 : 1)}% of the tube`
                        : phase === "primers"
                          ? `adding chapter ${file?.number}'s primers`
                          : phase === "sequencing"
                            ? `sequencing · ${fmt(readCount)} reads`
                            : phase === "decoding"
                              ? "decoding…"
                              : `chapter ${file?.number} recovered`
                  }
                />
              </div>

              {/* stepper */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {PHASES.map((p, i) => {
                  const done = phase === "done" || (phaseIndex >= 0 && i < phaseIndex);
                  const now = p.id === phase;
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.id}
                      className={cx(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[12px] transition-colors",
                        now
                          ? "border-violet-400 bg-violet-500/20 text-white"
                          : done
                            ? "border-white/10 text-slate-300"
                            : "border-white/5 text-slate-500",
                      )}
                    >
                      <Icon
                        size={14}
                        className={now ? "text-violet-300" : done ? "text-green-400" : ""}
                      />
                      <span className="truncate">{p.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* what is happening right now */}
              <div className="mt-4 min-h-[150px]">
                <AnimatePresence mode="wait">
                  {phase === "primers" && file && (
                    <motion.div
                      key="primers"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <p className="text-[13px] text-slate-300">
                        Two short strands go into the tube. Each one only sticks to the end of a
                        strand carrying chapter {file.number}&apos;s sequence.
                      </p>
                      {[
                        ["forward", file.fwd],
                        ["reverse", file.rev],
                      ].map(([k, s]) => (
                        <div key={k} className="mono flex flex-wrap items-center gap-2 text-[12px]">
                          <span className="w-16 text-slate-500">{k}</span>
                          <span className="rounded bg-violet-500/15 px-2 py-1 tracking-[0.12em] text-violet-200">
                            5&apos;-{s}-3&apos;
                          </span>
                          <span className="text-slate-500">
                            GC {Math.round(gcFraction(s) * 100)}%
                          </span>
                        </div>
                      ))}
                      <p className="mono text-[11px] text-slate-500">
                        every primer differs from every other in at least 10 of its {PRIMER_LEN}{" "}
                        bases, so it cannot bind another chapter
                      </p>
                    </motion.div>
                  )}
                  {(phase === "pcr" ||
                    ((phase === "sequencing" || phase === "decoding") && history.length > 0)) && (
                    <motion.div
                      key="pcr"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="mono mb-1 flex justify-between text-[10.5px] text-slate-400">
                        <span>chapter {file?.number}&apos;s share of the tube, per PCR cycle</span>
                        <span className="text-violet-200">
                          {(share * 100).toFixed(share > 0.99 ? 2 : 1)}%
                        </span>
                      </div>
                      <div className="flex h-[90px] items-end gap-[3px] rounded-lg bg-white/[0.03] p-2">
                        {Array.from({ length: cycles + 1 }, (_, i) => {
                          const v = history[i];
                          return (
                            <div
                              key={i}
                              className="relative flex-1 rounded-sm bg-white/5"
                              style={{ height: "100%" }}
                            >
                              {v !== undefined && (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${Math.max(2, v * 100)}%` }}
                                  className="absolute bottom-0 w-full rounded-sm bg-violet-400"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {phase === "sequencing" && (
                        <div className="mt-3">
                          <div className="mono mb-1 text-[10.5px] text-slate-400">
                            reads coming off the sequencer · errors in red
                          </div>
                          <div className="space-y-[3px] overflow-hidden">
                            {reads.slice(-6).map((r, i) => (
                              <div
                                key={i}
                                className="mono truncate text-[9.5px] leading-tight tracking-[0.06em]"
                              >
                                {r.seq.split("").map((c, k) => (
                                  <span
                                    key={k}
                                    className={
                                      r.errors.includes(k) ? "rounded-sm bg-red-500 text-white" : ""
                                    }
                                    style={
                                      r.errors.includes(k)
                                        ? undefined
                                        : { color: `${BASE_HEX[c]}cc` }
                                    }
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {phase === "done" && result && file && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="mono mb-1 text-[10.5px] text-slate-400">
                        every piece of chapter {file.number}: green recovered, amber failed its
                        checksum, grey never read
                      </div>
                      <div className="flex flex-wrap gap-[2px]">
                        {result.pieces.map((p, i) => (
                          <span
                            key={i}
                            title={`piece ${i}: ${p}, ${result.coverage[i]} reads`}
                            className="h-[9px] w-[9px] rounded-[2px]"
                            style={{
                              background:
                                p === "ok" ? "#4ade80" : p === "bad" ? "#f59e0b" : "#334155",
                              opacity:
                                p === "ok" ? 0.45 + Math.min(1, result.coverage[i] / 20) * 0.55 : 1,
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ---- controls ---------------------------------------------------- */}
            <div className="space-y-5 p-4 sm:p-5">
              <label className="block">
                <span className="mono mb-1.5 block text-[10.5px] tracking-[0.14em] text-slate-400 uppercase">
                  Chapter to retrieve
                </span>
                <select
                  value={pick}
                  onChange={(e) => {
                    setPick(Number(e.target.value));
                    resetRun();
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[14px] text-white outline-none focus:border-violet-400"
                >
                  {archive.files.map((f, i) => (
                    <option key={i} value={i} className="bg-[#0f0d24]">
                      {f.number}. {f.title}
                    </option>
                  ))}
                </select>
              </label>

              {[
                {
                  label: "PCR cycles",
                  value: `${cycles}`,
                  min: 0,
                  max: 30,
                  step: 1,
                  v: cycles,
                  set: setCycles,
                  hint: "0 cycles means no random access — you read the tube as it is.",
                },
                {
                  label: "Read depth",
                  value: `${depth}× · ${fmt(readsTotal)} reads`,
                  min: 1,
                  max: 40,
                  step: 1,
                  v: depth,
                  set: setDepth,
                  hint: "Reads per strand of the chapter. Too few and pieces go missing.",
                },
                {
                  label: "Sequencing error",
                  value: `${errorRate.toFixed(1)}% per base`,
                  min: 0,
                  max: 5,
                  step: 0.1,
                  v: errorRate,
                  set: setErrorRate,
                  hint: "Majority voting across reads fixes most of these.",
                },
              ].map((c) => (
                <label key={c.label} className="block">
                  <span className="mb-1.5 flex justify-between">
                    <span className="mono text-[10.5px] tracking-[0.14em] text-slate-400 uppercase">
                      {c.label}
                    </span>
                    <span className="mono text-[11.5px] text-white">{c.value}</span>
                  </span>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={c.v}
                    onChange={(e) => {
                      c.set(Number(e.target.value));
                      resetRun();
                    }}
                    style={{ color: "#a78bfa" }}
                  />
                  <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                    {c.hint}
                  </span>
                </label>
              ))}

              <button
                onClick={run}
                disabled={phase !== "idle" && phase !== "done"}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
              >
                <Play size={15} />{" "}
                {phase === "done" ? "Run it again" : `Retrieve chapter ${file?.number}`}
              </button>

              {/* the case for random access, in bases */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mono mb-2 text-[10px] tracking-[0.14em] text-slate-400 uppercase">
                  Bases sequenced
                </div>
                {[
                  { k: "with random access", v: readsTotal, c: "#a78bfa" },
                  { k: "reading the whole tube", v: wholeTube, c: "#64748b" },
                ].map((r) => (
                  <div key={r.k} className="mb-2">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>{r.k}</span>
                      <span className="mono">{fmt(r.v * OLIGO_LEN)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(r.v / Math.max(1, wholeTube)) * 100}%`,
                          background: r.c,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-slate-400">
                  {wholeTube && readsTotal
                    ? `${(wholeTube / readsTotal).toFixed(1)}× less sequencing`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ======================================================= the chapter == */}
      <AnimatePresence>
        {result && file && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-line bg-surface p-5 sm:p-6"
          >
            <span className="eyebrow" style={{ color: ACCENT }}>
              4 · What came back
            </span>
            <h2 className="mt-1 text-[24px] leading-tight font-semibold text-ink sm:text-[28px]">
              Chapter {file.number}: {result.titleFromDna || file.title}
            </h2>
            <p className="mt-1 text-[13px] text-ink-3">
              {result.titleFromDna
                ? "The title above was read out of the DNA itself, from the chapter's header strand."
                : "The header strand was lost, so the title shown is from the index, not the DNA."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Text recovered"
                value={`${(result.accuracy * 100).toFixed(result.accuracy > 0.999 ? 2 : 1)}%`}
                sub="identical to the original"
              />
              <Stat
                label="Pieces"
                value={`${result.recovered}/${result.pieces.length}`}
                sub={`${result.pieces.filter((p) => p === "missing").length} never read · ${result.pieces.filter((p) => p === "bad").length} failed checksum`}
              />
              <Stat
                label="Reads on target"
                value={`${Math.round((result.readsUsed / Math.max(1, result.readsUsed + result.readsOffTarget)) * 100)}%`}
                sub={`${fmt(result.readsOffTarget)} reads were other chapters`}
              />
              <Stat
                label="Errors outvoted"
                value={fmt(result.corrected)}
                sub="bad base calls fixed by majority"
              />
            </div>

            {result.pieces.some((p) => p !== "ok") && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                ▒ marks text from pieces that did not survive. Raise the read depth, or lower the
                error rate, and try again. Real systems also add an outer error-correcting code
                across strands (Organick et al. used Reed–Solomon) that rebuilds missing pieces from
                the others.
              </p>
            )}

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-line-soft bg-paper p-4 sm:p-5">
              <p className="font-display text-[15.5px] leading-[1.75] whitespace-pre-wrap text-ink">
                {result.text.split("▒").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="rounded-sm bg-amber-200 text-amber-700" title="lost piece">
                        ▒
                      </span>
                    )}
                  </span>
                ))}
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
