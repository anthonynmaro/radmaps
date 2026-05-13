function normalizeHex(color: string): string | null {
  const value = color.trim()
  const short = /^#([0-9a-f]{3})$/i.exec(value)
  if (short) {
    return `#${short[1].split('').map(char => char + char).join('').toUpperCase()}`
  }
  const full = /^#([0-9a-f]{6})$/i.exec(value)
  return full ? `#${full[1].toUpperCase()}` : null
}

function channelToLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.03928
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: string): number | null {
  const hex = normalizeHex(color)
  if (!hex) return null

  const r = channelToLinear(parseInt(hex.slice(1, 3), 16))
  const g = channelToLinear(parseInt(hex.slice(3, 5), 16))
  const b = channelToLinear(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a)
  const lumB = relativeLuminance(b)
  if (lumA == null || lumB == null) return 1

  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

export function pickContrastSafeColor(background: string, candidates: Array<string | undefined>, minimumRatio = 4.5): string {
  const valid = candidates.filter((candidate): candidate is string => !!candidate && !!normalizeHex(candidate))
  const passing = valid.find(candidate => contrastRatio(candidate, background) >= minimumRatio)
  if (passing) return passing

  return valid
    .concat(['#111111', '#FFFFFF'])
    .sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0]
}
