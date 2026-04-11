<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-gray-900">Your Maps</h1>
      <UButton to="/create" icon="i-heroicons-plus-20-solid" color="green">
        New Map
      </UButton>
    </div>

    <!-- Maps Grid -->
    <div v-if="maps.length > 0" class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-4">All Maps</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="map in maps"
            :key="map.id"
            class="group rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <!-- Thumbnail -->
            <div class="relative h-40 bg-gradient-to-br from-green-50 to-green-100 overflow-hidden">
              <img
                v-if="map.thumbnail_url"
                :src="map.thumbnail_url"
                :alt="map.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center"
                :style="{ backgroundColor: '#2D6A4F' }"
              >
                <svg
                  class="w-12 h-12 text-white opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 20l-5.447-2.724A1 1 0 003 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.553-.894L15 11"
                  />
                </svg>
              </div>
            </div>

            <!-- Content -->
            <div class="p-4 space-y-3">
              <div>
                <h3 class="font-semibold text-gray-900 truncate">{{ map.title }}</h3>
                <p v-if="map.subtitle" class="text-sm text-gray-600 truncate">
                  {{ map.subtitle }}
                </p>
              </div>

              <!-- Status Badge -->
              <div class="flex items-center gap-2">
                <UBadge
                  :color="getStatusColor(map.status)"
                  variant="subtle"
                  class="capitalize"
                >
                  {{ map.status }}
                </UBadge>
                <span class="text-xs text-gray-500">
                  {{ formatDate(map.created_at) }}
                </span>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 pt-2">
                <UButton
                  :to="`/create/${map.id}/style`"
                  size="sm"
                  variant="ghost"
                  class="flex-1"
                >
                  Style
                </UButton>
                <UButton
                  v-if="map.status === 'rendered'"
                  :to="`/create/${map.id}/checkout`"
                  size="sm"
                  color="green"
                  class="flex-1"
                >
                  Order
                </UButton>
                <UButton
                  v-else
                  size="sm"
                  variant="ghost"
                  disabled
                  class="flex-1"
                >
                  Order
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.553-.894L15 11"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No maps yet</h3>
      <p class="mt-1 text-sm text-gray-500">
        Create your first trail map by uploading a GPX file.
      </p>
      <div class="mt-6">
        <UButton to="/create" color="green">
          Create Your First Map
        </UButton>
      </div>
    </div>

    <!-- Recent Orders Section -->
    <div v-if="orders.length > 0" class="space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">Recent Orders</h2>
      <UTable
        :rows="orders"
        :columns="[
          { key: 'map_title', label: 'Map' },
          { key: 'print_size', label: 'Size' },
          { key: 'status', label: 'Status' },
          { key: 'total_cents', label: 'Total' },
          { key: 'created_at', label: 'Date' },
        ]"
        :ui="{ th: { base: 'text-left text-xs font-medium text-gray-500 uppercase' } }"
      >
        <template #map_title-data="{ row }">
          <span class="text-sm font-medium text-gray-900">
            {{ row.maps?.title || 'Unknown' }}
          </span>
        </template>

        <template #status-data="{ row }">
          <UBadge
            :color="getOrderStatusColor(row.status)"
            variant="subtle"
            class="capitalize"
          >
            {{ row.status }}
          </UBadge>
        </template>

        <template #total_cents-data="{ row }">
          <span class="text-sm text-gray-900">
            {{ formatPrice(row.total_cents) }}
          </span>
        </template>

        <template #created_at-data="{ row }">
          <span class="text-sm text-gray-600">
            {{ formatDate(row.created_at) }}
          </span>
        </template>
      </UTable>
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft':
      return 'gray'
    case 'rendered':
      return 'blue'
    case 'ordered':
      return 'green'
    default:
      return 'gray'
  }
}

const getOrderStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'yellow'
    case 'processing':
      return 'blue'
    case 'shipped':
      return 'green'
    case 'delivered':
      return 'green'
    case 'cancelled':
      return 'red'
    default:
      return 'gray'
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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
