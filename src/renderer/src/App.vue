<script setup lang="ts">
import { ref } from 'vue'

const sourceText = ref('')
const translatedText = ref('')
const sourceLang = ref('auto')
const targetLang = ref('en')
const isLoading = ref(false)
const errorMessage = ref('')

const languageOptions = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'jp', label: '日语' },
  { value: 'kor', label: '韩语' },
  { value: 'fra', label: '法语' },
  { value: 'spa', label: '西班牙语' },
  { value: 'de', label: '德语' },
  { value: 'it', label: '意大利语' },
  { value: 'ru', label: '俄语' },
  { value: 'pt', label: '葡萄牙语' }
]

const translateText = async () => {
  if (!sourceText.value.trim()) {
    errorMessage.value = '请输入要翻译的文本'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  translatedText.value = ''

  try {
    const response = await window.api.translate(sourceText.value, sourceLang.value, targetLang.value)
    if (response.error) {
      errorMessage.value = response.error
    } else {
      translatedText.value = response.result
    }
  } catch (error: any) {
    errorMessage.value = `翻译失败: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

const clearText = () => {
  sourceText.value = ''
  translatedText.value = ''
  errorMessage.value = ''
}

const copyResult = async () => {
  if (translatedText.value) {
    try {
      await navigator.clipboard.writeText(translatedText.value)
      alert('已复制到剪贴板')
    } catch (error) {
      alert('复制失败')
    }
  }
}

const swapLanguages = () => {
  const temp = sourceLang.value
  sourceLang.value = targetLang.value
  targetLang.value = temp
}
</script>

<template>
  <div class="translator-container">
    <div class="header">
      <h1>百度翻译</h1>
    </div>

    <div class="language-selector">
      <select v-model="sourceLang" class="lang-select">
        <option v-for="lang in languageOptions" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </select>
      <button class="swap-btn" @click="swapLanguages">
        ↔
      </button>
      <select v-model="targetLang" class="lang-select">
        <option v-for="lang in languageOptions.filter(l => l.value !== 'auto')" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </select>
    </div>

    <div class="text-areas">
      <div class="text-area-container">
        <textarea
          v-model="sourceText"
          class="text-input"
          placeholder="请输入要翻译的文本..."
          @input="errorMessage = ''"
        ></textarea>
        <div class="text-info">{{ sourceText.length }} 字符</div>
      </div>

      <div class="text-area-container">
        <textarea
          v-model="translatedText"
          class="text-output"
          placeholder="翻译结果将显示在这里..."
          readonly
        ></textarea>
        <div class="text-info">
          <button v-if="translatedText" class="copy-btn" @click="copyResult">复制</button>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="clearText">清空</button>
      <button class="btn btn-primary" @click="translateText" :disabled="isLoading">
        {{ isLoading ? '翻译中...' : '翻译' }}
      </button>
    </div>
  </div>
</template>