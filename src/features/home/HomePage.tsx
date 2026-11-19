import { useEffect, useState } from 'react'
import { db, seedDatabase, type Budget, type BudgetItem, type Category, type Transaction, type Wallet } from '../../db/schema'
import {
  calculateBudgetOverview,
  getMonthActivityDates,
  type BudgetGroup,
  type BudgetOverview,
} from '../../lib/budget'
import { formatRupiah } from '../../lib/money'
import { Button, Card, EmptyState } from '../../components/ui'
import { QuickEntry } from '../transactions/QuickEntry'
import { BudgetProgress } from '../budget/BudgetProgress'

const groupLabels: Record<BudgetGroup, string> = {
  needs: 'Kebutuhan',
  wants: 'Keinginan',
  savings: 'Tabungan',
}

const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function currentMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
}

function amountLabel(transaction: Transaction): string {
  const prefix = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : ''
  return `${prefix}${formatRupiah(transaction.amount)}`
}

function ActivityCalendar({ month, activityDates, today }: {
  month: string
  activityDates: readonly string[]
  today: Date
}) {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const activity = new Set(activityDates)
  const todayKey = `${currentMonthKey(today)}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="activity-calendar" role="grid" aria-label={`Aktivitas ${monthLabel(month)}`}>
      {weekdays.map((weekday) => (
        <span className="activity-calendar__weekday" role="columnheader" key={weekday}>{weekday}</span>
      ))}
      {cells.map((day, index) => {
        if (day === null) return <span className="activity-calendar__empty" role="gridcell" key={`empty-${index}`} />
        const date = `${month}-${String(day).padStart(2, '0')}`
        const hasActivity = activity.has(date)
        const isToday = date === todayKey
        return (
          <span
            className={`activity-calendar__day${hasActivity ? ' has-activity' : ''}${isToday ? ' is-today' : ''}`}
            role="gridcell"
            aria-label={`${day}${hasActivity ? ', ada transaksi' : ', tidak ada transaksi'}${isToday ? ', hari ini' : ''}`}
            key={date}
          >
            {day}
          </span>
        )
      })}
    </div>
  )
}

export function HomePage({
  defaultWalletId,
  onOpenWallets,
  onOpenBudget,
  onOpenReport,
}: {
  defaultWalletId: string
  onOpenWallets: () => void
  onOpenBudget: () => void
  onOpenReport: () => void
}) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadHome(showLoading = true) {
    if (showLoading) setLoading(true)
    const month = currentMonthKey(new Date())
    try {
      await seedDatabase()
      const [nextWallets, nextCategories, nextTransactions, nextBudget, nextItems] = await Promise.all([
        db.wallets.toArray(),
        db.categories.toArray(),
        db.transactions.toArray(),
        db.budgets.where('month').equals(month).first(),
        db.budgetItems.where('month').equals(month).toArray(),
      ])
      setWallets(nextWallets)
      setCategories(nextCategories)
      setTransactions(nextTransactions)
      setBudget(nextBudget ?? null)
      setBudgetItems(nextItems)
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
      calculationError = overviewError instanceof Error ? overviewError.message : 'Ringkasan budget gagal dihitung.'
    }
  }

  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]))
  const recentTransactions = [...transactions]
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)
  const activityDates = getMonthActivityDates(month, transactions)
  const monthTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === month)

  return (
    <div className="feature-page home-page">
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {calculationError && <p className="form-message form-message--error" role="alert">{calculationError}</p>}
      <QuickEntry
        wallets={wallets}
        categories={categories}
        defaultWalletId={defaultWalletId}
        onSaved={() => loadHome(false)}
      />
      <Button
        variant="secondary"
        className="button--compact report-entry"
        type="button"
        onClick={onOpenReport}
      >
        Lihat laporan
      </Button>

      {wallets.every((wallet) => wallet.archived) && (
        <Card className="home-wallet-prompt">
          <h2>Mulai dengan dompet</h2>
          <p className="backup-note">Tambahkan dompet agar transaksi bisa dicatat.</p>
          <Button variant="secondary" type="button" onClick={onOpenWallets}>Buat dompet</Button>
        </Card>
      )}

      {!budget ? (
        <EmptyState
          title="Buat budget pertamamu"
          action={<Button type="button" onClick={onOpenBudget}>Buat budget bulanan</Button>}
        >
          Tetapkan budget bulanan untuk melihat sisa harian dan progres pengeluaran di Beranda.
        </EmptyState>
      ) : overview ? (
        <>
          <Card className="home-daily-budget">
            <p className="section-kicker">SISA BUDGET HARI INI</p>
            <strong>{formatRupiah(overview.dailyRemaining)}</strong>
            <p>
              {formatRupiah(overview.monthRemaining)} tersisa untuk {overview.daysRemaining} hari termasuk hari ini.
            </p>
          </Card>

          <Card className="home-groups-card">
            <p className="section-kicker">PROGRES BULAN INI</p>
            <h2>Pengeluaran per kelompok</h2>
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

          <Card className="home-recent-card">
            <p className="section-kicker">TERBARU</p>
            <h2>Transaksi terbaru</h2>
            {recentTransactions.length === 0 ? (
              <p className="backup-note">Belum ada transaksi.</p>
            ) : (
              <div className="home-recent-list">
                {recentTransactions.map((transaction) => (
                  <div className="home-recent-row" key={transaction.id}>
                    <div>
                      <strong>
                        {categoryNames.get(transaction.categoryId ?? '') ??
                          (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'transfer' ? 'Transfer' : 'Pengeluaran')}
                      </strong>
                      <span>{transaction.note || transaction.date}</span>
                    </div>
                    <span className={`home-recent-amount home-recent-amount--${transaction.type}`}>
                      {amountLabel(transaction)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="home-calendar-card">
            <p className="section-kicker">AKTIVITAS BULANAN</p>
            <h2>{monthLabel(month)}</h2>
            <ActivityCalendar month={month} activityDates={activityDates} today={today} />
            <p className="calendar-legend"><span aria-hidden="true" /> Ada transaksi</p>
            <p className="backup-note">{monthTransactions.length} transaksi bulan ini.</p>
          </Card>
        </>
      ) : null}
    </div>
  )
}
