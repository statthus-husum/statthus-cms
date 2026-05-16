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
