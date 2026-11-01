// vite.config.js
import { defineConfig } from 'vite';
import rtlint from 'rtlint/vite';

export default defineConfig({
  plugins: [rtlint({ lang: 'fa', failOnError: true })],
});
