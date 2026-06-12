// POST /api/r2-delete  { keys: ["videos/...", ...] }  → deletes those objects.
// Auth required; coaches only. Used to clean up R2 when a video (and its voice
// notes) is deleted, so the bucket doesn't fill with orphaned files.
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET } from "./_lib/r2.js";
import { verifyAuth, isCoach } from "./_lib/firebaseAdmin.js";

export default async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).json({ error: "Method not allowed" }); return; }
  try{
    const decoded = await verifyAuth(req);
    if(!isCoach(decoded)){ res.status(403).json({ error: "Coaches only" }); return; }

    const keys = (req.body && Array.isArray(req.body.keys)) ? req.body.keys : [];
    const valid = keys.filter(k => typeof k === "string" && /^videos\/[A-Za-z0-9._-]+$/.test(k));
    const client = r2();
    await Promise.all(valid.map(Key =>
      client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key })).catch(()=>null)
    ));
    res.status(200).json({ deleted: valid.length });
  }catch(e){
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
}
