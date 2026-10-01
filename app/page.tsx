"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, Command } from "lucide-react";
import Helix from "@/components/Helix";
import { textToBytes } from "@/lib/dna";
import { MODELS } from "@/lib/models";
import { LABS, readVisited } from "@/lib/nav";

const HeroDemo = dynamic(() => import("@/components/rocket/HeroDemo"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#c8dfec]" />,
});

const BASE: Record<string, string> = { A: "#2563eb", C: "#ea580c", G: "#16a34a", T: "#9333ea" };
const LETTER = ["A", "C", "G", "T"];

/** Your text, the way every lab here writes it: eight bits a character, two bits a base. */
function encode(text: string) {
  return Array.from(textToBytes(text)).map((byte) => {
    const bits = byte.toString(2).padStart(8, "0");
    const bases = [0, 2, 4, 6].map((i) => LETTER[parseInt(bits.slice(i, i + 2), 2)]);
    return { bits, bases };
  });
}

/** One nucleotide in a strand weighs about 330 daltons. */
function weigh(bases: number) {
  const grams = bases * 330 * 1.6605e-24;
  const units: [number, string][] = [
    [1e-21, "zeptograms"],
    [1e-18, "attograms"],
    [1e-15, "femtograms"],
  ];
  let [scale, name] = units[0];
  for (const u of units) if (grams >= u[0]) [scale, name] = u;
  return `${(grams / scale).toFixed(grams / scale < 10 ? 2 : 1)} ${name}`;
}

const FACTS = [
  "215 petabytes per gram — the density DNA Fountain reached in 2017",
  "A DNA bond in bone has a half-life of about 521 years",
  "The oldest DNA ever read is over a million years old",
  "Your cells fix tens of thousands of DNA lesions every day",
  "A only pairs with T, C only with G — the backup is built in",
  "A Falcon 9 booster cannot hover: its engine is too strong at minimum throttle",
  "Evolution needs only three rules: keep the best, mix two parents, change a little",
];

function useVisited() {
  const [v, setV] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setV(readVisited());
    sync();
    window.addEventListener("dna-lab-visited", sync);
    return () => window.removeEventListener("dna-lab-visited", sync);
  }, []);
  return v;
}

/* -------------------------------------------------------------------------- */

