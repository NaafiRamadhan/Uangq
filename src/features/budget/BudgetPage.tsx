import { useEffect, useState, type FormEvent } from 'react'
import { db, seedDatabase, type Budget, type BudgetItem, type Category, type Transaction } from '../../db/schema'
import { calculateBudgetOverview, type BudgetGroup } from '../../lib/budget'
import { formatRupiah } from '../../lib/money'
import { Button, Card, EmptyState, Input } from '../../components/ui'
import { BudgetProgress } from './BudgetProgress'

type SplitValues = {
  needs: number
  wants: number
  savings: number
}

const groupLabels: Record<BudgetGroup, string> = {
  needs: 'Kebutuhan',
  wants: 'Keinginan',
  savings: 'Tabungan',
}

const initialSplits: SplitValues = { needs: 50, wants: 30, savings: 20 }

function currentMonthKey(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function displayMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
}

export function BudgetPage({ onOpenReport }: { onOpenReport: () => void }) {
  const [month] = useState(currentMonthKey)
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState('')
  const [splits, setSplits] = useState<SplitValues>(initialSplits)
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadBudgetData() {
    setLoading(true)
    try {
      await seedDatabase()
      const [nextBudget, nextItems, nextCategories, nextTransactions] = await Promise.all([
        db.budgets.where('month').equals(month).first(),
        db.budgetItems.where('month').equals(month).toArray(),
        db.categories.toArray(),
        db.transactions.toArray(),
      ])
      setBudget(nextBudget ?? null)
      setBudgetItems(nextItems)
      setCategories(nextCategories)
      setTransactions(nextTransactions)
      setTotal(nextBudget ? String(nextBudget.total) : '')
      setSplits(nextBudget
        ? {
            needs: nextBudget.splitNeeds,
            wants: nextBudget.splitWants,
            savings: nextBudget.splitSavings,
          }
        : initialSplits)
      setCategoryLimits(Object.fromEntries(nextItems.map((item) => [item.categoryId, String(item.limit)])))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data budget gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBudgetData()
  }, [])

  const activeCategories = categories.filter((category) => !category.archived && category.group !== 'income')
  const splitTotal = splits.needs + splits.wants + splits.savings
  const remainingPercent = 100 - splitTotal
  const totalNumber = Number(total)
  const today = new Date()
  let overview: ReturnType<typeof calculateBudgetOverview> | null = null
  let calculationError = ''
  if (budget) {
    try {
      overview = calculateBudgetOverview({
        budget,
        budgetItems,
        categories,
        transactions,
        today,
      })
    } catch (overviewError) {
      calculationError = overviewError instanceof Error ? overviewError.message : 'Progres budget gagal dihitung.'
    }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!Number.isSafeInteger(totalNumber) || totalNumber <= 0) {
      setError('Total budget harus berupa bilangan bulat rupiah yang lebih dari nol.')
      return
    }
    if (splitTotal !== 100) {
      setError(`Jumlah alokasi harus tepat 100% (sisa ${remainingPercent}%).`)
      return
    }

    const nextBudget: Budget = {
      id: budget?.id ?? crypto.randomUUID(),
      month,
      total: totalNumber,
      splitNeeds: splits.needs,
      splitWants: splits.wants,
      splitSavings: splits.savings,
    }

    try {
      await db.budgets.put(nextBudget)
      setBudget(nextBudget)
      setMessage('Budget bulanan berhasil disimpan.')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Budget gagal disimpan.')
    }
  }

  async function saveCategoryLimits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const activeCategoryIds = new Set(activeCategories.map(({ id }) => id))
    const archivedItems: BudgetItem[] = []

    for (const item of budgetItems) {
      if (activeCategoryIds.has(item.categoryId)) continue
      const category = categories.find(({ id }) => id === item.categoryId)
      if (!category) {
        setError(`Kategori untuk batas ${item.categoryId} tidak ditemukan.`)
        return
      }
      if (category.group === 'income') {
        setError(`Kategori pemasukan ${category.name} tidak dapat memiliki batas pengeluaran.`)
        return
      }
      archivedItems.push(item)
    }

    const nextItems = [...archivedItems]
    for (const category of activeCategories) {
      const value = categoryLimits[category.id]?.trim()
      if (!value) continue
      const limit = Number(value)
      if (!Number.isSafeInteger(limit) || limit < 0) {
        setError(`Batas kategori ${category.name} harus berupa bilangan bulat rupiah nonnegatif.`)
        return
      }
      nextItems.push({
        id: budgetItems.find((item) => item.categoryId === category.id)?.id ?? crypto.randomUUID(),
        month,
        categoryId: category.id,
        limit,
      })
    }

    try {
      await db.transaction('rw', db.budgetItems, async () => {
        await db.budgetItems.where('month').equals(month).delete()
        if (nextItems.length > 0) await db.budgetItems.bulkAdd(nextItems)
      })
      setBudgetItems(nextItems)
      setMessage('Batas kategori berhasil disimpan.')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Batas kategori gagal disimpan.')
    }
  }

  if (loading) return <p className="feature-description" role="status">Memuat budget…</p>

  return (
    <div className="feature-page budget-page">
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {calculationError && <p className="form-message form-message--error" role="alert">{calculationError}</p>}
      {message && <p className="form-message" role="status">{message}</p>}
      <Button
        variant="secondary"
        className="button--compact report-entry"
        type="button"
        onClick={onOpenReport}
      >
        Lihat laporan
      </Button>

      <Card className="budget-config-card">
        <p className="section-kicker">BUDGET BULANAN</p>
        <h2>{displayMonth(month)}</h2>
        <form className="feature-form" onSubmit={(event) => void saveBudget(event)}>
          <Input
            label="Total budget (rupiah)"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            required
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="Contoh: 5000000"
          />
          <fieldset className="allocation-fieldset">
            <legend>Pembagian budget</legend>
            <p className={`allocation-remaining${remainingPercent === 0 ? ' is-balanced' : ''}`}>
              Terpakai {splitTotal}% · {remainingPercent >= 0
                ? `Sisa ${remainingPercent}%`
                : `Kelebihan ${Math.abs(remainingPercent)}%`}
            </p>
            {([
              ['needs', 'Kebutuhan'],
              ['wants', 'Keinginan'],
              ['savings', 'Tabungan'],
            ] as const).map(([group, label]) => (
              <label className="allocation-slider" key={group}>
                <span>{label}<strong>{splits[group]}%</strong></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={splits[group]}
                  aria-label={`Persentase ${label}`}
                  onChange={(event) => setSplits({ ...splits, [group]: Number(event.target.value) })}
                />
              </label>
            ))}
          </fieldset>
          <Button type="submit" disabled={!Number.isSafeInteger(totalNumber) || totalNumber <= 0 || splitTotal !== 100}>
            {budget ? 'Simpan perubahan budget' : 'Buat budget'}
          </Button>
        </form>
      </Card>

      {!budget && (
        <EmptyState title="Buat budget pertamamu">
          Tetapkan total bulanan dan pembagian 50/30/20 untuk mulai memantau pengeluaran.
        </EmptyState>
      )}

      {overview && (
        <Card className="budget-overview-card">
          <p className="section-kicker">PROGRES BULAN INI</p>
          <div className="budget-overview__total">
            <div>
              <span>Terpakai</span>
              <strong>{formatRupiah(overview.totalSpent)}</strong>
            </div>
            <div>
              <span>Sisa budget</span>
              <strong>{formatRupiah(overview.monthRemaining)}</strong>
            </div>
          </div>
          <h2>Progres per kelompok</h2>
          <div className="budget-progress-list">
            {overview.groups.map((group) => (
              <BudgetProgress
                key={group.group}
                label={groupLabels[group.group]}
                spent={group.spent}
                limit={group.limit}
                percentage={group.percentage}
                status={group.status}
              />
            ))}
          </div>
        </Card>
      )}

      <Card className="category-limits-card">
        <p className="section-kicker">BATAS PENGELUARAN</p>
        <h2>Batas per kategori</h2>
        <p className="backup-note">Kosongkan batas jika kategori ini belum memiliki target khusus.</p>
        <form className="feature-form" onSubmit={(event) => void saveCategoryLimits(event)}>
          {(['needs', 'wants', 'savings'] as const).map((group) => (
            <section className="budget-category-group" key={group}>
              <h3>{groupLabels[group]}</h3>
              {activeCategories.filter((category) => category.group === group).map((category) => {
                const progress = overview?.categories.find(({ categoryId }) => categoryId === category.id)
                return (
                  <div className="budget-category-row" key={category.id}>
                    <Input
                      label={`${category.name} — batas rupiah`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={categoryLimits[category.id] ?? ''}
                      onChange={(event) => setCategoryLimits({
                        ...categoryLimits,
                        [category.id]: event.target.value,
                      })}
                      placeholder="Belum ada batas"
                    />
                    {progress?.limit !== null && progress?.limit !== undefined ? (
                      <BudgetProgress
                        label={`Pengeluaran ${category.name}`}
                        spent={progress.spent}
                        limit={progress.limit}
                        percentage={progress.percentage ?? 0}
                        status={progress.status === 'unbudgeted' ? 'normal' : progress.status}
                      />
                    ) : (
                      <p className="category-budget-unset">
                        {formatRupiah(progress?.spent ?? 0)} terpakai · batas belum diatur
                      </p>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
          <Button type="submit">Simpan batas kategori</Button>
        </form>
      </Card>
    </div>
  )
}
