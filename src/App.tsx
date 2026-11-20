import { useCallback, useEffect, useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup, type BackupFile } from './lib/backup'
import { db, requestPersistentStorage, seedDatabase } from './db/schema'
import { BottomNav, Button, Card, PageHeader } from './components/ui'
import { WalletsPage } from './features/wallets/WalletsPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { HomePage } from './features/home/HomePage'
import { BudgetPage } from './features/budget/BudgetPage'
import { ReportPage } from './features/reports/ReportPage'
import { SettingsPage } from './features/settings/SettingsPage'
import {
  DEFAULT_WALLET_SETTING_KEY,
  LAST_BACKUP_SETTING_KEY,
  THEME_SETTING_KEY,
} from './lib/settings'
import { createTransactionsCsv } from './lib/csv'
import { downloadBlob } from './lib/download'
import { readTextFile } from './lib/file'
import { promptInstall, subscribeToInstallPrompt } from './lib/pwaInstall'
import {
  applyThemeToDocument,
  getEffectiveTheme,
  nextThemeMode,
  THEME_CACHE_KEY,
  type ThemeMode,
} from './lib/theme'

type Page = 'Home' | 'Dompet' | 'Transaksi' | 'Budget' | 'Laporan' | 'Pengaturan'
type NavigationPage = Exclude<Page, 'Laporan'>

const pages: NavigationPage[] = ['Home', 'Dompet', 'Transaksi', 'Budget', 'Pengaturan']
const pageLabels: Record<Page, string> = {
  Home: 'Beranda',
  Dompet: 'Dompet',
  Transaksi: 'Transaksi',
  Budget: 'Budget',
  Laporan: 'Laporan',
  Pengaturan: 'Pengaturan',
}
const pageIcons: Record<NavigationPage, 'home' | 'wallet' | 'transactions' | 'budget' | 'settings'> = {
  Home: 'home',
  Dompet: 'wallet',
  Transaksi: 'transactions',
  Budget: 'budget',
  Pengaturan: 'settings',
} as const

function settingString(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value !== 'string') throw new Error('Nilai Pengaturan tidak valid.')
  return value
}

