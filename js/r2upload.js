// Direct-to-R2 upload from the browser.
//  1) cheap fingerprint of the file → dedupe + stable key
//  2) ask our Vercel API for a presigned PUT URL (auth + coach enforced there)
//  3) PUT the file straight to R2 with real progress
import { auth } from "./firebase.js";
import { MAX_UPLOAD_MB } from "./config.js";
import { findVideoByHash } from "./data.js";

// A light fingerprint (name+size+modified) — cheap on huge files and on mobile,
// and enough to stop the same clip being uploaded twice.
async function fingerprint(file){
  const basis = [file.name, file.size, file.lastModified].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0, 40);
}

function putWithProgress(url, file, contentType, onProgress){
  return new Promise((resolve, reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = e => { if(onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = ()=> (xhr.status>=200 && xhr.status<300) ? resolve() : reject(new Error("R2 upload failed ("+xhr.status+")"));
    xhr.onerror = ()=> reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

// Returns { key, url, hash, deduped }
export async function uploadToR2(file, { onProgress } = {}){
  const maxBytes = (MAX_UPLOAD_MB || 500) * 1024 * 1024;
  if(file.size > maxBytes) throw new Error("That file is " + Math.round(file.size/1048576) + " MB — the limit is " + MAX_UPLOAD_MB + " MB.");

  const hash = await fingerprint(file);

  // Avoid duplicate uploads — reuse an identical clip already in the library.
  try{
    const existing = await findVideoByHash(hash);
    if(existing && existing.source && existing.source.key){
      if(onProgress) onProgress(1);
      return { key: existing.source.key, url: existing.source.url || null, hash, deduped: true };
    }
  }catch(e){ /* dedupe is best-effort */ }

  const ext = ((file.name.match(/\.([A-Za-z0-9]+)$/) || [, "mp4"])[1] || "mp4").toLowerCase();
  const key = "videos/" + hash + "." + ext;
  const contentType = file.type || "video/mp4";

  const user = auth.currentUser;
  if(!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken();

  const r = await fetch("/api/r2-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ key, contentType, size: file.size })
  });
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    if(r.status === 403) throw new Error("You don't have permission to upload.");
    throw new Error("Couldn't start upload (" + r.status + "). " + t);
  }
  const { uploadUrl, key: outKey, publicUrl } = await r.json();

  await putWithProgress(uploadUrl, file, contentType, onProgress);
  return { key: outKey, url: publicUrl || null, hash, deduped: false };
}
