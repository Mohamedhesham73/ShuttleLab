import { state } from "./core.js";
import { getVapidPublicKey, savePushSub, removePushSub } from "./data.js";

function urlB64ToUint8(base64){
  const pad = "=".repeat((4 - base64.length % 4) % 4);
  const b = (base64 + pad).replace(/-/g,"+").replace(/_/g,"/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
const supported = ()=> "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isStandalone = ()=> window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = ()=> /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function pushState(){
  if(!supported()) return "unsupported";
  if(Notification.permission === "denied") return "denied";
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  }catch(e){ return "off"; }
}
export async function enablePush(){
  if(!supported()) return { ok:false, reason: (isIOS() && !isStandalone()) ? "ios-install" : "unsupported" };
  const perm = await Notification.requestPermission();
  if(perm !== "granted") return { ok:false, reason:"denied" };
  const reg = await navigator.serviceWorker.ready;
  const key = await getVapidPublicKey();
  if(!key) return { ok:false, reason:"no-key" };
  const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(key) });
  await savePushSub(state.uid, state.user.id, sub.toJSON());
  return { ok:true };
}
export async function disablePush(){
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if(sub){ try{ await removePushSub(state.uid, sub.toJSON()); }catch(e){} await sub.unsubscribe(); }
  }catch(e){}
  return { ok:true };
}
