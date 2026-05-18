import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getPhaseForDuration, createSilenceDetector } from './silence-detector';

/**
 * Feature: memoir-platform-enhancement, Property 12: Silence Phase Transitions
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 *
 * For any silence duration value (in seconds), the silence detector SHALL assign
 * phase 'normal' when duration < 8, 'encouraging' when 8 ≤ duration < 20, and
 * 'offering_options' when duration ≥ 20. For all duration values regardless of
 * magnitude, the recording state SHALL never be automatically set to inactive.
 */
describe('Property 12: Silence Phase Transitions', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  /** Non-negative duration in seconds (0 to very large values) */
  const durationArb: fc.Arbitrary<number> = fc.double({
    min: 0,
    max: 1_000_000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  /** Duration strictly less than 8 seconds */
  const normalDurationArb: fc.Arbitrary<number> = fc.double({
    min: 0,
    max: 7.999999,
    noNaN: true,
    noDefaultInfinity: true,
  });

  /** Duration in the encouraging range: [8, 20) */
  const encouragingDurationArb: fc.Arbitrary<number> = fc.double({
    min: 8,
    max: 19.999999,
    noNaN: true,
    noDefaultInfinity: true,
  });

  /** Duration >= 20 seconds */
  const offeringOptionsDurationArb: fc.Arbitrary<number> = fc.double({
    min: 20,
    max: 1_000_000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // ─── Sub-property 1: Duration < 8 → phase is 'normal' ────────────────────────

  it('assigns phase "normal" when duration < 8 seconds', () => {
    fc.assert(
      fc.property(normalDurationArb, (duration) => {
        const phase = getPhaseForDuration(duration);
        expect(phase).toBe('normal');
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: 8 ≤ duration < 20 → phase is 'encouraging' ──────────────

  it('assigns phase "encouraging" when 8 ≤ duration < 20 seconds', () => {
    fc.assert(
      fc.property(encouragingDurationArb, (duration) => {
        const phase = getPhaseForDuration(duration);
        expect(phase).toBe('encouraging');
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: Duration ≥ 20 → phase is 'offering_options' ─────────────

  it('assigns phase "offering_options" when duration ≥ 20 seconds', () => {
    fc.assert(
      fc.property(offeringOptionsDurationArb, (duration) => {
        const phase = getPhaseForDuration(duration);
        expect(phase).toBe('offering_options');
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: For ALL durations, phase is always a valid value ─────────

  it('for any non-negative duration, the phase is always one of the three valid values', () => {
    const validPhases = ['normal', 'encouraging', 'offering_options'];

    fc.assert(
      fc.property(durationArb, (duration) => {
        const phase = getPhaseForDuration(duration);
        expect(validPhases).toContain(phase);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 5: Recording state is never automatically set to inactive ───

  describe('recording state preservation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
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

    it('the detector never automatically sets isActive to false regardless of silence duration', () => {
      /**
       * We test with various large durations to confirm that the silence detector
       * never deactivates recording on its own. We simulate time advancement and
       * trigger animation frames to let the detector update its internal state.
       */
      const largeDurationMsArb: fc.Arbitrary<number> = fc.integer({
        min: 1000,
        max: 300_000,
      });

      fc.assert(
        fc.property(largeDurationMsArb, (durationMs) => {
          const detector = createSilenceDetector();
          detector.start();

          // Advance time by the generated duration
          vi.advanceTimersByTime(durationMs);
          (globalThis as any).__triggerFrames();

          const state = detector.getState();
          // The detector must remain active — silence alone never stops recording
          expect(state.isActive).toBe(true);

          // Clean up for next iteration
          detector.stop();
        }),
        { numRuns: 100 }
      );
    });
  });
});
