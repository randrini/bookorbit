<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { MetadataCandidate } from '@bookorbit/types'
import { hideOnError, toDisplayCoverUrl } from '../../../lib/metadata-fetch'
import { COVER_ASPECT_RATIO_KEY, DEFAULT_COVER_ASPECT_RATIO } from '../../../lib/cover-aspect-ratio'
import BookCoverPlaceholder from '@/features/book/components/BookCoverPlaceholder.vue'

const props = defineProps<{
  candidate: MetadataCandidate
  isHighlighted?: boolean
}>()

const emit = defineEmits<{ select: [MetadataCandidate] }>()

const coverAspectRatio = inject(COVER_ASPECT_RATIO_KEY, ref(DEFAULT_COVER_ASPECT_RATIO))

const displayCoverUrl = computed(() => toDisplayCoverUrl(props.candidate.coverUrl))
const candidateSeed = computed(() => props.candidate.title ?? props.candidate.provider)
const candidateAuthorLine = computed(() => props.candidate.authors?.join(', ') || null)

const volumeNumberDisplay = computed(() => {
  const index = props.candidate.seriesIndex
  if (index == null) return 'Vol. ?'
  const padded = index.toString().padStart(2, '0')
  return `Vol. ${padded}`
})

function handleSelect() {
  emit('select', props.candidate)
}
</script>

<template>
  <button
    class="group flex flex-col items-center gap-1.5 p-2 rounded-xl border text-left transition-all active:scale-[0.98] w-full"
    :class="
      isHighlighted
        ? 'border-primary bg-primary/5 ring-2 ring-primary'
        : 'border-border/60 bg-card hover:border-border hover:shadow-md hover:-translate-y-px'
    "
    @click="handleSelect"
  >
    <span class="relative shrink-0 rounded-lg overflow-hidden bg-muted block shadow-sm" :style="{ width: '60px', aspectRatio: coverAspectRatio }">
      <img
        v-if="displayCoverUrl"
        :src="displayCoverUrl"
        :alt="candidate.title"
        class="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        @error="hideOnError"
      />
      <BookCoverPlaceholder v-else :title="candidateSeed" :author-line="candidateAuthorLine" :is-audio="false" :seed="candidateSeed" />
    </span>

    <span class="w-full flex flex-col gap-0.5">
      <span
        class="inline-flex items-center justify-center self-start rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground tabular-nums"
      >
        {{ volumeNumberDisplay }}
      </span>
      <span class="text-xs font-medium leading-snug line-clamp-2 text-foreground">{{ candidate.title }}</span>
    </span>
  </button>
</template>
