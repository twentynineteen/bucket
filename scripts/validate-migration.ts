#!/usr/bin/env node

/**
 * Migration Validation Script
 *
 * Validates the Legacy useEffect to React Query migration by:
 * - Checking that all hooks use React Query patterns
 * - Ensuring no legacy useEffect patterns remain for data fetching
 * - Validating query key consistency
 * - Checking error handling patterns
 * - Verifying cache configuration
 */
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ValidationResult {
  passed: boolean
  message: string
  file?: string
  line?: number
  severity: 'error' | 'warning' | 'info'
}

interface MigrationValidationReport {
  summary: {
    totalFiles: number
    passedValidation: boolean
    errorsCount: number
    warningsCount: number
  }
  results: ValidationResult[]
  recommendations: string[]
}

class MigrationValidator {
  private srcPath: string
  private results: ValidationResult[] = []

  constructor(srcPath = './src') {
    this.srcPath = path.resolve(srcPath)
  }

  /**
   * Run full migration validation
   */
  async validate(): Promise<MigrationValidationReport> {
    console.log('🔍 Starting React Query migration validation...\n')

    this.results = []

    // Check infrastructure files
    await this.validateInfrastructure()

    // Check hook migrations
    await this.validateHooks()

    // Check component migrations
    await this.validateComponents()

    // Check for legacy patterns
    await this.checkForLegacyPatterns()

    // Validate TypeScript compilation
    await this.validateTypeScriptCompilation()

    // Generate report
    const report = this.generateReport()

    console.log('\n📊 Validation complete!')
    this.printReport(report)

    return report
  }

  /**
   * Check that required infrastructure files exist and are configured properly
   */
  private async validateInfrastructure() {
    console.log('📦 Validating infrastructure files...')

    const requiredFiles = [
      'lib/query-utils.ts',
      'lib/query-keys.ts',
      'lib/prefetch-strategies.ts',
      'lib/query-client-config.ts',
      'lib/performance-monitor.ts',
      'services/cache-invalidation.ts',
      'components/ErrorBoundary.tsx'
    ]

    for (const file of requiredFiles) {
      const filePath = path.join(this.srcPath, file)
      if (fs.existsSync(filePath)) {
        this.results.push({
          passed: true,
          message: `Infrastructure file exists: ${file}`,
          file,
          severity: 'info'
        })

        // Check file content for basic patterns
        await this.validateFileContent(filePath, file)
      } else {
        this.results.push({
          passed: false,
          message: `Missing required infrastructure file: ${file}`,
          file,
          severity: 'error'
        })
      }
    }
  }

  /**
   * Validate hook migrations
   */
  private async validateHooks() {
    console.log('🎣 Validating hook migrations...')

    const hooksDir = path.join(this.srcPath, 'hooks')
    if (!fs.existsSync(hooksDir)) {
      this.results.push({
        passed: false,
        message: 'Hooks directory not found',
        severity: 'error'
      })
      return
    }

    const hookFiles = fs
      .readdirSync(hooksDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))

