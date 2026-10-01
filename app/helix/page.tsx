"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardTitle, Note } from "@/components/ui";
import { LESION_INFO, LesionKind, PATHWAY_INFO, PathwayId } from "@/lib/helix";

// the molecule is drawn on a canvas that needs a real browser
const HelixStudio = dynamic(() => import("@/components/helix/HelixStudio"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[720px] items-center justify-center rounded-2xl bg-[#0b1220]">
      <span className="mono text-[12px] text-slate-400">building the molecule…</span>
    </div>
  ),
});

const ACCENT = "#0d9488";

/** Damage on the left, the pathway a cell sends for it on the right. */
const GUIDE: { lesion: LesionKind; pathway: PathwayId; enzymes: string; detail: string }[] = [
  {
    lesion: "oxo",
    pathway: "BER",
    enzymes: "OGG1 / UNG · APE1 · Pol β · Ligase III",
    detail:
      "A glycosylase that knows one specific chemical flips the bad base out and snips it off. The backbone is cut, one base is written back from the partner strand, and the nick is sealed.",
  },
  {
    lesion: "abasic",
    pathway: "BER",
    enzymes: "APE1 · Pol β · Ligase III",
    detail:
      "A base that simply fell off leaves an empty sugar. Base excision repair picks up from its second step: no glycosylase needed, the hole is already there.",
  },
  {
    lesion: "mismatch",
    pathway: "MMR",
    enzymes: "MutSα · MutLα · Exo1 · Pol δ · Ligase I",
    detail:
      "Both bases are perfectly normal — they just do not pair. The trick is knowing which strand is new: the cell trusts the old one and rewrites a stretch of the new.",
  },
  {
    lesion: "dimer",
    pathway: "NER",
    enzymes: "XPC · TFIIH · XPF/XPG · Pol δ · Ligase",
    detail:
      "UV welds two neighbours into a lump that bends the helix. The sensor looks for the bend, not the chemistry, so this one pathway handles almost any bulky damage. People born without it burn in minutes of sunlight.",
  },
  {
    lesion: "break",
    pathway: "HR",
    enzymes: "MRN · RAD51 · Pol δ · resolvases",
    detail:
      "With both strands cut there is no partner to copy from — so the cell finds its sister chromatid, the identical copy it made when it last replicated, and reads the missing piece off that. Exact, but only possible after replication.",
  },
  {
    lesion: "break",
    pathway: "NHEJ",
    enzymes: "Ku70/80 · DNA-PKcs · Artemis · Ligase IV",
    detail:
      "Most of the time there is no sister copy. Ku grabs both ends and ligase glues them, trimming whatever does not fit. The strand is whole again and the bases at the break are gone for good.",
  },
];

