<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMailboxStore } from '../stores/mailbox'
import MailboxModal from './MailboxModal.vue'

const route = useRoute()
const mailboxStore = useMailboxStore()
const showMailbox = ref(false)

onMounted(() => {
  mailboxStore.startPolling()
})

onUnmounted(() => {
  mailboxStore.stopPolling()
})
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
      <!-- MVP 8.0: 信箱入口（红色呼吸光晕） -->
      <button
        class="flex flex-col items-center gap-0.5 px-6 py-2 rounded-lg transition-all duration-200 relative"
        :class="showMailbox ? 'text-rose-400 bg-rose-400/10' : 'text-slate-400 hover:text-slate-200'"
        @click="showMailbox = true"
      >
        <span class="text-lg relative">
          📮
          <!-- 未读红点 -->
          <span
            v-if="mailboxStore.unreadCount > 0"
            class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-breathe"
          />
        </span>
        <span class="text-[10px] font-medium">信箱</span>
      </button>
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

  <!-- MVP 8.0: 信箱模态框 -->
  <MailboxModal
    v-if="showMailbox"
    :show="showMailbox"
    @close="showMailbox = false"
  />
</template>
