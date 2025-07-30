import { execa } from 'execa';
import { CompilationResult, CompilationValidator } from '../types/patch.js';

export class JavaScriptValidator implements CompilationValidator {
  getLanguage(): string {
    return 'javascript';
  }

  getCompilationCommand(): string[] {
    return ['npx', 'eslint', '.'];
  }

  getErrorPatterns(): RegExp[] {
    return [
      /error\s+\d+:\d+\s+.+/g,
      /Unexpected token/g,
      /Cannot read property/g,
      /is not defined/g,
      /is not a function/g,
      /Unexpected identifier/g,
      /Missing semicolon/g,
      /Parsing error/g,
    ];
  }

  async validate(workspacePath: string): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // Check if JavaScript/ESLint is available
      const hasJavaScript = await this.checkJavaScriptAvailability(
        workspacePath
      );
      if (!hasJavaScript) {
        return {
          success: true,
          errors: [],
          warnings: ['JavaScript/ESLint not detected in project'],
          duration: Date.now() - startTime,
          language: 'javascript',
        };
      }

      // Run ESLint for JavaScript validation
      const { stdout, stderr } = await execa('npx', ['eslint', '.'], {
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
        language: 'javascript',
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'JavaScript validation failed',
        ],
        duration: Date.now() - startTime,
        language: 'javascript',
      };
    }
  }

  private async checkJavaScriptAvailability(
    workspacePath: string
  ): Promise<boolean> {
    try {
      // Check for package.json
      const { stdout: packageExists } = await execa(
        'test',
        ['-f', 'package.json'],
        {
          cwd: workspacePath,
          reject: false,
        }
      );

      if (packageExists !== '') {
        return false;
      }

      // Check for package.json with JavaScript dependencies
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

        // Check for ESLint or other JavaScript tools
        return Object.keys(dependencies).some(
          dep => dep === 'eslint' || dep === 'jshint' || dep === 'jslint'
        );
      }

      // Check for .js files
      const { stdout: jsFiles } = await execa(
        'find',
        [workspacePath, '-name', '*.js', '-o', '-name', '*.jsx'],
        {
          reject: false,
        }
      );

      return jsFiles.split('\n').filter(Boolean).length > 0;
    } catch {
      return false;
    }
  }

  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match ESLint error patterns
      for (const pattern of this.getErrorPatterns()) {
        const matches = line.match(pattern);
        if (matches) {
          errors.push(line.trim());
          break;
        }
      }

      // Also capture lines that contain error indicators
      if (
        line.includes('error') &&
        (line.includes('.js') || line.includes(':'))
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
      if (line.toLowerCase().includes('warning') || line.includes('warn')) {
        warnings.push(line.trim());
      }
    }

    return [...new Set(warnings)]; // Remove duplicates
  }
}