export default function HelixPage() {
  return (
    <div className="min-h-screen">

      {/* ---- header --------------------------------------------------------- */}
      <div
        className="relative overflow-hidden border-b border-line"
        style={{
          background: "radial-gradient(80% 140% at 100% 0%, #c9f1ea 0%, #e6f5f2 40%, #fbfaf7 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(13,148,136,0.08) 0 2px, transparent 2px 26px)",
            maskImage: "linear-gradient(90deg, transparent, black 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1120px] px-5 py-9">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
          >
            <ArrowLeft size={12} /> All three models
          </Link>
          <div className="mono mt-3 text-[11px] font-bold tracking-[0.16em] text-storage uppercase">
            Playground · the molecule itself
          </div>
          <h1 className="mt-1 text-[34px] leading-[1.05] font-semibold text-ink sm:text-[46px]">
            Helix Lab
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            Every cell in your body takes tens of thousands of hits to its DNA a day — from
            sunlight, from oxygen, from its own copying mistakes — and fixes nearly all of them
            before they matter. Your word is written into the molecule below. Break it the way the
            world does, then watch the cell&apos;s repair crews find the damage and put it back, one
            enzyme at a time.
          </p>
          <div className="mono mt-6 grid max-w-2xl grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            {[
              ["~10⁴–10⁵", "lesions per cell, per day"],
              ["5", "repair pathways here"],
              ["2", "strands: the backup is built in"],
              ["1 in 10⁹", "errors left after repair"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="rounded-xl border border-[#b7e4dc] bg-white/70 px-3 py-2 backdrop-blur"
              >
                <div className="text-[17px] font-bold text-ink">{v}</div>
                <div className="text-ink-3">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] space-y-10 px-5 py-8">
        <HelixStudio />

        {/* ---- a field guide ------------------------------------------------- */}
        <section>
          <div className="mb-4">
            <span className="eyebrow" style={{ color: ACCENT }}>
              Field guide
            </span>
            <h2 className="mt-1 text-[24px] font-semibold text-ink sm:text-[28px]">
              Every kind of damage has its own crew
            </h2>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">
              The cell does not have one repair kit. It has a toolbox, and it picks the tool by what
              the damage looks like. Each row below is a button in the lab above.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {GUIDE.map((g, i) => {
              const L = LESION_INFO[g.lesion];
              const P = PATHWAY_INFO[g.pathway];
              return (
                <div key={i} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                  <div className="flex w-[120px] shrink-0 flex-col items-start gap-1.5">
                    <span
                      className="mono rounded-md px-2 py-0.5 text-[10.5px] font-bold"
                      style={{
                        background: `${L.color}22`,
                        color: L.color === "#e2e8f0" ? "#475569" : L.color,
                      }}
                    >
                      {L.name}
                    </span>
                    <ArrowRight size={14} className="ml-1 text-ink-3" />
                    <span
                      className="mono rounded-md px-2 py-0.5 text-[10.5px] font-bold text-white"
                      style={{ background: P.color }}
                    >
                      {P.short}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-ink">{P.name}</div>
                    <div className="mono mt-0.5 text-[10.5px] text-ink-3">{g.enzymes}</div>
                    <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-2">{g.detail}</p>
                    <p className="mt-1.5 text-[11.5px] text-ink-3">Caused by {L.cause}.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- the three ideas ---------------------------------------------- */}
        <section className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardTitle hint="Why repair is possible at all.">The backup is built in</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              A only pairs with T, C only with G, so the second strand is a complete copy of the
              first, written in negative. Watch any crew in the lab: every base it writes back is
              read off the partner strand. That is why a double-strand break is so dangerous — it is
              the one injury that takes the backup with it.
            </p>
          </Card>
          <Card>
            <CardTitle hint="Why the cell is in a hurry.">Repair races replication</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              Turn on <strong>Let the world in</strong> with one crew and a high damage rate. When
              the replication fork sweeps past a lesion nobody has fixed yet, it copies the wrong
              letter onto the new strand. Now both strands agree, no enzyme can tell anything is
              wrong — and that is what a mutation is.
            </p>
          </Card>
          <Card>
            <CardTitle hint="The one repair that loses information.">
              Fixed is not the same as right
            </CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              Turn off <strong>Sister copy available</strong> and snap the strand with radiation.
              End joining makes the molecule whole again, but a few bases are thrown away, and
              because every letter here is four bases long, everything after the join is read in the
              wrong frame.
            </p>
          </Card>
        </section>

        <Note accent={ACCENT} title="Where this connects">
          Model 1, step 3 pairs each of these pathways with the error-correcting code engineers
          invented for the same job — Hamming codes for base excision, parity for mismatch repair,
          block replacement for nucleotide excision. The cell got there first.
        </Note>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          DNA and GA Lab — educational simulation. Enzymes, lesions and pathways are real; timings are
          compressed so a whole pathway (minutes to hours in a real cell) plays out in a few
          seconds, and repair patches are shortened to fit on screen.
        </div>
      </footer>
    </div>
  );
}
