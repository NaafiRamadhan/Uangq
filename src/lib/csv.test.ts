import { describe, expect, it } from 'vitest'
import type { Category, Transaction, Wallet } from '../db/schema'
import { createTransactionsCsv } from './csv'

const wallets: Wallet[] = [
  { id: 'cash', name: 'Tunai, utama', type: 'cash', initialBalance: 0, archived: false, createdAt: '' },
  { id: 'bank', name: 'Bank "A"', type: 'bank', initialBalance: 0, archived: false, createdAt: '' },
]
const categories: Category[] = [
  { id: 'food', name: 'Makan', group: 'needs', icon: 'food', archived: false },
]

function transaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    type: 'expense',
    amount: 25_000,
    walletId: 'cash',
    categoryId: 'food',
    note: '',
    date: '2026-11-19',
    createdAt: '2026-11-19T10:00:00.000Z',
    ...overrides,
  }
}

describe('createTransactionsCsv', () => {
  it('quotes every column and doubles embedded quotes while preserving commas', () => {
    const csv = createTransactionsCsv([
      transaction({ id: 'expense', note: 'makan, "enak"' }),
    ], wallets, categories)

    expect(csv).toBe([
      '"tanggal","tipe","jumlah","dompet","kategori","catatan"',
      '"2026-11-19","Pengeluaran","25000","Tunai, utama","Makan","makan, ""enak"""',
    ].join('\r\n'))
  })

  it('keeps multiline notes inside a quoted field and formats transfers without a category', () => {
    const csv = createTransactionsCsv([
      transaction({
        id: 'transfer',
        type: 'transfer',
        walletId: 'cash',
        toWalletId: 'bank',
        categoryId: undefined,
        note: 'pindah dana\nantar dompet',
      }),
    ], wallets, categories)

    expect(csv).toContain('"Transfer","25000","Tunai, utama → Bank ""A""","","pindah dana\nantar dompet"')
  })

  it('exports formula-like notes as text', () => {
    const csv = createTransactionsCsv([
      transaction({ id: 'formula', note: '=SUM(1,2)' }),
    ], wallets, categories)

    expect(csv).toContain(`"'=SUM(1,2)"`)
  })
})
