import type { Budget, BudgetItem, Category, Transaction } from '../db/schema'
import {
  calculateBudgetOverview,
  getMonthActivityDates,
  type BudgetOverview,
} from './budget'

export const significantCategoryIncreaseThreshold = 100_000

export type CategorySpending = {
  categoryId: string | null
  categoryName: string
  amount: number
  percentage: number
}

export type MonthlyTrend = {
  month: string
  expense: number
  income: number
}

export type CategorySpendingChange = {
  categoryId: string | null
  categoryName: string
  currentAmount: number
  previousAmount: number
  difference: number
  percentageChange: number | null
  isNew: boolean
  isSignificantIncrease: boolean
}

export type TrendChartGeometry = {
  xPositions: number[]
  expenseLine: string
  expenseArea: string
  incomeLine: string
  incomeArea: string
}

export type MonthlyAnalytics = {
  month: string
  totalExpense: number
  totalIncome: number
  categorySpending: CategorySpending[]
  trends: MonthlyTrend[]
  monthComparison: {
    previousMonth: string
    currentExpense: number
    previousExpense: number
    difference: number
    percentageChange: number | null
  }
  insights: {
    largestCategory: CategorySpending | null
    categoryChanges: CategorySpendingChange[]
    projectedExpense: number | null
  }
  summary: {
    averagePerDay: number
    busiestDay: { date: string; amount: number } | null
    transactionCount: number
  }
}

export function projectMonthEndExpense(totalExpense: number, month: string, today: Date): number | null {
  validateMonth(month)
  if (!Number.isSafeInteger(totalExpense) || totalExpense < 0) {
    throw new RangeError('Total pengeluaran harus berupa bilangan bulat rupiah nonnegatif.')
  }
  if (Number.isNaN(today.getTime())) throw new RangeError('Tanggal acuan laporan tidak valid.')

  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (month > currentMonth) return null

  const days = daysInMonth(month)
  const elapsedDays = month === currentMonth ? today.getDate() : days
  return toSafeNumber(
    BigInt(totalExpense) * BigInt(days) / BigInt(elapsedDays),
    'Proyeksi pengeluaran akhir bulan',
  )
}

export function calculateReportBudgetProgress({
  month,
  budget,
  budgetItems,
  categories,
  transactions,
  today = new Date(),
}: {
  month: string
  budget: Budget | null
  budgetItems: readonly BudgetItem[]
  categories: readonly Pick<Category, 'id' | 'group'>[]
  transactions: readonly Transaction[]
  today?: Date
}): BudgetOverview | null {
  validateMonth(month)
  if (!budget) return null
  if (budget.month !== month) throw new RangeError('Budget tidak sesuai dengan bulan laporan.')

  return calculateBudgetOverview({ budget, budgetItems, categories, transactions, today })
}

export function calculateMonthlyActivityDates(month: string, transactions: readonly Transaction[]): string[] {
  return getMonthActivityDates(month, transactions)
}

export function calculateTrendChartGeometry(trends: readonly MonthlyTrend[]): TrendChartGeometry {
  const width = 360
  const left = 24
  const right = 336
  const top = 18
  const baseline = 156
  const maximum = Math.max(0, ...trends.flatMap(({ expense, income }) => [expense, income]))

  for (const trend of trends) {
    if (
      !Number.isSafeInteger(trend.expense) || trend.expense < 0 ||
      !Number.isSafeInteger(trend.income) || trend.income < 0
    ) {
      throw new RangeError('Nilai tren harus berupa bilangan bulat rupiah nonnegatif.')
    }
  }

  const xPositions = trends.map((_, index) => (
    trends.length < 2 ? width / 2 : left + index * (right - left) / (trends.length - 1)
  ))
  const points = trends.map((trend, index) => ({
    x: xPositions[index],
    expenseY: baseline - (maximum === 0 ? 0 : trend.expense / maximum * (baseline - top)),
    incomeY: baseline - (maximum === 0 ? 0 : trend.income / maximum * (baseline - top)),
  }))
  const path = (key: 'expenseY' | 'incomeY') => points
    .map(({ x, [key]: y }, index) => `${index === 0 ? 'M' : 'L'} ${coordinate(x)} ${coordinate(y)}`)
    .join(' ')
  const area = (key: 'expenseY' | 'incomeY') => {
    if (!points.length) return ''
    return [
      `M ${coordinate(points[0].x)} ${baseline}`,
      ...points.map(({ x, [key]: y }) => `L ${coordinate(x)} ${coordinate(y)}`),
      `L ${coordinate(points[points.length - 1].x)} ${baseline} Z`,
    ].join(' ')
  }

  return {
    xPositions,
    expenseLine: path('expenseY'),
    expenseArea: area('expenseY'),
    incomeLine: path('incomeY'),
    incomeArea: area('incomeY'),
  }
}

