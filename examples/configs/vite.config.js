// vite.config.js
import { defineConfig } from 'vite';
import rtlint from '@pouyam/rtlint/vite';

export default defineConfig({
  plugins: [rtlint({ lang: 'fa', failOnError: true })],
});
