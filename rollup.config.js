import ts from 'rollup-plugin-typescript2';
import cjs from 'rollup-plugin-commonjs';
import pkg from './package.json';

export default {
  input: 'src/main.ts',
  plugins: [
    cjs(),
    ts(),
  ],
  output: {
    file: pkg.main,
    format: 'cjs',
  },
  exports: 'default',
};