function calculateCategorySpendingChanges({
  current,
  previous,
  categoryNames,
}: {
  current: ReadonlyMap<string | null, bigint>
  previous: ReadonlyMap<string | null, bigint>
  categoryNames: ReadonlyMap<string, string>
}): CategorySpendingChange[] {
  const categoryIds = new Set([...current.keys(), ...previous.keys()])
  return Array.from(categoryIds, (categoryId) => {
    const currentAmount = toSafeNumber(current.get(categoryId) ?? 0n, 'Pengeluaran kategori bulan ini')
    const previousAmount = toSafeNumber(previous.get(categoryId) ?? 0n, 'Pengeluaran kategori bulan lalu')
    const difference = currentAmount - previousAmount
    const percentageChange = previousAmount === 0
      ? currentAmount === 0 ? 0 : null
      : difference / previousAmount * 100

    return {
      categoryId,
      categoryName: categoryId === null ? 'Tanpa kategori' : categoryNames.get(categoryId) ?? 'Tanpa kategori',
      currentAmount,
      previousAmount,
      difference,
      percentageChange,
      isNew: previousAmount === 0 && currentAmount > 0,
      isSignificantIncrease: percentageChange !== null &&
        percentageChange > 50 &&
        difference >= significantCategoryIncreaseThreshold,
    }
  })
    .filter(({ currentAmount, previousAmount }) => currentAmount > 0 || previousAmount > 0)
    .sort((left, right) => right.difference - left.difference || left.categoryName.localeCompare(right.categoryName, 'id'))
}

function coordinate(value: number): string {
  return Number(value.toFixed(2)).toString()
}

export type DailyExpensePoint = {
  date: string
  amount: number
}

export type SevenDayExpenseSeries = {
  days: DailyExpensePoint[]
  total: number
  average: number
}

type MonthlyAnalyticsInput = {
  month: string
  transactions: readonly Transaction[]
  categories: readonly Pick<Category, 'id' | 'name'>[]
  today?: Date
}

type MonthlyTotals = {
  expense: bigint
  income: bigint
}

export function calculateSevenDayExpenseSeries(
  transactions: readonly Transaction[],
  today: Date = new Date(),
): SevenDayExpenseSeries {
  if (Number.isNaN(today.getTime())) throw new RangeError('Tanggal acuan grafik tidak valid.')

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const daySet = new Set(days)
  const spending = new Map<string, bigint>(days.map((day) => [day, 0n]))

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !daySet.has(transaction.date)) continue
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) {
      throw new RangeError(`Nominal transaksi ${transaction.id} harus berupa bilangan bulat positif.`)
    }
    spending.set(
      transaction.date,
      (spending.get(transaction.date) ?? 0n) + BigInt(transaction.amount),
    )
  }

  const points = days.map((date) => ({
    date,
    amount: toSafeNumber(spending.get(date) ?? 0n, `Pengeluaran ${date}`),
  }))
  const total = points.reduce((sum, { amount }) => sum + amount, 0)
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Total pengeluaran tujuh hari berada di luar rentang bilangan bulat yang aman.')
  }

  return { days: points, total, average: Math.trunc(total / 7) }
}

