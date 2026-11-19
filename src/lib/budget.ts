import type { Budget, BudgetItem, Category, Transaction } from '../db/schema'

export type BudgetGroup = 'needs' | 'wants' | 'savings'
export type BudgetProgressStatus = 'normal' | 'near' | 'over'

export type GroupBudgetProgress = {
  group: BudgetGroup
  limit: number
  spent: number
  remaining: number
  percentage: number
  status: BudgetProgressStatus
}

export type CategoryBudgetProgress = {
  categoryId: string
  group: BudgetGroup
  spent: number
  limit: number | null
  remaining: number | null
  percentage: number | null
  status: BudgetProgressStatus | 'unbudgeted'
}

export type BudgetOverview = {
  month: string
  totalLimit: number
  totalSpent: number
  monthRemaining: number
  daysRemaining: number
  dailyRemaining: number
  groups: GroupBudgetProgress[]
  categories: CategoryBudgetProgress[]
}

type BudgetOverviewInput = {
  budget: Budget
  budgetItems: readonly BudgetItem[]
  categories: readonly Pick<Category, 'id' | 'group'>[]
  transactions: readonly Transaction[]
  today?: Date
}

const groupOrder: readonly BudgetGroup[] = ['needs', 'wants', 'savings']
const nearLimitPercent = 80n

/**
 * Daily remaining includes today and truncates fractional rupiah toward zero.
 */
export function calculateBudgetOverview({
  budget,
  budgetItems,
  categories,
  transactions,
  today = new Date(),
}: BudgetOverviewInput): BudgetOverview {
  validateBudget(budget)
  if (Number.isNaN(today.getTime())) throw new RangeError('Tanggal acuan budget tidak valid.')

  const allocations = allocateGroupLimits(budget)
  const groupSpending = new Map<BudgetGroup, bigint>(groupOrder.map((group) => [group, 0n]))
  const categorySpending = new Map<string, bigint>()
  let totalSpent = 0n

  for (const transaction of transactions) {
    if (transaction.date.slice(0, 7) !== budget.month || transaction.type !== 'expense') continue
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) {
      throw new RangeError(`Nominal transaksi ${transaction.id} harus berupa bilangan bulat positif.`)
    }

    const amount = BigInt(transaction.amount)
    totalSpent += amount
    if (!transaction.categoryId) continue

    const category = categories.find(({ id }) => id === transaction.categoryId)
    if (!category || category.group === 'income') continue
    groupSpending.set(category.group, (groupSpending.get(category.group) ?? 0n) + amount)
    categorySpending.set(
      category.id,
      (categorySpending.get(category.id) ?? 0n) + amount,
    )
  }

  const categoryLimits = new Map<string, number>()
  for (const item of budgetItems) {
    if (item.month !== budget.month) continue
    if (!Number.isSafeInteger(item.limit) || item.limit < 0) {
      throw new RangeError(`Batas kategori ${item.categoryId} harus berupa bilangan bulat nonnegatif.`)
    }
    if (categoryLimits.has(item.categoryId)) {
      throw new Error(`Batas kategori duplikat: ${item.categoryId}.`)
    }
    categoryLimits.set(item.categoryId, item.limit)
  }

  const groups = groupOrder.map((group): GroupBudgetProgress => {
    const spent = toSafeNumber(groupSpending.get(group) ?? 0n, `Pengeluaran kelompok ${group}`)
    const limit = allocations[group]
    return {
      group,
      limit,
      spent,
      remaining: limit - spent,
      percentage: usagePercentage(BigInt(spent), BigInt(limit)),
      status: progressStatus(BigInt(spent), BigInt(limit)),
    }
  })

  const categoryGroups = new Map(categories.map(({ id, group }) => [id, group] as const))
  const categoriesProgress = categories
    .filter((category): category is Pick<Category, 'id' | 'group'> & { group: BudgetGroup } => (
      isBudgetGroup(category.group)
    ))
    .map((category): CategoryBudgetProgress => {
      const spentBig = categorySpending.get(category.id) ?? 0n
      const spent = toSafeNumber(spentBig, `Pengeluaran kategori ${category.id}`)
      const limit = categoryLimits.get(category.id)
      return {
        categoryId: category.id,
        group: category.group,
        spent,
        limit: limit ?? null,
        remaining: limit === undefined ? null : limit - spent,
        percentage: limit === undefined ? null : usagePercentage(spentBig, BigInt(limit)),
        status: limit === undefined ? 'unbudgeted' : progressStatus(spentBig, BigInt(limit)),
      }
    })
    .sort((left, right) => (
      groupOrder.indexOf(left.group) - groupOrder.indexOf(right.group) ||
      left.categoryId.localeCompare(right.categoryId)
    ))

  for (const [categoryId] of categoryLimits) {
    const categoryGroup = categoryGroups.get(categoryId)
    if (!categoryGroup || !isBudgetGroup(categoryGroup)) {
      throw new Error(`Kategori untuk batas ${categoryId} tidak ditemukan.`)
    }
  }

  const totalSpentNumber = toSafeNumber(totalSpent, 'Total pengeluaran')
  const monthRemaining = budget.total - totalSpentNumber
  const daysRemaining = getMonthKey(today) === budget.month ? getDaysRemainingInMonth(today) : 0

  return {
    month: budget.month,
    totalLimit: budget.total,
    totalSpent: totalSpentNumber,
    monthRemaining,
    daysRemaining,
    dailyRemaining: daysRemaining > 0
      ? toSafeNumber(BigInt(monthRemaining) / BigInt(daysRemaining), 'Sisa budget harian')
      : 0,
    groups,
    categories: categoriesProgress,
  }
}

