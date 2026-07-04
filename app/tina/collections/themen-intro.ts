import type { Collection } from "tinacms";

// Kopftexte: Kopf-/Einleitungstext der Section-Landing-Pages
// (content/german/<section>/_index.md).
//
// WICHTIG — warum eine Collection PRO Sektion statt einer breiten:
//
// Eine einzelne Collection mit path "content/german" wäre ein ELTERN-
// Pfad jeder tieferen Collection an content/german/<section>. TinaCMS
// ordnet eine Datei der Collection mit dem LÄNGSTEN passenden Pfad zu
// und relativiert sie gegen DEREN Wurzel — bei Pfad-Überlappung schnitt
// der Doc-Resolver das Section-Segment ab und produzierte "Unable to
// find record". Daher: jede Sektion bekommt eine eigene, exakt auf
// ihren Ordner gescopte Kopftext-Collection mit match.include =
// "_index". (Gleiches Muster wie ThemenFilterCollection.)
//
// Historie: für projekt/member/help gab es hier früher ebenfalls
// Kopftext-Collections plus Abschnitt-/Unterseiten-Collections
// (collections/pages.ts). Die CMS-Pflege dieser Sections wurde
// entfernt — die variable Seitenstruktur war für Editor:innen zu
// komplex; diese Pages entstehen jetzt direkt in Hugo.
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
// ausschließlich diese eine Datei.
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

export const EventIntroCollection = makeSectionIntroCollection(
  "event",
  "Veranstaltungen-Kopftext",
);
export const NewsIntroCollection = makeSectionIntroCollection(
  "news",
  "News-Kopftext",
);
export const PeopleIntroCollection = makeSectionIntroCollection(
  "people",
  "Bewohner:innen-Kopftext",
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
