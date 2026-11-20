import { useEffect, useState } from 'react'
import { db, seedDatabase, type Budget, type BudgetItem, type Category, type Transaction, type Wallet } from '../../db/schema'
import {
  calculateMonthlyAnalytics,
  calculateSevenDayExpenseSeries,
  type MonthlyAnalytics,
  type SevenDayExpenseSeries,
} from '../../lib/analytics'
import { calculateBudgetOverview, type BudgetOverview } from '../../lib/budget'
import { shouldShowBackupReminder } from '../../lib/backupReminder'
import { formatRupiah } from '../../lib/money'
import { LAST_BACKUP_SETTING_KEY } from '../../lib/settings'
import { Button, Card } from '../../components/ui'
import { QuickEntry } from '../transactions/QuickEntry'

const categorySymbols: Record<string, string> = {
  utensils: '🍽️',
  bolt: '⚡',
  droplet: '💧',
  bus: '🚌',
  wifi: '📶',
  box: '📦',
  coffee: '☕',
  bag: '🛍️',
  palette: '🎨',
  'piggy-bank': '🐷',
  shield: '🛡️',
  briefcase: '💼',
  plus: '➕',
}

function currentMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`))
}

function percentageLabel(value: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

function backupDateLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Belum pernah dibuat'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tanggal backup tidak valid'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(date)
}

function backupReminderMessage(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Backup belum pernah dibuat. Ekspor salinan data untuk menyimpannya secara manual.'
  }
  if (!Number.isFinite(Date.parse(value))) {
    return 'Tanggal backup tidak dapat dibaca. Ekspor backup baru untuk memperbaruinya.'
  }
  if (Date.parse(value) > Date.now()) {
    return 'Tanggal backup berada di masa depan. Ekspor backup baru untuk memperbaruinya.'
  }
  return 'Backup terakhir sudah lebih dari 30 hari. Pertimbangkan untuk membuat salinan baru.'
}

export function HomePage({
  defaultWalletId,
  onOpenWallets,
  onOpenBudget,
  onOpenReport,
  onExportBackup,
  focusQuickEntry,
  onQuickEntryFocused,
}: {
  defaultWalletId: string
  onOpenWallets: () => void
  onOpenBudget: () => void
  onOpenReport: () => void
  onExportBackup: () => Promise<string>
  focusQuickEntry: boolean
  onQuickEntryFocused: () => void
}) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [lastBackupAt, setLastBackupAt] = useState<unknown>()
  const [backupStatus, setBackupStatus] = useState<{ message: string; error: boolean } | null>(null)
  const [backupExporting, setBackupExporting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadHome(showLoading = true) {
    if (showLoading) setLoading(true)
    const month = currentMonthKey(new Date())
    try {
      await seedDatabase()
      const [nextWallets, nextCategories, nextTransactions, nextBudget, nextItems, lastBackupSetting] = await Promise.all([
        db.wallets.toArray(),
        db.categories.toArray(),
        db.transactions.toArray(),
        db.budgets.where('month').equals(month).first(),
        db.budgetItems.where('month').equals(month).toArray(),
        db.settings.get(LAST_BACKUP_SETTING_KEY),
      ])
      setWallets(nextWallets)
      setCategories(nextCategories)
      setTransactions(nextTransactions)
      setBudget(nextBudget ?? null)
      setBudgetItems(nextItems)
      setLastBackupAt(lastBackupSetting?.value)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data Beranda gagal dimuat.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void loadHome()
  }, [])

  if (loading) {
    return <p className="feature-description" role="status">Memuat Beranda…</p>
  }

  const today = new Date()
  const month = currentMonthKey(today)
  let overview: BudgetOverview | null = null
  let calculationError = ''
  let monthlyAnalytics: MonthlyAnalytics | null = null
  let weeklyExpenses: SevenDayExpenseSeries | null = null
  try {
    monthlyAnalytics = calculateMonthlyAnalytics({ month, transactions, categories })
    weeklyExpenses = calculateSevenDayExpenseSeries(transactions, today)
    if (budget) {
      overview = calculateBudgetOverview({
        budget,
        budgetItems,
        categories,
        transactions,
        today,
      })
    }
  } catch (overviewError) {
    calculationError = overviewError instanceof Error ? overviewError.message : 'Ringkasan Beranda gagal dihitung.'
  }

  const showBackupReminder = shouldShowBackupReminder(lastBackupAt)
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  async function exportHomeBackup() {
    setBackupExporting(true)
    setBackupStatus(null)
    try {
      const exportedAt = await onExportBackup()
      setLastBackupAt(exportedAt)
      setBackupStatus({ message: 'Backup berhasil diekspor.', error: false })
    } catch (exportError) {
      setBackupStatus({
        message: exportError instanceof Error ? exportError.message : 'Backup gagal diekspor.',
        error: true,
      })
    } finally {
      setBackupExporting(false)
    }
  }

  const weeklyMaximum = weeklyExpenses
    ? Math.max(0, ...weeklyExpenses.days.map(({ amount }) => amount))
    : 0
  const averageLine = weeklyMaximum === 0 || !weeklyExpenses
    ? 0
    : weeklyExpenses.average / weeklyMaximum * 100
  const highestDay = weeklyExpenses?.days.reduce(
    (highest, day) => day.amount > highest.amount ? day : highest,
    weeklyExpenses.days[0],
  )
  const chartDescription = weeklyExpenses
    ? `Pengeluaran tujuh hari terakhir. ${weeklyExpenses.days.map(({ date, amount }) => `${dateLabel(date)}: ${formatRupiah(amount)}`).join('; ')}. Rata-rata ${formatRupiah(weeklyExpenses.average)} per hari.`
    : ''
  const usedPercent = budget && monthlyAnalytics
    ? Math.round(monthlyAnalytics.totalExpense / budget.total * 100)
    : 0

  return (
    <div className="feature-page home-page">
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {calculationError && <p className="form-message form-message--error" role="alert">{calculationError}</p>}

      <Card className="home-month-summary">
        <p className="section-kicker">RINGKASAN BULAN INI</p>
        <h2>Total terpakai bulan ini</h2>
        <strong className="home-month-summary__amount">
          {formatRupiah(monthlyAnalytics?.totalExpense ?? 0)}
        </strong>
        {budget && overview ? (
          <>
            <div
              className="home-month-summary__track"
              role="progressbar"
              aria-label="Persentase budget bulanan yang terpakai"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(usedPercent, 100)}
              aria-valuetext={`${usedPercent}% budget terpakai`}
            >
              <span style={{ width: `${Math.min(usedPercent, 100)}%` }} />
            </div>
            <p className="home-month-summary__usage">{usedPercent}% budget terpakai</p>
            <p className="home-month-summary__remaining">
              {overview.daysRemaining} hari lagi · sisa budget harian {formatRupiah(overview.dailyRemaining)}
            </p>
          </>
        ) : (
          <div className="home-month-summary__invitation">
            <p>Atur budget untuk melihat progres pemakaian dan sisa budget harian.</p>
            <Button className="button--compact" type="button" onClick={onOpenBudget}>
              Buat budget bulanan
            </Button>
          </div>
        )}
        {wallets.every((wallet) => wallet.archived) && (
          <div className="home-month-summary__wallet">
            <p>Tambahkan dompet sebelum mencatat transaksi.</p>
            <Button variant="secondary" className="button--compact" type="button" onClick={onOpenWallets}>
              Buat dompet
            </Button>
          </div>
        )}
      </Card>

      <QuickEntry
        wallets={wallets}
        categories={categories}
        defaultWalletId={defaultWalletId}
        focusOnMount={focusQuickEntry}
        onInitialFocus={onQuickEntryFocused}
        onSaved={() => loadHome(false)}
      />

      <Card className="home-weekly-spending">
        <p className="section-kicker">7 HARI TERAKHIR</p>
        <h2>Pengeluaran terbaru</h2>
        {weeklyExpenses && (
          <>
            <div className="home-expense-chart" role="img" aria-label={chartDescription}>
              <div className="home-expense-chart__bars">
                <span
                  className="home-expense-chart__average-line"
                  style={{ bottom: `${averageLine}%` }}
                />
                {weeklyExpenses.days.map(({ date, amount }) => (
                  <span
                    className="home-expense-chart__bar"
                    key={date}
                    style={{ height: `${weeklyMaximum === 0 ? 0 : amount / weeklyMaximum * 100}%` }}
                  />
                ))}
              </div>
              <div className="home-expense-chart__labels">
                {weeklyExpenses.days.map(({ date }) => (
                  <span key={date}>
                    {new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' })
                      .format(new Date(`${date}T00:00:00`))
                      .replace(',', '')}
                  </span>
                ))}
              </div>
              <p className="home-expense-chart__legend">
                <span aria-hidden="true" /> Rata-rata {formatRupiah(weeklyExpenses.average)} per hari
              </p>
            </div>
            <p className="home-weekly-spending__summary">
              {weeklyExpenses.total === 0
                ? 'Belum ada pengeluaran dalam tujuh hari terakhir.'
                : `${formatRupiah(weeklyExpenses.total)} total dalam tujuh hari. Hari tertinggi ${highestDay ? `${dateLabel(highestDay.date)} · ${formatRupiah(highestDay.amount)}` : 'belum tersedia'}.`}
            </p>
          </>
        )}
        <Button
          variant="secondary"
          className="button--compact report-entry"
          type="button"
          onClick={onOpenReport}
        >
          Lihat laporan
        </Button>
      </Card>

      <Card className="home-category-spending">
        <p className="section-kicker">BULAN INI</p>
        <h2>Pengeluaran per kategori</h2>
        {monthlyAnalytics && monthlyAnalytics.categorySpending.length > 0 ? (
          <div className="home-category-list">
            {monthlyAnalytics.categorySpending.map((category) => {
              const details = category.categoryId ? categoryById.get(category.categoryId) : undefined
              return (
                <div className="home-category-row" key={category.categoryId ?? 'uncategorized'}>
                  <span className="home-category-row__icon" aria-hidden="true">
                    {details ? categorySymbols[details.icon] ?? '◦' : '🏷️'}
                  </span>
                  <span className="home-category-row__name">{category.categoryName}</span>
                  <span className="home-category-row__amount">
                    <strong>{formatRupiah(category.amount)}</strong>
                    <small>{percentageLabel(category.percentage)}</small>
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="home-category-spending__empty">
            Belum ada pengeluaran per kategori yang tercatat bulan ini.
          </p>
        )}
      </Card>

      <Card className="home-backup-card">
        <p className="section-kicker">DATA LOKAL</p>
        <h2>Backup data</h2>
        <p className="home-backup-card__date">
          Backup terakhir: <strong>{backupDateLabel(lastBackupAt)}</strong>
        </p>
        {showBackupReminder && (
          <p className="home-backup-card__reminder">
            {backupReminderMessage(lastBackupAt)}
          </p>
        )}
        <Button
          className="button--compact"
          type="button"
          disabled={backupExporting}
          onClick={() => void exportHomeBackup()}
        >
          {backupExporting ? 'Mengekspor…' : 'Ekspor'}
        </Button>
        {backupStatus && (
          <p className={backupStatus.error ? 'form-message form-message--error' : 'form-message'} role={backupStatus.error ? 'alert' : 'status'}>
            {backupStatus.message}
          </p>
        )}
      </Card>
    </div>
  )
}
