import { auth } from "./firebase.js";
import { USERS } from "./config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Map a signed-in Firebase user (by email) to our roster entry in config.js.
export function userFromEmail(email){
  if(!email) return null;
  const e = String(email).trim().toLowerCase();
  return USERS.find(u => String(u.email).toLowerCase() === e) || null;
}

export function signIn(email, pw){ return signInWithEmailAndPassword(auth, email, pw); }
export function signOutUser(){ return signOut(auth); }
export function watchAuth(cb){ return onAuthStateChanged(auth, cb); }
