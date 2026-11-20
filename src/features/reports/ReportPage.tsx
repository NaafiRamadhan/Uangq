import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { db, seedDatabase, type Budget, type BudgetItem, type Category, type Transaction } from '../../db/schema'
import { Button, Card, EmptyState, Input } from '../../components/ui'
import {
  calculateMonthlyActivityDates,
  calculateMonthlyAnalytics,
  calculateReportBudgetProgress,
  calculateTrendChartGeometry,
  significantCategoryIncreaseThreshold,
  type MonthlyAnalytics,
} from '../../lib/analytics'
import { type BudgetGroup, type BudgetOverview } from '../../lib/budget'
import { formatRupiah } from '../../lib/money'
import { BudgetProgress } from '../budget/BudgetProgress'

const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const reportTabs = [
  { id: 'summary', label: 'Ringkasan' },
  { id: 'trend', label: 'Tren' },
  { id: 'insight', label: 'Insight' },
  { id: 'budget', label: 'Budget' },
] as const

type ReportTab = (typeof reportTabs)[number]['id']

const groupLabels: Record<BudgetGroup, string> = {
  needs: 'Kebutuhan',
  wants: 'Keinginan',
  savings: 'Tabungan',
}

function currentMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: style, year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
}

function monthShortLabel(month: string): string {
  const [, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'short' })
    .format(new Date(2026, monthNumber - 1, 1))
    .replace('.', '')
}

