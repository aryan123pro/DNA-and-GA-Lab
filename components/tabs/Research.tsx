"use client";

import { BookOpen, LineChart as LineIcon, ScatterChart as ScatterIcon, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { BASELINE_GENOME, damage, encode, recover } from "@/lib/codec";
import { damageRates, useApp } from "@/lib/store";
import { Badge, Panel, SectionHead } from "../ui";

const SWEEP = [0, 1, 2, 3, 5, 7, 9, 12, 15, 18, 20];
const TRIALS = 14;

export default function Research() {
  const { message, mechanism, ga, errorRate } = useApp();

  const sweep = useMemo(() => {
    const run = (g: typeof BASELINE_GENOME, rate: number) => {
      const rates = damageRates(rate, mechanism);
      const enc = encode(message, g);
      let acc = 0;
      for (let t = 0; t < TRIALS; t++) {
        const d = damage(enc.bases, { ...rates, seed: 4242 + t * 6361 + rate * 131 });
        acc += recover(d.bases, g, message, enc.codedSymbols, enc.payloadSymbols).charAccuracy;
      }
      return (acc / TRIALS) * 100;
    };
    return SWEEP.map((r) => ({
      rate: r,
      Baseline: +run(BASELINE_GENOME, r).toFixed(1),
      Evolved: +run(ga.best.genome, r).toFixed(1),
    }));
  }, [message, mechanism, ga.best.genome]);

  const history = ga.history.map((h) => ({
    gen: h.gen,
    best: +(h.best * 100).toFixed(2),
    avg: +(h.avg * 100).toFixed(2),
  }));

  const pareto = ga.population.map((p) => ({
    density: +(p.bitsPerBase).toFixed(3),
    survival: +(p.survival * 100).toFixed(1),
    fitness: p.fitness,
    ecc: p.genome.ecc,
    z: 60 + p.fitness * 180,
  }));

  const eccColor: Record<string, string> = {
    none: "#8b9bb4",
    parity2d: "#b06bff",
    triple: "#22b8ff",
  };

  const area = ga.history.map((h) => ({
    gen: h.gen,
    survival: +(h.survival * 100).toFixed(1),
    density: +(h.density * 100).toFixed(1),
  }));

  return (
    <div className="space-y-4">
      <SectionHead
        step={7}
        kicker="Empirical Simulation Analytics"
        title="Degradation curves, convergence traces and the density / survival Pareto front"
        body="Every point here is computed live from the same codec objects the rest of the app uses — no pre-baked data. The sweep re-runs Monte-Carlo damage trials at eleven noise levels for both the baseline and the current champion."
        accent="#22b8ff"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Error rate vs data recovery"
          icon={<LineIcon size={13} />}
          accent="#22b8ff"
          right={<Badge tone="#22b8ff">{TRIALS} trials / point</Badge>}
        >
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sweep} margin={{ top: 8, right: 16, bottom: 18, left: -14 }}>
                <CartesianGrid stroke="#1c2740" strokeDasharray="3 5" />
                <XAxis
                  dataKey="rate"
                  stroke="#4b5d7d"
                  tick={{ fontSize: 10, fill: "#6d7f9e" }}
                  tickLine={false}
                  label={{
                    value: "simulated biochemical error rate (%)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#5b6c8c",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#4b5d7d"
                  tick={{ fontSize: 10, fill: "#6d7f9e" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0b1120",
                    border: "1px solid #1c2740",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine
                  x={errorRate}
                  stroke="#ffb020"
                  strokeDasharray="4 4"
                  label={{ value: "you", fill: "#ffb020", fontSize: 10, position: "top" }}
                />
                <Line
                  type="monotone"
                  dataKey="Baseline"
                  stroke="#ff5d73"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: "#ff5d73" }}
                />
                <Line
                  type="monotone"
                  dataKey="Evolved"
                  stroke="#2dd4a7"
                  strokeWidth={2.6}
                  dot={{ r: 3.5, fill: "#2dd4a7" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Convergence trace" icon={<LineIcon size={13} />} accent="#7c6cff">
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 8, right: 16, bottom: 18, left: -14 }}>
                <CartesianGrid stroke="#1c2740" strokeDasharray="3 5" />
                <XAxis
                  dataKey="gen"
                  stroke="#4b5d7d"
                  tick={{ fontSize: 10, fill: "#6d7f9e" }}
                  tickLine={false}
                  label={{
                    value: "generation",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#5b6c8c",
                    fontSize: 10,
                  }}
                />
                <YAxis domain={[0, 100]} stroke="#4b5d7d" tick={{ fontSize: 10, fill: "#6d7f9e" }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#0b1120",
                    border: "1px solid #1c2740",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="best" name="Best fitness" stroke="#2dd4a7" strokeWidth={2.6} dot={false} />
                <Line type="monotone" dataKey="avg" name="Population mean" stroke="#7c6cff" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Density / survival Pareto front"
          icon={<ScatterIcon size={13} />}
          accent="#ff5fd2"
          right={
            <div className="mono flex gap-2 text-[9px]">
              <span style={{ color: "#8b9bb4" }}>● no ECC</span>
              <span style={{ color: "#b06bff" }}>● 2-D parity</span>
              <span style={{ color: "#22b8ff" }}>● triple</span>
            </div>
          }
        >
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: -14 }}>
                <CartesianGrid stroke="#1c2740" strokeDasharray="3 5" />
                <XAxis
                  type="number"
                  dataKey="density"
                  domain={[0, 2]}
                  stroke="#4b5d7d"
                  tick={{ fontSize: 10, fill: "#6d7f9e" }}
                  tickLine={false}
                  label={{
                    value: "information density (bits / nucleotide)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#5b6c8c",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="survival"
                  domain={[0, 100]}
                  stroke="#4b5d7d"
                  tick={{ fontSize: 10, fill: "#6d7f9e" }}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="z" range={[40, 220]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "#334866" }}
                  contentStyle={{
                    background: "#0b1120",
                    border: "1px solid #1c2740",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Scatter data={pareto} name="Codec">
                  {pareto.map((p, i) => (
                    <Cell key={i} fill={eccColor[p.ecc]} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="px-5 pb-4 text-[11px] leading-relaxed text-slate-500">
            Each dot is one live codec in the current population. Redundancy buys survival by
            spending density — the population physically spreads along that trade-off, and the
            fitness weights decide which corner wins.
          </p>
        </Panel>

        <Panel title="What the champion optimises over time" icon={<LineIcon size={13} />} accent="#ffb020">
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={area} margin={{ top: 8, right: 16, bottom: 18, left: -14 }}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22b8ff" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#22b8ff" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4a7" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2dd4a7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1c2740" strokeDasharray="3 5" />
                <XAxis dataKey="gen" stroke="#4b5d7d" tick={{ fontSize: 10, fill: "#6d7f9e" }} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#4b5d7d" tick={{ fontSize: 10, fill: "#6d7f9e" }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#0b1120",
                    border: "1px solid #1c2740",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="survival" name="Survival %" stroke="#22b8ff" fill="url(#gS)" strokeWidth={2} />
                <Area type="monotone" dataKey="density" name="Density score %" stroke="#2dd4a7" fill="url(#gD)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Research context" icon={<BookOpen size={13} />} accent="#22b8ff">
          <div className="space-y-3 p-5 text-[12px] leading-relaxed text-slate-400">
            <p>
              DNA is the densest known archival medium. A single gram can in principle hold on
              the order of <span className="mono text-teal">10^15 bytes</span>, and DNA recovered
              from permafrost has been sequenced after hundreds of thousands of years — with no
              power draw at all.
            </p>
            <p>
              The engineering problem is not capacity, it is chemistry. Synthesis and sequencing
              both degrade on long homopolymer runs, and strongly GC-skewed sequences amplify
              poorly. Real systems therefore never use the naive 2-bits-per-base table: Goldman
              et al. use a ternary Huffman code that forbids repeats, and Erlich &amp; Zielinski&apos;s
              DNA Fountain wraps a Luby-transform code around a screening filter.
            </p>
            <p>
              This simulator turns that design space into a search problem. Instead of a human
              hand-picking a constrained code, a genetic algorithm searches the space of codecs
              directly, with the physical constraints written into the fitness function.
            </p>
          </div>
        </Panel>

        <Panel title="Simulation limitations" icon={<ShieldAlert size={13} />} accent="#ff5d73">
          <ul className="space-y-2 p-5 text-[12px] leading-relaxed text-slate-400">
            <li>• No biological DNA is synthesised — this is a pure client-side computer model.</li>
            <li>
              • The damage model is an i.i.d. per-base process. Real degradation is correlated,
              position-dependent and heavily context-dependent (GC clamps, secondary structure).
            </li>
            <li>
              • Real archives store millions of short oligos with random access indices and
              primers; here the payload is one contiguous strand.
            </li>
            <li>
              • The ECC families implemented (2-D parity, triple redundancy) are deliberately
              simple and readable. Production systems use Reed–Solomon and fountain codes.
            </li>
            <li>
              • Fitness uses {3} damage trials per candidate for speed, so scores carry Monte-Carlo
              noise — visible as small non-monotonic wobbles in the convergence trace.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
