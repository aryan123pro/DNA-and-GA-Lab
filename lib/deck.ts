/**
 * The presentation this lab was built alongside — "DNA based storage systems
 * and genetic algorithms" — with its numbered reference list, and the papers
 * it leans on hardest.
 *
 * Only papers whose licence allows redistribution are served from this site
 * (CC BY, or CC BY-NC / BY-NC-ND for a non-commercial educational use like
 * this one). Everything else links to where it can be read: the publisher, or
 * a free copy on PubMed Central or bioRxiv.
 */

export const DECK = {
  title: "DNA based storage systems and genetic algorithms",
  subtitle: "Nature-inspired storage and computing",
  authors: [
    "Aryan Doifode (C157)",
    "Vignesh Borkar (C134)",
    "Sharva Debre (C149)",
    "Akshaj Gupta (C169)",
  ],
  src: "/presentation/dna-based-storage-systems.pdf",
  pages: 41,
  size: "6.8 MB",
};

export interface DeckRef {
  n: number;
  text: string;
  url?: string;
  /** the peer-reviewed paper a press release is reporting */
  paper?: number;
}

export const DECK_REFS: { heading: string; note?: string; items: DeckRef[] }[] = [
  {
    heading: "Peer-reviewed literature",
    note: "All figures quoted in the deck are traceable to the numbered references.",
    items: [
      {
        n: 1,
        text: "Church, G. M., Gao, Y. & Kosuri, S. “Next-Generation Digital Information Storage in DNA.” Science 337:1628 (2012).",
        url: "https://doi.org/10.1126/science.1226355",
      },
      {
        n: 2,
        text: "Goldman, N. et al. “Towards practical, high-capacity, low-maintenance information storage in synthesized DNA.” Nature 494:77–80 (2013).",
        url: "https://doi.org/10.1038/nature11875",
      },
      {
        n: 3,
        text: "Grass, R. N. et al. “Robust Chemical Preservation of Digital Information on DNA in Silica.” Angew. Chem. Int. Ed. 54:2552–2555 (2015).",
        url: "https://doi.org/10.1002/anie.201411378",
      },
      {
        n: 4,
        text: "Erlich, Y. & Zielinski, D. “DNA Fountain enables a robust and efficient storage architecture.” Science 355:950–954 (2017).",
        url: "https://doi.org/10.1126/science.aaj2038",
      },
      {
        n: 5,
        text: "Organick, L. et al. “Random access in large-scale DNA data storage.” Nature Biotechnology 36:242–248 (2018).",
        url: "https://doi.org/10.1038/nbt.4079",
      },
      {
        n: 6,
        text: "Takahashi, C. N., Nguyen, B. H., Strauss, K. & Ceze, L. “Demonstration of End-to-End Automation of DNA Data Storage.” Scientific Reports 9:4998 (2019).",
        url: "https://doi.org/10.1038/s41598-019-41228-8",
      },
      {
        n: 7,
        text: "Zhang, C., Qian, L. et al. “Parallel molecular data storage by printing epigenetic bits on DNA.” Nature 634:824–832 (2024).",
        url: "https://doi.org/10.1038/s41586-024-08040-5",
      },
      {
        n: 8,
        text: "Adleman, L. M. “Molecular Computation of Solutions to Combinatorial Problems.” Science 266:1021–1024 (1994).",
        url: "https://doi.org/10.1126/science.7973651",
      },
      {
        n: 9,
        text: "Allentoft, M. E. et al. “The half-life of DNA in bone.” Proc. R. Soc. B (2012).",
        url: "https://doi.org/10.1098/rspb.2012.1745",
      },
      {
        n: 10,
        text: "Kjær, K. H. et al. “A 2-million-year-old ecosystem in Greenland.” Nature 612:283–291 (2022).",
        url: "https://doi.org/10.1038/s41586-022-05453-y",
      },
      {
        n: 11,
        text: "Lee, H. et al. “Terminator-free template-independent enzymatic DNA synthesis.” Nature Communications 10:2383 (2019).",
        url: "https://doi.org/10.1038/s41467-019-10258-1",
      },
      {
        n: 12,
        text: "Ping, Z. et al. “DNA storage: research landscape and future prospects.” National Science Review 7(6):1092–1107 (2020).",
        url: "https://doi.org/10.1093/nsr/nwaa007",
      },
      {
        n: 13,
        text: "Deb, K., Pratap, A., Agarwal, S. & Meyarivan, T. “A fast and elitist multiobjective genetic algorithm: NSGA-II.” IEEE Trans. Evol. Comput. 6(2):182–197 (2002).",
        url: "https://doi.org/10.1109/4235.996017",
      },
      {
        n: 14,
        text: "Katoch, S., Chauhan, S. S. & Kumar, V. “A review on genetic algorithm: past, present, and future.” Multimedia Tools and Applications 80:8091–8126 (2021).",
        url: "https://doi.org/10.1007/s11042-020-10139-6",
      },
    ],
  },
  {
    heading: "Books, technical documentation and reports",
    items: [
      {
        n: 15,
        text: "Holland, J. H. Adaptation in Natural and Artificial Systems. University of Michigan Press (1975); MIT Press edition (1992).",
      },
      {
        n: 16,
        text: "Goldberg, D. E. Genetic Algorithms in Search, Optimization and Machine Learning. Addison-Wesley (1989).",
      },
      {
        n: 17,
        text: "Alberts, B. et al. Molecular Biology of the Cell, “Chromosomal DNA and Its Packaging in the Chromatin Fiber.” NCBI Bookshelf NBK26834.",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK26834/",
      },
      {
        n: 18,
        text: "Hornby, G., Globus, A., Linden, D. & Lohn, J. “Automated Antenna Design with Evolutionary Algorithms.” AIAA Space 2006; NASA NTRS 20060024675.",
        url: "https://ntrs.nasa.gov/citations/20060024675",
      },
      { n: 19, text: "ATDBio. “Solid-phase oligonucleotide synthesis.” Nucleic Acids Book." },
      { n: 20, text: "Illumina. Sequencing Technology technical spotlight." },
      { n: 21, text: "Oxford Nanopore Technologies. Nanopore sequencing technology overview." },
      {
        n: 22,
        text: "International Energy Agency. Energy and AI (April 2025), Executive Summary.",
        url: "https://www.iea.org/reports/energy-and-ai",
      },
      {
        n: 23,
        text: "Encyclopaedia Britannica. “genetic algorithm.”",
        url: "https://www.britannica.com/technology/genetic-algorithm",
      },
      {
        n: 24,
        text: "SNIA / DNA Data Storage Alliance. Technology review (2025).",
        url: "https://dnastoragealliance.org/",
      },
    ],
  },
  {
    heading: "Secondary sources: press releases and journalism",
    note: "Listed separately from the peer-reviewed literature because they are press releases and reporting rather than primary research.",
    items: [
      {
        n: 25,
        text: "ETH Zurich press release on silica-encapsulated DNA (2015), via ScienceDaily.",
        paper: 3,
      },
      { n: 26, text: "Reporting on Google DeepMind’s AlphaEvolve (2025)." },
      { n: 27, text: "Industry reporting on CATALOG and Atlas Data Storage." },
    ],
  },
];

