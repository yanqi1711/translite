<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const sourceText = ref('')
const translatedText = ref('')
const sourceLang = ref('auto')
const targetLang = ref('en')
const isLoading = ref(false)
const errorMessage = ref('')
const showResult = ref(false)
const isResultCollapsed = ref(false)
const typingTimer = ref<number | null>(null)

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
  const textarea = document.querySelector('.text-input') as HTMLTextAreaElement
  if (textarea) {
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 300)
    textarea.style.height = `${newHeight}px`
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    scheduleTranslation()
  }
}

function handleInput() {
  adjustInputHeight()
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
}

function getTextToTranslate() {
  const textarea = document.querySelector('.text-input') as HTMLTextAreaElement | null
  if (!textarea)
    return sourceText.value.trim()

  const { selectionStart, selectionEnd } = textarea
  if (selectionStart !== selectionEnd) {
    return sourceText.value.slice(selectionStart, selectionEnd).trim()
  }

  return sourceText.value.trim()
}

function scheduleTranslation() {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
  typingTimer.value = window.setTimeout(() => {
    if (getTextToTranslate()) {
      translateText()
    }
  }, 250)
}

function requestWindowResize() {
  nextTick(() => {
    const app = document.getElementById('app')
    const desiredHeight = app ? app.scrollHeight + 24 : undefined
    window.api.resizeWindow(desiredHeight)
  })
}

async function translateText() {
  const textToTranslate = getTextToTranslate()
  if (!textToTranslate) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  showResult.value = true
  isResultCollapsed.value = true

  requestWindowResize()

  try {
    const response = await window.api.translate(textToTranslate, sourceLang.value, targetLang.value)
    if (response.error) {
      errorMessage.value = response.error
      translatedText.value = ''
      showResult.value = true
      isResultCollapsed.value = false
    }
    else {
      translatedText.value = response.result
      showResult.value = true
      isResultCollapsed.value = false
    }
  }
  catch (error: any) {
    errorMessage.value = `Translation failed: ${error.message}`
    translatedText.value = ''
    showResult.value = true
    isResultCollapsed.value = false
  }
  finally {
    isLoading.value = false
    requestWindowResize()
  }
}

function clearText() {
  sourceText.value = ''
  translatedText.value = ''
  errorMessage.value = ''
  showResult.value = false
  isResultCollapsed.value = false
  nextTick(() => {
    adjustInputHeight()
    requestWindowResize()
  })
}

async function copyResult() {
  if (translatedText.value) {
    try {
      await navigator.clipboard.writeText(translatedText.value)
    }
    catch {
      console.error('Copy failed')
    }
  }
}

function swapLanguages() {
  const temp = sourceLang.value
  sourceLang.value = targetLang.value
  targetLang.value = temp
}

function toggleResult() {
  if (!showResult.value || isLoading.value)
    return

  isResultCollapsed.value = !isResultCollapsed.value
}

async function focusInput() {
  await nextTick()
  const textarea = document.querySelector('.text-input') as HTMLTextAreaElement
  if (textarea) {
    textarea.focus()
  }
}

async function pasteAndTranslate() {
  try {
    const text = await navigator.clipboard.readText()
    if (text && text.trim()) {
      sourceText.value = text
      await nextTick()
      adjustInputHeight()
      translateText()
    }
  }
  catch {
    console.error('Failed to read clipboard')
  }
}

watch(sourceText, () => {
  adjustInputHeight()
  requestWindowResize()
})

watch([showResult, isResultCollapsed, isLoading], () => {
  requestWindowResize()
})

onMounted(() => {
  window.api.onShowApp?.(focusInput)
  window.api.onPasteAndTranslate?.(pasteAndTranslate)
  adjustInputHeight()
  requestWindowResize()
})

onUnmounted(() => {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
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
        v-model="sourceText"
        class="text-input"
        placeholder="输入内容后按 Enter 翻译（支持划词翻译）"
        @keydown="handleKeyDown"
        @input="handleInput"
      />
      <div class="input-info">
        <span class="char-count">{{ sourceText.length }} chars</span>
        <span class="hint">Enter 翻译（选中文本可单独翻译）</span>
      </div>
    </div>

    <section v-if="showResult || isLoading || translatedText || errorMessage" class="result-section" :class="{ expanded: !isResultCollapsed }">
      <header class="result-header" @click="toggleResult">
        <span class="result-title">Translation</span>
        <span class="toggle-icon">{{ isResultCollapsed ? '▶' : '▼' }}</span>
      </header>

      <div v-if="isLoading" class="loading-row">
        <span class="loading-dot" />
        <span>获取翻译中...</span>
      </div>

      <div v-show="!isResultCollapsed && !isLoading" class="result-content">
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
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
