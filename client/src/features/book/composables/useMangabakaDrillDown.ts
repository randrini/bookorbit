import { ref } from 'vue'
import { api } from '@/lib/api'
import type { MangabakaCollectionSummary, MetadataCandidate } from '@bookorbit/types'

export function useMangabakaDrillDown() {
  const expandedSeries = ref<Set<string>>(new Set())
  const collectionsBySeries = ref<Map<string, MangabakaCollectionSummary[]>>(new Map())
  const expandedCollections = ref<Set<string>>(new Set())
  const worksByCollection = ref<Map<string, MetadataCandidate[]>>(new Map())
  const loadingSeries = ref<Set<string>>(new Set())
  const loadingCollections = ref<Set<string>>(new Set())
  const highlightedVolume = ref<number | null>(null)

  function seriesKey(providerId: string): string {
    return providerId
  }

  function collectionKey(providerId: string, collectionId: string): string {
    return `${providerId}:${collectionId}`
  }

  function isSeriesExpanded(providerId: string): boolean {
    return expandedSeries.value.has(seriesKey(providerId))
  }

  function isCollectionExpanded(providerId: string, collectionId: string): boolean {
    return expandedCollections.value.has(collectionKey(providerId, collectionId))
  }

  function isLoadingSeries(providerId: string): boolean {
    return loadingSeries.value.has(seriesKey(providerId))
  }

  function isLoadingCollection(providerId: string, collectionId: string): boolean {
    return loadingCollections.value.has(collectionKey(providerId, collectionId))
  }

  async function expandSeries(providerId: string, seriesId: number): Promise<void> {
    if (isSeriesExpanded(providerId)) {
      collapseSeries(providerId)
      return
    }

    if (collectionsBySeries.value.has(providerId)) {
      const nextExpanded = new Set(expandedSeries.value)
      nextExpanded.add(seriesKey(providerId))
      expandedSeries.value = nextExpanded
      return
    }

    loadingSeries.value = new Set([...loadingSeries.value, seriesKey(providerId)])
    try {
      const res = await api(`/api/v1/metadata-fetch/mangabaka/series/${seriesId}/collections`)
      if (!res.ok) return

      const collections = (await res.json()) as MangabakaCollectionSummary[]
      const nextCollections = new Map(collectionsBySeries.value)
      nextCollections.set(providerId, collections)
      collectionsBySeries.value = nextCollections

      const nextExpanded = new Set(expandedSeries.value)
      nextExpanded.add(seriesKey(providerId))
      expandedSeries.value = nextExpanded
    } finally {
      const nextLoading = new Set(loadingSeries.value)
      nextLoading.delete(seriesKey(providerId))
      loadingSeries.value = nextLoading
    }
  }

  function collapseSeries(providerId: string): void {
    const key = seriesKey(providerId)
    const nextExpanded = new Set(expandedSeries.value)
    nextExpanded.delete(key)
    expandedSeries.value = nextExpanded
  }

  async function expandCollection(providerId: string, collectionId: string, seriesId: number): Promise<void> {
    if (isCollectionExpanded(providerId, collectionId)) {
      collapseCollection(providerId, collectionId)
      return
    }

    if (worksByCollection.value.has(collectionId)) {
      const nextExpanded = new Set(expandedCollections.value)
      nextExpanded.add(collectionKey(providerId, collectionId))
      expandedCollections.value = nextExpanded
      return
    }

    const key = collectionKey(providerId, collectionId)
    loadingCollections.value = new Set([...loadingCollections.value, key])
    try {
      const res = await api(`/api/v1/metadata-fetch/mangabaka/collections/${collectionId}/works?seriesId=${seriesId}`)
      if (!res.ok) return

      const works = (await res.json()) as MetadataCandidate[]
      const nextWorks = new Map(worksByCollection.value)
      nextWorks.set(collectionId, works)
      worksByCollection.value = nextWorks

      const nextExpanded = new Set(expandedCollections.value)
      nextExpanded.add(key)
      expandedCollections.value = nextExpanded
    } finally {
      const nextLoading = new Set(loadingCollections.value)
      nextLoading.delete(key)
      loadingCollections.value = nextLoading
    }
  }

  function collapseCollection(providerId: string, collectionId: string): void {
    const key = collectionKey(providerId, collectionId)
    const nextExpanded = new Set(expandedCollections.value)
    nextExpanded.delete(key)
    expandedCollections.value = nextExpanded
  }

  return {
    expandedSeries,
    collectionsBySeries,
    expandedCollections,
    worksByCollection,
    loadingSeries,
    loadingCollections,
    highlightedVolume,
    expandSeries,
    collapseSeries,
    expandCollection,
    collapseCollection,
    isSeriesExpanded,
    isCollectionExpanded,
    isLoadingSeries,
    isLoadingCollection,
  }
}

export type MangabakaDrillDown = ReturnType<typeof useMangabakaDrillDown>