export function getDaysRemainingInMonth(today: Date): number {
  if (Number.isNaN(today.getTime())) throw new RangeError('Tanggal acuan budget tidak valid.')
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return daysInMonth - today.getDate() + 1
}

export function getMonthActivityDates(
  month: string,
  transactions: readonly Transaction[],
): string[] {
  validateMonth(month)
  return Array.from(new Set(
    transactions
      .filter((transaction) => transaction.date.slice(0, 7) === month)
      .map(({ date }) => date),
  )).sort()
}

function validateBudget(budget: Budget): void {
  validateMonth(budget.month)
  if (!Number.isSafeInteger(budget.total) || budget.total < 0) {
    throw new RangeError('Total budget harus berupa bilangan bulat rupiah nonnegatif.')
  }
  const splits = [budget.splitNeeds, budget.splitWants, budget.splitSavings]
  if (splits.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
    throw new RangeError('Persentase kelompok harus bilangan bulat antara 0 dan 100.')
  }
  if (splits.reduce((sum, value) => sum + value, 0) !== 100) {
    throw new RangeError('Jumlah persentase budget harus tepat 100%.')
  }
}

function validateMonth(month: string): void {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new RangeError('Bulan budget harus berformat YYYY-MM.')
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) throw new RangeError('Bulan budget tidak valid.')
}

function isBudgetGroup(group: Category['group']): group is BudgetGroup {
  return group !== 'income'
}

/**
 * Group quotas use the largest-remainder method so their integer limits sum to the total.
 */
function allocateGroupLimits(budget: Budget): Record<BudgetGroup, number> {
  const percentages = [
    { group: 'needs' as const, percent: budget.splitNeeds },
    { group: 'wants' as const, percent: budget.splitWants },
    { group: 'savings' as const, percent: budget.splitSavings },
  ]
  const total = BigInt(budget.total)
  const allocations = percentages.map(({ group, percent }, index) => {
    const numerator = total * BigInt(percent)
    return {
      group,
      index,
      amount: numerator / 100n,
      remainder: numerator % 100n,
    }
  })
  const unassigned = Number(total - allocations.reduce((sum, allocation) => sum + allocation.amount, 0n))
  const remainderOrder = [...allocations].sort((left, right) => (
    Number(right.remainder - left.remainder) || left.index - right.index
  ))
  for (let index = 0; index < unassigned; index += 1) {
    remainderOrder[index].amount += 1n
  }

  return {
    needs: toSafeNumber(allocations[0].amount, 'Batas kebutuhan'),
    wants: toSafeNumber(allocations[1].amount, 'Batas keinginan'),
    savings: toSafeNumber(allocations[2].amount, 'Batas tabungan'),
  }
}

function progressStatus(spent: bigint, limit: bigint): BudgetProgressStatus {
  if (spent > limit) return 'over'
  if (limit > 0n && spent * 100n >= limit * nearLimitPercent) return 'near'
  return 'normal'
}

function usagePercentage(spent: bigint, limit: bigint): number {
  if (limit === 0n) return spent > 0n ? 100 : 0
  const percentage = spent * 100n / limit
  return Number(percentage > 100n ? 100n : percentage)
}

function toSafeNumber(value: bigint, description: string): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) {
    throw new RangeError(`${description} berada di luar rentang bilangan bulat yang aman.`)
  }
  return number
}

function getMonthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}
