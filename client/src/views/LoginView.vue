<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  const name = username.value.trim()
  const pwd = password.value.trim()

  if (!name || !pwd) {
    errorMsg.value = '请输入代号和密钥'
    return
  }

  if (pwd.length < 4) {
    errorMsg.value = '密钥长度不能少于 4 位'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    const data = await login(name, pwd)
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', data.user.username)
    router.replace('/')
  } catch (err: any) {
    errorMsg.value = err.message || '接入网络失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <!-- 背景粒子效果层 -->
    <div class="login-bg" />

    <!-- 登录卡片 -->
    <div class="login-card">
      <!-- 顶部标识 -->
      <div class="login-brand">
        <div class="brand-icon">🌾</div>
        <div class="brand-title">赛博农场</div>
        <div class="brand-subtitle">Cyber Farm Terminal v5.0</div>
      </div>

      <!-- 系统提示 -->
      <div class="system-prompt">
        <span class="prompt-dot">●</span>
        系统连接中... 验证您的资本凭证
      </div>

      <!-- 表单 -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="input-group">
          <label class="input-label">入局代号</label>
          <input
            v-model="username"
            type="text"
            class="login-input"
            placeholder="Username"
            maxlength="32"
            autocomplete="username"
            :disabled="loading"
          />
        </div>

        <div class="input-group">
          <label class="input-label">密钥</label>
          <input
            v-model="password"
            type="password"
            class="login-input"
            placeholder="Password"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="error-msg">
          ⚠ {{ errorMsg }}
        </div>

        <!-- 提交按钮 -->
        <button
          type="submit"
          class="login-btn"
          :disabled="loading"
        >
          <span v-if="loading" class="btn-loading">
            <span class="spinner" />
            接入中...
          </span>
          <span v-else>接入网络 (Enter)</span>
        </button>
      </form>

      <!-- 底部提示 -->
      <div class="login-footer">
        <span class="footer-line">━━━</span>
        <span class="footer-text">新玩家自动注册</span>
        <span class="footer-line">━━━</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  font-family: 'Courier New', monospace;
  overflow: hidden;
}

/* 背景粒子效果 */
.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(34, 197, 94, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
  pointer-events: none;
}

/* 登录卡片 */
.login-card {
  position: relative;
  width: 380px;
  padding: 40px 32px;
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}

/* 品牌标识 */
.login-brand {
  text-align: center;
  margin-bottom: 28px;
}

.brand-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.3));
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 4px;
}

.brand-subtitle {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
  letter-spacing: 2px;
}

/* 系统提示 */
.system-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 24px;
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.15);
  border-radius: 6px;
  font-size: 12px;
  color: #4ade80;
  letter-spacing: 1px;
}

.prompt-dot {
  animation: blink 1.2s step-end infinite;
  font-size: 10px;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* 表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.login-input {
  width: 100%;
  padding: 12px 14px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  font-size: 14px;
  color: #e2e8f0;
  font-family: 'Courier New', monospace;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.login-input:focus {
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.login-input::placeholder {
  color: #475569;
}

.login-input:disabled {
  opacity: 0.5;
}

/* 错误提示 */
.error-msg {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: #f87171;
}

/* 提交按钮 */
.login-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部提示 */
.login-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.footer-line {
  color: #334155;
  font-size: 10px;
}

.footer-text {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 1px;
}
</style>
