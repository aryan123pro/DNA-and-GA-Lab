"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FileText,
  Presentation,
  Unlock,
  Users,
} from "lucide-react";
import TeamTab from "@/components/team/TeamTab";
import { DECK, DECK_REFS, KEY_PAPERS } from "@/lib/deck";
import { cx } from "@/components/ui";
import { Card, CardTitle, Note } from "@/components/ui";

type Group = {
  heading: string;
  blurb: string;
  accent: string;
  items: { title: string; where: string; url: string; note: string }[];
};

const GROUPS: Group[] = [
  {
    heading: "DNA data storage",
    blurb: "The experiments that actually wrote files into real DNA and read them back.",
    accent: "#0d9488",
    items: [
      {
        title: "Next-generation digital information storage in DNA",
        where: "Church, Gao & Kosuri — Science, 2012",
        url: "https://www.science.org/doi/10.1126/science.1226355",
        note: "Stored a whole book in DNA. The paper that started the modern wave.",
      },
      {
        title: "Towards practical information storage in synthesized DNA",
        where: "Goldman et al. — Nature, 2013",
        url: "https://www.nature.com/articles/nature11875",
        note: "Introduced a code that never lets the same base repeat, to dodge sequencing errors.",
      },
      {
        title: "DNA Fountain enables a robust and efficient storage architecture",
        where: "Erlich & Zielinski — Science, 2017",
        url: "https://www.science.org/doi/10.1126/science.aaj2038",
        note: "Packed data in at close to the theoretical limit using a clever redundancy code.",
      },
      {
        title: "Molecular digital data storage using DNA",
        where: "Ceze, Nivala & Strauss — Nature Reviews Genetics, 2019",
        url: "https://www.nature.com/articles/s41576-019-0125-3",
        note: "The friendliest overview of the whole field. Good first read.",
      },
      {
        title: "Random access in large-scale DNA data storage",
        where: "Organick et al. — Nature Biotechnology, 2018",
        url: "https://www.nature.com/articles/nbt.4079",
        note: "How you find one file in a tube containing thousands.",
      },
    ],
  },
  {
    heading: "Genetic algorithms",
    blurb: "Where the selection–crossover–mutation loop in Model 2 comes from.",
    accent: "#4f46e5",
    items: [
      {
        title: "Adaptation in Natural and Artificial Systems",
        where: "John Holland — 1975",
        url: "https://mitpress.mit.edu/9780262581110/adaptation-in-natural-and-artificial-systems/",
        note: "The book that invented genetic algorithms.",
      },
      {
        title: "An Introduction to Genetic Algorithms",
        where: "Melanie Mitchell — MIT Press, 1996",
        url: "https://mitpress.mit.edu/9780262631853/an-introduction-to-genetic-algorithms/",
        note: "The standard undergraduate textbook. Very readable.",
      },
      {
        title: "Genetic Algorithms in Search, Optimization and Machine Learning",
        where: "David Goldberg — 1989",
        url: "https://dl.acm.org/doi/book/10.5555/534133",
        note: "The classic engineering reference.",
      },
      {
        title: "Genetic Algorithms — tutorial",
        where: "GeeksforGeeks",
        url: "https://www.geeksforgeeks.org/genetic-algorithms/",
        note: "A quick code-first refresher if you want to implement one yourself.",
      },
    ],
  },
  {
    heading: "Background",
    blurb: "Why the chemistry constraints in these models are real constraints.",
    accent: "#be123c",
    items: [
      {
        title: "Characterizing and measuring bias in sequence data",
        where: "Ross et al. — Genome Biology, 2013",
        url: "https://genomebiology.biomedcentral.com/articles/10.1186/gb-2013-14-5-r51",
        note: "Where the rules about G+C balance and long repeats come from.",
      },
      {
        title: "Million-year-old DNA sheds light on mammoth evolution",
        where: "van der Valk et al. — Nature, 2021",
        url: "https://www.nature.com/articles/s41586-021-03224-9",
        note: "Evidence for how long DNA can survive if you keep it cold.",
      },
      {
        title: "DNA Data Storage Alliance",
        where: "Industry consortium",
        url: "https://dnastoragealliance.org/",
        note: "What companies are currently building.",
      },
    ],
  },
];

// pdf.js needs a browser
const PdfViewer = dynamic(() => import("@/components/pdf/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[640px] items-center justify-center rounded-2xl bg-[#1b2230]">
      <span className="mono text-[12px] text-slate-400">opening the viewer…</span>
    </div>
  ),
});

