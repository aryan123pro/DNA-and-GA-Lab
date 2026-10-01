/**
 * ---------------------------------------------------------------------------
 *  A booster coming home.
 * ---------------------------------------------------------------------------
 *  Everything here is a scaled but honest model of a Falcon-9-class first
 *  stage on its landing burn. The numbers are real ones: 22 tonnes dry, a
 *  single Merlin 1D putting out 845 kN at sea level, 282 seconds of specific
 *  impulse, a 3.7 m body, gimbal limited to 15 degrees.
 *
 *  The one number that makes landing hard is MIN_THROTTLE. A Merlin cannot be
 *  throttled below about 40 percent. At landing mass that still gives roughly
 *  1.4 g of thrust — more than the rocket weighs. So the booster *cannot
 *  hover*. It cannot creep down and feel for the deck. It gets exactly one
 *  shot: fall, then light the engine late enough and hard enough that velocity
 *  reaches zero at the same instant altitude does.
 *
 *  Engineers call it a hoverslam. Everyone else calls it a suicide burn. It is
 *  the single most interesting thing a genetic algorithm can be asked to find,
 *  because nobody has to describe it — waiting is simply what survives.
 * ---------------------------------------------------------------------------
 */

export const G0 = 9.80665;

/** Falcon 9 first stage, near-empty, at the end of its flight. */
export const DRY_MASS = 22_000; // kg
export const BODY_LENGTH = 45; // m
export const BODY_RADIUS = 1.85; // m — 3.7 m across
export const FRONTAL_AREA = Math.PI * BODY_RADIUS * BODY_RADIUS;
export const DRAG_CD = 1.0; // blunt, falling engine-first

/** One Merlin 1D. It cannot be throttled below 40 percent — this is the whole problem. */
export const MAX_THRUST_EARTH = 845_000; // N
export const MIN_THROTTLE = 0.4;
export const ISP = 282; // s, sea level
export const EXHAUST_VELOCITY = ISP * G0; // m/s
export const MAX_GIMBAL = (15 * Math.PI) / 180; // rad

/**
 * A Merlin is lit by injecting a slug of TEA-TEB, a chemical that catches fire
 * the instant it meets air. The booster carries only a few slugs, so it gets
 * only a few starts — you cannot pulse the engine on and off to fake a
 * throttle setting below the floor. Leaving this out is the difference between
 * evolution finding a hoverslam and evolution finding a cheat.
 */
export const MAX_IGNITIONS = 5;

/**
 * A big engine cannot be flicked on and off like a light switch — there is a
 * spool-up and a shutdown transient either side of every burn. Holding it lit
 * for at least this long is what stops the optimiser from discovering that it
 * can "average" its way below the throttle floor by strobing the engine.
 */
export const MIN_BURN_TIME = 0.4; // s

/** Grid fins: they bleed off rotation, and they weathervane the body into the airflow. */
const FIN_DAMPING = 0.022;
const FIN_STABILITY = 0.016;
const RHO_SEA_LEVEL = 1.225;

/** What counts as landed rather than cratered. */
export const LANDING = {
  maxDescentRate: 6, // m/s
  maxLateralSpeed: 4, // m/s
  maxTilt: (8 * Math.PI) / 180, // rad
  padRadius: 18, // m from the middle of the deck — a droneship is 52 m across
};

export const OUT_OF_BOUNDS_X = 420; // m
export const OUT_OF_BOUNDS_Y = 2600; // m — generous, so a botched early burn still comes back down to be scored
export const MAX_FLIGHT_TIME = 20; // s on Earth — scaled per world below
export const DT = 0.02; // s — 50 Hz, fixed step, fully deterministic

export interface World {
  id: "earth" | "moon" | "mars";
  name: string;
  gravity: number; // m/s²
  airDensity: number; // kg/m³ at the surface
  /**
   * Thrust is re-sized per world so the thrust-to-weight ratio at minimum
   * throttle stays the same everywhere. A Moon lander does not fly a Merlin;
   * scaling it keeps the *shape* of the problem identical so you can see what
   * gravity and atmosphere alone change.
   */
  maxThrust: number;
  /** a descent takes longer in weaker gravity, so the clock has to stretch too */
  maxFlightTime: number;
  blurb: string;
}

/** Times scale as 1/sqrt(g), the same way entry speeds scale as sqrt(g). */
function flightTimeFor(gravity: number) {
  return MAX_FLIGHT_TIME * Math.sqrt(9.81 / gravity);
}

