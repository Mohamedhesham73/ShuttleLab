// GET /api/vapid-public -> { key } : the (non-secret) VAPID public key for the client.
export default function handler(req, res){
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || "" });
}
