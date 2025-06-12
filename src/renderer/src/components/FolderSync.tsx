import { useState, useEffect, useRef } from 'react'
import './FolderSync.css'

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

function FolderSync(): React.JSX.Element {
  const [sourcePath, setSourcePath] = useState<string>('')
  const [targetPath, setTargetPath] = useState<string>('')
  const [ignorePatterns, setIgnorePatterns] = useState<string>('node_modules\n.DS_Store\n*.log')
  const [createSubfolder, setCreateSubfolder] = useState<boolean>(false)
  const [isSync, setIsSync] = useState<boolean>(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [icloudPath, setIcloudPath] = useState<string | null>(null)
  const [configSaved, setConfigSaved] = useState<boolean>(true)
  const [pathWarning, setPathWarning] = useState<string>('')
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    targetPath?: string
    error?: string
  } | null>(null)
  const syncResultRef = useRef<{
    success: boolean
    targetPath?: string
    error?: string
  } | null>(null)

  useEffect(() => {
    // 加载保存的配置
    const loadSavedConfig = async () => {
      try {
        const result = await window.api.loadConfig()
        if (result.success && result.config) {
          setSourcePath(result.config.sourcePath)
          setTargetPath(result.config.targetPath)
          setIgnorePatterns(result.config.ignorePatterns)
          setCreateSubfolder(result.config.createSubfolder)
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }

    // 获取 iCloud 路径
    window.api.getICloudPath().then((path) => {
      setIcloudPath(path)
    })

    // 监听同步进度
    window.api.onSyncProgress((progress: SyncProgress) => {
      setProgress(progress)

      // 当进度达到100%时，检查是否有待显示的同步结果
      if (progress.current === progress.total && syncResultRef.current) {
        // 延迟一点时间确保进度条动画完成
        setTimeout(() => {
          const result = syncResultRef.current
          if (result && result.success) {
            alert(`同步完成！文件已复制到：${result.targetPath}`)
          } else if (result) {
            alert(`同步失败：${result.error}`)
          }
          setSyncResult(null)
          syncResultRef.current = null
          setProgress(null)
          setIsSync(false)
        }, 500)
      }
    })

    // 加载配置
    loadSavedConfig()

    return () => {
      window.api.removeSyncProgressListener()
    }
  }, [])

  // 保存配置
  const saveConfig = async () => {
    try {
      await window.api.saveConfig({
        sourcePath,
        targetPath,
        ignorePatterns,
        createSubfolder
      })
      setConfigSaved(true)
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  // 当配置改变时自动保存
  useEffect(() => {
    // 防止初始加载时保存空配置
    if (sourcePath || targetPath || ignorePatterns !== 'node_modules\n.DS_Store\n*.log') {
      setConfigSaved(false) // 标记配置未保存
      const timeoutId = setTimeout(() => {
        saveConfig()
      }, 500) // 延迟500ms保存，避免频繁保存

      return () => clearTimeout(timeoutId)
    }
  }, [sourcePath, targetPath, ignorePatterns, createSubfolder])

  // 检查路径冲突
  const checkPathConflict = () => {
    if (!sourcePath || !targetPath) {
      setPathWarning('')
      return
    }

    const normalizedSource = sourcePath.replace(/\\/g, '/').replace(/\/$/, '')
    const normalizedTarget = targetPath.replace(/\\/g, '/').replace(/\/$/, '')

    let finalTarget = normalizedTarget
    if (createSubfolder) {
      const sourceFolderName = sourcePath.split(/[/\\]/).pop() || ''
      finalTarget = `${normalizedTarget}/${sourceFolderName}`
    }

    if (normalizedSource === finalTarget) {
      setPathWarning('⚠️ 不能将文件夹复制到自身')
    } else if (finalTarget.startsWith(normalizedSource + '/')) {
      setPathWarning('⚠️ 不能将文件夹复制到自身的子目录中')
    } else if (normalizedSource.startsWith(finalTarget + '/')) {
      setPathWarning('⚠️ 目标路径不能是源路径的父目录')
    } else {
      setPathWarning('')
    }
  }

  // 当路径或子文件夹选项改变时检查冲突
  useEffect(() => {
    checkPathConflict()
  }, [sourcePath, targetPath, createSubfolder])

  const handleSelectSourceFolder = async () => {
    const path = await window.api.selectFolder()
    if (path) {
      setSourcePath(path)
    }
  }

  const handleSelectTargetFolder = async () => {
    const path = await window.api.selectFolder()
    if (path) {
      setTargetPath(path)
    }
  }

  const handleUseICloudFolder = () => {
    if (icloudPath) {
      setTargetPath(icloudPath)
    }
  }

  const handleSync = async () => {
    if (!sourcePath || !targetPath) {
      alert('请选择源文件夹和目标文件夹')
      return
    }

    // 前端路径验证
    const validatePaths = () => {
      // 规范化路径进行比较
      const normalizedSource = sourcePath.replace(/\\/g, '/').replace(/\/$/, '')
      const normalizedTarget = targetPath.replace(/\\/g, '/').replace(/\/$/, '')

      let finalTarget = normalizedTarget
      if (createSubfolder) {
        const sourceFolderName = sourcePath.split(/[/\\]/).pop() || ''
        finalTarget = `${normalizedTarget}/${sourceFolderName}`
      }

      // 检查是否尝试复制到自身
      if (normalizedSource === finalTarget) {
        return '不能将文件夹复制到自身'
      }

      // 检查是否尝试复制到自身的子目录
      if (finalTarget.startsWith(normalizedSource + '/')) {
        return '不能将文件夹复制到自身的子目录中'
      }

      // 检查是否尝试复制到父目录
      if (normalizedSource.startsWith(finalTarget + '/')) {
        return '目标路径不能是源路径的父目录'
      }

      return null
    }

    const validationError = validatePaths()
    if (validationError) {
      alert(validationError)
      return
    }

    setIsSync(true)
    setProgress(null)

    const patterns = ignorePatterns
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    const options: SyncOptions = {
      sourcePath,
      targetPath,
      ignorePatterns: patterns,
      createSubfolder
    }

    try {
      const result = await window.api.syncFolder(options)

      // 保存同步结果，等待进度完成后再显示
      setSyncResult(result)
      syncResultRef.current = result

      // 如果同步失败，立即显示错误（因为不会有进度更新）
      if (!result.success) {
        alert(`同步失败：${result.error}`)
        setIsSync(false)
        setProgress(null)
        setSyncResult(null)
        syncResultRef.current = null
      } else {
        // 如果成功但没有进度更新（比如没有文件需要复制），设置一个超时
        setTimeout(() => {
          const currentResult = syncResultRef.current
          if (currentResult && currentResult.success) {
            alert(`同步完成！文件已复制到：${currentResult.targetPath}`)
            setSyncResult(null)
            syncResultRef.current = null
            setProgress(null)
            setIsSync(false)
          }
        }, 1000) // 1秒超时
      }
    } catch (error) {
      alert(`同步出错：${error}`)
      setIsSync(false)
      setProgress(null)
      setSyncResult(null)
      syncResultRef.current = null
    }
  }

  const handleResetConfig = async () => {
    if (confirm('确定要重置所有配置吗？这将清除所有已保存的设置。')) {
      setSourcePath('')
      setTargetPath('')
      setIgnorePatterns('node_modules\n.DS_Store\n*.log')
      setCreateSubfolder(false)
      await saveConfig()
    }
  }

  const getProgressPercentage = () => {
    if (!progress) return 0
    return Math.round((progress.current / progress.total) * 100)
  }

  return (
    <div className="folder-sync">
      <div className="header">
        <h2>New Sync</h2>
        <div className="header-actions">
          <div className={`config-status ${configSaved ? 'saved' : 'unsaved'}`}>
            {configSaved ? '✓ 配置已保存' : '⚠ 配置未保存'}
          </div>
          <button onClick={handleResetConfig} className="reset-btn" title="重置所有配置">
            重置配置
          </button>
        </div>
      </div>

      <div className="sync-section">
        <h3>源文件夹</h3>
        <div className="folder-input">
          <input type="text" value={sourcePath} placeholder="选择要复制的源文件夹" readOnly />
          <button onClick={handleSelectSourceFolder}>选择文件夹</button>
        </div>
      </div>

      <div className="sync-section">
        <h3>目标文件夹</h3>
        <div className="folder-input">
          <input type="text" value={targetPath} placeholder="选择目标文件夹" readOnly />
          <button onClick={handleSelectTargetFolder}>选择文件夹</button>
          {icloudPath && (
            <button onClick={handleUseICloudFolder} className="icloud-btn">
              使用 iCloud 文件夹
            </button>
          )}
        </div>
      </div>

      <div className="sync-section">
        <h3>忽略文件配置</h3>
        <textarea
          value={ignorePatterns}
          onChange={(e) => setIgnorePatterns(e.target.value)}
          placeholder="每行一个忽略规则，支持通配符"
          rows={6}
        />
        <p className="help-text">支持通配符模式，如：*.log, node_modules, .git 等</p>
      </div>

      <div className="sync-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={createSubfolder}
            onChange={(e) => setCreateSubfolder(e.target.checked)}
          />
          在目标文件夹中创建与源文件夹同名的子文件夹
        </label>
      </div>

      {pathWarning && <div className="path-warning">{pathWarning}</div>}

      <div className="sync-actions">
        <button
          onClick={handleSync}
          disabled={isSync || !sourcePath || !targetPath || !!pathWarning}
          className="sync-btn"
        >
          {isSync ? '同步中...' : '开始同步'}
        </button>
      </div>

      {progress && (
        <div className="progress-section">
          <h3>同步进度</h3>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${getProgressPercentage()}%` }}></div>
          </div>
          <div className="progress-info">
            <span>
              {progress.current} / {progress.total} ({getProgressPercentage()}%)
            </span>
            <span className="current-file">当前文件: {progress.currentFile}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default FolderSync
