<template>
  <div class="min-h-screen flex">
    <!-- Left Panel: Brand & Topographic Design -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2D6A4F] to-[#1b4332] relative overflow-hidden flex-col items-center justify-center p-12">
      <!-- Decorative topographic lines -->
      <svg class="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="60" fill="none" stroke="white" stroke-width="2" />
        <circle cx="80" cy="80" r="50" fill="none" stroke="white" stroke-width="1.5" />
        <circle cx="80" cy="80" r="40" fill="none" stroke="white" stroke-width="1" />
        <circle cx="280" cy="120" r="70" fill="none" stroke="white" stroke-width="2" />
        <circle cx="280" cy="120" r="58" fill="none" stroke="white" stroke-width="1.5" />
        <circle cx="280" cy="120" r="46" fill="none" stroke="white" stroke-width="1" />
        <circle cx="120" cy="280" r="65" fill="none" stroke="white" stroke-width="2" />
        <circle cx="120" cy="280" r="53" fill="none" stroke="white" stroke-width="1.5" />
        <circle cx="120" cy="280" r="41" fill="none" stroke="white" stroke-width="1" />
        <path d="M 200 0 Q 250 100 200 200 T 200 400" fill="none" stroke="white" stroke-width="2" opacity="0.3" />
        <path d="M 0 100 Q 100 150 200 100 T 400 100" fill="none" stroke="white" stroke-width="1.5" opacity="0.2" />
      </svg>

      <!-- Brand Content -->
      <div class="relative z-10 text-center max-w-md">
        <div class="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-8">
          <svg class="w-10 h-10 text-[#2D6A4F]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </div>
        <h1 class="text-4xl font-bold text-white mb-4">RadMaps</h1>
        <p class="text-lg text-green-100">Turn your trails into art. Upload your favorite routes and get them printed on beautiful maps.</p>
      </div>
    </div>

    <!-- Right Panel: Login Form -->
    <div class="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 bg-white">
      <div class="w-full max-w-sm">
        <!-- Header -->
        <div class="mb-10">
          <h2 class="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p class="text-gray-600">Sign in to access your trail maps and orders.</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-6">
          <!-- Email Input -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <UInput
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              size="lg"
              class="w-full"
              :disabled="isLoading"
            />
          </div>

          <!-- Success Message -->
          <Transition name="fade">
            <UAlert
              v-if="showSuccessMessage"
              color="green"
              icon="i-heroicons-check-circle-20-solid"
              title="Check your email!"
              description="We've sent a magic link to your inbox. Click it to sign in."
              class="mb-6"
            />
          </Transition>

          <!-- Error Message -->
          <Transition name="fade">
            <UAlert
              v-if="showErrorMessage"
              color="red"
              icon="i-heroicons-exclamation-circle-20-solid"
              :title="`Error: ${errorMessage}`"
              class="mb-6"
            />
          </Transition>

          <!-- Submit Button -->
          <UButton
            type="submit"
            size="lg"
            color="green"
            block
            :loading="isLoading"
            class="bg-[#2D6A4F] hover:bg-[#1b4332]"
          >
            <template v-if="!isLoading">
              Send magic link
            </template>
            <template v-else>
              Sending...
            </template>
          </UButton>
        </form>

        <!-- Divider -->
        <div class="relative my-8">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-3 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <!-- Strava OAuth -->
        <a href="/api/strava/connect" class="strava-btn flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg font-semibold text-white transition-colors duration-150">
          <!-- Strava chevron logo mark -->
          <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5 13.828h4.172"/>
          </svg>
          Continue with Strava
        </a>

        <!-- Sign Up Link -->
        <div class="text-center mt-8">
          <p class="text-gray-600 text-sm">
            Don't have an account?
            <NuxtLink to="/auth/login" class="font-semibold text-[#2D6A4F] hover:underline">
              Get started
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const client = useSupabaseClient()
const router = useRouter()

const email = ref('')
const isLoading = ref(false)
const showSuccessMessage = ref(false)
const showErrorMessage = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!email.value) return

  isLoading.value = true
  showErrorMessage.value = false
  errorMessage.value = ''

  try {
    const { error } = await client.auth.signInWithOtp({
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`
      }
    })

    if (error) {
      errorMessage.value = error.message
      showErrorMessage.value = true
      isLoading.value = false
      return
    }

    showSuccessMessage.value = true
    email.value = ''

    // Optionally redirect after a delay
    setTimeout(() => {
      showSuccessMessage.value = false
    }, 5000)
  } catch (err) {
    errorMessage.value = 'An unexpected error occurred. Please try again.'
    showErrorMessage.value = true
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.strava-btn {
  background-color: #FC4C02;
}
.strava-btn:hover {
  background-color: #e04200;
}
</style>
