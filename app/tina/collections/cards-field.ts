import type { Collection } from "tinacms";

// Wiederverwendbares Cards-Feld: Liste von Kacheln, die auf Ziel-Abschnitte
// (projekt/member/help) oder Section-Landings (<name>_intro-Kopftexte)
// verlinken.
// Kommt in den Abschnitt-Collections vor; ein leeres Cards-Array rendert
// auf der Live-Site nichts.
//
// Type: aus Collection["fields"] gezogen, weil das exportierte `Field` aus
// tinacms der strenge Form-Field-Runtime-Typ ist (verlangt `component`),
// während die Schema-Felder den loseren TinaField-Typ haben. NonNullable,
// weil Collection["fields"] in den Tina-Typings selbst optional ist.
export const cardsField: NonNullable<Collection["fields"]>[number] = {
  type: "object",
  name: "cards",
  label: "Cards",
  list: true,
  ui: {
    itemProps: (item: { title?: string }) => ({
      label: item?.title || "(neue Card)",
    }),
  },
  fields: [
    {
      type: "string",
      name: "title",
      label: "Titel",
      required: true,
    },
    {
      type: "string",
      name: "description",
      label: "Beschreibung",
      ui: { component: "textarea" },
    },
    {
      type: "image",
      name: "image",
      label: "Bild",
    },
    {
      type: "reference",
      name: "link",
      label: "Ziel-Abschnitt",
      description:
        "Der Abschnitt, auf den diese Card verlinken soll — wählbar aus den Projekt-, Mitwohnen- und Unterstützen-Abschnitten sowie den Section-Landings. Tina speichert den Repo-Pfad; das Hugo-Layout baut daraus die URL.",
      collections: [
        "projekt_intro",
        "member_intro",
        "help_intro",
        "event_intro",
        "news_intro",
        "people_intro",
        "themen_intro",
        "projekt",
        "projekt_sub",
        "member",
        "member_sub",
        "help",
        "help_sub",
      ],
    },
  ],
};
