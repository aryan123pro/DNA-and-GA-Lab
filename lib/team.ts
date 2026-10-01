/** The people behind the lab and the presentation, in the order the deck's title slide lists them. */
export interface Member {
  name: string;
  roll: string;
  photo: string;
  /** how to frame the face when the photo is cropped to the card */
  focus: string;
}

export const TEAM: Member[] = [
  {
    name: "Aryan Doifode",
    roll: "C157",
    photo: "/team/aryan-doifode.jpg",
    focus: "50% 35%",
  },
  {
    name: "Vignesh Borkar",
    roll: "C134",
    photo: "/team/vignesh-borkar.jpg",
    focus: "50% 30%",
  },
  {
    name: "Sharva Debre",
    roll: "C149",
    photo: "/team/sharva-debre.jpg",
    focus: "50% 40%",
  },
  {
    name: "Akshaj Gupta",
    roll: "C169",
    photo: "/team/akshaj-gupta.jpg",
    focus: "50% 35%",
  },
];

export const TEAM_PHOTO = "/team/full-team.jpg";

/** Programme, semester, year and division. */
export const COHORT = {
  programme: "B.Tech Computer Engineering",
  short: "B.Tech CE",
  semester: "1st semester",
  year: "2026",
  division: "C",
};
