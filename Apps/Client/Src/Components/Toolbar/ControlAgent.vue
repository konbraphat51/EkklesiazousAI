<!-- Agent status with start/pause, plus the scripted demo controls. -->
<template>
  <div class="agent">
    <span class="agent__status" :class="`agent__status--${agentState}`">
      <span class="agent__dot" /> {{ t(`agentState.${agentState}`) }}
    </span>
    <button
      v-if="agentState !== 'listening'"
      type="button"
      class="button button--small"
      @click="control('start')"
    >
      ▶ {{ t('agent.start') }}
    </button>
    <button v-else type="button" class="button button--small" @click="control('pause')">
      ⏸ {{ t('agent.pause') }}
    </button>
    <button
      v-if="isDemoAvailable"
      type="button"
      class="button button--small"
      @click="control('startDemo')"
    >
      🎬 {{ t('agent.demo') }}
    </button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AgentControlRequest } from '@ekklesiazous/shared'
import { api } from '../../Services/ApiClient'
import { useRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'ControlAgent',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const control = (action: AgentControlRequest['action']): void => {
      void api.controlAgent(session.roomId, { action }).catch(() => undefined)
    }
    return {
      t,
      control,
      agentState: computed(() => session.state.meta.value.agentState),
      isDemoAvailable: computed(
        () =>
          session.state.meta.value.captureMode === 'demo' ||
          session.capabilities.value?.isMockMode === true,
      ),
    }
  },
})
</script>

<style scoped>
.agent {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.agent__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border);
}

.agent__status--listening .agent__dot {
  background: var(--color-success);
  animation: breathe 1.6s ease-in-out infinite;
}

.agent__status--paused .agent__dot {
  background: var(--color-warning);
}

@keyframes breathe {
  50% {
    opacity: 0.35;
  }
}
</style>
