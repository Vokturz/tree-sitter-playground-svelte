import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';

const production = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        typescript: {
          transpileOnly: !production,
        },
      }),
    }),
    typescript({
      sourceMap: !production,
    }),
  ],
  server: {
    fs: {
      strict: false,
    },
  },
});
