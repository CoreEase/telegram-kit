import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

function prependUseClient(files: string[]): void {
  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    if (!content.startsWith('"use client"')) {
      writeFileSync(file, '"use client";\n' + content);
    }
  }
}

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      'hooks/index': 'src/react/hooks.ts',
      'animation/index': 'src/ui/animation.ts',
      'animation/lottie/index': 'src/ui/lottie.tsx',
      'animation/tgs/index': 'src/ui/tgs.tsx',
      'tgs/index': 'src/ui/tgs.tsx',
      'lottie/index': 'src/ui/lottie.tsx',
    },
    format: ['cjs', 'esm'],
    dts: true,
    external: ['react', 'react-dom', 'node:crypto', 'crypto'],
    clean: true,
    treeshake: true,
    target: 'es2017',
    async onSuccess() {
      const dist = 'dist';
      const entryFiles = [
        join(dist, 'index.js'),
        join(dist, 'index.mjs'),
        join(dist, 'hooks', 'index.js'),
        join(dist, 'hooks', 'index.mjs'),
        join(dist, 'animation', 'index.js'),
        join(dist, 'animation', 'index.mjs'),
        join(dist, 'animation', 'lottie', 'index.js'),
        join(dist, 'animation', 'lottie', 'index.mjs'),
        join(dist, 'animation', 'tgs', 'index.js'),
        join(dist, 'animation', 'tgs', 'index.mjs'),
        join(dist, 'tgs', 'index.js'),
        join(dist, 'tgs', 'index.mjs'),
        join(dist, 'lottie', 'index.js'),
        join(dist, 'lottie', 'index.mjs'),
      ];
      const chunks = readdirSync(dist).filter(
        (f) => f.startsWith('chunk-') && (f.endsWith('.mjs') || f.endsWith('.js'))
      );
      prependUseClient([...entryFiles, ...chunks.map((f) => join(dist, f))]);
      console.log('[telegram-kit] "use client" injected into client bundles.');
    },
  },
  {
    entry: {
      'bot/index': 'src/bot/index.ts',
      'cdn/index': 'src/core/cdn.ts',
      'dev/index': 'src/core/dev.ts',
      'core/index': 'src/core/index.ts',
      'server/index': 'src/core/server.ts',
      'qr/index': 'src/ui/qr.ts',
      'format/index': 'src/utils/format.ts',
      'links/index': 'src/utils/links.ts',
      'keyboards/index': 'src/utils/keyboards.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    external: ['react', 'react-dom', 'node:crypto', 'crypto'],
    clean: false,
    treeshake: true,
    target: 'es2017',
  },
  {
    entry: { browser: 'src/browser.ts' },
    format: ['iife'],
    globalName: 'TelegramKit',
    platform: 'browser',
    dts: false,
    clean: false,
    treeshake: true,
    target: 'es2017',
    minify: true,
  },
]);
