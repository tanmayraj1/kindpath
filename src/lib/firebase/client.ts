import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtPYZkWOAx-NdqTVazGeJcOaMHU51OULQ",
  authDomain: "kindpath-a0e86.firebaseapp.com",
  projectId: "kindpath-a0e86",
  storageBucket: "kindpath-a0e86.firebasestorage.app",
  messagingSenderId: "729912280158",
  appId: "1:729912280158:web:e7ab4c1bd010887225a0cf"
};

// Initialize Firebase (only once to avoid re-initialization errors in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
