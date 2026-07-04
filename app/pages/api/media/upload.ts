// Upload-Endpunkt für den Tina-Media-Manager.
// - Auth: NextAuth-Session muss vorhanden sein (Tina-User eingeloggt)
// - Speichert in den Hetzner-S3-Media-Bucket unter uploads/<Ordner>/
//   (siehe lib/media-s3.ts für Key-Layout und Hintergrund des Umzugs
//   weg von Git-Commits ins Website-Repo).
// - Erzeugt zusätzlich ein Thumbnail (_thumbs/<name>.webp) und schreibt
//   den Ordner-Manifest-Eintrag fort (Galerie liest das client-seitig).

import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { readFile } from "fs/promises";
import sharp from "sharp";

import {
  MEDIA_ROOT,
  THUMB_DIM,
  hasS3Credentials,
  putObject,
  publicUrl,
  thumbKey,
  contentTypeFor,
  upsertManifestEntry,
} from "../../../lib/media-s3";

export const config = {
  api: { bodyParser: false },
};

// Editor:innen laden oft Kamera-Originale hoch (mehrere MB, >4000px).
// Wir skalieren serverseitig auf eine web-taugliche Größe herunter —
// die Website liefert die Bilder ohne weitere Verarbeitung aus.
const MAX_DIM = 2500; // längste Kante in px
const RASTER = new Set(["jpg", "jpeg", "png", "webp"]);

type Optimized = {
  buf: Buffer;
  width: number | null;
  height: number | null;
  thumb: Buffer | null;
};

async function optimizeImage(buf: Buffer, filename: string): Promise<Optimized> {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!RASTER.has(ext)) {
    // svg/gif u.a. unangetastet lassen — auch kein Thumb (svg skaliert
    // ohnehin, gif-Animationen würde sharp zerlegen)
    return { buf, width: null, height: null, thumb: null };
  }
  try {
    let img = sharp(buf, { failOn: "none" }).rotate(); // EXIF-Orientierung anwenden
    const meta = await img.metadata();
    if ((meta.width || 0) > MAX_DIM || (meta.height || 0) > MAX_DIM) {
      img = img.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });
    }
    if (ext === "png") img = img.png({ compressionLevel: 9 });
    else if (ext === "webp") img = img.webp({ quality: 82 });
    else img = img.jpeg({ quality: 82, mozjpeg: true });
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    const out = data.length < buf.length ? data : buf; // nie größer machen

    const thumb = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: THUMB_DIM, height: THUMB_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return { buf: out, width: info.width, height: info.height, thumb };
  } catch {
    return { buf, width: null, height: null, thumb: null }; // im Zweifel Original speichern statt scheitern
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

// Normalisiert das Upload-Verzeichnis auf einen Pfad innerhalb von
// MEDIA_ROOT. Tina sendet im Initial-State ihren publicFolder (z.B.
// "public") — den mappen wir auf MEDIA_ROOT, statt mit 400 abzulehnen.
// Echte Unterordner unter MEDIA_ROOT bleiben erhalten; ../-Traversal
// wird zurückgesetzt.
function safeMediaDir(raw: string): string {
  const trimmed = (raw || "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed || trimmed.includes("..")) return MEDIA_ROOT;
  if (trimmed === MEDIA_ROOT) return trimmed;
  if (trimmed.startsWith(MEDIA_ROOT + "/")) return trimmed;
  return MEDIA_ROOT;
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
  if (!hasS3Credentials()) return res.status(500).json({ error: "S3 credentials not set" });

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

    const rawBuf = await readFile(uploaded.filepath);
    const { buf, width, height, thumb } = await optimizeImage(rawBuf, filename);

    const key = `${targetDir}/${filename}`;
    const tKey = thumb ? thumbKey(key) : null;

    await putObject(key, buf, contentTypeFor(filename));
    if (thumb && tKey) await putObject(tKey, thumb, "image/webp");

    await upsertManifestEntry(targetDir, {
      file: filename,
      src: key,
      thumb: tKey,
      width,
      height,
    });

    // Frontmatter-Konvention: absolute URL — das Theme-Partial image.html
    // reicht http(s)-Quellen unverändert durch.
    return res.json({
      id: key,
      filename,
      directory: targetDir,
      src: publicUrl(key),
      thumb: tKey ? publicUrl(tKey) : publicUrl(key),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
