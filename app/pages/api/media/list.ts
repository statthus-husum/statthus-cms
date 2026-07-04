// Listet Bilder + Unterordner aus dem S3-Media-Bucket (Wurzel: uploads/).
// Tina ruft diesen Endpunkt auch beim Klick auf einen Ordner auf — dann
// kommt der Pfad als ?directory=uploads/<sub> rein. Interne Objekte
// (.keep-Marker, _thumbs/-Ordner, manifest.json) werden ausgeblendet.

import type { NextApiRequest, NextApiResponse } from "next";

import {
  MEDIA_ROOT,
  hasS3Credentials,
  listDir,
  publicUrl,
  thumbKey,
} from "../../../lib/media-s3";

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

// Normalisiert das angefragte Verzeichnis auf einen Pfad innerhalb von
// MEDIA_ROOT. Tina ruft List initial mit ihrem konfigurierten publicFolder
// (z.B. "public") auf, das wir auf MEDIA_ROOT mappen müssen — sonst
// scheitert der erste Fetch beim Öffnen des Media-Managers.
function safeMediaDir(raw: string): string {
  const trimmed = (raw || "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed || trimmed.includes("..")) return MEDIA_ROOT;
  if (trimmed === MEDIA_ROOT) return trimmed;
  if (trimmed.startsWith(MEDIA_ROOT + "/")) return trimmed;
  return MEDIA_ROOT;
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!hasS3Credentials()) return res.status(500).json({ error: "S3 credentials not set" });

  const directory = safeMediaDir(String(req.query.directory || ""));

  try {
    const { files, dirs } = await listDir(directory);

    const dirItems = dirs
      .filter((d) => !d.endsWith("/_thumbs"))
      .map((d) => ({
        type: "dir" as const,
        id: d,
        filename: d.slice(d.lastIndexOf("/") + 1),
        directory,
      }));

    const fileItems = files
      .filter((f) => {
        const name = f.key.slice(f.key.lastIndexOf("/") + 1);
        if (name === ".keep" || name === "manifest.json") return false;
        const ext = (name.split(".").pop() || "").toLowerCase();
        return IMAGE_EXTS.has(ext);
      })
      .map((f) => {
        const name = f.key.slice(f.key.lastIndexOf("/") + 1);
        const src = publicUrl(f.key);
        // Media-Manager-Kacheln laden das kleine _thumbs-Derivat; falls es
        // (Alt-Bestand, svg/gif) fehlt, fällt der Browser via onerror nicht
        // zurück — Tina zeigt dann das Original. Deshalb Thumb nur für
        // Raster-Formate annehmen, sonst Original.
        const ext = (name.split(".").pop() || "").toLowerCase();
        const hasThumb = ["jpg", "jpeg", "png", "webp"].includes(ext);
        const preview = hasThumb ? publicUrl(thumbKey(f.key)) : src;
        return {
          type: "file" as const,
          id: f.key,
          filename: name,
          directory,
          src,
          thumbnails: {
            "75x75": preview,
            "400x400": preview,
            "1000x1000": src,
          },
        };
      });

    // Ordner zuerst, dann Dateien — innerhalb der Gruppen alphabetisch.
    dirItems.sort((a, b) => a.filename.localeCompare(b.filename, "de"));
    fileItems.sort((a, b) => a.filename.localeCompare(b.filename, "de"));
    const items = [...dirItems, ...fileItems];

    return res.json({
      items,
      totalCount: items.length,
      offset: 0,
      limit: items.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
