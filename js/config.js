// =============================================================
//  CONFIG — this is the only file you normally need to edit.
// =============================================================

// Your Firebase project (safe to be public; the database is protected by rules).
export const firebaseConfig = {
  apiKey: "AIzaSyDC2bqyeM1uShkQhXHKvYqAZcbLo0N0sSQ",
  authDomain: "shuttlelab-174d2.firebaseapp.com",
  projectId: "shuttlelab-174d2",
  storageBucket: "shuttlelab-174d2.firebasestorage.app",
  messagingSenderId: "656602827962",
  appId: "1:656602827962:web:2f6449279253b9b4e60683"
};

// -------------------------------------------------------------
//  THE TEAM now lives in Firestore (the "members" collection), NOT here,
//  so no names, roles, or emails are shipped to the browser / DevTools.
//  The app loads the roster after login (see js/app.js → loadMembers()).
//
//  One-time setup in Firebase Console → Firestore → "members" collection:
//  add one document PER PERSON, where the Document ID is that person's
//  Firebase Auth UID (Authentication → Users → "User UID"), with fields:
//    id    (number)  e.g. 1            — the stable app id used everywhere
//    name  (string)  e.g. "H"
//    role  (string)  "player" or "coach"
//    photo (string)  e.g. "imgs/H.jpeg"  (optional)
// -------------------------------------------------------------

// -------------------------------------------------------------
//  THE TESTS. Add or change tests here.
//  higher:true  -> a bigger number is better (jumps, beep level)
//  higher:false -> a smaller number is better (times)
//  multi:true   -> several attempts; the app keeps the best + average
// -------------------------------------------------------------
export const TESTS = [
  { id:"beep",   name:"Beep test",                   unit:"level", higher:true,  multi:false },
  { id:"vjump",  name:"Vertical jump",               unit:"cm",    higher:true,  multi:true  },
  { id:"ljump",  name:"Standing long jump",          unit:"cm",    higher:true,  multi:true  },
  { id:"inout",  name:"In-out agility",              unit:"s",     higher:false, multi:true  },
  { id:"fbcourt",name:"Forward & backward court",    unit:"s",     higher:false, multi:true  },
  { id:"fhbh",   name:"Forehand & backhand defense", unit:"s",     higher:false, multi:true  },
];

// Max video upload size (MB). Enforced client-side and in the Vercel API.
export const MAX_UPLOAD_MB = 500;
