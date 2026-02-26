import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/next/index.ts',
    'src/otel/index.ts',
    'src/ai-sdk/index.ts',
    'src/query/index.ts',
    'src/ui/index.tsx',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
  external: ['next', 'react', 'react-dom'],
});
