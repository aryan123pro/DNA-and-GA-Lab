"use client";

import { motion } from "framer-motion";
import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Panel, SectionHead, cx } from "../ui";

type Ref = { title: string; where: string; url: string; tag: "storage" | "ga" | "ecc" | "bg" };

const REFS: Ref[] = [
  {
    title: "Next-Generation Digital Information Storage in DNA",
    where: "Church, Gao & Kosuri — Science (2012)",
    url: "https://www.science.org/doi/10.1126/science.1226355",
    tag: "storage",
  },
  {
    title: "Towards practical, high-capacity, low-maintenance information storage in synthesized DNA",
    where: "Goldman et al. — Nature 494, 77–80 (2013)",
    url: "https://www.nature.com/articles/nature11875",
    tag: "storage",
  },
  {
    title: "DNA Fountain enables a robust and efficient storage architecture",
    where: "Erlich & Zielinski — Science 355, 950–954 (2017)",
    url: "https://www.science.org/doi/10.1126/science.aaj2038",
    tag: "ecc",
  },
  {
    title: "Random access in large-scale DNA data storage",
    where: "Organick et al. — Nature Biotechnology 36, 242–248 (2018)",
    url: "https://www.nature.com/articles/nbt.4079",
    tag: "storage",
  },
  {
    title: "Molecular digital data storage using DNA",
    where: "Ceze, Nivala & Strauss — Nature Reviews Genetics 20, 456–466 (2019)",
    url: "https://www.nature.com/articles/s41576-019-0125-3",
    tag: "storage",
  },
  {
    title: "Robust chemical preservation of digital information on DNA in silica with error-correcting codes",
    where: "Grass et al. — Angewandte Chemie 54, 2552–2555 (2015)",
    url: "https://onlinelibrary.wiley.com/doi/10.1002/anie.201411378",
    tag: "ecc",
  },
  {
    title: "A DNA-based archival storage system",
    where: "Bornholt et al. — ASPLOS '16",
    url: "https://dl.acm.org/doi/10.1145/2872362.2872397",
    tag: "storage",
  },
  {
    title: "Forward error correction for DNA data storage",
    where: "Blawat et al. — Procedia Computer Science 80 (2016)",
    url: "https://www.sciencedirect.com/science/article/pii/S1877050916308262",
    tag: "ecc",
  },
  {
    title: "HEDGES error-correcting code for DNA storage corrects indels and allows sequence constraints",
    where: "Press, Hawkins, Jones & Schaub — PNAS 117, 18489–18496 (2020)",
    url: "https://www.pnas.org/doi/10.1073/pnas.2004821117",
    tag: "ecc",
  },
  {
    title: "Data storage in DNA with fewer synthesis cycles using composite DNA letters",
    where: "Anavy et al. — Nature Biotechnology 37, 1229–1236 (2019)",
    url: "https://www.nature.com/articles/s41587-019-0240-x",
    tag: "storage",
  },
  {
    title: "Adaptation in Natural and Artificial Systems (the origin of the genetic algorithm)",
    where: "John H. Holland — University of Michigan Press (1975)",
    url: "https://mitpress.mit.edu/9780262581110/adaptation-in-natural-and-artificial-systems/",
    tag: "ga",
  },
  {
    title: "Genetic Algorithms in Search, Optimization and Machine Learning",
    where: "David E. Goldberg — Addison-Wesley (1989)",
    url: "https://dl.acm.org/doi/book/10.5555/534133",
    tag: "ga",
  },
  {
    title: "An Introduction to Genetic Algorithms",
    where: "Melanie Mitchell — MIT Press (1996)",
    url: "https://mitpress.mit.edu/9780262631853/an-introduction-to-genetic-algorithms/",
    tag: "ga",
  },
  {
    title: "A fast and elitist multiobjective genetic algorithm: NSGA-II",
    where: "Deb et al. — IEEE Trans. Evolutionary Computation 6, 182–197 (2002)",
    url: "https://ieeexplore.ieee.org/document/996017",
    tag: "ga",
  },
  {
    title: "Genetic Algorithms — tutorial",
    where: "GeeksforGeeks",
    url: "https://www.geeksforgeeks.org/genetic-algorithms/",
    tag: "ga",
  },
  {
    title: "Polynomial codes over certain finite fields (Reed–Solomon codes)",
    where: "Reed & Solomon — J. SIAM 8, 300–304 (1960)",
    url: "https://epubs.siam.org/doi/10.1137/0108018",
    tag: "ecc",
  },
  {
    title: "LT Codes (fountain codes)",
    where: "Michael Luby — FOCS 2002",
    url: "https://ieeexplore.ieee.org/document/1181950",
    tag: "ecc",
  },
  {
    title: "Sequencing of 1-million-year-old mammoth genomes — DNA longevity in practice",
    where: "van der Valk et al. — Nature 591, 265–269 (2021)",
    url: "https://www.nature.com/articles/s41586-021-03224-9",
    tag: "bg",
  },
  {
    title: "DNA Data Storage Alliance",
    where: "Industry consortium (SNIA)",
    url: "https://dnastoragealliance.org/",
    tag: "bg",
  },
  {
    title: "Homopolymer and GC-content effects on Illumina sequencing quality",
    where: "Ross et al. — Genome Biology 14, R51 (2013)",
    url: "https://genomebiology.biomedcentral.com/articles/10.1186/gb-2013-14-5-r51",
    tag: "bg",
  },
];

