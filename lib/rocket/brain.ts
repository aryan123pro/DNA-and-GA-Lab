/**
 * ---------------------------------------------------------------------------
 *  Two ways to write a rocket's DNA — and only one of them actually flies.
 * ---------------------------------------------------------------------------
 *  This is the argument the whole page is built around.
 *
 *  A SCHEDULE genome is a script: throttle this much at second three, gimbal
 *  that much at second five. Evolution finds a good script quickly, and the
 *  landing looks perfect — right up until you start the booster a hundred
 *  metres higher, at which point it drives itself into the deck at full speed.
 *  It never learned to land. It learned *one* landing, by heart.
 *
 *  A CONTROLLER genome is a reflex: eight numbers describing how hard to burn
 *  given how fast you are falling, and how far to lean given how far off
 *  target you are. It is a far harder thing to evolve, and it lands from
 *  almost anywhere, in wind, on a different planet.
 *
 *  Real launch vehicles fly closed-loop guidance for exactly this reason. The
 *  difference between the two genomes here is the difference between
 *  memorising and understanding, and you can watch it happen.
 * ---------------------------------------------------------------------------
 */

import { Command, MAX_GIMBAL, MIN_THROTTLE, RocketState } from "./physics";

export type BrainKind = "schedule" | "controller";

/* -------------------------------------------------------------------------- */
/* the memoriser                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A burn plan, written the way a real one is: one ignition time, then a
 * throttle profile to follow from that moment on, plus a steering profile on
 * the clock. The booster cannot hover and has only a few starts, so a single
 * continuous burn is the only shape that physics allows anyway — and
 * parameterising it this way means "when do I light the engine" is one smooth
 * number the search can slide up and down, instead of a pattern of on/off
 * slices it has to stumble onto.
 *
 * It still reads nothing whatsoever from the rocket. It is a stopwatch and a
 * list of instructions, and that is exactly why it will fail later.
 */
export const IGNITION_MAX = 10; // s
export const BURN_SEGMENTS = 5;
export const GIMBAL_SEGMENTS = 6;
export const SEGMENT_SECONDS = 2;
export const SCHEDULE_GENES = 1 + BURN_SEGMENTS + GIMBAL_SEGMENTS;
export const SCHEDULE_SPAN = GIMBAL_SEGMENTS * SEGMENT_SECONDS;

const FIRST_THROTTLE = 1;
const FIRST_GIMBAL = 1 + BURN_SEGMENTS;

export function ignitionTimeOf(genes: number[]) {
  return genes[0];
}

export function scheduleCommand(genes: number[], t: number): Command {
  const gimbalSlice = Math.min(
    GIMBAL_SEGMENTS - 1,
    Math.max(0, Math.floor(t / SEGMENT_SECONDS)),
  );
  const gimbal = genes[FIRST_GIMBAL + gimbalSlice] * MAX_GIMBAL;

  const ignition = genes[0];
  if (t < ignition) return { throttle: 0, gimbal };

  const seg = Math.min(BURN_SEGMENTS - 1, Math.floor((t - ignition) / SEGMENT_SECONDS));
  return { throttle: genes[FIRST_THROTTLE + seg], gimbal };
}

