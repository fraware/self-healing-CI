import { execa } from 'execa';
import { CompilationResult, CompilationValidator } from '../types/patch.js';

export class TypeScriptValidator implements CompilationValidator {
  getLanguage(): string {
    return 'typescript';
  }

  getCompilationCommand(): string[] {
    return ['npx', 'tsc', '--noEmit'];
  }

  getErrorPatterns(): RegExp[] {
    return [
      /error TS\d+: .+/g,
      /Cannot find module '.+'/g,
      /Property '.+' does not exist on type/g,
      /Type '.+' is not assignable to type/g,
      /Expected \d+ arguments, but got \d+/g,
      /Object is possibly 'undefined'/g,
      /Property '.+' is missing in type/g,
    ];
  }

  async validate(workspacePath: string): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // Check if TypeScript is available
      const hasTypeScript = await this.checkTypeScriptAvailability(
        workspacePath
      );
      if (!hasTypeScript) {
        return {
          success: true,
          errors: [],
          warnings: ['TypeScript not detected in project'],
          duration: Date.now() - startTime,
          language: 'typescript',
        };
      }

      // Run TypeScript compilation check
      const { stdout, stderr } = await execa('npx', ['tsc', '--noEmit'], {
        cwd: workspacePath,
        timeout: 30000, // 30 second timeout
        reject: false, // Don't throw on non-zero exit code
      });

      const duration = Date.now() - startTime;
      const output = stderr || stdout;

      // Parse errors from output
      const errors = this.parseErrors(output);
      const warnings = this.parseWarnings(output);

      return {
        success: errors.length === 0,
        errors,
        warnings,
        duration,
        language: 'typescript',
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'TypeScript validation failed',
        ],
        duration: Date.now() - startTime,
        language: 'typescript',
      };
    }
  }

  private async checkTypeScriptAvailability(
    workspacePath: string
  ): Promise<boolean> {
    try {
      // Check for tsconfig.json
      const { stdout: tsconfigExists } = await execa(
        'test',
        ['-f', 'tsconfig.json'],
        {
          cwd: workspacePath,
          reject: false,
        }
      );

      if (tsconfigExists === '') {
        return true;
      }

      // Check for package.json with TypeScript dependencies
      const { stdout: packageJson } = await execa('cat', ['package.json'], {
        cwd: workspacePath,
        reject: false,
      });

      if (packageJson) {
        const packageData = JSON.parse(packageJson);
        const dependencies = {
          ...packageData.dependencies,
          ...packageData.devDependencies,
        };

        return Object.keys(dependencies).some(
          dep => dep === 'typescript' || dep.includes('@types/')
        );
      }

      return false;
    } catch {
      return false;
    }
  }

  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match TypeScript error patterns
      for (const pattern of this.getErrorPatterns()) {
        const matches = line.match(pattern);
        if (matches) {
          errors.push(line.trim());
          break;
        }
      }

      // Also capture lines that start with file paths and contain errors
      if (
        line.includes('.ts') &&
        (line.includes('error') || line.includes('Error'))
      ) {
        errors.push(line.trim());
      }
    }

    return [...new Set(errors)]; // Remove duplicates
  }

  private parseWarnings(output: string): string[] {
    const warnings: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('warning') || line.includes('TS')) {
        warnings.push(line.trim());
      }
    }

    return [...new Set(warnings)]; // Remove duplicates
  }
}
