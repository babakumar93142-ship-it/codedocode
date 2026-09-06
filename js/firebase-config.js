// ===== CodeGuru — Firebase config =====
// Ye values apne Firebase project se lo:
// Firebase Console -> Project Settings -> General -> "Your apps" -> Web app -> Config

export const firebaseConfig = {
  apiKey: "AIzaSyAb-U-kwJdmR9hGwo0RGB7zFQaq6gnbJXY",
  authDomain: "codeguru-c4179.firebaseapp.com",
  projectId: "codeguru-c4179",
  storageBucket: "codeguru-c4179.firebasestorage.app",
  messagingSenderId: "645429806529",
  appId: "1:645429806529:web:e1a0fe7bc532491f969b40"
};

// Admin ka email yaha daalo — yehi account "admin" bankar
// dusre users ko suspend/delete kar payega (Firestore rules bhi
// isi email ko match karke check karte hain, README dekho).
export const ADMIN_EMAIL = "babakumar93142@gmail.com";
