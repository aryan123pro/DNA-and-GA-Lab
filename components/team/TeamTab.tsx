"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { textToBytes } from "@/lib/dna";
import { COHORT, TEAM, TEAM_PHOTO, Member } from "@/lib/team";
import { DECK } from "@/lib/deck";

const BASE_HEX: Record<string, string> = {
  A: "#2563eb",
  C: "#ea580c",
  G: "#16a34a",
  T: "#9333ea",
};
const LETTERS = ["A", "C", "G", "T"];

/** A name written the way every lab here writes text: two bits a base. */
function toBases(text: string) {
  const out: string[] = [];
  for (const byte of textToBytes(text)) {
    for (let k = 6; k >= 0; k -= 2) out.push(LETTERS[(byte >> k) & 3]);
  }
  return out;
}

function MemberCard({ m, i }: { m: Member; i: number }) {
  const first = m.name.split(" ")[0];
  const bases = toBases(first);
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: i * 0.08, duration: 0.45 }}
      className="group overflow-hidden rounded-3xl border border-line bg-surface transition-shadow hover:shadow-[0_26px_60px_-34px_rgba(20,25,31,0.55)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sunken">
        <Image
          src={m.photo}
          alt={m.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ objectPosition: m.focus }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="mono absolute right-3 bottom-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink backdrop-blur">
          {m.roll}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-display text-[21px] leading-tight font-semibold text-ink">{m.name}</h3>
        <div className="mono mt-0.5 text-[11.5px] text-ink-3">Roll no. {m.roll}</div>
        <div className="mono mt-0.5 text-[11px] text-ink-3">
          {COHORT.short} · Sem 1 · {COHORT.year} · Div {COHORT.division}
        </div>
        <div className="mt-3">
          <div className="mono mb-1 text-[9.5px] tracking-[0.16em] text-ink-3 uppercase">
            “{first}” in DNA
          </div>
          <div className="flex flex-wrap gap-[3px]">
            {bases.map((b, k) => (
              <span
                key={k}
                className="mono flex h-5 w-[18px] items-center justify-center rounded-[4px] text-[9.5px] font-bold text-white"
                style={{ background: BASE_HEX[b] }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function TeamTab() {
  return (
    <main className="mx-auto max-w-[1120px] space-y-10 px-4 py-8 sm:px-5 sm:py-10">
      {/* ---- the four of us ------------------------------------------------ */}
      <section className="relative overflow-hidden rounded-3xl bg-ink">
        <div className="relative aspect-[4/3] sm:aspect-[16/9]">
          <Image
            src={TEAM_PHOTO}
            alt="The team together"
            fill
            priority
            sizes="(min-width: 1120px) 1120px, 100vw"
            className="object-cover"
            style={{ objectPosition: "50% 40%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.16em] text-white uppercase backdrop-blur">
              The team
            </span>
            <span className="mono rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] text-ink">
              {COHORT.short} · {COHORT.semester} · {COHORT.year} · Division {COHORT.division}
            </span>
          </div>
          <h2 className="font-display mt-3 text-[30px] leading-[1.05] font-semibold text-white sm:text-[48px]">
            The people behind the lab.
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/80 sm:text-[15.5px]">
            {COHORT.programme}, {COHORT.semester} {COHORT.year}, Division {COHORT.division}. We
            built this lab alongside our presentation, “{DECK.title}”.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TEAM.map((m) => (
              <span
                key={m.roll}
                className="mono flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] text-white backdrop-blur"
              >
                {m.name} · {m.roll}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---- one card each ------------------------------------------------- */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m, i) => (
            <MemberCard key={m.roll} m={m} i={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
