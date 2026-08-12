<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import VoiceAssistant from './components/VoiceAssistant.vue'
import SettingsModal from './components/SettingsModal.vue'
import { Calendar as CalendarIcon, List as ListIcon } from 'lucide-vue-next'
import { useTheme } from './composables/useTheme'
import { useMobile } from './composables/useMobile'
import { useUI } from './composables/useUI'

const { loadTheme } = useTheme()
const { isMobile } = useMobile()
const { sidebarOpen, settingsOpen, closeSettings } = useUI()

// Mobile-only: which tab is shown (calendar vs todo list)
const activeTab = ref<'calendar' | 'todos'>('calendar')

onMounted(() => {
  loadTheme()
})
</script>

<template>
  <div class="app-layout" :class="{ 'mobile-layout': isMobile }">
    <main class="main-workspace">
      <CalendarArea v-show="!isMobile || activeTab === 'calendar'" />
      <!-- Desktop: memo sidebar in push mode, driven by useUI.sidebarOpen -->
      <TodoSidebar
        v-if="!isMobile"
        v-show="sidebarOpen"
      />
    </main>

    <!-- Mobile Bottom Navigation -->
    <nav v-if="isMobile" class="mobile-bottom-nav glass-panel">
      <button class="nav-btn" :class="{ active: activeTab === 'calendar' }" @click="activeTab = 'calendar'">
        <CalendarIcon class="nav-icon" />
        <span>日历</span>
      </button>
      <button class="nav-btn" :class="{ active: activeTab === 'todos' }" @click="activeTab = 'todos'">
        <ListIcon class="nav-icon" />
        <span>待办</span>
      </button>
    </nav>

    <VoiceAssistant />
    <SettingsModal
      :isOpen="settingsOpen"
      @close="closeSettings"
    />
  </div>
</template>

<style>
@import './styles/theme.css';
@import './style.css';

html, body {
  margin: 0;
  padding: 0;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
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
