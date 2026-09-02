'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
const useEmulators = USE_EMULATORS;

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'plotkraft-agentic.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'plotkraft-agentic',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'plotkraft-agentic-assets',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'demo-app',
};

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

function ensureApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function auth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return authInstance;
}

export function db(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp());
    if (useEmulators) connectFirestoreEmulator(dbInstance, '127.0.0.1', 8181);
  }
  return dbInstance;
}

export function storage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(ensureApp(), `gs://${config.storageBucket}`);
    if (useEmulators) connectStorageEmulator(storageInstance, '127.0.0.1', 9199);
  }
  return storageInstance;
}

export const googleProvider = new GoogleAuthProvider();

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8088';
