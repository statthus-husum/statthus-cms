import {
  UsernamePasswordAuthJSProvider,
  TinaUserCollection,
} from "tinacms-authjs/dist/tinacms";
import { defineConfig, LocalAuthProvider } from "tinacms";

import { EventCollection } from "./collections/event";
import { NewsCollection } from "./collections/news";
import { PersonCollection } from "./collections/person";
import {
  ProjektCollection,
  ProjektSubCollection,
  MemberCollection,
  MemberSubCollection,
  HelpCollection,
  HelpSubCollection,
} from "./collections/pages";
import {
  ProjektIntroCollection,
  MemberIntroCollection,
  HelpIntroCollection,
  EventIntroCollection,
  NewsIntroCollection,
  PeopleIntroCollection,
  ThemenFilterCollection,
} from "./collections/themen-intro";

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

export default defineConfig({
  authProvider: isLocal
    ? new LocalAuthProvider()
    : new UsernamePasswordAuthJSProvider(),
  contentApiUrlOverride: "/api/tina/gql",

  build: {
    publicFolder: "public",
    outputFolder: "admin",
  },

  // KRITISCH — nicht entfernen/erhöhen ohne den Zusammenhang zu kennen:
  //
  // cards-field.ts hat ein `reference`-Feld auf viele Collections; mehrere
  // davon (projekt/member/help + *_sub) enthalten selbst wieder cardsField
  // → rekursiver Referenz-Graph. Mit der Default-Reference-Depth expandiert
  // TinaCMS das so tief, dass frags.gql >100 kB wird und der self-hosted
  // Datalayer-Indexer beim "Indexing to self-hosted data layer" praktisch
  // hängen bleibt. Folge: KEIN Record wird sauber indiziert — auch nicht
  // content/users/index.json → tinacms-authjs kann niemanden mehr
  // authentifizieren → kompletter Login-Ausfall (kein Schema-, Cache- oder
  // Dateifehler, sondern dieser Referenz-Bloat).
  //
  // referenceDepth: 1 begrenzt die Expansion auf eine Ebene (Card-Links
  // brauchen nur den Repo-Pfad des Ziels — das Hugo-Layout baut die URL
  // daraus). Greift automatisch bei Dockerfile-`build` UND Entrypoint-
  // `npx tinacms build`, da reine Config-Option.
  client: {
    referenceDepth: 1,
  },

  // Custom Media Store: lädt unsere GitHubMediaStore-Klasse, die Bilder
  // direkt nach static/images/ im Hugo-Repo committet (siehe app/tina/
  // media-store.ts und pages/api/media/*).
  media: {
    loadCustomStore: async () => {
      const pack = await import("./media-store");
      return pack.default;
    },
  },

  schema: {
    collections: [
      TinaUserCollection,
      EventCollection,
      NewsCollection,
      PersonCollection,
      // Reihenfolge = Sidebar-Reihenfolge. Drei logische Gruppen werden
      // von admin-tweaks.js zu klappbaren Köpfen zusammengefasst
      // ("Kopftexte", "Abschnitte", "Unterseiten"). Jede Gruppe MUSS
      // hier zusammenhängend stehen, damit ein Gruppen-Header alle
      // Mitglieder am Stück umfasst (sonst stehen sie verschachtelt).
      //
      // Kopftexte (alle *_intro): je eine Collection pro Sektion, um den
      // verschachtelten-Pfad-Konflikt zu vermeiden (themen-intro.ts).
      ProjektIntroCollection,
      MemberIntroCollection,
      HelpIntroCollection,
      EventIntroCollection,
      NewsIntroCollection,
      PeopleIntroCollection,
      ThemenFilterCollection,
      // Abschnitte (projekt | member | help): Top-Level je Section.
      ProjektCollection,
      MemberCollection,
      HelpCollection,
      // Unterseiten (alle *_sub): eine Ebene tiefer.
      ProjektSubCollection,
      MemberSubCollection,
      HelpSubCollection,
    ],
  },
});
