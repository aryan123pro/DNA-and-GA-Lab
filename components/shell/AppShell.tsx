"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CornerDownLeft, Menu, Search, X } from "lucide-react";
import {
  DESTINATIONS,
  Destination,
  destinationFor,
  markVisited,
  readVisited,
  useSteps,
} from "@/lib/nav";
import { cx } from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* the mark                                                                   */
/* -------------------------------------------------------------------------- */

export function Mark({ accent, size = 22 }: { accent: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 2c0 5 10 5 10 10S7 17 7 22"
        stroke={accent}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17 2c0 5-10 5-10 10s10 5 10 10"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* the rail: the lab drawn as a chromosome                                    */
/* -------------------------------------------------------------------------- */

const GROUPS: { label: string; kinds: Destination["kind"][]; ids?: string[] }[] = [
  { label: "Chapters", kinds: ["model"] },
  { label: "Playgrounds", kinds: ["lab"] },
  { label: "Reference", kinds: ["page"], ids: ["references", "presentation", "team"] },
];

function useVisited() {
  const [visited, setVisited] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setVisited(readVisited());
    sync();
    window.addEventListener("dna-lab-visited", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dna-lab-visited", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return visited;
}

function Rail({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const here = destinationFor(pathname);
  const visited = useVisited();
  const steps = useSteps();
  const explorable = DESTINATIONS.filter((d) => d.kind !== "page");
  const explored = explorable.filter((d) => visited.includes(d.id)).length;

  return (
    <div className="flex h-full flex-col">
      {/* brand */}
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex items-center gap-2.5 px-5 pt-5 pb-4 text-ink"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface shadow-sm transition-transform group-hover:rotate-12">
          <Mark accent={here?.kind === "model" || here?.kind === "lab" ? here.accent : "#0d9488"} />
        </span>
        <span className="leading-tight">
          <span className="font-display block text-[16px] font-semibold tracking-tight">
            DNA and GA Lab
          </span>
          <span className="mono block text-[9.5px] tracking-[0.16em] text-ink-3 uppercase">
            storage · evolution
          </span>
        </span>
      </Link>

      {/* search */}
      <button
        onClick={onSearch}
        className="mx-4 mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-ink-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors hover:border-ink-3/40 hover:text-ink-2"
      >
        <Search size={13} />
        Jump anywhere
        <kbd className="mono ml-auto rounded-md border border-line bg-sunken px-1.5 py-[1px] text-[10px]">
          ⌘K
        </kbd>
      </button>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Lab">
        {GROUPS.map((g) => {
          const items = DESTINATIONS.filter(
            (d) => g.kinds.includes(d.kind) && (!g.ids || g.ids.includes(d.id)),
          );
          return (
            <div key={g.label} className="mb-5">
              <div className="mono mb-1.5 px-2 text-[9.5px] font-bold tracking-[0.18em] text-ink-3 uppercase">
                {g.label}
              </div>
              {/* the chromosome: one continuous arm, each page a coloured band on it */}
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute top-1 bottom-1 left-[13px] w-[10px] rounded-full bg-[repeating-linear-gradient(0deg,#ece8df_0_3px,#e4dfd4_3px_6px)]"
                />
                {items.map((d) => {
                  const on = here?.id === d.id;
                  const seen = visited.includes(d.id);
                  const live = on && steps.page === d.id && d.steps && steps.count > 0;
                  return (
                    <div key={d.id} className="relative">
                      <Link
                        href={d.href}
                        onClick={onNavigate}
                        className={cx(
                          "group relative flex items-center gap-3 rounded-xl py-2 pr-2 pl-[6px] transition-colors",
                          on
                            ? "bg-surface shadow-[0_6px_20px_-12px_rgba(20,25,31,0.35)]"
                            : "hover:bg-surface/60",
                        )}
                      >
                        {/* the band */}
                        <span
                          className="relative z-10 flex h-[30px] w-[24px] shrink-0 items-center justify-center rounded-[8px] transition-transform group-hover:scale-105"
                          style={{
                            background: on ? d.accent : seen ? `${d.accent}55` : `${d.accent}22`,
                            boxShadow: on ? `0 0 0 3px ${d.accent}26` : undefined,
                          }}
                        >
                          {d.num ? (
                            <span
                              className="mono text-[10px] font-bold"
                              style={{ color: on ? "#fff" : d.accent }}
                            >
                              {d.num}
                            </span>
                          ) : (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: on ? "#fff" : d.accent }}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cx(
                              "block truncate text-[13.5px] leading-tight font-semibold",
                              on ? "text-ink" : "text-ink-2 group-hover:text-ink",
                            )}
                          >
                            {d.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-3">{d.hint}</span>
                        </span>
                        {seen && !on && (
                          <Check size={12} className="shrink-0" style={{ color: d.accent }} />
                        )}
                      </Link>

                      {/* sub-loci: the steps of the page you are on */}
                      <AnimatePresence initial={false}>
                        {live && (
                          <motion.ol
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="relative overflow-hidden pt-1 pb-2 pl-[40px]"
                          >
                            {d.steps!.map((s, i) => {
                              const cur = steps.step === i;
                              const done = i < steps.step;
                              return (
                                <li key={s}>
                                  <button
                                    onClick={() => {
                                      steps.go?.(i);
                                      onNavigate?.();
                                    }}
                                    className={cx(
                                      "group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors",
                                      cur
                                        ? "font-semibold text-ink"
                                        : "text-ink-3 hover:text-ink-2",
                                    )}
                                  >
                                    <span
                                      className="h-[7px] w-[7px] shrink-0 rounded-full border-2 transition-colors"
                                      style={{
                                        borderColor: d.accent,
                                        background: cur || done ? d.accent : "transparent",
                                        opacity: cur || done ? 1 : 0.45,
                                      }}
                                    />
                                    <span className="truncate">{s}</span>
                                    {cur && (
                                      <span
                                        className="mono ml-auto text-[9.5px]"
                                        style={{ color: d.accent }}
                                      >
                                        {i + 1}/{d.steps!.length}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </motion.ol>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* your path through the lab */}
      <div className="border-t border-line px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="mono text-[9.5px] font-bold tracking-[0.18em] text-ink-3 uppercase">
            Your path
          </span>
          <span className="mono text-[11px] text-ink-2">
            {explored}/{explorable.length} explored
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {explorable.map((d) => (
            <span
              key={d.id}
              title={d.name}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: visited.includes(d.id) ? d.accent : "#e7e3da" }}
            />
          ))}
        </div>
        <p className="mt-2.5 text-[10.5px] leading-snug text-ink-3">
          Educational simulation. Every number is computed in your browser.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ⌘K                                                                         */
/* -------------------------------------------------------------------------- */

interface Entry {
  key: string;
  label: string;
  sub: string;
  accent: string;
  href: string;
  page: string;
  step: number | null;
}

function buildEntries(): Entry[] {
  const out: Entry[] = [];
  for (const d of DESTINATIONS) {
    out.push({
      key: d.id,
      label: d.num ? `Model ${d.num} · ${d.name}` : d.name,
      sub: d.hint,
      accent: d.accent,
      href: d.href,
      page: d.id,
      step: null,
    });
    d.steps?.forEach((s, i) =>
      out.push({
        key: `${d.id}-${i}`,
        label: s,
        sub: `${d.name} · step ${i + 1}`,
        accent: d.accent,
        href: d.href,
        page: d.id,
        step: i,
      }),
    );
  }
  return out;
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  // the body mounts fresh each time, so the search box always starts empty
  return <AnimatePresence>{open && <PaletteBody onClose={onClose} />}</AnimatePresence>;
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(() => buildEntries(), []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return entries;
    return entries
      .map((e) => {
        const hay = `${e.label} ${e.sub}`.toLowerCase();
        const at = hay.indexOf(t);
        return { e, score: at < 0 ? -1 : at === 0 ? 2 : 1 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.e);
  }, [q, entries]);

  const go = useCallback(
    (e: Entry) => {
      onClose();
      const here = destinationFor(pathname);
      if (e.step !== null) useSteps.getState().request(e.page, e.step);
      if (here?.id !== e.page) router.push(e.href);
    },
    [onClose, pathname, router],
  );

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (ev.key === "Enter" && results[sel]) {
      ev.preventDefault();
      go(results[sel]);
    } else if (ev.key === "Escape") {
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ y: -12, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -8, scale: 0.98, opacity: 0 }}
        transition={{ duration: 0.16 }}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_100px_-30px_rgba(20,25,31,0.55)]"
        role="dialog"
        aria-label="Jump anywhere"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={16} className="text-ink-3" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            placeholder="A page, a step, a model…"
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="mono rounded-md border border-line bg-sunken px-1.5 py-[1px] text-[10px] text-ink-3">
            esc
          </kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-[13px] text-ink-3">Nothing by that name.</li>
          )}
          {results.map((e, i) => (
            <li key={e.key}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(e)}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left",
                  i === sel ? "bg-sunken" : "",
                )}
              >
                <span
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    e.step !== null && "ml-4 h-5 w-5 rounded-md",
                  )}
                  style={{ background: `${e.accent}1f` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: e.accent }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">
                    {e.label}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">{e.sub}</span>
                </span>
                {i === sel && <CornerDownLeft size={13} className="text-ink-3" />}
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const here = destinationFor(pathname);

  // remember where you have been
  useEffect(() => {
    if (here && here.kind !== "page") markVisited(here.id);
  }, [here]);

  // ⌘K / Ctrl-K anywhere, or "/" when you are not typing
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <>
      {/* desktop: a fixed rail down the left */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-[#f7f5f0]/95 backdrop-blur lg:block">
        <Rail onSearch={() => setPalette(true)} />
      </aside>

      {/* small screens: a slim bar and a drawer */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          onClick={() => setDrawer(true)}
          className="cursor-pointer rounded-lg border border-line bg-surface p-1.5 text-ink-2"
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Mark accent={here?.accent ?? "#0d9488"} size={20} />
          <span className="font-display text-[15px] font-semibold">DNA and GA Lab</span>
        </Link>
        <button
          onClick={() => setPalette(true)}
          className="ml-auto cursor-pointer rounded-lg border border-line bg-surface p-1.5 text-ink-2"
          aria-label="Search"
        >
          <Search size={16} />
        </button>
      </header>
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="fixed inset-0 z-50 bg-ink/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawer(false)}
          >
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[#f7f5f0] shadow-2xl"
            >
              <button
                onClick={() => setDrawer(false)}
                className="absolute top-5 right-4 cursor-pointer rounded-lg p-1 text-ink-3 hover:bg-sunken"
                aria-label="Close navigation"
              >
                <X size={16} />
              </button>
              <Rail
                onNavigate={() => setDrawer(false)}
                onSearch={() => {
                  setDrawer(false);
                  setPalette(true);
                }}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <Palette open={palette} onClose={() => setPalette(false)} />

      <div className="lg:pl-[264px]">{children}</div>
    </>
  );
}
