import { useEffect, useState } from 'react'
import { db, seedDatabase, type Category, type Transaction } from '../../db/schema'
import { Button, Card, EmptyState, Input } from '../../components/ui'
import { calculateMonthlyAnalytics, type MonthlyAnalytics } from '../../lib/analytics'
import { formatRupiah } from '../../lib/money'

function currentMonthKey(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: style, year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
}

function percentLabel(value: number | null): string {
  if (value === null) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

function calculateReport(
  month: string,
  transactions: readonly Transaction[],
  categories: readonly Category[],
): MonthlyAnalytics {
  return calculateMonthlyAnalytics({ month, transactions, categories })
}

function MonthlyTrend({ analytics }: { analytics: MonthlyAnalytics }) {
  const maximum = Math.max(
    0,
    ...analytics.trends.flatMap(({ expense, income }) => [expense, income]),
  )

  return (
    <Card className="report-panel">
      <p className="section-kicker">TREN 6 BULAN</p>
      <h2>Pengeluaran dan pemasukan</h2>
      <div className="report-legend" aria-label="Legenda tren">
        <span><i className="report-legend__swatch" /> Pengeluaran</span>
        <span><i className="report-legend__swatch report-legend__swatch--income" /> Pemasukan</span>
      </div>
      <div className="report-trend-list">
        {analytics.trends.map(({ month, expense, income }) => (
          <div className="report-trend" key={month}>
            <strong>{monthLabel(month, 'short')}</strong>
            <div
              className="report-trend__bars"
              role="img"
              aria-label={`${monthLabel(month)}: pengeluaran ${formatRupiah(expense)}, pemasukan ${formatRupiah(income)}`}
            >
              <span
                className="report-trend__bar"
                style={{ width: `${maximum === 0 ? 0 : expense / maximum * 100}%` }}
              />
              <span
                className="report-trend__bar report-trend__bar--income"
                style={{ width: `${maximum === 0 ? 0 : income / maximum * 100}%` }}
              />
            </div>
            <div className="report-trend__amounts">
              <span>Keluar {formatRupiah(expense)}</span>
              <span>Masuk {formatRupiah(income)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ReportPage({ onBack }: { onBack: () => void }) {
  const [month, setMonth] = useState(currentMonthKey)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadReportData() {
      setLoading(true)
      try {
        await seedDatabase()
        const [nextTransactions, nextCategories] = await Promise.all([
          db.transactions.toArray(),
          db.categories.toArray(),
        ])
        setTransactions(nextTransactions)
        setCategories(nextCategories)
        setError('')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Data laporan gagal dimuat.')
      } finally {
        setLoading(false)
      }
    }

    void loadReportData()
  }, [])

  if (loading) return <p className="feature-description" role="status">Memuat laporan…</p>

  let analytics: MonthlyAnalytics | null = null
  let calculationError = ''
  try {
    analytics = calculateReport(month, transactions, categories)
  } catch (reportError) {
    calculationError = reportError instanceof Error ? reportError.message : 'Laporan gagal dihitung.'
  }

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

      {analytics && (
        <>
          {analytics.summary.transactionCount === 0 && (
            <EmptyState title={`Belum ada transaksi di ${monthLabel(month)}`}>
              Pilih bulan lain atau catat transaksi pertamamu untuk melihat perkembangan keuangan.
            </EmptyState>
          )}

          <Card className="report-panel">
            <p className="section-kicker">PENGELUARAN PER KATEGORI</p>
            <h2>{monthLabel(month)}</h2>
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
            <p className="report-total">Total pengeluaran <strong>{formatRupiah(analytics.totalExpense)}</strong></p>
          </Card>

          <MonthlyTrend analytics={analytics} />

          <Card className="report-panel">
            <p className="section-kicker">DIBANDING BULAN LALU</p>
            <h2>{monthLabel(analytics.monthComparison.previousMonth)}</h2>
            <div className={`report-comparison${analytics.monthComparison.difference > 0
              ? ' is-increased'
              : analytics.monthComparison.difference < 0 ? ' is-decreased' : ''}`}
            >
              <strong>
                {analytics.monthComparison.difference > 0 ? '+' : analytics.monthComparison.difference < 0 ? '−' : ''}
                {formatRupiah(Math.abs(analytics.monthComparison.difference))}
              </strong>
              <span>{percentLabel(analytics.monthComparison.percentageChange)}</span>
            </div>
            <p>
              {analytics.monthComparison.percentageChange === null
                ? 'Bulan lalu belum memiliki pengeluaran sebagai pembanding persentase.'
                : analytics.monthComparison.difference > 0
                  ? 'Pengeluaran bertambah dibanding bulan lalu.'
                  : analytics.monthComparison.difference < 0
                    ? 'Pengeluaran berkurang dibanding bulan lalu.'
                    : 'Pengeluaran sama dengan bulan lalu.'}
            </p>
            <div className="report-comparison__values">
              <span>Bulan ini <strong>{formatRupiah(analytics.monthComparison.currentExpense)}</strong></span>
              <span>Bulan lalu <strong>{formatRupiah(analytics.monthComparison.previousExpense)}</strong></span>
            </div>
          </Card>

          <Card className="report-panel">
            <p className="section-kicker">RINGKASAN BULANAN</p>
            <h2>{monthLabel(month)}</h2>
            <div className="report-summary">
              <div>
                <span>Rata-rata per hari</span>
                <strong>{formatRupiah(analytics.summary.averagePerDay)}</strong>
              </div>
              <div>
                <span>Hari terboros</span>
                <strong>
                  {analytics.summary.busiestDay
                    ? `${new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      }).format(new Date(`${analytics.summary.busiestDay.date}T00:00:00`))} · ${formatRupiah(analytics.summary.busiestDay.amount)}`
                    : 'Belum ada pengeluaran'}
                </strong>
              </div>
              <div>
                <span>Jumlah transaksi <small>(termasuk transfer)</small></span>
                <strong>{analytics.summary.transactionCount}</strong>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
