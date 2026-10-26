<!-- Settings: personal preferences, room configuration and UX experiment conditions. -->
<template>
  <div
    class="settings"
    role="dialog"
    aria-modal="true"
    :aria-label="t('settings.title')"
    @click.self="$emit('close')"
  >
    <div class="settings__box">
      <header class="settings__header">
        <nav class="settings__tabs">
          <button
            v-for="tab in tabs"
            :key="tab"
            type="button"
            class="settings__tab"
            :class="{ 'settings__tab--active': tab === active }"
            @click="active = tab"
          >
            {{ t(`settings.tab.${tab}`) }}
          </button>
        </nav>
        <button type="button" class="button button--ghost" @click="$emit('close')">✕</button>
      </header>

      <section v-if="active === 'me'" class="settings__body">
        <label class="field">
          <span>{{ t('settings.name') }}</span>
          <input v-model="identity.name" class="input" maxlength="80" />
        </label>
        <label class="field">
          <span>{{ t('private.background') }}</span>
          <input
            v-model="identity.background"
            class="input"
            maxlength="300"
            :placeholder="t('private.backgroundPlaceholder')"
          />
        </label>
        <div class="field">
          <span>{{ t('common.language') }}</span>
          <SwitcherLocale />
        </div>
        <p v-if="meta.isUxLocked" class="settings__note">{{ t('settings.locked') }}</p>
        <FieldUxFeature
          v-for="featureId in participantFeatures"
          :key="featureId"
          :feature-id="featureId"
          :value="ux[featureId]"
          :is-disabled="meta.isUxLocked"
          @change="(value) => setOwnFeature(featureId, value)"
        />
      </section>

      <section v-if="active === 'room'" class="settings__body">
        <label class="field">
          <span>{{ t('lobby.title') }}</span>
          <input class="input" :value="meta.title" @change="patch({ title: inputValue($event) })" />
        </label>
        <label class="field">
          <span>{{ t('lobby.platform') }}</span>
          <select
            class="input"
            :value="meta.meetingPlatform"
            @change="patch({ meetingPlatform: inputValue($event) as never })"
          >
            <option v-for="option in platforms" :key="option" :value="option">
              {{ t(`platform.${option}`) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>{{ t('lobby.captureMode') }}</span>
          <select
            class="input"
            :value="meta.captureMode"
            @change="patch({ captureMode: inputValue($event) as never })"
          >
            <option v-for="option in captureModes" :key="option" :value="option">
              {{ t(`captureMode.${option}`) }}
            </option>
          </select>
        </label>
        <label v-if="meta.meetingPlatform === 'zoom'" class="field">
          <span>{{ t('settings.zoomMeetingId') }}</span>
          <input
            class="input"
            :value="meta.zoomMeetingId"
            @change="patch({ zoomMeetingId: inputValue($event).trim() })"
          />
        </label>
        <label class="field">
          <span>{{ t('settings.languageInsight') }}</span>
          <select
            class="input"
            :value="meta.languageInsight"
            @change="patch({ languageInsight: inputValue($event) as never })"
          >
            <option v-for="option in ['auto', 'en', 'ja']" :key="option" :value="option">
              {{ t(`languageInsight.${option}`) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>{{ t('settings.proactivity') }}</span>
          <select
            class="input"
            :value="meta.proactivity"
            @change="patch({ proactivity: inputValue($event) as never })"
          >
            <option v-for="option in proactivityLevels" :key="option" :value="option">
              {{ t(`proactivity.${option}`) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>{{ t('settings.depthDefault') }}</span>
          <select
            class="input"
            :value="meta.researchDepthDefault"
            @change="patch({ researchDepthDefault: inputValue($event) as never })"
          >
            <option v-for="option in depths" :key="option" :value="option">
              {{ t(`depth.${option}`) }}
            </option>
          </select>
        </label>
        <fieldset class="settings__kinds">
          <legend>{{ t('settings.kinds') }}</legend>
          <label v-for="kind in kinds" :key="kind">
            <input type="checkbox" :checked="meta.kindsEnabled[kind]" @change="toggleKind(kind)" />
            {{ t(`kind.${kind}`) }}
          </label>
        </fieldset>
        <label class="field">
          <span>{{ t('settings.wakeWords') }}</span>
          <input class="input" :value="meta.wakeWords.join(', ')" @change="setWakeWords" />
        </label>
        <label class="settings__check">
          <input
            type="checkbox"
            :checked="meta.isClarificationPromotionEnabled"
            @change="
              patch({ isClarificationPromotionEnabled: !meta.isClarificationPromotionEnabled })
            "
          />
          {{ t('settings.promotion') }}
        </label>
      </section>

      <section v-if="active === 'experiment'" class="settings__body">
        <p class="settings__note">{{ t('settings.experimentIntro') }}</p>
        <label class="settings__check">
          <input
            type="checkbox"
            :checked="meta.isUxLocked"
            @change="patch({ isUxLocked: !meta.isUxLocked })"
          />
          {{ t('settings.lock') }}
        </label>
        <FieldUxFeature
          v-for="featureId in allFeatures"
          :key="featureId"
          :feature-id="featureId"
          :value="meta.uxSettings[featureId]"
          @change="(value) => setRoomFeature(featureId, value)"
        />
        <a class="button" :href="minutesUrl" download>⬇ {{ t('settings.minutes') }}</a>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  INSIGHT_KINDS,
  MEETING_PLATFORMS,
  PROACTIVITY_LEVELS,
  RESEARCH_DEPTHS,
  UX_FEATURES,
  UX_FEATURE_IDS,
  type CaptureMode,
  type InsightKind,
  type MeetingMeta,
  type UxFeatureId,
} from '@ekklesiazous/shared'
import { api } from '../../Services/ApiClient'
import { identity } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import SwitcherLocale from '../Common/SwitcherLocale.vue'
import FieldUxFeature from './FieldUxFeature.vue'

type SettingsTab = 'me' | 'room' | 'experiment'

export default defineComponent({
  name: 'DialogSettings',
  components: { FieldUxFeature, SwitcherLocale },
  emits: {
    /** Close the dialog. */
    close: () => true,
  },
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const meta = session.state.meta
    const patch = (values: Partial<MeetingMeta>): void => session.board.patchMeta(values)
    const inputValue = (event: Event): string => (event.target as HTMLInputElement).value

    const setOwnFeature = (featureId: UxFeatureId, value: string): void => {
      identity.uxOverrides = { ...identity.uxOverrides, [featureId]: value }
      session.log('uxChanged', null, { feature: featureId, value, scope: 'participant' })
    }
    const setRoomFeature = (featureId: UxFeatureId, value: string): void => {
      patch({ uxSettings: { ...meta.value.uxSettings, [featureId]: value } })
      session.log('uxChanged', null, { feature: featureId, value, scope: 'room' })
    }
    const toggleKind = (kind: InsightKind): void =>
      patch({
        kindsEnabled: { ...meta.value.kindsEnabled, [kind]: !meta.value.kindsEnabled[kind] },
      })
    const setWakeWords = (event: Event): void =>
      patch({
        wakeWords: inputValue(event)
          .split(/[,、]/)
          .map((word) => word.trim())
          .filter(Boolean),
      })

    const captureModes = computed<CaptureMode[]>(() =>
      meta.value.meetingPlatform === 'inPerson'
        ? ['roomMicrophone', 'demo']
        : ['onlineHostCapture', 'onlinePerParticipant', 'zoomRtms', 'meetingBot', 'demo'],
    )

    return {
      t,
      identity,
      meta,
      ux: session.ux,
      tabs: ['me', 'room', 'experiment'] as SettingsTab[],
      active: ref<SettingsTab>('me'),
      participantFeatures: UX_FEATURE_IDS.filter((id) => UX_FEATURES[id].scope === 'participant'),
      allFeatures: UX_FEATURE_IDS,
      platforms: MEETING_PLATFORMS,
      captureModes,
      proactivityLevels: PROACTIVITY_LEVELS,
      depths: RESEARCH_DEPTHS,
      kinds: INSIGHT_KINDS,
      minutesUrl: api.minutesUrl(session.roomId),
      patch,
      inputValue,
      setOwnFeature,
      setRoomFeature,
      toggleKind,
      setWakeWords,
    }
  },
})
</script>

<style scoped>
.settings {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, 0.35);
  z-index: 90;
}

.settings__box {
  display: flex;
  flex-direction: column;
  width: min(640px, 94%);
  max-height: 88vh;
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}

.settings__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.settings__tabs {
  display: flex;
  gap: 4px;
}

.settings__tab {
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-small);
  background: none;
  color: var(--color-text-muted);
}

.settings__tab--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}

.settings__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 20px;
  overflow-y: auto;
}

.settings__note {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.settings__kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
}

.settings__kinds legend {
  font-size: 12px;
  color: var(--color-text-muted);
}

.settings__check {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
