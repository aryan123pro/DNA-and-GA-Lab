"use client";

import { useEffect, useMemo, useState } from "react";
import LaunchScene, { SceneRocket, usePlayback } from "./LaunchScene";
import { controllerCommand } from "@/lib/rocket/brain";
import { StartCondition, WORLDS, simulate, trailDuration } from "@/lib/rocket/physics";

/**
 * A controller this very page's genetic algorithm bred (150 generations, the
 * default settings, on Earth). It is stored rather than re-evolved so the
 * banner is flying the instant the page opens — but it is the same eight
 * numbers, flying the same physics, as everything further down.
 */
const CHAMPION = [0, 4.87153, 0.59496, 0.48975, -0.01344, -0.04345, -3.82009, 2.5];

const ENTRIES: StartCondition[] = [
  { x: 60, y: 720, vx: -6, vy: -75, angle: 0.07, fuel: 1800 },
  { x: -55, y: 680, vx: 5, vy: -70, angle: -0.06, fuel: 1800 },
  { x: 30, y: 760, vx: -2, vy: -80, angle: 0.03, fuel: 1800 },
  { x: -20, y: 700, vx: 3, vy: -72, angle: -0.04, fuel: 1800 },
  { x: 75, y: 650, vx: -8, vy: -68, angle: 0.08, fuel: 1800 },
];

const WIND = 3;
/** how long to admire the landing before dropping the next one */
const HOLD = 2.6;

export default function HeroDemo({ height = 340 }: { height?: number | string }) {
  const [round, setRound] = useState(0);

  const flights = useMemo(
    () =>
      ENTRIES.map((start) =>
        simulate((s) => controllerCommand(CHAMPION, s), start, {
          world: WORLDS.earth,
          wind: WIND,
          record: true,
        }),
      ),
    [],
  );

  const flight = flights[round % flights.length];
  const rockets: SceneRocket[] = useMemo(
    () => [{ id: `demo-${round}`, trail: flight.trail!, outcome: flight.outcome, hero: true }],
    [flight, round],
  );
  // the replay clock runs on past touchdown, which is when the scene plays its
  // landing effects; then the next booster drops
  const duration = trailDuration(flight.trail!) + HOLD;
  const { t, seek, ended } = usePlayback(duration, 1.25, true);

  useEffect(() => {
    if (!ended) return;
    const id = setTimeout(() => {
      setRound((r) => r + 1);
      seek(0);
    }, 0);
    return () => clearTimeout(id);
  }, [ended, seek]);

  const m = flight.metrics;
  const landedNow = t >= trailDuration(flight.trail!);

  return (
    <LaunchScene
      rockets={rockets}
      t={t}
      world={WORLDS.earth}
      wind={WIND}
      height={height}
      badge={false}
      inset={{ top: 30, bottom: 14 }}
      overlay={
        <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1.5">
          <div className="mono rounded-lg border border-white/60 bg-white/75 px-2.5 py-1 text-[10.5px] whitespace-nowrap text-ink-2 shadow-sm backdrop-blur-md">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 align-middle" />
            LIVE · evolved pilot, 8 genes
          </div>
          <div
            className="mono rounded-lg border px-2.5 py-1 text-[10.5px] whitespace-nowrap shadow-sm backdrop-blur-md transition-opacity duration-300"
            style={{
              opacity: landedNow ? 1 : 0,
              background: "rgba(240,253,244,0.85)",
              borderColor: "rgba(34,197,94,0.4)",
              color: "#166534",
            }}
          >
            touchdown {m.impactSpeed.toFixed(1)} m/s · lit at {Math.round(m.ignitionAltitude)} m
          </div>
        </div>
      }
    />
  );
}
