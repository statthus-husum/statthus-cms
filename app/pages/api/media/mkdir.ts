// Legt einen Unterordner im S3-Media-Bucket an, indem ein .keep-Marker
// geschrieben wird. S3 kennt keine echten Verzeichnisse — über Marker-
// Objekte tun wir trotzdem so (gleiches Muster wie vorher mit .gitkeep
// im Git-Repo). Tina ruft das indirekt über den admin-tweaks
// "+ Ordner"-Button auf.

import type { NextApiRequest, NextApiResponse } from "next";

import {
  MEDIA_ROOT,
  hasS3Credentials,
  listDir,
  putObject,
} from "../../../lib/media-s3";

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

// Slug-light (gleiche Regeln wie upload.ts safeName, ohne Punkte).
function safeSegment(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/^_+|_+$/g, "");
}

// Validiert den Eingabepfad und normalisiert ihn auf einen vollen
// Bucket-Key innerhalb von MEDIA_ROOT.
function resolveTarget(rawPath: string, rawParent: string): string | null {
  const parent = (rawParent || "").trim().replace(/^\/+|\/+$/g, "");
  // parent muss leer oder MEDIA_ROOT / ein Unterordner davon sein
  let base = MEDIA_ROOT;
  if (parent) {
    if (parent.includes("..")) return null;
    if (parent !== MEDIA_ROOT && !parent.startsWith(MEDIA_ROOT + "/")) return null;
    base = parent;
  }

  // Pfad kann mehrere Segmente enthalten (a/b/c) — alle einzeln slugifizieren.
  const segments = rawPath
    .split("/")
    .map((s) => safeSegment(s))
    .filter(Boolean);
  if (segments.length === 0) return null;
  return `${base}/${segments.join("/")}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!hasS3Credentials()) return res.status(500).json({ error: "S3 credentials not set" });

  try {
    const body = (req.body || {}) as { name?: string; parent?: string };
    const target = resolveTarget(body.name || "", body.parent || "");
    if (!target) {
      return res.status(400).json({ error: "invalid folder name" });
    }

    // Falls der Ordner schon Objekte enthält: idempotent OK.
    const { files, dirs } = await listDir(target);
    if (files.length > 0 || dirs.length > 0) {
      return res.json({ ok: true, directory: target, alreadyExists: true });
    }

    await putObject(`${target}/.keep`, "", "application/octet-stream");
    return res.json({ ok: true, directory: target });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
