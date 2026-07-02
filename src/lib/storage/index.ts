/**
 * Tiny storage seam so uploads (org logos today, more later) don't hard-code a
 * backend. The default adapter encodes small assets as `data:` URIs — no bucket
 * needed, works under the existing CSP (`img-src data:`) and renders in the
 * receipt PDF. Swap in S3/R2 later by implementing StorageProvider and switching
 * on STORAGE_PROVIDER, with zero changes at the call sites.
 */

export type StoredAsset = {
  /** A URL usable directly in <img src>, @react-pdf <Image>, or email HTML. */
  url: string;
};

export interface StorageProvider {
  readonly name: string;
  /** Persist bytes and return a servable URL. `key` is a caller hint (e.g. org id). */
  put(key: string, bytes: Buffer, contentType: string): Promise<StoredAsset>;
}

class DataUriStorage implements StorageProvider {
  readonly name = "data-uri";
  async put(_key: string, bytes: Buffer, contentType: string): Promise<StoredAsset> {
    return { url: `data:${contentType};base64,${bytes.toString("base64")}` };
  }
}

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) return provider;
  switch (process.env.STORAGE_PROVIDER) {
    // case "s3": provider = new S3Storage(); break;
    case "data-uri":
    default:
      provider = new DataUriStorage();
  }
  return provider;
}
