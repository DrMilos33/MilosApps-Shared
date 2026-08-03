import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const base = process.env.MILOSAPP_BASE ?? '/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error('MILOSAPP_BASE must begin and end with a slash.');
}

const strictCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  preview: {
    headers: {
      'Content-Security-Policy': strictCsp,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['./tests/unit/**/*.test.{ts,tsx}'],
  },
});
