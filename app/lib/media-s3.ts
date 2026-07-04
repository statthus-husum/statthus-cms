// Gemeinsame S3-Anbindung für den Media-Store (pages/api/media/*).
//
// Bilder liegen NICHT mehr im Website-Git-Repo (assets/images/uploads/),
// sondern in einem Hetzner-Object-Storage-Bucket (statthus-infra:
// objectstorage.tf, minio_s3_bucket.cms_media). Ausgeliefert werden sie
// first-party über Caddy auf der CMS-VM als https://MEDIA_DOMAIN/<key> —
// MEDIA_DOMAIN ist die bestehende CMS-Domain (schreibe.statthus-husum.de,
// Route /uploads/* im Caddyfile), damit kein eigener DNS-Record nötig ist.
// Bewusst kein externes CDN, damit keine Besucher-IPs an Drittanbieter
// gehen. Hintergrund des Umzugs: Bild-Commits haben das Website-Repo
// aufgebläht und jeden GitHub-Pages-Deploy massiv verlangsamt (Hugo hat
// alle Varianten bei jedem Build neu gerechnet).
//
// Key-Layout im Bucket (Media-Manager-Wurzel = "uploads"):
//   uploads/<Ordner>/<datei>.jpg          Bild (max. 2500px, von upload.ts
//                                         via sharp verkleinert)
//   uploads/<Ordner>/_thumbs/<datei>.webp Thumbnail (max. THUMB_DIM px) —
//                                         für Galerie-Marquee + Media-Manager
//   uploads/<Ordner>/manifest.json        Bildliste des Ordners, wird bei
//                                         jedem Upload/Delete fortgeschrieben.
//                                         Die Galerie-Seite der Website lädt
//                                         sie client-seitig — ein Galerie-
//                                         Upload ist damit SOFORT live, ohne
//                                         Freigabe und ohne Website-Deploy.
//   uploads/<Ordner>/.keep                Marker für leere Ordner (S3 kennt
//                                         keine echten Verzeichnisse)
//
// Frontmatter-Konvention für Bildfelder: absolute URL
// https://MEDIA_DOMAIN/uploads/... — das Hugo-Theme-Partial image.html
// reicht http(s)-Quellen unverändert als <img src> durch. Alt-Bestand
// mit relativen "images/..."-Pfaden bleibt im Repo und funktioniert weiter.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const ENDPOINT = process.env.S3_ENDPOINT || "fsn1.your-objectstorage.com";
const REGION = process.env.S3_REGION || "fsn1";
export const BUCKET = process.env.MEDIA_S3_BUCKET || "statthus-media";
export const MEDIA_DOMAIN =
  process.env.MEDIA_DOMAIN || "schreibe.statthus-husum.de";

// Wurzel des Media-Managers im Bucket. Bewusst "uploads" (statt des alten
// Repo-Pfads assets/images/uploads), die öffentliche URL bleibt kurz.
export const MEDIA_ROOT = "uploads";

export const THUMB_DIM = 800; // längste Kante der _thumbs-Varianten in px

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: `https://${ENDPOINT}`,
      region: REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
      // Hetzner Object Storage kann virtual-hosted UND path-style; path-style
      // vermeidet TLS-Probleme mit Punkten im Bucket-Namen.
      forcePathStyle: true,
    });
  }
  return client;
}

export function hasS3Credentials(): boolean {
  return Boolean(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

export function publicUrl(key: string): string {
  return `https://${MEDIA_DOMAIN}/${key}`;
}

// Thumbnail-Key zu einem Bild-Key: uploads/Galerie/foo.jpg
// → uploads/Galerie/_thumbs/foo.webp
export function thumbKey(key: string): string {
  const slash = key.lastIndexOf("/");
  const dir = key.slice(0, slash);
  const base = key.slice(slash + 1).replace(/\.[^.]+$/, "");
  return `${dir}/_thumbs/${base}.webp`;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  json: "application/json",
};

export function contentTypeFor(filename: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

export async function putObject(
  key: string,
  body: Buffer | string,
  contentType?: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || contentTypeFor(key),
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Ein "Verzeichnis" listen: Dateien direkt im Prefix + Unterordner
// (CommonPrefixes). Interne Objekte (.keep, _thumbs/, manifest.json)
// filtert der Aufrufer.
export async function listDir(prefix: string): Promise<{
  files: { key: string; size: number }[];
  dirs: string[];
}> {
  const files: { key: string; size: number }[] = [];
  const dirs: string[] = [];
  let token: string | undefined;
  do {
    const out = await s3().send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
        Delimiter: "/",
        ContinuationToken: token,
      }),
    );
    for (const obj of out.Contents || []) {
      if (obj.Key) files.push({ key: obj.Key, size: obj.Size || 0 });
    }
    for (const cp of out.CommonPrefixes || []) {
      if (cp.Prefix) dirs.push(cp.Prefix.replace(/\/$/, ""));
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return { files, dirs };
}

// ---- Manifest-Pflege ----
//
// Pro Ordner hält <ordner>/manifest.json die anzeigbaren Bilder inkl.
// Thumb-Pfad und Abmessungen. Statt bei jeder Änderung den Ordner komplett
// zu scannen (LIST + n×HEAD), wird das bestehende Manifest gelesen und nur
// der betroffene Eintrag ersetzt/entfernt. Parallel-Uploads zweier
// Editor:innen könnten sich theoretisch überholen (last-writer-wins auf
// Ordner-Ebene) — für dieses Team akzeptiert; ein erneuter Upload
// repariert den Eintrag.

export type ManifestEntry = {
  file: string; // Dateiname, z.B. "sommerfest.jpg"
  src: string; // Key relativ zum Bucket, z.B. "uploads/Galerie/sommerfest.jpg"
  thumb: string | null; // Thumb-Key oder null (svg/gif ohne Thumb)
  width: number | null;
  height: number | null;
};

export type Manifest = {
  images: ManifestEntry[];
};

export async function readManifest(dir: string): Promise<Manifest> {
  try {
    const out = await s3().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `${dir}/manifest.json` }),
    );
    const text = await out.Body?.transformToString();
    const parsed = JSON.parse(text || "{}");
    if (Array.isArray(parsed.images)) return { images: parsed.images };
  } catch {
    // fehlt oder kaputt → leeres Manifest
  }
  return { images: [] };
}

async function writeManifest(dir: string, manifest: Manifest): Promise<void> {
  manifest.images.sort((a, b) => a.file.localeCompare(b.file, "de"));
  await putObject(
    `${dir}/manifest.json`,
    JSON.stringify(manifest, null, 2),
    "application/json",
  );
}

export async function upsertManifestEntry(
  dir: string,
  entry: ManifestEntry,
): Promise<void> {
  const manifest = await readManifest(dir);
  manifest.images = manifest.images.filter((e) => e.file !== entry.file);
  manifest.images.push(entry);
  await writeManifest(dir, manifest);
}

export async function removeManifestEntry(
  dir: string,
  file: string,
): Promise<void> {
  const manifest = await readManifest(dir);
  const before = manifest.images.length;
  manifest.images = manifest.images.filter((e) => e.file !== file);
  if (manifest.images.length !== before) await writeManifest(dir, manifest);
}
