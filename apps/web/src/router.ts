import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, from, saved) => saved ?? (to.path !== from.path ? { top: 0 } : undefined),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/new', component: () => import('./views/GetStartedView.vue') },
    { path: '/settings/keys', component: () => import('./views/KeysView.vue') },
    { path: '/settings/tokens', component: () => import('./views/TokensView.vue') },
    { path: '/device', component: () => import('./views/DeviceView.vue') },
    {
      path: '/:owner/:name',
      component: () => import('./views/RepoLayout.vue'),
      props: true,
      children: [
        { path: '', name: 'code', component: () => import('./views/repo/CodeTab.vue') },
        { path: 'blob/:path(.*)', name: 'file', component: () => import('./views/repo/CodeTab.vue') },
        { path: 'main', name: 'main', component: () => import('./views/repo/MainTab.vue') },
        { path: 'main/:version', name: 'landing', component: () => import('./views/repo/LandingPage.vue') },
        { path: 'swarms', name: 'swarms', component: () => import('./views/repo/SwarmsTab.vue') },
        { path: 'swarms/:id', name: 'swarm', component: () => import('./views/repo/SwarmPage.vue') },
        { path: 'agents', name: 'agents', component: () => import('./views/repo/AgentsTab.vue') },
        { path: 'agents/:id', name: 'agent', component: () => import('./views/repo/AgentPage.vue') },
        { path: 'tasks', name: 'tasks', component: () => import('./views/repo/TasksTab.vue') },
        { path: 'approvals', name: 'approvals', component: () => import('./views/repo/ApprovalsTab.vue') },
        { path: 'dispatch', name: 'dispatch', component: () => import('./views/repo/DispatchPage.vue') },
        { path: 'settings', name: 'repo-settings', component: () => import('./views/repo/SettingsTab.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue') },
  ],
});
