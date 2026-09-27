import { defineConfig } from 'astro/config';

// GitHub Pages: https://latifkedi.github.io/athena/
export default defineConfig({
  site: 'https://latifkedi.github.io',
  base: '/athena',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
