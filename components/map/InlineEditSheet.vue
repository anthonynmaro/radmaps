<template>
  <Teleport to="body">
    <div class="inline-edit-backdrop" @click.self="$emit('close')">
      <div class="inline-edit-sheet">
        <div class="sheet-handle" />

        <div class="sheet-header">
          <p class="sheet-label">{{ fieldLabel }}</p>
          <button class="sheet-cancel" @click="$emit('close')">Cancel</button>
        </div>

        <textarea
          ref="textareaRef"
          v-model="draft"
          class="sheet-textarea"
          :placeholder="fieldPlaceholder"
          rows="3"
          @keydown.enter.exact.prevent="save"
        />

        <div class="sheet-footer">
          <button class="sheet-done" @click="save">Done</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  field: 'trail_name' | 'occasion_text' | 'location_text'
  value: string
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  close: []
}>()

const draft = ref(props.value)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const fieldLabel = computed(() => {
  if (props.field === 'trail_name') return 'Trail Name'
  if (props.field === 'occasion_text') return 'Occasion / Subtitle'
  return 'Location'
})

const fieldPlaceholder = computed(() => {
  if (props.field === 'trail_name') return 'e.g. Half Dome Summit'
  if (props.field === 'occasion_text') return 'e.g. Summit Day 2024'
  return 'e.g. Yosemite, California'
})

onMounted(() => {
  nextTick(() => textareaRef.value?.focus())
})

function save() {
  emit('update:value', draft.value)
  emit('close')
}
</script>

<style scoped>
.inline-edit-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
}

.inline-edit-sheet {
  width: 100%;
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 20px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: sheet-slide-up 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes sheet-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: #d1d5db;
  border-radius: 2px;
  align-self: center;
  margin-bottom: 4px;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-label {
  font-size: 15px;
  font-weight: 600;
  color: #1c1917;
}

.sheet-cancel {
  font-size: 14px;
  color: #78716c;
  padding: 4px 0;
}

.sheet-textarea {
  width: 100%;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px; /* prevent iOS zoom on focus */
  color: #1c1917;
  background: #f9fafb;
  resize: none;
  outline: none;
  line-height: 1.5;
  font-family: inherit;
}

.sheet-textarea:focus {
  border-color: #2d6a4f;
  background: #fff;
}

.sheet-footer {
  display: flex;
  justify-content: flex-end;
}

.sheet-done {
  background: #2d6a4f;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  padding: 12px 32px;
  border-radius: 12px;
  min-width: 120px;
  text-align: center;
}
</style>
