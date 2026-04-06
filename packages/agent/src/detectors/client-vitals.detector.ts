import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

/**
 * ClientVitalsDetector
 * 
 * Processes Core Web Vitals and UX patterns.
 * - LCP (Largest Contentful Paint)
 * - CLS (Cumulative Layout Shift)
 * - Excessive Re-renders (from React-Scan labels)
 */
export class ClientVitalsDetector extends BaseDetector {
  readonly id = 'client-vitals';
  readonly name = 'Client Vitals & UX Detector';
  
  private readonly LCP_THRESHOLD = 2500; // ms
  private readonly CLS_THRESHOLD = 0.1;
  private readonly RE_RENDER_THRESHOLD = 10;

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    for (const span of spans) {
      const name = span.name.toLowerCase();
      
      // 1. Largest Contentful Paint (LCP)
      if (name.includes('lcp') || name.includes('largest-contentful-paint')) {
        const lcpValue = this.getNumberAttribute(span, 'web_vitals.value') || 
                         this.getNumberAttribute(span, 'value');
        
        if (lcpValue && lcpValue > this.LCP_THRESHOLD) {
          issues.push({
            id: this.id,
            type: 'LCP_DEGRADED',
            severity: 'high',
            message: `Largest Contentful Paint (LCP) is ${Math.round(lcpValue)}ms (threshold: ${this.LCP_THRESHOLD}ms).`,
            suggestion: `O LCP está acima do recomendado. Verifique se a maior imagem/bloco de texto está sendo carregado com prioridade (fetchPriority="high").`,
            route: context.route,
            detectedAt: Date.now(),
            attributes: { value: lcpValue }
          });
        }
      }

      // 2. Cumulative Layout Shift (CLS)
      if (name.includes('cls') || name.includes('cumulative-layout-shift')) {
        const clsValue = this.getNumberAttribute(span, 'web_vitals.value') || 
                         this.getNumberAttribute(span, 'value');
        
        if (clsValue && clsValue > this.CLS_THRESHOLD) {
          issues.push({
            id: this.id,
            type: 'LAYOUT_SHIFT_HIGH',
            severity: 'high',
            message: `Cumulative Layout Shift (CLS) is ${clsValue.toFixed(2)} (threshold: ${this.CLS_THRESHOLD}).`,
            suggestion: `Mudança brusca de layout detectada. Reserve espaço para imagens e fontes carregadas dinamicamente.`,
            route: context.route,
            detectedAt: Date.now(),
            attributes: { value: clsValue }
          });
        }
      }

      // 3. Excessive Re-renders (React-Scan integration)
      if (name.includes('react-scan') || name.includes('component-render')) {
        const renderCount = this.getNumberAttribute(span, 'render_count');
        const componentName = this.getStringAttribute(span, 'component_name');
        
        if (renderCount && renderCount > this.RE_RENDER_THRESHOLD) {
          issues.push({
            id: this.id,
            type: 'EXCESSIVE_RE_RENDERS',
            severity: 'warning',
            message: `Component "${componentName}" rendered ${renderCount}x per interaction.`,
            suggestion: `Re-renders excessivos detectados pelo React-Scan. Verifique referências instáveis em useMemo/useCallback ou props mudando desnecessariamente.`,
            route: context.route,
            detectedAt: Date.now(),
            attributes: { componentName, renderCount }
          });
        }
      }
    }

    return issues;
  }
}
