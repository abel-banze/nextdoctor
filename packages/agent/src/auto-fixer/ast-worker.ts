import { Project, SyntaxKind, QuoteKind } from 'ts-morph';
import path from 'node:path';
import fs from 'node:fs';

export interface FixResult {
  filePath: string;
  fixesApplied: number;
  issueType: string;
}

/**
 * ASTWorker
 * 
 * The engine behind 'nextdoctor-agent fix'. 
 * Uses ts-morph to safely navigate and refactor Next.js source code.
 */
export class ASTWorker {
  private project: Project;

  constructor(tsConfigPath?: string) {
    const finalPath = tsConfigPath || path.join(process.cwd(), 'tsconfig.json');
    
    this.project = new Project({
      tsConfigFilePath: fs.existsSync(finalPath) ? finalPath : undefined,
      manipulationSettings: {
        quoteKind: QuoteKind.Single,
      },
    });

    if (!fs.existsSync(finalPath)) {
      // If no tsconfig, manually add files from current dir
      this.project.addSourceFilesAtPaths([
        'app/**/*.{ts,tsx}',
        'src/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}'
      ]);
    }
  }

  /**
   * Scans and fixes all supported issues in the project
   */
  async fixAll(): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      let fixes = 0;
      
      // 1. Fix fetch() without cache
      fixes += this.applyFetchCacheFix(sourceFile);
      
      // 2. Fix await cookies() for Next.js 15+
      fixes += this.applyAsyncCookiesFix(sourceFile);

      // 3. Remove unnecessary 'use client'
      fixes += this.removeUnnecessaryUseClient(sourceFile);
      
      // 4. Validate Node.js APIs in Edge
      fixes += this.detectNodeApiInEdge(sourceFile);

      // 5. Check for public env secrets
      fixes += this.checkPublicEnvSecrets(sourceFile);

      // 6. Check for missing error boundaries
      fixes += this.checkMissingErrorBoundary(sourceFile);

      // 7. Check for security headers (CSP)
      fixes += this.checkCspHeaders(sourceFile);

      // 8. Check for API rate limiting
      fixes += this.checkApiRateLimit(sourceFile);

      if (fixes > 0) {
        await sourceFile.save();
        results.push({
          filePath: sourceFile.getFilePath(),
          fixesApplied: fixes,
          issueType: 'MULTIPLE'
        });
      }
    }

    return results;
  }

  private applyFetchCacheFix(sourceFile: any): number {
    let count = 0;
    const fetchCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c: any) => c.getExpression().getText() === 'fetch');

    fetchCalls.forEach((call: any) => {
      const args = call.getArguments();
      if (args.length === 1) {
        call.addArgument('{ cache: "force-cache" }');
        count++;
      } else if (args.length === 2 && args[1].getKind() === SyntaxKind.ObjectLiteralExpression) {
        const obj = args[1].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        if (!obj.getProperty('cache') && !obj.getProperty('next')) {
          obj.addPropertyAssignment({
            name: 'cache',
            initializer: "'force-cache'",
          });
          count++;
        }
      }
    });

    return count;
  }

  private applyAsyncCookiesFix(sourceFile: any): number {
    let count = 0;
    // Find calls to cookies() that are not awaited
    const cookieCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c: any) => c.getExpression().getText() === 'cookies');

    cookieCalls.forEach((call: any) => {
      const parent = call.getParent();
      if (parent.getKind() !== SyntaxKind.AwaitExpression) {
        // Check if we are inside an async function
        const container = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                          call.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                          call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
        
        if (container && (container as any).isAsync()) {
          call.replaceWithText(`await ${call.getText()}`);
          count++;
        }
      }
    });

    return count;
  }

  private removeUnnecessaryUseClient(sourceFile: any): number {
    let count = 0;
    const useClientDirective = sourceFile.getStatements().find((s: any) => 
      s.getKind() === SyntaxKind.ExpressionStatement && s.getText().includes('use client')
    );

    if (!useClientDirective) return 0;

    // Check for client-only hooks
    const hooks = ['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef', 'useLayoutEffect', 'useImperativeHandle'];
    const hasHooks = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((id: any) => hooks.includes(id.getText()));
    
    // Check for event handlers (on* props in JSX)
    const hasEventHandlers = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute).some((attr: any) => {
      try {
        return attr.getNameNode().getText().startsWith('on');
      } catch {
        return false;
      }
    });

    if (!hasHooks && !hasEventHandlers) {
      useClientDirective.remove();
      count++;
    }

    return count;
  }

  private detectNodeApiInEdge(sourceFile: any): number {
    // Only check if it's an edge runtime file
    const runtimeConfig = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((v: any) => 
      v.getName() === 'runtime' && v.getInitializer()?.getText().includes('edge')
    );
    
    if (!runtimeConfig) return 0;

    let count = 0;
    const nodeModules = ['fs', 'path', 'crypto', 'net', 'tls', 'child_process', 'dns'];
    const imports = sourceFile.getImportDeclarations();
    
    imports.forEach((imp: any) => {
      const moduleName = imp.getModuleSpecifierValue();
      if (nodeModules.some(nm => moduleName === nm || moduleName.startsWith(`node:${nm}`))) {
        // In a real scenario, we might want to flag this as a FixResult issue even if we don't 'fix' it by removing
        // For now, let's count it as an issue found
        count++;
      }
    });

    return count;
  }

  private checkPublicEnvSecrets(sourceFile: any): number {
    let count = 0;
    const secrets = ['secret', 'token', 'key', 'password', 'auth', 'private', 'credential'];
    
    const envAccess = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).filter((pa: any) => 
      pa.getExpression().getText() === 'process.env' && pa.getName().startsWith('NEXT_PUBLIC_')
    );

    envAccess.forEach((env: any) => {
      const envName = env.getName().toLowerCase();
      if (secrets.some(s => envName.includes(s))) {
        count++;
      }
    });

    return count;
  }

  private checkMissingErrorBoundary(sourceFile: any): number {
    const filePath = sourceFile.getFilePath();
    if (!filePath.includes('/app/') || !filePath.endsWith('page.tsx')) return 0;

    const dir = path.dirname(filePath);
    const errorFile = path.join(dir, 'error.tsx');
    const errorJSFile = path.join(dir, 'error.js');

    if (!fs.existsSync(errorFile) && !fs.existsSync(errorJSFile)) {
      return 1;
    }

    return 0;
  }

  private checkCspHeaders(sourceFile: any): number {
    const filePath = sourceFile.getFilePath();
    if (!filePath.endsWith('next.config.js') && !filePath.endsWith('next.config.mjs')) return 0;

    const content = sourceFile.getFullText();
    if (!content.includes('Content-Security-Policy') && !content.includes('csp')) {
      return 1;
    }

    return 0;
  }

  private checkApiRateLimit(sourceFile: any): number {
    const filePath = sourceFile.getFilePath();
    if (!filePath.includes('/api/') || (!filePath.endsWith('route.ts') && !filePath.endsWith('route.js'))) return 0;

    const content = sourceFile.getFullText();
    const hasMutations = content.includes('POST') || content.includes('PATCH') || content.includes('DELETE') || content.includes('PUT');
    
    if (hasMutations && !content.includes('rateLimit') && !content.includes('throttle')) {
      return 1;
    }

    return 0;
  }
}
