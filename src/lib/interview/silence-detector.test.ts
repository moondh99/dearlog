import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSilenceDetector, getPhaseForDuration } from './silence-detector';

describe('getPhaseForDuration', () => {
  it('returns "normal" for duration < 8 seconds', () => {
    expect(getPhaseForDuration(0)).toBe('normal');
    expect(getPhaseForDuration(3)).toBe('normal');
    expect(getPhaseForDuration(7.99)).toBe('normal');
  });

  it('returns "encouraging" for 8 <= duration < 20 seconds', () => {
    expect(getPhaseForDuration(8)).toBe('encouraging');
    expect(getPhaseForDuration(12)).toBe('encouraging');
    expect(getPhaseForDuration(19.99)).toBe('encouraging');
  });

  it('returns "offering_options" for duration >= 20 seconds', () => {
    expect(getPhaseForDuration(20)).toBe('offering_options');
    expect(getPhaseForDuration(30)).toBe('offering_options');
    expect(getPhaseForDuration(100)).toBe('offering_options');
  });
});

describe('createSilenceDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame and cancelAnimationFrame
    let frameId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++frameId;
      callbacks.set(id, cb);
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      callbacks.delete(id);
    });

    // Helper to advance frames
    vi.stubGlobal('__triggerFrames', () => {
      const cbs = Array.from(callbacks.entries());
      callbacks.clear();
      for (const [, cb] of cbs) {
        cb(performance.now());
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts in inactive state', () => {
    const detector = createSilenceDetector();
    const state = detector.getState();
    expect(state.isActive).toBe(false);
    expect(state.silenceDuration).toBe(0);
    expect(state.phase).toBe('normal');
  });

  it('becomes active after start()', () => {
    const detector = createSilenceDetector();
    detector.start();
    const state = detector.getState();
    expect(state.isActive).toBe(true);
  });

  it('becomes inactive after stop()', () => {
    const detector = createSilenceDetector();
    detector.start();
    detector.stop();
    const state = detector.getState();
    expect(state.isActive).toBe(false);
  });

  it('resets silence duration and phase on reset()', () => {
    const detector = createSilenceDetector();
    detector.start();

    // Advance time to trigger phase change
    vi.advanceTimersByTime(10000);
    (globalThis as any).__triggerFrames();

    // After tick, duration should be ~10s
    const stateBeforeReset = detector.getState();
    expect(stateBeforeReset.silenceDuration).toBeGreaterThan(0);

    detector.reset();
    const stateAfterReset = detector.getState();
    expect(stateAfterReset.silenceDuration).toBe(0);
    expect(stateAfterReset.phase).toBe('normal');
  });

  it('resets silence timer on onSpeechDetected()', () => {
    const detector = createSilenceDetector();
    detector.start();

    // Advance time
    vi.advanceTimersByTime(10000);
    (globalThis as any).__triggerFrames();

    detector.onSpeechDetected();
    const state = detector.getState();
    expect(state.silenceDuration).toBe(0);
    expect(state.phase).toBe('normal');
  });

  it('never sets isActive to false due to silence alone', () => {
    const detector = createSilenceDetector();
    detector.start();

    // Advance time well beyond all thresholds
    vi.advanceTimersByTime(60000);
    (globalThis as any).__triggerFrames();

    const state = detector.getState();
    expect(state.isActive).toBe(true);
    expect(state.phase).toBe('offering_options');
  });

  it('does not start multiple times if already active', () => {
    const detector = createSilenceDetector();
    detector.start();

    // Advance time
    vi.advanceTimersByTime(5000);
    (globalThis as any).__triggerFrames();

    const stateBefore = detector.getState();

    // Calling start again should be a no-op
    detector.start();
    const stateAfter = detector.getState();

    expect(stateAfter.silenceDuration).toBe(stateBefore.silenceDuration);
  });

  it('transitions through phases as silence duration increases', () => {
    const detector = createSilenceDetector();
    detector.start();

    // At 5 seconds - normal
    vi.advanceTimersByTime(5000);
    (globalThis as any).__triggerFrames();
    expect(detector.getState().phase).toBe('normal');

    // At 10 seconds - encouraging
    vi.advanceTimersByTime(5000);
    (globalThis as any).__triggerFrames();
    expect(detector.getState().phase).toBe('encouraging');

    // At 25 seconds - offering_options
    vi.advanceTimersByTime(15000);
    (globalThis as any).__triggerFrames();
    expect(detector.getState().phase).toBe('offering_options');
  });
});
