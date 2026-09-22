"use client";

import { useMemo } from "react";
import {
  BASELINE_GENOME,
  StorageGenome,
  damage,
  encode,
  rawDecode,
  recover,
} from "./codec";
import { damageRates, useApp } from "./store";

export function runPipeline(
  message: string,
  genome: StorageGenome,
  errorRate: number,
  mechanism: ReturnType<typeof useApp.getState>["mechanism"],
  seed: number,
) {
  const enc = encode(message, genome);
  const dmg = damage(enc.bases, { ...damageRates(errorRate, mechanism), seed });
  const rec = recover(dmg.bases, genome, message, enc.codedSymbols, enc.payloadSymbols);
  const raw = rawDecode(dmg.bases, genome, enc.codedSymbols, enc.payloadSymbols);
  const hits = new Map<number, "sub" | "ins" | "del">();
  for (const i of dmg.insertions) hits.set(i, "ins");
  for (const i of dmg.substitutions) hits.set(i, "sub");
  return { enc, dmg, rec, raw, hits };
}

export type Pipeline = ReturnType<typeof runPipeline>;

/** Live pipeline for whichever codec is currently active (evolved or baseline). */
export function usePipeline() {
  const { message, errorRate, mechanism, damageSeed, ga, useEvolved } = useApp();
  const genome = useEvolved ? ga.best.genome : BASELINE_GENOME;
  return useMemo(
    () => runPipeline(message, genome, errorRate, mechanism, damageSeed),
    [message, genome, errorRate, mechanism, damageSeed],
  );
}

/** Both codecs, same damage seed — the head-to-head used by the Compare tab. */
export function useDuel() {
  const { message, errorRate, mechanism, damageSeed, ga } = useApp();
  return useMemo(() => {
    const baseline = runPipeline(
      message,
      BASELINE_GENOME,
      errorRate,
      mechanism,
      damageSeed,
    );
    const evolved = runPipeline(
      message,
      ga.best.genome,
      errorRate,
      mechanism,
      damageSeed,
    );
    return { baseline, evolved };
  }, [message, errorRate, mechanism, damageSeed, ga.best.genome]);
}
