<script setup lang="ts">
import { useTodos } from '../composables/useTodos'
import { CheckCircle2, ListTodo, AlertCircle, BarChart3 } from 'lucide-vue-next'

const { stats } = useTodos()

// Helper for circular progress SVG math
const radius = 36
const circumference = 2 * Math.PI * radius
</script>

<template>
  <div class="stats-panel glass-panel">
    <div class="panel-header">
      <BarChart3 class="header-icon" />
      <h2>数据分析</h2>
    </div>

    <!-- Circle Progress & Summary -->
    <div class="completion-hero">
      <div class="progress-circle-wrapper">
        <svg class="progress-circle" viewBox="0 0 80 80">
          <circle 
            class="circle-bg" 
            cx="40" 
            cy="40" 
            :r="radius" 
          />
          <circle 
            class="circle-fill" 
            cx="40" 
            cy="40" 
            :r="radius" 
            :stroke-dasharray="circumference"
            :stroke-dashoffset="circumference - (stats.completionRate / 100) * circumference"
          />
        </svg>
        <div class="percentage-label">
          <span class="pct-num">{{ stats.completionRate }}%</span>
          <span class="pct-text">完成率</span>
        </div>
      </div>

      <div class="summary-numbers">
        <div class="stat-row">
          <span class="stat-dot total"></span>
          <span class="stat-name">全部任务</span>
          <span class="stat-val">{{ stats.total }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-dot active"></span>
          <span class="stat-name">进行中</span>
          <span class="stat-val text-primary">{{ stats.active }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-dot completed"></span>
          <span class="stat-name">已完成</span>
          <span class="stat-val text-success">{{ stats.completed }}</span>
        </div>
      </div>
    </div>

    <!-- Stats Quick Cards -->
    <div class="stats-grid">
      <div class="mini-stat-card glass-card">
        <ListTodo class="card-icon active-icon" />
        <div class="card-info">
          <span class="card-label">待办</span>
          <span class="card-value">{{ stats.active }}</span>
        </div>
      </div>
      <div class="mini-stat-card glass-card">
        <CheckCircle2 class="card-icon success-icon" />
        <div class="card-info">
          <span class="card-label">已结</span>
          <span class="card-value">{{ stats.completed }}</span>
        </div>
      </div>
      <div class="mini-stat-card glass-card">
        <AlertCircle class="card-icon danger-icon" />
        <div class="card-info">
          <span class="card-label">高优先级</span>
          <span class="card-value">{{ stats.priorities.high }}</span>
        </div>
      </div>
    </div>

    <!-- Breakdown Lists -->
    <div class="breakdown-section">
      <h3>分类统计</h3>
      <div class="bar-chart-list">
        <div class="chart-item">
          <div class="chart-meta">
            <span class="category-indicator cat-work">工作</span>
            <span class="chart-count">{{ stats.categories.work }}</span>
          </div>
          <div class="bar-track">
            <div 
              class="bar-fill work-fill" 
              :style="{ width: stats.total > 0 ? (stats.categories.work / stats.total) * 100 + '%' : '0%' }"
            ></div>
          </div>
        </div>

        <div class="chart-item">
          <div class="chart-meta">
            <span class="category-indicator cat-personal">生活</span>
            <span class="chart-count">{{ stats.categories.personal }}</span>
          </div>
          <div class="bar-track">
            <div 
              class="bar-fill personal-fill" 
              :style="{ width: stats.total > 0 ? (stats.categories.personal / stats.total) * 100 + '%' : '0%' }"
            ></div>
          </div>
        </div>

        <div class="chart-item">
          <div class="chart-meta">
            <span class="category-indicator cat-fitness">健康</span>
            <span class="chart-count">{{ stats.categories.fitness }}</span>
          </div>
          <div class="bar-track">
            <div 
              class="bar-fill fitness-fill" 
              :style="{ width: stats.total > 0 ? (stats.categories.fitness / stats.total) * 100 + '%' : '0%' }"
            ></div>
          </div>
        </div>

        <div class="chart-item">
          <div class="chart-meta">
            <span class="category-indicator cat-ideas">想法</span>
            <span class="chart-count">{{ stats.categories.ideas }}</span>
          </div>
          <div class="bar-track">
            <div 
              class="bar-fill ideas-fill" 
              :style="{ width: stats.total > 0 ? (stats.categories.ideas / stats.total) * 100 + '%' : '0%' }"
            ></div>
          </div>
        </div>

        <div class="chart-item">
          <div class="chart-meta">
            <span class="category-indicator cat-shopping">购物</span>
            <span class="chart-count">{{ stats.categories.shopping }}</span>
          </div>
          <div class="bar-track">
            <div 
              class="bar-fill shopping-fill" 
              :style="{ width: stats.total > 0 ? (stats.categories.shopping / stats.total) * 100 + '%' : '0%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border-glass);
  padding-bottom: 14px;
}

.header-icon {
  color: var(--color-primary);
  width: 22px;
  height: 22px;
}

h2 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

/* Completion Hero Graphic */
.completion-hero {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--border-glass-subtle);
}

.progress-circle-wrapper {
  position: relative;
  width: 90px;
  height: 90px;
}

.progress-circle {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.circle-bg {
  fill: none;
  stroke: var(--border-glass);
  stroke-width: 7px;
}

.circle-fill {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 7px;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.percentage-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pct-num {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.pct-text {
  font-size: 0.6rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.summary-numbers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.stat-dot.total { background: var(--text-muted); }
.stat-dot.active { background: var(--color-primary); }
.stat-dot.completed { background: var(--color-success); }

.stat-name {
  color: var(--text-secondary);
  min-width: 60px;
}

.stat-val {
  font-weight: 700;
}

/* Stats Cards Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.mini-stat-card {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  border-radius: 12px;
  box-shadow: none;
  border-color: var(--border-glass-subtle);
}

.mini-stat-card:hover {
  transform: translateY(-2px);
}

.card-icon {
  width: 18px;
  height: 18px;
}

.active-icon { color: var(--color-primary); }
.success-icon { color: var(--color-success); }
.danger-icon { color: var(--color-danger); }

.card-info {
  display: flex;
  flex-direction: column;
}

.card-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.card-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 1px;
}

/* Categorized Bars */
.breakdown-section {
  display: flex;
  flex-direction: column;
}

.bar-chart-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-indicator {
  font-size: 0.75rem;
  font-weight: 600;
  position: relative;
  padding-left: 12px;
  color: var(--text-secondary);
}

.category-indicator::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.category-indicator.cat-work::before { background: #3b82f6; }
.category-indicator.cat-personal::before { background: #ec4899; }
.category-indicator.cat-fitness::before { background: #10b981; }
.category-indicator.cat-ideas::before { background: #8b5cf6; }
.category-indicator.cat-shopping::before { background: #f59e0b; }

.chart-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.bar-track {
  height: 6px;
  background: var(--border-glass);
  border-radius: 9999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.work-fill { background: #3b82f6; }
.personal-fill { background: #ec4899; }
.fitness-fill { background: #10b981; }
.ideas-fill { background: #8b5cf6; }
.shopping-fill { background: #f59e0b; }
</style>
