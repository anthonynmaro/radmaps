<template>
  <div class="min-h-[100dvh] bg-[#FAF8F4]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F]">RadMaps Admin</p>
          <h1 class="text-2xl font-semibold text-stone-900 mt-1" style="font-family:'Space Grotesk',sans-serif">
            {{ title }}
          </h1>
        </div>
        <div v-if="staff" class="text-xs text-stone-500">
          {{ staff.email }} · <span class="font-semibold text-stone-800">{{ staff.role }}</span>
        </div>
      </div>

      <nav class="flex flex-wrap gap-2 mb-6">
        <NuxtLink
          v-for="item in visibleItems"
          :key="item.to"
          :to="item.to"
          class="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors"
          :class="route.path === item.to ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900'"
        >
          <UIcon :name="item.icon" class="w-4 h-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div v-if="pending" class="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Loading admin access…
      </div>
      <div v-else-if="!staff" class="rounded-xl border border-red-200 bg-red-50 p-6">
        <p class="text-sm font-semibold text-red-800">Admin access required</p>
        <p class="text-sm text-red-700 mt-1">Sign in with a staff account to use this section.</p>
      </div>
      <slot v-else :staff="staff" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { roleCan } from '~/utils/adminPermissions'

defineProps<{
  title: string
}>()

const route = useRoute()

// Use the shared admin/me cache — populated once per user session. Admin tab
// navigation reuses the cached row instead of blocking on a fresh
// `/api/admin/me` fetch every time the user clicks a tab.
const { staff, pending, ensureLoaded } = useAdminMe()

// SSR: await the lookup once so the rendered HTML already has the staff row
// (and the correct nav items) baked in. Client-side navigation between admin
// tabs hits the cache and resolves synchronously without blocking the render.
if (import.meta.server) {
  await ensureLoaded()
} else {
  // Initial client mount or deep-link refresh: kick off the fetch without
  // awaiting so the shell renders immediately with a small "Loading…" state
  // while the row streams in.
  ensureLoaded()
}

const navItems = [
  { to: '/admin/premade', label: 'Premade', icon: 'i-heroicons-map', action: 'premade:edit' as const },
  { to: '/admin/coupons', label: 'Coupons', icon: 'i-heroicons-ticket', action: 'coupon:manage' as const },
  { to: '/admin/homepage', label: 'Homepage', icon: 'i-heroicons-star', action: 'homepage:manage' as const },
  { to: '/admin/map-tools', label: 'Map Tools', icon: 'i-heroicons-squares-2x2', action: 'map-tools:read' as const },
  { to: '/admin/staff', label: 'Staff', icon: 'i-heroicons-users', action: 'staff:manage' as const },
  { to: '/admin/flags', label: 'Flags', icon: 'i-heroicons-adjustments-horizontal', action: 'flags:manage' as const },
  { to: '/admin/support', label: 'Support', icon: 'i-heroicons-lifebuoy', action: 'support:read' as const },
]

const visibleItems = computed(() =>
  navItems.filter((item) => staff.value && roleCan(staff.value.role, item.action))
)
</script>
