<template>
  <div class="min-h-screen bg-white flex flex-col">
    <!-- Top Navigation -->
    <nav class="border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2">
            <div class="w-8 h-8 bg-[#2D6A4F] rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
            </div>
            <span class="text-xl font-bold text-gray-900">TrailMaps</span>
          </NuxtLink>

          <!-- Center Nav Links (logged in users) -->
          <div v-if="user" class="hidden md:flex items-center gap-8">
            <NuxtLink to="/dashboard" class="text-gray-700 hover:text-[#2D6A4F] font-medium transition-colors">
              Dashboard
            </NuxtLink>
            <NuxtLink to="/how-it-works" class="text-gray-700 hover:text-[#2D6A4F] font-medium transition-colors">
              How it Works
            </NuxtLink>
          </div>

          <!-- Right Side Auth/User Menu -->
          <div class="flex items-center gap-4">
            <template v-if="user">
              <!-- User Menu Dropdown -->
              <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end' }">
                <UButton color="gray" variant="ghost" icon="i-heroicons-ellipsis-vertical-20-solid" />
              </UDropdown>
            </template>
            <template v-else>
              <NuxtLink to="/auth/login">
                <UButton color="gray" variant="ghost">
                  Log in
                </UButton>
              </NuxtLink>
              <NuxtLink to="/auth/login">
                <UButton color="green" class="bg-[#2D6A4F] hover:bg-[#1b4332]">
                  Get started
                </UButton>
              </NuxtLink>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const client = useSupabaseClient()

const userMenuItems = computed(() => [
  [{
    label: 'Dashboard',
    icon: 'i-heroicons-squares-2x2-20-solid',
    to: '/dashboard'
  }],
  [{
    label: 'Sign out',
    icon: 'i-heroicons-arrow-left-on-rectangle-20-solid',
    click: async () => {
      await client.auth.signOut()
      await navigateTo('/')
    }
  }]
])
</script>
