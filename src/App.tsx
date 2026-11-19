import { useEffect, useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup, type BackupFile } from './lib/backup'
import { db, requestPersistentStorage, seedDatabase } from './db/schema'
import { BottomNav, Button, Card, EmptyState, PageHeader } from './components/ui'
import { WalletsPage } from './features/wallets/WalletsPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { HomePage } from './features/home/HomePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { DEFAULT_WALLET_SETTING_KEY } from './lib/settings'

type Page = 'Home' | 'Dompet' | 'Transaksi' | 'Budget' | 'Pengaturan'

const pages: Page[] = ['Home', 'Dompet', 'Transaksi', 'Budget', 'Pengaturan']
const pageLabels: Record<Page, string> = {
  Home: 'Beranda',
  Dompet: 'Dompet',
  Transaksi: 'Transaksi',
  Budget: 'Budget',
  Pengaturan: 'Pengaturan',
}
const pageIcons = {
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

function App() {
  const [page, setPage] = useState<Page>('Home')
  const [message, setMessage] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [importPreview, setImportPreview] = useState<BackupFile | null>(null)
  const [defaultWalletId, setDefaultWalletId] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void seedDatabase()
    void requestPersistentStorage()
    void db.settings.get(DEFAULT_WALLET_SETTING_KEY)
      .then((setting) => {
        setDefaultWalletId(settingString(setting?.value))
      })
      .catch((error: unknown) => {
        setSettingsMessage(error instanceof Error ? error.message : 'Dompet default gagal dimuat.')
      })
  }, [])

  async function handleImportFile(file: File) {
    try {
      const backup = validateBackup(JSON.parse(await file.text()))
      setImportPreview(backup)
      setMessage(
        `Backup berisi ${backup.data.wallets.length} dompet dan ${backup.data.transactions.length} transaksi.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'File backup tidak dapat dibaca.')
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
        <PageHeader title={pageLabels[page]} />
        {page === 'Dompet' ? (
          <WalletsPage />
        ) : page === 'Transaksi' ? (
          <TransactionsPage
            onOpenWallets={() => setPage('Dompet')}
            defaultWalletId={defaultWalletId}
          />
        ) : page === 'Home' ? (
          <HomePage
            defaultWalletId={defaultWalletId}
            onOpenWallets={() => setPage('Dompet')}
          />
        ) : page !== 'Pengaturan' ? (
          <EmptyState title={`Belum ada ${pageLabels[page].toLowerCase()}`}>
            Mulai dari Pengaturan untuk membuat atau memulihkan backup.
          </EmptyState>
        ) : (
          <div className="feature-page">
            <SettingsPage
              defaultWalletId={defaultWalletId}
              onDefaultWalletChange={(walletId) => void saveDefaultWallet(walletId)}
              message={settingsMessage}
            />
            <Card className="settings-card">
              <p className="section-kicker">DATA LOKAL</p>
              <h2>Cadangkan data</h2>
              <p className="backup-note">Semua data tersimpan lokal di perangkat ini.</p>
              <div className="action-list">
                <Button type="button" onClick={() => void exportBackup()}>
                  Ekspor backup JSON
                </Button>
                <Button variant="secondary" type="button" onClick={() => fileInput.current?.click()}>
                  Pilih file untuk impor
                </Button>
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
              {message && <p className="status-message" role="status">{message}</p>}
            </Card>
          </div>
        )}
      </main>

      <BottomNav
        items={pages.map((item) => ({
          label: pageLabels[item],
          icon: pageIcons[item],
          current: item === page,
          onClick: () => setPage(item),
        }))}
      />
    </div>
  )
}

export default App
