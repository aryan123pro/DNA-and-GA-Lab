"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle, Fade, Note, SectionHeading, StepRail } from "@/components/ui";
import { MIN_THROTTLE } from "@/lib/rocket/physics";
import { useSteps } from "@/lib/nav";

const ACCENT = "#ea580c";
const SOFT = "#fdf0e7";

function loading(h: number) {
  const SceneLoading = () => (
    <div className="flex items-center justify-center rounded-xl bg-panel" style={{ height: h }}>
      <span className="mono text-[12px] text-panel-ink-2">spinning up the simulator…</span>
    </div>
  );
  SceneLoading.displayName = "SceneLoading";
  return SceneLoading;
}

// deck.gl needs a browser: no server rendering.
const FlyItYourself = dynamic(() => import("@/components/rocket/FlyItYourself"), {
  ssr: false,
  loading: loading(420),
});
const EvolveLab = dynamic(() => import("@/components/rocket/EvolveLab"), {
  ssr: false,
  loading: loading(440),
});
const ShowdownLab = dynamic(() => import("@/components/rocket/ShowdownLab"), {
  ssr: false,
  loading: loading(300),
});
const HeroDemo = dynamic(() => import("@/components/rocket/HeroDemo"), {
  ssr: false,
  loading: loading(340),
});

const STEPS = [
  { id: "0", label: "Land it yourself" },
  { id: "1", label: "Evolve" },
  { id: "2", label: "Memoriser vs pilot" },
  { id: "3", label: "What actually flies" },
];

