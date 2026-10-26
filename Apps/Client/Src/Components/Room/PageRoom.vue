<!-- Room page: canvas with toolbar, private drawer, side panel, command bar and overlays. -->
<template>
  <div class="room">
    <ToolbarRoom
      :capture="capture"
      @toggle-private="isPrivateOpen = !isPrivateOpen"
      @toggle-side="isSideOpen = !isSideOpen"
      @open-settings="isSettingsOpen = true"
    />
    <p v-if="isMissing" class="room__missing">{{ t('room.missing') }}</p>
    <div
      v-else
      class="room__body"
      :class="{ 'room__body--private': isPrivateOpen, 'room__body--side': isSideOpen }"
    >
      <DrawerPrivate v-if="isPrivateOpen" class="room__drawer" @close="isPrivateOpen = false" />
      <main class="room__stage">
        <CanvasBoard />
        <OverlayPeriphery v-if="ux.layout === 'periphery'" />
        <OverlaySpotlight />
        <StackToast />
        <div class="room__command">
          <BarCommand />
        </div>
      </main>
      <PanelSide v-if="isSideOpen" class="room__side" />
    </div>
    <DialogSettings v-if="isSettingsOpen" @close="isSettingsOpen = false" />
    <DialogName v-if="isNameOpen" @done="isNameOpen = false" />
  </div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../../Services/ApiClient'
import { AudioCapture } from '../../Services/AudioCapture'
import { identity } from '../../Services/ParticipantIdentity'
import { rememberRoom } from '../../Services/RecentRooms'
import { provideRoomSession } from '../../Services/RoomSession'
import { useClarification } from '../../Composables/UseClarification'
import BarCommand from '../Command/BarCommand.vue'
import CanvasBoard from '../Canvas/CanvasBoard.vue'
import OverlayPeriphery from '../Overlay/OverlayPeriphery.vue'
import OverlaySpotlight from '../Overlay/OverlaySpotlight.vue'
import StackToast from '../Overlay/StackToast.vue'
import DrawerPrivate from '../Private/DrawerPrivate.vue'
import DialogSettings from '../Settings/DialogSettings.vue'
import ToolbarRoom from '../Toolbar/ToolbarRoom.vue'
import PanelSide from '../Transcript/PanelSide.vue'
import DialogName from './DialogName.vue'

export default defineComponent({
  name: 'PageRoom',
  components: {
    BarCommand,
    CanvasBoard,
    DialogName,
    DialogSettings,
    DrawerPrivate,
    OverlayPeriphery,
    OverlaySpotlight,
    PanelSide,
    StackToast,
    ToolbarRoom,
  },
  props: {
    /** Room id from the route. */
    roomId: { type: String, required: true },
  },
  setup(props) {
    const { t } = useI18n()
    const session = provideRoomSession(props.roomId)
    const { askAboutRecent } = useClarification(session)
    const capture = new AudioCapture()
    const isPrivateOpen = ref(false)
    const isSideOpen = ref(true)
    const isSettingsOpen = ref(false)
    const isNameOpen = ref(!identity.name)
    const isMissing = ref(false)

    // the drawer opens whenever a private request starts
    watch(
      () => session.privateFeed.attention.count,
      () => (isPrivateOpen.value = true),
    )
    watch(
      () => session.state.meta.value.title,
      (title) => {
        if (session.connection.isSynced.value) rememberRoom(props.roomId, title)
      },
    )

    // "?" anywhere outside text fields asks privately about the last few seconds
    const handleKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      if (event.key === '?') {
        event.preventDefault()
        askAboutRecent()
      }
    }

    onMounted(async () => {
      window.addEventListener('keydown', handleKey)
      try {
        await api.getRoom(props.roomId)
      } catch {
        isMissing.value = true
      }
      session.capabilities.value = await api.getCapabilities().catch(() => null)
      session.log('sessionStarted')
    })
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKey)
      capture.stop()
      session.dispose()
    })

    return {
      t,
      ux: session.ux,
      capture,
      isPrivateOpen,
      isSideOpen,
      isSettingsOpen,
      isNameOpen,
      isMissing,
    }
  },
})
</script>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.room__missing {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
}

.room__body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  min-height: 0;
}

.room__body--private {
  grid-template-columns: 340px 1fr;
}

.room__body--side {
  grid-template-columns: 1fr 360px;
}

.room__body--private.room__body--side {
  grid-template-columns: 340px 1fr 360px;
}

.room__stage {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.room__command {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 12;
}

.room__command > * {
  pointer-events: auto;
}

.room__drawer,
.room__side {
  min-height: 0;
}
</style>
