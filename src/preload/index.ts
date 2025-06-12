import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 文件夹选择
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // 获取 iCloud 路径
  getICloudPath: () => ipcRenderer.invoke('get-icloud-path'),

  // 文件夹同步
  syncFolder: (options: {
    sourcePath: string
    targetPath: string
    ignorePatterns: string[]
    createSubfolder: boolean
  }) => ipcRenderer.invoke('sync-folder', options),

  // 监听同步进度
  onSyncProgress: (
    callback: (progress: { current: number; total: number; currentFile: string }) => void
  ) => {
    ipcRenderer.on('sync-progress', (_, progress) => callback(progress))
  },

  // 移除同步进度监听器
  removeSyncProgressListener: () => {
    ipcRenderer.removeAllListeners('sync-progress')
  },

  // 保存配置
  saveConfig: (config: {
    sourcePath: string
    targetPath: string
    ignorePatterns: string
    createSubfolder: boolean
  }) => ipcRenderer.invoke('save-config', config),

  // 读取配置
  loadConfig: () => ipcRenderer.invoke('load-config')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
