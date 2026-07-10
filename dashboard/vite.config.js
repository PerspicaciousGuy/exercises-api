import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const DEV_PORT = 5173;

export default defineConfig({
  plugins: [vue()],
  server: {
    port: DEV_PORT,
    // The design system lives in website/ and is imported from there rather
    // than copied. Vite refuses to serve files above the project root without
    // this. See dashboard/src/styles/tokens.css.
    fs: { allow: ['..'] }
  }
});
