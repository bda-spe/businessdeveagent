import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * S3-compatible object storage. Works unmodified against Supabase Storage,
 * Cloudflare R2, or AWS S3 — set STORAGE_ENDPOINT/STORAGE_REGION accordingly.
 * Replaces the previous Replit-sidecar GCS integration, which only worked
 * inside a Replit container.
 *
 * Layout inside the bucket:
 *   uploads/<uuid>   — private entity uploads (served via /api/storage/objects/*)
 *   public/<path>    — public assets (served via /api/storage/public-objects/*)
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add your storage provider credentials — see .env.example.`,
    );
  }
  return value;
}

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.STORAGE_REGION || "auto",
      endpoint: requiredEnv("STORAGE_ENDPOINT"),
      credentials: {
        accessKeyId: requiredEnv("STORAGE_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("STORAGE_SECRET_ACCESS_KEY"),
      },
      // Required for Supabase Storage / R2's S3-compatible endpoints.
      forcePathStyle: true,
    });
  }
  return s3Client;
}

function getBucket(): string {
  return requiredEnv("STORAGE_BUCKET");
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface StoredObject {
  key: string;
}

export class ObjectStorageService {
  constructor() {}

  /**
   * Presigned PUT URL for a fresh private upload. Expires in 15 minutes.
   * Binding contentType into the signature means S3 rejects the upload if
   * the client actually PUTs a different Content-Type than it declared to
   * the request-url endpoint, closing the gap between declared and real
   * upload metadata.
   */
  async getObjectEntityUploadURL(contentType?: string): Promise<string> {
    const key = `uploads/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    });
    return getSignedUrl(getClient(), command, { expiresIn: 900 });
  }

  /** Turns a presigned upload URL (or a stored object URL) into the app-facing `/objects/<id>` path. */
  normalizeObjectEntityPath(rawUrl: string): string {
    let pathname: string;
    try {
      pathname = new URL(rawUrl).pathname;
    } catch {
      // Already a plain path (e.g. "/objects/<id>") — nothing to normalize.
      return rawUrl;
    }
    const bucket = getBucket();
    const parts = pathname.split("/").filter(Boolean);
    const withoutBucket = parts[0] === bucket ? parts.slice(1) : parts;
    const key = withoutBucket.join("/");
    const entityId = key.startsWith("uploads/") ? key.slice("uploads/".length) : key;
    return `/objects/${entityId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) {
      throw new ObjectNotFoundError();
    }
    const key = `uploads/${entityId}`;
    try {
      await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    } catch {
      throw new ObjectNotFoundError();
    }
    return { key };
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    const key = `public/${filePath}`;
    try {
      await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
      return { key };
    } catch {
      return null;
    }
  }

  async downloadObject(file: StoredObject, cacheTtlSec: number = 3600): Promise<Response> {
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: file.key }),
    );

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType || "application/octet-stream",
      "Cache-Control": `private, max-age=${cacheTtlSec}`,
    };
    if (result.ContentLength) {
      headers["Content-Length"] = String(result.ContentLength);
    }

    const webStream = result.Body!.transformToWebStream() as ReadableStream;
    return new Response(webStream, { headers });
  }
}
