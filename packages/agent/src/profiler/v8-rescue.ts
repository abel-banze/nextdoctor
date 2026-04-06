import v8 from 'node:v8';
import path from 'node:path';
import { LogLevel } from '../types.js';

/**
 * V8MemoryRescue
 * 
 * Proactive memory monitor that triggers a heap snapshot when memory
 * usage exceeds the defined threshold (default 90%).
 * 
 * Blocks the event loop briefly but provides critical diagnostic data
 * that allows identifying the source of memory leaks in production.
 */
export class V8MemoryRescue {
  private interval: NodeJS.Timeout | null = null;
  private readonly thresholdPercent = 90;
  private isDumping = false;
  private lastDumpTime = 0;
  private readonly dumpCooldownMs = 300_000; // 5 minutes

  constructor(private log: (level: LogLevel, msg: string, meta?: Record<string, unknown>) => void) {}

  /**
   * Starts the memory monitor.
   * Gracefully exits if not running in a Node.js compatible environment (e.g. Edge).
   */
  start() {
    if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
      return; 
    }

    this.interval = setInterval(() => this.checkMemory(), 10000);
    this.log(LogLevel.INFO, 'V8 Memory Rescue monitor started');
  }

  /**
   * Stops the memory monitor.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private checkMemory() {
    if (this.isDumping) return;

    try {
      const heapStats = v8.getHeapStatistics();
      const heapUsed = heapStats.used_heap_size;
      const heapLimit = heapStats.heap_size_limit;
      const usagePercent = (heapUsed / heapLimit) * 100;

      if (usagePercent > this.thresholdPercent) {
        const now = Date.now();
        if (now - this.lastDumpTime > this.dumpCooldownMs) {
          this.triggerDump(usagePercent, heapUsed, heapLimit);
          this.lastDumpTime = now;
        }
      }
    } catch (err) {
      // Fail silently to avoid interrupting the main process
    }
  }

  private triggerDump(percent: number, used: number, limit: number) {
    this.isDumping = true;
    this.log(LogLevel.ERROR, `CRITICAL MEMORY ALERT: ${percent.toFixed(2)}% heap used. Triggering rescue snapshot...`, {
      usedHeapMb: Math.round(used / 1024 / 1024),
      limitHeapMb: Math.round(limit / 1024 / 1024)
    });

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nextdoctor-rescue-${timestamp}.heapsnapshot`;
      const fullPath = path.join(process.cwd(), filename);

      /**
       * writeHeapSnapshot is synchronous and blocks the event loop.
       * We use it here because if the process is at 90%+ heap, it is likely already
       * unstable and about to crash. The snapshot is the only way to find why.
       */
      const resultPath = (v8 as any).writeHeapSnapshot(fullPath);
      
      this.log(LogLevel.WARN, `V8 Rescue snapshot successfully saved to: ${resultPath || fullPath}`);
    } catch (err) {
      this.log(LogLevel.ERROR, 'Failed to generate V8 rescue snapshot', { error: String(err) });
    } finally {
      this.isDumping = false;
    }
  }
}
