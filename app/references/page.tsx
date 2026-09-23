"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TopBar } from "@/components/ModelShell";
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

export default function ReferencesPage() {
  return (
    <div className="min-h-screen">
      <TopBar />

      <div className="border-b border-line bg-sunken">
        <div className="mx-auto max-w-[1120px] px-5 py-10">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
          >
            <ArrowLeft size={12} /> All three models
          </Link>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold text-ink sm:text-[36px]">
            Where this comes from
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Everything in these three models is a simplified version of real published work.
            If a page made you curious, start here.
          </p>
        </div>
      </div>

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
              These models are deliberately simplified for a first-year audience. Real DNA
              archives split data across millions of short strands with address labels, and
              protect them with much stronger codes than the majority vote used here.
            </p>
            <p>
              The damage simulation treats every base independently, which real degradation
              does not. And no biological DNA is involved anywhere — everything runs as
              arithmetic in your browser.
            </p>
          </div>
        </Card>

        <Note accent="#0d9488" title="Inspired by">
          The three-stage encode → damage → recover flow follows the structure of the
          &ldquo;DNA Data Survivor&rdquo; demo that this project was asked to build on.
        </Note>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          The DNA Lab — educational simulation.
        </div>
      </footer>
    </div>
  );
}
