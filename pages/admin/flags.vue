<template>
  <AdminShell title="Feature Flags">
    <section class="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div class="space-y-4">
        <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div class="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-stone-900">Flags</p>
              <p class="text-xs text-stone-500 mt-1">Current runtime: {{ currentEnvironment }}</p>
            </div>
            <button class="admin-secondary" @click="startCreate">New</button>
          </div>

          <div class="divide-y divide-stone-100">
            <button
              v-for="flag in flags"
              :key="flag.id"
              class="w-full text-left p-4 transition-colors hover:bg-stone-50"
              :class="flag.id === form.id ? 'bg-stone-50' : 'bg-white'"
              @click="selectFlag(flag)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-stone-900 truncate">{{ flag.name }}</p>
                  <p class="font-mono text-[11px] text-stone-500 mt-1 truncate">{{ flag.environment }} / {{ flag.key }}</p>
                </div>
                <span
                  class="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                  :class="statusClass(flag)"
                >{{ statusLabel(flag) }}</span>
              </div>
              <p class="text-xs text-stone-500 mt-2 line-clamp-2">{{ targetingSummary(flag.rules) }}</p>
            </button>
            <div v-if="flags.length === 0" class="p-6 text-sm text-stone-500">No feature flags yet.</div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <form class="rounded-xl border border-stone-200 bg-white p-5 space-y-4" @submit.prevent="saveFlag">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-stone-900">{{ form.id ? 'Edit flag' : 'Create flag' }}</p>
              <p class="text-xs text-stone-500 mt-1">Keys are constants in code; rules decide who sees the enabled feature.</p>
            </div>
            <span v-if="selectedFlag?.archived_at" class="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Archived</span>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="block">
              <span class="admin-label">Key</span>
              <input v-model="form.key" class="admin-input font-mono text-xs" :disabled="Boolean(form.id)" placeholder="scout_style_agent">
            </label>
            <label class="block">
              <span class="admin-label">Environment</span>
              <select v-model="form.environment" class="admin-input">
                <option value="all">all</option>
                <option value="development">development</option>
                <option value="preview">preview</option>
                <option value="production">production</option>
              </select>
            </label>
          </div>

          <label class="block">
            <span class="admin-label">Name</span>
            <input v-model="form.name" required class="admin-input" placeholder="Scout AI Style Agent">
          </label>

          <label class="block">
            <span class="admin-label">Description</span>
            <textarea v-model="form.description" class="admin-input min-h-20" placeholder="What this flag controls" />
          </label>

          <label class="inline-flex items-center gap-2 text-sm text-stone-700">
            <input v-model="form.enabled" type="checkbox" class="rounded border-stone-300">
            Global enabled
          </label>

          <div class="rounded-lg border border-stone-200 p-3 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold text-stone-900">Targeting rules</p>
                <p class="text-xs text-stone-500 mt-1">{{ targetingSummary(parsedRules) }}</p>
              </div>
              <button type="button" class="admin-secondary" @click="addRule">Add rule</button>
            </div>

            <div class="grid gap-2 md:grid-cols-[150px_110px_1fr]">
              <select v-model="newRule.type" class="admin-input">
                <option value="admin_role">Admin roles</option>
                <option value="all_staff">All staff</option>
                <option value="user_list">Specific users</option>
                <option value="percentage">Percentage</option>
                <option value="everyone">Everyone</option>
              </select>
              <select v-model="newRule.enabled" class="admin-input">
                <option :value="true">Allow</option>
                <option :value="false">Deny</option>
              </select>
              <input v-model="newRule.value" class="admin-input text-xs" :placeholder="rulePlaceholder">
            </div>

            <textarea
              v-model="rulesText"
              class="admin-input font-mono text-xs min-h-48"
              spellcheck="false"
              @blur="formatRules"
            />
            <p v-if="rulesError" class="text-xs text-red-600">{{ rulesError }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button class="admin-button" :disabled="saving">{{ saving ? 'Saving...' : 'Save flag' }}</button>
            <button v-if="form.id && !selectedFlag?.archived_at" type="button" class="admin-secondary" @click="archiveFlag">Archive</button>
            <button v-if="form.id && selectedFlag?.archived_at" type="button" class="admin-secondary" @click="restoreFlag">Restore</button>
            <button type="button" class="admin-secondary" @click="startCreate">Clear</button>
          </div>
          <p v-if="message" class="text-xs" :class="messageType === 'error' ? 'text-red-600' : 'text-green-700'">{{ message }}</p>
        </form>

        <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div class="admin-header">Audit history</div>
          <div class="divide-y divide-stone-100">
            <div v-for="event in visibleEvents" :key="event.id" class="p-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-stone-900">{{ event.action }} · <span class="font-mono text-xs">{{ event.flag_key }}</span></p>
                <span class="text-[11px] text-stone-400">{{ formatDate(event.created_at) }}</span>
              </div>
              <p class="text-xs text-stone-500 mt-1">{{ event.environment }} · {{ event.actor_id || 'system' }}</p>
            </div>
            <div v-if="visibleEvents.length === 0" class="p-6 text-sm text-stone-500">No audit events yet.</div>
          </div>
        </div>
      </div>
    </section>
  </AdminShell>
</template>

<script setup lang="ts">
import type { FeatureFlag, FeatureFlagEnvironment, FeatureFlagEvent, FeatureFlagRule } from '~/types'

definePageMeta({ layout: 'default', middleware: 'auth' })

const ADMIN_ROLE_VALUES = ['admin', 'curator', 'designer', 'support'] as const
type FlagsResponse = {
  environment: FeatureFlagEnvironment
  flags: FeatureFlag[]
  events: FeatureFlagEvent[]
}

const { data, refresh } = await useFetch<FlagsResponse>('/api/admin/flags', {
  default: (): FlagsResponse => ({ environment: 'development', flags: [], events: [] }),
})

const flags = computed(() => data.value?.flags || [])
const events = computed(() => data.value?.events || [])
const currentEnvironment = computed(() => data.value?.environment || 'development')
const { refreshFeatureFlags } = useFeatureFlags()
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const rulesText = ref('[]')
const rulesError = ref('')

const form = reactive({
  id: '',
  key: '',
  name: '',
  description: '',
  environment: 'all' as FeatureFlagEnvironment,
  enabled: false,
})

const newRule = reactive({
  type: 'admin_role' as FeatureFlagRule['type'],
  enabled: true,
  value: 'admin, designer',
})

const selectedFlag = computed(() => flags.value.find(flag => flag.id === form.id) || null)
const parsedRules = computed(() => parseRules() || [])
const visibleEvents = computed(() =>
  selectedFlag.value
    ? events.value.filter(event => event.feature_flag_id === selectedFlag.value?.id || event.flag_key === selectedFlag.value?.key)
    : events.value.slice(0, 12),
)

const rulePlaceholder = computed(() => {
  if (newRule.type === 'admin_role') return 'admin, designer'
  if (newRule.type === 'user_list') return 'email@example.com, uuid...'
  if (newRule.type === 'percentage') return '10'
  return 'No value needed'
})

function parseRules(): FeatureFlagRule[] | null {
  try {
    const parsed = JSON.parse(rulesText.value || '[]')
    if (!Array.isArray(parsed)) throw new Error('Rules must be a JSON array')
    if (parsed.length > 10) throw new Error('Maximum 10 rules per flag')
    rulesError.value = ''
    return parsed as FeatureFlagRule[]
  } catch (err) {
    rulesError.value = (err as Error).message
    return null
  }
}

function formatRules() {
  const parsed = parseRules()
  if (parsed) rulesText.value = JSON.stringify(parsed, null, 2)
}

function startCreate() {
  Object.assign(form, {
    id: '',
    key: '',
    name: '',
    description: '',
    environment: currentEnvironment.value || 'all',
    enabled: false,
  })
  rulesText.value = '[]'
  rulesError.value = ''
  message.value = ''
}

function selectFlag(flag: FeatureFlag) {
  Object.assign(form, {
    id: flag.id,
    key: flag.key,
    name: flag.name,
    description: flag.description || '',
    environment: flag.environment,
    enabled: flag.enabled,
  })
  rulesText.value = JSON.stringify(flag.rules || [], null, 2)
  rulesError.value = ''
  message.value = ''
}

function addRule() {
  const rules = parseRules()
  if (!rules) return
  const value = newRule.value.split(',').map(item => item.trim()).filter(Boolean)
  const rule: FeatureFlagRule = { type: newRule.type, enabled: newRule.enabled }

  if (newRule.type === 'admin_role') {
    rule.roles = value.filter((role): role is NonNullable<FeatureFlagRule['roles']>[number] => ADMIN_ROLE_VALUES.includes(role as any))
  } else if (newRule.type === 'user_list') {
    rule.emails = value.filter(item => item.includes('@')).map(item => item.toLowerCase())
    rule.user_ids = value.filter(item => !item.includes('@'))
  } else if (newRule.type === 'percentage') {
    rule.percentage = Math.max(0, Math.min(100, Number(value[0] || 0)))
  }

  rules.push(rule)
  rulesText.value = JSON.stringify(rules, null, 2)
}

async function saveFlag() {
  const rules = parseRules()
  if (!rules) return
  saving.value = true
  message.value = ''
  try {
    const body = {
      name: form.name,
      description: form.description || null,
      environment: form.environment,
      enabled: form.enabled,
      rules,
    }
    if (form.id) {
      await $fetch(`/api/admin/flags/${form.id}`, { method: 'PATCH', body })
    } else {
      const created = await $fetch<FeatureFlag>('/api/admin/flags', {
        method: 'POST',
        body: { ...body, key: form.key },
      })
      form.id = created.id
    }
    await Promise.all([refresh(), refreshFeatureFlags()])
    messageType.value = 'success'
    message.value = 'Feature flag saved.'
  } catch (err: any) {
    messageType.value = 'error'
    message.value = err?.data?.message || err?.message || 'Could not save feature flag.'
  } finally {
    saving.value = false
  }
}

async function archiveFlag() {
  if (!form.id) return
  await $fetch(`/api/admin/flags/${form.id}`, { method: 'PATCH', body: { archived: true } })
  await Promise.all([refresh(), refreshFeatureFlags()])
}

async function restoreFlag() {
  if (!form.id) return
  await $fetch(`/api/admin/flags/${form.id}`, { method: 'PATCH', body: { archived: false } })
  await Promise.all([refresh(), refreshFeatureFlags()])
}

function statusLabel(flag: FeatureFlag): string {
  if (flag.archived_at) return 'archived'
  return flag.enabled ? 'on' : 'off'
}

function statusClass(flag: FeatureFlag): string {
  if (flag.archived_at) return 'bg-stone-100 text-stone-500'
  return flag.enabled ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
}

function targetingSummary(rules: FeatureFlagRule[]): string {
  if (!rules?.length) return 'No targeting rules; defaults off.'
  return rules.map((rule) => {
    const prefix = rule.enabled ? 'Allow' : 'Deny'
    if (rule.type === 'admin_role') return `${prefix} roles: ${(rule.roles || []).join(', ')}`
    if (rule.type === 'all_staff') return `${prefix} all staff`
    if (rule.type === 'user_list') return `${prefix} users: ${[...(rule.emails || []), ...(rule.user_ids || [])].join(', ')}`
    if (rule.type === 'percentage') return `${prefix} ${rule.percentage || 0}% rollout`
    return `${prefix} everyone`
  }).join(' · ')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}
</script>

<style scoped>
.admin-label { display:block; margin-bottom:0.375rem; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgb(120 113 108); }
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-input:disabled { background:rgb(245 245 244); color:rgb(120 113 108); }
.admin-button { border-radius:999px; background:rgb(28 25 23); color:white; padding:0.75rem 1.2rem; font-size:0.8rem; font-weight:700; }
.admin-button:disabled { opacity:0.55; }
.admin-secondary { border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.7rem 1rem; font-size:0.8rem; font-weight:700; }
.admin-header { border-bottom:1px solid rgb(231 229 228); padding:0.9rem 1rem; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.14em; color:rgb(120 113 108); }
</style>
