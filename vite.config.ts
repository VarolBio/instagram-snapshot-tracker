import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Project site lives at https://<user>.github.io/instagram-snapshot-tracker/
  base: '/instagram-snapshot-tracker/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
