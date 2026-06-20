// Upload-Endpunkt für den Tina-Media-Manager.
// - Auth: NextAuth-Session muss vorhanden sein (Tina-User eingeloggt)
// - Speichert nach assets/images/uploads/ (oder einem Unterordner davon,
//   wenn Tina das directory-Feld mitschickt). Wir trennen CMS-Uploads
//   bewusst von den Theme-Assets unter assets/images/, damit der
//   Media-Manager nur Editor-Inhalte zeigt.
// - Hugo rendert Bilder via resources.Get aus dem assets/-Mount.

import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { readFile } from "fs/promises";
import sharp from "sharp";

export const config = {
  api: { bodyParser: false },
};

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;
const MEDIA_DIR = "assets/images/uploads";

// Editor:innen laden oft Kamera-Originale hoch (mehrere MB, >4000px). Die
// GitHub-Contents-API verträgt große base64-Payloads schlecht (Timeouts /
// "gitrpc bad object"-Fehler bei der Freigabe), und Hugo müsste sie sonst bei
// jedem Build neu verkleinern. Deshalb skalieren wir serverseitig auf eine
// web-taugliche Größe herunter, bevor wir committen.
const MAX_DIM = 2500; // längste Kante in px
const RASTER = new Set(["jpg", "jpeg", "png", "webp"]);

async function optimizeImage(buf: Buffer, filename: string): Promise<Buffer> {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!RASTER.has(ext)) return buf; // svg/gif u.a. unangetastet lassen
  try {
    let img = sharp(buf, { failOn: "none" }).rotate(); // EXIF-Orientierung anwenden
    const meta = await img.metadata();
    if ((meta.width || 0) > MAX_DIM || (meta.height || 0) > MAX_DIM) {
      img = img.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });
    }
    if (ext === "png") img = img.png({ compressionLevel: 9 });
    else if (ext === "webp") img = img.webp({ quality: 82 });
    else img = img.jpeg({ quality: 82, mozjpeg: true });
    const out = await img.toBuffer();
    return out.length < buf.length ? out : buf; // nie größer machen
  } catch {
    return buf; // im Zweifel das Original committen statt zu scheitern
  }
}

function isAuthed(req: NextApiRequest) {
  // NextAuth setzt einen der beiden Cookie-Namen je nach Protokoll
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

// Normalisiert das Upload-Verzeichnis auf einen Pfad innerhalb von MEDIA_DIR.
// Tina sendet im Initial-State ihren publicFolder (z.B. "public") — den
// mappen wir auf MEDIA_DIR, statt mit 400 abzulehnen. Echte Unterordner
// unter MEDIA_DIR bleiben erhalten; ../-Traversal wird zurückgesetzt.
function safeMediaDir(raw: string): string {
  const trimmed = (raw || "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed || trimmed.includes("..")) return MEDIA_DIR;
  if (trimmed === MEDIA_DIR) return trimmed;
  if (trimmed.startsWith(MEDIA_DIR + "/")) return trimmed;
  return MEDIA_DIR;
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
    const [fields, files] = await form.parse(req);
    const uploaded = files.file?.[0];
    if (!uploaded) return res.status(400).json({ error: "no file" });

    const requestedDir = Array.isArray(fields.directory)
      ? fields.directory[0]
      : (fields.directory as string | undefined);
    const targetDir = safeMediaDir(requestedDir || "");

    const original = uploaded.originalFilename || "upload";
    let filename = safeName(original);
    if (!filename) filename = `upload-${Date.now()}`;

    // Datei einlesen, ggf. herunterskalieren, base64-encoden
    const rawBuf = await readFile(uploaded.filepath);
    const buf = await optimizeImage(rawBuf, filename);
    const base64 = buf.toString("base64");

    const path = `${targetDir}/${filename}`;

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

    // Frontmatter-Konvention im statthus-website-Repo: relativer Pfad ohne
    // führenden Slash, der vom Theme über resources.Get aus assets/ aufgelöst
    // wird — z.B. "images/post/post-3.jpg".
    const publicUrl = path.startsWith("assets/") ? path.slice("assets/".length) : path;
    return res.json({
      id: path,
      filename,
      directory: targetDir,
      src: publicUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
