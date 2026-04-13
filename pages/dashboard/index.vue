<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">

    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">My Maps</h1>
        <p v-if="!loading && maps.length > 0" class="text-sm text-stone-400 mt-0.5">
          {{ maps.length }} poster{{ maps.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <NuxtLink to="/create">
        <button class="flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#235840] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          New Map
        </button>
      </NuxtLink>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="bg-white rounded-2xl border border-stone-200 p-4 flex gap-4 animate-pulse">
        <div class="w-14 shrink-0 rounded-lg bg-stone-100" style="aspect-ratio:3/4" />
        <div class="flex-1 py-1 space-y-2.5">
          <div class="h-4 bg-stone-100 rounded w-1/2" />
          <div class="h-3 bg-stone-100 rounded w-1/3" />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div class="h-9 w-16 bg-stone-100 rounded-lg" />
          <div class="h-9 w-16 bg-stone-100 rounded-lg" />
        </div>
      </div>
    </div>

    <!-- Map List -->
    <div v-else-if="maps.length > 0" class="space-y-3">
      <div
        v-for="map in maps"
        :key="map.id"
        class="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4 hover:border-stone-300 hover:shadow-sm transition-all"
      >
        <!-- Mini poster thumbnail -->
        <div
          class="w-14 shrink-0 rounded-lg overflow-hidden border border-stone-100"
          style="aspect-ratio:3/4"
        >
          <img
            v-if="map.thumbnail_url"
            :src="map.thumbnail_url"
            :alt="map.title"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center"
            :style="{ backgroundColor: map.style_config?.background_color ?? '#F7F4EF' }"
          >
            <svg
              class="w-5 h-5 opacity-25"
              viewBox="0 0 24 24"
              fill="none"
              :style="{ color: map.style_config?.route_color ?? '#2D6A4F' }"
            >
              <path d="M2 19 L8 6 L12 12 L16 8 L22 19 Z" fill="currentColor" opacity="0.3"/>
              <path d="M2 19 L8 6 L12 12 L16 8 L22 19" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
              <circle cx="8" cy="6" r="1" fill="currentColor"/>
            </svg>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5 min-w-0">
            <h3
              class="font-semibold text-stone-900 truncate text-sm leading-tight"
              style="font-family:'Space Grotesk',sans-serif"
            >{{ map.title }}</h3>
            <span :class="[
              'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
              map.status === 'rendered' ? 'bg-emerald-100 text-emerald-700' :
              map.status === 'ordered'  ? 'bg-sky-100 text-sky-700' :
              'bg-stone-100 text-stone-500'
            ]">{{ map.status }}</span>
          </div>
          <p class="text-xs text-stone-400">{{ formatDate(map.created_at) }}</p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 shrink-0">
          <NuxtLink :to="`/create/${map.id}/style`">
            <button class="text-sm font-medium text-stone-600 border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 transition-colors">
              Style
            </button>
          </NuxtLink>
          <NuxtLink v-if="map.status === 'rendered'" :to="`/create/${map.id}/checkout`">
            <button class="text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] rounded-lg px-3 py-2 transition-colors">
              Order
            </button>
          </NuxtLink>
          <button
            v-else
            disabled
            class="text-sm font-medium text-stone-300 border border-stone-100 rounded-lg px-3 py-2 cursor-not-allowed"
          >
            Order
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-20">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-stone-100 mb-5">
        <svg class="w-8 h-8 text-stone-400" viewBox="0 0 32 32" fill="none">
          <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.12"/>
          <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
          <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-stone-900 mb-2" style="font-family:'Space Grotesk',sans-serif">No maps yet</h3>
      <p class="text-sm text-stone-500 mb-6 max-w-xs mx-auto">
        Upload a GPX file or connect Strava to create your first trail poster.
      </p>
      <NuxtLink to="/create">
        <button class="inline-flex items-center gap-2 text-sm font-semibold bg-[#2D6A4F] hover:bg-[#235840] text-white px-5 py-3 rounded-xl transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Create Your First Map
        </button>
      </NuxtLink>
    </div>

    <!-- Recent Orders -->
    <div v-if="orders.length > 0" class="mt-10">
      <h2 class="text-base font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">Recent Orders</h2>
      <div class="space-y-2">
        <div
          v-for="order in orders"
          :key="order.id"
          class="flex items-center gap-3 bg-white rounded-xl border border-stone-200 px-4 py-3"
        >
          <div :class="[
            'w-2 h-2 rounded-full shrink-0',
            order.status === 'delivered' || order.status === 'shipped' ? 'bg-emerald-500' :
            order.status === 'paid'      || order.status === 'in_production' ? 'bg-sky-500' :
            order.status === 'cancelled' || order.status === 'failed' ? 'bg-red-400' :
            'bg-amber-400'
          ]" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-stone-900 truncate">{{ (order as any).maps?.title || 'Unknown Map' }}</p>
            <p class="text-xs text-stone-400">{{ order.print_size }} · {{ formatDate(order.created_at) }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-semibold text-stone-900">{{ formatPrice(order.total_cents) }}</p>
            <p class="text-xs text-stone-400 capitalize">{{ order.status.replace('_', ' ') }}</p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabaseClient, useSupabaseUser } from '#imports'
import type { TrailMap, Order } from '~/types'
import { formatPrice } from '~/utils/products'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const maps = ref<TrailMap[]>([])
const orders = ref<Order[]>([])
const loading = ref(true)

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const fetchMaps = async () => {
  if (!user.value?.id) return
  try {
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    maps.value = data || []
  } catch (err) {
    console.error('Error fetching maps:', err)
  }
}

const fetchOrders = async () => {
  if (!user.value?.id) return
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, maps(title)')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    orders.value = data || []
  } catch (err) {
    console.error('Error fetching orders:', err)
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([fetchMaps(), fetchOrders()])
  loading.value = false
})
</script>