/** How a paper can be read from here. */
export type Access =
  | { kind: "hosted"; src: string; size: string; licence: string }
  | { kind: "free"; url: string; where: string }
  | { kind: "publisher"; url: string };

export interface KeyPaper {
  /** the deck's reference number, or 0 for further reading that is not in its list */
  ref: number;
  /** shown instead of the number when there is none */
  label?: string;
  /** a badge for the paper the deck leans on hardest */
  star?: string;
  short: string;
  title: string;
  venue: string;
  /** what the deck uses it for */
  used: string;
  accent: string;
  access: Access[];
}

/**
 * The papers the deck leans on hardest, in the order the story needs them.
 * Every one of the deck's headline numbers comes from somewhere on this list.
 */
export const KEY_PAPERS: KeyPaper[] = [
  {
    ref: 3,
    star: "Most important · DNA lifespan",
    short: "Grass et al. · 2015 · ETH Zurich",
    title: "Robust Chemical Preservation of Digital Information on DNA in Silica",
    venue: "Angew. Chem. Int. Ed. 54:2552–2555",
    used: "The DNA lifespan result. Sealing DNA in silica glass protected it so well that heat-ageing tests projected it would stay readable for about 2,000 years at 9.4 °C and for well over a million years at −18 °C — the deck’s headline durability claim, and the study ETH Zurich’s press release [25] reported on.",
    accent: "#7c3aed",
    access: [{ kind: "publisher", url: "https://doi.org/10.1002/anie.201411378" }],
  },
  {
    ref: 9,
    short: "Allentoft et al. · 2012",
    title: "The half-life of DNA in bone: measuring decay kinetics in 158 dated fossils",
    venue: "Proc. R. Soc. B 279:4724–4733",
    used: "The natural baseline the silica result is measured against: in bone, DNA bonds have a half-life of about 521 years — the deck’s DNA Lifespan slide.",
    accent: "#b45309",
    access: [
      {
        kind: "free",
        url: "https://royalsocietypublishing.org/doi/pdf/10.1098/rspb.2012.1745",
        where: "the publisher",
      },
      {
        kind: "free",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3497090/",
        where: "PubMed Central",
      },
    ],
  },
  {
    ref: 0,
    label: "Review",
    short: "Ceze, Nivala & Strauss · 2019 · University of Washington / Microsoft",
    title: "Molecular digital data storage using DNA",
    venue: "Nature Reviews Genetics 20:456–466",
    used: "The best single overview of the whole field the deck covers — the history from Microvenus in 1988, the write–store–retrieve–read pipeline, encoding and error correction, random access, preservation, cost, and what still stands in the way. Read this one first.",
    accent: "#0f766e",
    access: [{ kind: "publisher", url: "https://doi.org/10.1038/s41576-019-0125-3" }],
  },
  {
    ref: 1,
    short: "Church, Gao & Kosuri · 2012",
    title: "Next-Generation Digital Information Storage in DNA",
    venue: "Science 337:1628",
    used: "The first book written into DNA (659 KB), and the theoretical ceiling of about 455 exabytes per gram the deck quotes.",
    accent: "#0d9488",
    access: [{ kind: "publisher", url: "https://doi.org/10.1126/science.1226355" }],
  },
  {
    ref: 2,
    short: "Goldman et al. · 2013",
    title:
      "Towards practical, high-capacity, low-maintenance information storage in synthesized DNA",
    venue: "Nature 494:77–80",
    used: "Redundant, overlapping coding that recovered every file with full accuracy — the “robust coding” step on the timeline.",
    accent: "#2563eb",
    access: [
      { kind: "free", url: "https://europepmc.org/article/PMC/PMC3672958", where: "Europe PMC" },
      { kind: "publisher", url: "https://doi.org/10.1038/nature11875" },
    ],
  },
  {
    ref: 4,
    short: "Erlich & Zielinski · 2017",
    title: "DNA Fountain enables a robust and efficient storage architecture",
    venue: "Science 355:950–954",
    used: "215 petabytes per gram and 1.57 bits per base — within 14% of the theoretical limit.",
    accent: "#ea580c",
    access: [
      { kind: "free", url: "https://doi.org/10.1101/074237", where: "bioRxiv preprint" },
      { kind: "publisher", url: "https://doi.org/10.1126/science.aaj2038" },
    ],
  },
  {
    ref: 5,
    short: "Organick et al. · 2018",
    title: "Random access in large-scale DNA data storage",
    venue: "Nature Biotechnology 36:242–248",
    used: "35 files and over 200 MB, with any single file pulled out by PCR — the random-access slide.",
    accent: "#be123c",
    access: [
      { kind: "free", url: "https://doi.org/10.1101/114553", where: "bioRxiv preprint" },
      { kind: "publisher", url: "https://doi.org/10.1038/nbt.4079" },
    ],
  },
  {
    ref: 6,
    short: "Takahashi, Nguyen, Strauss & Ceze · 2019",
    title: "Demonstration of End-to-End Automation of DNA Data Storage",
    venue: "Scientific Reports 9:4998",
    used: "The whole pipeline — encode, synthesise, store, sequence, decode — run by a machine with no human in the loop.",
    accent: "#0891b2",
    access: [
      {
        kind: "hosted",
        src: "/papers/takahashi-2019-end-to-end-automation.pdf",
        size: "3.4 MB",
        licence: "CC BY 4.0",
      },
    ],
  },
  {
    ref: 11,
    short: "Lee et al. · 2019",
    title:
      "Terminator-free template-independent enzymatic DNA synthesis for digital information storage",
    venue: "Nature Communications 10:2383",
    used: "Writing DNA with an enzyme instead of harsh chemistry — the cheaper synthesis route the deck points to.",
    accent: "#16a34a",
    access: [
      {
        kind: "hosted",
        src: "/papers/lee-2019-enzymatic-synthesis.pdf",
        size: "1.5 MB",
        licence: "CC BY 4.0",
      },
    ],
  },
  {
    ref: 7,
    short: "Zhang, Qian et al. · 2024",
    title: "Parallel molecular data storage by printing epigenetic bits on DNA",
    venue: "Nature 634:824–832",
    used: "Writing data as chemical marks on pre-made DNA rather than synthesising every strand — the 2024 step on the timeline.",
    accent: "#9333ea",
    access: [
      {
        kind: "hosted",
        src: "/papers/zhang-2024-epigenetic-bits.pdf",
        size: "34 MB",
        licence: "CC BY-NC-ND 4.0",
      },
    ],
  },
];
