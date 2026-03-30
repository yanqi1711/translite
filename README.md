# LARA翻译 - Electron桌面应用

基于 Electron + Vue + TypeScript 开发的桌面翻译应用，支持 LARA 和百度翻译 API。

## 功能特性

- 支持多种语言互译（中文、英语、日语、韩语、法语、西班牙语、德语、意大利语、俄语、葡萄牙语）
- 自动检测源语言
- 实时翻译
- 一键复制翻译结果
- 简洁美观的界面设计
- 支持 LARA / 百度翻译双引擎，可通过环境变量切换

## 安装依赖

```bash
npm install
```

## 配置 API 密钥

在项目根目录创建 `.env` 文件。你可以使用 LARA 或百度翻译（推荐至少配置一个）：

```env
# 可选：强制指定翻译引擎（baidu 或 lara）
# TRANSLATION_PROVIDER=baidu

# LARA 配置
LARA_ACCESS_KEY_ID=你的_LARA_ACCESS_KEY_ID
LARA_ACCESS_KEY_SECRET=你的_LARA_ACCESS_KEY_SECRET

# 百度翻译开放平台配置
BAIDU_APP_ID=你的_BAIDU_APP_ID
BAIDU_APP_SECRET=你的_BAIDU_APP_SECRET
```

说明：
- 若设置 `TRANSLATION_PROVIDER=baidu`，将强制使用百度翻译。
- 若未设置 `TRANSLATION_PROVIDER` 且配置了百度密钥，默认优先百度翻译。
- 若百度不可用，则使用 LARA（前提是已配置 LARA 密钥）。

## 开发

```bash
npm run dev
```

## 构建

```bash
npm run build
```

## 打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 技术栈

- Electron
- Vue 3
- TypeScript
- Vite
- LARA Translation SDK (@translated/lara)
- 百度翻译开放平台 API

## 注意事项

- 请妥善保管密钥，不要提交到版本控制系统
- 不同翻译平台均有调用频率和配额限制，请合理使用
