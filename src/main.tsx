import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { db } from './db/schema'
import { THEME_SETTING_KEY } from './lib/settings'
import {
  applyThemeToDocument,
  isThemeMode,
  THEME_CACHE_KEY,
  type ThemeMode,
} from './lib/theme'
import { initializeInstallPromptListener } from './lib/pwaInstall'

const root = createRoot(document.getElementById('root')!)
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
initializeInstallPromptListener()
let initialThemeMode: ThemeMode = 'system'
let initialThemeError = ''

try {
  const cachedMode = window.localStorage.getItem(THEME_CACHE_KEY)
  if (isThemeMode(cachedMode)) initialThemeMode = cachedMode
} catch (error) {
  initialThemeError = error instanceof Error ? error.message : 'Cache tema awal tidak dapat dibaca.'
}

applyThemeToDocument(initialThemeMode, systemThemeQuery.matches)

async function startApp() {
  try {
    const savedTheme = await db.settings.get(THEME_SETTING_KEY)
    if (savedTheme) {
      if (!isThemeMode(savedTheme.value)) throw new Error('Preferensi tema tersimpan tidak valid.')
      initialThemeMode = savedTheme.value
    } else if (initialThemeMode !== 'system') {
      await db.settings.put({ key: THEME_SETTING_KEY, value: initialThemeMode })
    }

    try {
      window.localStorage.setItem(THEME_CACHE_KEY, initialThemeMode)
      initialThemeError = ''
    } catch (error) {
      initialThemeError = error instanceof Error ? error.message : 'Cache tema tidak dapat diperbarui.'
    }
  } catch (error) {
    initialThemeError = error instanceof Error ? error.message : 'Preferensi tema gagal dimuat.'
  }

  applyThemeToDocument(initialThemeMode, systemThemeQuery.matches)
  root.render(
    <StrictMode>
      <App initialThemeMode={initialThemeMode} initialThemeError={initialThemeError} />
    </StrictMode>,
  )
}

void startApp()
