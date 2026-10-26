<!-- Lobby page: create, join or demo a meeting room. -->
<template>
  <main class="lobby">
    <header class="lobby__header">
      <div>
        <h1 class="lobby__name">EkklesiazousAI</h1>
        <p class="lobby__tagline">{{ t('lobby.tagline') }}</p>
      </div>
      <SwitcherLocale />
    </header>

    <p v-if="capabilities?.isMockMode" class="lobby__banner">{{ t('lobby.mockBanner') }}</p>
    <p v-if="errorMessage" class="lobby__error" role="alert">{{ errorMessage }}</p>

    <div class="lobby__grid">
      <section class="lobby__card">
        <h2>{{ t('lobby.createHeading') }}</h2>
        <FormRoomCreate
          :is-zoom-rtms-enabled="capabilities?.isZoomRtmsEnabled ?? false"
          :is-meeting-bot-enabled="capabilities?.isMeetingBotEnabled ?? false"
          :is-busy="isBusy"
          @create="createRoom"
        />
      </section>

      <section class="lobby__card">
        <h2>{{ t('lobby.demoHeading') }}</h2>
        <p class="lobby__text">{{ t('lobby.demoText') }}</p>
        <button class="button button--primary" type="button" :disabled="isBusy" @click="startDemo">
          {{ t('lobby.demoStart') }}
        </button>

        <h2 class="lobby__subheading">{{ t('lobby.joinHeading') }}</h2>
        <form class="lobby__join" @submit.prevent="joinRoom">
          <input
            v-model="roomCode"
            class="input"
            :placeholder="t('lobby.joinPlaceholder')"
            required
          />
          <button class="button" type="submit">{{ t('lobby.join') }}</button>
        </form>

        <template v-if="recentRooms.length > 0">
          <h2 class="lobby__subheading">{{ t('lobby.recent') }}</h2>
          <ul class="lobby__recent">
            <li v-for="room in recentRooms" :key="room.roomId">
              <RouterLink :to="`/room/${room.roomId}`">{{ room.title }}</RouterLink>
              <code>{{ room.roomId }}</code>
            </li>
          </ul>
        </template>
      </section>
    </div>

    <footer v-if="capabilities" class="lobby__footer">
      {{ t('lobby.providers') }}: {{ capabilities.recognizer }} · {{ capabilities.modelFast }} ·
      {{ capabilities.modelDeep }} · {{ capabilities.searchProviders.join(', ') }}
    </footer>
  </main>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { CaptureMode, MeetingPlatform, ServerCapabilities } from '@ekklesiazous/shared'
import { api } from '../../Services/ApiClient'
import { listRecentRooms } from '../../Services/RecentRooms'
import SwitcherLocale from '../Common/SwitcherLocale.vue'
import FormRoomCreate from './FormRoomCreate.vue'

export default defineComponent({
  name: 'PageLobby',
  components: { SwitcherLocale, FormRoomCreate },
  setup() {
    const { t } = useI18n()
    const router = useRouter()
    const capabilities = shallowRef<ServerCapabilities | null>(null)
    const isBusy = ref(false)
    const errorMessage = ref('')
    const roomCode = ref('')
    const recentRooms = listRecentRooms()

    onMounted(async () => {
      try {
        capabilities.value = await api.getCapabilities()
      } catch {
        errorMessage.value = t('lobby.serverUnreachable')
      }
    })

    const run = async (task: () => Promise<void>): Promise<void> => {
      isBusy.value = true
      errorMessage.value = ''
      try {
        await task()
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
      } finally {
        isBusy.value = false
      }
    }

    const createRoom = (value: {
      title: string
      meetingPlatform: MeetingPlatform
      captureMode: CaptureMode
    }): Promise<void> =>
      run(async () => {
        const { roomId } = await api.createRoom(value)
        await router.push(`/room/${roomId}`)
      })

    const startDemo = (): Promise<void> =>
      run(async () => {
        const { roomId } = await api.createRoom({
          title: t('lobby.demoTitle'),
          meetingPlatform: 'inPerson',
          captureMode: 'demo',
        })
        await api.controlAgent(roomId, { action: 'startDemo' })
        await router.push(`/room/${roomId}`)
      })

    const joinRoom = (): void => {
      const code = roomCode.value
        .trim()
        .toLowerCase()
        .replace(/.*\/room\//, '')
      if (code) void router.push(`/room/${code}`)
    }

    return {
      t,
      capabilities,
      isBusy,
      errorMessage,
      roomCode,
      recentRooms,
      createRoom,
      startDemo,
      joinRoom,
    }
  },
})
</script>

<style scoped>
.lobby {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px;
}

.lobby__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.lobby__name {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.02em;
}

.lobby__tagline {
  margin: 4px 0 24px;
  color: var(--color-text-muted);
  max-width: 640px;
}

.lobby__banner,
.lobby__error {
  padding: 10px 14px;
  border-radius: var(--radius);
  margin: 0 0 16px;
}

.lobby__banner {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.lobby__error {
  background: #fff0f6;
  color: var(--color-danger);
}

.lobby__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.lobby__card {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.lobby__card h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.lobby__subheading {
  margin-top: 24px !important;
}

.lobby__text {
  margin: 0 0 12px;
  color: var(--color-text-muted);
}

.lobby__join {
  display: flex;
  gap: 8px;
}

.lobby__join .input {
  flex: 1;
}

.lobby__recent {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lobby__recent li {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.lobby__recent code {
  color: var(--color-text-muted);
}

.lobby__footer {
  margin-top: 32px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
