import { describe, expect, it } from 'vitest'
import type { Transaction, Wallet } from '../db/schema'
import { calculateWalletBalances } from './balances'

const wallets: Wallet[] = [
  { id: 'cash', name: 'Tunai', type: 'cash', initialBalance: 100_000, archived: false, createdAt: '' },
  { id: 'bank', name: 'Bank', type: 'bank', initialBalance: 50_000, archived: false, createdAt: '' },
]

function transaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    type: 'expense',
    amount: 10_000,
    walletId: 'cash',
    note: '',
    date: '2026-01-01',
    createdAt: '',
    ...overrides,
  }
}

describe('calculateWalletBalances', () => {
  it('combines opening balances, income, and expenses using whole rupiah', () => {
    const balances = calculateWalletBalances(wallets, [
      transaction({ id: 'salary', type: 'income', amount: 25_000, walletId: 'cash' }),
      transaction({ id: 'meal', type: 'expense', amount: 8_000, walletId: 'cash' }),
    ])

    expect(balances.get('cash')).toBe(117_000)
    expect(balances.get('bank')).toBe(50_000)
  })

  it('recalculates balances when an existing transaction is edited', () => {
    const original = transaction({ id: 'meal', amount: 20_000 })
    const edited = { ...original, amount: 12_000 }

    expect(calculateWalletBalances(wallets, [original]).get('cash')).toBe(80_000)
    expect(calculateWalletBalances(wallets, [edited]).get('cash')).toBe(88_000)
  })

  it('restores the balance when a transaction is deleted', () => {
    const transactions = [
      transaction({ id: 'meal', amount: 20_000 }),
      transaction({ id: 'fare', amount: 5_000 }),
    ]

    expect(calculateWalletBalances(wallets, transactions).get('cash')).toBe(75_000)
    expect(calculateWalletBalances(wallets, transactions.filter(({ id }) => id !== 'meal')).get('cash')).toBe(95_000)
  })

  it('moves transfer amounts from the source wallet to the destination wallet', () => {
    const balances = calculateWalletBalances(wallets, [
      transaction({ id: 'transfer', type: 'transfer', amount: 30_000, walletId: 'cash', toWalletId: 'bank' }),
    ])

    expect(balances.get('cash')).toBe(70_000)
    expect(balances.get('bank')).toBe(80_000)
  })

  it('does not depend on transaction iteration order when the final balance is safe', () => {
    const wallet = { ...wallets[0], initialBalance: Number.MAX_SAFE_INTEGER }
    const transactions = [
      transaction({ id: 'income', type: 'income', amount: 1 }),
      transaction({ id: 'expense', type: 'expense', amount: 1 }),
    ]

    expect(calculateWalletBalances([wallet], transactions).get('cash')).toBe(Number.MAX_SAFE_INTEGER)
    expect(calculateWalletBalances([wallet], [...transactions].reverse()).get('cash')).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('rejects invalid transaction amounts and transfer destinations', () => {
    expect(() => calculateWalletBalances(wallets, [transaction({ id: 'fraction', amount: 1.5 })])).toThrow(
      'bilangan bulat positif',
    )
    expect(() => calculateWalletBalances(wallets, [
      transaction({ id: 'self-transfer', type: 'transfer', toWalletId: 'cash' }),
    ])).toThrow('tidak valid')
  })
})
