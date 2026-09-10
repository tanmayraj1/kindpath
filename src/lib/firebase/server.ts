import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin initialisation.
 *
 * NOTE: firebase-admin v13+ dropped the `import * as admin` namespace surface
 * (`admin.apps`, `admin.credential`, `admin.auth()`), which is why this uses the
 * modular entry points instead — the namespace form compiles against v12 and
 * older only, and broke `npm run build` on main.
 *
 * The credential comes from FIREBASE_SERVICE_ACCOUNT (a JSON string) and from
 * nowhere else. There is deliberately no fallback to a service-account file on
 * disk: one was committed to this public repository on 2026-08-31 and had to be
 * revoked, and a code path that reads such a file is an invitation to recreate
 * it. `.gitignore` blocks the filename for the same reason.
 *
 * Nothing imports this module yet. Note also that KindPath's own `adminDb` (the
 * Prisma client in src/lib/db.ts) is used throughout the app — importing the
 * `adminDb` exported here in its place would hand a Firestore handle to code
 * expecting Prisma.
 */
let app: App | undefined;

function firebaseApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length) {
    app = existing[0];
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set — it must contain the service-account JSON as a string."
    );
  }

  app = initializeApp({
    credential: cert(JSON.parse(raw)),
    databaseURL: "https://kindpath-a0e86.firebaseio.com",
  });
  return app;
}

/**
 * Lazily resolved so that merely importing this module cannot throw at build
 * time on an instance that has no Firebase credentials configured — which is
 * every instance today.
 */
export const adminAuth = () => getAuth(firebaseApp());
export const adminFirestore = () => getFirestore(firebaseApp());

export default firebaseApp;
