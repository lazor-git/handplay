import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  base: '/handplay/',
  server: { host: true, port: 5173 },
});
