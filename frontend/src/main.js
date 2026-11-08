import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './style.css'

const app = createApp(App).use(router)
// mount once the first page's component has loaded, so the first paint already
// has its content and a short page's footer does not move when it arrives
router.isReady().then(() => app.mount('#app'))
