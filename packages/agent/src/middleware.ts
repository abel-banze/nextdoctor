import { getNextDoctorAgent, reportMetric } from './init.js';

/**
 * Modern Next.js 14/15+ App Router Route Handler Middleware
 * Wraps a standard Fetch API Request/Response handler
 */
export function withNextDoctorAppRoute<TContext = unknown>(
  handler: (req: Request, context: TContext) => Promise<Response> | Response
) {
  return async (req: Request, context: TContext): Promise<Response> => {
    const startTime = Date.now();
    
    try {
      const response = await handler(req, context);
      const duration = Date.now() - startTime;
      
      const agent = getNextDoctorAgent();
      if (agent) {
        reportMetric('api.request.duration', duration, {
          method: req.method,
          path: new URL(req.url).pathname,
          status: response.status,
          runtime: 'app-router'
        });
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const agent = getNextDoctorAgent();
      if (agent) {
        reportMetric('api.request.error', 1, {
          method: req.method,
          path: new URL(req.url).pathname,
          duration,
          error: error instanceof Error ? error.message : String(error),
          runtime: 'app-router'
        });
      }
      throw error;
    }
  };
}

/**
 * Legacy Middleware for Next.js Pages API routes
 * @deprecated Use native OpenTelemetry instrumentation or `withNextDoctorAppRoute` for App Router
 */
export function withNextDoctorMonitoring(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (req: any, res: any) => Promise<void>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: any, res: any) => {
    const startTime = Date.now();
    const originalEnd = res.end;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (...args: any[]) {
      const duration = Date.now() - startTime;
      const agent = getNextDoctorAgent();

      if (agent) {
        reportMetric('api.request.duration', duration, {
          method: req.method,
          path: req.url,
          status: res.statusCode,
          runtime: 'pages-router'
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
        runtime: 'pages-router'
      });
      throw error;
    }
  };
}

/**
 * Monitors async operations with timing and error tracking
 */
export async function withNextDoctorTiming<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, string | number | boolean>,
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
