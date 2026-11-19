import { describe, expect, it } from 'vitest'
import type { Category, Wallet } from '../db/schema'
import { parseQuickEntry, type ParseQuickEntryOptions } from './parser'

const wallets: Pick<Wallet, 'id' | 'name'>[] = [
  { id: 'cash', name: 'Tunai' },
  { id: 'bca', name: 'BCA' },
  { id: 'main', name: 'Dompet Utama' },
  { id: 'default', name: 'Dompet default' },
]

const categories: Pick<Category, 'id' | 'name' | 'group'>[] = [
  { id: 'food', name: 'Makan', group: 'needs' },
  { id: 'transport', name: 'Transportasi', group: 'needs' },
  { id: 'shopping', name: 'Belanja Online', group: 'wants' },
  { id: 'salary', name: 'Gaji', group: 'income' },
]

const options: ParseQuickEntryOptions = {
  today: new Date(2026, 0, 15, 12),
  wallets,
  categories,
  defaultWalletId: 'default',
}

function parse(input: string) {
  return parseQuickEntry(input, options)
}

function parsed(input: string) {
  const result = parse(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result.value
}

describe('parseQuickEntry', () => {
  it('parses the SPEC examples', () => {
    expect(parsed('makan siang 25rb bca')).toMatchObject({
      type: 'expense',
      amount: 25_000,
      walletId: 'bca',
      categoryId: 'food',
      note: 'makan siang',
      date: '2026-01-15',
    })
    expect(parsed('gaji 5jt')).toMatchObject({
      type: 'income',
      amount: 5_000_000,
      walletId: 'default',
      categoryId: 'salary',
      note: 'gaji',
    })
    expect(parsed('kemarin bensin 30rb tunai')).toMatchObject({
      type: 'expense',
      amount: 30_000,
      walletId: 'cash',
      note: 'bensin',
      date: '2026-01-14',
    })
    expect(parsed('kopi 1,5k')).toMatchObject({ amount: 1_500, note: 'kopi' })
    expect(parse('belanja').ok).toBe(false)
  })

  it('supports integer amounts and dot-separated thousands', () => {
    expect(parsed('kopi 25000').amount).toBe(25_000)
    expect(parsed('belanja 25.000').amount).toBe(25_000)
    expect(parsed('tabungan 1.000.000')).toMatchObject({ amount: 1_000_000, note: 'tabungan' })
  })

  it.each([
    ['1,5jt', 1_500_000],
    ['1.5jt', 1_500_000],
    ['2jt', 2_000_000],
    ['500 ribu', 500_000],
    ['1 juta', 1_000_000],
  ])('converts %s to whole rupiah', (amount, expected) => {
    expect(parsed(`tabungan ${amount}`).amount).toBe(expected)
  })

  it('rejects missing and multiple amounts rather than guessing', () => {
    expect(parse('belanja kebutuhan bulanan').ok).toBe(false)
    const result = parse('kopi 10rb dan roti 5rb')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/nominal/i)
  })

  it('recognizes income keywords and wallet names without case sensitivity', () => {
    expect(parsed('GAJI 5JT BCA')).toMatchObject({
      type: 'income',
      amount: 5_000_000,
      walletId: 'bca',
    })
    expect(parsed('TERIMA BONUS 2rb tunai').type).toBe('income')
  })

  it('matches wallet names across repeated spaces and prefers the explicit wallet', () => {
    expect(parsed('belanja 2rb DOMPET   UTAMA')).toMatchObject({
      walletId: 'main',
      note: 'belanja',
    })
    expect(parsed('makan 2rb bca').walletId).toBe('bca')
  })

  it('uses the selected default wallet only when the text has no wallet name', () => {
    expect(parsed('makan 2rb').walletId).toBe('default')
    expect(parseQuickEntry('makan 2rb', { ...options, defaultWalletId: undefined })).toMatchObject({
      ok: true,
      value: { walletId: '' },
    })
  })

  it('recognizes relative dates and removes date words from the note', () => {
    expect(parsed('hari ini kopi 2rb')).toMatchObject({ date: '2026-01-15', note: 'kopi' })
    expect(parsed('lusa lalu bensin 2rb')).toMatchObject({ date: '2026-01-13', note: 'bensin' })
  })

  it('recognizes a day in the current month and Indonesian month names', () => {
    expect(parsed('tgl 5 makan 2rb')).toMatchObject({ date: '2026-01-05', note: 'makan' })
    expect(parsed('5 mar makan 2rb')).toMatchObject({ date: '2026-03-05', note: 'makan' })
    expect(parsed('5 maret makan 2rb').date).toBe('2026-03-05')
  })

  it('normalizes repeated whitespace in the remaining note', () => {
    expect(parsed('  makan   siang   25rb   bca  ')).toMatchObject({
      note: 'makan siang',
      walletId: 'bca',
    })
  })

  it('matches a category name and leaves the category editable in the result', () => {
    expect(parsed('belanja online 50rb')).toMatchObject({
      categoryId: 'shopping',
      note: 'belanja online',
    })
  })

  it('rejects ambiguous wallet mentions and invalid calendar dates', () => {
    expect(parse('tunai 2rb bca').ok).toBe(false)
    expect(parse('tgl 32 makan 2rb').ok).toBe(false)
    expect(parse('32 feb makan 2rb').ok).toBe(false)
  })
})
