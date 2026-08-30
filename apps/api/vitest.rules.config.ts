import { defineConfig } from 'vitest/config';

/** Rules tests run against the Firebase emulators — start them with `pnpm emulators`. */
export default defineConfig({
  test: {
    include: ['src/**/*.emulator-spec.ts'],
    testTimeout: 20_000,
  },
});
