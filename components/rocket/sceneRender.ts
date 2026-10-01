/**
 * ---------------------------------------------------------------------------
 *  The renderer behind every Landing Lab scene.
 * ---------------------------------------------------------------------------
 *  Everything here is a pure function of (recorded trails, replay clock, wall
 *  clock). Nothing is simulated twice and nothing feeds back into the physics:
 *  explosions, smoke and dust are all *derived* from the flight that was
 *  already recorded, and seeded from the booster's id, so scrubbing backwards
 *  and forwards gives the same picture every time.
 *
 *  Where the effects can be honest, they are:
 *    · the plume fans out as the air thins — tight with shock diamonds at sea
 *      level, wide and ghostly in vacuum
 *    · every engine start shows the green flash of TEA-TEB igniter
 *    · debris flies under the world's own gravity, so a Moon crash lofts slow
 *      and far and leaves no smoke column, because there is no air to hold one
 *    · a crash with an empty tank is a fizzle; one with fuel left is not
 *    · legs deploy on approach, and a landed booster vents its oxygen tank
 * ---------------------------------------------------------------------------
 */

import {
  BODY_LENGTH,
  BODY_RADIUS,
  DRY_MASS,
  LANDING,
  Status,
  TRAIL_STRIDE,
  Trail,
  World,
} from "@/lib/rocket/physics";

/* -------------------------------------------------------------------------- */
/* public shapes                                                              */
/* -------------------------------------------------------------------------- */

export interface SceneRocket {
  id: string;
  trail: Trail;
  outcome: Status;
  hero?: boolean;
}

export type Camera = { cx: number; cy: number; scale: number };

export interface PaintData {
  rockets: SceneRocket[];
  t: number;
  world: World;
  wind: number;
  /** pixels of the canvas kept clear at the top and bottom for floating panels */
  inset: { top: number; bottom: number };
  /** draw the stopping-distance bracket under the hero */
  guide: boolean;
  /** a caption pinned to the hero, e.g. "BEST" */
  tag: string | null;
}

/** State the renderer keeps between frames — never read by React. */
export interface SceneMemory {
  camera: Camera | null;
  /** wall-clock time each booster was first seen finished, so effects outlive a paused clock */
  finished: Map<string, { trail: Trail; wall: number }>;
}

export function makeMemory(): SceneMemory {
  return { camera: null, finished: new Map() };
}

/* -------------------------------------------------------------------------- */
/* worlds                                                                     */
/* -------------------------------------------------------------------------- */

interface Theme {
  sky: [number, string][];
  groundTop: string;
  groundBottom: string;
  horizon: string;
  /** distant and middle terrain silhouettes */
  far: string;
  mid: string;
  /** mesas on Mars, tree line on Earth, rolling regolith on the Moon */
  ridge: "trees" | "mesa" | "rolling";
  haze: string;
  grid: string;
  gridText: string;
  padFill: string;
  padTop: string;
  padStroke: string;
  padText: string;
  padName: string;
  /** "r,g,b" */
  dust: string;
  exhaust: string;
  smoke: string;
  stars: boolean;
  clouds: boolean;
  sun: {
    fx: number;
    fy: number;
    r: number;
    core: string;
    glow: string;
    halo: number;
  };
  companion?: "earth" | "phobos";
  /** ground clutter */
  clutter: "tufts" | "rocks" | "craters";
  /** labels drawn straight onto the sky */
  ink: string;
  dark: boolean;
}

const THEMES: Record<World["id"], Theme> = {
  earth: {
    sky: [
      [0, "#2f6aa8"],
      [0.38, "#6aa2d3"],
      [0.75, "#b5d4ea"],
      [1, "#e8eef0"],
    ],
    groundTop: "#a8a07c",
    groundBottom: "#6f6a4f",
    horizon: "rgba(60,62,48,0.35)",
    far: "#8ba5a6",
    mid: "#64744f",
    ridge: "trees",
    haze: "rgba(236,242,244,0.75)",
    grid: "rgba(255,255,255,0.32)",
    gridText: "rgba(22,42,62,0.62)",
    padFill: "#bdbab0",
    padTop: "#dedbd2",
    padStroke: "rgba(70,72,62,0.45)",
    padText: "rgba(40,42,34,0.72)",
    padName: "LANDING ZONE 1",
    dust: "196,184,152",
    exhaust: "236,236,232",
    smoke: "44,40,38",
    stars: false,
    clouds: true,
    sun: {
      fx: 0.16,
      fy: 0.12,
      r: 16,
      core: "#fffdf2",
      glow: "255,244,214",
      halo: 7,
    },
    clutter: "tufts",
    ink: "rgba(22,42,62,0.78)",
    dark: false,
  },
  mars: {
    // the Martian sky really is butterscotch — suspended dust scatters red forward
    sky: [
      [0, "#6b3b25"],
      [0.38, "#a8653f"],
      [0.74, "#d09867"],
      [1, "#e9c79d"],
    ],
    groundTop: "#a5502b",
    groundBottom: "#5e2914",
    horizon: "rgba(70,30,14,0.45)",
    far: "#c58a62",
    mid: "#8f4525",
    ridge: "mesa",
    haze: "rgba(236,196,152,0.7)",
    grid: "rgba(255,226,196,0.26)",
    gridText: "rgba(54,22,8,0.72)",
    padFill: "#a9998a",
    padTop: "#cbb9a6",
    padStroke: "rgba(80,42,22,0.55)",
    padText: "rgba(58,26,12,0.82)",
    padName: "JEZERO LANDING SITE",
    dust: "176,104,62",
    exhaust: "214,170,130",
    smoke: "70,36,22",
    stars: false,
    clouds: false,
    // seen from Mars the Sun is two-thirds the size, with a pale blue-white halo
    sun: {
      fx: 0.2,
      fy: 0.15,
      r: 10,
      core: "#fbf7ee",
      glow: "214,226,236",
      halo: 5,
    },
    companion: "phobos",
    clutter: "rocks",
    ink: "rgba(54,22,8,0.8)",
    dark: false,
  },
  moon: {
    // no air means no scattering, so the sky stays black at high noon
    sky: [
      [0, "#000000"],
      [0.65, "#04060b"],
      [1, "#0a0f18"],
    ],
    groundTop: "#a19e96",
    groundBottom: "#4e4c47",
    horizon: "rgba(230,235,245,0.3)",
    far: "#5f5e5a",
    mid: "#7d7b75",
    ridge: "rolling",
    haze: "rgba(0,0,0,0)",
    grid: "rgba(255,255,255,0.12)",
    gridText: "rgba(226,232,242,0.6)",
    padFill: "#9a9890",
    padTop: "#cfcdc6",
    padStroke: "rgba(255,255,255,0.28)",
    padText: "rgba(240,243,248,0.75)",
    padName: "TRANQUILLITY BASE",
    dust: "182,178,168",
    exhaust: "210,220,240",
    smoke: "120,118,112",
    stars: true,
    clouds: false,
    // a harsh point of light: no atmosphere to bloom it
    sun: {
      fx: 0.12,
      fy: 0.1,
      r: 9,
      core: "#ffffff",
      glow: "255,255,255",
      halo: 2.4,
    },
    companion: "earth",
    clutter: "craters",
    ink: "rgba(226,232,242,0.85)",
    dark: true,
  },
};

export function themeFor(world: World) {
  return THEMES[world.id];
}

/* -------------------------------------------------------------------------- */
/* small helpers                                                              */
/* -------------------------------------------------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const TAU = Math.PI * 2;
const ACCENT = "#ea580c";

/** Landing Zone 1 at the Cape is a concrete circle about 86 m across. */
const PAD_RADIUS = 46;
/**
 * A booster is 3.7 m across and 45 m tall — at a scale that fits a 700 m drop
 * it would be a hairline. Width gets a pixel minimum rather than a fixed
 * exaggeration, and returns to the true 12:1 once the camera closes in.
 */
