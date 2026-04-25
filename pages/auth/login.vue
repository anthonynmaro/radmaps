<template>
  <div class="min-h-screen flex bg-[#FAF8F4]">

    <!-- ════════════════════════════════════════════════════════════
         LEFT — Three.js terrain scene + brand
         ════════════════════════════════════════════════════════════ -->
    <div class="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0A1812]">

      <!-- Subtle gradient floor -->
      <div class="absolute inset-0 pointer-events-none"
        style="background:radial-gradient(ellipse at 60% 30%, #14342A 0%, #0A1812 70%);" />

      <!-- WebGL canvas -->
      <ClientOnly>
        <canvas ref="canvasEl" class="absolute inset-0 w-full h-full" />
      </ClientOnly>

      <!-- Vignette / fade-out at bottom for legibility -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#0A1812] via-transparent to-transparent pointer-events-none" />

      <!-- Faint grid overlay for that surveyor feel -->
      <div class="absolute inset-0 opacity-[0.04] pointer-events-none"
        style="background-image:linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px); background-size: 40px 40px;" />

      <!-- Top-left brand mark -->
      <NuxtLink to="/" class="absolute top-8 left-8 z-10 flex items-center gap-2.5 group">
        <svg class="w-7 h-7 text-[#52B788] transition-transform duration-300 group-hover:-rotate-3" viewBox="0 0 32 32" fill="none">
          <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.18"/>
          <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
          <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.55"/>
          <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
        </svg>
        <span class="text-[15px] font-bold tracking-tight text-white" style="font-family:'Space Grotesk',sans-serif">Rad Maps</span>
        <span class="text-[10px] font-semibold tracking-[0.18em] uppercase text-white/40 border border-white/15 rounded-full px-1.5 py-px">Studio</span>
      </NuxtLink>

      <!-- Bottom-left editorial copy -->
      <div class="absolute bottom-12 left-12 right-12 z-10 max-w-md">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#52B788]">
            Trail Posters · Printed &amp; Framed
          </span>
          <span class="h-px flex-1 w-12 bg-[#52B788]/40" />
        </div>
        <h1
          class="text-4xl xl:text-5xl text-white leading-[1.05] mb-4 tracking-tight"
          style="font-family:'Playfair Display',serif"
        >
          Some trails get the <em class="not-italic text-[#52B788]">wall.</em>
        </h1>
        <p class="text-white/55 text-[15px] leading-relaxed">
          Sign in to design a poster from your own route — or browse a
          curated collection of the world's greatest trails.
        </p>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         RIGHT — Sign in / sign up form
         ════════════════════════════════════════════════════════════ -->
    <div class="w-full lg:w-[45%] flex flex-col items-center justify-center px-6 py-12 sm:px-12 bg-[#FAF8F4]">
      <div class="w-full max-w-sm">

        <!-- Logo (mobile only — desktop has the left panel) -->
        <NuxtLink to="/" class="lg:hidden mb-10 flex items-center gap-2.5">
          <svg class="w-7 h-7 text-[#2D6A4F]" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.14"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
            <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
          </svg>
          <span class="text-[15px] font-bold tracking-tight text-stone-900" style="font-family:'Space Grotesk',sans-serif">Rad Maps</span>
        </NuxtLink>

        <!-- Eyebrow -->
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F]">
            {{ isSignup ? 'Create account' : 'Sign in' }}
          </span>
          <span class="h-px flex-1 w-12 bg-stone-300/70" />
        </div>

        <h2
          class="text-[36px] tracking-tight text-stone-900 leading-[1.05] mb-2"
          style="font-family:'Playfair Display',serif"
        >
          {{ heading }}
        </h2>
        <p class="text-sm text-stone-500 mb-8 leading-relaxed">
          {{ subhead }}
        </p>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-3">
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            :disabled="isLoading"
            class="w-full rounded-full border border-stone-200 bg-white px-5 py-3.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 disabled:opacity-60 transition-shadow"
          />

          <button
            type="submit"
            :disabled="isLoading || isGoogleLoading"
            class="w-full inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold text-sm py-3.5 rounded-full transition-colors shadow-sm shadow-stone-900/10"
          >
            <svg v-if="isLoading" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
            </svg>
            {{ isLoading ? 'Sending magic link…' : 'Send magic link' }}
          </button>
        </form>

        <!-- Success / error -->
        <Transition name="fade">
          <div v-if="showSuccessMessage"
            class="mt-4 flex gap-3 p-4 rounded-2xl bg-[#2D6A4F]/5 border border-[#2D6A4F]/15">
            <svg class="w-5 h-5 text-[#2D6A4F] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-stone-900">Check your inbox</p>
              <p class="text-xs text-stone-600 mt-0.5 leading-relaxed">
                We've sent a magic link to your email. Click it to {{ isSignup ? 'finish creating your account' : 'sign in' }} — no password needed.
              </p>
            </div>
          </div>
        </Transition>
        <Transition name="fade">
          <div v-if="showErrorMessage"
            class="mt-4 flex gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <p class="text-sm text-red-800">{{ errorMessage }}</p>
          </div>
        </Transition>

        <!-- Divider -->
        <div class="relative my-7">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-stone-200" />
          </div>
          <div class="relative flex justify-center text-[11px]">
            <span class="px-3 bg-[#FAF8F4] tracking-[0.18em] uppercase font-semibold text-stone-400">
              or continue with
            </span>
          </div>
        </div>

        <!-- Google (uniform pill) -->
        <button
          type="button"
          @click="handleGoogleLogin"
          :disabled="isGoogleLoading || isLoading"
          class="w-full inline-flex items-center justify-center gap-2.5 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 text-stone-800 font-semibold text-sm py-3.5 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-2"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span v-if="!isGoogleLoading">Continue with Google</span>
          <span v-else>Redirecting…</span>
        </button>

        <!-- Strava (uniform pill, same shape) -->
        <a
          href="/api/strava/connect"
          class="w-full inline-flex items-center justify-center gap-2.5 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 text-stone-800 font-semibold text-sm py-3.5 rounded-full transition-colors"
        >
          <svg class="w-4 h-4 shrink-0 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5 13.828h4.172"/>
          </svg>
          Continue with Strava
        </a>

        <!-- Mode switcher -->
        <div class="text-center mt-8">
          <p class="text-sm text-stone-500">
            {{ isSignup ? 'Already have an account?' : 'New to RadMaps?' }}
            <NuxtLink
              :to="isSignup ? '/auth/login' : '/auth/login?mode=signup'"
              class="font-semibold text-[#2D6A4F] hover:text-[#1E5238] hover:underline ml-1"
            >
              {{ isSignup ? 'Sign in' : 'Create one free' }}
            </NuxtLink>
          </p>
        </div>

        <!-- Tiny legal -->
        <p class="text-[10px] text-stone-400 mt-10 text-center leading-relaxed">
          By continuing, you agree to our
          <NuxtLink to="/terms" class="underline hover:text-stone-600">Terms</NuxtLink>
          and
          <NuxtLink to="/privacy" class="underline hover:text-stone-600">Privacy Policy</NuxtLink>.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