export default function LandingPage() {
  // a step picked from ⌘K before this page had loaded
  const [step, setStep] = useState(() => {
    const pending = useSteps.getState().take("landing");
    return pending !== null ? String(pending) : "0";
  });
  const idx = Number(step);

  // share the step with the rail and the ⌘K palette
  useEffect(() => {
    useSteps.getState().register("landing", idx, STEPS.length, (s) => setStep(String(s)));
  }, [idx]);
  useEffect(() => () => useSteps.getState().clear("landing"), []);

  return (
    <div className="min-h-screen">
      <div
        className="relative overflow-hidden border-b border-line"
        style={{
          background: `radial-gradient(90% 120% at 100% 0%, #fde3cf 0%, ${SOFT} 45%, #fbfaf7 100%)`,
        }}
      >
        {/* a faint altitude ruler behind the title, like a webcast overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(194,65,12,0.12) 0 1px, transparent 1px 28px)",
            maskImage: "linear-gradient(90deg, black, transparent 55%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1120px] items-center gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <div>
            <Link
              href="/"
              className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
            >
              <ArrowLeft size={12} /> All three models
            </Link>
            <div
              className="mono mt-3 text-[11px] font-bold tracking-[0.16em] uppercase"
              style={{ color: "#c2410c" }}
            >
              Playground · a real application
            </div>
            <h1 className="mt-1 text-[34px] leading-[1.05] font-semibold text-ink sm:text-[46px]">
              Landing Lab
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
              A booster falls out of the sky at seventy-five metres a second, and its engine is too
              powerful to hover with. Nobody tells the computer how to land it. It works the whole
              thing out by crashing forty rockets at a time until crashing stops working.
            </p>
            <div className="mono mt-5 grid max-w-md grid-cols-3 gap-2 text-[11px]">
              {[
                ["845 kN", "one Merlin"],
                [`${Math.round(MIN_THROTTLE * 100)}%`, "throttle floor"],
                ["8", "genes to learn it"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-xl border border-[#f3d3bd] bg-white/70 px-3 py-2 backdrop-blur"
                >
                  <div className="text-[17px] font-bold text-ink">{v}</div>
                  <div className="text-ink-3">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <StepRail steps={STEPS} active={step} onSelect={setStep} accent={ACCENT} />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/70 shadow-[0_30px_70px_-35px_rgba(124,45,18,0.55)] ring-1 ring-[#f3d3bd]">
            <HeroDemo height={340} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] px-5 py-8">
        <AnimatePresence mode="wait">
          {/* ============================================== STEP 1 ==== */}
          {step === "0" && (
            <Fade k="0">
              <SectionHeading
                step={1}
                eyebrow="Why this is hard"
                title="Land it yourself"
                accent={ACCENT}
              >
                <p>
                  A Falcon 9 booster comes home weighing about 22 tonnes with a single Merlin engine
                  lit. That engine makes 845 kilonewtons at full power and{" "}
                  <strong>
                    cannot be throttled below {Math.round(MIN_THROTTLE * 100)} per cent
                  </strong>
                  . Even at its gentlest setting it pushes harder than the rocket weighs.
                </p>
                <p>
                  So the booster cannot hover. It cannot hang above the deck and feel its way down,
                  the way a helicopter would. It gets one attempt: fall most of the way, then light
                  the engine at the exact altitude where full power will bring it to a stop
                  precisely as it reaches the deck. Engineers call it a hoverslam. Everybody else
                  calls it a suicide burn.
                </p>
                <p>Have a go. Most people need a dozen tries.</p>
              </SectionHeading>

              <FlyItYourself />
            </Fade>
          )}

          {/* ============================================== STEP 2 ==== */}
          {step === "1" && (
            <Fade k="1">
              <SectionHeading
                step={2}
                eyebrow="Forty at a time"
                title="Let evolution try instead"
                accent={ACCENT}
              >
                <p>
                  Every booster in the fleet carries eight numbers. Those numbers are its entire
                  brain: four decide how hard to burn given how fast it is falling, four decide
                  which way to lean given how far off target it is. That is the chromosome — no
                  neural network, no training data, nothing that has ever seen a rocket.
                </p>
                <p>
                  Generation one is pure carnage. Each round, the ones that came closest to
                  surviving become parents, their numbers get mixed and nudged, and forty fresh
                  boosters drop. Watch the ignition altitude in the stats: it starts high and
                  wasteful, then falls. Nobody tells it to wait. Waiting is simply what survives.
                </p>
              </SectionHeading>

              <EvolveLab />
            </Fade>
          )}

          {/* ============================================== STEP 3 ==== */}
          {step === "2" && (
            <Fade k="2">
              <SectionHeading
                step={3}
                eyebrow="The thing that separates a trick from a skill"
                title="Memoriser vs pilot"
                accent={ACCENT}
              >
                <p>
                  Here is the question that decides whether any of this was real learning: what
                  happens when the situation changes?
                </p>
                <p>
                  We breed two boosters with the identical algorithm. One is given a{" "}
                  <strong>script</strong> — light the engine at T+4.2 seconds, hold 80 per cent for
                  two seconds, and so on. The other is given a <strong>controller</strong> — the
                  eight reflexes from step 2. Both learn to land. Then we move the release point.
                </p>
              </SectionHeading>

              <ShowdownLab />
            </Fade>
          )}

          {/* ============================================== STEP 4 ==== */}
          {step === "3" && (
            <Fade k="3">
              <SectionHeading
                step={4}
                eyebrow="Being honest about it"
                title="What actually flies"
                accent={ACCENT}
              >
                <p>
                  It would be easy to end this page implying that SpaceX evolves its landing
                  software. It does not, and the real answer is more interesting.
                </p>
              </SectionHeading>

              <div className="grid gap-5 md:grid-cols-3">
                <Card>
                  <CardTitle hint="The algorithm that is really on board.">
                    Falcon 9 solves it exactly
                  </CardTitle>
                  <p className="text-[13.5px] leading-[1.65] text-ink-2">
                    The booster runs guidance built on <strong>convex optimisation</strong> — a
                    method called G-FOLD, developed by Behçet Açıkmeşe and Lars Blackmore at
                    NASA&apos;s Jet Propulsion Laboratory. Rather than searching for a good
                    trajectory, it reformulates fuel-optimal landing as a problem that can be
                    <em> solved</em> outright, to a guaranteed optimum, in milliseconds, over and
                    over on the way down.
                  </p>
                  <p className="mt-3 text-[13.5px] leading-[1.65] text-ink-2">
                    When you can do that, you should. A genetic algorithm is what you reach for when
                    you cannot.
                  </p>
                </Card>

                <Card>
                  <CardTitle hint="Where evolutionary search genuinely earns its place.">
                    …but evolution is in the building
                  </CardTitle>
                  <p className="text-[13.5px] leading-[1.65] text-ink-2">
                    Evolutionary algorithms are routinely used in launch-vehicle work for the
                    problems that have no clean mathematical form: tuning controller gains, trading
                    engine chamber pressure against tank mass against staging, and picking a
                    reusable vehicle&apos;s overall layout. Groups at DLR and RWTH Aachen have used
                    exactly this approach on Falcon-9-like reusable designs.
                  </p>
                  <p className="mt-3 text-[13.5px] leading-[1.65] text-ink-2">
                    NASA has flown hardware designed this way too — the Space Technology 5
                    spacecraft carried an antenna whose shape was evolved rather than drawn.
                  </p>
                </Card>

                <Card>
                  <CardTitle hint="The limitation this page has been quietly demonstrating.">
                    Why you cannot evolve in flight
                  </CardTitle>
                  <p className="text-[13.5px] leading-[1.65] text-ink-2">
                    Look at the flight counter in step 2. Getting a reliable landing takes thousands
                    of attempts, and the overwhelming majority of them are craters. That is fine in
                    a simulator and unthinkable on a launch pad.
                  </p>
                  <p className="mt-3 text-[13.5px] leading-[1.65] text-ink-2">
                    A genetic algorithm is a <strong>design-time</strong> tool. It searches for a
                    controller on the ground, at the cost of destroying a few thousand imaginary
                    boosters, and what ships is the answer it found — not the search itself.
                  </p>
                </Card>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Note accent={ACCENT} title="Try the other worlds">
                  Step 2 has a world selector. The Moon has no atmosphere at all, so there is no
                  drag to help you slow down and the grid fins do nothing — the booster has to hold
                  itself upright on engine gimbal alone. Mars sits awkwardly in between. Watch the
                  evolved burn profile change shape when the air goes away.
                </Note>
                <Note accent={ACCENT} title="And the honest caveats here">
                  This is a two-dimensional simulation with a single engine, a rigid body, no slosh,
                  no thrust transients beyond a start-up delay, and a drag model that is one
                  coefficient. It is a fair model of <em>why</em> landing is hard, not a substitute
                  for the real thing.
                </Note>
              </div>
            </Fade>
          )}
        </AnimatePresence>
      </main>

      <div className="mx-auto max-w-[1120px] px-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                onClick={() => setStep(String(idx - 1))}
                className="cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:bg-sunken"
              >
                ← {STEPS[idx - 1].label}
              </button>
            )}
            {idx < STEPS.length - 1 && (
              <button
                onClick={() => setStep(String(idx + 1))}
                className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium text-white"
                style={{ background: ACCENT }}
              >
                {STEPS[idx + 1].label} →
              </button>
            )}
          </div>
          <Link href="/genetic" className="text-[13.5px] font-medium text-ink-2 hover:text-ink">
            The algorithm itself — Model 2 →
          </Link>
        </div>
      </div>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          DNA and GA Lab — educational simulation. The rocket physics here is a simplified
          two-dimensional model built from real Falcon 9 numbers; it is not flight software.
        </div>
      </footer>
    </div>
  );
}
