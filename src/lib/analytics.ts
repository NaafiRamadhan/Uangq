import type { Category, Transaction } from '../db/schema'

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
  summary: {
    averagePerDay: number
    busiestDay: { date: string; amount: number } | null
    transactionCount: number
  }
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
}: MonthlyAnalyticsInput): MonthlyAnalytics {
  validateMonth(month)

  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5))
  const monthSet = new Set(months)
  const totals = new Map<string, MonthlyTotals>(
    months.map((item) => [item, { expense: 0n, income: 0n }]),
  )
  const categorySpending = new Map<string | null, bigint>()
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
    if (transactionMonth === month) {
      const categoryId = transaction.categoryId && categoryNames.has(transaction.categoryId)
        ? transaction.categoryId
        : null
      categorySpending.set(categoryId, (categorySpending.get(categoryId) ?? 0n) + amount)
      daySpending.set(transaction.date, (daySpending.get(transaction.date) ?? 0n) + amount)
    }
  }

  const currentTotals = totals.get(month)
  if (!currentTotals) throw new Error(`Data bulan ${month} tidak tersedia.`)
  const previousMonth = shiftMonth(month, -1)
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

  const busiestDay = Array.from(daySpending.entries())
    .sort(([leftDate, leftAmount], [rightDate, rightAmount]) => {
      if (leftAmount !== rightAmount) return leftAmount > rightAmount ? -1 : 1
      return leftDate.localeCompare(rightDate)
    })[0]

  const trends = months.map((trendMonth) => {
    const monthTotals = totals.get(trendMonth)
    if (!monthTotals) throw new Error(`Data bulan ${trendMonth} tidak tersedia.`)
    return {
      month: trendMonth,
      expense: toSafeNumber(monthTotals.expense, `Pengeluaran ${trendMonth}`),
      income: toSafeNumber(monthTotals.income, `Pemasukan ${trendMonth}`),
    }
  })

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
    summary: {
      averagePerDay: toSafeNumber(
        currentTotals.expense / BigInt(daysInMonth(month)),
        'Rata-rata pengeluaran harian',
      ),
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
