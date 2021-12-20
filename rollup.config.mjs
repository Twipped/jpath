import babel from 'rollup-plugin-babel';
import banner_ from 'rollup-plugin-banner';
const banner = banner_.default;

import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bannerConfig = {
  file: join(__dirname, 'LICENSE.txt'),
};

const external = [
  '@twipped/utils',
];

export default [

  {
    input: 'src/dist.js',
    output: {
      file: 'dist/jpath.cjs.js',
      format: 'cjs',
      exports: 'default',
    },
    plugins: [
      babel(),
      banner(bannerConfig),
    ],
    external,
  },

  {
    input: 'src/index.js',
    output: {
      file: 'dist/jpath.esm.js',
      format: 'esm',
    },
    plugins: [
      babel(),
      banner(bannerConfig),
    ],
    external,
  },
];
