import { vitePreprocess as preprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  preprocess: [
    preprocess({
      scss: {
        prependData: '@use "src/variables.scss" as *;',
      },
    }),
  ],
};

export default config;
