import { defineConfig } from 'astro/config';

// Served from GitHub Pages at https://kazimkayhan.github.io/resume/
export default defineConfig({
  site: 'https://kazimkayhan.github.io',
  base: '/resume',
  build: { inlineStylesheets: 'always' },
});