export default function Home() {
  const [name, setName] = useState("Hello");
  const strand = useMemo(() => encode(name), [name]);
  const bases = strand.length * 4;
  const visited = useVisited();
  const [m1, m2, m3] = MODELS;
  const helix = LABS.find((l) => l.id === "helix")!;
  const landing = LABS.find((l) => l.id === "landing")!;
  const helixWord =
    name
      .toUpperCase()
      .replace(/[^A-Z !?]/g, "")
      .slice(0, 8) || "LIFE";

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ================================================================== */}
      {/* hero: your name, as a molecule                                      */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 90% at 85% 10%, #d7f2ec 0%, transparent 60%), radial-gradient(50% 80% at 10% 100%, #ece9ff 0%, transparent 60%)",
          }}
        />
        {/* a strand drifting along the bottom edge */}
        <svg
          aria-hidden
          className="drift pointer-events-none absolute bottom-6 left-0 h-[90px] w-[200%] opacity-30"
          viewBox="0 0 1600 90"
          preserveAspectRatio="none"
        >
          {[0, Math.PI].map((ph, k) => (
            <path
              key={k}
              d={Array.from({ length: 161 }, (_, i) => {
                const y = 45 + Math.sin(i * 0.314 + ph) * 34;
                return `${i ? "L" : "M"}${i * 10},${y.toFixed(1)}`;
              }).join(" ")}
              fill="none"
              stroke={k ? "#4f46e5" : "#0d9488"}
              strokeWidth="1.6"
            />
          ))}
          {Array.from({ length: 80 }, (_, i) => {
            const x = i * 20 + 5;
            const a = 45 + Math.sin((x / 10) * 0.314) * 34;
            const b = 45 + Math.sin((x / 10) * 0.314 + Math.PI) * 34;
            return (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={a}
                y2={b}
                stroke={Object.values(BASE)[i % 4]}
                strokeWidth="2"
                opacity="0.55"
              />
            );
          })}
        </svg>

        <div className="relative mx-auto max-w-[1180px] px-6 pt-12 pb-28 sm:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mono inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11px] text-ink-2 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-storage" />
            An interactive lab · 3 chapters · 2 playgrounds
          </motion.div>

          <h1 className="mt-6 text-[44px] leading-[0.98] font-semibold tracking-tight text-ink sm:text-[68px] lg:text-[84px]">
            Write{" "}
            <span className="relative inline-block align-baseline">
              <input
                value={name}
                // one byte per character, so every letter lines up with its four bases
                onChange={(e) => setName(e.target.value.replace(/[^\x20-\x7e]/g, "").slice(0, 12))}
                spellCheck={false}
                aria-label="Type a word to encode"
                size={Math.max(3, name.length)}
                className="font-display max-w-[9ch] bg-transparent text-storage italic outline-none sm:max-w-none"
                style={{ width: `${Math.max(3, name.length) * 0.62}em` }}
              />
              <span className="absolute right-0 -bottom-1 left-0 h-[5px] rounded-full bg-storage/25" />
            </span>
            <br />
            into a molecule.
          </h1>

          <p className="mt-6 max-w-2xl text-[16.5px] leading-[1.7] text-ink-2">
            That is what this lab is about. Type anything above and watch it become DNA. Then learn
            how it is written, how it breaks, how a cell repairs it — and how evolution, given
            nothing but a score, can design the code that does it.
          </p>

          {/* ---- the live strand ------------------------------------------ */}
          <div className="mt-8 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              <AnimatePresence initial={false} mode="popLayout">
                {strand.map((c, i) => (
                  <motion.div
                    key={`${i}-${name[i]}`}
                    layout
                    initial={{ opacity: 0, y: 14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className="rounded-2xl border border-line bg-surface/90 px-2.5 pt-2 pb-2.5 shadow-[0_10px_30px_-22px_rgba(20,25,31,0.5)] backdrop-blur"
                  >
                    <div className="font-display text-center text-[22px] leading-none font-semibold text-ink">
                      {name[i] === " " ? "␣" : name[i]}
                    </div>
                    <div className="mono mt-1.5 text-center text-[9.5px] tracking-[0.12em] text-ink-3">
                      {c.bits}
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {c.bases.map((b, k) => (
                        <motion.span
                          key={k}
                          initial={{ rotateX: 90 }}
                          animate={{ rotateX: 0 }}
                          transition={{ delay: 0.05 * k, duration: 0.25 }}
                          className="mono flex h-7 w-6 items-center justify-center rounded-md text-[12px] font-bold text-white"
                          style={{ background: BASE[b] }}
                        >
                          {b}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="mono mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-3">
            <span>
              <strong className="text-ink">{bases}</strong> bases
            </span>
            <span>
              <strong className="text-ink">{bases * 2}</strong> bits
            </span>
            <span>
              weighs about <strong className="text-ink">{weigh(bases)}</strong>
            </span>
            <span>A·T and C·G pair, so the other strand writes itself</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/storage"
              className="group inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-[14px] font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Begin chapter 1
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={`/helix?word=${encodeURIComponent(helixWord)}`}
              className="group inline-flex items-center gap-2 rounded-xl border border-storage/40 bg-surface px-5 py-3 text-[14px] font-medium text-storage transition-transform hover:-translate-y-0.5"
            >
              Break “{helixWord}” in the Helix Lab
              <ArrowUpRight size={15} />
            </Link>
            <span className="mono hidden items-center gap-1.5 text-[11.5px] text-ink-3 sm:inline-flex">
              or press <Command size={11} /> K to jump anywhere
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* a marquee of facts                                                  */}
      {/* ================================================================== */}
      <div className="overflow-hidden border-b border-line bg-ink py-3 text-paper">
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...FACTS, ...FACTS].map((f, i) => (
            <span key={i} className="mono flex items-center gap-10 text-[12px] tracking-wide">
              {f}
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: Object.values(BASE)[i % 4] }}
              />
            </span>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* the map                                                             */}
      {/* ================================================================== */}
      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow text-ink-3">The map</span>
            <h2 className="mt-2 text-[30px] leading-tight font-semibold text-ink sm:text-[40px]">
              Two ideas, then the moment they meet.
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-ink-3">
            Chapters 1 and 2 share nothing and can be read in either order. Chapter 3 joins them.
            The playgrounds branch off whenever you want to break something.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-6">
          {/* ---- chapters 1 and 2 ---------------------------------------- */}
          {[m1, m2].map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="lg:col-span-3"
            >
              <ChapterCard m={m} visited={visited.includes(m.id)} />
            </motion.div>
          ))}

          {/* ---- where they meet ------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-6"
          >
            <Link
              href={m3.href}
              className="group relative grid overflow-hidden rounded-3xl p-6 text-white sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8"
              style={{
                background: `linear-gradient(115deg, #16191f 0%, #2a1520 55%, ${m3.accent} 140%)`,
              }}
            >
              <span
                aria-hidden
                className="font-display pointer-events-none absolute -top-8 -right-4 text-[220px] leading-none font-semibold text-white/[0.05]"
              >
                03
              </span>
              <div className="relative">
                <div className="mono text-[11px] font-bold tracking-[0.18em] text-rose-300 uppercase">
                  Chapter 3 · the mixer
                </div>
                <h3 className="font-display mt-2 text-[30px] leading-tight font-semibold sm:text-[38px]">
                  {m3.name}
                </h3>
                <p className="mt-2 text-[15px] text-white/80">{m3.tagline}</p>
                <p className="mt-3 max-w-md text-[13.5px] leading-[1.65] text-white/65">
                  {m3.blurb}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-transform group-hover:translate-x-1">
                  Open chapter 3 <ArrowRight size={15} />
                </span>
              </div>
              {/* the junction: storage and evolution flowing into one */}
              <div className="relative mt-8 md:mt-0">
                <svg
                  viewBox="0 0 360 200"
                  className="mx-auto h-auto max-h-[230px] w-full"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id="flowA" x1="0" x2="1">
                      <stop offset="0" stopColor={m1.accent} />
                      <stop offset="1" stopColor={m3.accent} />
                    </linearGradient>
                    <linearGradient id="flowB" x1="0" x2="1">
                      <stop offset="0" stopColor={m2.accent} />
                      <stop offset="1" stopColor={m3.accent} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M20 40 C 150 40, 160 100, 250 100"
                    stroke="url(#flowA)"
                    strokeWidth="3"
                    fill="none"
                    className="flowline"
                  />
                  <path
                    d="M20 160 C 150 160, 160 100, 250 100"
                    stroke="url(#flowB)"
                    strokeWidth="3"
                    fill="none"
                    className="flowline"
                  />
                  <rect
                    x="4"
                    y="24"
                    width="96"
                    height="32"
                    rx="9"
                    fill="#0d948833"
                    stroke={m1.accent}
                  />
                  <text
                    x="52"
                    y="44"
                    textAnchor="middle"
                    className="mono"
                    fontSize="10.5"
                    fill="#5eead4"
                  >
                    STORAGE
                  </text>
                  <rect
                    x="4"
                    y="144"
                    width="96"
                    height="32"
                    rx="9"
                    fill="#4f46e533"
                    stroke={m2.accent}
                  />
                  <text
                    x="52"
                    y="164"
                    textAnchor="middle"
                    className="mono"
                    fontSize="10.5"
                    fill="#a5b4fc"
                  >
                    EVOLUTION
                  </text>
                  <circle
                    cx="290"
                    cy="100"
                    r="42"
                    fill={`${m3.accent}40`}
                    stroke={m3.accent}
                    strokeWidth="2"
                  />
                  <circle
                    cx="290"
                    cy="100"
                    r="54"
                    fill="none"
                    stroke={m3.accent}
                    strokeOpacity="0.35"
                    strokeDasharray="3 5"
                    className="spin-slow"
                    style={{ transformOrigin: "290px 100px" }}
                  />
                  <text
                    x="290"
                    y="96"
                    textAnchor="middle"
                    className="mono"
                    fontSize="10"
                    fill="#fecdd3"
                  >
                    a scheme
                  </text>
                  <text
                    x="290"
                    y="110"
                    textAnchor="middle"
                    className="mono"
                    fontSize="10"
                    fill="#fecdd3"
                  >
                    that evolved
                  </text>
                </svg>
              </div>
            </Link>
          </motion.div>

          {/* ---- the playgrounds ------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-3"
          >
            <Link
              href={helix.href}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#1e2b3b] bg-[#0b1220] text-slate-200"
            >
              <div className="relative">
                <Helix strand="GATTACAGCTAGCTTACGATCGATGCATGCAGTC" height={200} speed={0.5} />
                <span className="mono absolute top-3 left-4 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-teal-300 backdrop-blur">
                  PLAYGROUND · LIVE
                </span>
              </div>
              <div className="flex flex-1 flex-col border-t border-white/[0.07] p-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[20px] font-semibold text-white">{helix.name}</h3>
                  {visited.includes(helix.id) && <Check size={14} className="text-teal-300" />}
                </div>
                <p className="mt-1.5 flex-1 text-[13.5px] leading-[1.6] text-slate-400">
                  Hit your word with sunlight, oxygen and radiation, then watch named enzymes find
                  the damage and put it back — and see what happens when they are too slow.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-teal-300">
                  Open the molecule
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.08, duration: 0.45 }}
            className="lg:col-span-3"
          >
            <Link
              href={landing.href}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface"
            >
              <div className="relative h-[200px] overflow-hidden">
                <HeroDemo height={200} />
                <span className="mono pointer-events-none absolute bottom-3 left-4 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-orange-700 backdrop-blur">
                  PLAYGROUND · LIVE
                </span>
              </div>
              <div className="flex flex-1 flex-col border-t border-line p-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[20px] font-semibold text-ink">{landing.name}</h3>
                  {visited.includes(landing.id) && (
                    <Check size={14} style={{ color: landing.accent }} />
                  )}
                </div>
                <p className="mt-1.5 flex-1 text-[13.5px] leading-[1.6] text-ink-2">
                  A booster that cannot hover, a hoverslam you will probably fail, and a genetic
                  algorithm that learns it by crashing forty rockets at a time.
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium"
                  style={{ color: landing.accent }}
                >
                  Try to land it
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* why bother                                                          */}
      {/* ================================================================== */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1180px] px-6 py-16">
          <span className="eyebrow text-ink-3">Why bother</span>
          <h2 className="mt-2 max-w-3xl text-[30px] leading-tight font-semibold text-ink sm:text-[40px]">
            The densest, longest-lasting storage medium we know of is already in every one of your
            cells.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                n: "215",
                u: "petabytes per gram",
                d: "What Erlich and Zielinski packed into DNA in 2017. A hard drive manages a few hundred gigabytes per gram of platter.",
                c: m1.accent,
              },
              {
                n: "521",
                u: "year half-life",
                d: "How long a DNA bond lasts in bone, measured from fossil moa. Kept cold and dry it is readable for far longer: we have sequenced million-year-old mammoths.",
                c: m2.accent,
              },
              {
                n: "1 in 10⁹",
                u: "errors after repair",
                d: "Writing and reading DNA is slow and error-prone. Cells beat that with repair — which is exactly the problem these chapters are about.",
                c: m3.accent,
              },
            ].map((x) => (
              <div key={x.u} className="border-t-2 pt-4" style={{ borderColor: x.c }}>
                <div className="font-display text-[46px] leading-none font-semibold text-ink">
                  {x.n}
                </div>
                <div
                  className="mono mt-1 text-[11px] font-bold tracking-[0.14em] uppercase"
                  style={{ color: x.c }}
                >
                  {x.u}
                </div>
                <p className="mt-3 text-[14px] leading-[1.65] text-ink-2">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 text-[12px] text-ink-3">
          <span>DNA and GA Lab — educational simulation. No biological DNA is synthesised.</span>
          <Link href="/references" className="hover:text-ink">
            Sources &amp; further reading →
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ChapterCard({ m, visited }: { m: (typeof MODELS)[number]; visited: boolean }) {
  return (
    <Link
      href={m.href}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 transition-shadow hover:shadow-[0_24px_60px_-34px_rgba(20,25,31,0.5)]"
    >
      <span
        aria-hidden
        className="font-display pointer-events-none absolute -top-6 -right-2 text-[150px] leading-none font-semibold select-none"
        style={{ color: "transparent", WebkitTextStroke: `1.5px ${m.accent}33` }}
      >
        0{m.num}
      </span>
      <div className="relative flex items-center gap-2">
        <span
          className="mono rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{ background: m.soft, color: m.accent }}
        >
          CHAPTER {m.num}
        </span>
        {visited && (
          <span className="mono flex items-center gap-1 text-[10.5px]" style={{ color: m.accent }}>
            <Check size={12} /> visited
          </span>
        )}
      </div>
      <h3 className="font-display relative mt-4 text-[28px] leading-tight font-semibold text-ink">
        {m.name}
      </h3>
      <p className="relative mt-1 text-[14.5px] font-medium text-ink-2">{m.tagline}</p>
      <p className="relative mt-3 flex-1 text-[13.5px] leading-[1.65] text-ink-3">{m.blurb}</p>

      {/* the chapter's steps as a little sequence */}
      <div className="relative mt-5 flex flex-wrap items-center gap-1.5">
        {m.steps.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-3" style={{ background: `${m.accent}66` }} />}
            <span
              className="mono rounded-md border px-2 py-1 text-[11px]"
              style={{ borderColor: `${m.accent}40`, color: m.accent, background: `${m.soft}` }}
            >
              {s}
            </span>
          </span>
        ))}
        <span
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform group-hover:translate-x-1"
          style={{ background: m.accent }}
        >
          <ArrowRight size={17} />
        </span>
      </div>
    </Link>
  );
}