definePageMeta({ layout: false })

useSeo({
  title: 'Sign in or create an account',
  description: 'Sign in to RadMaps Studio with a magic link, Google, or Strava — and design custom trail posters from your routes.',
  path: '/auth/login',
  // Auth pages should not be indexed.
  noindex: true,
})

const route = useRoute()
const client = useSupabaseClient()

// ── Mode (sign in vs sign up) ────────────────────────────────────────
const isSignup = computed(() => route.query.mode === 'signup')
const heading = computed(() => isSignup.value ? 'Welcome to RadMaps.' : 'Welcome back.')
const subhead = computed(() =>
  isSignup.value
    ? "Enter your email — we'll send a magic link to set up your account in seconds."
    : "Enter your email — we'll send a magic link, no password needed."
)

// ── Form state ────────────────────────────────────────────────────────
const email = ref('')
const isLoading = ref(false)
const isGoogleLoading = ref(false)
const showSuccessMessage = ref(false)
const showErrorMessage = ref(false)
const errorMessage = ref('')
const toast = useToast()

const handleGoogleLogin = async () => {
  isGoogleLoading.value = true
  showErrorMessage.value = false
  errorMessage.value = ''
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) {
      errorMessage.value = error.message
      showErrorMessage.value = true
      isGoogleLoading.value = false
    }
  } catch {
    errorMessage.value = 'Could not start Google sign-in. Please try again.'
    showErrorMessage.value = true
    isGoogleLoading.value = false
  }
}

const handleLogin = async () => {
  if (!email.value) return
  isLoading.value = true
  showErrorMessage.value = false
  errorMessage.value = ''
  try {
    const { error } = await client.auth.signInWithOtp({
      email: email.value,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) {
      errorMessage.value = error.message
      showErrorMessage.value = true
      isLoading.value = false
      toast.add({
        title: 'Could not send link',
        description: error.message,
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
        timeout: 6000,
      })
      return
    }
    showSuccessMessage.value = true
    email.value = ''
    setTimeout(() => { showSuccessMessage.value = false }, 8000)
    toast.add({
      title: 'Magic link sent',
      description: 'Check your inbox — click the link to sign in.',
      icon: 'i-heroicons-envelope',
      color: 'green',
      timeout: 8000,
    })
  } catch {
    errorMessage.value = 'An unexpected error occurred. Please try again.'
    showErrorMessage.value = true
  } finally {
    isLoading.value = false
  }
}

// ════════════════════════════════════════════════════════════════════
// Three.js scene — wireframe topographic terrain with a glowing trail
// ════════════════════════════════════════════════════════════════════
const canvasEl = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null

function terrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.12) * Math.cos(z * 0.10) * 2.4 +
    Math.sin(x * 0.05 + z * 0.03) * 4.2 +
    Math.cos(x * 0.07 - z * 0.09) * 1.6
  )
}

