import type { NextDoctorConfig } from './types';

/**
 * Intelligent sampler para controlar volume de traces
 */
export class IntelligentSampler {
  private samplingRate: number;
  private bucketsPerSecond = 1000;
  private lastAdjustmentTime = Date.now();
  private spanCount = 0;
  private errorCount = 0;

  constructor(initialRate: number = 1.0) {
    this.samplingRate = Math.max(0, Math.min(1, initialRate));
  }

  shouldSample(spanName?: string): boolean {
    // Always sample errors
    if (spanName?.includes('error')) {
      return true;
    }

    return Math.random() < this.samplingRate;
  }

  recordSpan(isError: boolean = false): void {
    this.spanCount++;
    if (isError) {
      this.errorCount++;
    }

    // Adjust sampling rate every second
    const now = Date.now();
    if (now - this.lastAdjustmentTime > 1000) {
      this.adjustSamplingRate();
      this.lastAdjustmentTime = now;
      this.spanCount = 0;
      this.errorCount = 0;
    }
  }

  private adjustSamplingRate(): void {
    // If too many spans, reduce sampling
    if (this.spanCount > this.bucketsPerSecond * 2) {
      this.samplingRate *= 0.9;
    }
    // If too few spans, increase sampling
    else if (this.spanCount < this.bucketsPerSecond * 0.5) {
      this.samplingRate *= 1.1;
    }

    this.samplingRate = Math.max(0, Math.min(1, this.samplingRate));
  }

  getSamplingRate(): number {
    return this.samplingRate;
  }
}

/**
 * Batch processor para otimização de memória
 */
export class BatchProcessor {
  private batch: any[] = [];
  private batchSize: number;
  private batchTimeoutMs: number;
  private timeoutId: NodeJS.Timeout | null = null;
  private onFlush: (batch: any[]) => Promise<void>;

  constructor(
    batchSize: number = 100,
    batchTimeoutMs: number = 5000,
    onFlush: (batch: any[]) => Promise<void>,
  ) {
    this.batchSize = batchSize;
    this.batchTimeoutMs = batchTimeoutMs;
    this.onFlush = onFlush;
  }

  add(item: any): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.batchTimeoutMs);
    }
  }

  async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    const itemsToFlush = [...this.batch];
    this.batch = [];

    try {
      await this.onFlush(itemsToFlush);
    } catch (error) {
      console.error('Error flushing batch:', error);
      // Re-add items if flush fails
      this.batch = [...itemsToFlush, ...this.batch];
    }
  }

  async destroy(): Promise<void> {
    await this.flush();
  }
}

/**
 * Circuit breaker para proteção contra exporters degradados
 */
export class CircuitBreaker {
  private failureCount = 0;
  private failureThreshold = 5;
  private resetTimeout = 60000; // 1 minute
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        console.warn('Circuit breaker is OPEN, request rejected');
        return null;
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error('Circuit breaker opened due to excessive failures');
      }

      throw error;
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  getState(): string {
    return this.state;
  }
}
