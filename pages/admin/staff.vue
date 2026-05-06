<template>
  <AdminShell title="Staff Roles">
    <section class="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form class="rounded-xl border border-stone-200 bg-white p-5 space-y-4" @submit.prevent="assignRole">
        <div>
          <p class="text-sm font-semibold text-stone-900">Assign a role</p>
          <p class="text-xs text-stone-500 mt-1">Users must already have a RadMaps account.</p>
        </div>
        <label class="block">
          <span class="admin-label">Email</span>
          <input v-model="newEmail" type="email" required class="admin-input" placeholder="teammate@example.com" />
        </label>
        <label class="block">
          <span class="admin-label">Role</span>
          <select v-model="newRole" class="admin-input">
            <option v-for="role in ADMIN_ROLES" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
        <button class="admin-button" :disabled="saving">
          {{ saving ? 'Saving…' : 'Assign role' }}
        </button>
        <p v-if="message" class="text-xs" :class="messageType === 'error' ? 'text-red-600' : 'text-green-700'">{{ message }}</p>
      </form>

      <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div class="p-4 border-b border-stone-200">
          <input v-model="search" class="admin-input" placeholder="Search users by email or name" @keyup.enter="refreshStaff" />
        </div>
        <div class="divide-y divide-stone-100">
          <div v-for="profile in profiles" :key="profile.id" class="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-stone-900 truncate">{{ profile.email }}</p>
              <p class="text-xs text-stone-500 truncate">
                {{ profile.full_name || 'No name' }}
                <span v-if="profile.super_admin" class="ml-2 font-semibold text-[#2D6A4F]">Super-admin</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <select
                :value="profile.staff?.role || ''"
                class="admin-input min-w-32"
                :disabled="profile.super_admin"
                @change="updateStaff(profile.staff?.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">No role</option>
                <option v-for="role in ADMIN_ROLES" :key="role" :value="role">{{ role }}</option>
              </select>
              <button
                v-if="profile.staff?.active && !profile.super_admin"
                class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                @click="removeStaff(profile.staff.id)"
              >
                Remove
              </button>
            </div>
          </div>
          <div v-if="profiles.length === 0" class="p-8 text-center text-sm text-stone-500">No users found.</div>
        </div>
      </div>
    </section>
  </AdminShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ADMIN_ROLES, isAdminRole } from '~/utils/adminPermissions'
import type { AdminRole } from '~/types'

definePageMeta({ layout: 'default', middleware: 'auth' })

interface StaffProfile {
  id: string
  email: string
  full_name?: string | null
  staff: null | { id: string; role: AdminRole; active: boolean }
  super_admin?: boolean
}

const search = ref('')
const newEmail = ref('')
const newRole = ref<AdminRole>('curator')
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const { data: profiles, refresh } = await useFetch<StaffProfile[]>('/api/admin/staff', {
  query: { search },
  default: () => [],
})

async function refreshStaff() {
  await refresh()
}

async function assignRole() {
  saving.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/staff', {
      method: 'POST',
      body: { email: newEmail.value, role: newRole.value },
    })
    message.value = 'Role assigned.'
    messageType.value = 'success'
    newEmail.value = ''
    await refresh()
  } catch (err: any) {
    message.value = err?.data?.message || err?.message || 'Could not assign role.'
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

async function updateStaff(id: string | undefined, role: string) {
  if (!id || !isAdminRole(role)) return
  await $fetch(`/api/admin/staff/${id}`, { method: 'PATCH', body: { role } })
  await refresh()
}

async function removeStaff(id: string) {
  await $fetch(`/api/admin/staff/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<style scoped>
.admin-label { display:block; margin-bottom:0.375rem; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgb(120 113 108); }
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-button { width:100%; border-radius:999px; background:rgb(28 25 23); color:white; padding:0.8rem 1rem; font-size:0.875rem; font-weight:700; }
.admin-button:disabled { opacity:0.55; }
</style>
