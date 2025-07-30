import { execa } from 'execa';
import { CompilationResult, CompilationValidator } from '../types/patch.js';

export class RustValidator implements CompilationValidator {
  getLanguage(): string {
    return 'rust';
  }

  getCompilationCommand(): string[] {
    return ['cargo', 'check'];
  }

  getErrorPatterns(): RegExp[] {
    return [
      /error\[E\d+\]: .+/g,
      /error: .+/g,
      /cannot find .+/g,
      /expected .+, found .+/g,
      /mismatched types/g,
      /unused variable/g,
      /unused import/g,
      /unreachable code/g,
      /borrow checker/g,
      /lifetime .+ does not live long enough/g,
    ];
  }

  async validate(workspacePath: string): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // Check if Rust is available
      const hasRust = await this.checkRustAvailability(workspacePath);
      if (!hasRust) {
        return {
          success: true,
          errors: [],
          warnings: ['Rust not detected in project'],
          duration: Date.now() - startTime,
          language: 'rust',
        };
      }

      // Run Rust compilation check
      const { stdout, stderr } = await execa('cargo', ['check'], {
        cwd: workspacePath,
        timeout: 60000, // 60 second timeout for Rust
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
        language: 'rust',
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Rust validation failed',
        ],
        duration: Date.now() - startTime,
        language: 'rust',
      };
    }
  }

  private async checkRustAvailability(workspacePath: string): Promise<boolean> {
    try {
      // Check for Cargo.toml
      const { stdout: cargoExists } = await execa(
        'test',
        ['-f', 'Cargo.toml'],
        {
          cwd: workspacePath,
          reject: false,
        }
      );

      if (cargoExists === '') {
        return true;
      }

      // Check for rustc availability
      const { stdout: rustcVersion } = await execa('rustc', ['--version'], {
        reject: false,
      });

      return rustcVersion.includes('rustc');
    } catch {
      return false;
    }
  }

  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match Rust error patterns
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
        (line.includes('.rs') || line.includes('-->'))
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
      if (line.toLowerCase().includes('warning') || line.includes('unused')) {
        warnings.push(line.trim());
      }
    }

    return [...new Set(warnings)]; // Remove duplicates
  }
}
