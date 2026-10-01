"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dices, Play, Rocket } from "lucide-react";
import LaunchScene, { usePlayback } from "./LaunchScene";
import FullscreenStage, { ExpandButton, Hud, HudTitle, useStage } from "./Fullscreen";
import {
  Flight,
  REHEARSED_START,
  StartCondition,
  WORLDS,
  trailDuration,
} from "@/lib/rocket/physics";
import {
  DEFAULT_EVO,
  EvoOptions,
  EvoState,
  initEvolution,
  seeded,
  stepEvolution,
  testGenome,
} from "@/lib/rocket/evolve";
import { ignitionTimeOf } from "@/lib/rocket/brain";
import { Button, Card, CardTitle, Chip, Field, Meter, Note, Stat } from "@/components/ui";

const ACCENT = "#ea580c";
const SCHEDULE_GENS = 200;
const CONTROLLER_GENS = 150;
const CHUNK = 10;

const SCHED_OPTS: EvoOptions = { ...DEFAULT_EVO, kind: "schedule" };
const CTRL_OPTS: EvoOptions = { ...DEFAULT_EVO, kind: "controller" };

/** Thirty entries neither genome has ever been shown. */
const UNSEEN: StartCondition[] = (() => {
  const rnd = seeded(4242);
  return Array.from({ length: 30 }, () => ({
    x: (rnd() * 2 - 1) * 70,
    y: 560 + rnd() * 280,
    vx: (rnd() * 2 - 1) * 10,
    vy: -(60 + rnd() * 35),
    angle: (rnd() * 2 - 1) * ((6 * Math.PI) / 180),
    fuel: REHEARSED_START.fuel,
  }));
})();

interface Champions {
  schedule: number[];
  controller: number[];
  scheduleRate: number;
  controllerRate: number;
}

function Verdict({ flight, label, sub }: { flight: Flight | null; label: string; sub: string }) {
  const ok = flight?.outcome === "landed";
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="text-[15px] font-semibold text-ink">{label}</h4>
        <p className="mt-0.5 text-[12px] text-ink-3">{sub}</p>
      </div>
      {flight && (
        <Chip accent={ok ? "#15803d" : "#dc2626"} soft={false}>
          {ok ? "landed" : "crashed"}
        </Chip>
      )}
    </div>
  );
}

