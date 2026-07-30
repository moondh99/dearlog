/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'server/**/*.{test,spec}.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'Senior-Friendly Family Autobiography App/**',
    ],
    // server/app.test.ts 의 출판 PDF 테스트는 Puppeteer 로 실제 렌더까지 하므로
    // 단독 실행에서도 4초 이상 걸린다. 전체 병렬 실행 부하에서 기본 5초를 넘겨
    // 간헐 실패하던 것을 막기 위해 넉넉하게 둔다.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
