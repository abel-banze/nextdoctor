import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import type { NextDoctorConfig } from './types';

let sdk: NodeSDK | null = null;

export async function initNextDoctor(config: NextDoctorConfig): Promise<void> {
  if (sdk) {
    console.warn('NextDoctor agent already initialized');
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: config.endpoint,
    headers: {
      'authorization': `Bearer ${config.projectToken}`,
      'content-type': 'application/json',
    },
  });

  sdk = new NodeSDK({
    serviceName: 'nextdoctor-agent',
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Configure instrumentations as needed
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nextjs': {
          enabled: true,
        },
      }),
    ],
  });

  try {
    await sdk.start();
    console.log('NextDoctor agent initialized successfully');
  } catch (error) {
    console.error('Failed to initialize NextDoctor agent:', error);
    throw error;
  }
}

export async function shutdownNextDoctor(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}