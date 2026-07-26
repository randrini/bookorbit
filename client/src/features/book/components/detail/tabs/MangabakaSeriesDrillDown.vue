<script setup lang="ts">
import { computed, watch } from 'vue'
import { ChevronDown, ChevronUp, Loader2 } from '@lucide/vue'
import type { MangabakaCollectionSummary, MetadataCandidate } from '@bookorbit/types'
import type { MangabakaDrillDown } from '../../../composables/useMangabakaDrillDown'
import MangabakaVolumeCard from './MangabakaVolumeCard.vue'

const props = defineProps<{
  seriesCandidate: MetadataCandidate
  drillDown: MangabakaDrillDown
}>()

const emit = defineEmits<{ select: [MetadataCandidate] }>()

const providerId = computed(() => props.seriesCandidate.providerId)
const seriesId = computed(() => Number(props.seriesCandidate.providerId))
const isExpanded = computed(() => props.drillDown.isSeriesExpanded(providerId.value))
const isLoading = computed(() => props.drillDown.isLoadingSeries(providerId.value))
const collections = computed(() => props.drillDown.collectionsBySeries.value.get(providerId.value) ?? [])

function handleToggleSeries() {
  props.drillDown.expandSeries(providerId.value, seriesId.value)
}

function handleToggleCollection(collection: MangabakaCollectionSummary) {
  props.drillDown.expandCollection(providerId.value, collection.id, seriesId.value)
}

function handleSelectVolume(candidate: MetadataCandidate) {
  emit('select', candidate)
}

function isCollectionExpanded(collection: MangabakaCollectionSummary) {
  return props.drillDown.isCollectionExpanded(providerId.value, collection.id)
}

function isCollectionLoading(collection: MangabakaCollectionSummary) {
  return props.drillDown.isLoadingCollection(providerId.value, collection.id)
}

function collectionWorks(collection: MangabakaCollectionSummary) {
  return props.drillDown.worksByCollection.value.get(collection.id) ?? []
}

function collectionTotalCount(collection: MangabakaCollectionSummary): number {
  return collection.countMain + collection.countExtra + collection.countOther
}

function isHighlightedVolume(candidate: MetadataCandidate): boolean {
  const highlighted = props.drillDown.highlightedVolume.value
  return highlighted != null && candidate.seriesIndex === highlighted
}

watch(
  () => props.drillDown.highlightedVolume.value,
  async (volume) => {
    if (volume == null) return
    if (!isExpanded.value) {
      await props.drillDown.expandSeries(providerId.value, seriesId.value)
    }
    for (const collection of collections.value) {
      if (isCollectionExpanded(collection)) {
        if (collectionWorks(collection).some((work) => work.seriesIndex === volume)) return
      } else {
        await props.drillDown.expandCollection(providerId.value, collection.id, seriesId.value)
        if (collectionWorks(collection).some((work) => work.seriesIndex === volume)) return
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="rounded-xl border border-border bg-card overflow-hidden">
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      @click="handleToggleSeries"
    >
      <span class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-foreground truncate block">{{ seriesCandidate.title }}</span>
        <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">MangaBaka series</span>
      </span>
      <span class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-muted-foreground">Browse Volumes</span>
        <component :is="isExpanded ? ChevronUp : ChevronDown" class="size-4 text-muted-foreground" />
      </span>
    </button>

    <div v-if="isExpanded" class="border-t border-border px-3 pb-3">
      <div v-if="isLoading" class="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center">
        <Loader2 class="size-4 animate-spin" />
        Loading collections...
      </div>

      <div v-else-if="!collections.length" class="py-6 text-center text-sm text-muted-foreground">No collections found for this series.</div>

      <div v-else class="space-y-2 pt-2">
        <div v-for="collection in collections" :key="collection.id" class="rounded-lg border border-border/60 overflow-hidden">
          <button
            class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
            @click="handleToggleCollection(collection)"
          >
            <span class="min-w-0 flex-1 flex flex-col gap-0.5">
              <span class="text-sm font-medium text-foreground truncate">{{ collection.title }}</span>
              <span class="flex items-center gap-1.5 flex-wrap">
                <span
                  class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase"
                  :title="collection.languageDisplay"
                >
                  {{ collection.language }}
                </span>
                <span v-if="collection.publisher" class="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {{ collection.publisher }}
                </span>
                <span class="text-[10px] text-muted-foreground tabular-nums"> {{ collectionTotalCount(collection) }} volumes </span>
              </span>
            </span>
            <component :is="isCollectionExpanded(collection) ? ChevronUp : ChevronDown" class="size-4 text-muted-foreground shrink-0" />
          </button>

          <div v-if="isCollectionExpanded(collection)" class="border-t border-border/60 bg-muted/20 px-2 py-2">
            <div v-if="isCollectionLoading(collection)" class="flex items-center gap-2 py-4 text-xs text-muted-foreground justify-center">
              <Loader2 class="size-3.5 animate-spin" />
              Loading volumes...
            </div>

            <div v-else-if="!collectionWorks(collection).length" class="py-4 text-center text-xs text-muted-foreground">No volumes found.</div>

            <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              <MangabakaVolumeCard
                v-for="work in collectionWorks(collection)"
                :key="work.providerId"
                :candidate="work"
                :is-highlighted="isHighlightedVolume(work)"
                @select="handleSelectVolume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