function initThreeScene(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene()

  let w = canvas.clientWidth
  let h = canvas.clientHeight
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 1000)
  camera.position.set(40, 26, 40)
  camera.lookAt(0, -2, 0)

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // ── Terrain wireframe ──
  const SIZE = 80
  const SEGS = 80
  const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS)
  terrainGeo.rotateX(-Math.PI / 2)
  const positions = terrainGeo.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    positions.setY(i, terrainHeight(x, z))
  }
  positions.needsUpdate = true
  terrainGeo.computeVertexNormals()

  const terrainMat = new THREE.MeshBasicMaterial({
    color: 0x52B788,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
  })
  const terrain = new THREE.Mesh(terrainGeo, terrainMat)

  const group = new THREE.Group()
  group.add(terrain)

  // ── Trail line as a tube (so it's actually thick) ──
  const trailPoints: THREE.Vector3[] = []
  for (let t = 0; t <= 1; t += 0.003) {
    const x = -34 + t * 68
    const z = Math.sin(t * Math.PI * 3) * 16 + Math.cos(t * Math.PI * 1.4) * 7
    const y = terrainHeight(x, z) + 0.5
    trailPoints.push(new THREE.Vector3(x, y, z))
  }
  const trailCurve = new THREE.CatmullRomCurve3(trailPoints)
  const tubeGeo = new THREE.TubeGeometry(trailCurve, 600, 0.18, 6, false)
  const tubeMat = new THREE.MeshBasicMaterial({
    color: 0xFFB703,
    transparent: true,
    opacity: 0.9,
  })
  const tube = new THREE.Mesh(tubeGeo, tubeMat)
  group.add(tube)

  // ── Pulsing waypoint dot travelling along the trail ──
  const dotGeo = new THREE.SphereGeometry(0.55, 18, 18)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xFFE17A })
  const dot = new THREE.Mesh(dotGeo, dotMat)
  group.add(dot)

  const ringGeo = new THREE.RingGeometry(0.7, 1.3, 32)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xFFD96B,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  group.add(ring)

  // ── Background star particles for atmosphere ──
  const starGeo = new THREE.BufferGeometry()
  const STAR_COUNT = 280
  const starPositions = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    starPositions[i * 3 + 0] = (Math.random() - 0.5) * 220
    starPositions[i * 3 + 1] = Math.random() * 80 + 10
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 220
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0x88C9A8,
    size: 0.35,
    transparent: true,
    opacity: 0.55,
  })
  const stars = new THREE.Points(starGeo, starMat)
  scene.add(stars)
  scene.add(group)

  // ── Animation loop ──
  const clock = new THREE.Clock()
  let animId = 0
  function tick() {
    animId = requestAnimationFrame(tick)
    const t = clock.getElapsedTime()

    // Slow rotation
    group.rotation.y = t * 0.06

    // Move waypoint along trail
    const trailT = (t * 0.06) % 1
    const idx = Math.min(trailPoints.length - 1, Math.floor(trailT * trailPoints.length))
    const point = trailPoints[idx]
    dot.position.copy(point)
    ring.position.copy(point)

    // Make the ring face the camera (billboard)
    ring.lookAt(camera.position)
    const pulse = 1 + Math.sin(t * 3.5) * 0.35
    ring.scale.set(pulse, pulse, pulse)
    ringMat.opacity = 0.5 - Math.sin(t * 3.5) * 0.25

    // Subtle terrain breathing
    terrain.position.y = Math.sin(t * 0.4) * 0.4

    // Star drift
    stars.rotation.y = t * 0.005

    renderer.render(scene, camera)
  }
  tick()

  // ── Resize handler ──
  function onResize() {
    if (!canvas) return
    w = canvas.clientWidth
    h = canvas.clientHeight
    if (w === 0 || h === 0) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  window.addEventListener('resize', onResize)

  return () => {
    window.removeEventListener('resize', onResize)
    cancelAnimationFrame(animId)
    terrainGeo.dispose()
    terrainMat.dispose()
    tubeGeo.dispose()
    tubeMat.dispose()
    dotGeo.dispose()
    dotMat.dispose()
    ringGeo.dispose()
    ringMat.dispose()
    starGeo.dispose()
    starMat.dispose()
    renderer.dispose()
  }
}

onMounted(async () => {
  await nextTick()
  if (canvasEl.value) {
    cleanup = initThreeScene(canvasEl.value)
  }
})

onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})
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
</style>
