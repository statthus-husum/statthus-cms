import { createDatabase, createLocalDatabase } from "@tinacms/datalayer";
import { MongodbLevel } from "mongodb-level";
import { GitHubProvider } from "tinacms-gitprovider-github";

// Im Produktivbetrieb auf false (per Env-Var TINA_PUBLIC_IS_LOCAL).
// Lokal (npm run dev) ist es true → Filesystem statt GitHub + MongoDB.
const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN as string;
const owner = process.env.GITHUB_OWNER as string;
const repo = process.env.GITHUB_REPO as string;
const branch = (process.env.GITHUB_BRANCH || "main") as string;

if (!isLocal && (!token || !owner || !repo)) {
  throw new Error(
    "Im Produktivbetrieb müssen GITHUB_PERSONAL_ACCESS_TOKEN, GITHUB_OWNER und GITHUB_REPO gesetzt sein."
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
