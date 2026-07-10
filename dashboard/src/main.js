import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router.js';
import './styles/app.css';
import { followSystemTheme } from './styles/theme.js';

followSystemTheme();

createApp(App).use(router).mount('#app');
