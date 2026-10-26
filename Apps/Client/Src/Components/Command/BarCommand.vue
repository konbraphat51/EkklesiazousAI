<!-- Bottom bar: explicit research commands (with depth and privacy), anonymous concerns, and
     one-click private help. -->
<template>
  <div class="command">
    <div class="command__quick">
      <button
        type="button"
        class="button button--small"
        :title="t('command.whatWasThatHint')"
        @click="askAboutRecent"
      >
        ❓ {{ t('command.whatWasThat') }}
      </button>
      <button type="button" class="button button--small" @click="askRecap(5)">
        ⏪ {{ t('command.whatDidIMiss') }}
      </button>
    </div>
    <form class="command__form" @submit.prevent="submit">
      <div class="command__modes" role="tablist">
        <button
          type="button"
          role="tab"
          class="command__mode"
          :class="{ 'command__mode--active': mode === 'research' }"
          @click="mode = 'research'"
        >
          {{ t('command.research') }}
        </button>
        <button
          type="button"
          role="tab"
          class="command__mode"
          :class="{ 'command__mode--active': mode === 'dissent' }"
          @click="mode = 'dissent'"
        >
          {{ t('command.dissent') }}
        </button>
      </div>
      <input
        v-model="text"
        class="input command__input"
        :placeholder="
          mode === 'research' ? t('command.placeholder') : t('command.dissentPlaceholder')
        "
        maxlength="1000"
      />
      <template v-if="mode === 'research'">
        <select v-model="depth" class="input command__depth" :title="t('command.depth')">
          <option v-for="option in depths" :key="option" :value="option">
            {{ t(`depth.${option}`) }}
          </option>
        </select>
        <label class="command__private" :title="t('command.privateHint')">
          <input v-model="isPrivate" type="checkbox" /> {{ t('command.private') }}
        </label>
      </template>
      <button class="button button--primary" type="submit" :disabled="isBusy || !text.trim()">
        {{ mode === 'research' ? t('command.send') : t('command.raise') }}
      </button>
    </form>
    <p v-if="feedback" class="command__feedback">{{ feedback }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESEARCH_DEPTHS, type ResearchDepth } from '@ekklesiazous/shared'
import { api, ApiError } from '../../Services/ApiClient'
import { identity } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import { useClarification } from '../../Composables/UseClarification'

const FEEDBACK_MS = 5000

export default defineComponent({
  name: 'BarCommand',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const { askAboutRecent, askRecap } = useClarification()
    const mode = ref<'research' | 'dissent'>('research')
    const text = ref('')
    const depth = ref<ResearchDepth>('standard')
    const isPrivate = ref(false)
    const isBusy = ref(false)
    const feedback = ref('')
    let feedbackTimer = 0

    const showFeedback = (message: string): void => {
      feedback.value = message
      window.clearTimeout(feedbackTimer)
      feedbackTimer = window.setTimeout(() => (feedback.value = ''), FEEDBACK_MS)
    }

    const submit = async (): Promise<void> => {
      const value = text.value.trim()
      if (!value) return
      isBusy.value = true
      try {
        if (mode.value === 'dissent') {
          const { result } = await api.raiseDissent(session.roomId, {
            text: value,
            participantId: identity.participantId,
          })
          session.log('dissentRaised', null, { result })
          showFeedback(t(`command.dissentResult.${result}`))
        } else {
          const request = {
            text: value,
            requesterName: identity.name,
            participantId: identity.participantId,
            depth: depth.value,
            isPrivate: isPrivate.value,
          }
          session.log('commandIssued', null, { depth: depth.value, isPrivate: isPrivate.value })
          if (isPrivate.value) {
            void session.privateFeed.runPrivateCommand(request).catch(() => undefined)
            showFeedback(t('command.sentPrivate'))
          } else {
            const { insightId } = await api.issueCommand(session.roomId, request)
            session.focusRequest.value = { itemId: insightId, at: Date.now() }
            showFeedback(t('command.sent'))
          }
        }
        text.value = ''
      } catch (error) {
        showFeedback(
          error instanceof ApiError && error.status === 422
            ? t('command.notResearch')
            : t('command.failed'),
        )
      } finally {
        isBusy.value = false
      }
    }

    return {
      t,
      mode,
      text,
      depth,
      depths: RESEARCH_DEPTHS,
      isPrivate,
      isBusy,
      feedback,
      submit,
      askAboutRecent,
      askRecap,
    }
  },
})
</script>

<style scoped>
.command {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(900px, calc(100% - 32px));
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}

.command__quick {
  display: flex;
  gap: 6px;
}

.command__form {
  display: flex;
  align-items: center;
  gap: 6px;
}

.command__modes {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  overflow: hidden;
}

.command__mode {
  padding: 5px 10px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
}

.command__mode--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}

.command__input {
  flex: 1;
  min-width: 120px;
}

.command__depth {
  width: auto;
}

.command__private {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.command__feedback {
  margin: 0;
  font-size: 12px;
  color: var(--color-accent);
}
</style>
