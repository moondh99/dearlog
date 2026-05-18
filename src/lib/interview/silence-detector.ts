/**
 * Silence Detector for interview sessions.
 *
 * Monitors speech input gaps and provides phase-based UX responses.
 * Uses requestAnimationFrame for accurate timing.
 * NEVER automatically stops recording due to silence.
 *
 * Phase transitions:
 * - 'normal': silence < 8 seconds
 * - 'encouraging': 8 ≤ silence < 20 seconds
 * - 'offering_options': silence ≥ 20 seconds
 */

import type { SilenceState, SilencePhase } from '../types';

/**
 * Pure helper to determine the silence phase based on duration.
 * Exported for testability.
 */
export function getPhaseForDuration(duration: number): SilencePhase {
  if (duration >= 20) {
    return 'offering_options';
  }
  if (duration >= 8) {
    return 'encouraging';
  }
  return 'normal';
}

export interface SilenceDetector {
  start(): void;
  stop(): void;
  reset(): void;
  onSpeechDetected(): void;
  getState(): SilenceState;
}

/**
 * Creates a new SilenceDetector instance.
 *
 * The detector tracks elapsed time since last speech detection using
 * requestAnimationFrame for accurate timing. It transitions through
 * phases based on silence duration but never automatically stops recording.
 */
export function createSilenceDetector(): SilenceDetector {
  let isActive = false;
  let lastSpeechTime = 0;
  let silenceDuration = 0;
  let phase: SilencePhase = 'normal';
  let animationFrameId: number | null = null;

  function tick(): void {
    if (!isActive) {
      return;
    }

    const now = performance.now();
    silenceDuration = (now - lastSpeechTime) / 1000;
    phase = getPhaseForDuration(silenceDuration);

    // Schedule next frame — never stop recording due to silence
    animationFrameId = requestAnimationFrame(tick);
  }

  function start(): void {
    if (isActive) {
      return;
    }
    isActive = true;
    lastSpeechTime = performance.now();
    silenceDuration = 0;
    phase = 'normal';
    animationFrameId = requestAnimationFrame(tick);
  }

  function stop(): void {
    isActive = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function reset(): void {
    lastSpeechTime = performance.now();
    silenceDuration = 0;
    phase = 'normal';
  }

  function onSpeechDetected(): void {
    lastSpeechTime = performance.now();
    silenceDuration = 0;
    phase = 'normal';
  }

  function getState(): SilenceState {
    return {
      isActive,
      silenceDuration,
      phase,
    };
  }

  return {
    start,
    stop,
    reset,
    onSpeechDetected,
    getState,
  };
}