export const WORLDS: Record<World["id"], World> = {
  earth: {
    id: "earth",
    name: "Earth",
    gravity: 9.81,
    airDensity: RHO_SEA_LEVEL,
    maxThrust: MAX_THRUST_EARTH,
    maxFlightTime: flightTimeFor(9.81),
    blurb: "Thick air to brake against, and the engine still cannot hover.",
  },
  moon: {
    id: "moon",
    name: "The Moon",
    gravity: 1.62,
    airDensity: 0,
    maxThrust: MAX_THRUST_EARTH * (1.62 / 9.81),
    maxFlightTime: flightTimeFor(1.62),
    blurb: "No air at all. Nothing slows you, and the grid fins are dead weight.",
  },
  mars: {
    id: "mars",
    name: "Mars",
    gravity: 3.72,
    airDensity: 0.02,
    maxThrust: MAX_THRUST_EARTH * (3.72 / 9.81),
    maxFlightTime: flightTimeFor(3.72),
    blurb: "Barely any atmosphere — just enough to tease, not enough to stop you.",
  },
};

export interface Command {
  /** 0, or anywhere from MIN_THROTTLE to 1. Values in between snap to off. */
  throttle: number;
  /** radians, clamped to ±MAX_GIMBAL */
  gimbal: number;
}

export type Status = "flying" | "landed" | "crashed";

export interface RocketState {
  t: number;
  /** metres from the middle of the deck, + is right */
  x: number;
  /** metres of altitude, measured at the base of the booster */
  y: number;
  vx: number;
  vy: number;
  /** tilt away from vertical in radians, + means the nose leans toward +x */
  angle: number;
  omega: number;
  fuel: number;
  throttle: number;
  gimbal: number;
  /** how many times the engine has been lit — see MAX_IGNITIONS */
  ignitions: number;
  /** seconds the engine has been continuously lit, 0 when cold */
  litFor: number;
  status: Status;
}

export interface StartCondition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fuel: number;
}

/** The nominal entry: high, fast, a little off-centre, a little crooked. */
export const NOMINAL_START: StartCondition = {
  x: 45,
  y: 700,
  vx: -4,
  vy: -75,
  angle: (4 * Math.PI) / 180,
  fuel: 1_800,
};

/**
 * The single entry a memorised script is rehearsed against — straight down the
 * middle, no crosswind, no offset. A script is only ever as good as the
 * rehearsal, which is the entire point of step three.
 */
export const REHEARSED_START: StartCondition = {
  x: 12,
  y: 700,
  vx: 0,
  vy: -75,
  angle: 0,
  fuel: 1_800,
};

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function makeState(start: StartCondition): RocketState {
  return {
    t: 0,
    x: start.x,
    y: start.y,
    vx: start.vx,
    vy: start.vy,
    angle: start.angle,
    omega: 0,
    fuel: start.fuel,
    throttle: 0,
    gimbal: 0,
    ignitions: 0,
    litFor: 0,
    status: "flying",
  };
}

/**
 * The same problem, re-posed for a different world. Entry speed scales with
 * the square root of gravity, which is exactly what makes the *shape* of the
 * descent identical everywhere — so the only thing that genuinely changes
 * between Earth, Mars and the Moon is the air.
 */
export function startForWorld(
  world: World,
  base: StartCondition = NOMINAL_START,
): StartCondition {
  const k = Math.sqrt(world.gravity / 9.81);
  return { ...base, vy: base.vy * k, vx: base.vx * k };
}

/**
 * One fixed step of rigid-body flight. Semi-implicit Euler: velocities first,
 * then positions, which stays stable at 50 Hz without any cleverness.
 */
