# DNA Codec Lab — closed-loop GA-optimized genetic storage

An interactive, client-side simulator of DNA data storage in which a **genetic algorithm
evolves the storage codec itself**, and the fittest chromosome becomes the live encoder that
compiles your message into nucleotides.

Most DNA-storage demos evolve *a sequence*. Here the GA population is a population of
**complete storage schemes**, and its champion is wired directly into the Encode → Damage →
Recover → Compare pipeline. Run a generation and the actual nucleotides of your message change.

## The closed loop

```
 population of 24 codecs ──▶ tournament selection ──▶ champion chromosome
                                                             │
                                                             ▼
                                              ACTIVE STORAGE CODEC
                                                             │
    fitness feedback ◀── survival score ◀── recover ◀── damage ◀── encode
           │                                                            
           └────────────────────────────────────────────────────────────┘
```

### The chromosome (8 genes)

| Gene | Range | What it changes |
| --- | --- | --- |
| `mapping` | permutation of A/C/G/T | which nucleotide each 2-bit symbol becomes |
| `rotationKey` | 0–65535 | seed of the position-dependent whitening keystream |
| `rotationStrength` | 0–3 | how strongly the keystream rotates symbols (GC balancing) |
| `homopolymerGuard` | on / off | whether the spacer state machine runs at all |
| `maxRun` | 2–6 | hard cap on homopolymer run length when the guard is on |
| `ecc` | none / blocked 2-D parity / triple redundancy | the error-correcting layer |
| `blockWidth` | 2–16 | width of the square parity block |
| `interleave` | on / off | spread redundancy along the strand to survive burst damage |

### The fitness function

Each candidate codec **actually encodes the user's real message**, the strand is hit with
simulated biochemical damage, and the codec's own decoder attempts recovery:

```
integrity = survival²                                   // archival integrity is all-or-nothing
quality   = (w_s + w_g·gcScore + w_h·homoScore + w_d·densityScore) / Σw
fitness   = integrity × quality
```

- `survival` — fraction of characters recovered, averaged over damage trials
- `gcScore` — penalty for drifting away from 50 % G+C (synthesis/PCR feasibility)
- `homoScore` — penalty for long identical runs (sequencer miscalls)
- `densityScore` — user bits carried per nucleotide, normalised against the 2 bits/nt ceiling

Because integrity *multiplies* everything, a codec that loses the data cannot buy the score
back with raw density. The result is the real engineering trade-off: at ~1 % noise evolution
picks no redundancy and 2.00 bits/nt; around 5 % it picks an interleaved 2-D parity grid; past
10 % it pays for triple redundancy.

Selection is tournament (k = 3) with 2 elites, uniform gene-wise crossover, per-gene mutation,
and 3 random immigrants per generation to preserve diversity.

## Stages

1. **Encode** — bits → nucleotides through the live evolved codec
2. **Evolve** — the GA lab: live population, fitness chart, tunable weights
3. **The Loop** — the closed-loop diagram plus a before/after strand diff proving the link
4. **Damage** — substitutions, insertions and deletions with a 3-D helix and particle effects
5. **Recover** — the evolved ECC layer repairing the read, character by character
6. **Compare** — baseline textbook codec vs the evolved one over 40 identical damage seeds
7. **Research** — degradation sweep, convergence trace, density/survival Pareto front
8. **References** — the DNA-storage, ECC and GA literature this is built on

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · framer-motion · recharts · zustand ·
canvas 2-D for the helix and particles. No backend, no API keys, no data leaves the browser.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Deploy

```bash
npm i -g vercel   # if needed
vercel login
vercel            # preview deployment
vercel --prod     # production deployment
```

No environment variables or project settings are required — Vercel auto-detects Next.js.

## Scope note

No biological DNA is synthesised; this is a computer model built for a presentation. The damage
model is an i.i.d. per-base process, real archives store millions of indexed oligos rather than
one contiguous strand, and the ECC families here are deliberately simple and readable where
production systems use Reed–Solomon and fountain codes.
