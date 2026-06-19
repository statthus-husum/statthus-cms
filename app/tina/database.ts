import { createDatabase, createLocalDatabase } from "@tinacms/datalayer";
import { MongodbLevel } from "mongodb-level";
import { GitHubProvider } from "tinacms-gitprovider-github";

// Im Produktivbetrieb auf false (per Env-Var TINA_PUBLIC_IS_LOCAL).
// Lokal (npm run dev) ist es true → Filesystem statt GitHub + MongoDB.
const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

// Werte werden zur Build-Zeit geladen, aber nur zur Laufzeit (erste GraphQL-Anfrage)
// tatsächlich gegen GitHub/MongoDB benutzt. Daher hier kein hartes throw — sonst
// scheitert `tinacms build` im Docker-Builder, der die Env-Vars noch nicht hat.
const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN as string;
const owner = process.env.GITHUB_OWNER as string;
const repo = process.env.GITHUB_REPO as string;
const branch = (process.env.GITHUB_BRANCH || "staging") as string;

if (!isLocal && (!token || !owner || !repo) && process.env.NODE_ENV === "production" && !process.env.TINA_BUILD) {
  // Im laufenden Container (NODE_ENV=production, TINA_BUILD nicht gesetzt) loggen,
  // aber nicht crashen — sonst kommt der Container nie hoch.
  console.warn(
    "[tina/database] Hinweis: GITHUB_* oder MongoDB-Env-Vars fehlen. Editoren werden Fehler beim Speichern sehen."
  );
}

export default isLocal
  ? createLocalDatabase()
  : createDatabase({
      gitProvider: new GitHubProvider({
        branch,
        owner,
        repo,
        token,
      }),
      databaseAdapter: new MongodbLevel<string, Record<string, any>>({
        collectionName: process.env.MONGODB_COLLECTION || "tinacms",
        dbName: process.env.MONGODB_DBNAME || "tinacms",
        mongoUri: process.env.MONGODB_URI as string,
      }),
      namespace: branch,
    });
