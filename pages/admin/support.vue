<template>
  <AdminShell title="Support Lookup">
    <div class="space-y-6">
      <form class="rounded-xl border border-stone-200 bg-white p-5 flex gap-3" @submit.prevent="searchNow">
        <input v-model="q" class="admin-input" placeholder="Search email, order ID, premade slug, or title" />
        <button class="admin-button">Search</button>
      </form>

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div class="admin-header">Users</div>
          <div class="divide-y divide-stone-100">
            <div v-for="profile in results.profiles" :key="profile.id" class="p-4">
              <p class="text-sm font-semibold text-stone-900">{{ profile.email }}</p>
              <p class="text-xs text-stone-500">{{ profile.full_name || 'No name' }} · {{ profile.id }}</p>
            </div>
            <div v-if="results.profiles.length === 0" class="p-6 text-sm text-stone-500">No users.</div>
          </div>
        </div>

        <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div class="admin-header">Orders</div>
          <div class="divide-y divide-stone-100">
            <div v-for="order in results.orders" :key="order.id" class="p-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-stone-900">{{ order.premade_title || order.id }}</p>
                <span class="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600">{{ order.status }}</span>
              </div>
              <p class="text-xs text-stone-500 mt-1">{{ order.guest_email || order.user_id }} · {{ order.print_size }}</p>
              <p class="text-xs text-stone-400 mt-1 font-mono">{{ order.id }}</p>
            </div>
            <div v-if="results.orders.length === 0" class="p-6 text-sm text-stone-500">No orders.</div>
          </div>
        </div>
      </section>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ layout: 'default', middleware: 'auth' })

const q = ref('')
const { data: results, refresh } = await useFetch<{
  profiles: Array<{ id: string; email: string; full_name?: string | null }>
  orders: Array<{ id: string; user_id?: string | null; guest_email?: string | null; premade_title?: string | null; status: string; print_size: string }>
}>('/api/admin/support', {
  query: { q },
  default: () => ({ profiles: [], orders: [] }),
  immediate: false,
})

async function searchNow() {
  await refresh()
}
</script>

<style scoped>
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-button { border-radius:999px; background:rgb(28 25 23); color:white; padding:0.75rem 1.2rem; font-size:0.8rem; font-weight:700; }
.admin-header { border-bottom:1px solid rgb(231 229 228); padding:0.9rem 1rem; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.14em; color:rgb(120 113 108); }
</style>