/** The script as a row of timed instructions, for showing it to a human. */
export function scheduleProfile(genes: number[]) {
  const ignition = genes[0];
  const rows = [{ from: 0, to: ignition, throttle: 0, gimbal: genes[FIRST_GIMBAL] }];
  for (let i = 0; i < BURN_SEGMENTS; i++) {
    const from = ignition + i * SEGMENT_SECONDS;
    const gimbalSlice = Math.min(
      GIMBAL_SEGMENTS - 1,
      Math.max(0, Math.floor(from / SEGMENT_SECONDS)),
    );
    rows.push({
      from,
      to: from + SEGMENT_SECONDS,
      throttle: genes[FIRST_THROTTLE + i],
      gimbal: genes[FIRST_GIMBAL + gimbalSlice],
    });
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* the pilot                                                                  */
/* -------------------------------------------------------------------------- */

export interface GeneSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  unit: string;
  hint: string;
}

/**
 * Eight numbers. The first four decide how hard to burn, the last four decide
 * which way to lean. Every one of them is a knob a real guidance engineer
 * would recognise — this is a gain-scheduled PD controller, and evolutionary
 * tuning of exactly this kind of gain set is a genuine industrial use of
 * genetic algorithms.
 */
export const CONTROLLER_SPEC: GeneSpec[] = [
  {
    key: "vBase",
    label: "Floor speed",
    min: 0,
    max: 30,
    unit: "m/s",
    hint: "How fast it still wants to be moving when it is right above the deck. Small is good.",
  },
  {
    key: "vSqrt",
    label: "Descent profile",
    min: 0,
    max: 6,
    unit: "×√m",
    hint: "Target descent rate grows with the square root of altitude — the shape a constant-deceleration stop actually has.",
  },
  {
    key: "throttleGain",
    label: "Throttle response",
    min: 0,
    max: 0.6,
    unit: "per m/s",
    hint: "How hard it stamps on the engine when it is falling faster than the profile says it should.",
  },
  {
    key: "throttleBias",
    label: "Throttle bias",
    min: -0.6,
    max: 0.6,
    unit: "",
    hint: "A constant added to the throttle. Negative means it holds off longer before lighting up.",
  },
  {
    key: "leanPos",
    label: "Lean per metre off",
    min: -0.02,
    max: 0.02,
    unit: "rad/m",
    hint: "How far it tips over to correct sideways error. Get the sign wrong and it sprints away from the pad.",
  },
  {
    key: "leanVel",
    label: "Lean per m/s drift",
    min: -0.12,
    max: 0.12,
    unit: "rad per m/s",
    hint: "Damping on the sideways correction, so it stops leaning before it overshoots.",
  },
  {
    key: "gimbalP",
    label: "Gimbal stiffness",
    min: -4,
    max: 4,
    unit: "",
    hint: "How aggressively the engine swivels to reach the tilt it wants.",
  },
  {
    key: "gimbalD",
    label: "Gimbal damping",
    min: -2.5,
    max: 2.5,
    unit: "",
    hint: "Fights the rotation rate itself. Without it the booster wobbles all the way down.",
  },
];

export const CONTROLLER_GENES = CONTROLLER_SPEC.length;

/** How far the controller is willing to tip the booster over. */
const MAX_COMMANDED_TILT = (25 * Math.PI) / 180;

export function controllerCommand(genes: number[], s: RocketState): Command {
  const [vBase, vSqrt, throttleGain, throttleBias, leanPos, leanVel, gimbalP, gimbalD] = genes;

  // How fast should we be falling at this altitude? A square-root profile is
  // what a constant deceleration looks like, so this is the right shape.
  const targetDescent = -(vBase + vSqrt * Math.sqrt(Math.max(s.y, 0)));
  const speedError = targetDescent - s.vy; // positive when falling too fast
  const throttle = throttleGain * speedError + throttleBias;

  // Lean into the sideways error, then swivel the engine to hold that lean.
  const wantTilt = clampAbs(leanPos * s.x + leanVel * s.vx, MAX_COMMANDED_TILT);
  const tiltError = wantTilt - s.angle;
  const gimbal = gimbalP * tiltError + gimbalD * s.omega;

  return { throttle, gimbal };
}

function clampAbs(v: number, limit: number) {
  return v < -limit ? -limit : v > limit ? limit : v;
}

/* -------------------------------------------------------------------------- */

export function geneCount(kind: BrainKind) {
  return kind === "schedule" ? SCHEDULE_GENES : CONTROLLER_GENES;
}

/** The legal range of each gene, so mutation knows how far it may push. */
export function geneBounds(kind: BrainKind, index: number): [number, number] {
  if (kind === "controller") {
    const spec = CONTROLLER_SPEC[index];
    return [spec.min, spec.max];
  }
  // schedule: [ignition time, throttle x5, gimbal x6]
  if (index === 0) return [0, IGNITION_MAX];
  if (index < FIRST_GIMBAL) return [MIN_THROTTLE, 1];
  return [-1, 1];
}

export function randomGenes(kind: BrainKind, rnd: () => number): number[] {
  return Array.from({ length: geneCount(kind) }, (_, i) => {
    const [lo, hi] = geneBounds(kind, i);
    return lo + rnd() * (hi - lo);
  });
}

/** Turn a genome into something `simulate` can fly. */
export function pilotFor(kind: BrainKind, genes: number[]) {
  return kind === "schedule"
    ? (s: RocketState) => scheduleCommand(genes, s.t)
    : (s: RocketState) => controllerCommand(genes, s);
}
