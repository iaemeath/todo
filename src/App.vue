<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import VoiceAssistant from './components/VoiceAssistant.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useTheme } from './composables/useTheme'

const isSettingsOpen = ref(false)
const { loadTheme } = useTheme()

onMounted(() => {
  loadTheme()
})
</script>

<template>
  <div class="app-layout">
    <main class="main-workspace">
      <CalendarArea />
      <TodoSidebar @open-settings="isSettingsOpen = true" />
    </main>

    <VoiceAssistant />
    <SettingsModal 
      :isOpen="isSettingsOpen" 
      @close="isSettingsOpen = false" 
    />
  </div>
</template>

<style>
@import './styles/theme.css';
@import './style.css';

html, body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-app);
  background-image: var(--bg-gradient);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: var(--font-family);
  height: 100vh;
  overflow: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px;
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
}

.main-workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: 100%;
  gap: 16px;
}
</style>
