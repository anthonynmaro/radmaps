<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">Your Maps</h1>
        <p v-if="maps.length > 0" class="mt-1 text-sm text-stone-400">{{ maps.length }} map{{ maps.length === 1 ? '' : 's' }}</p>
      </div>
      <NuxtLink to="/create">
        <button class="flex items-center gap-2 text-sm font-semibold bg-[#2D6A4F] hover:bg-[#235840] text-white px-4 py-2.5 rounded-lg transition-colors min-h-[44px]">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          <span class="hidden sm:inline">New Map</span>
          <span class="sm:hidden">New</span>
        </button>
      </NuxtLink>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="i in 3" :key="i" class="rounded-2xl border border-stone-200 overflow-hidden animate-pulse">
        <div class="aspect-[3/4] bg-stone-100" />
        <div class="p-4 space-y-2">
          <div class="h-4 bg-stone-100 rounded w-3/4" />
          <div class="h-3 bg-stone-100 rounded w-1/2" />
        </div>
      </div>
    </div>

    <!-- Maps Grid -->
    <div v-else-if="maps.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="map in maps"
        :key="map.id"
        class="group rounded-2xl border border-stone-200 overflow-hidden hover:border-stone-300 hover:shadow-md transition-all bg-white"
      >
        <!-- Poster-ratio thumbnail -->
        <div class="relative aspect-[3/4] bg-stone-100 overflow-hidden">
          <img
            v-if="map.thumbnail_url"
            :src="map.thumbnail_url"
            :alt="map.title"
            class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center gap-3"
            :style="{ backgroundColor: map.style_config?.background_color ?? '#F7F4EF' }">
            <svg class="w-10 h-10 opacity-20" viewBox="0 0 32 32" fill="none"
              :style="{ color: map.style_config?.route_color ?? '#C1121F' }">
              <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.25"/>
              <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
              <circle cx="11" cy="8" r="1.8" fill="currentColor"/>
            </svg>
            <span class="text-[10px] font-bold uppercase tracking-widest opacity-25"
              :style="{ color: map.style_config?.route_color ?? '#C1121F' }">
              No preview
            </span>
          </div>

          <!-- Status chip overlay -->
          <div class="absolute top-3 left-3">
            <span :class="[
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm',
              map.status === 'rendered' ? 'bg-emerald-500/90 text-white' :
              map.status === 'ordered' ? 'bg-sky-500/90 text-white' :
              'bg-black/30 text-white'
            ]">
              <span :class="['w-1.5 h-1.5 rounded-full', map.status === 'rendered' ? 'bg-white' : map.status === 'ordered' ? 'bg-white' : 'bg-white/60']" />
              {{ map.status }}
            </span>
          </div>
        </div>

        <!-- Card footer -->
        <div class="p-4">
          <div class="mb-3">
            <h3 class="font-semibold text-stone-900 truncate" style="font-family:'Space Grotesk',sans-serif">{{ map.title }}</h3>
            <p class="text-xs text-stone-400 mt-0.5">{{ formatDate(map.created_at) }}</p>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <NuxtLink :to="`/create/${map.id}/style`" class="flex-1">
              <button class="w-full text-sm font-medium text-stone-700 border border-stone-200 rounded-lg px-3 py-2.5 hover:bg-stone-50 transition-colors min-h-[40px]">
                Style
              </button>
            </NuxtLink>
            <NuxtLink v-if="map.status === 'rendered'" :to="`/create/${map.id}/checkout`" class="flex-1">
              <button class="w-full text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] rounded-lg px-3 py-2.5 transition-colors min-h-[40px]">
                Order
              </button>
            </NuxtLink>
            <button v-else class="flex-1 text-sm font-medium text-stone-300 border border-stone-100 rounded-lg px-3 py-2.5 cursor-not-allowed min-h-[40px]" disabled>
              Order
            </button>
          </div>
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
      <h3 class="text-lg font-semibold text-stone-900 mb-1" style="font-family:'Space Grotesk',sans-serif">No maps yet</h3>
      <p class="text-sm text-stone-500 mb-6 max-w-xs mx-auto">
        Upload a GPX file or import from Strava to create your first poster.
      </p>
      <NuxtLink to="/create">
        <button class="inline-flex items-center gap-2 text-sm font-semibold bg-[#2D6A4F] hover:bg-[#235840] text-white px-5 py-3 rounded-xl transition-colors">
          Create Your First Map
        </button>
      </NuxtLink>
    </div>

    <!-- Recent Orders Section -->
    <div v-if="orders.length > 0" class="mt-12">
      <h2 class="text-lg font-semibold text-stone-900 mb-4" style="font-family:'Space Grotesk',sans-serif">Recent Orders</h2>

      <!-- Mobile/Desktop card list -->
      <div class="space-y-3">
        <div
          v-for="order in orders"
          :key="order.id"
          class="flex items-center gap-4 bg-white rounded-xl border border-stone-200 px-4 py-3.5"
        >
          <!-- Status dot -->
          <div :class="[
            'w-2 h-2 rounded-full shrink-0',
            order.status === 'delivered' || order.status === 'shipped' ? 'bg-emerald-500' :
            order.status === 'paid' || order.status === 'in_production' ? 'bg-sky-500' :
            order.status === 'cancelled' || order.status === 'failed' ? 'bg-red-400' :
            'bg-amber-400'
          ]" />

          <!-- Map title -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-stone-900 truncate">{{ (order as any).maps?.title || 'Unknown Map' }}</p>
            <p class="text-xs text-stone-400">{{ order.print_size }} · {{ formatDate(order.created_at) }}</p>
          </div>

          <!-- Status + price -->
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
