import { cpus, loadavg, totalmem, freemem } from 'os';
import { performance } from 'perf_hooks';
import type { LogLevel } from './types.js';

export interface CPUMetrics {
  timestamp: number;
  usage: number; // percentage 0-100
  loadAverage: {
    oneMinute: number;
    fiveMinutes: number;
    fifteenMinutes: number;
  };
  coreCount: number;
  systemLoadPerCore: number;
}

export interface MemoryMetrics {
  timestamp: number;
  heapUsed: number; // bytes
  heapTotal: number; // bytes
  external: number; // bytes
  arrayBuffers: number; // bytes
  heapUsagePercent: number;
  systemMemoryUsed: number;
  systemMemoryTotal: number;
  systemMemoryUsagePercent: number;
}

export interface SystemMetrics {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  uptime: number;
}

interface CPUSnapshot {
  user: number;
  sys: number;
  idle: number;
  irq: number;
  total: number;
}

/**
 * CPU Monitor - Real-time CPU usage tracking
 */
export class CPUMonitor {
  private static readonly SAMPLE_INTERVAL = 100; // ms
  private lastCPUSnapshots: CPUSnapshot[] = [];
  private lastSampleTime = performance.now();
  private logFn?: (level: LogLevel, message: string, meta?: any) => void;

  constructor(logFn?: (level: LogLevel, message: string, meta?: any) => void) {
    this.logFn = logFn;
    this.initializeBaseline();
  }

  private initializeBaseline(): void {
    const cpus_info = cpus();
    this.lastCPUSnapshots = cpus_info.map((cpu) => ({
      user: cpu.times.user,
      sys: cpu.times.sys,
      idle: cpu.times.idle,
      irq: cpu.times.irq,
      total: cpu.times.user + cpu.times.sys + cpu.times.idle + cpu.times.irq,
    }));
  }

  /**
   * Calcula o uso de CPU em percentual
   */
  getCPUUsage(): CPUMetrics {
    const cpus_info = cpus();
    const coreCount = cpus_info.length;
    const [one, five, fifteen] = loadavg();
    
    // Calculate average CPU usage across all cores
    let totalUsage = 0;
    
    cpus_info.forEach((cpu, index) => {
      const currentTotal = cpu.times.user + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      const prev = this.lastCPUSnapshots[index] ?? {
        user: cpu.times.user,
        sys: cpu.times.sys,
        idle: cpu.times.idle,
        irq: cpu.times.irq,
        total: currentTotal,
      };

      const totalDiff = currentTotal - prev.total;
      const userDiff = cpu.times.user - prev.user;
      const sysDiff = cpu.times.sys - prev.sys;

      const usage = totalDiff > 0
        ? ((userDiff + sysDiff) / totalDiff) * 100
        : 0;

      totalUsage += Math.min(100, Math.max(0, usage));

      this.lastCPUSnapshots[index] = {
        user: cpu.times.user,
        sys: cpu.times.sys,
        idle: cpu.times.idle,
        irq: cpu.times.irq,
        total: currentTotal,
      };
    });

    const averageUsage = totalUsage / coreCount;
    const systemLoadPerCore = one! / coreCount;

    return {
      timestamp: Date.now(),
      usage: Math.round(averageUsage * 100) / 100,
      loadAverage: {
        oneMinute: Math.round(one! * 100) / 100,
        fiveMinutes: Math.round(five! * 100) / 100,
        fifteenMinutes: Math.round(fifteen! * 100) / 100,
      },
      coreCount,
      systemLoadPerCore: Math.round(systemLoadPerCore * 100) / 100,
    };
  }

  /**
   * Monitora CPU e alerta se exceder threshold
   */
  checkCPUThreshold(threshold: number = 80): { exceeded: boolean; usage: number } {
    const metrics = this.getCPUUsage();
    const exceeded = metrics.usage > threshold;

    if (exceeded && this.logFn) {
      // @ts-ignore
      this.logFn(2, `CPU usage exceeded threshold: ${metrics.usage}% > ${threshold}%`, {
        usage: metrics.usage,
        threshold,
        cores: metrics.coreCount,
        systemLoad: metrics.loadAverage,
      });
    }

    return {
      exceeded,
      usage: metrics.usage,
    };
  }
}

/**
 * Memory Monitor - Real-time memory usage tracking
 */
export class MemoryMonitor {
  private logFn?: (level: LogLevel, message: string, meta?: any) => void;

  constructor(logFn?: (level: LogLevel, message: string, meta?: any) => void) {
    this.logFn = logFn;
  }