export function stepRocket(
  s: RocketState,
  cmd: Command,
  world: World,
  dt: number = DT,
  wind = 0,
): RocketState {
  if (s.status !== "flying") return s;

  const mass = DRY_MASS + s.fuel;

  // --- commands ---------------------------------------------------------
  // The engine is either off or running at 40 percent or more. There is no
  // gentle in-between, and that is exactly why this is hard.
  let throttle = clamp(cmd.throttle, 0, 1);
  if (throttle < MIN_THROTTLE) throttle = 0;
  if (s.fuel <= 0) throttle = 0;

  // Lighting the engine costs a slug of igniter fluid, and there are only a
  // few on board. Once they are gone the engine stays cold no matter what the
  // guidance asks for — so the booster cannot pulse its way to a fake throttle.
  let ignitions = s.ignitions;
  let litFor = s.litFor;
  const wasLit = s.throttle > 0;

  // it cannot shut down mid-transient either
  if (wasLit && throttle === 0 && litFor < MIN_BURN_TIME && s.fuel > 0) {
    throttle = MIN_THROTTLE;
  }
  if (throttle > 0 && !wasLit) {
    if (ignitions >= MAX_IGNITIONS) throttle = 0;
    else {
      ignitions += 1;
      litFor = 0;
    }
  }
  litFor = throttle > 0 ? litFor + dt : 0;

  const gimbal = clamp(cmd.gimbal, -MAX_GIMBAL, MAX_GIMBAL);

  const thrust = throttle * world.maxThrust;

  // --- forces -----------------------------------------------------------
  // Thrust pushes along the nozzle, which is the body axis turned by the gimbal.
  const thrustDir = s.angle + gimbal;
  let fx = thrust * Math.sin(thrustDir);
  let fy = thrust * Math.cos(thrustDir);

  // Weight.
  fy -= mass * world.gravity;

  // Drag, against the air rather than against the ground.
  const relVx = s.vx - wind;
  const relVy = s.vy;
  const speed = Math.hypot(relVx, relVy);
  if (world.airDensity > 0 && speed > 0.01) {
    const drag = 0.5 * world.airDensity * DRAG_CD * FRONTAL_AREA * speed * speed;
    fx -= drag * (relVx / speed);
    fy -= drag * (relVy / speed);
  }

  // --- rotation ---------------------------------------------------------
  // Off-axis thrust at the nozzle, half a body length below the centre of mass,
  // is the only thing the booster can actually steer with.
  const inertia = (mass * BODY_LENGTH * BODY_LENGTH) / 12;
  const gimbalTorque = (BODY_LENGTH / 2) * thrust * Math.sin(gimbal);
  let alpha = -gimbalTorque / inertia;

  // Grid fins: they damp the rate, and they weathervane the body back toward
  // the airflow. Without an atmosphere neither of these does anything, which
  // is why the Moon preset is so much twitchier.
  const rhoRatio = world.airDensity / RHO_SEA_LEVEL;
  if (rhoRatio > 0 && speed > 0.01) {
    alpha -= FIN_DAMPING * rhoRatio * speed * s.omega;
    alpha -= FIN_STABILITY * rhoRatio * speed * Math.sin(s.angle);
  }

  // --- integrate --------------------------------------------------------
  const omega = s.omega + alpha * dt;
  const angle = s.angle + omega * dt;
  const vx = s.vx + (fx / mass) * dt;
  const vy = s.vy + (fy / mass) * dt;
  const x = s.x + vx * dt;
  const y = s.y + vy * dt;

  const burned = (thrust / EXHAUST_VELOCITY) * dt;
  const fuel = Math.max(0, s.fuel - burned);

  const next: RocketState = {
    t: s.t + dt,
    x,
    y,
    vx,
    vy,
    angle,
    omega,
    fuel,
    throttle,
    gimbal,
    ignitions,
    litFor,
    status: "flying",
  };

  // --- did it stop flying ----------------------------------------------
  if (y <= 0) {
    next.y = 0;
    next.status = isGoodLanding(next) ? "landed" : "crashed";
  } else if (
    Math.abs(x) > OUT_OF_BOUNDS_X ||
    y > OUT_OF_BOUNDS_Y ||
    next.t > world.maxFlightTime
  ) {
    next.status = "crashed";
  }

  return next;
}

export function isGoodLanding(s: RocketState): boolean {
  return (
    Math.abs(s.vy) <= LANDING.maxDescentRate &&
    Math.abs(s.vx) <= LANDING.maxLateralSpeed &&
    Math.abs(s.angle) <= LANDING.maxTilt &&
    Math.abs(s.x) <= LANDING.padRadius
  );
}

/**
 * A recorded flight, stored flat so that replaying forty of them at sixty
 * frames a second does not spew objects all over the garbage collector.
 * Stride is 6: x, y, angle, throttle, gimbal, fuel.
 */
export interface Trail {
  dt: number;
  count: number;
  data: Float32Array;
}

export const TRAIL_STRIDE = 6;

export interface FlightMetrics {
  /** how far from the middle of the deck it ended up */
  missDistance: number;
  /** speed at the moment of contact */
  impactSpeed: number;
  descentRate: number;
  lateralSpeed: number;
  tiltDeg: number;
  fuelLeft: number;
  fuelUsed: number;
  flightTime: number;
  /** altitude at which the *landing* burn started — the giveaway for a hoverslam */
  ignitionAltitude: number;
  /** how many separate times the engine was lit */
  ignitionCount: number;
  burnTime: number;
}

