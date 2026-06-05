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
//  THE TEAM. Give each person a FAKE email + password (not real
//  Gmail logins). role is "player" or "coach". The coach sees
//  everyone and writes training; players see only themselves.
//  photo is optional — put files in an "imgs" folder, or delete
//  the photo line and it shows the person's initial.
// -------------------------------------------------------------
export const USERS = [
  { id: 1, name: "H",                role: "player", email: "h@shuttlelab.app",      password: "h-1234",     photo: "imgs/H.jpeg" },
  { id: 2, name: "KOKA",             role: "player", email: "koka@shuttlelab.app",   password: "koka-1234",  photo: "imgs/KOKA.jpeg" },
  { id: 3, name: "Mahmoud",          role: "player", email: "mahmoud@shuttlelab.app",password: "mah-1234",   photo: "imgs/Mahmoud.jpeg" },
  { id: 4, name: "Alya El Ghandour", role: "player", email: "alya@shuttlelab.app",   password: "alya-1234",  photo: "imgs/Alya.jpeg" },
  { id: 9, name: "Ahmed Salah",      role: "coach",  email: "coach@shuttlelab.app",  password: "coach-1234", photo: "imgs/Coach.jpeg" },
];

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
