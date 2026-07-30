import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ?.split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const localServerPort = env.LOCAL_SERVER_PORT || '8787';
  const useNgrokHmr = env.VITE_USE_NGROK_HMR === 'true' && Boolean(env.VITE_NGROK_HOST);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: allowedHosts?.length ? allowedHosts : true,
      proxy: {
        '/api': {
          target: `http://localhost:${localServerPort}`,
          changeOrigin: true,
        },
      },
      hmr: env.DISABLE_HMR === 'true'
        ? false
        : useNgrokHmr
          ? { protocol: 'wss', host: env.VITE_NGROK_HOST, clientPort: 443 }
          : true,
    },
  };
});
