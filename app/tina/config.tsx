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
      // Reihenfolge = Sidebar-Reihenfolge. admin-tweaks.js fasst je
      // THEMA zu einem klappbaren Kopf zusammen (News, Veranstaltungen,
      // Bewohner:innen, Projekt, Mitwohnen, Unterstützen, Weiteres).
      // Jede Gruppe MUSS hier ZUSAMMENHÄNGEND stehen, sonst umschließt
      // ein Header nicht alle Mitglieder am Stück. Innerhalb der
      // Section-Themen: Kopftext → Abschnitte → Unterseiten.
      // Themen-Kopftexte bildet allein die Gruppe „Weiteres"; nur Users
      // bleibt bewusst ungruppiert (ganz am Ende). Pro-Section-Intro-
      // Collections vermeiden den verschachtelten-Pfad-Konflikt
      // (siehe themen-intro.ts).
      //
      // News
      NewsCollection,
      NewsIntroCollection,
      // Veranstaltungen
      EventCollection,
      EventIntroCollection,
      // Bewohner:innen
      PersonCollection,
      PeopleIntroCollection,
      // Projekt
      ProjektIntroCollection,
      ProjektCollection,
      ProjektSubCollection,
      // Mitwohnen
      MemberIntroCollection,
      MemberCollection,
      MemberSubCollection,
      // Unterstützen
      HelpIntroCollection,
      HelpCollection,
      HelpSubCollection,
      // „Weiteres" (nur Themen-Kopftexte)
      ThemenFilterCollection,
      // Ungruppiert (ganz am Ende)
      TinaUserCollection,
    ],
  },
});
