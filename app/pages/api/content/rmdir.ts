// Löscht einen Sub-Section-Ordner unter content/german/{projekt|member|help}/,
// indem alle darin liegenden Dateien (rekursiv) direkt über das
// @tinacms/datalayer-`database`-Objekt entfernt werden. `database.delete(path)`
// räumt MongoDB-Index UND GitHub in einem Schritt auf — der Ordner
// verschwindet damit sofort aus der UI und aus dem nächsten Hugo-Build
// von /<collection>/<slug>/.
//
// Hintergrund: die `deleteDocument`-GraphQL-Mutation über den
// generierten databaseClient committete zwar nach GitHub, aktualisierte
// aber den MongoDB-Index nicht — die Tina-UI wurde erst nach einem
// Container-Restart konsistent (der Entrypoint baut den Index neu).
//
// Nur Sub-Section-Ordner sind erlaubt; die Top-Level-Collections selbst
// (content/german/projekt, .../member, .../help) können nicht gelöscht
// werden — dafür sorgt die Allowlist + die Slug-Pflicht.
//
// Spiegelt /api/content/mkdir: dort werden die Dateien angelegt, hier
// werden sie wieder entfernt.

import type { NextApiRequest, NextApiResponse } from "next";

import database from "../../../tina/database";

const ALLOWED_COLLECTIONS = new Set(["projekt", "member", "help"]);

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;

interface GhItem {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
}

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

// Pfadsegmente einzeln auf slug-safe chars beschränken, leere Segmente
// rausschmeißen. Schließt `..`-Path-Traversal aus, da Punkte komplett
// gestrippt werden.
function sanitizeSlugPath(slug: string): string {
  return slug
    .split("/")
    .map((s) => s.replace(/[^a-zA-Z0-9_-]+/g, ""))
    .filter(Boolean)
    .join("/");
}

async function listFolder(folderPath: string): Promise<GhItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(folderPath)}?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`GitHub list failed: ${errBody.message || res.status}`);
  }
  const items = await res.json();
  // GitHubs Contents-API liefert ein Array für Ordner, ein Objekt für
  // Einzeldateien. In unserem Fall sollte's ein Ordner sein, aber
  // defensiv normalisieren.
  return Array.isArray(items) ? (items as GhItem[]) : [items as GhItem];
}

async function collectFilesRecursive(folderPath: string): Promise<GhItem[]> {
  const items = await listFolder(folderPath);
  const files: GhItem[] = [];
  for (const item of items) {
    if (item.type === "file") {
      files.push(item);
    } else if (item.type === "dir") {
      const sub = await collectFilesRecursive(item.path);
      files.push(...sub);
    }
  }
  return files;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

  try {
    const body = (req.body || {}) as { collection?: string; slug?: string };
    const collection = (body.collection || "").trim();
    const slugRaw = (body.slug || "").trim();

    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const slug = sanitizeSlugPath(slugRaw);
    if (!slug) {
      return res.status(400).json({ error: "slug required" });
    }

    const folderPath = `content/german/${collection}/${slug}`;

    const files = await collectFilesRecursive(folderPath);
    if (files.length === 0) {
      return res
        .status(404)
        .json({ error: "folder is empty or does not exist" });
    }

    // `database.delete(fullPath)` ruft direkt in @tinacms/datalayer und
    // räumt MongoDB-Index UND GitHub auf — der Umweg über die
    // GraphQL-Mutation `deleteDocument` aktualisierte aus uns unbekannten
    // Gründen nur GitHub, nicht den MongoDB-Index, sodass die Tina-UI
    // erst nach Container-Restart wieder konsistent war.
    const errors: { file: string; msg: string }[] = [];
    let deletedCount = 0;
    for (const file of files) {
      try {
        await (database as any).delete(file.path);
        deletedCount += 1;
      } catch (err: any) {
        errors.push({
          file: file.path,
          msg: err?.message || "database.delete failed",
        });
      }
    }

    if (errors.length > 0) {
      return res.status(502).json({
        ok: false,
        path: folderPath,
        deleted: deletedCount,
        errors,
      });
    }

    return res.json({ ok: true, path: folderPath, deleted: deletedCount });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "unknown error" });
  }
}
