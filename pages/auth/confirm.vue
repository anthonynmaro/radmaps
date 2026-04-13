<template>
  <div class="min-h-screen flex items-center justify-center bg-white p-4">
    <div class="text-center max-w-md">
      <!-- Loading State -->
      <div v-if="isLoading" class="space-y-6">
        <div class="flex justify-center">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-[#2D6A4F] rounded-full">
            <svg class="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Logging you in...</h1>
        <p class="text-gray-600">Please wait while we verify your session.</p>
      </div>

      <!-- Error State -->
      <div v-else-if="hasError" class="space-y-6">
        <div class="flex justify-center">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
            <svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p class="text-gray-600 mb-6">We couldn't log you in. This magic link may have expired.</p>
        </div>
        <div class="space-y-3">
          <NuxtLink to="/auth/login">
            <UButton
              size="lg"
              color="green"
              block
              class="bg-[#2D6A4F] hover:bg-[#1b4332]"
            >
              Try signing in again
            </UButton>
          </NuxtLink>
          <NuxtLink to="/">
            <UButton
              size="lg"
              color="gray"
              variant="outline"
              block
            >
              Back to home
            </UButton>
          </NuxtLink>
        </div>
      </div>

      <!-- Success State (shown briefly before redirect) -->
      <div v-else class="space-y-6">
        <div class="flex justify-center">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
          <p class="text-gray-600">You're all set. Redirecting to your dashboard...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()
const router = useRouter()

const isLoading = ref(true)
const hasError = ref(false)

onMounted(async () => {
  // The Supabase client picks up #access_token from the URL hash and fires
  // SIGNED_IN asynchronously. We listen for that event rather than using a
  // fixed delay, which was a race condition.
  let settled = false

  await new Promise<void>((resolve) => {
    // 1. Check if the session is already available (e.g. returning user)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !settled) {
        settled = true
        resolve()
      }
    })

    // 2. Listen for the SIGNED_IN event fired when the hash is processed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !settled) {
        settled = true
        subscription.unsubscribe()
        resolve()
      }
    })

    // 3. Give up after 6 seconds and show the error state
    setTimeout(() => {
      if (!settled) {
        settled = true
        subscription.unsubscribe()
        resolve()
      }
    }, 6000)
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await router.push('/dashboard')
  } else {
    hasError.value = true
    isLoading.value = false
  }
})
</script>
