<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from './stores/user'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

const route = useRoute()
const userStore = useUserStore()

// 非登录页才加载用户数据
onMounted(async () => {
  if (route.name !== 'login') {
    await userStore.fetchUserInfo()
  }
})

// 路由切换时：从登录页进入农场时加载数据
watch(() => route.name, async (name) => {
  if (name && name !== 'login' && userStore.userId === 0) {
    await userStore.fetchUserInfo()
  }
})

// 登录页不显示 Header/Footer
const isLoginPage = () => route.name === 'login'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <template v-if="!isLoginPage()">
      <AppHeader />
      <main class="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <router-view />
      </main>
      <AppFooter />
    </template>
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
