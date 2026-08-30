import { Injectable, OnModuleInit } from '@nestjs/common';
import { App, initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK access to Firestore.
 *
 * Locally this talks to the Firestore emulator: the Admin SDK picks up
 * FIRESTORE_EMULATOR_HOST automatically and skips credentials entirely, so no
 * service-account key is needed (and none should ever be committed).
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: App;
  db!: Firestore;

  onModuleInit() {
    const projectId = process.env.GCP_PROJECT_ID ?? 'plotkraft-agentic';
    const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

    this.app =
      getApps()[0] ??
      initializeApp({
        projectId,
        ...(useEmulator ? {} : { credential: applicationDefault() }),
      });

    this.db = getFirestore(this.app);
    if (useEmulator) {
      // eslint-disable-next-line no-console
      console.log(`[firebase] using emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
    }
  }
}
