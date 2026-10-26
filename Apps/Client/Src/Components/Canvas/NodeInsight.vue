<!-- Canvas node wrapping an insight card, with hidden handles for issue-map connectors. -->
<template>
  <div class="node-insight">
    <Handle type="target" :position="Position.Left" class="node-insight__handle" />
    <CardInsight :insight="data.insight" :is-pulsing="data.isPulsing === true" />
    <Handle type="source" :position="Position.Right" class="node-insight__handle" />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { Insight } from '@ekklesiazous/shared'
import CardInsight from '../Card/CardInsight.vue'

export default defineComponent({
  name: 'NodeInsight',
  components: { CardInsight, Handle },
  props: {
    /** Node payload from the layout. */
    data: {
      type: Object as PropType<{ insight: Insight; isPulsing?: boolean }>,
      required: true,
    },
  },
  setup() {
    return { Position }
  },
})
</script>

<style scoped>
.node-insight {
  width: 100%;
}

.node-insight__handle {
  opacity: 0;
  pointer-events: none;
}
</style>