export default function ShowdownLab() {
  const [phase, setPhase] = useState<"idle" | "training" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [champs, setChamps] = useState<Champions | null>(null);
  const [entry, setEntry] = useState<StartCondition>({ ...REHEARSED_START });
  const [playing, setPlaying] = useState(false);
  const stage = useStage();
  const trainRef = useRef<{ sched: EvoState; ctrl: EvoState } | null>(null);

  /* ---- the two flights ----------------------------------------------------- */
  const flights = useMemo(() => {
    if (!champs) return null;
    return {
      schedule: testGenome(champs.schedule, SCHED_OPTS, entry),
      controller: testGenome(champs.controller, CTRL_OPTS, entry),
    };
  }, [champs, entry]);

  const duration = flights
    ? Math.max(trailDuration(flights.schedule.trail!), trailDuration(flights.controller.trail!))
    : 1;
  const { t, seek } = usePlayback(duration, 1.6, playing);

  const replay = useCallback(() => {
    seek(0);
    setPlaying(true);
  }, [seek]);

  /** Changing the entry re-drops both boosters immediately. */
  const dropFrom = useCallback(
    (next: StartCondition) => {
      setEntry(next);
      seek(0);
      setPlaying(true);
    },
    [seek],
  );

  /* ---- training, in slices so the page keeps breathing --------------------- */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const train = useCallback(() => {
    setPhase("training");
    cancelled.current = false;
    trainRef.current = { sched: initEvolution(SCHED_OPTS), ctrl: initEvolution(CTRL_OPTS) };

    const run = () => {
      if (cancelled.current) return;
      const s = trainRef.current!;
      for (let i = 0; i < CHUNK; i++) {
        if (s.sched.generation < SCHEDULE_GENS) s.sched = stepEvolution(s.sched, SCHED_OPTS, false);
        if (s.ctrl.generation < CONTROLLER_GENS) s.ctrl = stepEvolution(s.ctrl, CTRL_OPTS, false);
      }
      setProgress((s.sched.generation / SCHEDULE_GENS + s.ctrl.generation / CONTROLLER_GENS) / 2);

      if (s.sched.generation >= SCHEDULE_GENS && s.ctrl.generation >= CONTROLLER_GENS) {
        const schedule = s.sched.champion.genes;
        const controller = s.ctrl.champion.genes;
        const rate = (genes: number[], opts: EvoOptions) =>
          UNSEEN.filter((c) => testGenome(genes, opts, c).outcome === "landed").length /
          UNSEEN.length;
        setChamps({
          schedule,
          controller,
          scheduleRate: rate(schedule, SCHED_OPTS),
          controllerRate: rate(controller, CTRL_OPTS),
        });
        setPhase("ready");
        seek(0);
        setPlaying(true);
        return;
      }
      timerRef.current = setTimeout(run, 0);
    };

    timerRef.current = setTimeout(run, 30);
  }, [seek]);

  const isRehearsed =
    Math.abs(entry.y - REHEARSED_START.y) < 1 && Math.abs(entry.vy - REHEARSED_START.vy) < 1;

  if (phase !== "ready" || !champs || !flights) {
    return (
      <Card>
        <CardTitle hint="Both are bred with exactly the same loop, the same population size and the same number of generations. The only difference is what their genes mean.">
          Train the two of them
        </CardTitle>
        <p className="mb-5 text-[14px] leading-[1.65] text-ink-2">
          One booster gets a <strong className="text-ink">script</strong> — a rehearsed burn plan on
          a stopwatch. The other gets a <strong className="text-ink">controller</strong> — eight
          numbers describing how to react to whatever it sees. The script is rehearsed against a
          single entry. The controller is shown three different ones, so it never gets the chance to
          memorise any of them.
        </p>
        {phase === "training" ? (
          <div className="space-y-2">
            <div className="mono flex justify-between text-[12px] text-ink-3">
              <span>breeding both populations…</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <Meter value={progress} accent={ACCENT} />
          </div>
        ) : (
          <Button accent={ACCENT} onClick={train}>
            <Rocket size={15} /> Train both
          </Button>
        )}
      </Card>
    );
  }

  const scenes = [
    {
      key: "schedule" as const,
      label: "The memoriser",
      sub: `a burn plan: coast, then light the engine at T+${ignitionTimeOf(champs.schedule).toFixed(1)} s`,
      flight: flights.schedule,
      rate: champs.scheduleRate,
    },
    {
      key: "controller" as const,
      label: "The pilot",
      sub: "eight gains: look at the altitude and speed, decide the throttle",
      flight: flights.controller,
      rate: champs.controllerRate,
    },
  ];

  const entryControls = (stacked: boolean) => (
    <>
      <div className={stacked ? "grid gap-5" : "grid gap-5 sm:grid-cols-3"}>
        <Field label="Release altitude" value={`${Math.round(entry.y)} m`}>
          <input
            type="range"
            min={540}
            max={860}
            step={10}
            value={entry.y}
            onChange={(e) => dropFrom({ ...entry, y: Number(e.target.value) })}
            style={{ color: ACCENT }}
          />
        </Field>
        <Field label="Entry speed" value={`${Math.abs(entry.vy).toFixed(0)} m/s`}>
          <input
            type="range"
            min={55}
            max={100}
            value={Math.abs(entry.vy)}
            onChange={(e) => dropFrom({ ...entry, vy: -Number(e.target.value) })}
            style={{ color: ACCENT }}
          />
        </Field>
        <Field label="Sideways offset" value={`${entry.x.toFixed(0)} m`}>
          <input
            type="range"
            min={-70}
            max={70}
            value={entry.x}
            onChange={(e) => dropFrom({ ...entry, x: Number(e.target.value) })}
            style={{ color: ACCENT }}
          />
        </Field>
      </div>
      {/* in the console these live in the transport bar instead */}
      {!stacked && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="quiet" onClick={() => dropFrom({ ...REHEARSED_START })}>
            The rehearsed entry
          </Button>
          <Button
            size="sm"
            variant="outline"
            accent={ACCENT}
            onClick={() => dropFrom(UNSEEN[Math.floor(Math.random() * UNSEEN.length)])}
          >
            <Dices size={13} /> Something it has never seen
          </Button>
          {isRehearsed && (
            <span className="mono text-[11.5px] text-ink-3">
              this is the exact entry the script was drilled on
            </span>
          )}
        </div>
      )}
    </>
  );

  const pair = (h: number | string) => (
    <div
      className={
        stage.open ? "grid h-full grid-cols-2 gap-px bg-line" : "grid gap-5 lg:grid-cols-2"
      }
    >
      {scenes.map((s) => (
        <div key={s.key} className={stage.open ? "flex min-h-0 flex-col bg-surface" : ""}>
          {stage.open ? (
            <>
              <div className="shrink-0 border-b border-line px-4 py-2.5">
                <Verdict flight={s.flight} label={s.label} sub={s.sub} />
              </div>
              <div className="min-h-0 flex-1">
                <LaunchScene
                  rockets={[
                    { id: s.key, trail: s.flight.trail!, outcome: s.flight.outcome, hero: true },
                  ]}
                  t={t}
                  world={WORLDS.earth}
                  height="100%"
                  inset={{ top: 10, bottom: 84 }}
                  spread={0}
                />
              </div>
            </>
          ) : (
            <Card pad={false}>
              <div className="px-5 py-3.5">
                <Verdict flight={s.flight} label={s.label} sub={s.sub} />
              </div>
              <LaunchScene
                rockets={[
                  { id: s.key, trail: s.flight.trail!, outcome: s.flight.outcome, hero: true },
                ]}
                t={t}
                world={WORLDS.earth}
                height={h}
                spread={0}
              />
              <div className="grid grid-cols-3 gap-3 px-5 py-4">
                <Stat
                  label="Touchdown"
                  value={s.flight.metrics.impactSpeed.toFixed(1)}
                  unit="m/s"
                  accent={s.flight.outcome === "landed" ? "#15803d" : "#dc2626"}
                />
                <Stat
                  label="Off centre"
                  value={s.flight.metrics.missDistance.toFixed(0)}
                  unit="m"
                  accent="#4b5562"
                />
                <Stat
                  label="Lands from anywhere"
                  value={`${Math.round(s.rate * 100)}%`}
                  accent={s.rate > 0.5 ? "#15803d" : "#dc2626"}
                  meter={s.rate}
                  hint="over 30 unseen entries"
                />
              </div>
            </Card>
          )}
        </div>
      ))}
    </div>
  );

  const scoreboard = (
    <div className="grid grid-cols-2 gap-3">
      {scenes.map((s) => (
        <Stat
          key={s.key}
          label={s.label}
          value={`${Math.round(s.rate * 100)}%`}
          accent={s.rate > 0.5 ? "#4ade80" : "#f87171"}
          meter={s.rate}
          hint="lands from 30 unseen entries"
        />
      ))}
    </div>
  );

  const overlayStage = (
    <FullscreenStage
      stage={stage}
      title="Memoriser vs pilot"
      subtitle={`released from ${Math.round(entry.y)} m at ${Math.abs(entry.vy).toFixed(0)} m/s, ${entry.x.toFixed(0)} m off centre`}
      status={playing ? "live" : "idle"}
      stats={scenes.map((sc) => ({
        label: sc.label.replace("The ", ""),
        value: sc.flight.outcome === "landed" ? "LANDED" : "CRASHED",
        tone: sc.flight.outcome === "landed" ? "#4ade80" : "#f87171",
      }))}
      scene={pair("100%")}
      bar={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" accent={ACCENT} onClick={replay}>
            <Play size={13} /> Replay
          </Button>
          <Button size="sm" variant="quiet" onClick={() => dropFrom({ ...REHEARSED_START })}>
            The rehearsed entry
          </Button>
          <Button
            size="sm"
            variant="outline"
            accent={ACCENT}
            onClick={() => dropFrom(UNSEEN[Math.floor(Math.random() * UNSEEN.length)])}
          >
            <Dices size={13} /> Something it has never seen
          </Button>
          <span className="mono ml-auto text-[11px] text-ink-3">T+{t.toFixed(1)} s</span>
        </div>
      }
      pinned={
        <Hud>
          <HudTitle hint="How often each survives an entry it never trained on.">
            Scoreboard
          </HudTitle>
          {scoreboard}
        </Hud>
      }
      tabs={[
        {
          id: "entry",
          label: "The entry",
          content: (
            <Hud>
              <HudTitle hint="Both are released from the same place, at the same speed, on the same second.">
                Release point
              </HudTitle>
              {entryControls(true)}
            </Hud>
          ),
        },
        {
          id: "lesson",
          label: "The lesson",
          content: (
            <Hud>
              <HudTitle>Memorising vs understanding</HudTitle>
              <p className="text-[12.5px] leading-[1.65] text-ink-2">
                The memoriser is a stopwatch: it lights the engine at a fixed second, whatever the
                world is doing. On the entry it rehearsed, it is flawless. Move the release point
                and it drives itself into the deck.
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.65] text-ink-2">
                The pilot reads its altitude and speed and decides what to do, so an entry it has
                never seen is just another descent. That is why every real launch vehicle flies
                closed-loop guidance.
              </p>
            </Hud>
          ),
        },
      ]}
    />
  );

  return (
    <div className="space-y-5">
      {overlayStage}
      <Card>
        <CardTitle
          hint="Both boosters are released from exactly the same place, at the same speed, on the same second."
          right={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" accent={ACCENT} onClick={replay}>
                <Play size={13} /> Replay
              </Button>
              <ExpandButton onClick={stage.enter} />
            </div>
          }
        >
          Pick an entry and drop them both
        </CardTitle>
        {entryControls(false)}
      </Card>

      {pair(330)}

      <Note accent={ACCENT} title="This is the whole lesson">
        Both were bred by an identical genetic algorithm, for the same number of generations, with
        the same population size. On the rehearsed entry the script is flawless — it only ever had
        one problem to solve, and it solved that one exactly. Move the release point by fifty metres
        and it drives itself into the deck at full speed, because a stopwatch has no idea the world
        changed. The controller never memorised anything: it reads the altitude and the speed and
        decides what to do, so an entry it has never seen is just another Tuesday. That is why every
        real launch vehicle flies closed-loop guidance — and why <em>what</em> you evolve matters
        more than how long you evolve it for.
      </Note>
    </div>
  );
}
