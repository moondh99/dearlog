import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// vitest.config.ts의 testTimeout(30초)은 RTL의 waitFor/findBy에는 적용되지 않습니다.
// RTL은 자체 기본값 1초를 쓰기 때문에, 테스트 파일이 병렬로 도는 동안 jsdom 렌더가
// 1초를 넘기면 "0 times 호출됨" 같은 일반 단언 실패로 보이는 간헐적 실패가 났습니다.
configure({ asyncUtilTimeout: 5000 });
