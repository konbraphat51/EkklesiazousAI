<!-- Other participants' pointers on the canvas (only those viewing the same layout). -->
<template>
  <div class="cursors" aria-hidden="true">
    <div
      v-for="peer in visiblePeers"
      :key="peer.clientId"
      class="cursors__item"
      :style="{
        transform: `translate(${peer.cursor!.x * viewport.zoom + viewport.x}px, ${peer.cursor!.y * viewport.zoom + viewport.y}px)`,
        '--cursor-color': peer.user.color,
      }"
    >
      <svg width="14" height="18" viewBox="0 0 14 18"><path d="M0 0 L14 10 L7 11 L4 18 Z" /></svg>
      <span class="cursors__name">{{ peer.user.name }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import type { PresencePeer } from '../../Composables/UsePresence'

export default defineComponent({
  name: 'OverlayCursors',
  props: {
    /** Other participants. */
    peers: { type: Array as PropType<PresencePeer[]>, required: true },
    /** Current viewport transform of the canvas. */
    viewport: { type: Object as PropType<{ x: number; y: number; zoom: number }>, required: true },
    /** Layout this viewer is showing. */
    layout: { type: String, required: true },
  },
  setup(props) {
    return {
      visiblePeers: computed(() =>
        props.peers.filter((peer) => peer.cursor !== null && peer.layout === props.layout),
      ),
    }
  },
})
</script>

<style scoped>
.cursors {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.cursors__item {
  position: absolute;
  top: 0;
  left: 0;
  transition: transform 0.08s linear;
}

.cursors__item path {
  fill: var(--cursor-color);
}

.cursors__name {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--cursor-color);
  color: #fff;
  font-size: 11px;
}
</style>
