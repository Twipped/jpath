import resolve from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import banner from 'rollup-plugin-banner';
import { join } from 'path';

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
      resolve({
        preferBuiltins: true,
      }),
      babel({
        exclude: 'node_modules/**',
        presets: [
          [ '@babel/preset-env', {
            modules: false,
            useBuiltIns: 'usage',
            corejs: { version: 3, shippedProposals: true },
            targets: {
              node: '12',
            },
          } ],
        ],
      }),
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
      resolve({
        preferBuiltins: true,
      }),
      babel({
        exclude: 'node_modules/**',
        presets: [
          [ '@babel/preset-env', {
            modules: false,
            useBuiltIns: 'usage',
            corejs: { version: 3, shippedProposals: true },
            targets: {
              node: '12',
            },
          } ],
        ],
      }),
      banner(bannerConfig),
    ],
    external,
  },

  {
    input: 'src/index.js',
    output: {
      file: 'dist/jpath.browser.js',
      format: 'umd',
      exports: 'named',
      name: 'JPath',
    },
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      babel({
        exclude: 'node_modules/**',
        presets: [
          [ '@babel/preset-env', {
            modules: false,
            useBuiltIns: 'usage',
            corejs: { version: 3, shippedProposals: true },
          } ],
        ],
      }),
      terser({ output: {
        comments: false,
      } }),
      banner(bannerConfig),
    ],
    external,
  },
];
