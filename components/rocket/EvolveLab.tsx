"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FastForward, Maximize2, Minimize2, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LaunchScene, { SceneRocket, usePlayback } from "./LaunchScene";
import Telemetry from "./Telemetry";
import FullscreenStage, { ExpandButton, Hud, HudTitle, useStage } from "./Fullscreen";
import { CONTROLLER_SPEC } from "@/lib/rocket/brain";
import { LANDING, WORLDS, World, sampleTrail, trailDuration } from "@/lib/rocket/physics";
import {
  DEFAULT_EVO,
  EvoOptions,
  EvoState,
  initEvolution,
  stepEvolution,
} from "@/lib/rocket/evolve";
import { Button, Card, CardTitle, Chip, Field, Note, Segmented, Stat, cx } from "@/components/ui";

const ACCENT = "#ea580c";

/** The eight evolved gains, drawn as a strip so the genome is always on screen. */
function GeneStrip({ genes }: { genes: number[] }) {
  return (
    <div className="flex gap-1">
      {genes.map((g, i) => {
        const spec = CONTROLLER_SPEC[i];
        const frac = Math.max(0, Math.min(1, (g - spec.min) / (spec.max - spec.min)));
        return (
          <div
            key={spec.key}
            className="group relative flex-1"
            title={`${spec.label}: ${g.toFixed(3)} ${spec.unit}`}
          >
            <div className="h-9 overflow-hidden rounded-[3px] bg-sunken">
              <div
                className="w-full transition-[height] duration-300"
                style={{
                  height: `${Math.max(3, frac * 100)}%`,
                  background: ACCENT,
                  marginTop: `${(1 - frac) * 100}%`,
                }}
              />
            </div>
            <div className="mono mt-1 truncate text-center text-[8.5px] text-ink-3">
              {spec.label.split(" ")[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EvolveLab() {
  const [opts, setOpts] = useState<EvoOptions>({ ...DEFAULT_EVO, kind: "controller" });
  const [evo, setEvo] = useState<EvoState>(() =>
    initEvolution({ ...DEFAULT_EVO, kind: "controller" }),
  );
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [busy, setBusy] = useState(false);
  const stage = useStage();
  const logRef = useRef<HTMLDivElement>(null);

  const rockets: SceneRocket[] = useMemo(
    () =>
      evo.population
        .filter((p) => p.flights[0]?.trail)
        .map((p, i) => ({
          id: p.id,
          trail: p.flights[0].trail!,
          outcome: p.flights[0].outcome,
          hero: i === 0,
        })),
    [evo.population],
  );

  // The generation is over once most of it is down. Waiting for the single
  // booster that decided to fly to orbit would double every round.
  const duration = useMemo(() => {
    if (rockets.length === 0) return 0.5;
    const lengths = rockets.map((r) => trailDuration(r.trail)).sort((a, b) => a - b);
    const p75 = lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * 0.75))];
    return Math.max(0.5, trailDuration(rockets[0].trail), p75);
  }, [rockets]);

  const { t, seek, ended } = usePlayback(duration, speed, running && !busy);

  // when the generation has finished flying, breed the next one
  useEffect(() => {
    if (!ended || !running || busy) return;
    const id = setTimeout(() => {
      setEvo((prev) => stepEvolution(prev, opts, true));
      seek(0);
    }, 420);
    return () => clearTimeout(id);
  }, [ended, running, busy, opts, seek]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 0 });
  }, [evo.log.length]);

  const restart = useCallback(
    (next: EvoOptions) => {
      setOpts(next);
      setRunning(false);
      setEvo(initEvolution(next));
      seek(0);
    },
    [seek],
  );

  /** Fast-forward without animating — the last generation is recorded so there is something to watch. */
  const skip = useCallback(
    (n: number) => {
      setBusy(true);
      setRunning(false);
      // let the button paint its disabled state before we block the thread
      setTimeout(() => {
        setEvo((prev) => {
          let s = prev;
          for (let i = 0; i < n - 1; i++) s = stepEvolution(s, opts, false);
          return stepEvolution(s, opts, true);
        });
        seek(0);
        setBusy(false);
      }, 20);
    },
    [opts, seek],
  );

  const hero = evo.population[0];
  const heroTrail = hero?.flights[0]?.trail;
  const sample = heroTrail ? sampleTrail(heroTrail, t) : null;
  const landedNow = evo.population.filter((p) => p.landed).length;

  /**
   * The survivors on their own. "Landed" here is the same test the header
   * counts — it came down safely on every entry it was tested on — so the two
   * numbers always agree, and the crowd of craters is simply not drawn.
   */
  const survivors: SceneRocket[] = useMemo(
    () =>
      evo.population
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.landed && p.flights[0]?.trail)
        .map(({ p, i }) => ({
          id: p.id,
          trail: p.flights[0].trail!,
          outcome: p.flights[0].outcome,
          hero: i === 0,
        })),
    [evo.population],
  );
  const [pip, setPip] = useState<"small" | "large" | "hidden">("small");
  const heroMetrics = hero?.flights[0]?.metrics;

  const chart = useMemo(
    () =>
      evo.history.map((h) => ({
        gen: h.gen,
        best: Math.round(h.best * 100),
        average: Math.round(h.average * 100),
        landed: Math.round(h.landed * 100),
      })),
    [evo.history],
  );

  /* ---- the pieces, so the same ones work in either layout ----------------- */

  const transport = (
    <>
      <Button accent={ACCENT} onClick={() => setRunning((r) => !r)} disabled={busy}>
        {running ? <Pause size={15} /> : <Play size={15} />}
        {running ? "Pause" : "Evolve"}
      </Button>
      <Button variant="outline" accent={ACCENT} onClick={() => skip(25)} disabled={busy}>
        <FastForward size={15} /> Skip 25
      </Button>
      <Button variant="quiet" onClick={() => restart(opts)} disabled={busy}>
        <RotateCcw size={15} /> Restart
      </Button>
    </>
  );

  const sceneOverlay = (
    <div className="pointer-events-none absolute top-3 right-4 flex flex-col items-end gap-1.5">
      <Chip accent={landedNow > 0 ? "#15803d" : "#dc2626"} soft={false}>
        {landedNow} of {evo.population.length} landed
      </Chip>
      <span className="mono rounded-md border border-white/60 bg-white/75 px-2 py-1 text-[10.5px] text-ink-2 shadow-sm backdrop-blur-md">
        gen {evo.generation} · {evo.evaluations.toLocaleString()} flights
      </span>
    </div>
  );

  const scene = (h: number | string, inset?: { top?: number; bottom?: number }) => (
    <LaunchScene
      rockets={rockets}
      t={t}
      world={opts.world}
      wind={opts.wind}
      height={h}
      inset={inset}
      overlay={inset ? undefined : sceneOverlay}
      tag="BEST"
    />
  );

  const scrubber = (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="mono text-[11px] text-ink-3">speed</span>
        <Segmented
          accent={ACCENT}
          value={speed}
          onChange={(v) => setSpeed(v as number)}
          options={[
            { value: 1, label: "1×" },
            { value: 2, label: "2×" },
            { value: 4, label: "4×" },
          ]}
        />
      </div>
      <input
        type="range"
        min={0}
        max={Math.round(duration * 100)}
        value={Math.round(t * 100)}
        onChange={(e) => {
          setRunning(false);
          seek(Number(e.target.value) / 100);
        }}
        className="min-w-[160px] flex-1"
        style={{ color: ACCENT }}
        aria-label="Scrub the flight"
      />
      <span className="mono min-w-[86px] text-right text-[11px] whitespace-nowrap text-ink-3">
        T+{t.toFixed(1)} / {duration.toFixed(1)} s
      </span>
    </div>
  );

  const telemetry = sample ? (
    <Telemetry
      cols={4}
      dense={stage.open}
      v={{
        altitude: sample.y,
        descentRate: Math.abs(
          heroTrail ? (sample.y - sampleTrail(heroTrail, Math.max(0, t - 0.1)).y) / 0.1 : 0,
        ),
        lateralSpeed: Math.abs(
          heroTrail ? (sample.x - sampleTrail(heroTrail, Math.max(0, t - 0.1)).x) / 0.1 : 0,
        ),
        tiltDeg: Math.abs((sample.angle * 180) / Math.PI),
        fuel: sample.fuel,
        fuelMax: evo.conditions[0].fuel,
        throttle: sample.throttle,
        offset: sample.x,
      }}
    />
  ) : null;

  const chartBlock = (h: number) => (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart} margin={{ top: 6, right: 10, bottom: 0, left: -26 }}>
          <CartesianGrid stroke={stage.open ? "#223041" : "#eee9df"} vertical={false} />
          <XAxis
            dataKey="gen"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#7b8592" }}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#7b8592" }}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              fontSize: 12,
              background: "var(--color-surface)",
              color: "var(--color-ink)",
            }}
          />
          <Line
            type="monotone"
            dataKey="best"
            name="Best"
            stroke={ACCENT}
            strokeWidth={2.2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="average"
            name="Average"
            stroke="#9aa4b2"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="landed"
            name="% landed"
            stroke={stage.open ? "#4ade80" : "#15803d"}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const logBlock = (max: number) => (
    <div ref={logRef} className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: max }}>
      {[...evo.log].reverse().map((entry, i) => (
        <div
          key={`${entry.gen}-${i}`}
          className={cx(
            "rounded-lg border-l-[3px] bg-sunken px-3 py-2",
            entry.tone === "big" && "bg-[rgba(234,88,12,0.09)]",
          )}
          style={{
            borderLeftColor:
              entry.tone === "big" ? ACCENT : entry.tone === "good" ? "#15803d" : "#c3bdaf",
          }}
        >
          <span className="mono mr-2 text-[10px] text-ink-3">gen {entry.gen}</span>
          <span className="text-[13px] leading-[1.55] text-ink-2">{entry.text}</span>
        </div>
      ))}
    </div>
  );

  /** `compact` is the console version: the same knobs, one-line hints, two to a row */
  const controls = (compact = false) => (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div
        className={
          compact ? "flex flex-wrap items-start justify-between gap-x-3 gap-y-4" : "space-y-5"
        }
      >
        <Field label="World" hint={compact ? undefined : opts.world.blurb}>
          <Segmented
            accent={ACCENT}
            value={opts.world.id}
            onChange={(v) => restart({ ...opts, world: WORLDS[v as World["id"]] })}
            options={[
              { value: "earth", label: "Earth" },
              { value: "mars", label: "Mars" },
              { value: "moon", label: "Moon" },
            ]}
          />
        </Field>
        <Field
          label={compact ? "Boosters" : "Boosters per generation"}
          value={opts.populationSize}
          hint={
            compact
              ? undefined
              : "More candidates explore more of the space each round, but each round costs more."
          }
        >
          <Segmented
            accent={ACCENT}
            value={opts.populationSize}
            onChange={(v) => restart({ ...opts, populationSize: v as number })}
            options={[
              { value: 20, label: "20" },
              { value: 40, label: "40" },
              { value: 60, label: "60" },
            ]}
          />
        </Field>
      </div>
      {compact && <p className="-mt-1 text-[11.5px] leading-snug text-ink-3">{opts.world.blurb}</p>}
      <Field
        label="Mutation rate"
        value={`${Math.round(opts.mutationRate * 100)}%`}
        hint={
          compact
            ? "Applies next generation. Too high and the fleet is wrecked while the champion survives."
            : "Applies from the next generation. At zero the search can only reshuffle genes it already has — it still gets somewhere, but it stalls short. Push it high and the champion survives while the rest of the fleet is wrecked: watch the landing rate collapse, not the best score."
        }
      >
        <input
          type="range"
          min={0}
          max={50}
          value={Math.round(opts.mutationRate * 100)}
          onChange={(e) => setOpts({ ...opts, mutationRate: Number(e.target.value) / 100 })}
          style={{ color: ACCENT }}
        />
      </Field>
      <Field
        label="Crosswind"
        value={`${opts.wind.toFixed(0)} m/s`}
        hint={
          compact
            ? opts.world.airDensity > 0
              ? "A steady breeze. A controller that reacts can trim it out."
              : "No air on this world — wind does nothing."
            : opts.world.airDensity > 0
              ? "A steady breeze, shown as an arrow in the corner. Watch the booster lean into it — and notice how little it costs, because a controller that reacts to what it sees can simply trim a constant wind out. That is the whole case for closed-loop guidance."
              : "There is no air on this world, so the wind does precisely nothing here."
        }
      >
        <input
          type="range"
          min={-12}
          max={12}
          value={opts.wind}
          onChange={(e) => restart({ ...opts, wind: Number(e.target.value) })}
          style={{ color: ACCENT }}
        />
      </Field>
    </div>
  );

  /* ---- everything floats over the sky, nothing sits beside it ------------- */

  /* ---- a second window: only the boosters that made it ---------------------- */

  const total = evo.population.length;
  const failed = total - landedNow;
  const survivorView =
    pip === "hidden" ? (
      <button
        onClick={() => setPip("small")}
        className="mono absolute top-3 right-3 z-10 flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-sunken/90 px-3 py-1.5 text-[11px] font-semibold text-ink-2 shadow-lg backdrop-blur hover:text-ink"
      >
        <Eye size={13} /> Landed only
        <span className="text-green-400">{landedNow}</span>
        <span className="text-ink-3">/ {total}</span>
      </button>
    ) : (
      <div
        className="absolute top-3 right-3 z-10 flex flex-col overflow-hidden rounded-xl border border-line bg-sunken shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)]"
        style={
          pip === "large"
            ? { width: "min(620px, 58%)", height: "min(420px, 62%)" }
            : { width: "min(360px, 42%)", height: "min(250px, 46%)" }
        }
      >
        <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
          <span
            className="h-2 w-2 rounded-full bg-green-400"
            style={{ boxShadow: "0 0 8px #4ade80" }}
          />
          <span className="mono text-[10px] font-bold tracking-[0.14em] text-ink-2 uppercase">
            Landed only
          </span>
          <span className="mono ml-1 text-[12px] font-bold text-green-400 tabular-nums">
            {landedNow}
          </span>
          <span className="mono text-[11px] text-ink-3">landed</span>
          <span className="mono text-[12px] font-bold text-red-400 tabular-nums">{failed}</span>
          <span className="mono text-[11px] text-ink-3">failed</span>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => setPip(pip === "large" ? "small" : "large")}
              className="cursor-pointer rounded-md p-1 text-ink-3 hover:bg-surface hover:text-ink"
              title={pip === "large" ? "Make it smaller" : "Make it bigger"}
            >
              {pip === "large" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              onClick={() => setPip("hidden")}
              className="cursor-pointer rounded-md p-1 text-ink-3 hover:bg-surface hover:text-ink"
              title="Hide"
            >
              <X size={13} />
            </button>
          </div>
        </div>
        {/* the whole fleet as one bar: green made it, red did not */}
        <div className="flex h-1.5 shrink-0" title={`${landedNow} landed, ${failed} failed`}>
          <div className="bg-green-500" style={{ width: `${(landedNow / total) * 100}%` }} />
          <div className="flex-1 bg-red-500/70" />
        </div>
        <div className="relative min-h-0 flex-1">
          <LaunchScene
            rockets={survivors}
            t={t}
            world={opts.world}
            wind={opts.wind}
            height="100%"
            inset={{ top: 8, bottom: 8 }}
            badge={false}
            tag="BEST"
            overlay={
              survivors.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 p-4 text-center">
                  <div>
                    <div className="mono text-[11px] font-bold tracking-[0.14em] text-red-300 uppercase">
                      No survivors yet
                    </div>
                    <div className="mt-1 text-[12px] text-white/80">
                      All {total} boosters in generation {evo.generation} crashed. Keep evolving.
                    </div>
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
      </div>
    );

  const overlayStage = (
    <FullscreenStage
      stage={stage}
      title={`Generation ${evo.generation} · ${opts.world.name}`}
      subtitle={`${evo.population.length} boosters per round · mutation ${Math.round(opts.mutationRate * 100)}% · wind ${opts.wind.toFixed(0)} m/s`}
      status={running ? "live" : "idle"}
      stats={[
        { label: "Generation", value: evo.generation, tone: "#fb923c" },
        {
          label: "Landed",
          value: `${landedNow}/${evo.population.length}`,
          tone: landedNow > 0 ? "#4ade80" : "#f87171",
        },
        { label: "Flights", value: evo.evaluations.toLocaleString() },
        {
          label: "Ignition",
          value: heroMetrics ? `${Math.round(heroMetrics.ignitionAltitude)} m` : "—",
        },
      ]}
      scene={
        <div className="relative h-full">
          {scene("100%", { top: 16, bottom: 84 })}
          {survivorView}
        </div>
      }
      bar={
        <div className="flex flex-wrap items-center gap-3">
          {transport}
          <div className="min-w-[240px] flex-1">{scrubber}</div>
        </div>
      }
      pinned={telemetry}
      tabs={[
        {
          id: "progress",
          label: "Progress",
          content: (
            <div className="space-y-3">
              <Hud>
                <HudTitle hint="Best, population average, and how many survived.">
                  Fitness by generation
                </HudTitle>
                {chartBlock(170)}
              </Hud>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Landing rate"
                  value={`${Math.round((landedNow / evo.population.length) * 100)}%`}
                  accent={landedNow > 0 ? "#4ade80" : "#f87171"}
                  meter={landedNow / evo.population.length}
                />
                <Stat
                  label="Fuel left"
                  value={heroMetrics ? Math.round(heroMetrics.fuelLeft) : "—"}
                  unit="kg"
                  accent="#38bdf8"
                  meter={heroMetrics ? heroMetrics.fuelLeft / evo.conditions[0].fuel : 0}
                />
              </div>
            </div>
          ),
        },
        {
          id: "genome",
          label: "Genome",
          content: (
            <Hud>
              <HudTitle hint="Eight numbers — the whole brain. Hover a bar for its value.">
                Winning genome
              </HudTitle>
              {hero && <GeneStrip genes={hero.genes} />}
              <div className="mt-3 space-y-1.5">
                {hero &&
                  CONTROLLER_SPEC.map((spec, i) => (
                    <div
                      key={spec.key}
                      className="mono flex justify-between gap-3 text-[11px] text-ink-3"
                    >
                      <span>{spec.label}</span>
                      <span className="text-ink tabular-nums">
                        {hero.genes[i].toFixed(3)} {spec.unit}
                      </span>
                    </div>
                  ))}
              </div>
            </Hud>
          ),
        },
        {
          id: "settings",
          label: "Settings",
          content: (
            <Hud>
              <HudTitle hint="All but the mutation rate start a fresh population.">
                Settings
              </HudTitle>
              {controls(true)}
            </Hud>
          ),
        },
        {
          id: "log",
          label: "Log",
          content: (
            <Hud>
              <HudTitle hint="Only the moments that changed something.">Flight log</HudTitle>
              {logBlock(10000)}
            </Hud>
          ),
        },
      ]}
    />
  );

  /* ---- the page layout ------------------------------------------------------ */

  return (
    <div className="space-y-5">
      {overlayStage}
      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
          <div>
            <h3 className="text-[16px] font-semibold text-ink">
              Generation {evo.generation}
              <span className="ml-2 text-[13px] font-normal text-ink-3">
                {evo.population.length} boosters, all falling at once
              </span>
            </h3>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Orange trail is the best of the generation; green ones landed, grey ones did not.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {transport}
            <ExpandButton onClick={stage.enter} />
          </div>
        </div>

        {stage.open ? (
          <div className="flex items-center justify-center bg-sunken" style={{ height: 440 }}>
            <span className="mono text-[12px] text-ink-3">playing full screen</span>
          </div>
        ) : (
          scene(440)
        )}

        {/* the readout sits under the scene rather than on top of the landing pad */}
        <div className="border-t border-line-soft px-5 py-4">{telemetry}</div>
        <div className="border-t border-line-soft px-5 py-3">{scrubber}</div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Generation" value={evo.generation} accent={ACCENT} />
        <Stat
          label="Landing rate"
          value={`${Math.round((landedNow / evo.population.length) * 100)}%`}
          accent={landedNow > 0 ? "#15803d" : "#dc2626"}
          meter={landedNow / evo.population.length}
        />
        <Stat
          label="Ignition altitude"
          value={heroMetrics ? Math.round(heroMetrics.ignitionAltitude) : "—"}
          unit="m"
          accent={ACCENT}
          hint={
            heroMetrics && heroMetrics.ignitionCount > 0
              ? `${heroMetrics.ignitionCount} engine start${heroMetrics.ignitionCount === 1 ? "" : "s"}, ${heroMetrics.burnTime.toFixed(1)} s of burn`
              : "engine never lit"
          }
        />
        <Stat
          label="Propellant left"
          value={heroMetrics ? Math.round(heroMetrics.fuelLeft) : "—"}
          unit="kg"
          accent="#0284c7"
          meter={heroMetrics ? heroMetrics.fuelLeft / evo.conditions[0].fuel : 0}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          <Card>
            <CardTitle hint="Best of the generation, the population average, and how many of them survived the landing.">
              How the fleet is doing
            </CardTitle>
            {chartBlock(200)}
          </Card>

          <Card>
            <CardTitle hint="Eight numbers. That is the entire brain — no neural network, no lookup table, nothing that has ever seen a rocket before.">
              The winning genome
            </CardTitle>
            {hero && <GeneStrip genes={hero.genes} />}
            <p className="mt-3 text-[13px] leading-[1.6] text-ink-2">
              Hover any bar to see what that gene controls. The first four decide how hard to burn,
              the last four decide which way to lean.
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle hint="Only the moments that actually changed something.">
              Flight log
            </CardTitle>
            {logBlock(260)}
          </Card>

          <Card>
            <CardTitle hint="Everything here changes the run. All but the mutation rate start a fresh population.">
              Settings
            </CardTitle>
            {controls()}
          </Card>

          <Note accent={ACCENT} title="What counts as a landing">
            Under {LANDING.maxDescentRate} m/s down, under {LANDING.maxLateralSpeed} m/s sideways,
            within {(LANDING.maxTilt * 180) / Math.PI}° of upright, and inside the{" "}
            {LANDING.padRadius} m circle. Miss any one of them and it is a crater.
          </Note>
        </div>
      </div>
    </div>
  );
}
