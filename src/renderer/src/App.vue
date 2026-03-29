<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'

const sourceText = ref('')
const translatedText = ref('')
const sourceLang = ref('auto')
const targetLang = ref('en')
const isLoading = ref(false)
const errorMessage = ref('')
const showResult = ref(false)
const isResultExpanded = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const languageOptions = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'jp', label: '日本語' },
  { value: 'kor', label: '한국어' },
  { value: 'fra', label: 'Français' },
  { value: 'spa', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'ru', label: 'Русский' },
  { value: 'pt', label: 'Português' },
]

function adjustInputHeight() {
  const textarea = textareaRef.value
  if (!textarea) {
    return
  }

  textarea.style.height = 'auto'
  const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 240)
  textarea.style.height = `${newHeight}px`
}

async function resizeWindowToContent() {
  await nextTick()
  const appElement = document.querySelector('.translator-container') as HTMLElement | null
  const contentHeight = appElement ? Math.ceil(appElement.scrollHeight + 48) : 520
  window.api.resizeWindow(contentHeight)
}

function getTextToTranslate() {
  const textarea = textareaRef.value
  if (!textarea) {
    return sourceText.value.trim()
  }

  const selectedText = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim()
  return selectedText || sourceText.value.trim()
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    translateText()
  }
}

function handleInput() {
  adjustInputHeight()
}

async function translateText() {
  const textToTranslate = getTextToTranslate()
  if (!textToTranslate) {
    return
  }

  showResult.value = true
  isResultExpanded.value = false
  isLoading.value = true
  errorMessage.value = ''
  translatedText.value = ''
  await resizeWindowToContent()

  try {
    const response = await window.api.translate(textToTranslate, sourceLang.value, targetLang.value)
    if (response.error) {
      errorMessage.value = response.error
      showResult.value = false
      isResultExpanded.value = false
      return
    }

    translatedText.value = response.result
    isResultExpanded.value = true
  }
  catch (error: any) {
    errorMessage.value = `Translation failed: ${error.message}`
    showResult.value = false
    isResultExpanded.value = false
  }
  finally {
    isLoading.value = false
    await resizeWindowToContent()
  }
}

function clearText() {
  sourceText.value = ''
  translatedText.value = ''
  errorMessage.value = ''
  showResult.value = false
  isResultExpanded.value = false
  nextTick(() => {
    adjustInputHeight()
    resizeWindowToContent()
  })
}

async function copyResult() {
  if (!translatedText.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(translatedText.value)
  }
  catch {
    console.error('Copy failed')
  }
}

function swapLanguages() {
  const temp = sourceLang.value
  sourceLang.value = targetLang.value
  targetLang.value = temp
}

function toggleResult() {
  if (!translatedText.value || isLoading.value) {
    return
  }
  isResultExpanded.value = !isResultExpanded.value
  resizeWindowToContent()
}

async function focusInput() {
  await nextTick()
  textareaRef.value?.focus()
}

async function pasteAndTranslate() {
  try {
    const text = await navigator.clipboard.readText()
    await translateSelectedText(text)
  }
  catch {
    console.error('Failed to read clipboard')
  }
}

async function translateSelectedText(text: string) {
  if (!text || !text.trim()) {
    return
  }

  sourceText.value = text.trim()
  await nextTick()
  adjustInputHeight()
  await focusInput()
  await translateText()
}

watch(sourceText, () => {
  adjustInputHeight()
})

watch([showResult, isResultExpanded], async () => {
  await resizeWindowToContent()
})

onMounted(() => {
  window.api.onShowApp?.(focusInput)
  window.api.onPasteAndTranslate?.(pasteAndTranslate)
  window.api.onTranslateSelectedText?.(translateSelectedText)
  adjustInputHeight()
  resizeWindowToContent()
  focusInput()
})
</script>

<template>
  <div class="translator-container">
    <header class="header">
      <h1>Lara Translate</h1>
    </header>

    <div class="language-selector">
      <select v-model="sourceLang" class="lang-select">
        <option v-for="lang in languageOptions" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </select>
      <button class="swap-btn" aria-label="Swap languages" @click="swapLanguages">
        ↔
      </button>
      <select v-model="targetLang" class="lang-select">
        <option v-for="lang in languageOptions.filter(l => l.value !== 'auto')" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </select>
    </div>

    <div class="input-section">
      <textarea
        ref="textareaRef"
        v-model="sourceText"
        class="text-input"
        placeholder="输入文本后按 Enter 翻译（支持划词翻译）"
        @keydown="handleKeyDown"
        @input="handleInput"
      />
      <div class="input-info">
        <span class="char-count">{{ sourceText.length }} chars</span>
        <span class="hint">Enter 翻译，Shift+Enter 换行</span>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <section :class="['result-section', { visible: showResult }]">
      <header v-if="showResult || translatedText" class="result-header" @click="toggleResult">
        <span class="result-title">Translation</span>
        <span class="toggle-icon">{{ isResultExpanded ? '▼' : '▶' }}</span>
      </header>
      <div v-show="isLoading || isResultExpanded" class="result-content">
        <div v-if="isLoading" class="loading">Translating...</div>
        <p v-else-if="translatedText" class="result-text">{{ translatedText }}</p>
        <div v-if="translatedText" class="result-actions">
          <button class="copy-btn" aria-label="Copy translation" @click="copyResult">
            Copy
          </button>
        </div>
      </div>
    </section>

    <footer class="actions">
      <button class="btn" aria-label="Clear all" @click="clearText">
        Clear
      </button>
    </footer>
  </div>
</template>
