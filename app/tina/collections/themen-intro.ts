import type { Collection } from "tinacms";

// Kopftexte: Kopf-/Einleitungstext der Section-Landing-Pages.
//
// Aufgeteilt in zwei Collections wegen der unterschiedlichen Pfadtiefe
// (Tinas Datalayer-Glob verträgt kein "**" / Brace über mehrere Ebenen
// ohne Pfad-Bugs):
//   section_intro  — Top-Level: content/german/<section>/_index.md
//   themen_intro   — eine Ebene tiefer: content/german/themen/<term>/_index.md
//
// Hier liegt nur Titel, Kurzbeschreibung und der Body über der Liste.
// Cards mit Links stecken in den Abschnitt-Dateien (pages.ts).
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
export const ThemenIntroCollection: Collection = {
  name: "section_intro",
  label: "Kopftexte",
  path: "content/german",
  format: "md",
  // NUR Top-Level-Section-Landings, genau eine Ebene tief:
  // about/_index, event/_index, news/_index, people/_index,
  // projekt/_index, member/_index, help/_index, gallery/_index, …
  //
  // Bewusst das simple "*/_index"-Glob (genau ein Segment):
  //  - "**/_index" hatte Tina bei tiefen Pfaden die mittlere Komponente
  //    verschlucken lassen (content/german/der-neubau/_index.md)
  //  - "{*,themen/*}/_index" (Brace-Expansion) wird vom Datalayer-Glob
  //    nicht unterstützt → erratisches Matching auf content/german/_index.md
  //
  // Themen-Filterseiten (themen/<term>/_index) liegen tiefer und werden
  // von der separaten themen_intro-Collection abgedeckt. Sub-Section-
  // Landings (projekt/das-denkmal/_index) gehören zu den *_sub-Collections.
  match: { include: "*/_index" },
  ui: {
    allowedActions: {
      create: false,
      delete: false,
    },
  },
  fields: introFields,
};

// Themen-Filterseiten: content/german/themen/<term>/_index.md
// (z.B. wie-wir-leben, wir-im-quartier). Eine Ebene tief vom
// themen-Pfad → simples "*/_index"-Glob.
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
