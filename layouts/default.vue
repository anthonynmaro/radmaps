<template>
  <div class="min-h-[100dvh] bg-white flex flex-col">

    <!-- ── Nav bar ──────────────────────────────────────────────────────────── -->
    <nav class="border-b border-stone-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2 shrink-0 group">
          <svg class="w-6 h-6 text-[#2D6A4F]" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.7" fill="none" opacity="0.35"/>
            <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
          </svg>
          <span class="text-[15px] font-bold tracking-tight text-stone-900 group-hover:text-[#2D6A4F] transition-colors"
            style="font-family:'Space Grotesk',sans-serif">Rad Maps</span>
        </NuxtLink>

        <!-- Desktop nav links -->
        <div v-if="user" class="hidden md:flex items-center gap-6 flex-1">
          <NuxtLink to="/dashboard"
            class="text-sm font-medium text-stone-500 hover:text-[#2D6A4F] transition-colors">My Maps</NuxtLink>
          <NuxtLink to="/create"
            class="text-sm font-medium text-stone-500 hover:text-[#2D6A4F] transition-colors">Create</NuxtLink>
        </div>

        <!-- Right: user menu or auth -->
        <div class="flex items-center gap-2">
          <template v-if="user">
            <!-- Mobile: hamburger -->
            <button
              class="md:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
              @click="mobileMenuOpen = !mobileMenuOpen"
              aria-label="Menu"
            >
              <svg v-if="!mobileMenuOpen" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
              </svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>

            <!-- Desktop: user dropdown -->
            <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end' }" class="hidden md:block">
              <button class="flex items-center gap-2 text-sm font-medium text-stone-700 px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                <div class="w-6 h-6 rounded-full bg-[#2D6A4F] flex items-center justify-center shrink-0">
                  <span class="text-[10px] font-bold text-white">{{ userInitial }}</span>
                </div>
                <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 text-stone-400"/>
              </button>
            </UDropdown>
          </template>

          <template v-else>
            <NuxtLink to="/auth/login"
              class="text-sm font-medium text-stone-600 hover:text-stone-900 px-3 py-2 transition-colors">
              Log in
            </NuxtLink>
            <NuxtLink to="/create">
              <button class="text-sm font-semibold bg-[#2D6A4F] hover:bg-[#235840] text-white px-4 py-2 rounded-lg transition-colors">
                Get started
              </button>
            </NuxtLink>
          </template>
        </div>
      </div>

      <!-- Mobile menu dropdown -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="mobileMenuOpen && user" class="md:hidden border-t border-stone-100 bg-white shadow-lg">
          <div class="px-4 py-3 space-y-1">
            <NuxtLink to="/dashboard" @click="mobileMenuOpen = false"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              <UIcon name="i-heroicons-map" class="w-4.5 h-4.5 text-stone-400"/>
              My Maps
            </NuxtLink>
            <NuxtLink to="/create" @click="mobileMenuOpen = false"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              <UIcon name="i-heroicons-plus" class="w-4.5 h-4.5 text-stone-400"/>
              Create new map
            </NuxtLink>
          </div>
          <div class="border-t border-stone-100 px-4 py-3">
            <div class="px-3 py-1 mb-2">
              <p class="text-xs text-stone-400 truncate">{{ user?.email }}</p>
            </div>
            <button
              @click="signOut"
              class="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4.5 h-4.5"/>
              Sign out
            </button>
          </div>
        </div>
      </Transition>
    </nav>

    <!-- ── Page content ──────────────────────────────────────────────────────── -->
    <main class="flex-1">
      <slot />
    </main>

  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const mobileMenuOpen = ref(false)
const userInitial = computed(() => (user.value?.email ?? 'U').charAt(0).toUpperCase())

// Close mobile menu on route change
const route = useRoute()
watch(() => route.path, () => { mobileMenuOpen.value = false })

async function signOut() {
  mobileMenuOpen.value = false
  await supabase.auth.signOut()
  await navigateTo('/')
}

const userMenuItems = computed(() => [[
  { label: user.value?.email ?? '', disabled: true },
], [
  { label: 'My Maps', icon: 'i-heroicons-map', to: '/dashboard' },
  { label: 'Create new map', icon: 'i-heroicons-plus', to: '/create' },
], [
  { label: 'Sign out', icon: 'i-heroicons-arrow-right-on-rectangle', click: signOut },
]])
</script>
