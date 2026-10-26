<!-- Small input level meter. -->
<template>
  <span
    class="meter"
    role="meter"
    :aria-valuenow="Math.round(level * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <span class="meter__fill" :style="{ width: `${Math.round(level * 100)}%` }" />
  </span>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MeterLevel',
  props: {
    /** Level 0..1. */
    level: { type: Number, required: true },
  },
})
</script>

<style scoped>
.meter {
  display: inline-block;
  width: 80px;
  height: 6px;
  border-radius: 3px;
  background: var(--color-surface-muted);
  overflow: hidden;
}

.meter__fill {
  display: block;
  height: 100%;
  background: var(--color-success);
  transition: width 0.1s linear;
}
</style>
