import { describe, expect, it } from 'vitest'
import {
  formatMoneyInput,
  getMoneyInputCaretPosition,
  parseMoneyInput,
} from './money'

describe('parseMoneyInput', () => {
  it('removes all non-digit characters', () => {
    expect(parseMoneyInput('Rp 25.000')).toBe(25_000)
    expect(parseMoneyInput('2a5,0-0')).toBe(2_500)
  })

  it('removes leading zeroes but keeps zero', () => {
    expect(parseMoneyInput('0025')).toBe(25)
    expect(parseMoneyInput('000')).toBe(0)
    expect(parseMoneyInput('0')).toBe(0)
  })

  it('keeps an empty input empty', () => {
    expect(parseMoneyInput('')).toBe('')
    expect(parseMoneyInput('Rp .')).toBe('')
  })

  it('parses pasted rupiah and plain digits identically', () => {
    expect(parseMoneyInput('Rp 1.500.000')).toBe(1_500_000)
    expect(parseMoneyInput('1500000')).toBe(1_500_000)
  })

  it('rejects values above the safe integer limit', () => {
    expect(parseMoneyInput('9007199254740992')).toBeNull()
    expect(parseMoneyInput(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('formatMoneyInput', () => {
  it('groups digits in threes from the right without changing the amount', () => {
    expect(formatMoneyInput(25_000)).toBe('25.000')
    expect(formatMoneyInput(1_500_000)).toBe('1.500.000')
  })

  it('formats pasted text and preserves empty and zero values', () => {
    expect(formatMoneyInput('Rp 1.500.000')).toBe('1.500.000')
    expect(formatMoneyInput('')).toBe('')
    expect(formatMoneyInput(0)).toBe('0')
    expect(formatMoneyInput(-25_000)).toBe('-25.000')
  })

  it('rejects unsafe values instead of displaying a rounded amount', () => {
    expect(() => formatMoneyInput(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
  })
})

describe('getMoneyInputCaretPosition', () => {
  it('keeps the cursor after the same digit when separators shift', () => {
    expect(getMoneyInputCaretPosition('12.345', 3)).toBe(4)
  })

  it('places the cursor beside the separator after its deletion', () => {
    expect(getMoneyInputCaretPosition('25.000', 2)).toBe(2)
  })
})