const TAGS = {
  storage: { label: "DNA storage", tone: "#2dd4a7" },
  ga: { label: "Genetic algorithms", tone: "#7c6cff" },
  ecc: { label: "Error correction", tone: "#b06bff" },
  bg: { label: "Background", tone: "#22b8ff" },
} as const;

export default function References() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<keyof typeof TAGS | "all">("all");

  const list = useMemo(
    () =>
      REFS.filter(
        (r) =>
          (tag === "all" || r.tag === tag) &&
          (q === "" ||
            `${r.title} ${r.where} ${r.url}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, tag],
  );

  return (
    <div className="space-y-4">
      <SectionHead
        step={8}
        kicker="Literature"
        title="Everything this simulation is built on"
        body="Primary sources for DNA data storage, the error-correcting codes real archives use, and the genetic-algorithm literature behind the optimiser. Every link opens the publisher's page."
        accent="#8b9bb4"
      />

      <Panel accent="#8b9bb4">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5">
            <Search size={14} className="text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, author, journal or URL…"
              className="mono w-full bg-transparent text-[12px] text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTag("all")}
              className={cx(
                "mono cursor-pointer rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase",
                tag === "all"
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-slate-400",
              )}
            >
              All {REFS.length}
            </button>
            {(Object.keys(TAGS) as (keyof typeof TAGS)[]).map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className="mono cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase"
                style={{
                  color: TAGS[t].tone,
                  background: tag === t ? `${TAGS[t].tone}26` : `${TAGS[t].tone}0d`,
                  border: `1px solid ${TAGS[t].tone}${tag === t ? "88" : "33"}`,
                }}
              >
                {TAGS[t].label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r, i) => (
          <motion.a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noreferrer noopener"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.4) }}
            whileHover={{ y: -3 }}
            className="glass group flex items-start gap-3 rounded-2xl p-4 transition-colors"
            style={{ borderColor: `${TAGS[r.tag].tone}33` }}
          >
            <span
              className="mono mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
              style={{
                color: TAGS[r.tag].tone,
                background: `${TAGS[r.tag].tone}18`,
                border: `1px solid ${TAGS[r.tag].tone}44`,
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] leading-snug font-semibold text-slate-100 group-hover:text-white">
                {r.title}
              </div>
              <div className="mono mt-1 text-[10px] text-slate-500">{r.where}</div>
              <div className="mt-2">
                <Badge tone={TAGS[r.tag].tone} soft>
                  {TAGS[r.tag].label}
                </Badge>
              </div>
            </div>
            <ExternalLink
              size={14}
              className="ml-auto shrink-0 text-slate-600 group-hover:text-slate-300"
            />
          </motion.a>
        ))}
      </div>

      {list.length === 0 && (
        <p className="mono py-10 text-center text-[12px] text-slate-600">
          No references match “{q}”.
        </p>
      )}

      <Panel accent="#2dd4a7">
        <div className="p-5 text-[11px] leading-relaxed text-slate-500">
          <span className="mono font-bold text-teal">Honest scope note. </span>
          The codec search implemented here (evolving a codon table, whitening key, homopolymer
          cap and ECC family under a multi-objective fitness) is an educational construction
          built for this presentation. It is inspired by the constrained-code design problem
          described in the papers above; it is not a reproduction of any single published
          system.
        </div>
      </Panel>
    </div>
  );
}
