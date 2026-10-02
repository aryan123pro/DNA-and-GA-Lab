"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle, Note } from "@/components/ui";

// canvas, file uploads and a few hundred thousand bases: browser only
const ArchiveLab = dynamic(() => import("@/components/archive/ArchiveLab"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-3xl bg-[#0f0d24]">
      <span className="mono text-[12px] text-slate-400">opening the archive…</span>
    </div>
  ),
});

const ACCENT = "#7c3aed";

export default function RandomAccessPage() {
  return (
    <div className="min-h-screen">
      <div
        className="relative overflow-hidden border-b border-line"
        style={{
          background: "radial-gradient(80% 140% at 100% 0%, #e9ddff 0%, #f3edff 40%, #fbfaf7 100%)",
        }}
      >
        <div className="relative mx-auto max-w-[1120px] px-5 py-9">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
          >
            <ArrowLeft size={12} /> Home
          </Link>
          <div
            className="mono mt-3 text-[11px] font-bold tracking-[0.16em] uppercase"
            style={{ color: ACCENT }}
          >
            Playground · random access
          </div>
          <h1 className="mt-1 text-[34px] leading-[1.05] font-semibold text-ink sm:text-[46px]">
            Random Access Lab
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            A whole book, written into DNA and poured into a single tube — seven thousand strands,
            all mixed together. Now get chapter seven back without reading the rest. This is how
            real DNA archives find one file among many: with nothing but a pair of primers and PCR.
            Bring your own book too — a text file or any PDF, read right here in your browser.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] space-y-10 px-5 py-8">
        <ArchiveLab />

        <section className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardTitle hint="Why a tube needs an index.">There are no folders in DNA</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              A tube of DNA is a soup. There is no first strand and no last one, no directory, no
              way to seek. Every strand carries its own address, and every file carries its own
              primers — that pair of 20-base sequences is the only way to ask for one file and not
              the rest.
            </p>
          </Card>
          <Card>
            <CardTitle hint="What PCR actually does here.">Copying is the search</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              PCR does not find the chapter; it drowns everything else out. Each cycle roughly
              doubles the strands whose ends match the primers and leaves the rest alone, so after
              eighteen cycles the chapter you asked for is over 99.9% of what is in the tube. Set
              the cycles to zero and watch most of your reads go to other chapters.
            </p>
          </Card>
          <Card>
            <CardTitle hint="The real experiment this follows.">Done for real in 2018</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              Organick and colleagues at the University of Washington and Microsoft stored 35 files
              — over 200 MB, including a music video — in 13.4 million strands, and pulled any one
              file out with its primers. This lab is the same design at the scale of one book.
            </p>
          </Card>
        </section>

        <Note accent={ACCENT} title="What is simplified">
          Strands here are 136 bases with a 20-byte payload; sequencing errors are substitutions
          only; copy numbers are relative rather than counted molecules; and instead of a rotation
          code that forbids repeated bases, the payload is scrambled, which keeps runs short on
          average but not always. Missing pieces are shown rather than rebuilt — a real archive adds
          an outer Reed–Solomon code across strands to fill them in. The book is{" "}
          <em>Alice&apos;s Adventures in Wonderland</em> from Project Gutenberg, in the public
          domain.
        </Note>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          DNA and GA Lab — educational simulation. No biological DNA is synthesised.
        </div>
      </footer>
    </div>
  );
}