const MIN_BODY_PX = 5;
/** legs swing out between these altitudes, the way the real ones do on approach */
const LEGS_START = 150;
const LEGS_DONE = 85;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}
function smooth(k: number) {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, fast, and the same numbers every replay */
function rng(seed: number) {
  let a = seed | 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/* ---- soft sprites ---------------------------------------------------------- */
// Hundreds of radial gradients a frame would be slow; one pre-rendered blob per
// colour, stretched with drawImage, costs almost nothing.

const sprites = new Map<string, HTMLCanvasElement>();

function sprite(rgb: string, falloff: "soft" | "hard" = "soft"): HTMLCanvasElement {
  const key = `${rgb}|${falloff}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (falloff === "hard") {
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.5, `rgba(${rgb},0.9)`);
    grad.addColorStop(0.8, `rgba(${rgb},0.35)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
  } else {
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.35, `rgba(${rgb},0.6)`);
    grad.addColorStop(0.7, `rgba(${rgb},0.18)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(key, c);
  return c;
}

function blot(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  alpha: number,
) {
  if (alpha <= 0.004 || r < 0.4) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
}

/* ---- reading a trail ------------------------------------------------------- */

interface Sample {
  x: number;
  y: number;
  angle: number;
  throttle: number;
  gimbal: number;
  fuel: number;
  vx: number;
  vy: number;
  i: number;
  finished: boolean;
}

/**
 * The physics runs at 50 Hz and the screen at 60–120, so positions are blended
 * between the two neighbouring steps. Throttle is not — the engine is either lit
 * or it is not, and blending would invent a setting the physics forbids.
 */
function sampleAt(trail: Trail, t: number): Sample {
  const d = trail.data;
  const S = TRAIL_STRIDE;
  const n = trail.count;
  const f = Math.max(0, t / trail.dt);
  // a clock built by adding up 0.02 s steps lands a hair short of the step it
  // means (451.99999…), which would leave a finished flight never "finished"
  let i = Math.floor(f + 1e-6);
  if (i >= n - 1) {
    i = Math.max(0, n - 1);
    const o = i * S;
    const p = Math.max(0, i - 1) * S;
    const inv = i > 0 ? 1 / trail.dt : 0;
    return {
      x: d[o],
      y: d[o + 1],
      angle: d[o + 2],
      throttle: d[o + 3],
      gimbal: d[o + 4],
      fuel: d[o + 5],
      vx: (d[o] - d[p]) * inv,
      vy: (d[o + 1] - d[p + 1]) * inv,
      i,
      finished: true,
    };
  }
  const k = f - i;
  const o = i * S;
  const q = o + S;
  return {
    x: lerp(d[o], d[q], k),
    y: lerp(d[o + 1], d[q + 1], k),
    angle: lerp(d[o + 2], d[q + 2], k),
    throttle: d[o + 3],
    gimbal: lerp(d[o + 4], d[q + 4], k),
    fuel: lerp(d[o + 5], d[q + 5], k),
    vx: (d[q] - d[o]) / trail.dt,
    vy: (d[q + 1] - d[o + 1]) / trail.dt,
    i,
    finished: false,
  };
}

/** How long the engine has been continuously lit at step i, in seconds (capped). */
function litFor(trail: Trail, i: number, cap = 0.6) {
  const d = trail.data;
  const S = TRAIL_STRIDE;
  const limit = Math.ceil(cap / trail.dt);
  let k = 0;
  while (k < limit && i - k >= 0 && d[(i - k) * S + 3] > 0) k++;
  return k * trail.dt;
}

/* -------------------------------------------------------------------------- */
/* the frame                                                                  */
/* -------------------------------------------------------------------------- */

interface Drawn {
  id: string;
  seed: number;
  s: Sample;
  outcome: Status;
  hero: boolean;
  /** seconds since this booster stopped flying, or -1 if it is still going */
  since: number;
  /** the trail's own clock, extended past the end by `since` */
  tEff: number;
  trail: Trail;
  upTo: number;
  /** speed and fuel at the moment it stopped, for sizing the aftermath */
  impact: number;
  // screen
  px: number;
  py: number;
  w: number;
  h: number;
}

interface Env {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  theme: Theme;
  world: World;
  wind: number;
  air: number;
  cam: Camera;
  sx: (x: number) => number;
  sy: (y: number) => number;
  groundY: number;
  /** pixels per metre, but never smaller than the booster's own drawn scale */
  unit: number;
  wall: number;
  now: number;
  reduced: boolean;
}

export function drawScene(
  canvas: HTMLCanvasElement,
  size: { w: number; h: number; dpr: number },
  data: PaintData,
  mem: SceneMemory,
  wall: number,
  reduced: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = size.w;
  const H = size.h;
  if (W < 2 || H < 2) return;

  const { rockets: list, t: now, world, wind, inset } = data;
  const theme = THEMES[world.id];
  const air = world.airDensity / 1.225;

  /* ---- sample every booster at this instant ---------------------------- */
  const seen = new Set<string>();
  const drawn: Drawn[] = list.map((r) => {
    const s = sampleAt(r.trail, now);
    const end = r.trail.count * r.trail.dt;
    let since = -1;
    // a flight still being written (fly-it-yourself) is never "finished"
    if (r.outcome !== "flying" && s.finished) {
      const replaySince = Math.max(0, now - end);
      const rec = mem.finished.get(r.id);
      if (!rec || rec.trail !== r.trail) {
        mem.finished.set(r.id, { trail: r.trail, wall: wall - replaySince });
        since = replaySince;
      } else {
        since = Math.max(replaySince, wall - rec.wall);
      }
    } else {
      mem.finished.delete(r.id);
    }
    seen.add(r.id);
    return {
      id: r.id,
      seed: hashString(r.id) ^ (r.trail.count * 2654435761),
      s,
      outcome: r.outcome,
      hero: Boolean(r.hero),
      since,
      tEff: since >= 0 ? end + since : now,
      trail: r.trail,
      upTo: Math.min(r.trail.count - 1, Math.floor(now / r.trail.dt)),
      impact: Math.hypot(s.vx, s.vy),
      px: 0,
      py: 0,
      w: 0,
      h: 0,
    };
  });
  for (const k of mem.finished.keys()) if (!seen.has(k)) mem.finished.delete(k);

  /* ---- a camera that rides the fleet down and closes in ---------------- */
  let minX = -PAD_RADIUS - 30;
  let maxX = PAD_RADIUS + 30;
  let maxY = 90;
  for (const d of drawn) {
    if (Math.abs(d.s.x) > 260 || d.s.y > 1000) continue;
    minX = Math.min(minX, d.s.x - 40);
    maxX = Math.max(maxX, d.s.x + 40);
    maxY = Math.max(maxY, d.s.y + BODY_LENGTH + 50);
  }
  const minY = -30;
  const bandTop = inset.top;
  const bandHeight = Math.max(80, H - inset.top - inset.bottom);
  const target: Camera = {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    scale: Math.min(W / (maxX - minX), bandHeight / (maxY - minY)),
  };
  const prev = mem.camera;
  const snap =
    !prev || now < 0.12 || target.scale / prev.scale > 3 || prev.scale / target.scale > 3;
  const cam: Camera = snap
    ? target
    : {
        cx: lerp(prev.cx, target.cx, 0.1),
        cy: lerp(prev.cy, target.cy, 0.1),
        scale: lerp(prev.scale, target.scale, 0.08),
      };
  mem.camera = cam;

  const sx = (wx: number) => W / 2 + (wx - cam.cx) * cam.scale;
  const sy = (wy: number) => bandTop + bandHeight / 2 - (wy - cam.cy) * cam.scale;
  const groundY = sy(0);
  const bodyW = Math.max(MIN_BODY_PX, BODY_RADIUS * 2 * cam.scale);
  const bodyH = Math.max(11, BODY_LENGTH * cam.scale);
  const unit = Math.max(cam.scale, bodyW / (BODY_RADIUS * 2));

  for (const d of drawn) {
    d.px = sx(d.s.x);
    d.py = sy(d.s.y);
    d.w = bodyW;
    d.h = bodyH;
  }

  const env: Env = {
    ctx,
    W,
    H,
    theme,
    world,
    wind,
    air,
    cam,
    sx,
    sy,
    groundY,
    unit,
    wall,
    now,
    reduced,
  };

  /* ---- the hero's crash shakes the camera ------------------------------ */
  const heroCrash = drawn.find((d) => d.hero && d.outcome === "crashed" && d.since >= 0);
  let shakeX = 0;
  let shakeY = 0;
  if (heroCrash && !reduced && heroCrash.since < 1.2) {
    const s = heroCrash.since;
    const amp = 7 * Math.exp(-s * 4.5) * clamp(heroCrash.impact / 25, 0.4, 1.2);
    shakeX = amp * Math.sin(s * 61);
    shakeY = amp * Math.cos(s * 47);
  }

  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawSky(env);
  drawTerrain(env);
  drawClouds(env);
  drawGrid(env, bandTop, bandHeight);
  drawGround(env);
  drawPad(env);
  drawWindsock(env);

  // scorch marks sit on the ground, under everything that flies
  for (const d of drawn) if (d.outcome === "crashed" && d.since >= 0) drawScorch(env, d);

  drawTrails(env, drawn);
  for (const d of drawn) drawExhaust(env, d);

  // fleet first, hero last, so the one that matters is never buried
  const order = [...drawn].sort((a, b) => Number(a.hero) - Number(b.hero));
  for (const d of order) {
    if (d.outcome === "crashed" && d.since >= 0) drawCrash(env, d);
    else drawRocket(env, d);
  }
  for (const d of order) if (d.since < 0) drawGroundBlast(env, d);
  for (const d of order) if (d.outcome === "landed" && d.since >= 0) drawLandedFx(env, d);

  const hero = drawn.find((d) => d.hero);
  if (hero) {
    drawIgnitionMarks(env, hero);
    if (data.guide && hero.since < 0) drawGuide(env, hero);
    if (data.tag) drawTag(env, hero, data.tag);
  }

  ctx.restore();

  // instruments do not shake
  if (hero && hero.since < 0) drawAltitudePointer(env, hero, bandTop);
  drawWind(env, bandTop, bandHeight);
  drawVignette(env);

  if (heroCrash && !reduced && heroCrash.since < 0.14) {
    ctx.globalAlpha = 0.28 * (1 - heroCrash.since / 0.14);
    ctx.fillStyle = "#fff6e0";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

/* -------------------------------------------------------------------------- */
/* environment                                                                */
/* -------------------------------------------------------------------------- */

/** Fixed star field — infinitely distant, so it does not pan with the camera. */
const STARS = (() => {
  const r = rng(90210);
  return Array.from({ length: 220 }, () => ({
    fx: r(),
    fy: r() * 0.85,
    r: 0.35 + Math.pow(r(), 3) * 1.4,
    a: 0.25 + r() * 0.7,
    warm: r() < 0.15,
  }));
})();

function drawSky(e: Env) {
  const { ctx, W, H, theme, groundY } = e;
  const top = Math.max(groundY, 1);
  const sky = ctx.createLinearGradient(0, 0, 0, top);
  for (const [stop, color] of theme.sky) sky.addColorStop(stop, color);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, W + 40, Math.max(groundY, 0) + 20);

  if (theme.stars) {
    // no atmosphere, so they do not twinkle — they just sit there
    for (const s of STARS) {
      const py = s.fy * H;
      if (py > groundY - 4) continue;
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.warm ? "#ffe9c7" : "#ffffff";
      ctx.beginPath();
      ctx.arc(s.fx * W, py, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // the sun
  const sun = theme.sun;
  const ux = W * sun.fx;
  const uy = H * sun.fy;
  if (uy < groundY) {
    ctx.globalCompositeOperation = theme.dark ? "lighter" : "source-over";
    blot(ctx, sprite(sun.glow), ux, uy, sun.r * sun.halo, theme.dark ? 0.35 : 0.75);
    blot(ctx, sprite(sun.glow), ux, uy, sun.r * 2.2, 0.9);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = sun.core;
    ctx.beginPath();
    ctx.arc(ux, uy, sun.r * 0.62, 0, TAU);
    ctx.fill();
  }

  if (theme.companion === "earth") drawEarthInSky(e);
  if (theme.companion === "phobos") {
    const px = W * 0.78;
    const py = H * 0.2;
    if (py < groundY) {
      ctx.fillStyle = "rgba(92,74,62,0.75)";
      ctx.beginPath();
      ctx.ellipse(px, py, 4.2, 3.1, -0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(220,190,160,0.35)";
      ctx.beginPath();
      ctx.ellipse(px - 1.2, py - 0.8, 2.2, 1.5, -0.4, 0, TAU);
      ctx.fill();
    }
  }
}

function drawEarthInSky(e: Env) {
  const { ctx, W, H, groundY } = e;
  const cx = W * 0.84;
  const cy = H * 0.17;
  if (cy > groundY) return;
  const rad = Math.max(13, Math.min(28, H * 0.058));
  ctx.globalCompositeOperation = "lighter";
  blot(ctx, sprite("90,150,230"), cx, cy, rad * 2.1, 0.45);
  ctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, TAU);
  ctx.clip();
  const ocean = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
  ocean.addColorStop(0, "#5fa8ec");
  ocean.addColorStop(0.6, "#1f5fa8");
  ocean.addColorStop(1, "#0d2f5c");
  ctx.fillStyle = ocean;
  ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  // continents and weather
  ctx.fillStyle = "rgba(120,150,90,0.75)";
  ctx.beginPath();
  ctx.ellipse(cx - rad * 0.25, cy - rad * 0.1, rad * 0.32, rad * 0.5, 0.5, 0, TAU);
  ctx.ellipse(cx + rad * 0.35, cy + rad * 0.35, rad * 0.25, rad * 0.18, -0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, rad * 0.09);
  ctx.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    const yy = cy - rad * 0.65 + k * rad * 0.42;
    ctx.moveTo(cx - rad * 0.8, yy);
    ctx.quadraticCurveTo(cx, yy - rad * 0.22, cx + rad * 0.7, yy + rad * 0.08);
    ctx.stroke();
  }
  // the night side
  const night = ctx.createLinearGradient(cx - rad, cy, cx + rad, cy);
  night.addColorStop(0, "rgba(0,0,0,0)");
  night.addColorStop(0.55, "rgba(0,0,0,0.15)");
  night.addColorStop(0.8, "rgba(0,0,0,0.75)");
  night.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = night;
  ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  ctx.restore();

  ctx.strokeStyle = "rgba(160,210,255,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, rad + 0.5, Math.PI * 0.55, Math.PI * 1.6);
  ctx.stroke();

  ctx.fillStyle = "rgba(226,232,242,0.5)";
  ctx.font = `700 8px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("EARTH", cx, cy + rad + 12);
}

function ridgeHeight(kind: Theme["ridge"], u: number, seed: number) {
  const a = Math.sin(u * 0.0042 + seed);
  const b = Math.sin(u * 0.0113 + seed * 2.3);
  const c = Math.sin(u * 0.031 + seed * 5.1);
  const raw = 0.55 + 0.25 * a + 0.14 * b + 0.06 * c;
  if (kind === "mesa") {
    // flat tops, steep sides
    const k = clamp((raw - 0.45) * 3.2, 0, 1);
    return 0.22 + 0.7 * smooth(smooth(k));
  }
  if (kind === "trees") {
    const crown = Math.abs(Math.sin(u * 0.09 + seed)) * 0.18 + Math.abs(Math.sin(u * 0.23)) * 0.1;
    return 0.35 + 0.25 * a + crown;
  }
  return 0.4 + 0.3 * a + 0.12 * b; // rolling
}

function drawRidge(
  e: Env,
  height: number,
  offset: number,
  seed: number,
  color: string,
  kind: Theme["ridge"],
) {
  const { ctx, W, groundY } = e;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, groundY + 1);
  for (let x = -20; x <= W + 26; x += 6) {
    ctx.lineTo(x, groundY - height * ridgeHeight(kind, x + offset, seed));
  }
  ctx.lineTo(W + 26, groundY + 1);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(e: Env) {
  const { ctx, W, H, theme, cam, groundY } = e;
  if (groundY < 0) return;
  const pan = cam.cx * cam.scale;
  const farH = Math.min(H * 0.12, 74);
  const midH = Math.min(H * 0.065, 40);

  drawRidge(e, farH, pan * 0.04 + 1400, 1.7, theme.far, theme.ridge);

  // haze that settles into the far distance
  if (!theme.dark) {
    const haze = ctx.createLinearGradient(0, groundY - farH * 1.6, 0, groundY);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(1, theme.haze);
    ctx.fillStyle = haze;
    ctx.fillRect(-20, groundY - farH * 1.6, W + 40, farH * 1.6);
  }

  drawRidge(
    e,
    midH,
    pan * 0.14 + 300,
    4.2,
    theme.mid,
    theme.ridge === "trees" ? "trees" : theme.ridge === "mesa" ? "rolling" : "rolling",
  );
}

/** Cloud banks hang in world space, so the booster falls past them. */
const CLOUDS = (() => {
  const r = rng(777);
  return Array.from({ length: 11 }, () => ({
    x: -900 + r() * 1800,
    y: 230 + r() * 900,
    w: 70 + r() * 170,
    puffs: Array.from({ length: 9 }, (_, i) => ({
      // a long flat bank: puffs spread along x, bigger in the middle
      dx: (i / 8 - 0.5) * 0.9 + (r() - 0.5) * 0.12,
      dy: (r() - 0.5) * 0.5,
      s: (0.65 + r() * 0.4) * (1 - Math.abs(i / 8 - 0.5) * 0.7),
    })),
  }));
})();

function drawClouds(e: Env) {
  const { ctx, theme, sx, sy, cam, wall, wind, H, W } = e;
  if (!theme.clouds) return;
  const white = sprite("255,255,255");
  const shade = sprite("190,206,222");
  const drift = (e.reduced ? 0 : wall) * (1.2 + wind * 0.4);
  for (const c of CLOUDS) {
    const wx = ((((c.x + drift + 900) % 1800) + 1800) % 1800) - 900;
    const cx = sx(wx);
    const cy = sy(c.y);
    const w = c.w * cam.scale;
    if (cx + w < -40 || cx - w > W + 40 || cy < -w || cy > H + w) continue;
    for (const p of c.puffs) {
      blot(ctx, shade, cx + p.dx * w, cy + p.dy * w * 0.12 + w * 0.07, w * 0.42 * p.s, 0.3);
    }
    for (const p of c.puffs) {
      blot(ctx, white, cx + p.dx * w, cy + p.dy * w * 0.12, w * 0.4 * p.s, 0.42);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGrid(e: Env, bandTop: number, bandHeight: number) {
  const { ctx, W, theme, cam, sy, groundY } = e;
  const steps = [10, 25, 50, 100, 200, 500];
  const step = steps.find((v) => v * cam.scale > 34) ?? 500;
  const topAltitude = cam.cy + bandHeight / 2 / cam.scale;
  ctx.font = `600 10px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  for (let a = step; a <= topAltitude; a += step) {
    const py = sy(a);
    if (py < bandTop - 4 || py > groundY - 6) continue;
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(54, py);
    ctx.lineTo(W - 8, py);
    ctx.stroke();
    ctx.fillStyle = theme.gridText;
    ctx.textAlign = "right";
    ctx.fillText(`${a} m`, 46, py);
  }
  ctx.setLineDash([]);
  // minor ticks along the left edge, like the ruler on a webcast
  ctx.strokeStyle = theme.gridText;
  ctx.globalAlpha = 0.5;
  for (let a = step / 5; a <= topAltitude; a += step / 5) {
    const py = sy(a);
    if (py < bandTop || py > groundY) continue;
    ctx.beginPath();
    ctx.moveTo(49, py);
    ctx.lineTo(53, py);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Bits of ground clutter, scattered once in world space so they pan with the camera. */
const CLUTTER = (() => {
  const r = rng(31337);
  return Array.from({ length: 70 }, () => ({
    x: -700 + r() * 1400,
    depth: Math.pow(r(), 1.4),
    size: 0.6 + r() * 1.6,
    tone: r(),
  }));
})();

function drawGround(e: Env) {
  const { ctx, W, H, theme, groundY, sx, cam } = e;
  if (groundY >= H) return;
  const depth = H - groundY;
  const g = ctx.createLinearGradient(0, groundY, 0, H);
  g.addColorStop(0, theme.groundTop);
  g.addColorStop(1, theme.groundBottom);
  ctx.fillStyle = g;
  ctx.fillRect(-20, groundY, W + 40, depth + 20);

  // receding furrows
  ctx.strokeStyle = theme.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 7; k++) {
    const yy = groundY + depth * Math.pow(k / 7, 1.7);
    ctx.beginPath();
    ctx.moveTo(-20, yy);
    ctx.lineTo(W + 20, yy);
    ctx.stroke();
  }

  for (const c of CLUTTER) {
    const px = sx(c.x);
    if (px < -40 || px > W + 40) continue;
    const yy = groundY + 3 + c.depth * Math.max(0, depth - 6);
    const near = 0.5 + c.depth;
    const s = Math.max(1, c.size * near * Math.min(6, cam.scale * 2.4));
    if (Math.abs(c.x) < PAD_RADIUS + 6 && c.depth < 0.25) continue;
    if (theme.clutter === "craters") {
      ctx.fillStyle = "rgba(40,38,34,0.35)";
      ctx.beginPath();
      ctx.ellipse(px, yy, s * 2.4, s * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(240,238,230,0.3)";
      ctx.beginPath();
      ctx.ellipse(px, yy + s * 0.08, s * 2.4, s * 0.55, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else if (theme.clutter === "rocks") {
      ctx.fillStyle = c.tone < 0.5 ? "rgba(70,28,12,0.7)" : "rgba(96,42,20,0.7)";
      ctx.beginPath();
      ctx.ellipse(px, yy, s * 1.4, s * 0.8, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(230,170,120,0.25)";
      ctx.beginPath();
      ctx.ellipse(px - s * 0.3, yy - s * 0.35, s * 0.6, s * 0.25, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = c.tone < 0.5 ? "rgba(74,90,52,0.55)" : "rgba(98,110,62,0.5)";
      ctx.beginPath();
      ctx.ellipse(px, yy, s * 1.6, s * 0.7, 0, Math.PI, TAU);
      ctx.fill();
    }
  }

  ctx.strokeStyle = theme.horizon;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-20, groundY);
  ctx.lineTo(W + 20, groundY);
  ctx.stroke();
}

function drawPad(e: Env) {
  const { ctx, H, theme, sx, groundY, cam, wall, reduced } = e;
  const cx = sx(0);
  const rx = PAD_RADIUS * cam.scale;
  // looking at it from a few degrees above the horizon
  const ry = Math.max(2.5, rx * 0.085);
  const thick = Math.max(2.5, 1.6 * cam.scale);

  // the slab
  ctx.fillStyle = theme.padFill;
  ctx.beginPath();
  ctx.ellipse(cx, groundY + thick, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, groundY);
  ctx.ellipse(cx, groundY, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  const top = ctx.createLinearGradient(0, groundY - ry, 0, groundY + ry);
  top.addColorStop(0, theme.padTop);
  top.addColorStop(1, theme.padFill);
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = theme.padStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  // painted target: outer ring and a cross
  if (rx > 30) {
    ctx.strokeStyle = theme.dark ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1, cam.scale * 0.8);
    ctx.beginPath();
    ctx.ellipse(cx, groundY, rx * 0.8, ry * 0.8, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.32, groundY);
    ctx.lineTo(cx + rx * 0.32, groundY);
    ctx.moveTo(cx, groundY - ry * 0.32);
    ctx.lineTo(cx, groundY + ry * 0.32);
    ctx.stroke();
  }

  // the tolerance the booster actually has to hit, painted on the deck
  const tol = LANDING.padRadius * cam.scale;
  ctx.strokeStyle = "rgba(234,88,12,0.75)";
  ctx.lineWidth = Math.max(1.2, cam.scale * 0.5);
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.ellipse(cx, groundY, tol, ry * (tol / rx), 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  // posts at the edge of the tolerance
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  const postH = Math.max(7, 6 * cam.scale);
  for (const m of [-LANDING.padRadius, LANDING.padRadius]) {
    const px = sx(m);
    ctx.beginPath();
    ctx.moveTo(px, groundY - postH);
    ctx.lineTo(px, groundY);
    ctx.stroke();
    const on = reduced || Math.sin(wall * 4 + m) > -0.2;
    if (on) {
      ctx.globalCompositeOperation = theme.dark ? "lighter" : "source-over";
      blot(ctx, sprite("255,140,60"), px, groundY - postH, 5, 0.85);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // edge lights round the front rim
  if (rx > 60) {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.08 + (k / 8) * 0.84);
      const lx = cx + Math.cos(a) * rx;
      const ly = groundY + Math.sin(a) * ry;
      const lit = reduced ? 0.7 : 0.45 + 0.45 * Math.sin(wall * 3 - k * 0.7);
      ctx.fillStyle = `rgba(255,214,140,${lit.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.4, 0, TAU);
      ctx.fill();
    }
  }

  if (rx * 2 > 90) {
    ctx.fillStyle = theme.padText;
    ctx.font = `700 9px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(theme.padName, cx, Math.min(H - 8, groundY + ry + thick + 10));
  }
}

/** A windsock beside the pad: the wind slider has something physical to push on. */
function drawWindsock(e: Env) {
  const { ctx, sx, groundY, cam, wind, air, wall, reduced, theme } = e;
  if (air <= 0) return;
  const base = sx(PAD_RADIUS + 22);
  const pole = Math.max(14, 9 * cam.scale);
  const top = groundY - pole;
  ctx.strokeStyle = theme.dark ? "#cbd5e1" : "#4b5563";
  ctx.lineWidth = Math.max(1, cam.scale * 0.25);
  ctx.beginPath();
  ctx.moveTo(base, groundY);
  ctx.lineTo(base, top);
  ctx.stroke();

  const strength = clamp(Math.abs(wind) / 10, 0, 1) * Math.min(1, air * 2);
  const dir = wind === 0 ? 1 : Math.sign(wind);
  const len = Math.max(9, 5 * cam.scale);
  const droop = (1 - strength) * 1.25; // radians below horizontal
  const flutter = reduced ? 0 : Math.sin(wall * 9) * 0.06 * strength;
  const a = droop + flutter;
  const segs = 4;
  for (let k = 0; k < segs; k++) {
    const k0 = k / segs;
    const k1 = (k + 1) / segs;
    const w0 = len * 0.28 * (1 - k0 * 0.5);
    const w1 = len * 0.28 * (1 - k1 * 0.5);
    const x0 = base + dir * Math.cos(a) * len * k0;
    const y0 = top + Math.sin(a) * len * k0;
    const x1 = base + dir * Math.cos(a) * len * k1;
    const y1 = top + Math.sin(a) * len * k1;
    const nx = -Math.sin(a) * dir;
    const ny = Math.cos(a);
    ctx.fillStyle = k % 2 === 0 ? "#f97316" : "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(x0 - (nx * w0) / 2, y0 - (ny * w0) / 2);
    ctx.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
    ctx.lineTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
    ctx.lineTo(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2);
    ctx.closePath();
    ctx.fill();
  }
}

/* -------------------------------------------------------------------------- */
/* flight paths                                                               */
/* -------------------------------------------------------------------------- */

function drawTrails(e: Env, drawn: Drawn[]) {
  const { ctx, sx, sy, theme } = e;
  const S = TRAIL_STRIDE;
  for (const d of drawn) {
    if (d.upTo < 1) continue;
    const data = d.trail.data;
    if (!d.hero) {
      ctx.beginPath();
      for (let k = 0; k <= d.upTo; k += 4) {
        const o = k * S;
        if (k === 0) ctx.moveTo(sx(data[o]), sy(data[o + 1]));
        else ctx.lineTo(sx(data[o]), sy(data[o + 1]));
      }
      ctx.lineTo(d.px, d.py);
      if (d.outcome === "landed") {
        ctx.strokeStyle = "rgba(34,197,94,0.55)";
        ctx.lineWidth = 1.3;
      } else {
        ctx.strokeStyle = theme.dark ? "rgba(190,205,230,0.2)" : "rgba(40,60,86,0.22)";
        ctx.lineWidth = 1;
      }
      ctx.stroke();
      continue;
    }

    // The hero's path is split by what the engine was doing: a dashed line while
    // it coasts, a hot solid line while it burns. The hoverslam is the moment
    // the line changes.
    let k = 0;
    while (k < d.upTo) {
      const burning = data[k * S + 3] > 0;
      let j = k;
      while (j < d.upTo && data[j * S + 3] > 0 === burning) j++;
      ctx.beginPath();
      for (let q = k; q <= j; q += q === j ? 1 : Math.min(2, j - q)) {
        const o = q * S;
        if (q === k) ctx.moveTo(sx(data[o]), sy(data[o + 1]));
        else ctx.lineTo(sx(data[o]), sy(data[o + 1]));
      }
      if (j >= d.upTo) ctx.lineTo(d.px, d.py);
      if (burning) {
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,170,90,0.35)";
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = "rgba(234,88,12,0.95)";
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = theme.dark ? "rgba(253,186,116,0.7)" : "rgba(194,65,12,0.7)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      k = j;
    }
  }
}

function drawIgnitionMarks(e: Env, d: Drawn) {
  const { ctx, sx, sy, theme } = e;
  const S = TRAIL_STRIDE;
  const data = d.trail.data;
  let last = -1;
  for (let k = 1; k <= d.upTo; k++) {
    if (data[k * S + 3] > 0 && data[(k - 1) * S + 3] === 0) {
      const px = sx(data[(k - 1) * S]);
      const py = sy(data[(k - 1) * S + 1]);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px + 5, py);
      ctx.lineTo(px, py + 5);
      ctx.lineTo(px - 5, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      last = k - 1;
    }
  }
  if (last < 0) return;
  const lx = sx(data[last * S]);
  const ly = sy(data[last * S + 1]);
  const text = `IGNITION ${Math.round(data[last * S + 1])} m`;
  ctx.font = `700 9.5px ${MONO}`;
  const tw = ctx.measureText(text).width;
  const side = lx > e.W - tw - 40 ? -1 : 1;
  const bx = side > 0 ? lx + 10 : lx - 10 - tw - 10;
  ctx.fillStyle = theme.dark ? "rgba(12,17,26,0.82)" : "rgba(255,255,255,0.88)";
  roundedRect(ctx, bx, ly - 8, tw + 10, 16, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(234,88,12,0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = theme.dark ? "#fdba74" : "#9a3412";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + 5, ly + 0.5);
}

/* -------------------------------------------------------------------------- */
/* exhaust                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Smoke left behind by the burn — each puff is born at a recorded step where
 * the engine was lit, then ages, expands and drifts with the wind. There is no
 * smoke at all on the Moon: the exhaust just leaves.
 */
function drawExhaust(e: Env, d: Drawn) {
  const { ctx, sx, sy, theme, air, wind, unit } = e;
  if (air <= 0) return;
  const S = TRAIL_STRIDE;
  const data = d.trail.data;
  const maxAge = d.hero ? 3.2 : 1.8;
  const stride = d.hero ? 3 : 7;
  const dt = d.trail.dt;
  const from = Math.max(0, d.upTo - Math.ceil(maxAge / dt));
  const img = sprite(theme.exhaust);
  const thin = Math.min(1, 0.35 + air);
  for (let j = d.upTo - (d.upTo % stride); j >= from; j -= stride) {
    const o = j * S;
    const thr = data[o + 3];
    if (thr <= 0) continue;
    const age = d.tEff - j * dt;
    if (age < 0.05 || age > maxAge) continue;
    const ang = data[o + 2];
    // exhaust leaves the nozzle fast and is braked hard by the air
    const travel = 26 * (1 - Math.exp(-age * 2.2));
    let wx = data[o] - Math.sin(ang) * travel + wind * age * 0.6;
    let wy = data[o + 1] - Math.cos(ang) * travel;
    // keyed to the step, not the loop, so a puff keeps its jitter as it ages
    const jitter = ((((j * 2654435761) ^ d.seed) >>> 0) / 4294967296 - 0.5) * 4;
    if (wy < 0.5) {
      // it hit the ground: spread sideways instead
      wx += (wx >= data[o] ? 1 : -1) * -wy * 0.9 + jitter;
      wy = 0.5 + age * 1.5;
    }
    const rad = (2.5 + age * 6.5) * unit * thr;
    // a whole fleet's smoke piles up into a white wall, so the crowd is kept thin
    const alpha = 0.32 * thin * (1 - age / maxAge) * (d.hero ? 1 : 0.22);
    blot(ctx, img, sx(wx + jitter), sy(wy), rad, alpha);
  }
  ctx.globalAlpha = 1;
}

/** When the plume reaches the ground it throws dust and lights the deck. */
function drawGroundBlast(e: Env, d: Drawn) {
  const { ctx, groundY, theme, unit, now, air } = e;
  const thr = d.s.throttle;
  if (thr <= 0) return;
  const reach = BODY_LENGTH * (0.35 + 0.95 * thr) * (air > 0.5 ? 1 : 1.5);
  const k = clamp(1 - d.s.y / reach, 0, 1) * thr;
  if (k <= 0.01) return;

  // light pooled on the deck: flattened, because it is lying on the ground
  // rather than hanging in the air, and kept to a few body-widths across
  ctx.globalCompositeOperation = "lighter";
  ctx.save();
  ctx.translate(d.px, groundY);
  ctx.scale(1, 0.28);
  blot(
    ctx,
    sprite("255,150,60"),
    0,
    0,
    Math.min((16 + 30 * k) * unit, d.w * 7),
    // additive light from forty boosters stacks into a white-out; only the
    // hero gets the full glow
    0.5 * k * (d.hero ? 1 : 0.22),
  );
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";

  const img = sprite(theme.dust);
  const n = d.hero ? 14 : 6;
  for (let q = 0; q < n; q++) {
    const side = q % 2 === 0 ? 1 : -1;
    const phase = (now * 1.3 + q / n) % 1;
    const dist = (4 + phase * 46) * k * unit;
    const rad = (3 + phase * 12) * k * unit;
    const lift = phase * 6 * unit * (air > 0 ? 1 : 0.3);
    blot(
      ctx,
      img,
      d.px + side * dist,
      groundY - rad * 0.4 - lift,
      rad,
      0.5 * (1 - phase) * k * (d.hero ? 1 : 0.3),
    );
  }
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------------------- */
/* the booster                                                                */
/* -------------------------------------------------------------------------- */

function drawRocket(e: Env, d: Drawn) {
  const { ctx, wall, reduced } = e;
  const landed = d.outcome === "landed" && d.since >= 0;
  const legs = landed ? 1 : smooth((LEGS_START - d.s.y) / (LEGS_START - LEGS_DONE));
  const lod = d.w >= 12 ? 2 : d.w >= 6.5 ? 1 : 0;

  if (d.s.throttle > 0 && d.since < 0) {
    const flick = reduced ? 0 : Math.sin(wall * 47 + d.seed) * 0.05 + Math.sin(wall * 83) * 0.04;
    ctx.save();
    // the flame stops at the ground — it splashes sideways as dust, which
    // drawGroundBlast takes care of — rather than burning on through the earth
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, e.groundY + 1e4);
    ctx.clip();
    ctx.translate(d.px, d.py);
    ctx.rotate(d.s.angle + d.s.gimbal);
    drawPlume(e, d, flick, litFor(d.trail, d.s.i));
    ctx.restore();
  }

  ctx.save();
  ctx.translate(d.px, d.py);
  // the world angle is a tilt from vertical toward +x, which on screen is a
  // clockwise rotation; the body is then drawn upward from its base
  ctx.rotate(d.s.angle);

  drawBooster(ctx, d.w, d.h, {
    legs,
    lod,
    alpha: d.hero || landed ? 1 : 0.86,
    glow: d.hero ? "rgba(234,88,12,0.9)" : landed ? "rgba(34,197,94,0.85)" : null,
    // a landed booster turns solid green, so survivors read at a glance
    stripe: d.hero && !landed ? ACCENT : null,
    green: landed,
    dark: e.theme.dark,
  });

  // nozzle still glowing after shutdown
  if (landed && d.since < 4) {
    ctx.globalCompositeOperation = "lighter";
    blot(ctx, sprite("255,120,40"), 0, -d.h * 0.01, d.w * 0.9, 0.7 * (1 - d.since / 4));
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

interface BoosterLook {
  legs: number;
  lod: 0 | 1 | 2;
  alpha: number;
  glow: string | null;
  stripe: string | null;
  /** paint the whole booster green: it landed */
  green: boolean;
  dark: boolean;
}

/**
 * A Falcon-style first stage, drawn from its base at the origin up to -h.
 * White tank, sooted from the bottom up by its own re-entry burn, black
 * interstage on top, four grid fins, four legs hinged near the base.
 */
function drawBooster(ctx: CanvasRenderingContext2D, w: number, h: number, look: BoosterLook) {
  const hw = w / 2;
  ctx.globalAlpha = look.alpha;

  // grid fins sit behind the body
  const finY = -h * 0.855;
  const finW = Math.max(1.6, w * 0.62);
  const finH = Math.max(1.6, h * 0.055);
  ctx.fillStyle = "#30353d";
  for (const side of [-1, 1]) {
    const fx = side > 0 ? hw - 0.5 : -hw - finW + 0.5;
    ctx.fillRect(fx, finY, finW, finH);
    if (look.lod === 2) {
      ctx.strokeStyle = "rgba(160,170,182,0.55)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let k = 1; k < 4; k++) {
        ctx.moveTo(fx + (finW * k) / 4, finY);
        ctx.lineTo(fx + (finW * k) / 4, finY + finH);
      }
      ctx.moveTo(fx, finY + finH / 2);
      ctx.lineTo(fx + finW, finY + finH / 2);
      ctx.stroke();
    }
  }

  // the tank
  if (look.glow) {
    ctx.shadowColor = look.glow;
    ctx.shadowBlur = look.lod === 0 ? 6 : 12;
  }
  const shade = ctx.createLinearGradient(-hw, 0, hw, 0);
  if (look.green) {
    shade.addColorStop(0, "#16a34a");
    shade.addColorStop(0.28, "#86efac");
    shade.addColorStop(0.62, "#22c55e");
    shade.addColorStop(1, "#14532d");
  } else {
    shade.addColorStop(0, "#c5cbd3");
    shade.addColorStop(0.28, "#ffffff");
    shade.addColorStop(0.62, "#e2e6ec");
    shade.addColorStop(1, "#8a939f");
  }
  ctx.fillStyle = shade;
  roundedRect(ctx, -hw, -h, w, h, Math.min(w * 0.3, 3));
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  ctx.save();
  roundedRect(ctx, -hw, -h, w, h, Math.min(w * 0.3, 3));
  ctx.clip();

  // soot, heaviest at the engine end — a green (landed) booster stays clean
  if (!look.green) {
    const soot = ctx.createLinearGradient(0, 0, 0, -h * 0.66);
    soot.addColorStop(0, "rgba(28,22,18,0.92)");
    soot.addColorStop(0.3, "rgba(46,38,32,0.6)");
    soot.addColorStop(0.75, "rgba(70,58,48,0.18)");
    soot.addColorStop(1, "rgba(70,58,48,0)");
    ctx.fillStyle = soot;
    ctx.fillRect(-hw, -h * 0.66, w, h * 0.66);
    if (look.lod === 2) {
      ctx.strokeStyle = "rgba(40,32,26,0.35)";
      ctx.lineWidth = Math.max(0.6, w * 0.05);
      for (let k = 0; k < 5; k++) {
        const x = -hw + (w * (k + 0.5)) / 5;
        const top = -h * (0.42 + ((k * 37) % 23) / 100);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + w * 0.04, top);
        ctx.stroke();
      }
    }
  }

  // black interstage
  const inter = ctx.createLinearGradient(-hw, 0, hw, 0);
  inter.addColorStop(0, look.green ? "#14532d" : "#22262c");
  inter.addColorStop(0.3, look.green ? "#166534" : "#3c424b");
  inter.addColorStop(1, look.green ? "#052e16" : "#111418");
  ctx.fillStyle = inter;
  ctx.fillRect(-hw, -h, w, h * 0.135);

  // the hero's stripe, so it reads at a glance among forty white boosters
  if (look.stripe) {
    ctx.fillStyle = look.stripe;
    ctx.fillRect(-hw, -h * 0.84, w, Math.max(1.5, h * 0.035));
  }

  // octaweb and engine section
  ctx.fillStyle = "#16191d";
  ctx.fillRect(-hw, -h * 0.04, w, h * 0.04);
  ctx.restore();

  if (look.lod >= 1) {
    // panel seam
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-hw, -h * 0.55);
    ctx.lineTo(hw, -h * 0.55);
    ctx.stroke();
  }

  // the nozzle peeking out of the octaweb
  const nz = w * 0.5;
  ctx.fillStyle = "#2a2e35";
  ctx.beginPath();
  ctx.moveTo(-nz * 0.45, -h * 0.03);
  ctx.lineTo(nz * 0.45, -h * 0.03);
  ctx.lineTo(nz * 0.62, 0);
  ctx.lineTo(-nz * 0.62, 0);
  ctx.closePath();
  ctx.fill();

  drawLegs(ctx, w, h, look);
  ctx.globalAlpha = 1;
}

/**
 * Hinged near the base and stowed pointing up along the tank, the legs swing
 * down and out through 120°, which puts the feet level with the engine.
 */
function drawLegs(ctx: CanvasRenderingContext2D, w: number, h: number, look: BoosterLook) {
  const hw = w / 2;
  const L = h * 0.2;
  const hingeY = -h * 0.1;
  const phi = look.legs * ((120 * Math.PI) / 180);
  const lw = Math.max(1.1, w * 0.2);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    const hx = side * (hw - lw * 0.3);
    const tx = hx + side * L * Math.sin(phi);
    const ty = hingeY - L * Math.cos(phi);
    // pusher strut, from the tank to two-thirds down the leg
    if (look.legs > 0.05 && look.lod > 0) {
      ctx.strokeStyle = "#5b616b";
      ctx.lineWidth = Math.max(0.7, lw * 0.45);
      ctx.beginPath();
      ctx.moveTo(side * hw * 0.9, -h * 0.27);
      ctx.lineTo(lerp(hx, tx, 0.62), lerp(hingeY, ty, 0.62));
      ctx.stroke();
    }
    ctx.strokeStyle = "#1c1f24";
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(hx, hingeY);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    if (look.legs > 0.85) {
      ctx.fillStyle = "#1c1f24";
      ctx.beginPath();
      ctx.ellipse(tx, ty, lw * 1.1, lw * 0.45, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.lineCap = "butt";
  void look.dark;
}

/**
 * The plume, in the booster's frame with the gimbal applied: it points down
 * the +y axis from the nozzle. Its shape follows the air. At sea level the
 * ambient pressure squeezes it into a tight column with Mach diamonds; in thin
 * Martian air it starts to bloom; in vacuum it balloons out and goes faint.
 */
function drawPlume(e: Env, d: Drawn, flick: number, lit: number) {
  const { ctx, air, theme } = e;
  const w = d.w;
  const thr = d.s.throttle;
  const vacuum = air <= 0;
  const len = d.h * (0.32 + 0.9 * thr) * (vacuum ? 0.85 : 1) * (1 + flick);
  const fan = air > 0.5 ? 1.05 : air > 0 ? 1.8 : 3.1;
  const nozzle = w * 0.3;

  ctx.globalCompositeOperation = "lighter";
  blot(
    ctx,
    sprite(vacuum ? "150,180,255" : "255,140,50"),
    0,
    len * 0.3,
    len * (vacuum ? 0.9 : 0.7),
    (vacuum ? 0.28 : 0.42) * thr * (d.hero ? 1 : 0.4),
  );

  // outer flame
  if (!theme.dark && !vacuum) ctx.globalCompositeOperation = "source-over";
  const outer = ctx.createLinearGradient(0, 0, 0, len);
  if (vacuum) {
    outer.addColorStop(0, "rgba(235,240,255,0.85)");
    outer.addColorStop(0.3, "rgba(170,190,255,0.4)");
    outer.addColorStop(1, "rgba(110,130,255,0)");
  } else {
    outer.addColorStop(0, "rgba(255,244,214,0.98)");
    outer.addColorStop(0.22, "rgba(255,190,80,0.92)");
    outer.addColorStop(0.6, "rgba(244,100,30,0.55)");
    outer.addColorStop(1, "rgba(200,40,20,0)");
  }
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(-nozzle, 0);
  ctx.bezierCurveTo(-nozzle * fan * 1.25, len * 0.3, -nozzle * fan * 0.95, len * 0.72, 0, len);
  ctx.bezierCurveTo(nozzle * fan * 0.95, len * 0.72, nozzle * fan * 1.25, len * 0.3, nozzle, 0);
  ctx.closePath();
  ctx.fill();

  // white-hot core
  ctx.globalCompositeOperation = "lighter";
  const coreLen = len * (vacuum ? 0.28 : 0.48);
  const core = ctx.createLinearGradient(0, 0, 0, coreLen);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(0.5, "rgba(255,240,200,0.6)");
  core.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(-nozzle * 0.7, 0);
  ctx.quadraticCurveTo(-nozzle * 0.55, coreLen * 0.6, 0, coreLen);
  ctx.quadraticCurveTo(nozzle * 0.55, coreLen * 0.6, nozzle * 0.7, 0);
  ctx.closePath();
  ctx.fill();

  // Mach diamonds, only where there is air pressure to make them
  if (air > 0.5 && w >= 6) {
    const gap = Math.max(4, w * 0.95);
    for (let k = 1; k <= 4; k++) {
      const cy = gap * k * (1 + flick);
      if (cy > len * 0.8) break;
      const sz = nozzle * 0.55 * (1 - k * 0.16);
      ctx.fillStyle = `rgba(255,255,235,${(0.75 * (1 - k * 0.2) * thr).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, cy - sz * 1.3);
      ctx.lineTo(sz, cy);
      ctx.lineTo(0, cy + sz * 1.3);
      ctx.lineTo(-sz, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // every engine start: the green flash of TEA-TEB meeting oxygen
  if (lit < 0.3) {
    const k = 1 - lit / 0.3;
    blot(ctx, sprite("90,255,140"), 0, len * 0.15, Math.max(10, len * 0.7), 0.9 * k);
    blot(ctx, sprite("200,255,210"), 0, 0, Math.max(5, w * 1.4), k);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------------------- */
/* aftermath                                                                  */
/* -------------------------------------------------------------------------- */

function crashSize(e: Env, d: Drawn) {
  const fuelK = 0.5 + 0.5 * Math.sqrt(clamp(d.s.fuel / 1800, 0, 1));
  const energy = clamp(d.impact / 40, 0.45, 1.3);
  return 16 * e.unit * fuelK * energy * (d.hero ? 1 : 0.72);
}

function drawScorch(e: Env, d: Drawn) {
  const { ctx, groundY } = e;
  if (d.s.y > 3) return;
  const R = crashSize(e, d);
  const a = Math.min(1, d.since * 3);
  ctx.fillStyle = `rgba(22,16,12,${(0.42 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(d.px, groundY + 1, R * 1.5, Math.max(1.5, R * 0.16), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(22,16,12,${(0.3 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(d.px, groundY + 1, R * 0.8, Math.max(1, R * 0.09), 0, 0, TAU);
  ctx.fill();
}

const DEBRIS_TONES = ["#eef1f4", "#c8ccd2", "#272a30", "#3d3631", "#e7e9ec", "#5a524b"];

/**
 * A booster that hits too hard comes apart in stages: a flash, a fireball
 * that rises and blackens, a ground shock, debris on ballistic arcs, a
 * toppling stub of tank, and a smoke column that leans with the wind.
 */
function drawCrash(e: Env, d: Drawn) {
  const { ctx, sx, sy, groundY, world, wind, air, unit, wall, reduced } = e;
  const s = d.since;
  const r = rng(d.seed);
  const R = crashSize(e, d);
  const airborne = d.s.y > 3;
  const cx = airborne ? d.px + Math.sin(d.s.angle) * d.h * 0.4 : d.px;
  const cy = airborne ? d.py - Math.cos(d.s.angle) * d.h * 0.4 : groundY - R * 0.15;
  const fleet = d.hero ? 1 : 0.75;
  const dir = Math.sign(d.s.angle) || Math.sign(d.s.vx) || (r() < 0.5 ? -1 : 1);
  const hasAir = air > 0;

  /* -- the stub of tank that is left, falling over ---------------------- */
  if (!airborne) {
    const frac = clamp(0.62 - d.impact / 160, 0.22, 0.6);
    const fall = Math.min(1, Math.pow(s / 0.95, 2));
    const ang = lerp(d.s.angle, dir * (Math.PI / 2 - 0.06), fall);
    ctx.save();
    ctx.translate(d.px + dir * fall * d.w * 0.5, groundY - fall * d.w * 0.45);
    ctx.rotate(ang);
    const len = d.h * frac;
    const hw = d.w / 2;
    const g = ctx.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, "#3d3a37");
    g.addColorStop(0.35, "#8e8a85");
    g.addColorStop(1, "#2a2725");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.lineTo(hw, 0);
    // a torn top edge
    ctx.lineTo(hw, -len * 0.92);
    ctx.lineTo(hw * 0.4, -len);
    ctx.lineTo(-hw * 0.1, -len * 0.88);
    ctx.lineTo(-hw * 0.6, -len * 0.97);
    ctx.lineTo(-hw, -len * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(20,16,12,0.7)";
    ctx.fillRect(-hw, -len * 0.3, d.w, len * 0.3);
    ctx.globalCompositeOperation = "lighter";
    blot(ctx, sprite("255,120,40"), 0, -len * 0.95, d.w * 1.4, 0.8 * Math.max(0, 1 - s / 5));
    // fires burning on the wreck
    if (s < 9) {
      const fade = s < 6 ? 1 : 1 - (s - 6) / 3;
      for (let k = 0; k < 3; k++) {
        const fl = reduced ? 1 : 0.75 + 0.25 * Math.sin(wall * (13 + k * 4) + k);
        blot(
          ctx,
          sprite("255,150,50"),
          (k - 1) * hw * 0.6,
          -len * (0.3 + k * 0.25),
          d.w * (0.9 + fl * 0.6) * fleet,
          0.65 * fade * fl,
        );
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* -- smoke: a leaning column where there is air, a quick settling of dust where there is not */
  const smokeN = d.hero ? 18 : 6;
  const smokeLife = hasAir ? 6 : 1.6;
  const dark = sprite(e.theme.smoke);
  const light = sprite(hasAir ? "120,114,108" : e.theme.dust);
  for (let k = 0; k < smokeN; k++) {
    const born = k * 0.13;
    const age = s - born;
    const jx = r() - 0.5;
    const jy = r();
    if (age <= 0 || age > smokeLife) continue;
    const life = age / smokeLife;
    const rise = hasAir ? (5 + jy * 4) * age * Math.min(1, 0.4 + air) : 0;
    const drift = hasAir ? wind * age * 0.7 : 0;
    const px = cx + jx * R * 1.2 + (drift + jx * age * 3) * unit;
    const py = cy - R * 0.25 - rise * unit + (hasAir ? 0 : -age * 2 * unit * (1 - life));
    const rad = R * (0.4 + age * (hasAir ? 0.3 : 0.5));
    const a = Math.min(1, age * 4) * (1 - life) * (hasAir ? 0.55 : 0.4) * fleet;
    blot(ctx, k % 2 ? dark : light, px, py, rad, a);
  }

  /* -- debris on ballistic arcs, under this world's gravity -------------- */
  const g = world.gravity;
  const debrisN = d.hero ? 24 : 9;
  for (let k = 0; k < debrisN; k++) {
    const th = Math.PI / 2 + (r() - 0.5) * 2.5 - clamp(d.s.vx * 0.02, -0.5, 0.5);
    const v = (7 + r() * 30) * (0.55 + clamp(d.impact / 40, 0.3, 1.2) * 0.5);
    const vx0 = Math.cos(th) * v + d.s.vx * 0.25;
    const vy0 = Math.sin(th) * v;
    const h0 = airborne ? d.s.y + (d.h / unit) * 0.4 : 1 + r() * 5;
    const sz = Math.max(1.3, (0.7 + r() * 2.4) * unit);
    const spin = (r() - 0.5) * 16;
    const tone = DEBRIS_TONES[Math.floor(r() * DEBRIS_TONES.length)];
    // air drag on Earth shortens the arcs a little
    const dragK = hasAir ? 1 - 0.18 * Math.min(1, air) : 1;
    const tl = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h0)) / g;
    const te = Math.min(s, tl);
    const slide = s > tl ? Math.min(1, (s - tl) * 3) * 1.5 * Math.sign(vx0) : 0;
    const wx = d.s.x + vx0 * te * dragK + slide;
    const wy = Math.max(0, h0 + vy0 * te - 0.5 * g * te * te);
    const px = sx(wx);
    const py = sy(wy);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(r() * 6 + spin * te);
    ctx.fillStyle = tone;
    ctx.globalAlpha = d.hero ? 1 : 0.85;
    ctx.fillRect(-sz / 2, -sz * 0.22, sz, sz * 0.45);
    ctx.restore();
    if (s < tl && s < 2.2) {
      ctx.globalCompositeOperation = "lighter";
      blot(ctx, sprite("255,140,50"), px, py, sz * 1.6, 0.7 * (1 - s / 2.2));
      ctx.globalCompositeOperation = "source-over";
    }
  }
  ctx.globalAlpha = 1;

  /* -- ground shock: it needs air to travel through ----------------------- */
  if (!airborne && hasAir && s < 0.6) {
    const k = s / 0.6;
    const rx = R * (0.6 + k * 6);
    ctx.strokeStyle = `rgba(255,255,255,${(0.65 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, 3 * (1 - k));
    ctx.beginPath();
    ctx.ellipse(d.px, groundY, rx, Math.max(2, rx * 0.12), 0, 0, TAU);
    ctx.stroke();
    // a dome of condensed air for an instant
    ctx.strokeStyle = `rgba(255,255,255,${(0.3 * (1 - k)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, rx * 0.7, Math.PI, TAU);
    ctx.stroke();
  }

  /* -- the fireball ------------------------------------------------------- */
  ctx.globalCompositeOperation = "lighter";
  if (s < 0.2) {
    blot(ctx, sprite("255,250,230"), cx, cy, R * (1.4 + s * 10), (1 - s / 0.2) * fleet);
  }
  const blobs = d.hero ? 9 : 5;
  for (let k = 0; k < blobs; k++) {
    const ang = r() * TAU;
    const dist = 0.15 + r() * 0.6;
    const size = 0.45 + r() * 0.55;
    const span = 0.9 + r() * 0.7;
    const life = s / span;
    if (life >= 1) continue;
    const grow = 1 - Math.pow(1 - Math.min(1, s / 0.4), 3);
    const rise = hasAir ? s * 9 * unit : 0;
    const bx = cx + Math.cos(ang) * dist * R * grow * 1.2;
    const by = cy - Math.abs(Math.sin(ang)) * dist * R * grow - rise;
    const rad = R * size * (0.4 + 0.8 * grow);
    const tone = life < 0.22 ? "255,236,190" : life < 0.5 ? "255,160,60" : "220,70,25";
    blot(ctx, sprite(tone, "hard"), bx, by, rad, (1 - life) * 0.95 * fleet);
  }
  ctx.globalCompositeOperation = "source-over";

  /* -- sparks ------------------------------------------------------------- */
  if (s < 1) {
    ctx.globalCompositeOperation = "lighter";
    const n = d.hero ? 28 : 8;
    for (let k = 0; k < n; k++) {
      const th = Math.PI / 2 + (r() - 0.5) * 3;
      const v = 30 + r() * 50;
      const life = 0.4 + r() * 0.6;
      const tint = 200 + Math.floor(r() * 55);
      if (s > life) continue;
      const brake = hasAir ? (1 - Math.exp(-s * 3)) / 3 : s;
      const wx = Math.cos(th) * v * brake;
      const wy = Math.sin(th) * v * brake - 0.5 * g * s * s;
      const px = cx + wx * unit;
      const py = cy - wy * unit;
      ctx.fillStyle = `rgba(255,${tint},120,${(1 - s / life).toFixed(3)})`;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;
}

function drawLandedFx(e: Env, d: Drawn) {
  const { ctx, groundY, theme, unit, wall, reduced, air } = e;
  const s = d.since;
  const r = rng(d.seed ^ 0x5bd1e995);

  // touchdown dust rolling outward
  if (s < 2.4) {
    const img = sprite(theme.dust);
    for (let k = 0; k < (d.hero ? 12 : 5); k++) {
      const side = k % 2 ? 1 : -1;
      const v = 6 + r() * 16;
      const dist = (v * (1 - Math.exp(-s * 1.8))) / 1.8;
      const rad = (3 + s * 6) * unit * (0.6 + r() * 0.5);
      blot(
        ctx,
        img,
        d.px + side * (d.w + dist * unit),
        groundY - rad * 0.35,
        rad,
        0.45 * (1 - s / 2.4),
      );
    }
    ctx.globalAlpha = 1;
  }

  // the liquid-oxygen tank venting: cold vapour that sinks
  if (d.hero && d.w >= 6) {
    const img = sprite("250,252,255");
    for (let k = 0; k < 6; k++) {
      const phase = reduced ? k / 6 : (wall * 0.45 + k / 6) % 1;
      const side = k % 2 ? 1 : -1;
      const ox = d.px + side * (d.w * 0.5 + phase * 9 * unit);
      const oy = d.py - d.h * 0.72 + phase * phase * (air > 0 ? 8 : 2) * unit;
      blot(ctx, img, ox, oy, (1 + phase * 3.5) * unit, 0.5 * (1 - phase) * (air > 0 ? 1 : 0.4));
    }
    ctx.globalAlpha = 1;
  }

  // a beacon ring on the deck
  const pulse = reduced ? 0.5 : (wall * 0.7 + (d.seed % 100) / 100) % 1;
  const rx = d.w * 1.4 + pulse * 26;
  ctx.strokeStyle = `rgba(34,197,94,${(0.75 * (1 - pulse)).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(d.px, groundY, rx, Math.max(2, rx * 0.16), 0, 0, TAU);
  ctx.stroke();

  // a light on top, blinking green
  const on = reduced || Math.sin(wall * 5 + d.seed) > 0.3;
  if (on && d.w >= 5) {
    ctx.globalCompositeOperation = theme.dark ? "lighter" : "source-over";
    blot(ctx, sprite("80,255,140"), d.px + Math.sin(d.s.angle) * d.h, d.py - d.h * 1.01, 6, 0.9);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

/* -------------------------------------------------------------------------- */
/* overlays                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The stopping distance — how far the booster would fall before stopping if it
 * lit the engine at full power right now. When the bracket touches the deck,
 * that is the moment. It ignores drag (which helps) and the mass burned off on
 * the way down (which also helps), so it is slightly conservative.
 */
function drawGuide(e: Env, d: Drawn) {
  const { ctx, world, sy, theme } = e;
  const v = -d.s.vy;
  if (v <= 0.5 || d.s.y <= 0.5) return;
  const mass = DRY_MASS + d.s.fuel;
  const decel = world.maxThrust / mass - world.gravity;
  if (decel <= 0) return;
  const stop = (v * v) / (2 * decel);
  const tip = d.s.y - stop;
  const margin = tip / Math.max(1, d.s.y);
  const color = tip < 0 ? "#ef4444" : margin < 0.12 ? "#f59e0b" : "#22c55e";
  const x = d.px + d.w * 2.4 + 6;
  const top = d.py;
  const bottom = sy(Math.max(0, tip));

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - 5, top);
  ctx.lineTo(x + 5, top);
  ctx.moveTo(x - 7, bottom);
  ctx.lineTo(x + 7, bottom);
  ctx.stroke();

  const label =
    tip < 0
      ? "TOO LATE — FULL BURN"
      : margin < 0.12
        ? "BURN NOW"
        : `stops in ${Math.round(stop)} m`;
  ctx.font = `700 10px ${MONO}`;
  const tw = ctx.measureText(label).width;
  const ly = (top + bottom) / 2;
  ctx.fillStyle = theme.dark ? "rgba(12,17,26,0.85)" : "rgba(255,255,255,0.9)";
  roundedRect(ctx, x + 9, ly - 9, tw + 12, 18, 5);
  ctx.fill();
  ctx.fillStyle = color === "#22c55e" ? (theme.dark ? "#86efac" : "#15803d") : color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 15, ly + 0.5);
}

function drawTag(e: Env, d: Drawn, text: string) {
  const { ctx } = e;
  if (d.outcome === "crashed" && d.since >= 0) return;
  const nx = d.px + Math.sin(d.s.angle) * d.h;
  const ny = d.py - Math.cos(d.s.angle) * d.h;
  const label = d.outcome === "landed" && d.since >= 0 ? `${text} · LANDED` : text;
  ctx.font = `800 9px ${MONO}`;
  const tw = ctx.measureText(label).width;
  const bx = nx - tw / 2 - 6;
  const by = ny - 26;
  ctx.strokeStyle = "rgba(234,88,12,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nx, ny - 4);
  ctx.lineTo(nx, by + 15);
  ctx.stroke();
  ctx.fillStyle = d.outcome === "landed" && d.since >= 0 ? "#15803d" : ACCENT;
  roundedRect(ctx, bx, by, tw + 12, 15, 7.5);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, nx, by + 8);
}

function drawAltitudePointer(e: Env, d: Drawn, bandTop: number) {
  const { ctx, theme } = e;
  const y = clamp(d.py, bandTop + 8, e.groundY);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(54, y);
  ctx.lineTo(47, y - 5);
  ctx.lineTo(47, y + 5);
  ctx.closePath();
  ctx.fill();
  const text = `${Math.max(0, d.s.y).toFixed(0)}`;
  ctx.font = `800 10px ${MONO}`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = ACCENT;
  roundedRect(ctx, 44 - tw - 8, y - 8, tw + 8, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 44 - 4, y + 0.5);
  void theme;
}

function drawWind(e: Env, bandTop: number, bandHeight: number) {
  const { ctx, W, world, wind, theme } = e;
  if (world.airDensity <= 0 || Math.abs(wind) <= 0.4) return;
  const ax = W - 86;
  const ay = bandTop + bandHeight - 16;
  const dir = Math.sign(wind);
  const len = 20 + Math.min(26, Math.abs(wind) * 2.2);
  const ink = theme.dark ? "rgba(226,232,242,0.85)" : "rgba(28,48,66,0.75)";
  ctx.fillStyle = theme.dark ? "rgba(12,17,26,0.55)" : "rgba(255,255,255,0.55)";
  roundedRect(ctx, ax - 46, ay - 22, 92, 32, 8);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax - (len / 2) * dir, ay);
  ctx.lineTo(ax + (len / 2) * dir, ay);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax + (len / 2) * dir, ay);
  ctx.lineTo(ax + (len / 2 - 7) * dir, ay - 4);
  ctx.lineTo(ax + (len / 2 - 7) * dir, ay + 4);
  ctx.closePath();
  ctx.fill();
  ctx.font = `700 9px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`WIND ${Math.abs(wind).toFixed(0)} m/s`, ax, ay - 12);
}

function drawVignette(e: Env) {
  const { ctx, W, H, theme } = e;
  const g = ctx.createRadialGradient(
    W / 2,
    H * 0.45,
    Math.min(W, H) * 0.35,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, theme.dark ? "rgba(0,0,0,0.45)" : "rgba(10,20,30,0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
