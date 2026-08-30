'use client';

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, USE_EMULATORS } from './firebase';

/**
 * Local shortcut past the Google popup.
 *
 * The Auth emulator fakes the Google provider, so its picker starts empty and has
 * to be filled in by hand on every fresh emulator run. This signs in a fixed local
 * user instead. It is compiled out of any build that is not pointed at the
 * emulators, so it cannot become a production back door.
 */
const DEV_USER = { email: 'writer@plotkraft.local', password: 'plotkraft-dev' };

async function devSignIn() {
  if (!USE_EMULATORS) throw new Error('Dev sign-in is only available against the emulators');
  try {
    return await signInWithEmailAndPassword(auth(), DEV_USER.email, DEV_USER.password);
  } catch {
    // First run on a fresh emulator: the account does not exist yet.
    return createUserWithEmailAndPassword(auth(), DEV_USER.email, DEV_USER.password);
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth(), (u) => { setUser(u); setLoading(false); }), []);

  return {
    user,
    loading,
    signIn: () => signInWithPopup(auth(), googleProvider),
    /** Only offered when running against the emulators. */
    devSignIn: USE_EMULATORS ? devSignIn : undefined,
    signOutUser: () => signOut(auth()),
  };
}
