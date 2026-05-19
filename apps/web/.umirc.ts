import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: false,
  proxy: {
    '/api': {
      target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
      changeOrigin: true,
      timeout: 30000,
    },
  },
  routes: [
    {
      path: '/',
      redirect: '/cards',
    },
    {
      name: '登录',
      path: '/login',
      component: './login/index',
      layout: false,
    },
    {
      name: '注册',
      path: '/register',
      component: './register/index',
      layout: false,
    },
    {
      name: '卡片',
      path: '/cards',
      component: './cards/index',
    },
    {
      name: '合集',
      path: '/collections',
      component: './collections/index',
    },
    {
      name: '管理',
      path: '/admin',
      component: './admin/index',
      access: 'canAdmin',
    },
  ],
  npmClient: 'pnpm',
});
