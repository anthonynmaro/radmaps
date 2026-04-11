<template>
  <div class="min-h-screen bg-white flex flex-col">
    <nav class="border-b border-stone-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5 group">
          <svg class="w-7 h-7 text-[#2D6A4F]" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.7" fill="none" opacity="0.35"/>
            <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
          </svg>
          <span class="text-[15px] font-bold tracking-tight text-stone-900 group-hover:text-[#2D6A4F] transition-colors" style="font-family:'Space Grotesk',sans-serif">
            Rad Maps
          </span>
        </NuxtLink>

        <div v-if="user" class="hidden md:flex items-center gap-6">
          <NuxtLink to="/dashboard" class="text-sm font-medium text-stone-600 hover:text-[#2D6A4F] transition-colors">My Maps</NuxtLink>
          <NuxtLink to="/create" class="text-sm font-medium text-stone-600 hover:text-[#2D6A4F] transition-colors">Create</NuxtLink>
        </div>

        <div class="flex items-center gap-3">
          <template v-if="user">
            <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end' }">
              <button class="flex items-center gap-2 text-sm font-medium text-stone-700 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                <div class="w-6 h-6 rounded-full bg-[#2D6A4F] flex items-center justify-center">
                  <span class="text-[10px] font-bold text-white">{{ userInitial }}</span>
                </div>
                <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 text-stone-400" />
              </button>
            </UDropdown>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login" class="text-sm font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 transition-colors">Log in</NuxtLink>
            <NuxtLink to="/create">
              <button class="text-sm font-semibold bg-[#2D6A4F] hover:bg-[#235840] text-white px-4 py-1.5 rounded-lg transition-colors">
                Get started
              </button>
            </NuxtLink>
          </template>
        </div>
      </div>
    </nav>

    <main class="flex-1"><slot /></main>
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const userInitial = computed(() => (user.value?.email ?? 'U').charAt(0).toUpperCase())
const userMenuItems = computed(() => [[
  { label: user.value?.email ?? '', disabled: true },
], [
  { label: 'My Maps', icon: 'i-heroicons-map', to: '/dashboard' },
  { label: 'Create new map', icon: 'i-heroicons-plus', to: '/create' },
], [
  { label: 'Sign out', icon: 'i-heroicons-arrow-right-on-rectangle',
    click: async () => { await supabase.auth.signOut(); await navigateTo('/') } },
]])
</script>
