// Client entry point: mounts the app with router and i18n.
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './Router'
import { i18n } from './Locales/I18n'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './Styles/Theme.css'

createApp(App).use(router).use(i18n).mount('#app')
