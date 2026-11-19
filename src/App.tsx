import { useEffect, useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup, type BackupFile } from './lib/backup'
import { requestPersistentStorage, seedDatabase } from './db/schema'
import { BottomNav, Button, Card, EmptyState, PageHeader } from './components/ui'

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

function App() {
  const [page, setPage] = useState<Page>('Home')
  const [message, setMessage] = useState('')
  const [importPreview, setImportPreview] = useState<BackupFile | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void seedDatabase()
    void requestPersistentStorage()
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
    await importBackup(importPreview)
    setImportPreview(null)
    setMessage('Backup berhasil dipulihkan.')
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <PageHeader title={pageLabels[page]} />
        {page !== 'Pengaturan' ? (
          <EmptyState title={`Belum ada ${pageLabels[page].toLowerCase()}`}>
            Mulai dari Pengaturan untuk membuat atau memulihkan backup.
          </EmptyState>
        ) : (
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
