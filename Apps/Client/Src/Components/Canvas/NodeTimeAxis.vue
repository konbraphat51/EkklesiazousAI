<!-- Time axis of the timeline rail: minute ticks, anchors of triggered cards and the "now" marker. -->
<template>
  <div class="axis">
    <span
      v-for="tick in ticks"
      :key="tick.minute"
      class="axis__tick"
      :style="{ left: `${tick.x}px` }"
    >
      {{ tick.label }}
    </span>
    <span
      v-for="(anchor, index) in data.anchors"
      :key="index"
      class="axis__anchor"
      :style="{ left: `${anchor.x}px`, background: `var(--kind-${anchor.kind})` }"
    />
    <span class="axis__now" :style="{ left: `${data.nowX}px` }">{{ t('canvas.now') }}</span>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'NodeTimeAxis',
  props: {
    /** Node payload from the layout. */
    data: {
      type: Object as PropType<{
        pxPerSecond: number
        nowX: number
        anchors: Array<{ x: number; kind: string }>
      }>,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18n()
    const ticks = computed(() => {
      const count = Math.floor(props.data.nowX / (props.data.pxPerSecond * 60)) + 1
      return Array.from({ length: count }, (_, minute) => ({
        minute,
        x: minute * 60 * props.data.pxPerSecond,
        label: `${minute}:00`,
      }))
    })
    return { t, ticks }
  },
})
</script>

<style scoped>
.axis {
  position: relative;
  height: 24px;
  border-top: 2px solid var(--color-border);
}

.axis__tick {
  position: absolute;
  top: 0;
  padding-left: 4px;
  border-left: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text-muted);
}

.axis__anchor {
  position: absolute;
  top: -7px;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
}

.axis__now {
  position: absolute;
  top: -10px;
  height: 600px;
  padding-left: 4px;
  border-left: 2px solid var(--color-danger);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-danger);
  pointer-events: none;
}
</style>
