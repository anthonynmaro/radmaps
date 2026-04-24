<template>
  <div class="min-h-[100dvh] bg-[#FAF8F4] flex flex-col">

    <!-- ── Nav bar ──────────────────────────────────────────────────────────── -->
    <nav
      class="sticky top-0 z-30 transition-all duration-200"
      :class="scrolled
        ? 'bg-[#FAF8F4]/85 backdrop-blur-md border-b border-stone-200/80'
        : 'bg-[#FAF8F4] border-b border-transparent'"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-8">

        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2.5 shrink-0 group">
          <span class="relative">
            <svg class="w-7 h-7 text-[#2D6A4F] transition-transform duration-300 group-hover:-rotate-3" viewBox="0 0 32 32" fill="none">
              <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.14"/>
              <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
              <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/>
              <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.7" fill="none" opacity="0.35"/>
              <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
            </svg>
          </span>
          <span
            class="text-[16px] font-bold tracking-tight text-stone-900 group-hover:text-[#2D6A4F] transition-colors"
            style="font-family:'Space Grotesk',sans-serif"
          >Rad Maps</span>
          <span class="hidden sm:inline-block text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 border border-stone-300/70 rounded-full px-1.5 py-px ml-1">
            Studio
          </span>
        </NuxtLink>

        <!-- Desktop nav links -->
        <div v-if="user" class="hidden md:flex items-center gap-1 flex-1">
          <NavLink to="/shop" label="Shop Prints" />
          <NavLink to="/create" label="Create" />
          <NavLink to="/" label="My Maps" exact />
        </div>
        <div v-else class="hidden md:flex items-center gap-1 flex-1">
          <!-- Shop Prints is the only link guests can follow directly -->
          <NavLink to="/" label="Shop Prints" exact />

          <!-- Create → popover callout (sign in / create account) -->
          <UPopover
            :popper="{ placement: 'bottom-start', offsetDistance: 10 }"
            :ui="{
              background: 'bg-white',
              ring: 'ring-1 ring-stone-200',
              rounded: 'rounded-2xl',
              shadow: 'shadow-xl shadow-stone-900/10',
              base: 'overflow-hidden focus:outline-none relative',
              width: 'w-auto',
            }"
          >
            <button class="relative group px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5">
              Create
              <svg class="w-3 h-3 text-stone-300 group-hover:text-stone-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
              </svg>
            </button>
            <template #panel="{ close }">
              <GuestCallout
                eyebrow="Custom Maps"
                title="Make a poster from your own trail"
                body="Bring your route from Strava, your Garmin watch, or any tracking app — we'll turn it into a museum-quality print styled exactly how you want."
                :close="close"
              />
            </template>
          </UPopover>

          <!-- My Maps → popover callout -->
          <UPopover
            :popper="{ placement: 'bottom-start', offsetDistance: 10 }"
            :ui="{
              background: 'bg-white',
              ring: 'ring-1 ring-stone-200',
              rounded: 'rounded-2xl',
              shadow: 'shadow-xl shadow-stone-900/10',
              base: 'overflow-hidden focus:outline-none relative',
              width: 'w-auto',
            }"
          >
            <button class="relative group px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5">
              My Maps
              <svg class="w-3 h-3 text-stone-300 group-hover:text-stone-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
              </svg>
            </button>
            <template #panel="{ close }">
              <GuestCallout
                eyebrow="Your Studio"
                title="Sign in to see your maps"
                body="Your saved posters, drafts, and order history all live in one place. Create a free account to get started."
                :close="close"
              />
            </template>
          </UPopover>
        </div>

        <!-- Right: user menu or auth -->
        <div class="flex items-center gap-2 ml-auto">
          <template v-if="user">
            <NuxtLink to="/create" class="hidden md:inline-flex">
              <button class="group inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900 hover:text-white bg-transparent hover:bg-[#2D6A4F] border border-stone-300/80 hover:border-[#2D6A4F] px-3.5 py-2 rounded-full transition-all">
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
                New Map
              </button>
            </NuxtLink>

            <!-- Mobile: hamburger -->
            <button
              class="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-900/5 transition-colors"
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
            <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end', strategy: 'fixed' }" class="hidden md:block">
              <button class="flex items-center gap-2 pl-0.5 pr-2.5 py-0.5 rounded-full hover:bg-stone-900/5 transition-colors">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#2D6A4F] to-[#1E5238] flex items-center justify-center shrink-0 ring-1 ring-[#2D6A4F]/20">
                  <span class="text-[11px] font-bold text-white tracking-tight">{{ userInitial }}</span>
                </div>
                <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 text-stone-400"/>
              </button>
            </UDropdown>
          </template>

          <template v-else>
            <!-- Mobile: hamburger -->
            <button
              class="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-900/5 transition-colors"
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

            <!-- Desktop auth: Sign in + Create account -->
            <NuxtLink to="/auth/login"
              class="hidden md:inline-block text-sm font-medium text-stone-600 hover:text-stone-900 px-3 py-2 transition-colors">
              Sign in
            </NuxtLink>
            <NuxtLink to="/auth/login?mode=signup" class="hidden md:inline-block">
              <button class="text-sm font-semibold bg-[#2D6A4F] hover:bg-[#235840] text-white px-4 py-2 rounded-full transition-colors shadow-sm shadow-[#2D6A4F]/20">
                Create account
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
        <div v-if="mobileMenuOpen" class="md:hidden border-t border-stone-200 bg-[#FAF8F4] shadow-lg">
          <!-- Logged in -->
          <template v-if="user">
            <div class="px-4 py-3 space-y-1">
              <NuxtLink to="/shop" @click="mobileMenuOpen = false"
                class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-900/5 transition-colors">
                <UIcon name="i-heroicons-shopping-bag" class="w-4.5 h-4.5 text-stone-400"/>
                Shop Prints
              </NuxtLink>
              <NuxtLink to="/create" @click="mobileMenuOpen = false"
                class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-900/5 transition-colors">
                <UIcon name="i-heroicons-plus" class="w-4.5 h-4.5 text-stone-400"/>
                Create new map
              </NuxtLink>
              <NuxtLink to="/" @click="mobileMenuOpen = false"
                class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-900/5 transition-colors">
                <UIcon name="i-heroicons-squares-2x2" class="w-4.5 h-4.5 text-stone-400"/>
                My Maps
              </NuxtLink>
            </div>
            <div class="border-t border-stone-200/70 px-4 py-3">
              <div class="px-3 py-1 mb-2 flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-[#2D6A4F] to-[#1E5238] flex items-center justify-center shrink-0">
                  <span class="text-[10px] font-bold text-white">{{ userInitial }}</span>
                </div>
                <p class="text-xs text-stone-500 truncate">{{ user?.email }}</p>
              </div>
              <button
                @click="signOut"
                class="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4.5 h-4.5"/>
                Sign out
              </button>
            </div>
          </template>

          <!-- Guest -->
          <template v-else>
            <div class="px-4 py-3 space-y-1">
              <NuxtLink to="/" @click="mobileMenuOpen = false"
                class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-900/5 transition-colors">
                <UIcon name="i-heroicons-shopping-bag" class="w-4.5 h-4.5 text-stone-400"/>
                Shop Prints
              </NuxtLink>
              <NuxtLink to="/auth/login?mode=signup" @click="mobileMenuOpen = false"
                class="flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-900/5 transition-colors">
                <span class="flex items-center gap-3">
                  <UIcon name="i-heroicons-plus" class="w-4.5 h-4.5 text-stone-400"/>
                  Create
                </span>
                <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5 text-stone-300"/>
              </NuxtLink>
              <NuxtLink to="/auth/login" @click="mobileMenuOpen = false"
                class="flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-900/5 transition-colors">
                <span class="flex items-center gap-3">
                  <UIcon name="i-heroicons-squares-2x2" class="w-4.5 h-4.5 text-stone-400"/>
                  My Maps
                </span>
                <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5 text-stone-300"/>
              </NuxtLink>
            </div>
            <div class="border-t border-stone-200/70 px-4 py-3 space-y-2">
              <p class="px-3 text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-2">Join RadMaps</p>
              <NuxtLink to="/auth/login?mode=signup" @click="mobileMenuOpen = false"
                class="flex items-center justify-center w-full px-3 py-3 rounded-full text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] transition-colors">
                Create a free account
              </NuxtLink>
              <NuxtLink to="/auth/login" @click="mobileMenuOpen = false"
                class="flex items-center justify-center w-full px-3 py-3 rounded-full text-sm font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 transition-colors">
                Sign in
              </NuxtLink>
            </div>
          </template>
        </div>
      </Transition>
    </nav>

    <!-- ── Page content ──────────────────────────────────────────────────────── -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- ── Footer ────────────────────────────────────────────────────────────── -->
    <footer class="relative mt-20 border-t border-stone-200/80 bg-[#F4F0E8]">
      <!-- subtle paper texture -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply"
        style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
      />

      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div class="grid grid-cols-2 md:grid-cols-12 gap-8 md:gap-10">

          <!-- Brand -->
          <div class="col-span-2 md:col-span-5 max-w-sm">
            <NuxtLink to="/" class="flex items-center gap-2.5 mb-4 group">
              <svg class="w-7 h-7 text-[#2D6A4F] transition-transform duration-300 group-hover:-rotate-3" viewBox="0 0 32 32" fill="none">
                <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.14"/>
                <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
                <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/>
                <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
              </svg>
              <span class="text-[16px] font-bold tracking-tight text-stone-900" style="font-family:'Space Grotesk',sans-serif">
                Rad Maps
              </span>
              <span class="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 border border-stone-300/70 rounded-full px-1.5 py-px">
                Studio
              </span>
            </NuxtLink>
            <p class="text-sm text-stone-500 leading-relaxed mb-5">
              Trail posters, printed and framed. Iconic routes from the world's
              greatest hikes — or your own from Strava, your watch, or any trail app.
            </p>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium tracking-wide text-stone-500">
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-3 h-3 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Printed via Gelato
              </span>
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-3 h-3 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Ships to 32 countries
              </span>
            </div>
          </div>

          <!-- Spacer column on desktop -->
          <div class="hidden md:block md:col-span-1" />

          <!-- Shop -->
          <div class="col-span-1 md:col-span-2">
            <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-400 mb-4">Shop</p>
            <ul class="space-y-2.5">
              <li><NuxtLink to="/shop" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">All prints</NuxtLink></li>
              <li><NuxtLink to="/shop" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">National parks</NuxtLink></li>
              <li><NuxtLink to="/shop" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Marathons</NuxtLink></li>
              <li><NuxtLink to="/shop" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Long-distance</NuxtLink></li>
            </ul>
          </div>

          <!-- Studio -->
          <div class="col-span-1 md:col-span-2">
            <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-400 mb-4">Studio</p>
            <ul class="space-y-2.5">
              <li v-if="user"><NuxtLink to="/" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">My Maps</NuxtLink></li>
              <li><NuxtLink :to="user ? '/create' : '/auth/login?mode=signup'" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Create a map</NuxtLink></li>
              <li v-if="!user"><NuxtLink to="/auth/login?mode=signup" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Create account</NuxtLink></li>
              <li v-if="!user"><NuxtLink to="/auth/login" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Sign in</NuxtLink></li>
            </ul>
          </div>

          <!-- Help & Legal -->
          <div class="col-span-2 md:col-span-2">
            <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-400 mb-4">Company</p>
            <ul class="space-y-2.5">
              <li><NuxtLink to="/support" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Support</NuxtLink></li>
              <li><NuxtLink to="/terms" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Terms</NuxtLink></li>
              <li><NuxtLink to="/privacy" class="text-sm text-stone-700 hover:text-[#2D6A4F] transition-colors">Privacy</NuxtLink></li>
            </ul>
          </div>
        </div>

        <!-- Bottom strip -->
        <div class="mt-12 pt-6 border-t border-stone-300/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-[11px] text-stone-400 tracking-wide">
            © {{ new Date().getFullYear() }} Rad Maps Studio. All rights reserved.
          </p>
          <p class="text-[11px] text-stone-400 tracking-wide italic"
            style="font-family:'Playfair Display',serif">
            Made for the long walk.
          </p>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { h, defineComponent, computed, ref, onMounted, onBeforeUnmount, watch, resolveComponent } from 'vue'

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const mobileMenuOpen = ref(false)
const userInitial = computed(() => (user.value?.email ?? 'U').charAt(0).toUpperCase())
const scrolled = ref(false)

