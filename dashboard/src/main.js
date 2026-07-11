import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router.js';
import './styles/app.css';
import { initTheme } from './styles/theme.js';

initTheme();

createApp(App).use(router).mount('#app');
