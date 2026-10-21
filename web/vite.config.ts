import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
const rootDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, rootDir, '');
  const target = env.API_PROXY_TARGET || process.env.API_PROXY_TARGET;
  if (command === 'serve' && !isPreview && !target)
    throw new Error(
      'Set API_PROXY_TARGET in web/.env.local. See web/.env.example.',
    );
  const proxy = target
    ? {
        '/api': { target },
        '/uploads': { target },
        '/avatars': { target },
        '/socket.io': { target, ws: true },
      }
    : undefined;
  return {
    plugins: [
      TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { '@': path.resolve(rootDir, './src') } },
    server: { port: 5173, proxy },
    preview: { port: 4173, host: true, proxy },
  };
});
