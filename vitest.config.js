import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js', 'proxy/tests/**/*.test.js'],
    coverage: {
      include: [
        'src/**/*.{js,ts}',
        'proxy/src/**/*.{js,ts}',
      ],
      exclude: [
        'src/content/index.{js,ts}',
        'src/shared/types/**/*.ts',
        'proxy/src/types.ts',
      ],
    },
  },
});
