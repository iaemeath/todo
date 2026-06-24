<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TodoForm from './components/TodoForm.vue'
import TodoList from './components/TodoList.vue'
import TodoStats from './components/TodoStats.vue'
import CalendarPlanner from './components/CalendarPlanner.vue'
import ScheduleManager from './components/ScheduleManager.vue'
import { 
  Sun, 
  Moon, 
  CheckSquare, 
  Home, 
  Inbox, 
  CalendarDays, 
  BarChart3 
} from 'lucide-vue-next'

// View Switcher logic: 'home' | 'backlog' | 'schedule' | 'dashboard'
const currentView = ref<'home' | 'backlog' | 'schedule' | 'dashboard'>('home')

// Theme toggle logic
const isDark = ref(true)

const initTheme = () => {
  const savedTheme = localStorage.getItem('antigravity-theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  updateThemeAttr()
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('antigravity-theme', isDark.value ? 'dark' : 'light')
  updateThemeAttr()
}

const updateThemeAttr = () => {
  if (isDark.value) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

onMounted(() => {
  initTheme()
})
</script>

<template>
  <div class="app-wrapper">
    <!-- Premium Header -->
    <header class="app-header glass-panel">
      <div class="header-logo">
        <div class="logo-circle">
          <CheckSquare class="logo-icon" />
        </div>
        <div class="logo-text">
          <h1>ANTIGRAVITY <span class="logo-gradient">TODO</span></h1>
          <p class="logo-sub">轻量 · 高效 · 未来感日程待办面板</p>
        </div>
      </div>

      <!-- View & Theme Action Control -->
      <div class="header-actions">
        <!-- Four-tab View switcher buttons -->
        <div class="view-switcher-group glass-card">
          <button 
            @click="currentView = 'home'" 
            class="view-tab-btn" 
            :class="{ 'active': currentView === 'home' }"
          >
            <Home class="tab-btn-icon" />
            <span>日程</span>
          </button>
          <button 
            @click="currentView = 'backlog'" 
            class="view-tab-btn" 
            :class="{ 'active': currentView === 'backlog' }"
          >
            <Inbox class="tab-btn-icon" />
            <span>待办</span>
          </button>
          <button 
            @click="currentView = 'schedule'" 
            class="view-tab-btn" 
            :class="{ 'active': currentView === 'schedule' }"
          >
            <CalendarDays class="tab-btn-icon" />
            <span>任务</span>
          </button>
          <button 
            @click="currentView = 'dashboard'" 
            class="view-tab-btn" 
            :class="{ 'active': currentView === 'dashboard' }"
          >
            <BarChart3 class="tab-btn-icon" />
            <span>看板</span>
          </button>
        </div>

        <!-- Light/Dark theme switcher -->
        <button 
          @click="toggleTheme" 
          class="theme-toggle-btn glass-card pulse-hover"
          :title="isDark ? '切换亮色模式' : '切换暗色模式'"
        >
          <Sun v-if="isDark" class="theme-icon sun" />
          <Moon v-else class="theme-icon moon" />
        </button>
      </div>
    </header>

    <!-- Main Workspace Area -->
    <main 
      class="app-main" 
      :class="[
        `view-layout-${currentView}`
      ]"
    >
      <!-- 1. Home View: Calendar Planner Grid (includes backlog aside) -->
      <template v-if="currentView === 'home'">
        <div class="full-width-workspace">
          <CalendarPlanner />
        </div>
      </template>

      <!-- 2. Backlog View: Todo List (full-width) -->
      <template v-else-if="currentView === 'backlog'">
        <div class="full-width-workspace">
          <TodoList />
        </div>
      </template>

      <!-- 3. Schedule View: Date Grouped Agenda list -->
      <template v-else-if="currentView === 'schedule'">
        <div class="full-width-workspace">
          <ScheduleManager />
        </div>
      </template>

      <!-- 4. Dashboard View: Stats analytics dashboard -->
      <template v-else-if="currentView === 'dashboard'">
        <div class="full-width-workspace">
          <TodoStats />
        </div>
      </template>
    </main>

    <!-- Global Floating Action Button & Form -->
    <TodoForm :current-view="currentView" />


  </div>
</template>

<style>
/* Reset scroll behaviors, sizing and grid structures */
.app-wrapper {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100vh;
}

/* Header style with premium blur and alignment */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 28px;
  border-radius: 24px !important;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-circle {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
}

.logo-icon {
  width: 22px;
  height: 22px;
  color: #ffffff;
}

.logo-text h1 {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  line-height: 1.2;
}

.logo-gradient {
  background: linear-gradient(to right, var(--color-primary-light), var(--color-info));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-sub {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-top: 1px;
}

/* Theme switch btn with glass card glow */
.theme-toggle-btn {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border-glass-subtle);
  background: var(--bg-glass-solid);
}

.theme-toggle-btn:hover {
  transform: translateY(-2px);
}

.theme-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.5s ease;
}

.sun {
  color: var(--color-warning);
}

.moon {
  color: var(--color-primary);
}

/* Main Grid Layout */
.app-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

.app-main.split-layout {
  grid-template-columns: 340px 1fr;
}

.full-width-workspace {
  width: 100%;
}

.sidebar-section {
  position: sticky;
  top: 24px;
}

.main-content-section {
  min-width: 0; /* Prevents flex/grid overflows */
}

/* View switcher styles inside header */
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-switcher-group {
  display: flex;
  background: var(--input-bg);
  padding: 4px;
  border-radius: 14px;
  border: 1px solid var(--border-glass-subtle);
  box-shadow: none;
}

.view-tab-btn {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: transparent;
  display: flex;
  align-items: center;
  gap: 6px;
}

.view-tab-btn:hover {
  color: var(--text-primary);
}

.view-tab-btn.active {
  background: var(--bg-glass-solid);
  color: var(--color-primary);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.tab-btn-icon {
  width: 16px;
  height: 16px;
}

/* Footer layout */
.app-footer {
  margin-top: auto;
  padding: 24px 0 12px;
  text-align: center;
}

.footer-inner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.footer-icon {
  width: 14px;
  height: 14px;
  color: var(--color-primary-light);
}

/* Responsive Breakpoints */
@media (max-width: 968px) {
  .app-main.split-layout {
    grid-template-columns: 1fr;
  }
  
  .sidebar-section {
    position: static;
  }
  
  .header-actions {
    flex-wrap: wrap-reverse;
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .view-switcher-group {
    padding: 2px;
  }
  
  .view-tab-btn {
    padding: 6px 10px;
    font-size: 0.75rem;
    gap: 4px;
  }
  
  .view-tab-btn span {
    display: none; /* Hide text on extra small mobile to save space */
  }
}

@media (max-width: 576px) {
  .app-header {
    padding: 14px 20px;
    border-radius: 18px !important;
  }
  
  .logo-text h1 {
    font-size: 1.1rem;
  }
  
  .logo-circle {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }
  
  .logo-icon {
    width: 18px;
    height: 18px;
  }
}
</style>
