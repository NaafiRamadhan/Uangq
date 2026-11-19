import { describe, expect, it } from 'vitest'
import { getEffectiveTheme, isThemeMode, nextThemeMode } from './theme'

describe('theme mode', () => {
  it('cycles from system to light, dark, then system', () => {
    expect(nextThemeMode('system')).toBe('light')
    expect(nextThemeMode('light')).toBe('dark')
    expect(nextThemeMode('dark')).toBe('system')
  })

  it('resolves system mode using the device preference', () => {
    expect(getEffectiveTheme('system', false)).toBe('light')
    expect(getEffectiveTheme('system', true)).toBe('dark')
    expect(getEffectiveTheme('light', true)).toBe('light')
    expect(getEffectiveTheme('dark', false)).toBe('dark')
  })

  it('accepts only supported stored modes', () => {
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('system')).toBe(true)
    expect(isThemeMode('sepia')).toBe(false)
  })
})
