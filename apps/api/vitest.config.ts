import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // *.emulator-spec.ts needs the Firebase emulators running (pnpm emulators),
    // so it is opt-in via `pnpm test:rules` rather than part of the default run.
    include: ['src/**/*.spec.ts'],
  },
});
