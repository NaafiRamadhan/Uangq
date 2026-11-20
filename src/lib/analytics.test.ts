import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../db/schema'
import { calculateMonthlyAnalytics, calculateSevenDayExpenseSeries } from './analytics'

const categories: Pick<Category, 'id' | 'name'>[] = [
  { id: 'food', name: 'Makan' },
  { id: 'travel', name: 'Transportasi' },
]

function transaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    type: 'expense',
    amount: 1_000,
    walletId: 'cash',
    categoryId: 'food',
    note: '',
    date: '2026-04-10',
    createdAt: '',
    ...overrides,
  }
}

function report(month: string, transactions: readonly Transaction[]) {
  return calculateMonthlyAnalytics({ month, transactions, categories })
}

describe('calculateMonthlyAnalytics', () => {
  it('returns a friendly zero-data report for a month without transactions', () => {
    const result = report('2026-04', [])

    expect(result).toMatchObject({
      month: '2026-04',
      totalExpense: 0,
      totalIncome: 0,
      summary: { averagePerDay: 0, busiestDay: null, transactionCount: 0 },
      monthComparison: {
        previousMonth: '2026-03',
        currentExpense: 0,
        previousExpense: 0,
        difference: 0,
        percentageChange: 0,
      },
    })

    expect(result.categorySpending).toEqual([])
    expect(result.trends).toHaveLength(6)
    expect(result.trends.every(({ expense, income }) => expense === 0 && income === 0)).toBe(true)
  })

  it('includes December when calculating the six-month trend ending in January', () => {
    const result = report('2026-01', [
      transaction({ id: 'dec', amount: 30_000, date: '2025-12-30' }),
      transaction({ id: 'jan', type: 'income', amount: 40_000, date: '2026-01-02' }),
    ])

    expect(result.trends.map(({ month }) => month)).toEqual([
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
    ])
    expect(result.trends.slice(-2)).toMatchObject([
      { month: '2025-12', expense: 30_000, income: 0 },
      { month: '2026-01', expense: 0, income: 40_000 },
    ])
    expect(result.monthComparison.previousMonth).toBe('2025-12')
  })

  it('does not count transfers as income or expenses but includes them in transaction count', () => {
    const result = report('2026-04', [
      transaction({ id: 'expense', amount: 500 }),
      transaction({ id: 'income', type: 'income', amount: 1_000 }),
      transaction({ id: 'transfer', type: 'transfer', amount: 2_000 }),
    ])

    expect(result.totalExpense).toBe(500)
    expect(result.totalIncome).toBe(1_000)
    expect(result.summary.transactionCount).toBe(3)
  })

  it('groups expenses without a category into “Tanpa kategori”', () => {
    const result = report('2026-04', [
      transaction({ id: 'categorized', amount: 3_000, categoryId: 'food' }),
      transaction({ id: 'uncategorized', amount: 1_000, categoryId: undefined }),
      transaction({ id: 'unknown-category', amount: 2_000, categoryId: 'missing' }),
    ])

    expect(result.categorySpending).toEqual([
      { categoryId: 'food', categoryName: 'Makan', amount: 3_000, percentage: 50 },
      { categoryId: null, categoryName: 'Tanpa kategori', amount: 3_000, percentage: 50 },
    ])
  })

  it('avoids division by zero when the previous month has no expenses', () => {
    const result = report('2026-04', [
      transaction({ id: 'current-expense', amount: 10_000, date: '2026-04-04' }),
    ])

    expect(result.monthComparison).toEqual({
      previousMonth: '2026-03',
      currentExpense: 10_000,
      previousExpense: 0,
      difference: 10_000,
      percentageChange: null,
    })
  })

  it('calculates the average, busiest day, and category share for a manual scenario', () => {
    const result = report('2026-04', [
      transaction({ id: 'food-one', amount: 30_000, date: '2026-04-02' }),
      transaction({ id: 'food-two', amount: 20_000, date: '2026-04-02' }),
      transaction({ id: 'travel', amount: 40_000, categoryId: 'travel', date: '2026-04-12' }),
      transaction({ id: 'salary', type: 'income', amount: 200_000, date: '2026-04-15' }),
      transaction({ id: 'transfer', type: 'transfer', amount: 90_000, date: '2026-04-20' }),
    ])

    expect(result.totalExpense).toBe(90_000)
    expect(result.totalIncome).toBe(200_000)
    expect(result.categorySpending.map(({ categoryId, categoryName, amount }) => ({
      categoryId,
      categoryName,
      amount,
    }))).toEqual([
      { categoryId: 'food', categoryName: 'Makan', amount: 50_000 },
      { categoryId: 'travel', categoryName: 'Transportasi', amount: 40_000 },
    ])
    expect(result.categorySpending[0].percentage).toBeCloseTo(55.56, 2)
    expect(result.categorySpending[1].percentage).toBeCloseTo(44.44, 2)
    expect(result.summary).toEqual({
      averagePerDay: 3_000,
      busiestDay: { date: '2026-04-02', amount: 50_000 },
      transactionCount: 5,
    })
  })

  it('uses zero and negative percentages correctly for comparison cases', () => {
    const noPreviousExpense = report('2026-04', [
      transaction({ id: 'first-expense', amount: 1_000, date: '2026-04-01' }),
    ])
    const decrease = report('2026-04', [
      transaction({ id: 'march-expense', amount: 5_000, date: '2026-03-01' }),
    ])

    expect(noPreviousExpense.monthComparison.percentageChange).toBeNull()
    expect(decrease.monthComparison).toMatchObject({
      currentExpense: 0,
      previousExpense: 5_000,
      difference: -5_000,
      percentageChange: -100,
    })
  })

  it('truncates the daily average and chooses the earliest day when expenses tie', () => {
    const result = report('2024-02', [
      transaction({ id: 'later', amount: 500, date: '2024-02-20' }),
      transaction({ id: 'earlier', amount: 500, date: '2024-02-03' }),
    ])

    expect(result.summary).toEqual({
      averagePerDay: 34,
      busiestDay: { date: '2024-02-03', amount: 500 },
      transactionCount: 2,
    })
  })
})

describe('calculateSevenDayExpenseSeries', () => {
  it('returns seven zero-value days when there is no spending', () => {
    const result = calculateSevenDayExpenseSeries([], new Date(2026, 3, 10))

    expect(result.days).toHaveLength(7)
    expect(result.days[0].date).toBe('2026-04-04')
    expect(result.days[6].date).toBe('2026-04-10')
    expect(result.days.every(({ amount }) => amount === 0)).toBe(true)
    expect(result.total).toBe(0)
    expect(result.average).toBe(0)
  })

  it('includes only expenses in the seven local calendar days, including across a year boundary', () => {
    const result = calculateSevenDayExpenseSeries([
      transaction({ id: 'previous-year', date: '2025-12-28', amount: 10 }),
      transaction({ id: 'same-day', date: '2026-01-02', amount: 21 }),
      transaction({ id: 'income', type: 'income', date: '2026-01-03', amount: 500 }),
      transaction({ id: 'transfer', type: 'transfer', date: '2026-01-03', amount: 700 }),
      transaction({ id: 'too-old', date: '2025-12-27', amount: 900 }),
    ], new Date(2026, 0, 3))

    expect(result.days.map(({ date }) => date)).toEqual([
      '2025-12-28',
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
    expect(result.days.map(({ amount }) => amount)).toEqual([10, 0, 0, 0, 0, 21, 0])
    expect(result.total).toBe(31)
    expect(result.average).toBe(4)
  })
})