  /**
   * Obtém métricas de memória
   */
  getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const systemTotal = totalmem();
    const systemFree = freemem();
    const systemUsed = systemTotal - systemFree;

    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const systemMemoryUsagePercent = (systemUsed / systemTotal) * 100;

    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
      systemMemoryUsed: systemUsed,
      systemMemoryTotal: systemTotal,
      systemMemoryUsagePercent: Math.round(systemMemoryUsagePercent * 100) / 100,
    };
  }

  /**
   * Verifica se memória excedeu threshold
   */
  checkMemoryThreshold(threshold: number = 85): {
    heapExceeded: boolean;
    systemExceeded: boolean;
    metrics: MemoryMetrics;
  } {
    const metrics = this.getMemoryMetrics();
    const heapExceeded = metrics.heapUsagePercent > threshold;
    const systemExceeded = metrics.systemMemoryUsagePercent > threshold;

    if ((heapExceeded || systemExceeded) && this.logFn) {
      // @ts-ignore
      this.logFn(2, 'Memory threshold exceeded', {
        heap: `${metrics.heapUsagePercent}% (${Math.round(metrics.heapUsed / 1024 / 1024)}MB)`,
        system: `${metrics.systemMemoryUsagePercent}% (${Math.round(metrics.systemMemoryUsed / 1024 / 1024 / 1024)}GB)`,
        threshold,
      });
    }

    return {
      heapExceeded,
      systemExceeded,
      metrics,
    };
  }

  /**
   * Formata bytes para string legível
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

/**
 * System Monitor - Unified system metrics collector
 */
export class SystemMonitor {
  private cpuMonitor: CPUMonitor;
  private memoryMonitor: MemoryMonitor;
  private startTime = Date.now();
  private logFn?: (level: LogLevel, message: string, meta?: any) => void;

  constructor(logFn?: (level: LogLevel, message: string, meta?: any) => void) {
    this.logFn = logFn;
    this.cpuMonitor = new CPUMonitor(logFn);
    this.memoryMonitor = new MemoryMonitor(logFn);
  }

  /**
   * Coleta todas as métricas do sistema
   */
  getSystemMetrics(): SystemMetrics {
    return {
      cpu: this.cpuMonitor.getCPUUsage(),
      memory: this.memoryMonitor.getMemoryMetrics(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Monitora saúde geral do sistema
   */
  getSystemHealth(cpuThreshold: number = 80, memThreshold: number = 85): {
    healthy: boolean;
    warnings: string[];
    metrics: SystemMetrics;
  } {
    const metrics = this.getSystemMetrics();
    const warnings: string[] = [];

    const { exceeded: cpuExceeded, usage: cpuUsage } = this.cpuMonitor.checkCPUThreshold(cpuThreshold);
    const { heapExceeded, systemExceeded } = this.memoryMonitor.checkMemoryThreshold(memThreshold);

    if (cpuExceeded) {
      warnings.push(`High CPU usage: ${cpuUsage}% (threshold: ${cpuThreshold}%)`);
    }

    if (heapExceeded) {
      warnings.push(`High heap memory: ${metrics.memory.heapUsagePercent}% (threshold: ${memThreshold}%)`);
    }

    if (systemExceeded) {
      warnings.push(`High system memory: ${metrics.memory.systemMemoryUsagePercent}% (threshold: ${memThreshold}%)`);
    }

    return {
      healthy: warnings.length === 0,
      warnings,
      metrics,
    };
  }

  /**
   * Dashboard-friendly summary
   */
  getSummary() {
    const metrics = this.getSystemMetrics();
    const health = this.getSystemHealth();

    return {
      status: health.healthy ? 'healthy' : 'warning',
      cpu: {
        usage: `${metrics.cpu.usage}%`,
        cores: metrics.cpu.coreCount,
        load: metrics.cpu.loadAverage,
      },
      memory: {
        heap: {
          used: this.memoryMonitor.formatBytes(metrics.memory.heapUsed),
          total: this.memoryMonitor.formatBytes(metrics.memory.heapTotal),
          usage: `${metrics.memory.heapUsagePercent}%`,
        },
        system: {
          used: this.memoryMonitor.formatBytes(metrics.memory.systemMemoryUsed),
          total: this.memoryMonitor.formatBytes(metrics.memory.systemMemoryTotal),
          usage: `${metrics.memory.systemMemoryUsagePercent}%`,
        },
      },
      warnings: health.warnings,
    };
  }
}