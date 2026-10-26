// Routes: the lobby and the meeting room.
import { createRouter, createWebHistory } from 'vue-router'
import PageLobby from './Components/Lobby/PageLobby.vue'

/** Application router. */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'lobby', component: PageLobby },
    {
      path: '/room/:roomId',
      name: 'room',
      component: () => import('./Components/Room/PageRoom.vue'),
      props: true,
    },
  ],
})