type Tab = "sources" | "presentation" | "team";

export default function ReferencesPage() {
  // useSearchParams needs a Suspense boundary on a statically rendered page
  return (
    <Suspense fallback={null}>
      <References />
    </Suspense>
  );
}

function References() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = raw === "presentation" || raw === "team" ? raw : "sources";
  const setTab = useCallback(
    (t: Tab) =>
      router.replace(t === "sources" ? pathname : `${pathname}?tab=${t}`, { scroll: false }),
    [router, pathname],
  );

  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-sunken">
        <div className="mx-auto max-w-[1120px] px-5 pt-10">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
          >
            <ArrowLeft size={12} /> Home
          </Link>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold text-ink sm:text-[36px]">
            Where this comes from
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Everything in these models is a simplified version of real published work. The website
            has its own reading list, and the presentation it was built alongside has its slides and
            references here too — readable on a phone.
          </p>

          {/* the two tabs */}
          <div className="-mx-1 mt-6 flex gap-1 overflow-x-auto px-1" role="tablist">
            {(
              [
                ["sources", "Website sources", BookOpen],
                ["presentation", "The presentation", Presentation],
                ["team", "The team", Users],
              ] as const
            ).map(([id, label, Icon]) => {
              const on = tab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(id)}
                  className={cx(
                    "relative flex shrink-0 cursor-pointer items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                    on
                      ? "border-line bg-paper text-ink"
                      : "border-transparent text-ink-3 hover:text-ink-2",
                  )}
                >
                  <Icon size={15} />
                  {label}
                  {on && (
                    <motion.span
                      layoutId="ref-tab"
                      className="absolute inset-x-3 -top-px h-[2px] rounded-full bg-storage"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tab === "sources" ? <Sources /> : tab === "presentation" ? <Deck /> : <TeamTab />}

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          DNA and GA Lab — educational simulation.
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* tab 1: the website's own reading list                                      */
/* -------------------------------------------------------------------------- */

function Sources() {
  return (
    <main className="mx-auto max-w-[1120px] space-y-10 px-5 py-10">
      {GROUPS.map((g) => (
        <section key={g.heading}>
          <div className="mb-4 max-w-2xl">
            <h2 className="text-[21px] font-semibold text-ink" style={{ color: g.accent }}>
              {g.heading}
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{g.blurb}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map((r, i) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex gap-3 rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-[0_6px_24px_-14px_rgba(20,25,31,0.35)]"
              >
                <span
                  className="mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                  style={{ background: `${g.accent}14`, color: g.accent }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] leading-snug font-semibold text-ink">
                    {r.title}
                  </span>
                  <span className="mono mt-1 block text-[11.5px] text-ink-3">{r.where}</span>
                  <span className="mt-2 block text-[13px] leading-relaxed text-ink-2">
                    {r.note}
                  </span>
                </span>
                <ExternalLink
                  size={14}
                  className="ml-auto shrink-0 text-ink-3 group-hover:text-ink"
                />
              </a>
            ))}
          </div>
        </section>
      ))}

      <Card>
        <CardTitle>An honest note on scope</CardTitle>
        <div className="space-y-3 text-[14px] leading-[1.65] text-ink-2">
          <p>
            These models are deliberately simplified for a first-year audience. Real DNA archives
            split data across millions of short strands with address labels, and protect them with
            much stronger codes than the majority vote used here.
          </p>
          <p>
            The damage simulation treats every base independently, which real degradation does not.
            And no biological DNA is involved anywhere — everything runs as arithmetic in your
            browser.
          </p>
        </div>
      </Card>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* tab 2: the presentation                                                    */
/* -------------------------------------------------------------------------- */

function Deck() {
  return (
    <main className="mx-auto max-w-[1120px] space-y-12 px-4 py-8 sm:px-5 sm:py-10">
      {/* ---- the deck itself ----------------------------------------------- */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow text-storage">The slides · {DECK.pages} pages</span>
            <h2 className="mt-1 text-[24px] leading-tight font-semibold text-ink sm:text-[30px]">
              {DECK.title}
            </h2>
            <p className="mt-1 text-[14px] text-ink-2">{DECK.subtitle}</p>
            <p className="mono mt-2 text-[11.5px] text-ink-3">
              Presented by {DECK.authors.join(" · ")}
            </p>
          </div>
          <span className="mono text-[11px] text-ink-3">
            Swipe or use ← → to turn slides · {DECK.size}
          </span>
        </div>
        <PdfViewer src={DECK.src} title={DECK.title} initialMode="slides" height={620} />
      </section>

      {/* ---- the papers it stands on -------------------------------------- */}
      <section>
        <div className="mb-4 max-w-3xl">
          <span className="eyebrow text-ink-3">The papers it stands on</span>
          <h2 className="mt-1 text-[24px] leading-tight font-semibold text-ink sm:text-[30px]">
            Where the deck&apos;s numbers come from
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Every headline figure in the slides traces back to one of these. Papers published under
            an open licence are served from this site as PDFs; the rest link to where they can be
            read — a free copy where one exists, otherwise the journal.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {KEY_PAPERS.map((p) => {
            const h = p.access.find((a) => a.kind === "hosted");
            return (
              <div
                key={p.ref}
                id={`paper-${p.ref}`}
                className={cx(
                  "flex scroll-mt-24 flex-col rounded-2xl border bg-surface p-4",
                  p.star
                    ? "border-amber-400 shadow-[0_18px_50px_-30px_rgba(180,83,9,0.6)] md:col-span-2"
                    : "border-line",
                )}
              >
                {p.star && (
                  <span className="mono mb-3 self-start rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white uppercase">
                    ★ {p.star}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <span
                    className="mono flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1 text-[11px] font-bold text-white"
                    style={{ background: p.accent }}
                  >
                    {p.label ?? `[${p.ref}]`}
                  </span>
                  <div className="min-w-0">
                    <div className="mono text-[11px] text-ink-3">{p.short}</div>
                    <div className="mt-0.5 text-[14.5px] leading-snug font-semibold text-ink">
                      {p.title}
                    </div>
                    <div className="mono mt-0.5 text-[11px] text-ink-3 italic">{p.venue}</div>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-[13px] leading-[1.6] text-ink-2">
                  <span className="font-semibold text-ink">In the deck: </span>
                  {p.used}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {h && h.kind === "hosted" && (
                    // opens in the phone's or browser's own PDF reader
                    <a
                      href={h.src}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white"
                      style={{ background: p.accent }}
                    >
                      <FileText size={13} />
                      Open PDF
                      <span className="mono text-[10px] font-normal opacity-80">{h.size}</span>
                    </a>
                  )}
                  {p.access.map((a, i) =>
                    a.kind === "free" ? (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium"
                        style={{ borderColor: `${p.accent}55`, color: p.accent }}
                      >
                        <Unlock size={13} /> Free on {a.where}
                      </a>
                    ) : a.kind === "publisher" ? (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-2 hover:bg-sunken"
                      >
                        <ExternalLink size={13} /> Journal
                      </a>
                    ) : null,
                  )}
                  {h && h.kind === "hosted" && (
                    <span className="mono ml-auto text-[10px] text-ink-3">{h.licence}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- the full reference list --------------------------------------- */}
      <section>
        <div className="mb-4">
          <span className="eyebrow text-ink-3">References, as cited in the deck</span>
          <h2 className="mt-1 text-[24px] leading-tight font-semibold text-ink sm:text-[30px]">
            All 27 sources
          </h2>
        </div>
        <div className="space-y-8">
          {DECK_REFS.map((g) => (
            <div key={g.heading}>
              <h3 className="mono text-[11px] font-bold tracking-[0.16em] text-ink-2 uppercase">
                {g.heading}
              </h3>
              {g.note && <p className="mt-1 text-[12.5px] text-ink-3">{g.note}</p>}
              <ol className="mt-3 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface">
                {g.items.map((r) => (
                  <li key={r.n} className="flex gap-3 px-4 py-3">
                    <span className="mono w-8 shrink-0 text-[12px] font-bold text-storage">
                      [{r.n}]
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px] leading-[1.6] text-ink-2">
                      {r.text}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mono ml-2 inline-flex items-center gap-1 text-[11.5px] break-all text-storage hover:underline"
                        >
                          {r.url.replace(/^https?:\/\//, "")}
                          <ExternalLink size={11} />
                        </a>
                      )}
                      {r.paper && (
                        <a
                          href={`#paper-${r.paper}`}
                          className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-amber-800 hover:bg-amber-200"
                        >
                          → the study behind it: [{r.paper}] Grass et al. 2015
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <Note accent="#0d9488" title="About the PDFs on this page">
        Only papers whose licence permits redistribution are served from this site — CC BY, or CC
        BY-NC-ND for this non-commercial teaching use — each unmodified and credited to its authors
        and journal. The others are copyrighted by their publishers; follow the links to read them,
        free where a copy exists.
      </Note>
    </main>
  );
}
