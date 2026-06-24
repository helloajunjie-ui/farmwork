import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '🔐 接入网络', guest: true },
  },
  {
    path: '/',
    name: 'farm',
    component: () => import('../views/FarmView.vue'),
    meta: { title: '🏠 我的农场' },
  },
  {
    path: '/market',
    name: 'market',
    component: () => import('../views/MarketView.vue'),
    meta: { title: '🏪 市场' },
  },
  {
    path: '/user',
    name: 'user',
    component: () => import('../views/UserView.vue'),
    meta: { title: '👤 我的' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: '404 迷路了' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ===== 导航守卫：未登录强制跳转 /login =====
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.guest) {
    // 登录页：已登录则跳转农场
    if (token) {
      next('/')
    } else {
      next()
    }
    return
  }

  // 其他页面：未登录则跳转登录页
  if (!token) {
    next('/login')
    return
  }

  next()
})

export default router
