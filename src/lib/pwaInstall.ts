type InstallChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type InstallAvailabilityListener = (available: boolean) => void

let deferredPrompt: InstallPromptEvent | null = null
let initialized = false
const listeners = new Set<InstallAvailabilityListener>()

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  const candidate = event as Event & Partial<InstallPromptEvent>
  return typeof candidate.prompt === 'function' &&
    typeof candidate.userChoice?.then === 'function'
}

function notifyListeners() {
  for (const listener of listeners) listener(deferredPrompt !== null)
}

export function initializeInstallPromptListener(): void {
  if (initialized) return
  initialized = true

  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPromptEvent(event)) return
    event.preventDefault()
    deferredPrompt = event
    notifyListeners()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyListeners()
  })
}

export function subscribeToInstallPrompt(listener: InstallAvailabilityListener): () => void {
  listeners.add(listener)
  listener(deferredPrompt !== null)
  return () => listeners.delete(listener)
}

export async function promptInstall(): Promise<InstallChoice> {
  if (!deferredPrompt) throw new Error('Prompt instal tidak tersedia di browser ini.')

  const prompt = deferredPrompt
  deferredPrompt = null
  notifyListeners()
  await prompt.prompt()
  return prompt.userChoice
}
