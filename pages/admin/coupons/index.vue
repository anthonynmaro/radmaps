<template>
  <AdminShell title="Coupons">
    <section class="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form class="rounded-xl border border-stone-200 bg-white p-5 space-y-4" @submit.prevent="createCoupon">
        <div>
          <p class="text-sm font-semibold text-stone-900">Create a coupon</p>
          <p class="text-xs text-stone-500 mt-1">Codes apply across custom, shop, and digital checkout.</p>
        </div>

        <label class="block">
          <span class="admin-label">Slug</span>
          <input v-model="form.slug" required class="admin-input font-mono uppercase" placeholder="TRAIL-25" />
        </label>

        <label class="block">
          <span class="admin-label">Percent off</span>
          <input v-model.number="form.percent_off" required type="number" min="1" max="100" step="0.01" class="admin-input" />
        </label>

        <div>
          <span class="admin-label">Expiration</span>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="seg-button" :class="expiryMode === 'never' && 'seg-active'" @click="expiryMode = 'never'">Never</button>
            <button type="button" class="seg-button" :class="expiryMode === 'date' && 'seg-active'" @click="expiryMode = 'date'">Date</button>
          </div>
          <input v-if="expiryMode === 'date'" v-model="form.expires_at" type="datetime-local" class="admin-input mt-2" />
        </div>

        <div>
          <span class="admin-label">Use limit</span>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="seg-button" :class="limitMode === 'none' && 'seg-active'" @click="limitMode = 'none'">No limit</button>
            <button type="button" class="seg-button" :class="limitMode === 'limited' && 'seg-active'" @click="limitMode = 'limited'">Limited</button>
          </div>
          <input v-if="limitMode === 'limited'" v-model.number="form.max_redemptions" type="number" min="1" step="1" class="admin-input mt-2" placeholder="50" />
        </div>

        <label class="block">
          <span class="admin-label">Email restriction</span>
          <input v-model="form.email" type="email" class="admin-input" placeholder="Optional" />
        </label>

        <button class="admin-button" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create coupon' }}
        </button>
        <p v-if="message" class="text-xs" :class="messageType === 'error' ? 'text-red-600' : 'text-green-700'">{{ message }}</p>
      </form>

      <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div class="p-4 border-b border-stone-200 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm font-semibold text-stone-900">Active and historic coupons</p>
          <button class="admin-secondary" @click="refreshCoupons">Refresh</button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-stone-50 text-left text-[11px] uppercase tracking-[0.14em] text-stone-500">
              <tr>
                <th class="px-4 py-3">Code</th>
                <th class="px-4 py-3">Discount</th>
                <th class="px-4 py-3">Expiry</th>
                <th class="px-4 py-3">Email</th>
                <th class="px-4 py-3">Uses</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              <tr v-for="coupon in coupons" :key="coupon.id">
                <td class="px-4 py-3 font-mono font-semibold text-stone-900">{{ coupon.slug }}</td>
                <td class="px-4 py-3 text-stone-700">{{ coupon.percent_off }}%</td>
                <td class="px-4 py-3 text-stone-600">{{ coupon.expires_at ? formatDate(coupon.expires_at) : 'Never' }}</td>
                <td class="px-4 py-3 text-stone-600">{{ coupon.email || 'Anyone' }}</td>
                <td class="px-4 py-3 text-stone-600">
                  {{ coupon.redeemed_count }}<span v-if="coupon.reserved_count"> + {{ coupon.reserved_count }} held</span>
                  <span v-if="coupon.max_redemptions"> / {{ coupon.max_redemptions }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="coupon.active ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500'">
                    {{ coupon.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button class="admin-secondary" @click="copyCoupon(coupon.slug)">Copy</button>
                    <button class="admin-secondary" @click="toggleCoupon(coupon)">
                      {{ coupon.active ? 'Deactivate' : 'Reactivate' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="coupons.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-stone-500">No coupons yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AdminShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { normalizeCouponSlug } from '~/utils/coupons'

definePageMeta({ layout: 'default', middleware: 'auth' })

interface AdminCoupon {
  id: string
  slug: string
  percent_off: number
  expires_at: string | null
  max_redemptions: number | null
  email: string | null
  active: boolean
  redeemed_count: number
  reserved_count: number
}

const { data: coupons, refresh } = await useFetch<AdminCoupon[]>('/api/admin/coupons', {
  default: () => [],
})

async function refreshCoupons() {
  await refresh()
}

const expiryMode = ref<'never' | 'date'>('never')
const limitMode = ref<'none' | 'limited'>('none')
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const form = ref({
  slug: '',
  percent_off: 20,
  expires_at: '',
  max_redemptions: 1,
  email: '',
})

function toIsoDateTime(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function createCoupon() {
  saving.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/coupons', {
      method: 'POST',
      body: {
        slug: normalizeCouponSlug(form.value.slug),
        percent_off: form.value.percent_off,
        expires_at: expiryMode.value === 'date' ? toIsoDateTime(form.value.expires_at) : null,
        max_redemptions: limitMode.value === 'limited' ? form.value.max_redemptions : null,
        email: form.value.email.trim() || null,
      },
    })
    message.value = 'Coupon created.'
    messageType.value = 'success'
    form.value.slug = ''
    form.value.email = ''
    await refresh()
  } catch (err: any) {
    message.value = err?.data?.message || err?.message || 'Could not create coupon.'
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

async function toggleCoupon(coupon: AdminCoupon) {
  await $fetch(`/api/admin/coupons/${coupon.id}`, {
    method: 'PATCH',
    body: { active: !coupon.active },
  })
  await refresh()
}

async function copyCoupon(slug: string) {
  await navigator.clipboard?.writeText(slug)
}
</script>

<style scoped>
.admin-label { display:block; margin-bottom:0.375rem; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgb(120 113 108); }
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-button { width:100%; border-radius:999px; background:rgb(28 25 23); color:white; padding:0.8rem 1rem; font-size:0.875rem; font-weight:700; }
.admin-button:disabled { opacity:0.55; }
.admin-secondary { border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.55rem 0.75rem; font-size:0.75rem; font-weight:700; white-space:nowrap; }
.seg-button { border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.8rem; font-weight:700; color:rgb(87 83 78); }
.seg-active { border-color:rgb(45 106 79); background:rgba(45,106,79,0.08); color:rgb(45 106 79); }
</style>
