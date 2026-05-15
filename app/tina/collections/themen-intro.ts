import type { Collection } from "tinacms";

// Kopftexte: alle _index.md Dateien unterhalb content/german/.
// Das umfasst Hugo's Section-Landing-Pages für event, news, people, projekt,
// member, help, gallery sowie die Themen-Filterseiten (themen/wie-wir-leben,
// themen/wir-im-quartier).
//
// Hier liegt nur der reine Kopf-/Einleitungstext jeder Section — Titel,
// Kurzbeschreibung und der Body, der über der Section-Liste angezeigt wird.
// Die Cards mit Links auf einzelne Abschnitte stecken in den Abschnitt-
// Dateien selbst (siehe pages.ts, ProjektCollection etc.).
//
// `allowedActions: create=false, delete=false` — Section-Landings sind durch
// die Hugo-Verzeichnisstruktur fest vorgegeben.
export const ThemenIntroCollection: Collection = {
  name: "section_intro",
  label: "Kopftexte",
  path: "content/german",
  format: "md",
  // Nur Top-Level-Section-Landings (event/_index, news/_index,
  // projekt/_index, …) plus die Themen-Filterseiten
  // (themen/wie-wir-leben/_index). NICHT die Sub-Section-Landings wie
  // projekt/das-denkmal/_index — die liegen in den *_sub-Collections.
  //
  // Ein zu tiefes "**/_index" hatte Tina die mittlere Pfad-Komponente
  // verschlucken lassen ("content/german/der-neubau/_index.md" statt
  // "content/german/projekt/der-neubau/_index.md").
  match: { include: "{*,themen/*}/_index" },
  ui: {
    allowedActions: {
      create: false,
      delete: false,
    },
  },
  fields: [
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
  ],
};
