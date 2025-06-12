# New Sync

一个基于 Electron + Vite + React + TypeScript 的现代化文件夹同步工具

## 功能特性

- 📁 **文件夹同步**: 复制整个文件夹到目标位置
- 🚫 **智能忽略**: 支持忽略指定文件和文件夹（默认忽略 node_modules）
- ☁️ **iCloud 支持**: 一键选择 iCloud 目录作为目标文件夹
- 📂 **子文件夹选项**: 可选择在目标目录中创建与源文件夹同名的子文件夹
- 📊 **实时进度**: 显示同步进度和当前处理的文件
- 🎯 **通配符支持**: 忽略规则支持通配符模式（如 \*.log, node_modules 等）
- 💾 **配置保存**: 自动保存用户配置，下次打开应用时恢复上次的设置
- 🔄 **配置重置**: 一键重置所有配置到默认状态
- 🛡️ **路径验证**: 智能检测并防止路径冲突，避免复制到自身或子目录

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 使用说明

### 基本使用

1. 启动应用后，点击"选择文件夹"按钮选择源文件夹
2. 选择目标文件夹，或点击"使用 iCloud 文件夹"快速选择 iCloud 目录
3. 配置忽略文件规则（默认已包含常见的忽略规则）
4. 选择是否在目标目录中创建同名子文件夹
5. 点击"开始同步"执行文件复制

### 忽略规则说明

- 每行一个忽略规则
- 支持通配符：`*` 匹配任意字符，`?` 匹配单个字符
- 示例规则：
  - `node_modules` - 忽略 node_modules 文件夹
  - `*.log` - 忽略所有 .log 文件
  - `.DS_Store` - 忽略 macOS 系统文件
  - `.git` - 如需忽略 git 仓库，可手动添加此规则

### iCloud 支持

应用会自动检测 macOS 系统的 iCloud Drive 目录，如果检测到会显示"使用 iCloud 文件夹"按钮，方便快速选择 iCloud 作为同步目标。

### 配置保存功能

- **自动保存**: 应用会自动保存您的所有配置（源文件夹、目标文件夹、忽略规则、子文件夹选项）
- **配置恢复**: 下次打开应用时，会自动恢复上次的配置设置
- **配置状态**: 界面右上角显示配置保存状态，绿色表示已保存，黄色表示有未保存的更改
- **配置重置**: 点击"重置配置"按钮可以清除所有保存的配置，恢复到默认状态
- **存储位置**: 配置文件保存在系统用户数据目录中，确保数据安全

### 路径安全验证

- **智能检测**: 自动检测源路径和目标路径是否存在冲突
- **实时警告**: 当检测到路径冲突时，会显示黄色警告提示
- **防护机制**: 防止以下危险操作：
  - 复制文件夹到自身
  - 复制文件夹到自身的子目录
  - 复制文件夹到父目录的同名位置
- **双重验证**: 前端和后端都有验证机制，确保操作安全

## 技术栈

- **Electron**: v35.1.5 - 跨平台桌面应用框架
- **Vite**: v6.2.6 - 现代化构建工具
- **React**: v19.1.0 - 用户界面库
- **TypeScript**: v5.8.3 - 类型安全的 JavaScript
- **electron-vite**: v3.1.0 - Electron 专用的 Vite 构建工具