    for (const hookFile of hookFiles) {
      await this.validateHookFile(path.join(hooksDir, hookFile), hookFile)
    }
  }

  /**
   * Validate component migrations
   */
  private async validateComponents() {
    console.log('🧩 Validating component migrations...')

    const componentDirs = ['components', 'pages']

    for (const dir of componentDirs) {
      const dirPath = path.join(this.srcPath, dir)
      if (fs.existsSync(dirPath)) {
        await this.validateComponentDir(dirPath, dir)
      }
    }
  }

  /**
   * Check for legacy useEffect data fetching patterns
   */
  private async checkForLegacyPatterns() {
    console.log('🕵️ Checking for legacy patterns...')

    const searchPatterns = [
      {
        pattern: 'useEffect.*fetch',
        description: 'useEffect with fetch calls (should use React Query)',
        severity: 'warning' as const
      },
      {
        pattern: 'useEffect.*axios',
        description: 'useEffect with axios calls (should use React Query)',
        severity: 'warning' as const
      },
      {
        pattern: 'useEffect.*invoke.*\\[.*\\]',
        description: 'useEffect with Tauri invoke calls (should use React Query)',
        severity: 'warning' as const
      },
      {
        pattern: 'useState.*loading',
        description: 'Manual loading state (React Query provides this)',
        severity: 'info' as const
      }
    ]

    for (const { pattern, description, severity } of searchPatterns) {
      await this.searchPattern(pattern, description, severity)
    }
  }

  /**
   * Validate TypeScript compilation
   */
  private async validateTypeScriptCompilation() {
    console.log('📝 Validating TypeScript compilation...')

    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit --skipLibCheck')

      if (stderr) {
        this.results.push({
          passed: false,
          message: `TypeScript compilation errors: ${stderr}`,
          severity: 'error'
        })
      } else {
        this.results.push({
          passed: true,
          message: 'TypeScript compilation successful',
          severity: 'info'
        })
      }
    } catch (error: any) {
      this.results.push({
        passed: false,
        message: `TypeScript compilation failed: ${error.message}`,
        severity: 'error'
      })
    }
  }

  /**
   * Validate specific hook file
   */
  private async validateHookFile(filePath: string, fileName: string) {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check if hook uses React Query
    if (content.includes('@tanstack/react-query')) {
      this.results.push({
        passed: true,
        message: `Hook uses React Query: ${fileName}`,
        file: fileName,
        severity: 'info'
      })

      // Check for proper error handling
      if (content.includes('createQueryError')) {
        this.results.push({
          passed: true,
          message: `Hook uses proper error handling: ${fileName}`,
          file: fileName,
          severity: 'info'
        })
      } else {
        this.results.push({
          passed: false,
          message: `Hook missing proper error handling: ${fileName}`,
          file: fileName,
          severity: 'warning'
        })
      }

      // Check for proper query keys
      if (content.includes('queryKeys.')) {
        this.results.push({
          passed: true,
          message: `Hook uses query key factory: ${fileName}`,
          file: fileName,
          severity: 'info'
        })
      } else {
        this.results.push({
          passed: false,
          message: `Hook should use query key factory: ${fileName}`,
          file: fileName,
          severity: 'warning'
        })
      }
    } else if (content.includes('useEffect') && fileName.startsWith('use')) {
      // This is a custom hook with useEffect - check if it's doing data fetching
      if (
        content.includes('fetch') ||
        content.includes('invoke') ||
        content.includes('axios')
      ) {
        this.results.push({
          passed: false,
          message: `Hook still uses useEffect for data fetching: ${fileName}`,
          file: fileName,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Validate component directory recursively
   */
  private async validateComponentDir(dirPath: string, dirName: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        await this.validateComponentDir(fullPath, entry.name)
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        await this.validateComponentFile(fullPath, entry.name)
      }
    }
  }

  /**
   * Validate specific component file
   */
  private async validateComponentFile(filePath: string, fileName: string) {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check if component imports React Query
    if (content.includes('@tanstack/react-query')) {
      this.results.push({
        passed: true,
        message: `Component uses React Query: ${fileName}`,
        file: fileName,
        severity: 'info'
      })
    }

    // Check for potential legacy data fetching in useEffect
    const useEffectMatches = content.match(/useEffect\s*\([^)]*\)/g) || []

    for (const match of useEffectMatches) {
      const fullEffectMatch = this.extractUseEffectContent(content, match)

      if (
        fullEffectMatch &&
        (fullEffectMatch.includes('fetch') ||
          fullEffectMatch.includes('invoke') ||
          fullEffectMatch.includes('axios'))
      ) {
        this.results.push({
          passed: false,
          message: `Component has useEffect with data fetching: ${fileName}`,
          file: fileName,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Validate file content for basic patterns
   */
  private async validateFileContent(filePath: string, fileName: string) {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check for proper exports
    if (
      content.includes('export') &&
      (content.includes('default') || content.includes('export const'))
    ) {
      this.results.push({
        passed: true,
        message: `File has proper exports: ${fileName}`,
        file: fileName,
        severity: 'info'
      })
    }

    // Check for TypeScript types
    if (content.includes('interface') || content.includes('type ')) {
      this.results.push({
        passed: true,
        message: `File uses TypeScript types: ${fileName}`,
        file: fileName,
        severity: 'info'
      })
    }
  }

  /**
   * Search for patterns across all source files
   */
  private async searchPattern(
    pattern: string,
    description: string,
    severity: 'error' | 'warning' | 'info'
  ) {
    try {
      const { stdout } = await execAsync(
        `grep -r "${pattern}" ${this.srcPath} --include="*.ts" --include="*.tsx" -n`
      )

      if (stdout.trim()) {
        const lines = stdout.trim().split('\n')
        for (const line of lines) {
          const [filePath, lineNum, ...content] = line.split(':')
          const fileName = path.relative(this.srcPath, filePath)

          this.results.push({
            passed: severity === 'info',
            message: `${description}: ${content.join(':')}`,
            file: fileName,
            line: parseInt(lineNum),
            severity
          })
        }
      }
    } catch (error) {
      // Pattern not found - this is often good for legacy patterns
    }
  }

  /**
   * Extract full useEffect content for analysis
   */
  private extractUseEffectContent(
    content: string,
    useEffectMatch: string
  ): string | null {
    const startIndex = content.indexOf(useEffectMatch)
    if (startIndex === -1) return null

    let braceCount = 0
    let inEffect = false
    let result = ''

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i]

      if (char === '{') {
        braceCount++
        inEffect = true
      } else if (char === '}') {
        braceCount--
      }

      if (inEffect) {
        result += char
      }

      if (inEffect && braceCount === 0) {
        break
      }
    }

    return result
  }

  /**
   * Generate validation report
   */
  private generateReport(): MigrationValidationReport {
    const errors = this.results.filter(r => r.severity === 'error')
    const warnings = this.results.filter(r => r.severity === 'warning')
    const totalFiles = new Set(this.results.map(r => r.file).filter(Boolean)).size

    const recommendations = []

    if (errors.length > 0) {
      recommendations.push('Fix all errors before considering the migration complete')
    }

    if (warnings.length > 5) {
      recommendations.push('Consider addressing warning patterns to improve code quality')
    }

    const hasLegacyPatterns = this.results.some(
      r => r.message.includes('useEffect with') && r.severity === 'warning'
    )

    if (hasLegacyPatterns) {
      recommendations.push(
        'Replace remaining useEffect data fetching patterns with React Query'
      )
    }

    if (this.results.every(r => r.passed || r.severity === 'warning')) {
      recommendations.push(
        'Migration appears successful! Consider running integration tests'
      )
    }

    return {
      summary: {
        totalFiles,
        passedValidation: errors.length === 0,
        errorsCount: errors.length,
        warningsCount: warnings.length
      },
      results: this.results,
      recommendations
    }
  }

  /**
   * Print validation report to console
   */
  private printReport(report: MigrationValidationReport) {
    console.log('\n' + '='.repeat(60))
    console.log('📋 MIGRATION VALIDATION REPORT')
    console.log('='.repeat(60))

    console.log(`\n📊 Summary:`)
    console.log(`   Files analyzed: ${report.summary.totalFiles}`)
    console.log(
      `   Validation: ${report.summary.passedValidation ? '✅ PASSED' : '❌ FAILED'}`
    )
    console.log(`   Errors: ${report.summary.errorsCount}`)
    console.log(`   Warnings: ${report.summary.warningsCount}`)

    if (report.results.filter(r => r.severity === 'error').length > 0) {
      console.log('\n❌ Errors:')
      report.results
        .filter(r => r.severity === 'error')
        .forEach(r => {
          console.log(`   • ${r.message}`)
          if (r.file) console.log(`     File: ${r.file}${r.line ? `:${r.line}` : ''}`)
        })
    }

    if (report.results.filter(r => r.severity === 'warning').length > 0) {
      console.log('\n⚠️  Warnings:')
      report.results
        .filter(r => r.severity === 'warning')
        .slice(0, 10) // Limit displayed warnings
        .forEach(r => {
          console.log(`   • ${r.message}`)
          if (r.file) console.log(`     File: ${r.file}${r.line ? `:${r.line}` : ''}`)
        })

      const remainingWarnings =
        report.results.filter(r => r.severity === 'warning').length - 10
      if (remainingWarnings > 0) {
        console.log(`   ... and ${remainingWarnings} more warnings`)
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`)
      })
    }

    console.log('\n' + '='.repeat(60))
  }
}

/**
 * Main execution
 */
async function main() {
  const validator = new MigrationValidator()
  const report = await validator.validate()

  // Exit with error code if validation failed
  if (!report.summary.passedValidation) {
    process.exit(1)
  }

  process.exit(0)
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Validation failed:', error)
    process.exit(1)
  })
}

export { MigrationValidator, type MigrationValidationReport, type ValidationResult }
