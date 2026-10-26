<!-- Google Meet side panel (personal): pick or create the room, put the shared canvas on everyone's
     main stage, and keep private help and commands at hand. -->
<template>
  <main class="side-panel">
    <header class="side-panel__header">
      <strong>EkklesiazousAI</strong>
      <SwitcherLocale />
    </header>
    <p v-if="errorMessage" class="side-panel__error" role="alert">{{ errorMessage }}</p>

    <section v-if="!roomId" class="side-panel__setup">
      <p>{{ t('meetAddon.intro') }}</p>
      <button type="button" class="button button--primary" :disabled="isBusy" @click="createRoom">
        {{ t('meetAddon.create') }}
      </button>
      <form class="side-panel__join" @submit.prevent="joinRoom">
        <input v-model="roomCode" class="input" :placeholder="t('lobby.joinPlaceholder')" />
        <button type="submit" class="button">{{ t('lobby.join') }}</button>
      </form>
    </section>

    <template v-else>
      <button
        type="button"
        class="button button--primary"
        :disabled="!sidePanelClient"
        @click="showToEveryone"
      >
        🖥 {{ t('meetAddon.showToEveryone') }}
      </button>
      <ScopeRoomSession :room-id="roomId">
        <div class="side-panel__room">
          <BarCommand class="side-panel__command" />
          <DrawerPrivate class="side-panel__private" @close="() => undefined" />
          <PanelTranscript class="side-panel__transcript" />
        </div>
      </ScopeRoomSession>
    </template>
  </main>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MeetSidePanelClient } from '@googleworkspace/meet-addons/meet.addons'
import { api } from '../../Services/ApiClient'
import { createMeetSession } from '../../Services/MeetAddon'
import BarCommand from '../Command/BarCommand.vue'
import SwitcherLocale from '../Common/SwitcherLocale.vue'
import DrawerPrivate from '../Private/DrawerPrivate.vue'
import ScopeRoomSession from '../Room/ScopeRoomSession.vue'
import PanelTranscript from '../Transcript/PanelTranscript.vue'

export default defineComponent({
  name: 'PageMeetSidePanel',
  components: { BarCommand, DrawerPrivate, PanelTranscript, ScopeRoomSession, SwitcherLocale },
  setup() {
    const { t } = useI18n()
    const sidePanelClient = shallowRef<MeetSidePanelClient | null>(null)
    const roomId = ref('')
    const roomCode = ref('')
    const meetingCode = ref('')
    const isBusy = ref(false)
    const errorMessage = ref('')

    onMounted(async () => {
      try {
        const session = await createMeetSession()
        sidePanelClient.value = await session.createSidePanelClient()
        meetingCode.value = (await sidePanelClient.value.getMeetingInfo()).meetingCode ?? ''
      } catch {
        errorMessage.value = t('meetAddon.outsideMeet')
      }
    })

    const createRoom = async (): Promise<void> => {
      isBusy.value = true
      try {
        const created = await api.createRoom({
          title: meetingCode.value ? `Google Meet ${meetingCode.value}` : 'Google Meet',
          meetingPlatform: 'googleMeet',
          captureMode: 'onlineHostCapture',
        })
        roomId.value = created.roomId
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
      } finally {
        isBusy.value = false
      }
    }
    const joinRoom = (): void => {
      const code = roomCode.value
        .trim()
        .toLowerCase()
        .replace(/.*\/room\//, '')
      if (code) roomId.value = code
    }
    const showToEveryone = async (): Promise<void> => {
      try {
        await sidePanelClient.value?.startActivity({
          mainStageUrl: `${window.location.origin}/addon/meet/stage`,
          additionalData: JSON.stringify({ roomId: roomId.value }),
        })
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
      }
    }

    return {
      t,
      sidePanelClient,
      roomId,
      roomCode,
      isBusy,
      errorMessage,
      createRoom,
      joinRoom,
      showToEveryone,
    }
  },
})
</script>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100vh;
  padding: 10px;
  overflow: hidden;
}

.side-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.side-panel__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 12px;
}

.side-panel__setup,
.side-panel__join {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.side-panel__room {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.side-panel__command {
  width: 100%;
}

.side-panel__private,
.side-panel__transcript {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
</style>
