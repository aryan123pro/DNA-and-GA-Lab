# DNA and GA Lab

An interactive lab about **storing data in DNA** and **genetic algorithms** — and what happens
when you point one at the other. Everything runs in the browser: no server, no database, and
no biological DNA is ever synthesised.

Built by **Aryan Doifode (C157), Vignesh Borkar (C134), Sharva Debre (C149) and Akshaj Gupta
(C169)** — B.Tech Computer Engineering, 1st semester 2026, Division C — alongside our
presentation *DNA based storage systems and genetic algorithms*.

---

## What is inside

| Page | What you do there |
| --- | --- |
| **Home** (`/`) | Type any word and watch it become DNA, bit by bit, then pick where to go. |
| **Chapter 1 · DNA Data Storage** (`/storage`) | Encode a message into A, C, G and T, damage the strand, and repair it with the six pathways a real cell uses. |
| **Chapter 2 · Genetic Algorithm** (`/genetic`) | Watch random guesses evolve into the right answer with three rules: keep the best, mix two parents, mutate a little. |
| **Chapter 3 · The Mixer** (`/mixer`) | A genetic algorithm designs the DNA storage scheme itself, by actually using each candidate on your message. |
| **Helix Lab** (`/helix`) | A 3-D double helix with your word written into it. Damage it with oxygen, UV light, copying typos or radiation, then watch named enzymes repair it live — base excision, mismatch, nucleotide excision, homologous recombination and end joining. |
| **Landing Lab** (`/landing`) | Try to land a Falcon-9-style booster yourself, then watch a genetic algorithm learn the hoverslam by crashing forty rockets at a time. |
| **Sources** (`/references`) | The website's reading list, **the presentation** (readable on a phone), its key papers and all 27 references, and **the team**. |

Press **⌘K** (or **Ctrl K**, or **/**) anywhere to jump to any page or step. In a chapter,
**[** and **]** move between steps, and the address bar remembers the step you are on.

---

## Setup

You need **Node.js 20 or newer** (built and tested on Node 24) and **npm**.

```bash
# 1. get the code
git clone https://github.com/aryan123pro/DNA-and-GA-Lab.git
cd DNA-and-GA-Lab

# 2. install dependencies
npm install

# 3. run it
npm run dev
```

Then open **http://localhost:3000**.

To open it on your phone while it runs on your laptop, connect both to the same Wi-Fi and
visit the **Network** address that `npm run dev` prints (for example
`http://192.168.1.20:3000`).

### Production build

```bash
npm run build   # every page is prerendered as static content
npm run start   # serve the built site on http://localhost:3000
```

### Checks

```bash
npx tsc --noEmit   # type-check
npm run lint       # eslint
```

### Deploying

It is a standard Next.js app with no environment variables and no backend, so it deploys
as-is to Vercel, Netlify or any Node host: import the repository and use the default
`npm run build` command.

---

## How it is built

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **framer-motion** for interface motion, **recharts** and **d3** for charts
- **pdf.js** for the in-page presentation viewer — browsers' own PDF embedding only shows the
  first page on iPhones, so slides are drawn onto a canvas instead
- **zustand** for the small piece of state the navigation rail shares with each page
- The helix, the rockets and their effects are drawn with hand-written **canvas renderers**,
  not a game engine

```
app/                    one folder per page (Next.js App Router)
components/
  shell/AppShell.tsx    navigation rail, mobile drawer and the ⌘K palette
  ModelShell.tsx        chapter layout: opener, step sequencer, next-step card
  helix/                Helix Lab: the 3-D renderer and the interactive studio
  rocket/               Landing Lab: scene renderer, the three labs, fullscreen console
  pdf/PdfViewer.tsx     mobile-friendly PDF viewer (used for the presentation)
  team/TeamTab.tsx      the team page
lib/
  dna.ts, repair.ts     text ↔ bits ↔ bases, damage and error correction (chapter 1)
  helix.ts              DNA damage and the five repair pathways, step by step
  rocket/               booster physics, the evolvable pilots, the genetic algorithm
  nav.ts                every destination, shared step state, visited tracking
  deck.ts, team.ts      the presentation's references and the team
public/
  presentation/         the presentation PDF
  papers/               openly licensed papers served by the site
  team/                 team photos
```

Every simulation is deterministic and runs in your browser; nothing is sent anywhere.

---

## About the PDFs in `public/papers`

Only papers whose licence allows redistribution are included, each unmodified and credited:

| File | Paper | Licence |
| --- | --- | --- |
| `takahashi-2019-end-to-end-automation.pdf` | Takahashi et al., *Scientific Reports* 9:4998 (2019) | CC BY 4.0 |
| `lee-2019-enzymatic-synthesis.pdf` | Lee et al., *Nature Communications* 10:2383 (2019) | CC BY 4.0 |
| `zhang-2024-epigenetic-bits.pdf` | Zhang et al., *Nature* 634:824–832 (2024) | CC BY-NC-ND 4.0 |

The other papers the presentation relies on (Church 2012, Goldman 2013, Grass 2015, Erlich &
Zielinski 2017, Organick 2018, Allentoft 2012, Ceze et al. 2019) are copyrighted by their
publishers, so the site links to them — to a free copy where one exists — instead of hosting
them.

---

## A note on accuracy

This is an educational simulation built for a first-year audience. The physics, enzymes,
lesions and repair pathways are real, but simplified: timings are compressed so a whole repair
pathway plays out in seconds, repair patches are shortened to fit on screen, and the rocket is
a two-dimensional model built from real Falcon 9 numbers — not flight software.
