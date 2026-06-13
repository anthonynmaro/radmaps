// Pure CLI option parsing for the theme review matrix mode of
// scripts/capture-theme-audit.mjs. Kept dependency-free so unit tests can
// import it without touching Playwright/sharp or the capture flow.

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ matrix: boolean, help: boolean, matrixOut: string, archetypeFilter: string[] }}
 */
export function parseMatrixOptions(argv) {
  const value = (name) => {
    const prefix = `--${name}=`
    const found = argv.find(arg => arg.startsWith(prefix))
    return found ? found.slice(prefix.length) : undefined
  }
  const flag = (name) => argv.includes(`--${name}`)
    || ['1', 'true', 'yes'].includes((value(name) ?? '').toLowerCase())

  return {
    matrix: flag('matrix'),
    help: argv.includes('--help') || argv.includes('-h'),
    matrixOut: value('matrix-out') || 'docs/theme_matrix',
    archetypeFilter: (value('archetype') ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean),
  }
}
