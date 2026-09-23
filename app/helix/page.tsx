"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/ModelShell";
import { Card, CardTitle, Note } from "@/components/ui";

// deck.gl needs a browser: no server rendering.
const HelixLab = dynamic(() => import("@/components/HelixLab"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-xl bg-panel">
      <span className="mono text-[12px] text-panel-ink-2">building the molecule…</span>
    </div>
  ),
});

export default function HelixPage() {
  return (
    <div className="min-h-screen">
      <TopBar />

      <div className="border-b border-line bg-storage-soft">
        <div className="mx-auto max-w-[1120px] px-5 py-8">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
          >
            <ArrowLeft size={12} /> All three models
          </Link>
          <div className="mono mt-3 text-[11px] font-bold tracking-[0.16em] text-storage uppercase">
            Playground
          </div>
          <h1 className="mt-1 text-[30px] leading-[1.1] font-semibold text-ink sm:text-[38px]">
            Helix Lab
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            A real double helix with your word written into it, and real gravity underneath.
            Break a base and watch it fall off the backbone — then watch what that does to the
            word.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] space-y-6 px-5 py-8">
        <HelixLab />

        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardTitle hint="Why the molecule is shaped like this.">Two strands, one code</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              The coloured spheres on the near strand carry your message. The faded ones behind
              them are their partners — A always pairs with T, C always with G. That pairing is
              pure redundancy: if one strand is damaged, the other still holds the answer. It is
              the reason most of the repair pathways in Model 1 work at all.
            </p>
          </Card>
          <Card>
            <CardTitle hint="What the falling actually means.">Gravity is the point</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              When a base is knocked off, the sugar-phosphate backbone stays intact — you can see
              it still spiralling with an empty seat. That is exactly what base excision repair
              leaves behind: a gap on an otherwise healthy strand, waiting for a polymerase to
              drop the right letter back in.
            </p>
          </Card>
          <Card>
            <CardTitle hint="The lesson worth taking away.">Losing beats changing</CardTitle>
            <p className="text-[13.5px] leading-[1.65] text-ink-2">
              Try mutating five bases, then rebuild and knock a single one off instead. Mutations
              damage the letters they touch. A deletion shifts every base after it into the wrong
              seat, so one lost base can destroy everything downstream.
            </p>
          </Card>
        </div>

        <Note accent="#0d9488" title="Where to go next">
          Once you have wrecked a few strands here, Model 1 step 3 shows the six pathways a cell
          uses to put them back together — and lets you test each one against damage you choose.
        </Note>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          The DNA Lab — educational simulation. No biological DNA is synthesised.
        </div>
      </footer>
    </div>
  );
}
