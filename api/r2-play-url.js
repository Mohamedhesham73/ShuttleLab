// GET /api/r2-play-url?key=videos/...  → short-lived presigned GET URL for playback.
// Auth required (any signed-in user). Used only when the bucket is private.
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, BUCKET } from "./_lib/r2.js";
import { verifyAuth } from "./_lib/firebaseAdmin.js";

export default async function handler(req, res){
  try{
    await verifyAuth(req);
    const key = req.query.key;
    if(!key || !/^videos\/[A-Za-z0-9._-]+$/.test(key)){ res.status(400).json({ error: "Bad key" }); return; }
    const url = await getSignedUrl(r2(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
    res.status(200).json({ url });
  }catch(e){
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
}
