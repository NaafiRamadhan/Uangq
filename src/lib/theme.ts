export type ThemeMode = 'system' | 'light' | 'dark'
export type EffectiveTheme = 'light' | 'dark'

export const THEME_CACHE_KEY = 'uangq.themeMode'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'system') return 'light'
  return mode === 'light' ? 'dark' : 'system'
}

export function getEffectiveTheme(mode: ThemeMode, prefersDark: boolean): EffectiveTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function applyThemeToDocument(mode: ThemeMode, prefersDark: boolean): void {
  const effectiveTheme = getEffectiveTheme(mode, prefersDark)
  document.documentElement.dataset.theme = mode

  const themeColor = document.querySelector<HTMLMetaElement>('#theme-color-meta')
  if (!themeColor) throw new Error('Elemen meta warna tema tidak ditemukan.')
  themeColor.content = effectiveTheme === 'dark' ? '#050505' : '#ffffff'
}
