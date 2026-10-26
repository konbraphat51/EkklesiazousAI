<!-- Layout switcher; each option names the hypothesis it embodies. -->
<template>
  <label class="layout" :title="t(`layoutHint.${current}`)">
    <span class="visually-hidden">{{ t('layout.label') }}</span>
    <select class="input layout__select" :value="current" :disabled="isLocked" @change="select">
      <option v-for="option in layouts" :key="option" :value="option">
        {{ t(`layout.${option}`) }}
      </option>
    </select>
  </label>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { LAYOUT_IDS, type LayoutId } from '@ekklesiazous/shared'
import { identity } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'MenuLayout',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const select = (event: Event): void => {
      const value = (event.target as HTMLSelectElement).value as LayoutId
      identity.uxOverrides = { ...identity.uxOverrides, layout: value }
      session.log('uxChanged', null, { feature: 'layout', value })
    }
    return {
      t,
      layouts: LAYOUT_IDS,
      current: computed(() => session.ux.value.layout),
      isLocked: computed(() => session.state.meta.value.isUxLocked),
      select,
    }
  },
})
</script>

<style scoped>
.layout__select {
  padding: 4px 8px;
}
</style>
