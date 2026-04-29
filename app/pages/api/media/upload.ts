// Upload-Endpunkt für den Tina-Media-Manager.
// - Auth: NextAuth-Session muss vorhanden sein (Tina-User eingeloggt)
// - Speichert nach static/images/<filename> im konfigurierten GITHUB_BRANCH

import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { readFile } from "fs/promises";

export const config = {
  api: { bodyParser: false },
};

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;
const MEDIA_DIR = "static/images";

function isAuthed(req: NextApiRequest) {
  // NextAuth setzt einen der beiden Cookie-Namen je nach Protokoll
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

function safeName(name: string): string {
  // Slug-light: Leerzeichen → Unterstrich, alles außer a-z 0-9 . _ - raus
  return name
    .normalize("NFKD")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^_+|_+$/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const uploaded = files.file?.[0];
    if (!uploaded) return res.status(400).json({ error: "no file" });

    const original = uploaded.originalFilename || "upload";
    let filename = safeName(original);
    if (!filename) filename = `upload-${Date.now()}`;

    // Datei einlesen, base64-encoden
    const buf = await readFile(uploaded.filepath);
    const base64 = buf.toString("base64");

    const path = `${MEDIA_DIR}/${filename}`;

    // Falls schon vorhanden: SHA holen, sonst null
    let sha: string | undefined;
    const existsRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    if (existsRes.ok) {
      const existing = await existsRes.json();
      sha = existing.sha;
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: `Media-Upload via Tina: ${filename}`,
          content: base64,
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      },
    );

    if (!ghRes.ok) {
      const errBody = await ghRes.json();
      return res
        .status(502)
        .json({ error: errBody.message || "GitHub upload failed" });
    }

    // Auf der publizierten Site liegen die Bilder unter /static/images/ —
    // Hugos default-Static-Mapping greift dort nicht, daher muss der Pfad
    // in der Frontmatter den /static-Prefix mitführen.
    const publicUrl = `/static/images/${filename}`;
    return res.json({
      id: path,
      filename,
      directory: MEDIA_DIR,
      src: publicUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
