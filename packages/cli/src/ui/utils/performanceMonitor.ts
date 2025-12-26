/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

/**
 * Threshold for warning about excessive re-renders in development.
 */
const RENDER_COUNT_THRESHOLD = 10;

/**
 * Whether to enable performance monitoring.
 * Only active in development mode.
 */
const isDevMode = process.env['NODE_ENV'] === 'development';

/**
 * A hook that tracks how many times a component has rendered.
 * Logs a warning if the render count exceeds the threshold.
 *
 * Only active in development mode - no-op in production.
 *
 * @param componentName - Name of the component being monitored
 * @param props - Optional props to log when threshold is exceeded
 *
 * @example
 * ```tsx
 * function MyComponent(props: Props) {
 *   useRenderCounter('MyComponent', props);
 *   // ... component logic
 * }
 * ```
 */
export function useRenderCounter(
  componentName: string,
  props?: Record<string, unknown>,
): void {
  const renderCount = useRef(0);
  const lastRenderTime = useRef<number>(Date.now());
  const renderTimes = useRef<number[]>([]);

  useEffect(() => {
    if (!isDevMode) return;

    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // Track render times (keep last 10)
    renderTimes.current.push(timeSinceLastRender);
    if (renderTimes.current.length > 10) {
      renderTimes.current.shift();
    }

    // Calculate average time between renders
    const avgTimeBetweenRenders =
      renderTimes.current.reduce((a, b) => a + b, 0) /
      renderTimes.current.length;

    // Warn if render count exceeds threshold
    if (renderCount.current > RENDER_COUNT_THRESHOLD) {
      console.warn(
        `[Perf] ${componentName} rendered ${renderCount.current} times ` +
          `(avg ${avgTimeBetweenRenders.toFixed(0)}ms between renders)`,
      );

      // Log props on first threshold breach for debugging
      if (
        renderCount.current === RENDER_COUNT_THRESHOLD + 1 &&
        props &&
        Object.keys(props).length > 0
      ) {
        console.warn(`[Perf] ${componentName} props:`, Object.keys(props));
      }
    }
  });
}

/**
 * A simple performance timer for measuring operation duration.
 *
 * @example
 * ```ts
 * const timer = createTimer('API Call');
 * await fetchData();
 * timer.stop(); // Logs: "[Perf] API Call took 123ms"
 * ```
 */
export function createTimer(label: string): { stop: () => number } {
  const start = performance.now();

  return {
    stop: () => {
      const duration = performance.now() - start;
      if (isDevMode) {
        console.log(`[Perf] ${label} took ${duration.toFixed(2)}ms`);
      }
      return duration;
    },
  };
}

/**
 * Decorator-style wrapper for async functions to measure execution time.
 *
 * @example
 * ```ts
 * const timedFetch = withTiming('fetchData', fetchData);
 * await timedFetch(params);
 * ```
 */
export function withTiming<
  T extends (...args: Parameters<T>) => Promise<ReturnType<T>>,
>(label: string, fn: T): T {
  if (!isDevMode) {
    return fn;
  }

  return (async (...args: Parameters<T>) => {
    const timer = createTimer(label);
    try {
      return await fn(...args);
    } finally {
      timer.stop();
    }
  }) as T;
}

/**
 * Simple FPS counter for terminal rendering.
 * Useful for debugging animation/scroll performance.
 */
export class FPSCounter {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;

  /**
   * Call this on each frame/render.
   */
  tick(): void {
    if (!isDevMode) return;

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    // Update FPS every second
    if (elapsed >= 1000) {
      this.fps = (this.frameCount / elapsed) * 1000;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  /**
   * Get the current FPS.
   */
  getFPS(): number {
    return Math.round(this.fps);
  }

  /**
   * Log the current FPS to console.
   */
  log(): void {
    if (isDevMode) {
      console.log(`[Perf] FPS: ${this.getFPS()}`);
    }
  }
}

/**
 * Memory usage tracker.
 */
export function logMemoryUsage(label?: string): void {
  if (!isDevMode) return;

  const usage = process.memoryUsage();
  const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

  console.log(
    `[Perf] Memory${label ? ` (${label})` : ''}: ` +
      `heap=${formatMB(usage.heapUsed)}MB/${formatMB(usage.heapTotal)}MB, ` +
      `rss=${formatMB(usage.rss)}MB`,
  );
}

/**
 * Batch multiple render updates together.
 * Useful for preventing cascade of re-renders.
 *
 * @example
 * ```ts
 * const batcher = createRenderBatcher();
 *
 * // Multiple updates will be batched
 * batcher.schedule(() => setState1(value1));
 * batcher.schedule(() => setState2(value2));
 * ```
 */
export function createRenderBatcher(delayMs: number = 0): {
  schedule: (fn: () => void) => void;
  flush: () => void;
} {
  const pending: Array<() => void> = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    const fns = pending.splice(0);
    fns.forEach((fn) => fn());
  };

  const schedule = (fn: () => void) => {
    pending.push(fn);
    if (!timeoutId) {
      timeoutId = setTimeout(flush, delayMs);
    }
  };

  return { schedule, flush };
}
