// Routes: the lobby and the meeting room.
import { createRouter, createWebHistory } from 'vue-router'
import PageLobby from './Components/Lobby/PageLobby.vue'

/** Application router. */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'lobby', component: PageLobby },
    {
      path: '/addon/meet/sidepanel',
      name: 'meetSidePanel',
      component: () => import('./Components/MeetAddon/PageMeetSidePanel.vue'),
    },
    {
      path: '/addon/meet/stage',
      name: 'meetStage',
      component: () => import('./Components/MeetAddon/PageMeetStage.vue'),
    },
    {
      path: '/room/:roomId',
      name: 'room',
      component: () => import('./Components/Room/PageRoom.vue'),
      props: true,
    },
  ],
})