export function calculateMonthlyAnalytics({
  month,
  transactions,
  categories,
  today = new Date(),
}: MonthlyAnalyticsInput): MonthlyAnalytics {
  validateMonth(month)
  if (Number.isNaN(today.getTime())) throw new RangeError('Tanggal acuan laporan tidak valid.')

  const allMonths = Array.from({ length: 7 }, (_, index) => shiftMonth(month, index - 6))
  const trendMonths = allMonths.slice(1)
  const previousMonth = shiftMonth(month, -1)
  const monthSet = new Set(allMonths)
  const totals = new Map<string, MonthlyTotals>(
    allMonths.map((item) => [item, { expense: 0n, income: 0n }]),
  )
  const categorySpending = new Map<string | null, bigint>()
  const previousCategorySpending = new Map<string | null, bigint>()
  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]))
  const daySpending = new Map<string, bigint>()
  let transactionCount = 0

  for (const transaction of transactions) {
    const transactionMonth = transaction.date.slice(0, 7)
    if (!monthSet.has(transactionMonth)) continue
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) {
      throw new RangeError(`Nominal transaksi ${transaction.id} harus berupa bilangan bulat positif.`)
    }

    const monthTotals = totals.get(transactionMonth)
    if (!monthTotals) continue
    const amount = BigInt(transaction.amount)

    if (transactionMonth === month) transactionCount += 1
    if (transaction.type === 'transfer') continue

    if (transaction.type === 'income') {
      monthTotals.income += amount
      continue
    }

    monthTotals.expense += amount
    if (transactionMonth === month || transactionMonth === previousMonth) {
      const categoryId = transaction.categoryId && categoryNames.has(transaction.categoryId)
        ? transaction.categoryId
        : null
      const monthSpending = transactionMonth === month ? categorySpending : previousCategorySpending
      monthSpending.set(categoryId, (monthSpending.get(categoryId) ?? 0n) + amount)
      if (transactionMonth === month) {
        daySpending.set(transaction.date, (daySpending.get(transaction.date) ?? 0n) + amount)
      }
    }
  }

  const currentTotals = totals.get(month)
  if (!currentTotals) throw new Error(`Data bulan ${month} tidak tersedia.`)
  const previousTotals = totals.get(previousMonth) ?? { expense: 0n, income: 0n }
  const totalExpense = toSafeNumber(currentTotals.expense, 'Total pengeluaran')
  const totalIncome = toSafeNumber(currentTotals.income, 'Total pemasukan')
  const previousExpense = toSafeNumber(previousTotals.expense, 'Pengeluaran bulan sebelumnya')
  const difference = totalExpense - previousExpense
  const percentageChange = previousExpense === 0
    ? totalExpense === 0 ? 0 : null
    : difference / previousExpense * 100

  const categoryResults = Array.from(categorySpending, ([categoryId, amount]) => {
    const numericAmount = toSafeNumber(amount, 'Pengeluaran kategori')
    return {
      categoryId,
      categoryName: categoryId === null ? 'Tanpa kategori' : categoryNames.get(categoryId) ?? 'Tanpa kategori',
      amount: numericAmount,
      percentage: totalExpense === 0 ? 0 : numericAmount / totalExpense * 100,
    }
  }).sort((left, right) => (
    right.amount - left.amount || left.categoryName.localeCompare(right.categoryName, 'id')
  ))
  const categoryChanges = calculateCategorySpendingChanges({
    current: categorySpending,
    previous: previousCategorySpending,
    categoryNames,
  })

  const busiestDay = Array.from(daySpending.entries())
    .sort(([leftDate, leftAmount], [rightDate, rightAmount]) => {
      if (leftAmount !== rightAmount) return leftAmount > rightAmount ? -1 : 1
      return leftDate.localeCompare(rightDate)
    })[0]

  const trends = trendMonths.map((trendMonth) => {
    const monthTotals = totals.get(trendMonth)
    if (!monthTotals) throw new Error(`Data bulan ${trendMonth} tidak tersedia.`)
    return {
      month: trendMonth,
      expense: toSafeNumber(monthTotals.expense, `Pengeluaran ${trendMonth}`),
      income: toSafeNumber(monthTotals.income, `Pemasukan ${trendMonth}`),
    }
  })
  const averagePerDay = toSafeNumber(
    currentTotals.expense / BigInt(daysInMonth(month)),
    'Rata-rata pengeluaran harian',
  )

  return {
    month,
    totalExpense,
    totalIncome,
    categorySpending: categoryResults,
    trends,
    monthComparison: {
      previousMonth,
      currentExpense: totalExpense,
      previousExpense,
      difference,
      percentageChange,
    },
    insights: {
      largestCategory: categoryResults[0] ?? null,
      categoryChanges,
      projectedExpense: projectMonthEndExpense(totalExpense, month, today),
    },
    summary: {
      averagePerDay,
      busiestDay: busiestDay
        ? { date: busiestDay[0], amount: toSafeNumber(busiestDay[1], 'Pengeluaran harian tertinggi') }
        : null,
      transactionCount,
    },
  }
}

function validateMonth(month: string): void {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new RangeError('Bulan laporan harus berformat YYYY-MM.')
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) throw new RangeError('Bulan laporan tidak valid.')
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const monthIndex = year * 12 + monthNumber - 1 + offset
  const nextYear = Math.floor(monthIndex / 12)
  const nextMonth = monthIndex - nextYear * 12 + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function toSafeNumber(value: bigint, description: string): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) {
    throw new RangeError(`${description} berada di luar rentang bilangan bulat yang aman.`)
  }
  return number
}
