// POST /api/r2-upload-url  → returns a short-lived presigned PUT URL for R2.
// Auth required; coaches only. The browser then uploads the file straight to R2.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, BUCKET, PUBLIC_BASE } from "./_lib/r2.js";
import { verifyAuth, isCoach } from "./_lib/firebaseAdmin.js";

export default async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).json({ error: "Method not allowed" }); return; }
  try{
    const decoded = await verifyAuth(req);
    if(!isCoach(decoded)){ res.status(403).json({ error: "Coaches only" }); return; }

    const { key, contentType, size } = req.body || {};
    if(!key || !/^videos\/[A-Za-z0-9._-]+$/.test(key)){ res.status(400).json({ error: "Bad key" }); return; }

    const maxBytes = (parseInt(process.env.MAX_UPLOAD_MB || "500", 10)) * 1024 * 1024;
    if(size && Number(size) > maxBytes){ res.status(413).json({ error: "File too large" }); return; }

    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType || "video/mp4" });
    const uploadUrl = await getSignedUrl(r2(), cmd, { expiresIn: 600 }); // 10 min
    const publicUrl = PUBLIC_BASE ? (PUBLIC_BASE.replace(/\/+$/, "") + "/" + key) : null;

    res.status(200).json({ uploadUrl, key, publicUrl });
  }catch(e){
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
}
