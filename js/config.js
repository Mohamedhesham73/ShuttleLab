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

// Coach contact for the Mind Room "talk to coach" button. Put the WhatsApp
// number in full international form, digits only (e.g. "201001234567" for
// Egypt). Leave whatsapp "" to hide the button.
export const COACH_CONTACT = { name: "Coach Ahmed", whatsapp: "" };

// -------------------------------------------------------------
//  TOURNAMENT CALENDAR (2026 season). Reference data the coach
//  picks from per player on the Training page. Dates are ISO
//  (YYYY-MM-DD). place "TBD" = to be announced.
// -------------------------------------------------------------
export const TOURNAMENTS = [
  { id:"t1",  name:"Air Badminton Challenge",            cats:"Open · U15",                 start:"2026-06-25", end:"2026-06-27", place:"TBD" },
  { id:"t2",  name:"2nd Challenge — U17 & U19",          cats:"Singles · Doubles · Mixed",  start:"2026-07-30", end:"2026-08-01", place:"TBD" },
  { id:"t3",  name:"2nd Challenge — U11 & U15",          cats:"U11 Singles · U15 S/D/Mixed",start:"2026-08-06", end:"2026-08-08", place:"TBD" },
  { id:"t4",  name:"1st Challenge — Open",               cats:"Singles · Doubles · Mixed",  start:"2026-08-13", end:"2026-08-15", place:"TBD" },
  { id:"t5",  name:"Republic Championship — U17 & U19",  cats:"Singles · Doubles · Mixed",  start:"2026-08-20", end:"2026-08-22", place:"TBD" },
  { id:"t6",  name:"2nd Challenge — U13",                cats:"Singles · Doubles · Mixed",  start:"2026-08-28", end:"2026-08-29", place:"TBD" },
  { id:"t7",  name:"2nd Challenge — Open",               cats:"Singles · Doubles · Mixed",  start:"2026-10-29", end:"2026-10-31", place:"TBD" },
  { id:"t8",  name:"Republic Championship — U11 & U15",  cats:"U11 Singles · U15 S/D/Mixed",start:"2026-11-05", end:"2026-11-07", place:"TBD" },
  { id:"t9",  name:"Republic Para-Badminton & +35",      cats:"Singles · Doubles · Mixed",  start:"2026-11-13", end:"2026-11-14", place:"TBD" },
  { id:"t10", name:"Republic Championship — U13",        cats:"Singles · Doubles · Mixed",  start:"2026-11-20", end:"2026-11-21", place:"TBD" },
  { id:"t11", name:"Republic Championship — Open",       cats:"Singles · Doubles · Mixed",  start:"2026-11-26", end:"2026-11-28", place:"TBD" },
];
