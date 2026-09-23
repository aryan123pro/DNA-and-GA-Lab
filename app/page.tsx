"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Helix from "@/components/Helix";
import { TopBar } from "@/components/ModelShell";
import { MODELS } from "@/lib/models";

function CardArt({ id, accent }: { id: string; accent: string }) {
  if (id === "storage") {
    return (
      <svg viewBox="0 0 220 64" className="h-16 w-full" aria-hidden>
        {["01001000", "01001001"].map((byte, r) =>
          byte.split("").map((b, i) => (
            <text
              key={`${r}-${i}`}
              x={6 + i * 12}
              y={16 + r * 14}
              className="mono"
              fontSize="10"
              fill="#7b8592"
            >
              {b}
            </text>
          )),
        )}
        <path d="M104 24 h14" stroke={accent} strokeWidth="1.5" />
        <path d="M114 20 l5 4 -5 4" fill="none" stroke={accent} strokeWidth="1.5" />
        {["A", "C", "G", "T", "G", "A", "T", "C"].map((b, i) => (
          <g key={i}>
            <rect
              x={128 + i * 11}
              y={12}
              width="9"
              height="24"
              rx="2"
              fill={
                { A: "#2563eb", C: "#ea580c", G: "#16a34a", T: "#9333ea" }[b as "A"] + "22"
              }
            />
            <text
              x={132.5 + i * 11}
              y={28}
              className="mono"
              fontSize="9"
              fontWeight="700"
              fill={{ A: "#2563eb", C: "#ea580c", G: "#16a34a", T: "#9333ea" }[b as "A"]}
            >
              {b}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  if (id === "genetic") {
    return (
      <svg viewBox="0 0 220 64" className="h-16 w-full" aria-hidden>
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            {Array.from({ length: 14 }).map((_, c) => {
              const on = (c * 3 + r * 5) % 7 < 3 + r;
              return (
                <rect
                  key={c}
                  x={6 + c * 13}
                  y={6 + r * 14}
                  width="11"
                  height="9"
                  rx="2"
                  fill={on ? accent : "#e7e3da"}
                  opacity={on ? 0.25 + r * 0.25 : 1}
                />
              );
            })}
          </g>
        ))}
        <path
          d="M6 58 C 60 56, 120 30, 214 10"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 220 64" className="h-16 w-full" aria-hidden>
      <rect x="6" y="18" width="62" height="28" rx="6" fill="#0d948814" />
      <text x="16" y="36" className="mono" fontSize="9" fill="#0d9488">
        STORAGE
      </text>
      <rect x="152" y="18" width="62" height="28" rx="6" fill="#4f46e514" />
      <text x="164" y="36" className="mono" fontSize="9" fill="#4f46e5">
        GA
      </text>
      <circle cx="110" cy="32" r="16" fill={`${accent}14`} />
      <text x="103" y="36" className="mono" fontSize="11" fontWeight="700" fill={accent}>
        ×
      </text>
      <path d="M70 32 h22" stroke="#0d9488" strokeWidth="1.5" className="flowline" />
      <path d="M128 32 h22" stroke="#4f46e5" strokeWidth="1.5" className="flowline" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <TopBar />

      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <span className="eyebrow text-storage">Interactive coursework · 3 models</span>
            <h1 className="mt-3 text-[38px] leading-[1.05] font-semibold text-ink sm:text-[52px]">
              Storing data in DNA,
              <br />
              and teaching evolution
              <br />
              to design the code.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.7] text-ink-2">
              Three separate models, built to be understood in order. The first is about
              molecular storage on its own. The second is about genetic algorithms on their
              own. The third is what happens when you point one at the other.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/storage"
                className="inline-flex items-center gap-2 rounded-lg bg-storage px-5 py-3 text-[14px] font-medium text-white hover:brightness-110"
              >
                Start with Model 1 <ArrowRight size={15} />
              </Link>
              <Link
                href="/references"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-3 text-[14px] font-medium text-ink-2 hover:bg-sunken"
              >
                Where this comes from
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-panel">
            <div className="flex items-center justify-between border-b border-panel-line px-4 py-2.5">
              <span className="eyebrow text-panel-ink-2">Double helix</span>
              <span className="mono text-[11px] text-panel-ink-2">A·T · C·G</span>
            </div>
            <Helix strand="ACGTTGCAGCTAACGTGGCATTACGCATGACGTTGCA" height={300} speed={0.45} />
            <div className="border-t border-panel-line px-4 py-3 text-[12px] leading-relaxed text-panel-ink-2">
              Two strands, four letters, and every letter paired with exactly one partner.
              That pairing is what makes DNA copyable — and what makes it a storage medium.
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[1120px] px-5 py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow text-ink-3">Pick a model</span>
            <h2 className="mt-2 text-[26px] font-semibold text-ink sm:text-[30px]">
              Each one stands on its own
            </h2>
          </div>
          <p className="max-w-md text-[14px] leading-relaxed text-ink-3">
            Models 1 and 2 share no settings and no code path. You can read either one first.
            Model 3 only makes sense after both.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {MODELS.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
            >
              <Link
                href={m.href}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-[0_8px_30px_-16px_rgba(20,25,31,0.35)]"
              >
                <div
                  className="mb-4 rounded-xl px-3 py-3"
                  style={{ background: m.soft }}
                >
                  <CardArt id={m.id} accent={m.accent} />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="mono flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: m.accent }}
                  >
                    {m.num}
                  </span>
                  <span className="eyebrow" style={{ color: m.accent }}>
                    Model {m.num}
                  </span>
                </div>
                <h3 className="mt-2 text-[20px] leading-tight font-semibold text-ink">
                  {m.name}
                </h3>
                <p className="mt-1 text-[13.5px] font-medium text-ink-3">{m.tagline}</p>
                <p className="mt-3 flex-1 text-[14px] leading-[1.6] text-ink-2">{m.blurb}</p>
                <div className="mt-4 flex items-center gap-1.5 border-t border-line-soft pt-3">
                  <span className="mono text-[11px] text-ink-3">
                    {m.steps.join(" → ")}
                  </span>
                  <ArrowRight
                    size={14}
                    className="ml-auto transition-transform group-hover:translate-x-0.5"
                    style={{ color: m.accent }}
                  />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1120px] px-5 py-14">
          <span className="eyebrow text-ink-3">Why bother</span>
          <h2 className="mt-2 max-w-2xl text-[26px] leading-snug font-semibold text-ink sm:text-[30px]">
            One gram of DNA could hold every film ever made, and still be readable in a
            thousand years.
          </h2>
          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {[
              [
                "Density",
                "A hard drive stores about 10 gigabytes per gram. DNA is millions of times denser, because the information sits in single molecules instead of magnetic grains.",
              ],
              [
                "Lifetime",
                "Magnetic tape needs rewriting every decade. DNA kept cool and dry survives for centuries — we have sequenced DNA from animals that died a million years ago.",
              ],
              [
                "The catch",
                "Writing and reading DNA is slow, expensive, and makes mistakes. That is exactly the problem these three models are about.",
              ],
            ].map(([t, d]) => (
              <div key={t}>
                <h3 className="text-[16px] font-semibold text-ink">{t}</h3>
                <p className="mt-2 text-[14px] leading-[1.65] text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 text-[12px] text-ink-3">
          <span>
            The DNA Lab — educational simulation. No biological DNA is synthesised.
          </span>
          <Link href="/references" className="hover:text-ink">
            Sources &amp; further reading
          </Link>
        </div>
      </footer>
    </div>
  );
}
