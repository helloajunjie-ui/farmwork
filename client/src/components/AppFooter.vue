<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <!-- ===== MVP 5.2: 移动端底部 TabBar (lg:隐藏) ===== -->
  <footer class="sticky bottom-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-700/50 lg:hidden">
    <nav class="max-w-3xl mx-auto px-4 py-1.5 flex justify-around">
      <router-link
        to="/"
        class="flex flex-col items-center gap-0.5 px-6 py-2 rounded-lg transition-all duration-200"
        :class="route.name === 'farm' ? 'text-green-400 bg-green-400/10' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-lg">🏠</span>
        <span class="text-[10px] font-medium">农场</span>
      </router-link>
      <router-link
        to="/market"
        class="flex flex-col items-center gap-0.5 px-6 py-2 rounded-lg transition-all duration-200"
        :class="route.name === 'market' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-lg">📈</span>
        <span class="text-[10px] font-medium">市场</span>
      </router-link>
      <router-link
        to="/user"
        class="flex flex-col items-center gap-0.5 px-6 py-2 rounded-lg transition-all duration-200"
        :class="route.name === 'user' ? 'text-purple-400 bg-purple-400/10' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-lg">👤</span>
        <span class="text-[10px] font-medium">我的</span>
      </router-link>
    </nav>
  </footer>
</template>