export interface Flight {
  final: RocketState;
  outcome: Status;
  metrics: FlightMetrics;
  trail: Trail | null;
}

export interface SimOptions {
  world?: World;
  dt?: number;
  /** keep the whole flight for playback; skip it when you only want a score */
  record?: boolean;
  /** steady crosswind in m/s, + blows toward +x */
  wind?: number;
  /** gusts on top of the steady wind */
  gust?: number;
  seed?: number;
}

/**
 * Fly one booster all the way down. `pilot` is anything that can look at the
 * state and return a command — an evolved genome, a hand-tuned controller, or
 * a person mashing the arrow keys.
 */
export function simulate(
  pilot: (s: RocketState) => Command,
  start: StartCondition,
  opts: SimOptions = {},
): Flight {
  const world = opts.world ?? WORLDS.earth;
  const dt = opts.dt ?? DT;
  const record = opts.record ?? false;
  const steadyWind = opts.wind ?? 0;
  const gust = opts.gust ?? 0;

  const maxSteps = Math.ceil(world.maxFlightTime / dt) + 2;
  const data = record ? new Float32Array(maxSteps * TRAIL_STRIDE) : null;
  let count = 0;

  let s = makeState(start);
  const startFuel = start.fuel;
  let ignitionAltitude = 0;
  let ignitionCount = 0;
  let burnTime = 0;

  const push = (st: RocketState) => {
    if (!data) return;
    const i = count * TRAIL_STRIDE;
    data[i] = st.x;
    data[i + 1] = st.y;
    data[i + 2] = st.angle;
    data[i + 3] = st.throttle;
    data[i + 4] = st.gimbal;
    data[i + 5] = st.fuel;
    count++;
  };

  push(s);

  for (let step = 0; step < maxSteps && s.status === "flying"; step++) {
    // Gusts are a deterministic function of time, so a replay is bit-identical.
    const wind =
      steadyWind + (gust ? gust * Math.sin(s.t * 1.7 + (opts.seed ?? 0)) * Math.sin(s.t * 0.41) : 0);

    const cmd = pilot(s);
    const next = stepRocket(s, cmd, world, dt, wind);

    if (next.throttle > 0) {
      // record the *last* light-up, which is the one that matters — an early
      // flicker is not the landing burn
      if (s.throttle === 0) {
        ignitionAltitude = s.y;
        ignitionCount += 1;
      }
      burnTime += dt;
    }

    s = next;
    push(s);
  }

  if (s.status === "flying") s = { ...s, status: "crashed" }; // ran out of clock

  return {
    final: s,
    outcome: s.status,
    metrics: {
      missDistance: Math.abs(s.x),
      impactSpeed: Math.hypot(s.vx, s.vy),
      descentRate: Math.abs(s.vy),
      lateralSpeed: Math.abs(s.vx),
      tiltDeg: Math.abs((s.angle * 180) / Math.PI),
      fuelLeft: s.fuel,
      fuelUsed: startFuel - s.fuel,
      flightTime: s.t,
      ignitionAltitude,
      ignitionCount,
      burnTime,
    },
    trail: data ? { dt, count, data } : null,
  };
}

/** Read a recorded flight back at an arbitrary moment. */
export function sampleTrail(trail: Trail, t: number) {
  const i = Math.max(0, Math.min(trail.count - 1, Math.floor(t / trail.dt)));
  const o = i * TRAIL_STRIDE;
  return {
    x: trail.data[o],
    y: trail.data[o + 1],
    angle: trail.data[o + 2],
    throttle: trail.data[o + 3],
    gimbal: trail.data[o + 4],
    fuel: trail.data[o + 5],
    finished: i >= trail.count - 1,
  };
}

export function trailDuration(trail: Trail) {
  return trail.count * trail.dt;
}

/**
 * Where a perfect hoverslam would light the engine, ignoring drag and the mass
 * it burns off on the way down. Used only to talk about the answer in the UI —
 * the genetic algorithm is never told any of this.
 */
export function idealIgnitionAltitude(start: StartCondition, world: World): number {
  const mass = DRY_MASS + start.fuel;
  const netDecel = (world.maxThrust - mass * world.gravity) / mass;
  if (netDecel <= 0) return NaN;
  const v0 = Math.abs(start.vy);
  return (v0 * v0 + 2 * world.gravity * start.y) / (2 * (netDecel + world.gravity));
}
