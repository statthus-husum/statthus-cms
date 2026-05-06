import type { Collection } from "tinacms";

// Wiederverwendbares Cards-Feld: Liste von Kacheln, die auf Ziel-Abschnitte
// (projekt/member/help) oder Section-Landings (section_intro) verlinken.
// Kommt in den Abschnitt-Collections vor; ein leeres Cards-Array rendert
// auf der Live-Site nichts.
//
// Type: aus Collection["fields"][number] gezogen, weil das exportierte
// `Field` aus tinacms der strenge Form-Field-Runtime-Typ ist (verlangt
// `component`), während die Schema-Felder den loseren TinaField-Typ haben.
export const cardsField: Collection["fields"][number] = {
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
      collections: ["section_intro", "projekt", "member", "help"],
    },
  ],
};
