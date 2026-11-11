import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

export interface StoredMediaItem {
  mediaId: string;
  contentType: string;
  buffer: Buffer;
  phash: string;
  createdAt: Date;
  publicUrl?: string;
}

export class MediaStore {
  private readonly storageDir: string;
  private readonly cache = new Map<string, StoredMediaItem>();

  constructor(storageDir?: string) {
    this.storageDir = storageDir ?? path.resolve(process.cwd(), "data", "media");
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[caterlog:media-store] Could not create storage directory:", err);
    }
  }

  /**
   * Computes a 64-bit hexadecimal difference hash (`dHash`) using `sharp`.
   * Identical or WhatsApp-compressed versions of the same photo yield Hamming distance <= 8.
   */
  public async computePhash(buffer: Buffer): Promise<string> {
    try {
      const { data } = await sharp(buffer)
        .resize(9, 8, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let hashBigInt = 0n;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const left = data[row * 9 + col];
          const right = data[row * 9 + col + 1];
          hashBigInt = (hashBigInt << 1n) | (left > right ? 1n : 0n);
        }
      }
      return hashBigInt.toString(16).padStart(16, "0");
    } catch {
      // Fallback deterministic block hash for non-decodable buffers
      return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    }
  }

  /**
   * Saves a binary image buffer, computes its perceptual hash, and persists it.
   */
  public async saveMedia(params: {
    buffer: Buffer;
    contentType?: string;
    mediaId?: string;
    publicUrl?: string;
  }): Promise<StoredMediaItem> {
    const contentType = params.contentType || "image/jpeg";
    const mediaId = params.mediaId || `med_${crypto.randomBytes(8).toString("hex")}`;
    const phash = await this.computePhash(params.buffer);

    const item: StoredMediaItem = {
      mediaId,
      contentType,
      buffer: params.buffer,
      phash,
      createdAt: new Date(),
      publicUrl: params.publicUrl,
    };

    this.cache.set(mediaId, item);

    try {
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filePath = path.join(this.storageDir, `${mediaId}.${ext}`);
      fs.writeFileSync(filePath, params.buffer);
    } catch {
      // Memory cache remains active if disk write is not permitted
    }

    return item;
  }

  /**
   * Resolves a public, globally fetchable HTTPS URL for a media item so Meta's
   * Commerce Catalog crawler can ingest the vendor's actual photo.
   */
  public async getPublicUrl(mediaId: string): Promise<string | null> {
    const item = this.getMedia(mediaId);
    if (!item) return null;
    if (item.publicUrl) return item.publicUrl;

    // 1. Check if public tunnel or domain is configured
    const tunnelUrl = process.env.PUBLIC_API_URL || process.env.TUNNEL_URL || process.env.API_BASE_URL;
    if (tunnelUrl && /^https?:\/\//i.test(tunnelUrl) && !/localhost|127\.0\.0\.1/i.test(tunnelUrl)) {
      const publicBase = tunnelUrl.replace(/\/+$/, "");
      item.publicUrl = `${publicBase}/api/v1/media/${encodeURIComponent(mediaId)}`;
      return item.publicUrl;
    }

    // 2. Local development fallback: upload real image buffer to Catbox for permanent HTTPS direct URL
    try {
      const form = new FormData();
      form.append("reqtype", "fileupload");
      const ext = item.contentType.includes("png") ? "png" : item.contentType.includes("webp") ? "webp" : "jpg";
      form.append(
        "fileToUpload",
        new Blob([item.buffer], { type: item.contentType }),
        `${mediaId}.${ext}`
      );
      const res = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const url = (await res.text()).trim();
        if (/^https?:\/\//i.test(url)) {
          item.publicUrl = url;
          return url;
        }
      }
    } catch (err) {
      console.warn(`[caterlog:media-store] Could not upload media ${mediaId} to public host:`, err);
    }

    return null;
  }

  /**
   * Fast synchronous lookup of a media item's perceptual hash.
   */
  public getPhash(mediaId: string): string | undefined {
    return this.cache.get(mediaId)?.phash;
  }

  /**
   * Parses a Data URL (e.g. from browser file upload) and saves it as a media file.
   */
  public async saveDataUrl(dataUrl: string, mediaId?: string): Promise<StoredMediaItem | null> {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    return this.saveMedia({ buffer, contentType, mediaId });
  }

  /**
   * Downloads an external image URL, caches it, and computes its perceptual hash.
   */
  public async saveFromUrl(url: string, mediaId?: string): Promise<StoredMediaItem | null> {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Caterlog/1.0" } });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const arrayBuf = await res.arrayBuffer();
      return this.saveMedia({ buffer: Buffer.from(arrayBuf), contentType, mediaId });
    } catch {
      return null;
    }
  }

  /**
   * Retrieves a stored media item by its ID.
   */
  public getMedia(mediaId: string): StoredMediaItem | null {
    const cached = this.cache.get(mediaId);
    if (cached) return cached;

    // Try reading from disk
    try {
      const possibleExtensions = ["jpg", "jpeg", "png", "webp"];
      for (const ext of possibleExtensions) {
        const filePath = path.join(this.storageDir, `${mediaId}.${ext}`);
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
          const phash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
          const item: StoredMediaItem = {
            mediaId,
            contentType,
            buffer,
            phash,
            createdAt: new Date(),
          };
          this.cache.set(mediaId, item);
          return item;
        }
      }
    } catch {
      // Return null on failure
    }

    return null;
  }
}

export const mediaStore = new MediaStore();