// Close mobile menu on route change
const route = useRoute()
watch(() => route.path, () => { mobileMenuOpen.value = false })

function onScroll() {
  scrolled.value = window.scrollY > 4
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

async function signOut() {
  mobileMenuOpen.value = false
  await supabase.auth.signOut()
  await navigateTo('/')
}

const userMenuItems = computed(() => [[
  { label: user.value?.email ?? '', disabled: true },
], [
  { label: 'Shop Prints', icon: 'i-heroicons-shopping-bag', to: '/shop' },
  { label: 'Create new map', icon: 'i-heroicons-plus', to: '/create' },
  { label: 'My Maps', icon: 'i-heroicons-squares-2x2', to: '/' },
], [
  { label: 'Sign out', icon: 'i-heroicons-arrow-right-on-rectangle', click: signOut },
]])

// ── Guest callout popover content ──────────────────────────────────────────
const GuestCallout = defineComponent({
  props: {
    eyebrow: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    close: { type: Function, required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: 'p-5 w-[300px] bg-white rounded-2xl' }, [
        h('div', { class: 'flex items-center gap-2 mb-3' }, [
          h('span', { class: 'w-8 h-8 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center shrink-0' }, [
            h('svg', { class: 'w-4 h-4 text-[#2D6A4F]', viewBox: '0 0 20 20', fill: 'currentColor' }, [
              h('path', {
                'fill-rule': 'evenodd',
                'clip-rule': 'evenodd',
                d: 'M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z',
              }),
            ]),
          ]),
          h('span', { class: 'text-[10px] font-semibold tracking-[0.18em] uppercase text-[#2D6A4F]' }, props.eyebrow),
        ]),
        h('p', {
          class: 'text-[15px] font-semibold text-stone-900 mb-1.5 leading-snug',
          style: "font-family:'Space Grotesk',sans-serif",
        }, props.title),
        h('p', { class: 'text-[13px] text-stone-600 leading-relaxed mb-5' }, props.body),
        h('div', { class: 'flex flex-col gap-2' }, [
          h(
            resolveComponent('NuxtLink'),
            {
              to: '/auth/login?mode=signup',
              onClick: () => props.close(),
              class: 'inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] px-4 py-2.5 rounded-full transition-colors',
            },
            () => 'Create an account',
          ),
          h(
            resolveComponent('NuxtLink'),
            {
              to: '/auth/login',
              onClick: () => props.close(),
              class: 'inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-full transition-colors',
            },
            () => 'Sign in',
          ),
        ]),
      ])
  },
})

// ── Animated underline nav link ────────────────────────────────────────────
const NavLink = defineComponent({
  props: {
    to: { type: String, required: true },
    label: { type: String, required: true },
    exact: { type: Boolean, default: false },
  },
  setup(props) {
    const route = useRoute()
    const isActive = computed(() =>
      props.exact ? route.path === props.to : route.path.startsWith(props.to) && props.to !== '/'
    )
    return () =>
      h(
        resolveComponent('NuxtLink'),
        { to: props.to, class: 'relative group px-3 py-1.5 text-sm font-medium transition-colors',
          style: '' },
        {
          default: () => [
            h('span', {
              class: isActive.value
                ? 'text-stone-900'
                : 'text-stone-500 group-hover:text-stone-900 transition-colors',
            }, props.label),
            h('span', {
              class: [
                'absolute left-3 right-3 -bottom-px h-px bg-[#2D6A4F] origin-left transition-transform duration-300 ease-out',
                isActive.value ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
              ],
            }),
          ],
        }
      )
  },
})
</script>