function isValidMonthKey(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

function percentLabel(value: number | null): string {
  if (value === null) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

function changeAmountLabel(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatRupiah(Math.abs(value))}`
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
        if (day === null) {
          return <span className="activity-calendar__empty" role="gridcell" key={`empty-${index}`} />
        }
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

function MonthlyTrend({ analytics }: { analytics: MonthlyAnalytics }) {
  const geometry = calculateTrendChartGeometry(analytics.trends)
  const chartDescription = analytics.trends
    .map(({ month, expense, income }) => (
      `${monthLabel(month)}: pengeluaran ${formatRupiah(expense)}, pemasukan ${formatRupiah(income)}`
    ))
    .join('. ')

  return (
    <Card className="report-panel">
      <p className="section-kicker">TREN 6 BULAN</p>
      <h2>Pengeluaran dan pemasukan</h2>
      <div className="report-legend" aria-label="Legenda tren">
        <span><i className="report-legend__swatch" /> Pengeluaran</span>
        <span><i className="report-legend__swatch report-legend__swatch--income" /> Pemasukan</span>
      </div>
      <svg
        className="report-line-chart"
        role="img"
        aria-label={chartDescription}
        viewBox="0 0 360 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {[18, 64, 110, 156].map((y) => (
          <line className="report-line-chart__grid" key={y} x1="24" x2="336" y1={y} y2={y} />
        ))}
        <path className="report-line-chart__area report-line-chart__area--expense" d={geometry.expenseArea} />
        <path className="report-line-chart__area report-line-chart__area--income" d={geometry.incomeArea} />
        <path className="report-line-chart__line report-line-chart__line--expense" d={geometry.expenseLine} />
        <path className="report-line-chart__line report-line-chart__line--income" d={geometry.incomeLine} />
        {analytics.trends.map((trend, index) => (
          <text
            className="report-line-chart__month"
            key={trend.month}
            textAnchor="middle"
            x={geometry.xPositions[index]}
            y="184"
          >
            {monthShortLabel(trend.month)}
          </text>
        ))}
      </svg>
      <div className="report-trend-values">
        {analytics.trends.map(({ month, expense, income }) => (
          <div className="report-trend-values__row" key={month}>
            <strong>{monthLabel(month, 'short')}</strong>
            <span>Keluar {formatRupiah(expense)}</span>
            <span>Masuk {formatRupiah(income)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ReportSummary({
  month,
  analytics,
  activityDates,
  today,
}: {
  month: string
  analytics: MonthlyAnalytics
  activityDates: readonly string[]
  today: Date
}) {
  return (
    <div className="report-tab-content">
      {analytics.summary.transactionCount === 0 && (
        <EmptyState title={`Belum ada transaksi di ${monthLabel(month)}`}>
          Catat transaksi atau pilih bulan lain untuk melihat ringkasan aktivitas.
        </EmptyState>
      )}

      <Card className="report-panel">
        <p className="section-kicker">ARUS BULAN INI</p>
        <h2>{monthLabel(month)}</h2>
        <div className="report-flow-summary">
          <div>
            <span>Pemasukan</span>
            <strong>{formatRupiah(analytics.totalIncome)}</strong>
          </div>
          <div>
            <span>Pengeluaran</span>
            <strong>{formatRupiah(analytics.totalExpense)}</strong>
          </div>
        </div>
      </Card>

      <Card className="report-panel">
        <p className="section-kicker">PENGELUARAN PER KATEGORI</p>
        <h2>Bulan ini</h2>
        {analytics.categorySpending.length === 0 ? (
          <p className="backup-note">Belum ada pengeluaran yang tercatat untuk bulan ini.</p>
        ) : (
          <div className="report-category-list">
            {analytics.categorySpending.map((category) => (
              <div className="report-category" key={category.categoryId ?? 'uncategorized'}>
                <div className="report-category__heading">
                  <strong>{category.categoryName}</strong>
                  <span>{percentLabel(category.percentage)}</span>
                </div>
                <div
                  className="report-category__track"
                  role="img"
                  aria-label={`${category.categoryName}: ${formatRupiah(category.amount)}, ${percentLabel(category.percentage)}`}
                >
                  <span style={{ width: `${category.percentage}%` }} />
                </div>
                <p>{formatRupiah(category.amount)}</p>
              </div>
            ))}
          </div>
        )}
        <p className="report-total">
          Total pengeluaran <strong>{formatRupiah(analytics.totalExpense)}</strong>
        </p>
      </Card>

      <Card className="report-calendar-card">
        <p className="section-kicker">AKTIVITAS BULAN INI</p>
        <h2>{monthLabel(month)}</h2>
        <ActivityCalendar month={month} activityDates={activityDates} today={today} />
        <p className="calendar-legend"><span aria-hidden="true" /> Ada transaksi</p>
        <p className="backup-note">{analytics.summary.transactionCount} transaksi bulan ini.</p>
      </Card>
    </div>
  )
}

function ReportInsights({ analytics }: { analytics: MonthlyAnalytics }) {
  const { largestCategory, categoryChanges, projectedExpense } = analytics.insights
  const busiestDay = analytics.summary.busiestDay
  const busiestDayLabel = busiestDay
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
      .format(new Date(`${busiestDay.date}T00:00:00`))
    : 'Belum ada pengeluaran'

  return (
    <div className="report-tab-content">
      <Card className="report-panel">
        <p className="section-kicker">KATEGORI TERBESAR</p>
        {largestCategory ? (
          <div className="report-largest-category">
            <h2>{largestCategory.categoryName}</h2>
            <strong>{formatRupiah(largestCategory.amount)}</strong>
            <span>{percentLabel(largestCategory.percentage)} dari pengeluaran</span>
          </div>
        ) : (
          <p className="backup-note">Belum ada pengeluaran per kategori bulan ini.</p>
        )}
      </Card>

      <Card className="report-panel">
        <p className="section-kicker">RINGKASAN PENGELUARAN</p>
        <div className="report-insight-stats">
          <div>
            <span>Rata-rata per hari</span>
            <strong>{formatRupiah(analytics.summary.averagePerDay)}</strong>
          </div>
          <div>
            <span>Hari terboros</span>
            <strong>{busiestDay
              ? `${busiestDayLabel} · ${formatRupiah(busiestDay.amount)}`
              : busiestDayLabel}
            </strong>
          </div>
          <div>
            <span>Proyeksi akhir bulan</span>
            <strong>{projectedExpense === null ? 'Bulan belum dimulai' : formatRupiah(projectedExpense)}</strong>
          </div>
        </div>
      </Card>

      <Card className="report-panel">
        <p className="section-kicker">PERUBAHAN VS BULAN LALU</p>
        <h2>Kategori pengeluaran</h2>
        <p className="report-change-hint">
          Ditandai jika kenaikan lebih dari 50% dan minimal {formatRupiah(significantCategoryIncreaseThreshold)}.
        </p>
        {categoryChanges.length === 0 ? (
          <p className="backup-note">Belum ada perubahan kategori untuk dibandingkan.</p>
        ) : (
          <div className="report-change-list">
            {categoryChanges.map((change) => {
              const direction = change.difference > 0 ? 'up' : change.difference < 0 ? 'down' : 'same'
              const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'
              const changeText = change.isNew
                ? 'Baru bulan ini'
                : `${arrow} ${percentLabel(change.percentageChange)}`
              return (
                <div
                  className={`report-change-row report-change-row--${direction}`}
                  key={change.categoryId ?? 'uncategorized'}
                  aria-label={`${change.categoryName}: ${changeText}, ${changeAmountLabel(change.difference)}`}
                >
                  <div className="report-change-row__main">
                    <strong>{change.categoryName}</strong>
                    <span>{changeText}</span>
                    {change.isSignificantIncrease && (
                      <span className="report-change-row__flag">Naik signifikan</span>
                    )}
                  </div>
                  <strong className="report-change-row__amount">
                    {changeAmountLabel(change.difference)}
                  </strong>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function ReportBudget({
  month,
  budgetOverview,
  categories,
  onOpenBudget,
}: {
  month: string
  budgetOverview: BudgetOverview | null
  categories: readonly Category[]
  onOpenBudget: () => void
}) {
  if (!budgetOverview) {
    return (
      <EmptyState
        title={`Belum ada budget untuk ${monthLabel(month)}`}
        action={<Button type="button" onClick={onOpenBudget}>Atur budget</Button>}
      >
        Buat budget bulanan untuk melihat progres per kelompok dan kategori di sini.
      </EmptyState>
    )
  }

  return (
    <div className="report-tab-content">
      <Card className="report-panel">
        <p className="section-kicker">PROGRES PER KELOMPOK</p>
        <h2>{monthLabel(month)}</h2>
        <div className="budget-progress-list">
          {budgetOverview.groups.map((group) => (
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

      <Card className="report-panel report-budget-categories">
        <p className="section-kicker">PROGRES PER KATEGORI</p>
        <h2>Batas kategori</h2>
        {budgetOverview.categories.length === 0 ? (
          <p className="backup-note">Belum ada kategori pengeluaran untuk ditampilkan.</p>
        ) : (
          <div className="budget-progress-list">
            {budgetOverview.categories.map((progress) => {
              const categoryName = categories.find(({ id }) => id === progress.categoryId)?.name ?? 'Kategori'
              if (progress.limit === null) {
                return (
                  <div className="report-budget-unlimited" key={progress.categoryId}>
                    <strong>{categoryName}</strong>
                    <span>{formatRupiah(progress.spent)} terpakai · batas belum diatur</span>
                  </div>
                )
              }
              return (
                <BudgetProgress
                  key={progress.categoryId}
                  label={categoryName}
                  spent={progress.spent}
                  limit={progress.limit}
                  percentage={progress.percentage ?? 0}
                  status={progress.status === 'unbudgeted' ? 'normal' : progress.status}
                />
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

export function ReportPage({
  onBack,
  onOpenBudget,
}: {
  onBack: () => void
  onOpenBudget: () => void
}) {
  const [month, setMonth] = useState(currentMonthKey)
  const [activeTab, setActiveTab] = useState<ReportTab>('summary')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = new Date()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    async function loadReportData() {
      setLoading(true)
      try {
        await seedDatabase()
        const [nextTransactions, nextCategories, nextBudgets, nextBudgetItems] = await Promise.all([
          db.transactions.toArray(),
          db.categories.toArray(),
          db.budgets.toArray(),
          db.budgetItems.toArray(),
        ])
        setTransactions(nextTransactions)
        setCategories(nextCategories)
        setBudgets(nextBudgets)
        setBudgetItems(nextBudgetItems)
        setError('')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Data laporan gagal dimuat.')
      } finally {
        setLoading(false)
      }
    }

    void loadReportData()
  }, [])

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % reportTabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + reportTabs.length) % reportTabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = reportTabs.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = reportTabs[nextIndex]
    setActiveTab(nextTab.id)
    tabRefs.current[nextIndex]?.focus()
  }

  if (loading) return <p className="feature-description" role="status">Memuat laporan…</p>

  let analytics: MonthlyAnalytics | null = null
  let budgetOverview: BudgetOverview | null = null
  let calculationError = ''
  try {
    analytics = calculateMonthlyAnalytics({ month, transactions, categories, today })
    budgetOverview = calculateReportBudgetProgress({
      month,
      budget: budgets.find((item) => item.month === month) ?? null,
      budgetItems: budgetItems.filter((item) => item.month === month),
      categories,
      transactions,
      today,
    })
  } catch (reportError) {
    calculationError = reportError instanceof Error ? reportError.message : 'Laporan gagal dihitung.'
  }

  const validMonth = isValidMonthKey(month)
  const activityDates = validMonth ? calculateMonthlyActivityDates(month, transactions) : []
  const activeTabIndex = reportTabs.findIndex((tab) => tab.id === activeTab)
  const activeTabInfo = reportTabs[activeTabIndex]

  return (
    <div className="feature-page report-page">
      <Button variant="secondary" className="button--compact report-back" type="button" onClick={onBack}>
        Kembali
      </Button>
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {calculationError && <p className="form-message form-message--error" role="alert">{calculationError}</p>}

      <Card className="report-month-picker">
        <Input
          label="Bulan laporan"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </Card>

      <div className="report-tabs" role="tablist" aria-label="Bagian laporan" aria-orientation="horizontal">
        {reportTabs.map((tab, index) => (
          <button
            ref={(element) => { tabRefs.current[index] = element }}
            className={`report-tab${activeTab === tab.id ? ' is-active' : ''}`}
            id={`report-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="report-tabpanel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="report-tabpanel"
        id="report-tabpanel"
        role="tabpanel"
        aria-labelledby={`report-tab-${activeTabInfo.id}`}
        tabIndex={0}
      >
        {analytics && validMonth && activeTab === 'summary' && (
          <ReportSummary
            month={month}
            analytics={analytics}
            activityDates={activityDates}
            today={today}
          />
        )}
        {analytics && activeTab === 'trend' && <MonthlyTrend analytics={analytics} />}
        {analytics && activeTab === 'insight' && <ReportInsights analytics={analytics} />}
        {validMonth && activeTab === 'budget' && (
          <ReportBudget
            month={month}
            budgetOverview={budgetOverview}
            categories={categories}
            onOpenBudget={onOpenBudget}
          />
        )}
      </div>
    </div>
  )
}
