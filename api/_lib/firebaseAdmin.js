// Verifies Firebase ID tokens inside Vercel functions and tells us who is a coach.
import admin from "firebase-admin";

function app(){
  if(admin.apps.length) return admin;
  // FIREBASE_SERVICE_ACCOUNT is the full service-account JSON, stored as one env var.
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin;
}

// Throws {status:401} if the Authorization: Bearer <idToken> header is missing/invalid.
export async function verifyAuth(req){
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer (.+)$/.exec(h);
  if(!m){ const e = new Error("Missing auth token"); e.status = 401; throw e; }
  try{
    return await app().auth().verifyIdToken(m[1]);   // { uid, email, role?, ... }
  }catch(err){
    const e = new Error("Invalid auth token"); e.status = 401; throw e;
  }
}

// Coach = has role:"coach" custom claim, OR email is in COACH_EMAILS (comma-separated).
export function isCoach(decoded){
  if(decoded && decoded.role === "coach") return true;
  const list = (process.env.COACH_EMAILS || "").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
  return !!(decoded && decoded.email && list.includes(String(decoded.email).toLowerCase()));
}
