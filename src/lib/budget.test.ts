import { describe, expect, it } from 'vitest'
import type { Budget, Category, Transaction } from '../db/schema'
import { calculateBudgetOverview, getMonthActivityDates, getDaysRemainingInMonth } from './budget'

const budget: Budget = {
  id: 'budget-2026-04',
  month: '2026-04',
  total: 31_000,
  splitNeeds: 50,
  splitWants: 30,
  splitSavings: 20,
}

const categories: Pick<Category, 'id' | 'name' | 'group'>[] = [
  { id: 'food', name: 'Makan', group: 'needs' },
  { id: 'fun', name: 'Hobi', group: 'wants' },
  { id: 'savings', name: 'Tabungan', group: 'savings' },
  { id: 'salary', name: 'Gaji', group: 'income' },
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

describe('calculateBudgetOverview', () => {
  it('handles a month without transactions and allocates the whole budget', () => {
    const result = calculateBudgetOverview({
      budget,
      budgetItems: [],
      categories,
      transactions: [],
      today: new Date(2026, 3, 10),
    })

    expect(result.totalSpent).toBe(0)
    expect(result.monthRemaining).toBe(31_000)
    expect(result.daysRemaining).toBe(21)
    expect(result.dailyRemaining).toBe(1_476)
    expect(result.groups.map(({ limit }) => limit)).toEqual([15_500, 9_300, 6_200])
  })

  it('marks group and category spending as over budget', () => {
    const result = calculateBudgetOverview({
      budget: { ...budget, total: 100_000 },
      budgetItems: [{ id: 'food-limit', month: budget.month, categoryId: 'food', limit: 40_000 }],
      categories,
      transactions: [transaction({ id: 'food-1', amount: 60_000 })],
      today: new Date(2026, 3, 10),
    })

    expect(result.groups.find(({ group }) => group === 'needs')).toMatchObject({
      limit: 50_000,
      spent: 60_000,
      status: 'over',
    })
    expect(result.categories.find(({ categoryId }) => categoryId === 'food')).toMatchObject({
      limit: 40_000,
      spent: 60_000,
      status: 'over',
    })
    expect(result.monthRemaining).toBe(40_000)
  })

  it('marks group and category spending at 80 percent as near the limit', () => {
    const result = calculateBudgetOverview({
      budget: { ...budget, total: 100_000 },
      budgetItems: [{ id: 'food-limit', month: budget.month, categoryId: 'food', limit: 40_000 }],
      categories,
      transactions: [transaction({ id: 'food-1', amount: 40_000 })],
      today: new Date(2026, 3, 10),
    })

    expect(result.groups.find(({ group }) => group === 'needs')?.status).toBe('near')
    expect(result.categories.find(({ categoryId }) => categoryId === 'food')?.status).toBe('near')
  })

  it('counts today in the remaining days on both the first and last day of a month', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 3, 1))).toBe(30)
    expect(getDaysRemainingInMonth(new Date(2026, 3, 30))).toBe(1)

    const firstDay = calculateBudgetOverview({
      budget: { ...budget, total: 1_000 },
      budgetItems: [],
      categories,
      transactions: [],
      today: new Date(2026, 3, 1),
    })
    const lastDay = calculateBudgetOverview({
      budget: { ...budget, total: 1_000 },
      budgetItems: [],
      categories,
      transactions: [],
      today: new Date(2026, 3, 30),
    })

    expect(firstDay.dailyRemaining).toBe(33)
    expect(lastDay.dailyRemaining).toBe(1_000)
  })

  it('truncates the daily amount toward zero and includes today in the divisor', () => {
    const first = calculateBudgetOverview({
      budget: { ...budget, total: 1_000 },
      budgetItems: [],
      categories,
      transactions: [],
      today: new Date(2026, 3, 28),
    })
    const overspent = calculateBudgetOverview({
      budget: { ...budget, total: 1_000 },
      budgetItems: [],
      categories,
      transactions: [transaction({ id: 'overspend', amount: 2_000 })],
      today: new Date(2026, 3, 28),
    })

    expect(first.daysRemaining).toBe(3)
    expect(first.dailyRemaining).toBe(333)
    expect(overspent.dailyRemaining).toBe(-333)
  })

  it('assigns allocation rounding remainders deterministically without changing the total', () => {
    const result = calculateBudgetOverview({
      budget: { ...budget, total: 1, splitNeeds: 34, splitWants: 33, splitSavings: 33 },
      budgetItems: [],
      categories,
      transactions: [],
      today: new Date(2026, 3, 10),
    })

    expect(result.groups.map(({ limit }) => limit)).toEqual([1, 0, 0])
    expect(result.groups.reduce((sum, group) => sum + group.limit, 0)).toBe(1)
  })
})

describe('getMonthActivityDates', () => {
  it('returns unique activity dates only within the selected month', () => {
    const transactions = [
      transaction({ id: 'a', date: '2026-04-02' }),
      transaction({ id: 'b', date: '2026-04-02', type: 'income' }),
      transaction({ id: 'c', date: '2026-05-01' }),
      transaction({ id: 'd', date: '2026-03-31' }),
    ]

    expect(getMonthActivityDates('2026-04', transactions)).toEqual(['2026-04-02'])
  })

  it('includes December activity without leaking it into the next year', () => {
    const transactions = [
      transaction({ id: 'december', date: '2025-12-31' }),
      transaction({ id: 'january', date: '2026-01-01' }),
    ]

    expect(getMonthActivityDates('2025-12', transactions)).toEqual(['2025-12-31'])
  })
})
