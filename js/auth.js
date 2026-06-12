import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function signIn(email, pw){ return signInWithEmailAndPassword(auth, email, pw); }
export function signOutUser(){ return signOut(auth); }
export function watchAuth(cb){ return onAuthStateChanged(auth, cb); }
