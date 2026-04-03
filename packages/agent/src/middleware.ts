import { getNextDoctorAgent, reportMetric } from './init';

/**
 * Middleware para Next.js API routes
 * Captura automaticamente tempo de resposta e status
 */
export function withNextDoctorMonitoring(
  handler: (req: any, res: any) => Promise<void>,
) {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    const originalStatusCode = res.statusCode;

    // Wrap response.end to capture status
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - startTime;
      const agent = getNextDoctorAgent();

      if (agent) {
        reportMetric('api.request.duration', duration, {
          method: req.method,
          path: req.url,
          status: res.statusCode,
        });
      }

      return originalEnd.apply(res, args);
    };

    try {
      await handler(req, res);
    } catch (error) {
      reportMetric('api.request.error', 1, {
        method: req.method,
        path: req.url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/**
 * Monitora operações async com timing e error tracking
 */
export async function withNextDoctorTiming<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, any>,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    reportMetric(`operation.${name}.duration`, duration, {
      status: 'success',
      ...meta,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    reportMetric(`operation.${name}.duration`, duration, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    });

    throw error;
  }
}
