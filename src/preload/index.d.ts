import { ElectronAPI } from '@electron-toolkit/preload'

interface SyncProgress {
  current: number
  total: number
  currentFile: string
}

interface SyncOptions {
  sourcePath: string
  targetPath: string
  ignorePatterns: string[]
  createSubfolder: boolean
}

interface SyncResult {
  success: boolean
  targetPath?: string
  error?: string
}

interface SyncConfig {
  sourcePath: string
  targetPath: string
  ignorePatterns: string
  createSubfolder: boolean
}

interface ConfigResult {
  success: boolean
  config?: SyncConfig
  error?: string
}

interface API {
  selectFolder: () => Promise<string | null>
  getICloudPath: () => Promise<string | null>
  syncFolder: (options: SyncOptions) => Promise<SyncResult>
  onSyncProgress: (callback: (progress: SyncProgress) => void) => void
  removeSyncProgressListener: () => void
  saveConfig: (config: SyncConfig) => Promise<{ success: boolean; error?: string }>
  loadConfig: () => Promise<ConfigResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
