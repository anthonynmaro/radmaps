<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="max-w-2xl w-full space-y-8 text-center">
      <!-- Success Icon & Heading -->
      <div class="space-y-4">
        <div class="text-6xl">🗺️</div>
        <h1 class="text-4xl font-bold text-gray-900">Order Confirmed!</h1>
        <p class="text-xl text-gray-600">
          Your trail map is being prepared for printing
        </p>
      </div>

      <!-- Order Details Card -->
      <div class="bg-green-50 border-2 border-green-600 rounded-lg p-8 space-y-4">
        <!-- Session ID -->
        <div v-if="sessionId" class="space-y-2">
          <p class="text-sm font-medium text-green-700 uppercase">Order ID</p>
          <p class="text-lg font-mono font-bold text-green-900 break-all">{{ sessionId }}</p>
        </div>

        <!-- Map Title -->
        <div v-if="mapTitle" class="space-y-2 border-t border-green-200 pt-4">
          <p class="text-sm font-medium text-green-700 uppercase">Map</p>
          <p class="text-lg font-semibold text-green-900">{{ mapTitle }}</p>
        </div>

        <!-- Status Message -->
        <div class="border-t border-green-200 pt-4 space-y-3">
          <div class="flex items-start gap-3">
            <svg
              class="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="text-left">
              <p class="font-medium text-green-900">Processing with Gelato</p>
              <p class="text-sm text-green-700">
                Your map is being printed and will ship within 5-7 business days
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <svg
              class="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="text-left">
              <p class="font-medium text-green-900">Tracking Available</p>
              <p class="text-sm text-green-700">
                You'll receive a shipping confirmation email with tracking details
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Digital Copy Section -->
      <div v-if="hasDigitalUrl" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <p class="font-semibold text-blue-900 mb-4">Download Your Digital Copy</p>
        <UButton
          :href="digitalUrl ?? ''"
          color="blue"
          icon="i-heroicons-arrow-down-tray-20-solid"
          size="lg"
          class="w-full"
        >
          Download Digital Map
        </UButton>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <UButton to="/dashboard" color="green" size="lg" class="w-full">
          View Your Dashboard
        </UButton>
        <UButton to="/create" variant="outline" size="lg" class="w-full">
          Create Another Map
        </UButton>
      </div>

      <!-- Help Text -->
      <div class="bg-gray-50 rounded-lg p-6 space-y-2">
        <p class="font-medium text-gray-900">Questions?</p>
        <p class="text-sm text-gray-600">
          Check your email for order confirmation and shipping updates. If you have any issues,
          please contact us at support@trailmaps.com
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseClient } from '#imports'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = useSupabaseClient() as any

const sessionId = ref<string | null>(null)
const mapTitle = ref<string | null>(null)
const digitalUrl = ref<string | null>(null)
const hasDigitalUrl = ref(false)

onMounted(async () => {
  // Get session_id from query params
  const qSessionId = route.query.session_id as string
  if (qSessionId) {
    sessionId.value = qSessionId

    try {
      // Try to fetch order details using session_id
      const { data, error } = await supabase
        .from('orders')
        .select('*, maps(title)')
        .eq('id', qSessionId)
        .single()

      if (!error && data) {
        mapTitle.value = data.maps?.title || null
        if (data.digital_url) {
          digitalUrl.value = data.digital_url
          hasDigitalUrl.value = true
        }
      }
    } catch (err) {
      console.error('Error fetching order details:', err)
    }
  }
})
</script>
