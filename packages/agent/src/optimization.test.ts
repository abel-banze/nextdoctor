import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntelligentSampler } from './optimization.js';

describe('IntelligentSampler', () => {
  let sampler: IntelligentSampler;

  beforeEach(() => {
    sampler = new IntelligentSampler(0.5); // 50% rate
  });

  it('should respect initial sampling rate', () => {
    // We can't easily test randomness without mocking Math.random
    const mockRandom = vi.spyOn(Math, 'random');
    
    mockRandom.mockReturnValue(0.4); // Below 0.5
    expect(sampler.shouldSample()).toBe(true);

    mockRandom.mockReturnValue(0.6); // Above 0.5
    expect(sampler.shouldSample()).toBe(false);

    mockRandom.mockRestore();
  });

  it('should allow dynamic rate adjustment via setRate', () => {
    sampler.setRate(0);
    expect(sampler.getSamplingRate()).toBe(0);
    
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValue(0.01);
    expect(sampler.shouldSample()).toBe(false); 

    sampler.setRate(1);
    expect(sampler.getSamplingRate()).toBe(1);
    mockRandom.mockReturnValue(0.99);
    expect(sampler.shouldSample()).toBe(true);

    mockRandom.mockRestore();
  });

  it('should auto-adjust rate based on span volume (recordSpan)', () => {
    const highVolumeSampler = new IntelligentSampler(1.0);
    
    // Simulate high volume (more than 2000 spans/sec)
    for (let i = 0; i < 2500; i++) {
      highVolumeSampler.recordSpan();
    }

    // Mock Date.now to simulate 1.1s passing
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1100);
    
    highVolumeSampler.recordSpan(); // Trigger adjustment
    
    expect(highVolumeSampler.getSamplingRate()).toBeLessThan(1.0);
    vi.useRealTimers();
  });

  it('should always sample errors', () => {
    sampler.setRate(0);
    expect(sampler.shouldSample('error.log')).toBe(true);
    expect(sampler.shouldSample('db.query')).toBe(false);
  });
});
