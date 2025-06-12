import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'fs-extra'
import * as path from 'path'
import { minimatch } from 'minimatch'
import { homedir } from 'os'

// 配置文件路径
const getConfigPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'sync-config.json')
}

// 默认配置
const defaultConfig = {
  sourcePath: '',
  targetPath: '',
  ignorePatterns: 'node_modules\n.DS_Store\n*.log',
  createSubfolder: false
}

// 文件同步函数
async function syncFolder(
  sourcePath: string,
  targetPath: string,
  ignorePatterns: string[],
  onProgress?: (progress: { current: number; total: number; currentFile: string }) => void
): Promise<void> {
  // 使用 fs-extra 的 copy 方法，它有内置的路径冲突检测
  const filter = (src: string): boolean => {
    const relativePath = path.relative(sourcePath, src)

    // 如果是根目录，允许复制
    if (relativePath === '') {
      return true
    }

    // 检查是否应该忽略
    const shouldIgnore = ignorePatterns.some((pattern) => {
      const fileName = path.basename(src)
      return minimatch(relativePath, pattern) || minimatch(fileName, pattern)
    })

    return !shouldIgnore
  }

  // 如果需要进度报告，使用逐个文件复制
  if (onProgress) {
    const allFiles = await getAllFiles(sourcePath, ignorePatterns)
    let processedFiles = 0

    for (const file of allFiles) {
      const relativePath = path.relative(sourcePath, file)
      const targetFile = path.join(targetPath, relativePath)

      // 确保目标目录存在
      await fs.ensureDir(path.dirname(targetFile))

      // 复制文件，添加额外的安全检查
      try {
        await fs.copy(file, targetFile, {
          overwrite: true,
          errorOnExist: false,
          filter: () => true // 已经在 getAllFiles 中过滤了
        })
      } catch (error: any) {
        // 如果是路径冲突错误，跳过这个文件
        if (error?.message?.includes('subdirectory of itself')) {
          console.warn(`Skipping file due to path conflict: ${file}`)
          continue
        }
        throw error
      }

      processedFiles++

      // 报告进度
      onProgress({
        current: processedFiles,
        total: allFiles.length,
        currentFile: relativePath
      })
    }
  } else {
    // 没有进度报告时，使用更高效的整体复制
    await fs.copy(sourcePath, targetPath, {
      overwrite: true,
      errorOnExist: false,
      filter
    })
  }
}

// 获取所有文件（排除忽略的文件）
async function getAllFiles(dirPath: string, ignorePatterns: string[]): Promise<string[]> {
  const files: string[] = []

  async function traverse(currentPath: string): Promise<void> {
    const items = await fs.readdir(currentPath)

    for (const item of items) {
      const fullPath = path.join(currentPath, item)
      const relativePath = path.relative(dirPath, fullPath)

      // 检查是否应该忽略
      const shouldIgnore = ignorePatterns.some(
        (pattern) => minimatch(relativePath, pattern) || minimatch(item, pattern)
      )

      if (shouldIgnore) {
        continue
      }

      const stat = await fs.stat(fullPath)

      if (stat.isDirectory()) {
        await traverse(fullPath)
      } else {
        files.push(fullPath)
      }
    }
  }

  await traverse(dirPath)
  return files
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 文件夹选择对话框
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // 获取 iCloud 目录路径
  ipcMain.handle('get-icloud-path', () => {
    const icloudPath = path.join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs')
    return fs.existsSync(icloudPath) ? icloudPath : null
  })

  // 保存配置
  ipcMain.handle('save-config', async (_, config) => {
    try {
      const configPath = getConfigPath()
      await fs.ensureDir(path.dirname(configPath))
      await fs.writeJson(configPath, config, { spaces: 2 })
      return { success: true }
    } catch (error: any) {
      console.error('Save config error:', error)
      return { success: false, error: error?.message || 'Unknown error' }
    }
  })

  // 读取配置
  ipcMain.handle('load-config', async () => {
    try {
      const configPath = getConfigPath()
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath)
        return { success: true, config: { ...defaultConfig, ...config } }
      } else {
        return { success: true, config: defaultConfig }
      }
    } catch (error: any) {
      console.error('Load config error:', error)
      return { success: true, config: defaultConfig }
    }
  })

  // 文件夹同步
  ipcMain.handle('sync-folder', async (event, options) => {
    const { sourcePath, targetPath, ignorePatterns, createSubfolder } = options

    try {
      let finalTargetPath = targetPath

      // 如果选择创建同名子文件夹
      if (createSubfolder) {
        const sourceFolderName = path.basename(sourcePath)
        finalTargetPath = path.join(targetPath, sourceFolderName)
      }

      // 验证路径，防止复制到自身或子目录
      const validatePaths = async (source: string, target: string): Promise<string | null> => {
        try {
          // 获取真实路径，处理符号链接
          const realSource = await fs.realpath(source)
          const realTarget = await fs.realpath(target).catch(() => {
            // 如果目标路径不存在，使用父目录的真实路径
            const parentDir = path.dirname(target)
            return fs.realpath(parentDir).then(realParent =>
              path.join(realParent, path.basename(target))
            )
          })

          // 规范化路径
          const normalizedSource = path.resolve(realSource)
          const normalizedTarget = path.resolve(realTarget)

          // 检查是否尝试复制到自身
          if (normalizedSource === normalizedTarget) {
            return '不能将文件夹复制到自身'
          }

          // 检查是否尝试复制到自身的子目录
          if (normalizedTarget.startsWith(normalizedSource + path.sep)) {
            return '不能将文件夹复制到自身的子目录中'
          }

          // 检查是否尝试复制到父目录的同名文件夹
          if (normalizedSource.startsWith(normalizedTarget + path.sep)) {
            return '目标路径不能是源路径的父目录'
          }

          return null
        } catch (error: any) {
          console.error('Path validation error:', error)
          return null // 如果验证出错，允许继续（让 fs.copy 处理）
        }
      }

      const pathError = await validatePaths(sourcePath, finalTargetPath)
      if (pathError) {
        return { success: false, error: pathError }
      }

      // 确保目标目录存在
      await fs.ensureDir(finalTargetPath)

      // 开始同步
      await syncFolder(sourcePath, finalTargetPath, ignorePatterns, (progress) => {
        event.sender.send('sync-progress', progress)
      })

      return { success: true, targetPath: finalTargetPath }
    } catch (error: any) {
      console.error('Sync error:', error)
      return { success: false, error: error?.message || 'Unknown error' }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
