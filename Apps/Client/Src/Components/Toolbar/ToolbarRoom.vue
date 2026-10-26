<!-- Top bar of a room: identity, sync state, agent, layout, audio, presence and panels. -->
<template>
  <header class="toolbar">
    <div class="toolbar__group">
      <RouterLink to="/" class="toolbar__brand">EkklesiazousAI</RouterLink>
      <span class="toolbar__title">{{ meta.title }}</span>
      <button type="button" class="toolbar__code" :title="t('toolbar.copyLink')" @click="copyLink">
        {{ roomId }} {{ isCopied ? '✓' : '⧉' }}
      </button>
      <span
        class="toolbar__sync"
        :class="`toolbar__sync--${status}`"
        :title="t(`sync.${status}`)"
      />
    </div>

    <div class="toolbar__group">
      <ControlAgent />
      <MenuLayout />
    </div>

    <div class="toolbar__group">
      <span v-if="isRecording" class="toolbar__recording" :title="t('toolbar.recordingTitle')"
        >● {{ t('toolbar.recording') }}</span
      >
      <div class="toolbar__popover-anchor">
        <button type="button" class="button button--small" @click="isAudioOpen = !isAudioOpen">
          🎙 {{ t('toolbar.audio') }}
        </button>
        <div v-show="isAudioOpen" class="toolbar__popover">
          <PanelAudio :capture="capture" />
        </div>
      </div>
      <ListPresence />
      <button type="button" class="button button--small" @click="$emit('togglePrivate')">
        🔒 {{ t('toolbar.private')
        }}<span v-if="privateCount > 0" class="toolbar__badge">{{ privateCount }}</span>
      </button>
      <button type="button" class="button button--small" @click="$emit('toggleSide')">📝</button>
      <button
        type="button"
        class="button button--small"
        :title="t('settings.title')"
        @click="$emit('openSettings')"
      >
        ⚙
      </button>
    </div>
  </header>
</template>

<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AudioCapture } from '../../Services/AudioCapture'
import { useRoomSession } from '../../Services/RoomSession'
import PanelAudio from '../Audio/PanelAudio.vue'
import ControlAgent from './ControlAgent.vue'
import ListPresence from './ListPresence.vue'
import MenuLayout from './MenuLayout.vue'

export default defineComponent({
  name: 'ToolbarRoom',
  components: { ControlAgent, ListPresence, MenuLayout, PanelAudio },
  props: {
    /** Audio capture session of the page. */
    capture: { type: Object as PropType<AudioCapture>, required: true },
  },
  emits: {
    /** Toggle the private drawer. */
    togglePrivate: () => true,
    /** Toggle the side panel. */
    toggleSide: () => true,
    /** Open settings. */
    openSettings: () => true,
  },
  setup(props) {
    const { t } = useI18n()
    const session = useRoomSession()
    const isAudioOpen = ref(false)
    const isCopied = ref(false)
    const copyLink = async (): Promise<void> => {
      await navigator.clipboard?.writeText(window.location.href).catch(() => undefined)
      isCopied.value = true
      window.setTimeout(() => (isCopied.value = false), 1500)
    }
    return {
      t,
      roomId: session.roomId,
      meta: session.state.meta,
      status: session.connection.status,
      isAudioOpen,
      isCopied,
      copyLink,
      privateCount: computed(() => session.privateFeed.items.length),
      isRecording: computed(
        () => props.capture.status.value === 'live' || session.state.captions.value.length > 0,
      ),
    }
  },
})
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.toolbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.toolbar__brand {
  font-weight: 800;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.02em;
}

.toolbar__title {
  max-width: 260px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--color-text-muted);
}

.toolbar__code {
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface-muted);
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.toolbar__sync {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-warning);
}

.toolbar__sync--connected {
  background: var(--color-success);
}

.toolbar__sync--disconnected {
  background: var(--color-danger);
}

.toolbar__recording {
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff0f6;
  color: var(--color-danger);
  font-size: 11px;
  font-weight: 700;
}

.toolbar__popover-anchor {
  position: relative;
}

.toolbar__popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
  z-index: 50;
}

.toolbar__badge {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-accent);
  color: #fff;
  font-size: 10px;
}
</style>
