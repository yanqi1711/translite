# 翻译助手 - Electron桌面应用

基于 Electron + Vue + TypeScript 开发的桌面翻译应用，支持 LARA 与百度翻译 API。

## 功能特性

- 支持多种语言互译（中文、英语、日语、韩语、法语、西班牙语、德语、意大利语、俄语、葡萄牙语）
- 自动检测源语言
- 实时翻译
- 一键复制翻译结果
- 简洁美观的界面设计
- 支持 LARA / 百度翻译双引擎（通过环境变量切换）

## 安装依赖

```bash
npm install
```

## 配置 API 密钥

在项目根目录创建 `.env` 文件，按需填入以下配置：

```env
TRANSLATION_PROVIDER=lara

# LARA 配置（当 TRANSLATION_PROVIDER=lara）
LARA_ACCESS_KEY_ID=你的LARA_ACCESS_KEY_ID
LARA_ACCESS_KEY_SECRET=你的LARA_ACCESS_KEY_SECRET

# 百度翻译配置（当 TRANSLATION_PROVIDER=baidu）
BAIDU_APP_ID=你的BAIDU_APP_ID
BAIDU_SECRET_KEY=你的BAIDU_SECRET_KEY
```

参考 `.env.example` 文件。

### LARA 配置步骤
1. 访问 [LARA开发者平台](https://developers.laratranslate.com/) 注册账号
2. 创建应用获取 Access Key ID 和 Secret

### 百度翻译配置步骤
1. 访问 [百度翻译开放平台](https://fanyi-api.baidu.com/)
2. 创建应用并获取 `APP ID` 和 `密钥`

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

- 请妥善保管你的API密钥，不要将其提交到版本控制系统
- LARA / 百度翻译 API 都可能有调用频率和额度限制，请注意合理使用