function App({
  initialThemeMode,
  initialThemeError,
}: {
  initialThemeMode: ThemeMode
  initialThemeError: string
}) {
  const [page, setPage] = useState<Page>('Home')
  const [focusQuickEntry, setFocusQuickEntry] = useState(
    () => new URLSearchParams(window.location.search).get('tambah') === '1',
  )
  const [themeMode, setThemeMode] = useState(initialThemeMode)
  const [themeError, setThemeError] = useState(initialThemeError)
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [reportReturnPage, setReportReturnPage] = useState<'Home' | 'Budget'>('Home')
  const [message, setMessage] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [installAvailable, setInstallAvailable] = useState(false)
  const [installStatus, setInstallStatus] = useState<{ message: string; error: boolean } | null>(null)
  const [importPreview, setImportPreview] = useState<BackupFile | null>(null)
  const [defaultWalletId, setDefaultWalletId] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const effectiveTheme = getEffectiveTheme(themeMode, systemPrefersDark)
  const handleQuickEntryFocused = useCallback(() => {
    setFocusQuickEntry(false)
    const url = new URL(window.location.href)
    if (url.searchParams.get('tambah') !== '1') return
    url.searchParams.delete('tambah')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  function openReport(fromPage: 'Home' | 'Budget') {
    setReportReturnPage(fromPage)
    setPage('Laporan')
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemPrefersDark(preference.matches)
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    preference.addEventListener('change', updateSystemTheme)

    return () => preference.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => subscribeToInstallPrompt(setInstallAvailable), [])

  useEffect(() => {
    applyThemeToDocument(themeMode, systemPrefersDark)
  }, [themeMode, systemPrefersDark])

  useEffect(() => {
    void seedDatabase()
    void requestPersistentStorage().catch((error: unknown) => {
      setMessage(
        error instanceof Error
          ? `Penyimpanan lokal tetap dapat dipakai, tetapi permintaan agar data tidak dihapus otomatis gagal: ${error.message}`
          : 'Penyimpanan lokal tetap dapat dipakai, tetapi permintaan penyimpanan persisten gagal.',
      )
    })
    void db.settings.get(DEFAULT_WALLET_SETTING_KEY)
      .then((setting) => {
        setDefaultWalletId(settingString(setting?.value))
      })
      .catch((error: unknown) => {
        setSettingsMessage(error instanceof Error ? error.message : 'Dompet default gagal dimuat.')
      })
  }, [])

  async function cycleTheme() {
    const nextMode = nextThemeMode(themeMode)
    try {
      await db.settings.put({ key: THEME_SETTING_KEY, value: nextMode })
    } catch (saveError) {
      setThemeError(saveError instanceof Error ? saveError.message : 'Preferensi tema gagal disimpan.')
      return
    }

    applyThemeToDocument(nextMode, systemPrefersDark)
    setThemeMode(nextMode)
    setThemeError('')
    try {
      window.localStorage.setItem(THEME_CACHE_KEY, nextMode)
    } catch (cacheError) {
      setThemeError(
        cacheError instanceof Error
          ? `Tema tersimpan, tetapi cache tema gagal diperbarui: ${cacheError.message}`
          : 'Tema tersimpan, tetapi cache tema gagal diperbarui.',
      )
    }
  }

  async function handleImportFile(file: File) {
    try {
      const backup = validateBackup(JSON.parse(await readTextFile(file)))
      setImportPreview(backup)
      setMessage(
        `Backup berisi ${backup.data.wallets.length} dompet dan ${backup.data.transactions.length} transaksi.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'File backup tidak dapat dibaca.')
    }
  }

  async function exportBackupAndSaveTimestamp(): Promise<string> {
    let exportedAt: string
    try {
      exportedAt = await exportBackup()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Backup JSON gagal diekspor.')
    }

    try {
      await db.settings.put({
        key: LAST_BACKUP_SETTING_KEY,
        value: exportedAt,
      })
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `File backup sudah dibuat, tetapi tanggal backup gagal disimpan: ${error.message}`
          : 'File backup sudah dibuat, tetapi tanggal backup gagal disimpan.',
      )
    }

    return exportedAt
  }

  async function handleBackupExport() {
    try {
      await exportBackupAndSaveTimestamp()
      setMessage('Backup JSON berhasil diekspor.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Backup JSON gagal diekspor.')
    }
  }

  async function handleCsvExport() {
    try {
      const [transactions, wallets, categories] = await Promise.all([
        db.transactions.toArray(),
        db.wallets.toArray(),
        db.categories.toArray(),
      ])
      const csv = createTransactionsCsv(transactions, wallets, categories)
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(
        new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
        `uangq-transaksi-${date}.csv`,
      )
      setMessage('CSV transaksi berhasil diekspor.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'CSV transaksi gagal diekspor.')
    }
  }

  async function handleInstall() {
    try {
      const choice = await promptInstall()
      setInstallStatus({
        message: choice.outcome === 'accepted' ? 'Pemasangan aplikasi dimulai.' : 'Pemasangan tidak dilanjutkan.',
        error: false,
      })
    } catch (error) {
      setInstallStatus({
        message: error instanceof Error ? error.message : 'Prompt pemasangan gagal dibuka.',
        error: true,
      })
    }
  }

  async function confirmImport() {
    if (!importPreview) return
    try {
      await importBackup(importPreview)
      const setting = await db.settings.get(DEFAULT_WALLET_SETTING_KEY)
      setDefaultWalletId(settingString(setting?.value))
      setImportPreview(null)
      setMessage('Backup berhasil dipulihkan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Backup gagal dipulihkan.')
    }
  }

  async function saveDefaultWallet(walletId: string) {
    try {
      if (walletId) {
        await db.settings.put({ key: DEFAULT_WALLET_SETTING_KEY, value: walletId })
      } else {
        await db.settings.delete(DEFAULT_WALLET_SETTING_KEY)
      }
      setDefaultWalletId(walletId)
      setSettingsMessage(walletId ? 'Dompet default berhasil disimpan.' : 'Pilihan dompet default dihapus.')
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Dompet default gagal disimpan.')
    }
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <PageHeader
          title={pageLabels[page]}
          themeMode={themeMode}
          effectiveTheme={effectiveTheme}
          onCycleTheme={() => void cycleTheme()}
        />
        {themeError && <p className="form-message form-message--error theme-error" role="alert">{themeError}</p>}
        {page === 'Dompet' ? (
          <WalletsPage />
        ) : page === 'Transaksi' ? (
          <TransactionsPage
            onOpenWallets={() => setPage('Dompet')}
            defaultWalletId={defaultWalletId}
          />
        ) : page === 'Budget' ? (
          <BudgetPage onOpenReport={() => openReport('Budget')} />
        ) : page === 'Home' ? (
          <HomePage
            defaultWalletId={defaultWalletId}
            onOpenWallets={() => setPage('Dompet')}
            onOpenBudget={() => setPage('Budget')}
            onOpenReport={() => openReport('Home')}
            onExportBackup={exportBackupAndSaveTimestamp}
            focusQuickEntry={focusQuickEntry}
            onQuickEntryFocused={handleQuickEntryFocused}
          />
        ) : page === 'Laporan' ? (
          <ReportPage
            onBack={() => setPage(reportReturnPage)}
            onOpenBudget={() => setPage('Budget')}
          />
        ) : (
          <div className="feature-page">
            <SettingsPage
              defaultWalletId={defaultWalletId}
              onDefaultWalletChange={(walletId) => void saveDefaultWallet(walletId)}
              onOpenWallets={() => setPage('Dompet')}
              message={settingsMessage}
            />
            <Card className="settings-card">
              <p className="section-kicker">DATA LOKAL</p>
              <h2>Cadangkan data</h2>
              <p className="backup-note">
                Seluruh data tersimpan di perangkat ini saja. Backup tidak otomatis; ekspor dan simpan file secara manual.
              </p>
              <div className="action-list">
                <Button type="button" onClick={() => void handleBackupExport()}>
                  Ekspor backup JSON
                </Button>
                <Button variant="secondary" type="button" onClick={() => void handleCsvExport()}>
                  Ekspor CSV transaksi
                </Button>
                <Button variant="secondary" type="button" onClick={() => fileInput.current?.click()}>
                  Pilih file untuk impor
                </Button>
                {installAvailable && (
                  <Button variant="secondary" type="button" onClick={() => void handleInstall()}>
                    Pasang aplikasi
                  </Button>
                )}
                <input
                  ref={fileInput}
                  className="sr-only"
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleImportFile(file)
                  }}
                />
                {importPreview && (
                  <Button variant="danger" type="button" onClick={() => void confirmImport()}>
                    Konfirmasi ganti seluruh data
                  </Button>
                )}
              </div>
              <p className="backup-note">
                Di Safari iOS: Share (Bagikan) → Add to Home Screen (Tambahkan ke Layar Utama).
              </p>
              {installStatus && (
                <p
                  className={installStatus.error ? 'form-message form-message--error' : 'status-message'}
                  role={installStatus.error ? 'alert' : 'status'}
                >
                  {installStatus.message}
                </p>
              )}
              {message && <p className="status-message" role="status">{message}</p>}
            </Card>
          </div>
        )}
      </main>

      <BottomNav
        items={pages.map((item) => ({
          label: pageLabels[item],
          icon: pageIcons[item],
          current: item === (page === 'Laporan' ? reportReturnPage : page),
          onClick: () => setPage(item),
        }))}
      />
    </div>
  )
}

export default App
