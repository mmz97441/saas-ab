import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter '' allows loading all env vars, not just VITE_ ones.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // CRITICAL: Vercel/Vite Integration
  // We prioritize the key found in this order.
  // Added VITE_GOOGLE_API_KEY to match your specific .env configuration.
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false
    },
    define: {
      // Polyfill process.env.API_KEY for the browser
      // We explicitly define ONLY this key to avoid leaking other server-side secrets.
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});