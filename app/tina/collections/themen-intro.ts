import type { Collection } from "tinacms";

// Kopftexte: Kopf-/Einleitungstext der Section-Landing-Pages
// (content/german/<section>/_index.md).
//
// WICHTIG — warum eine Collection PRO Sektion statt einer breiten:
//
// Eine einzelne Collection mit path "content/german" ist ein ELTERN-Pfad
// der tieferen Section-Collections (content/german/projekt, .../member,
// .../help). TinaCMS ordnet eine Datei der Collection mit dem LÄNGSTEN
// passenden Pfad zu und relativiert sie gegen DEREN Wurzel. Für
// content/german/projekt/_index.md gewinnt also content/german/projekt
// (Projekt-Abschnitte + -Unterseiten). Deren match lehnt "_index" ab —
// aber der Doc-Resolver hat das "projekt"-Segment schon abgeschnitten
// und produziert "content/german/_index.md" → "Unable to find record".
//
// event/news/people brachen NICHT, weil dort nur EINE Collection am
// tieferen Pfad liegt (keine Section/Sub-Aufteilung) und die Datei
// dadurch eindeutig der Kopftext-Collection zufällt.
//
// Lösung: kein Eltern-Pfad mehr. Jede Sektion bekommt eine eigene,
// exakt auf ihren Ordner gescopte Kopftext-Collection mit
// match.include = "_index". Das ist disjunkt zu
//   Section-Collection : include "*", exclude "_index"
//   Sub-Collection     : include "*/*"
// → drei Collections am selben Pfad, keine Überlappung, kein
//   verschachtelter Pfad. (Gleiches Muster wie ThemenFilterCollection.)
//
// `allowedActions: create=false, delete=false` — Section-Landings sind
// durch die Hugo-Verzeichnisstruktur fest vorgegeben.

const introFields: NonNullable<Collection["fields"]> = [
  {
    type: "string",
    name: "title",
    label: "Titel",
    isTitle: true,
    required: true,
  },
  {
    type: "string",
    name: "description",
    label: "Kurzbeschreibung",
  },
  {
    type: "string",
    name: "featured",
    label: "Hervorgehobener Post-Slug (optional)",
    description:
      'Nur für "Wir im Quartier" relevant — wenn gesetzt, hebt das Template diesen Post heraus.',
  },
  {
    type: "boolean",
    name: "draft",
    label: "Entwurf",
  },
  {
    type: "rich-text",
    name: "body",
    label: "Einleitung",
    isBody: true,
  },
];

// Eine Kopftext-Collection für genau eine Section: nur deren
// content/german/<name>/_index.md. match.include "_index" trifft
// ausschließlich diese eine Datei und kollidiert mit keiner
// Section-/Sub-Collection am selben Pfad.
function makeSectionIntroCollection(name: string, label: string): Collection {
  return {
    name: `${name}_intro`,
    label,
    path: `content/german/${name}`,
    format: "md",
    match: { include: "_index" },
    ui: {
      allowedActions: {
        create: false,
        delete: false,
      },
    },
    fields: introFields,
  };
}

export const ProjektIntroCollection = makeSectionIntroCollection(
  "projekt",
  "Kopftext – Projekt",
);
export const MemberIntroCollection = makeSectionIntroCollection(
  "member",
  "Kopftext – Mitwohnen",
);
export const HelpIntroCollection = makeSectionIntroCollection(
  "help",
  "Kopftext – Unterstützen",
);
export const EventIntroCollection = makeSectionIntroCollection(
  "event",
  "Kopftext – Veranstaltungen",
);
export const NewsIntroCollection = makeSectionIntroCollection(
  "news",
  "Kopftext – News",
);
export const PeopleIntroCollection = makeSectionIntroCollection(
  "people",
  "Kopftext – Bewohner:innen",
);

// Themen-Filterseiten: content/german/themen/<term>/_index.md
// (z.B. wie-wir-leben, wir-im-quartier). Eine Ebene tief vom
// themen-Pfad → simples "*/_index"-Glob. Kein konkurrierendes
// Collection an content/german/themen → unproblematisch.
export const ThemenFilterCollection: Collection = {
  name: "themen_intro",
  label: "Themen-Kopftexte",
  path: "content/german/themen",
  format: "md",
  match: { include: "*/_index" },
  ui: {
    allowedActions: {
      create: false,
      delete: false,
    },
  },
  fields: introFields,
};
