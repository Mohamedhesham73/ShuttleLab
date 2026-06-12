// Cloudflare R2 client (S3-compatible). Keys come ONLY from server env vars.
import { S3Client } from "@aws-sdk/client-s3";

export const BUCKET = process.env.R2_BUCKET;
// Optional public base (custom domain / r2.dev) — only set if you make the bucket public.
export const PUBLIC_BASE = process.env.R2_PUBLIC_BASE || "";

export function r2(){
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}
