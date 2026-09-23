"use client";

import { motion } from "framer-motion";
import { LandState, PEAK_X, X_MAX, X_MIN, height } from "@/lib/landscape";

const W = 620;
const H = 260;
const PAD = 34;

function sx(x: number) {
  return PAD + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - PAD * 2);
}
function sy(h: number) {
  return H - PAD - h * (H - PAD * 2);
}

/**
 * The fitness landscape, drawn literally: height above the line is how good a
 * position is. The population appears as dots that climb it.
 */
export default function Landscape({
  state,
  accent,
}: {
  state: LandState;
  accent: string;
}) {
  const pts: string[] = [];
  for (let x = X_MIN; x <= X_MAX; x += 0.5) pts.push(`${sx(x)},${sy(height(x))}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${sx(X_MAX)},${H - PAD} L${sx(X_MIN)},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
      <defs>
        <linearGradient id="land-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      <path d={area} fill="url(#land-fill)" />
      <path d={line} fill="none" stroke={accent} strokeWidth={2} strokeOpacity={0.55} />
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="#334155"
        strokeWidth={1}
      />

      {/* the trap and the real summit */}
      <g>
        <line
          x1={sx(24)}
          y1={sy(height(24))}
          x2={sx(24)}
          y2={H - PAD}
          stroke="#8b99ab"
          strokeDasharray="3 4"
          strokeWidth={1}
        />
        <text x={sx(24)} y={sy(height(24)) - 10} fontSize="10" textAnchor="middle" fill="#8b99ab">
          the trap
        </text>
        <line
          x1={sx(PEAK_X)}
          y1={sy(height(PEAK_X))}
          x2={sx(PEAK_X)}
          y2={H - PAD}
          stroke={accent}
          strokeDasharray="3 4"
          strokeWidth={1}
        />
        <text x={sx(PEAK_X)} y={sy(height(PEAK_X)) - 10} fontSize="10" textAnchor="middle" fill={accent}>
          the real summit
        </text>
      </g>

      {/* the population */}
      {state.population.map((w, i) => (
        <motion.g
          key={w.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.01 }}
        >
          <motion.circle
            animate={{ cx: sx(w.x), cy: sy(w.fitness) }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            r={i === 0 ? 7 : 4.5}
            fill={i === 0 ? accent : "#94a3b8"}
            stroke={i === 0 ? "#fff" : "none"}
            strokeWidth={i === 0 ? 2 : 0}
          />
        </motion.g>
      ))}

      <text x={PAD} y={H - 12} fontSize="10" fill="#8b99ab" style={{ fontFamily: "ui-monospace, monospace" }}>
        position along the line →
      </text>
      <text
        x={PAD - 8}
        y={PAD + 4}
        fontSize="10"
        fill="#8b99ab"
        textAnchor="end"
        transform={`rotate(-90 ${PAD - 8} ${PAD + 4})`}
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        ↑ fitness
      </text>
    </svg>
  );
}
