<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const sourceText = ref('')
const translatedText = ref('')
const sourceLang = ref('auto')
const targetLang = ref('en')
const isLoading = ref(false)
const errorMessage = ref('')
const showResult = ref(false)
const typingTimer = ref<number | null>(null)
const inputHeight = ref('60px')

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
    inputHeight.value = `${newHeight}px`
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

function scheduleTranslation() {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
  typingTimer.value = window.setTimeout(() => {
    if (sourceText.value.trim()) {
      translateText()
    }
  }, 500)
}

async function translateText() {
  if (!sourceText.value.trim()) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  translatedText.value = ''
  showResult.value = false

  try {
    const response = await window.api.translate(sourceText.value, sourceLang.value, targetLang.value)
    if (response.error) {
      errorMessage.value = response.error
      showResult.value = false
    }
    else {
      translatedText.value = response.result
      showResult.value = true
    }
  }
  catch (error: any) {
    errorMessage.value = `Translation failed: ${error.message}`
    showResult.value = false
  }
  finally {
    isLoading.value = false
    await nextTick()
    window.api.resizeWindow()
  }
}

function clearText() {
  sourceText.value = ''
  translatedText.value = ''
  errorMessage.value = ''
  showResult.value = false
  inputHeight.value = '60px'
  nextTick(() => {
    window.api.resizeWindow()
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
  showResult.value = !showResult.value
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
})

watch(showResult, async () => {
  await nextTick()
  window.api.resizeWindow()
})

onMounted(() => {
  window.api.onShowApp?.(focusInput)
  window.api.onPasteAndTranslate?.(pasteAndTranslate)
  adjustInputHeight()
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
      <button class="swap-btn" @click="swapLanguages" aria-label="Swap languages">
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
        placeholder="Type something... (Enter to translate, Shift+Enter for new line)"
        @keydown="handleKeyDown"
        @input="handleInput"
      />
      <div class="input-info">
        <span class="char-count">{{ sourceText.length }} chars</span>
        <span class="hint">Enter to translate</span>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <section :class="['result-section', { visible: showResult, collapsed: !showResult && !isLoading }]">
      <header class="result-header" @click="toggleResult" v-if="showResult || translatedText">
        <span class="result-title">Translation</span>
        <span class="toggle-icon">{{ showResult ? '▼' : '▶' }}</span>
      </header>
      <div v-show="showResult" class="result-content">
        <div v-if="isLoading" class="loading">Translating...</div>
        <p v-else-if="translatedText" class="result-text">{{ translatedText }}</p>
        <div v-if="translatedText" class="result-actions">
          <button class="copy-btn" @click="copyResult" aria-label="Copy translation">
            Copy
          </button>
        </div>
      </div>
    </section>

    <footer class="actions">
      <button class="btn" @click="clearText" aria-label="Clear all">
        Clear
      </button>
    </footer>
  </div>
</template>