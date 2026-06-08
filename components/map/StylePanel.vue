<template>
  <div class="h-full flex flex-col bg-white overflow-hidden" style="border-radius: 18px 18px 0 0" data-testid="style-panel">

    <!-- Drag handle -->
    <button
      class="w-full flex justify-center pt-2.5 pb-1.5 shrink-0 border-none cursor-pointer bg-white focus:outline-none"
      style="border-radius: 18px 18px 0 0; touch-action: none;"
      @click="onHandleClick"
      @touchstart.passive="onHandleTouchStart"
      @touchmove.passive="onHandleTouchMove"
      @touchend="onHandleTouchEnd"
      @touchcancel="onHandleTouchCancel"
      aria-label="Toggle panel size"
    >
      <div class="w-9 h-1 rounded-full bg-[#D6D3D1]" />
    </button>

    <!-- Header -->
    <div class="px-4 pt-0.5 pb-2.5 shrink-0">
      <p class="text-sm font-bold text-[#1C1917] leading-none">Style your map</p>
      <p class="text-[10px] text-[#A8A29E] mt-1 leading-none">{{ saving ? 'Saving…' : 'All changes saved' }}</p>
    </div>

    <!-- Segmented tab bar -->
    <div class="px-3 pb-2 shrink-0">
      <div class="flex bg-[#F5F5F4] rounded-lg p-[3px] gap-0.5">
        <button
          v-for="t in visibleTabs"
          :key="t.id"
          @click="activeTab = t.id"
          class="flex-1 text-[11px] font-semibold rounded-md leading-none py-[6px] transition-all duration-150 border-none cursor-pointer"
          :style="activeTab === t.id
            ? 'background: white; color: #1C1917; box-shadow: 0 1px 2px rgba(0,0,0,0.06);'
            : 'background: transparent; color: #78716C;'"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- Tab divider -->
    <div class="h-px bg-[#F5F5F4] shrink-0" />

    <!-- Scrollable tab content -->
    <div class="flex-1 overflow-y-auto" style="-webkit-overflow-scrolling: touch">

      <!-- ─── QUICK TAB ──────────────────────────────────────────────────────── -->
      <template v-if="activeTab === 'quick'">

        <V4Card title="Theme" hint="One tap sets colors and fonts" :default-open="true">

          <!-- All themes -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="theme in THEME_OPTIONS"
              :key="theme.id"
              @click="applyTheme(theme)"
              class="relative flex flex-col items-center gap-1 bg-white cursor-pointer transition-all border-none p-0"
              style="border-radius: 10px; border: 2px solid; padding: 4px;"
              :style="{ borderColor: isRefinedThemeActive(theme) ? '#2D6A4F' : '#E7E5E4' }"
              :data-theme-id="theme.id"
              :data-theme-group-id="theme.colorway_of ?? theme.id"
              :data-colorway-of="theme.colorway_of"
              data-testid="quick-poster-theme"
            >
              <span
                v-if="showsRefinedBadge(theme)"
                class="absolute z-10"
                style="top: 6px; right: 6px; font-size: 7px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #24523B; background: rgba(240, 253, 244, 0.94); border: 1px solid rgba(45, 106, 79, 0.34); border-radius: 4px; padding: 2px 4px; line-height: 1;"
                data-testid="refined-theme-badge"
              >Refined</span>
              <span
                v-if="theme.colorway_of"
                class="absolute z-10"
                style="top: 24px; right: 6px; font-size: 7px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #44403C; background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(68, 64, 60, 0.18); border-radius: 4px; padding: 2px 4px; line-height: 1;"
                data-testid="theme-colorway-badge"
              >Colorway</span>
              <!-- Mini poster thumbnail — layout mirrors actual theme -->
              <div
                class="w-full overflow-hidden flex flex-col"
                style="aspect-ratio: 2/3; border-radius: 5px;"
                :style="{ backgroundColor: theme.background_color }"
              >
                <!-- Title band: flex order flips for bottom-title themes -->
                <div :style="{
                  order: themeThumb(theme).titlePosition === 'bottom' ? 1 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: themeThumb(theme).titleAlign === 'left' ? 'flex-start' : 'center',
                  padding: themeThumb(theme).titlePosition === 'bottom' ? '4% 9% 9%' : '9% 9% 4%',
                  gap: '7%',
                  backgroundColor: themeThumb(theme).headerBackground === 'label' ? theme.label_bg_color : theme.background_color,
                }">
                  <!-- Rule above text for bottom-title themes -->
                  <div v-if="themeThumb(theme).titlePosition === 'bottom'" style="width: 100%; height: 1px; opacity: 0.18;" :style="{ backgroundColor: theme.label_text_color }" />
                  <span :style="{
                    display: 'block',
                    color: theme.label_text_color,
                    fontFamily: themeFontPreview(theme),
                    fontSize: themeThumb(theme).fontSize,
                    fontWeight: themeThumb(theme).fontWeight,
                    letterSpacing: themeThumb(theme).letterSpacing,
                    textTransform: themeThumb(theme).textTransform,
                    lineHeight: themeThumb(theme).lineHeight,
                    textAlign: themeThumb(theme).titleAlign === 'left' ? 'left' : 'center',
                  }">SUMMIT<br/>TRAIL</span>
                  <!-- Rule below text for top-title themes -->
                  <div v-if="themeThumb(theme).titlePosition !== 'bottom'" style="width: 100%; height: 1px; opacity: 0.18;" :style="{ backgroundColor: theme.label_text_color }" />
                </div>

                <!-- Map area -->
                <div :style="{
                  order: themeThumb(theme).titlePosition === 'bottom' ? 0 : 1,
                  flex: 1,
                  overflow: 'hidden',
                  backgroundColor: theme.id === 'dark-sky' ? theme.land_color : 'transparent',
                }">
                  <svg viewBox="0 0 60 40" style="width: 100%; height: 100%;" fill="none" preserveAspectRatio="xMidYMid slice">
                    <path v-if="theme.id === 'dark-sky'" d="M-3 28 Q12 22 24 24 Q38 27 63 16" :stroke="theme.water_color" stroke-width="5" fill="none" opacity="0.9"/>
                    <ellipse cx="30" cy="22" rx="22" ry="12" :stroke="theme.label_text_color" stroke-width="0.4" fill="none" opacity="0.18"/>
                    <ellipse cx="30" cy="22" rx="14" ry="8" :stroke="theme.label_text_color" stroke-width="0.4" fill="none" opacity="0.14"/>
                    <template v-if="theme.id === 'dark-sky'">
                      <path d="M8 30 Q18 22 26 24 Q34 26 42 17 Q49 9 56 12" :stroke="theme.route_color" stroke-width="1.8" fill="none" stroke-linecap="round"/>
                      <path d="M18 20 L6 12 M35 23 L51 10 M43 17 L54 25" :stroke="theme.route_color" stroke-width="0.45" fill="none" opacity="0.58"/>
                      <circle cx="18" cy="20" r="0.9" :fill="theme.route_color"/>
                      <circle cx="35" cy="23" r="0.9" :fill="theme.route_color"/>
                      <circle cx="43" cy="17" r="0.9" :fill="theme.route_color"/>
                    </template>
                    <path v-else d="M6 32 Q16 26 24 28 Q34 30 44 18 Q50 12 56 14" :stroke="theme.route_color" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                  </svg>
                </div>

                <!-- Footer strip -->
                <div :style="{
                  order: 2,
                  height: '13%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 9%',
                  backgroundColor: themeThumb(theme).footerBackground === 'label' ? theme.label_bg_color : theme.background_color,
                  borderTop: `1px solid ${theme.label_text_color}20`,
                }">
                  <div style="width: 28%; height: 1px; border-radius: 1px; opacity: 0.25;" :style="{ backgroundColor: theme.label_text_color }" />
                </div>
              </div>

              <span
                class="text-[10px] font-semibold leading-none"
                :style="{ color: isRefinedThemeActive(theme) ? '#2D6A4F' : '#78716C' }"
              >{{ theme.label }}</span>
            </button>
          </div>

          <!-- Owned/Beta map themes from the real editor map inventory -->
          <div class="mt-3 pt-3 border-t border-[#F5F5F4]">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <p class="text-[10px] font-semibold uppercase" style="letter-spacing: 0.14em; color: #78716C;">Beta owned map themes</p>
                <p class="mt-0.5 text-[10px] leading-snug" style="color: #A8A29E;">Map-only styles from RadMaps-hosted Atlas tiles</p>
              </div>
              <span
                class="shrink-0"
                style="font-size: 7px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #9A6700; background: rgba(254, 243, 199, 0.92); border: 1px solid #FDE68A; border-radius: 4px; padding: 2px 5px; line-height: 1;"
              >Beta</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="p in ATLAS_MAP_PRESETS"
                :key="`quick-atlas-${p.id}`"
                @click="applyMapPreset(p)"
                class="flex flex-col items-center gap-1 bg-white cursor-pointer transition-all border-none p-0"
                style="border-radius: 10px; border: 2px solid; padding: 4px;"
                :style="{ borderColor: local.preset === p.id ? '#2D6A4F' : '#E7E5E4' }"
                :title="p.title"
                :data-preset-id="p.id"
                data-testid="quick-owned-map-theme"
              >
                <div
                  class="w-full overflow-hidden relative"
                  style="aspect-ratio: 2/3; border-radius: 5px; background: #F7F4EF;"
                >
                  <svg :viewBox="p.viewBox" class="w-full h-full" preserveAspectRatio="xMidYMid slice" v-html="p.svg" />
                  <span
                    class="absolute bottom-1 left-1"
                    style="font-size: 6px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: #1F4D38; background: rgba(240, 247, 243, 0.92); border: 1px solid #C8E1D2; border-radius: 4px; padding: 1px 4px; line-height: 1;"
                  >Map</span>
                </div>
                <span
                  class="text-[10px] font-semibold leading-none truncate w-full text-center"
                  :style="{ color: local.preset === p.id ? '#2D6A4F' : '#78716C' }"
                >{{ p.label }}</span>
              </button>
            </div>
          </div>

          <button
            v-if="showThemeBrowser"
            class="mt-3 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-semibold transition-colors hover:border-[#2D6A4F] hover:text-[#1F4D38]"
            style="color: #57534E;"
            @click="emit('browse-themes')"
          >
            Browse themes
          </button>

          <!-- Classic themes -->
          <div class="mt-3 pt-3 border-t border-[#F5F5F4]">
            <button
              class="w-full flex items-center justify-between text-[10px] font-semibold uppercase border-none bg-transparent p-0 cursor-pointer"
              style="letter-spacing: 0.14em; color: #78716C;"
              @click="showClassicThemes = !showClassicThemes"
            >
              <span>Classic themes</span>
              <span style="color: #A8A29E;">{{ showClassicThemes ? 'Hide' : 'Show' }}</span>
            </button>
            <div v-if="showClassicThemes" class="grid grid-cols-3 gap-2 mt-2">
              <button
                v-for="theme in CLASSIC_THEME_OPTIONS"
                :key="`classic-${theme.id}`"
                @click="applyClassicTheme(theme)"
                class="flex flex-col items-center gap-1 bg-white cursor-pointer transition-all border-none p-0"
                style="border-radius: 10px; border: 2px solid; padding: 4px;"
                :style="{ borderColor: isClassicThemeActive(theme) ? '#2D6A4F' : '#E7E5E4' }"
              >
                <div
                  class="w-full overflow-hidden flex flex-col"
                  style="aspect-ratio: 2/3; border-radius: 5px;"
                  :style="{ backgroundColor: theme.background_color }"
                >
                  <div
                    class="flex items-center justify-center"
                    style="height: 28%; padding: 9%;"
                    :style="{ backgroundColor: theme.background_color }"
                  >
                    <span
                      class="text-center"
                      :style="{
                        color: theme.label_text_color,
                        fontFamily: themeFontPreview(theme),
                        fontSize: themeThumb(theme, true).fontSize,
                        fontWeight: themeThumb(theme, true).fontWeight,
                        letterSpacing: themeThumb(theme, true).letterSpacing,
                        textTransform: themeThumb(theme, true).textTransform,
                        lineHeight: themeThumb(theme, true).lineHeight,
                      }"
                    >SUMMIT<br/>TRAIL</span>
                  </div>
                  <div style="height: 1px; opacity: 0.18;" :style="{ backgroundColor: theme.label_text_color }" />
                  <div class="flex-1">
                    <svg viewBox="0 0 60 40" style="width: 100%; height: 100%;" fill="none" preserveAspectRatio="xMidYMid slice">
                      <ellipse cx="30" cy="22" rx="22" ry="12" :stroke="theme.contour_major_color ?? theme.label_text_color" stroke-width="0.4" fill="none" opacity="0.2"/>
                      <path d="M6 32 Q16 26 24 28 Q34 30 44 18 Q50 12 56 14" :stroke="theme.route_color" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <div style="height: 14%;" :style="{ backgroundColor: theme.label_bg_color }" />
                </div>
                <span
                  class="text-[10px] font-semibold leading-none truncate w-full text-center"
                  :style="{ color: isClassicThemeActive(theme) ? '#2D6A4F' : '#78716C' }"
                >{{ theme.label }}</span>
              </button>
            </div>
          </div>

          <!-- My Themes -->
          <div v-if="savedThemes.length" class="mt-3 pt-3 border-t border-[#F5F5F4]">
            <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">My Themes</p>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="saved in savedThemes" :key="saved.id" class="relative group">
                <button @click="applySavedTheme(saved)" class="w-full flex flex-col items-center gap-1 bg-white cursor-pointer border-none p-0" style="border-radius: 10px; border: 2px solid #E7E5E4; padding: 4px;">
                  <div class="w-full overflow-hidden flex flex-col items-center" style="aspect-ratio: 2/3; border-radius: 5px; padding: 12% 8%; gap: 4%;" :style="{ backgroundColor: saved.config.background_color ?? '#F7F4EF' }">
                    <span class="text-center" style="font-size: 7px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1.1;" :style="{ color: saved.config.label_text_color ?? '#1C1917' }">SUMMIT<br/>TRAIL</span>
                    <div class="w-full shrink-0" style="height: 1px; opacity: 0.2;" :style="{ backgroundColor: saved.config.label_text_color ?? '#1C1917' }" />
                    <svg viewBox="0 0 60 40" class="w-full flex-1" fill="none">
                      <ellipse cx="30" cy="22" rx="22" ry="12" :stroke="saved.config.label_text_color ?? '#1C1917'" stroke-width="0.4" fill="none" opacity="0.18"/>
                      <ellipse cx="30" cy="22" rx="14" ry="8" :stroke="saved.config.label_text_color ?? '#1C1917'" stroke-width="0.4" fill="none" opacity="0.14"/>
                      <path d="M6 32 Q16 26 24 28 Q34 30 44 18 Q50 12 56 14" :stroke="saved.config.route_color ?? '#C1121F'" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <span class="text-[10px] font-semibold leading-none truncate w-full text-center" style="color: #78716C;">{{ saved.name }}</span>
                </button>
                <button @click.stop="removeTheme(saved.id)" class="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-gray-800/70 text-white text-[8px] leading-none z-10 hover:bg-gray-900/90 transition-colors">✕</button>
              </div>
            </div>
          </div>

          <!-- Save theme -->
          <div class="mt-3 pt-3 border-t border-[#F5F5F4]">
            <div v-if="showSaveInput" class="flex items-center gap-2">
              <input
                ref="saveInputRef"
                v-model="newThemeName"
                type="text"
                placeholder="Theme name…"
                maxlength="40"
                class="flex-1 text-xs border border-[#E7E5E4] rounded px-2 py-1 focus:outline-none focus:border-[#2D6A4F] focus:ring-1"
                style="focus:ring-color: rgba(45,106,79,0.3)"
                @keydown.enter="handleSaveTheme"
                @keydown.escape="showSaveInput = false"
              />
              <button class="text-xs font-semibold transition-colors" style="color: #1F4D38;" @click="handleSaveTheme">Save</button>
              <button class="text-xs transition-colors" style="color: #A8A29E;" @click="showSaveInput = false">✕</button>
            </div>
            <button v-else class="text-[10px] font-semibold transition-colors" style="color: #78716C; background: none; border: none; padding: 0; cursor: pointer;" @click="openSaveInput">+ Save current theme</button>
          </div>
        </V4Card>

        <V4Card v-if="sections.routeLineQuick" title="Route line" :default-open="true">
          <ColorRow v-if="sections.routeColorControl" label="Color" :value="local.route_color" @change="setRouteLineStyle('route_color', $event)" />
          <SliderRow v-if="sections.routeWidthControl" label="Width" :value="local.route_width" :min="1" :max="10" :step="0.5"
            :display="(v: number) => v + 'px'" @change="setRouteLineStyle('route_width', $event)" />
        </V4Card>

      </template>

      <!-- ─── DESIGN TAB ────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'design'">
        <V4Card title="Poster tools" hint="Canvas-first text, images, icons, and guides" :default-open="true">
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="mode in ([
                { id: 'layout', label: 'Layout' },
                { id: 'select', label: 'Select' },
                { id: 'text', label: 'Text' },
                { id: 'image', label: 'Image' },
                { id: 'icon', label: 'Icon' },
                { id: 'guides', label: 'Guides' },
              ] as const)"
              :key="mode.id"
              :data-testid="`poster-tool-${mode.id}`"
              class="rounded-lg border px-1.5 py-2 text-[10px] font-semibold transition-colors"
              :style="posterEditorMode === mode.id ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; background: white; color: #57534E;'"
              @click="
                mode.id === 'text'
                  ? emit('poster-text-add')
                  : mode.id === 'image'
                    ? designImageInputRef?.click()
                    : setPosterEditorMode(mode.id)
              "
            >{{ mode.label }}</button>
          </div>
          <input ref="designImageInputRef" type="file" :accept="IMAGE_UPLOAD_ACCEPT" class="sr-only" @change="handleDesignUpload($event, 'image')" />
          <input ref="designLogoInputRef" type="file" :accept="IMAGE_UPLOAD_ACCEPT" class="sr-only" @change="handleDesignUpload($event, 'logo')" />
          <button
            class="mt-2 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-semibold text-[#57534E] transition-colors hover:border-[#2D6A4F]"
            @click="designLogoInputRef?.click()"
          >Upload logo</button>
        </V4Card>

        <V4Card title="Guides" hint="Editing guides are never printed" :default-open="posterEditorMode === 'guides'">
          <ToggleRow label="Editing guides" :value="posterGuidesVisible ?? false" @change="emit('poster-guides-visible-change', $event)" />
          <div v-if="sections.gridControls" class="pt-3 mt-3" style="border-top: 1px solid #F5F5F4;">
            <ToggleRow label="Printed grid" :value="local.show_grid ?? false" @change="set('show_grid', $event)" />
            <template v-if="local.show_grid">
              <div class="grid grid-cols-2 gap-1.5 my-3">
                <SegmentButton label="Poster" :active="(local.grid_scope ?? 'poster') === 'poster'" @click="set('grid_scope', 'poster')" />
                <SegmentButton label="Map only" :active="local.grid_scope === 'map'" @click="set('grid_scope', 'map')" />
              </div>
              <ColorRow label="Grid color" :value="local.grid_color ?? local.label_text_color" @change="set('grid_color', $event)" />
              <SliderRow label="Spacing" :value="local.grid_spacing ?? 8" :min="3" :max="16" :step="1"
                :display="(v: number) => v + 'u'" @change="set('grid_spacing', $event)" />
              <SliderRow label="Opacity" :value="local.grid_opacity ?? 0.2" :min="0.05" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'" @change="set('grid_opacity', $event)" />
              <SliderRow label="Weight" :value="local.grid_weight ?? 1" :min="0.5" :max="3" :step="0.25"
                :display="(v: number) => v.toFixed(v % 1 === 0 ? 0 : 2) + 'px'" @change="set('grid_weight', $event)" />
            </template>
          </div>
        </V4Card>

        <V4Card title="Icons" hint="Local SVG marks for trail posters" :default-open="posterEditorMode === 'icon'">
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="icon in POSTER_ICONS"
              :key="icon.id"
              class="rounded-lg border border-[#E7E5E4] bg-white px-2 py-2 text-[10px] font-semibold text-[#57534E] transition-colors hover:border-[#2D6A4F]"
              @click="emit('poster-icon-add', icon.id)"
            >{{ icon.label }}</button>
          </div>
        </V4Card>

        <V4Card title="Layers" hint="Theme chrome is locked by default" :default-open="true">
          <div class="space-y-1.5">
            <button
              v-for="element in posterEditorElements"
              :key="element.id"
              class="w-full rounded-lg border px-2.5 py-2 text-left transition-colors"
              :style="selectedPosterElementId === element.id ? 'border-color: #2D6A4F; background: #DCEBE2;' : 'border-color: #F5F5F4; background: white;'"
              @click="selectPosterElement(element.id)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="min-w-0 truncate text-xs font-semibold" style="color: #1C1917;">{{ element.label }}</span>
                <span class="shrink-0 text-[9px] font-semibold uppercase" style="letter-spacing: 0.08em; color: #A8A29E;">{{ element.kind }}</span>
              </span>
              <span class="mt-0.5 flex items-center gap-1 text-[10px]" style="color: #A8A29E;">
                <span>{{ element.source }}</span>
                <span v-if="element.locked">locked</span>
                <span v-if="element.hidden">hidden</span>
              </span>
            </button>
          </div>
        </V4Card>

        <V4Card v-if="activePosterElement" title="Selection" :default-open="true">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold" style="color: #1C1917;">{{ activePosterElement.label }}</p>
                <p class="text-[10px]" style="color: #A8A29E;">{{ activePosterElement.kind }}</p>
              </div>
              <div v-if="activePosterElement.canDelete" class="flex shrink-0 gap-1">
                <button class="rounded border border-[#E7E5E4] bg-white px-2 py-1 text-[10px] font-semibold text-[#57534E]" @click="emit('poster-element-duplicate', activePosterElement.id)">Duplicate</button>
                <button class="rounded border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700" @click="emit('poster-element-remove', activePosterElement.id)">Delete</button>
              </div>
            </div>

            <div v-if="activePosterElement.canDelete" class="grid grid-cols-2 gap-1.5">
              <SegmentButton :label="activePosterElement.locked ? 'Unlock' : 'Lock'" :active="activePosterElement.locked" @click="patchPosterElement(activePosterElement.id, { locked: !activePosterElement.locked })" />
              <SegmentButton :label="activePosterElement.hidden ? 'Show' : 'Hide'" :active="activePosterElement.hidden" @click="patchPosterElement(activePosterElement.id, { hidden: !activePosterElement.hidden })" />
            </div>

            <TextRow
              v-if="activePosterElement.kind === 'free-text' || activePosterElement.kind === 'theme-text'"
              label="Text"
              :value="activePosterElement.kind === 'theme-text' ? activePosterSlotText() : (local.text_overlays ?? []).find(o => `text:${o.id}` === activePosterElement?.id)?.content ?? ''"
              placeholder="Your text"
              @change="patchPosterElement(activePosterElement.id, { content: $event })"
            />

            <ColorRow
              v-if="activePosterElement.kind === 'free-text' || activePosterElement.kind === 'theme-text' || activePosterElement.kind === 'icon'"
              label="Color"
              :value="activePosterElement.color ?? local.label_text_color"
              @change="patchPosterElement(activePosterElement!.id, { color: $event })"
            />

            <template v-if="activePosterElement.kind === 'icon'">
              <div class="grid grid-cols-3 gap-1">
                <button
                  v-for="icon in POSTER_ICONS"
                  :key="`select-${icon.id}`"
                  class="rounded border px-2 py-1.5 text-[10px] font-semibold"
                  :style="(local.icon_overlays ?? []).find(o => `icon:${o.id}` === activePosterElement?.id)?.icon === icon.id ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; background: white; color: #57534E;'"
                  @click="patchPosterElement(activePosterElement.id, { icon: icon.id })"
                >{{ icon.label }}</button>
              </div>
            </template>

            <SliderRow
              v-if="activePosterElement.kind === 'theme-text'"
              label="Size"
              :value="activePosterSlotSizePt()"
              :min="6"
              :max="180"
              :step="1"
              :display="(v: number) => Math.round(v) + 'pt'"
              @change="patchPosterElement(activePosterElement!.id, { font_size_pt: $event })"
            />
            <SliderRow
              v-if="activePosterElement.kind === 'image' || activePosterElement.kind === 'logo' || activePosterElement.kind === 'icon'"
              label="Size"
              :value="activePosterElement.width ?? 10"
              :min="2"
              :max="activePosterElement.kind === 'icon' ? 80 : 100"
              :step="1"
              :display="(v: number) => Math.round(v) + '%'"
              @change="resizeSelectedElement($event)"
            />
            <SliderRow v-if="activePosterElement.kind !== 'theme-text'" label="Rotation" :value="activePosterElement.rotation ?? 0" :min="-180" :max="180" :step="1"
              :display="(v: number) => Math.round(v) + '°'" @change="patchPosterElement(activePosterElement!.id, { rotation: $event })" />
            <SliderRow label="Opacity" :value="(activePosterElement.id.startsWith('slot:') ? (local.poster_text_overrides?.[slotFromPosterElementId(activePosterElement.id) ?? 'trail_name']?.opacity ?? 1) : activePosterElement.id.startsWith('text:') ? (local.text_overlays ?? []).find(o => `text:${o.id}` === activePosterElement?.id)?.opacity : activePosterElement.id.startsWith('icon:') ? (local.icon_overlays ?? []).find(o => `icon:${o.id}` === activePosterElement?.id)?.opacity : (local.image_overlays ?? []).find(o => `asset:${o.id}` === activePosterElement?.id)?.opacity) ?? 1" :min="0.1" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="patchPosterElement(activePosterElement!.id, { opacity: $event })" />

            <ToggleRow
              v-if="activePosterElement.kind === 'image' || activePosterElement.kind === 'logo'"
              label="Allow bleed"
              :value="(local.image_overlays ?? []).find(o => `asset:${o.id}` === activePosterElement?.id)?.allow_bleed ?? false"
              @change="patchPosterElement(activePosterElement!.id, { allow_bleed: $event })"
            />

            <div v-if="activePosterElement.kind !== 'theme-text'" class="grid grid-cols-2 gap-1.5">
              <button class="rounded-lg border border-[#E7E5E4] bg-white px-2 py-2 text-xs font-semibold text-[#57534E]" @click="setSelectedElementZ(-1)">Send back</button>
              <button class="rounded-lg border border-[#E7E5E4] bg-white px-2 py-2 text-xs font-semibold text-[#57534E]" @click="setSelectedElementZ(1)">Bring front</button>
            </div>
          </div>
        </V4Card>
      </template>

      <!-- ─── MAP TAB ───────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'map'">

        <V4Card
          v-if="showAtlasEditor"
          title="Owned Atlas maps"
          hint="RadMaps-hosted vector tiles; editable layers and lower provider dependency"
          :default-open="true"
        >
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="p in ATLAS_MAP_PRESETS"
              :key="p.id"
              @click="applyMapPreset(p)"
              class="flex flex-col items-center gap-1 cursor-pointer transition-all overflow-hidden border-none"
              style="padding: 6px; border-radius: 8px; border: 1.5px solid;"
              :style="local.preset === p.id
                ? 'background: #DCEBE2; border-color: #2D6A4F;'
                : 'background: white; border-color: #E7E5E4;'"
              :title="p.title"
            >
              <div class="w-full rounded overflow-hidden relative" style="aspect-ratio: 3/2">
                <svg :viewBox="p.viewBox" class="w-full h-full" preserveAspectRatio="xMidYMid slice" v-html="p.svg" />
                <span
                  v-if="p.beta"
                  class="absolute top-1 right-1"
                  style="font-size: 7px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #9A6700; background: rgba(254, 243, 199, 0.92); border: 1px solid #FDE68A; border-radius: 4px; padding: 1px 4px; line-height: 1;"
                >Beta</span>
              </div>
              <span class="text-[9px] leading-none font-semibold"
                :style="local.preset === p.id ? 'color: #1F4D38;' : 'color: #78716C;'"
              >{{ p.label }}</span>
            </button>
          </div>
          <div
            v-if="isAtlasPresetActive"
            class="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-lg"
            style="background: #F0F7F3; border: 1px solid #C8E1D2;"
          >
            <div class="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style="background: #2D6A4F;" />
            <p class="text-[10px] leading-snug flex-1" style="color: #1F4D38;">Using owned Atlas vector tiles. Layer toggles and colors below apply directly to our hosted map data.</p>
          </div>
        </V4Card>

        <V4Card
          title="Classic / provider maps"
          hint="Older Mapbox, CARTO, MapTiler, and Stadia-backed options"
          :default-open="!isAtlasPresetActive || !showAtlasEditor"
        >
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="p in PROVIDER_MAP_PRESETS"
              :key="p.id"
              @click="applyMapPreset(p)"
              class="flex flex-col items-center gap-1 cursor-pointer transition-all overflow-hidden border-none"
              style="padding: 6px; border-radius: 8px; border: 1.5px solid;"
              :style="local.preset === p.id
                ? 'background: #DCEBE2; border-color: #2D6A4F;'
                : 'background: white; border-color: #E7E5E4;'"
              :title="p.title"
            >
              <div class="w-full rounded overflow-hidden relative" style="aspect-ratio: 3/2">
                <svg :viewBox="p.viewBox" class="w-full h-full" preserveAspectRatio="xMidYMid slice" v-html="p.svg" />
                <span
                  v-if="p.beta"
                  class="absolute top-1 right-1"
                  style="font-size: 7px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #9A6700; background: rgba(254, 243, 199, 0.92); border: 1px solid #FDE68A; border-radius: 4px; padding: 1px 4px; line-height: 1;"
                >Beta</span>
              </div>
              <span class="text-[9px] leading-none font-semibold"
                :style="local.preset === p.id ? 'color: #1F4D38;' : 'color: #78716C;'"
              >{{ p.label }}</span>
            </button>
          </div>
          <div
            v-if="!isAtlasPresetActive"
            class="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-lg"
            style="background: #FFFBEB; border: 1px solid #FDE68A;"
          >
            <div class="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style="background: #D97706;" />
            <p class="text-[10px] leading-snug flex-1" style="color: #92400E;">Classic maps may depend on outside tile providers and have fewer editable layer controls.</p>
          </div>
          <template v-if="sections.minimalistTileStyles">
            <p class="text-[10px] mt-3 mb-1.5" style="color: #A8A29E;">Tile style</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button v-for="ts in TILE_STYLES" :key="ts.value"
                class="text-[10px] text-center cursor-pointer transition-colors font-semibold border-none"
                style="border-radius: 8px; border: 1.5px solid; padding: 6px 6px;"
                :style="(local.base_tile_style ?? 'carto-light') === ts.value
                  ? 'background: #DCEBE2; border-color: #2D6A4F; color: #1F4D38;'
                  : 'background: white; border-color: #E7E5E4; color: #78716C;'"
                @click="set('base_tile_style', ts.value)"
              >{{ ts.label }}</button>
            </div>
          </template>
          <template v-if="sections.naturalTopoTileStyles">
            <p class="text-[10px] mt-3 mb-1.5" style="color: #A8A29E;">Tile variant</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button v-for="ts in TOPO_TILE_STYLES" :key="ts.value"
                class="text-[10px] text-center cursor-pointer transition-colors font-semibold border-none"
                style="border-radius: 8px; border: 1.5px solid; padding: 6px 6px;"
                :style="(local.base_tile_style ?? 'maptiler-outdoor') === ts.value
                  ? 'background: #DCEBE2; border-color: #2D6A4F; color: #1F4D38;'
                  : 'background: white; border-color: #E7E5E4; color: #78716C;'"
                @click="set('base_tile_style', ts.value)"
              >{{ ts.label }}</button>
            </div>
          </template>
          <div v-if="local.map_frozen" class="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg" style="background: #DCEBE2; border: 1px solid #2D6A4F;">
            <div class="w-1.5 h-1.5 rounded-full shrink-0" style="background: #2D6A4F;" />
            <p class="text-[10px] leading-snug flex-1" style="color: #1F4D38;">View frozen at Z{{ local.map_zoom?.toFixed(1) }} · position locked</p>
          </div>
        </V4Card>

        <V4Card title="Viewpoint" :default-open="true">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold" :style="local.map_frozen ? 'color: #1F4D38;' : 'color: #78716C;'">
              {{ local.map_frozen ? `Locked at Z${local.map_zoom?.toFixed(1) ?? '—'}` : 'Editable view' }}
            </span>
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :style="local.map_frozen ? 'background: #2D6A4F;' : 'background: #A8A29E;'"
            />
          </div>
          <div class="grid grid-cols-2 gap-1.5 mt-3">
            <button
              v-if="local.map_frozen"
              class="text-[10px] font-semibold rounded-lg cursor-pointer transition-colors"
              style="padding: 8px 10px; border: 1.5px solid #2D6A4F; background: #DCEBE2; color: #1F4D38;"
              @click="emit('request-view-edit')"
            >Edit view</button>
            <button
              v-else
              class="text-[10px] font-semibold rounded-lg cursor-pointer transition-colors"
              style="padding: 8px 10px; border: 1.5px solid #2D6A4F; background: #DCEBE2; color: #1F4D38;"
              @click="emit('request-view-lock')"
            >Set view</button>
            <button
              class="text-[10px] font-semibold rounded-lg cursor-pointer transition-colors"
              style="padding: 8px 10px; border: 1.5px solid #E7E5E4; background: white; color: #57534E;"
              @click="emit('request-view-reset')"
            >Reset route</button>
          </div>
        </V4Card>

        <V4Card
          v-if="isAtlasPresetActive && showAtlasEditor"
          title="Map layers"
          hint="Owned Atlas vector layers; each can be styled or hidden"
          :default-open="true"
        >
          <div class="grid grid-cols-3 gap-1.5 mb-3">
            <button
              v-for="layer in ATLAS_LAYER_OPTIONS"
              :key="layer.id"
              class="text-left rounded-lg cursor-pointer transition-colors"
              style="border: 1.5px solid; padding: 7px 7px; min-height: 42px;"
              :style="activeAtlasLayerId === layer.id
                ? 'background: #DCEBE2; border-color: #2D6A4F; color: #1F4D38;'
                : atlasLayerVisible(layer.id)
                  ? 'background: white; border-color: #D6D3D1; color: #44403C;'
                  : 'background: #FAFAF9; border-color: #E7E5E4; color: #A8A29E;'"
              @click="activeAtlasLayerId = layer.id"
            >
              <span class="block text-[10px] font-bold leading-tight">{{ layer.label }}</span>
              <span class="block text-[8px] uppercase font-bold mt-1" style="letter-spacing: 0.10em;">
                {{ atlasLayerVisible(layer.id) ? 'on' : 'off' }}
              </span>
            </button>
          </div>

          <div class="pt-2" style="border-top: 1px solid #F5F5F4;">
            <ToggleRow
              :label="`${activeAtlasLayerOption.label} layer`"
              :value="atlasLayerVisible(activeAtlasLayerId)"
              @change="setAtlasLayerVisible(activeAtlasLayerId, $event)"
            />

            <template v-if="activeAtlasLayerId === 'contour' && atlasLayerVisible('contour')">
              <SliderRow label="Density" :value="local.contour_detail ?? 3" :min="0" :max="5" :step="1"
                :display="(v: number) => (['regional','broad','medium','detailed','dense','ultra'] as const)[Math.round(v)]"
                @change="set('contour_detail', $event)" />
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs" style="color: #44403C;">Minor / index</span>
                <div class="flex gap-2">
                  <ColorSwatch :value="atlasContourMinorColor" title="Minor contour color" @change="setAtlasLayerSetting('contour', { minor_color: $event })" />
                  <ColorSwatch :value="atlasContourMajorColor" title="Index contour color" @change="setAtlasLayerSetting('contour', { major_color: $event, index_color: $event })" />
                </div>
              </div>
              <SliderRow label="Opacity" :value="atlasContourOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('contour', { minor_opacity: $event, index_opacity: $event, major_opacity: $event })" />
              <ToggleRow label="Elevation labels" :value="atlasContourLabels" @change="setAtlasLayerSetting('contour', { labels: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'water' && atlasLayerVisible('water')">
              <ColorRow label="Water fill" :value="atlasWaterFillColor" @change="setAtlasLayerSetting('water', { fill_color: $event })" />
              <SliderRow label="Opacity" :value="atlasWaterOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('water', { fill_opacity: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'waterway' && atlasLayerVisible('waterway')">
              <ColorRow label="River color" :value="atlasWaterwayColor" @change="setAtlasLayerSetting('waterway', { color: $event })" />
              <SliderRow label="Opacity" :value="atlasWaterwayOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('waterway', { opacity: $event })" />
              <SliderRow label="Width" :value="atlasWaterwayWidth" :min="0.25" :max="4" :step="0.25"
                :display="(v: number) => v.toFixed(2) + '×'"
                @change="setAtlasLayerSetting('waterway', { width: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'park' && atlasLayerVisible('park')">
              <ColorRow label="Park fill" :value="atlasParkFillColor" @change="setAtlasLayerSetting('park', { fill_color: $event })" />
              <SliderRow label="Opacity" :value="atlasParkOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('park', { opacity: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'landcover' && atlasLayerVisible('landcover')">
              <ColorRow label="Land color" :value="atlasLandcoverColor" @change="setAtlasLayerSetting('landcover', { color: $event })" />
              <SliderRow label="Opacity" :value="atlasLandcoverOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('landcover', { opacity: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'transportation' && atlasLayerVisible('transportation')">
              <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Major roads</span>
                  <div class="flex items-center gap-2">
                    <ToggleSwitch :value="atlasShowMajorRoads" @change="setAtlasLayerSetting('transportation', { show_major: $event })" />
                    <ColorSwatch :value="atlasRoadMajorColor" title="Major roads" @change="setAtlasLayerSetting('transportation', { major_color: $event, road_color: $event })" />
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Minor roads</span>
                  <div class="flex items-center gap-2">
                    <ToggleSwitch :value="atlasShowMinorRoads" @change="setAtlasLayerSetting('transportation', { show_minor: $event })" />
                    <ColorSwatch :value="atlasRoadMinorColor" title="Minor roads" @change="setAtlasLayerSetting('transportation', { minor_color: $event })" />
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Trails</span>
                  <div class="flex items-center gap-2">
                    <ToggleSwitch :value="atlasShowTrails" @change="setAtlasLayerSetting('transportation', { show_trails: $event })" />
                    <ColorSwatch :value="atlasTrailColor" title="Trails" @change="setAtlasLayerSetting('transportation', { trail_color: $event })" />
                  </div>
                </div>
              </div>
              <SliderRow label="Opacity" :value="atlasRoadOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('transportation', { opacity: $event })" />
              <SliderRow v-if="atlasShowMajorRoads" label="Major width" :value="atlasRoadMajorWidth" :min="0.5" :max="8" :step="0.25"
                :display="(v: number) => v.toFixed(2) + '×'"
                @change="setAtlasLayerSetting('transportation', { major_width: $event })" />
              <SliderRow v-if="atlasShowMinorRoads" label="Minor width" :value="atlasRoadMinorWidth" :min="0.25" :max="6" :step="0.25"
                :display="(v: number) => v.toFixed(2) + '×'"
                @change="setAtlasLayerSetting('transportation', { minor_width: $event })" />
              <SliderRow v-if="atlasShowTrails" label="Trail width" :value="atlasTrailWidth" :min="0.25" :max="5" :step="0.25"
                :display="(v: number) => v.toFixed(2) + '×'"
                @change="setAtlasLayerSetting('transportation', { trail_width: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'building' && atlasLayerVisible('building')">
              <ColorRow label="Building fill" :value="atlasBuildingFillColor" @change="setAtlasLayerSetting('building', { fill_color: $event })" />
              <SliderRow label="Opacity" :value="atlasBuildingOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('building', { opacity: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'place' && atlasLayerVisible('place')">
              <ColorRow label="Label color" :value="atlasPlaceLabelColor" @change="setAtlasLayerSetting('place', { label_color: $event })" />
              <SliderRow label="Label opacity" :value="atlasPlaceLabelOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('place', { label_opacity: $event })" />
              <SliderRow label="Label scale" :value="atlasPlaceFontSize" :min="7" :max="20" :step="1"
                :display="(v: number) => Math.round(v) + 'pt'"
                @change="setAtlasLayerSetting('place', { font_size: $event })" />
            </template>

            <template v-else-if="activeAtlasLayerId === 'poi' && atlasLayerVisible('poi')">
              <ColorRow label="POI label" :value="atlasPoiLabelColor" @change="setAtlasLayerSetting('poi', { label_color: $event })" />
              <SliderRow label="Label opacity" :value="atlasPoiLabelOpacity" :min="0" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="setAtlasLayerSetting('poi', { label_opacity: $event })" />
            </template>
          </div>
        </V4Card>

        <V4Card v-if="sections.mapDetailCard" title="Map detail" :default-open="true">
          <ToggleRow v-if="sections.roadsToggle" label="Roads" :value="local.show_roads ?? false" @change="set('show_roads', $event)" />
          <template v-if="sections.roadsExpanded">
            <div v-if="sections.roadColorControl" class="flex items-center justify-between mb-2 mt-2">
              <span class="text-xs" style="color: #44403C;">Road color</span>
              <ColorSwatch :value="local.roads_color ?? local.label_text_color" @change="set('roads_color', $event)" />
            </div>
            <SliderRow v-if="sections.roadOpacityControl" label="Road opacity" :value="local.roads_opacity ?? 0.6" :min="0.05" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('roads_opacity', $event)" />
          </template>
          <div v-if="sections.roadsExpanded && (sections.placeLabelsToggle || sections.poiToggle)" class="pt-2 border-t border-[#F5F5F4] mt-1" />
          <ToggleRow v-if="sections.placeLabelsToggle" label="Map labels" :value="local.show_place_labels !== false" @change="set('show_place_labels', $event)" />
          <template v-if="sections.placeLabelDetails && local.show_place_labels !== false">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs" style="color: #44403C;">Label color</span>
                <ColorSwatch :value="local.place_labels_color ?? local.label_text_color" @change="set('place_labels_color', $event)" />
              </div>
              <SliderRow label="Label opacity" :value="local.place_labels_opacity ?? 0.75" :min="0.05" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'" @change="set('place_labels_opacity', $event)" />
              <div>
                <p class="text-xs mb-1.5" style="color: #44403C;">Density</p>
                <div class="grid grid-cols-3 gap-1.5">
                  <SegmentButton label="Cities" :active="local.place_labels_scale === 'city'" @click="set('place_labels_scale', 'city')" />
                  <SegmentButton label="+ Towns" :active="(local.place_labels_scale ?? 'town') === 'town'" @click="set('place_labels_scale', 'town')" />
                  <SegmentButton label="+ Villages" :active="local.place_labels_scale === 'village'" @click="set('place_labels_scale', 'village')" />
                </div>
              </div>
          </template>
          <div v-if="sections.poiToggle" class="pt-2 border-t border-[#F5F5F4] mt-1" />
          <ToggleRow v-if="sections.poiToggle" label="Points of interest" :value="local.show_poi_labels ?? false" @change="set('show_poi_labels', $event)" />
          <template v-if="sections.poiDetails && local.show_poi_labels">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs" style="color: #44403C;">POI color</span>
                <ColorSwatch :value="local.poi_labels_color ?? local.label_text_color" @change="set('poi_labels_color', $event)" />
              </div>
            <SliderRow label="POI opacity" :value="local.poi_labels_opacity ?? 0.65" :min="0.05" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('poi_labels_opacity', $event)" />
          </template>
        </V4Card>

        <V4Card v-if="sections.waterCard" title="Water" :default-open="sections.waterColorControl">
          <ColorRow v-if="sections.waterColorControl" label="Water color" :value="local.water_color" @change="set('water_color', $event)" />
          <p v-else-if="sections.waterBakedNotice" class="text-[10px] leading-snug" style="color: #78716C;">
            Water is baked into this raster tile style. Use Contour Art or Road Net for editable vector water color.
          </p>
          <p v-else-if="sections.waterThemeLockedNotice" class="text-[10px] leading-snug" style="color: #78716C;">
            Water follows this preset's ink treatment.
          </p>
        </V4Card>

        <V4Card v-if="sections.routeMapCard" title="Route" :default-open="false">
          <ToggleRow v-if="sections.routeAdvancedControls" label="Elevation gradient" :value="(local.route_color_mode ?? 'solid') === 'gradient'"
            @change="setRouteLineStyle('route_color_mode', $event ? 'gradient' : 'solid')" />
          <ColorRow v-if="sections.routeColorControl" label="Color" :value="local.route_color" @change="setRouteLineStyle('route_color', $event)" />
          <SliderRow v-if="sections.routeWidthControl" label="Width" :value="local.route_width" :min="1" :max="10" :step="0.5"
            :display="(v: number) => v + 'px'" @change="setRouteLineStyle('route_width', $event)" />
          <SliderRow v-if="sections.routeOpacityControl" label="Opacity" :value="local.route_opacity" :min="0.1" :max="1" :step="0.05"
            :display="(v: number) => Math.round(v * 100) + '%'" @change="setRouteLineStyle('route_opacity', $event)" />
          <SliderRow v-if="sections.routeAdvancedControls" label="Smooth" :value="local.route_smooth ?? 0" :min="0" :max="10" :step="1"
            :display="(v: number) => v === 0 ? 'Off' : v === 10 ? 'Max' : String(v)"
            @change="setRouteLineStyle('route_smooth', $event)" />
          <div class="pt-2 border-t border-[#F5F5F4] mt-1" />
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] font-semibold uppercase" style="letter-spacing: 0.14em; color: #A8A29E;">Crop route</p>
            <div class="flex gap-1">
              <button
                @click="emit('request-plot', { segId: 'route-crop', field: 'start' })"
                class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                :style="activePlotMode?.segId === 'route-crop' && activePlotMode?.field === 'start' ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
              >↗ Start</button>
              <button
                @click="emit('request-plot', { segId: 'route-crop', field: 'end' })"
                class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                :style="activePlotMode?.segId === 'route-crop' && activePlotMode?.field === 'end' ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
              >↗ End</button>
            </div>
          </div>
          <SliderRow label="Start" :value="local.route_crop_start ?? 0" :min="0" :max="100" :step="segmentDistanceStepPct" :display="segmentPctDisplay" @change="set('route_crop_start', Math.min($event, (local.route_crop_end ?? 100) - segmentDistanceStepPct))" />
          <SliderRow label="End" :value="local.route_crop_end ?? 100" :min="0" :max="100" :step="segmentDistanceStepPct" :display="segmentPctDisplay" @change="set('route_crop_end', Math.max($event, (local.route_crop_start ?? 0) + segmentDistanceStepPct))" />
          <div class="pt-2 border-t border-[#F5F5F4] mt-1" />
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] font-semibold uppercase" style="letter-spacing: 0.14em; color: #A8A29E;">Delete sections</p>
            <div class="flex gap-1">
              <button
                @click="emit('request-brush-delete')"
                class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                :style="activeDeleteBrush ? 'background:#FEE2E2;color:#991B1B;border:1px solid #EF4444;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
              >Brush erase</button>
              <button
                @click="emit('request-plot', { segId: 'route-delete-pending', field: 'start' })"
                class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                :style="isDeletePlotActive ? 'background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
              >+ Delete range</button>
              <button
                @click="emit('request-detect-disconnected')"
                class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                style="background:white;color:#78716C;border:1px solid #E7E5E4;"
                title="Auto-detect and hide GPS gaps"
              >Auto-detect</button>
            </div>
          </div>
          <div v-if="isDeletePlotActive" class="mb-2 px-2 py-1.5 rounded-lg text-[10px]" style="background:#FEF9C3;color:#78350F;">
            {{ activePlotMode?.field === 'start' ? 'Click route: mark delete start…' : 'Click route: mark delete end…' }}
          </div>
          <div v-if="activeDeleteBrush" class="mb-2">
            <SliderRow
              label="Brush size"
              :value="deleteBrushSize ?? 8"
              :min="3"
              :max="24"
              :step="1"
              :display="(v: number) => Math.round(v) + ' px'"
              @change="emit('update-brush-size', $event)"
            />
          </div>
          <div v-if="(local.route_deleted_ranges ?? []).length > 0" class="space-y-1 mb-2">
            <div
              v-for="(range, i) in (local.route_deleted_ranges ?? [])"
              :key="i"
              class="flex items-center justify-between px-2 py-1.5 rounded-lg"
              style="background:#FEF2F2;border:1px solid #FECACA;"
            >
              <span class="text-[10px]" style="color:#7F1D1D;">
                {{ segmentPctDisplay(range.start) }} → {{ segmentPctDisplay(range.end) }}
              </span>
              <button
                @click="removeDeletedRange(i)"
                class="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                style="color:#EF4444;background:none;border:none;"
                title="Restore this section"
              >✕</button>
            </div>
            <button
              @click="set('route_deleted_ranges', [])"
              class="w-full mt-1 py-1 rounded-lg text-[10px] cursor-pointer"
              style="border:1px solid #E7E5E4;color:#78716C;background:white;"
            >↺ Restore all sections</button>
          </div>
          <template v-if="sections.routeAdvancedControls">
            <div class="pt-1 border-t border-[#F5F5F4] mt-1 mb-3" />
            <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Pins</p>
            <div class="space-y-2">
              <ToggleRow label="Show start" :value="local.show_start_pin ?? true" @change="set('show_start_pin', $event)" />
              <ToggleRow label="Show finish" :value="local.show_finish_pin ?? true" @change="set('show_finish_pin', $event)" />
            </div>
            <template v-if="sections.pinControls">
              <div class="flex items-center justify-between mt-2">
                <span class="text-xs" style="color: #44403C;">Pin color</span>
                <ColorSwatch :value="local.pin_color ?? contrastSafePinColor" @change="set('pin_color', $event)" />
              </div>
              <SliderRow label="Pin opacity" :value="local.pin_opacity ?? 0.9" :min="0.1" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'" @change="set('pin_opacity', $event)" />
            </template>
          </template>
        </V4Card>

        <V4Card v-if="sections.terrainCard" title="Terrain" :default-open="false">
          <ToggleRow v-if="sections.terrain3dControls" label="3D terrain" :value="local.map_3d ?? false" @change="set3DTerrain($event)" />
          <template v-if="sections.terrain3dControls && local.map_3d">
            <SliderRow label="Perspective" :value="local.map_pitch ?? 45" :min="0" :max="70" :step="1"
              :display="(v: number) => Math.round(v) + '°'" @change="set('map_pitch', $event)" />
            <SliderRow label="Rotation" :value="local.map_bearing ?? 0" :min="-180" :max="180" :step="1"
              :display="(v: number) => Math.round(v) + '°'" @change="set('map_bearing', $event)" />
            <SliderRow label="Relief" :value="local.terrain_exaggeration ?? 1.5" :min="0.5" :max="3" :step="0.1"
              :display="(v: number) => v.toFixed(1) + '×'" @change="set('terrain_exaggeration', $event)" />
            <div class="pt-2 border-t border-[#F5F5F4] mt-1 mb-3" />
          </template>
          <ToggleRow v-if="sections.hillshadeToggle" label="Hillshade" :value="local.show_hillshade" @change="set('show_hillshade', $event)" />
          <template v-if="sections.hillshadeDetails">
            <SliderRow label="Intensity" :value="local.hillshade_intensity" :min="0" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('hillshade_intensity', $event)" />
          </template>
        </V4Card>

        <V4Card v-if="sections.contourToggle || sections.contourDetails || sections.elevationProfileToggle" title="Contour Lines" :default-open="false">
          <ToggleRow v-if="sections.contourToggle" label="Show contours" :value="local.show_contours" @change="setContours($event)" />
          <template v-if="sections.contourDetails && sections.contourStyleControls">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs" style="color: #44403C;">Minor / Major color</span>
              <div class="flex gap-2">
                <ColorSwatch :value="local.contour_color" @change="setContourControl('contour_color', $event)" title="Minor" />
                <ColorSwatch :value="local.contour_major_color" @change="setContourControl('contour_major_color', $event)" title="Major" />
              </div>
            </div>
            <SliderRow label="Opacity" :value="local.contour_opacity" :min="0" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="setContourControl('contour_opacity', $event)" />
            <SliderRow label="Detail" :value="local.contour_detail ?? 2" :min="0" :max="5" :step="1"
              :display="(v: number) => (['~200m','~100m','~50m','~20m','~10m','~2m'] as const)[Math.round(v)]"
              @change="set('contour_detail', $event)" />
            <SliderRow label="Minor weight" :value="local.contour_minor_width ?? 1" :min="0.25" :max="2.5" :step="0.25"
              :display="(v: number) => v + '×'" @change="setContourControl('contour_minor_width', $event)" />
            <SliderRow label="Major weight" :value="local.contour_major_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH" :min="0.25" :max="2.5" :step="0.25"
              :display="(v: number) => v + '×'" @change="setContourControl('contour_major_width', $event)" />
            <ToggleRow label="Elevation labels" :value="local.show_elevation_labels"
              @change="setContourLabels($event)" />
          </template>
          <template v-if="sections.elevationProfileToggle">
            <ToggleRow label="Elevation profile" :value="local.show_elevation_profile ?? false" @change="set('show_elevation_profile', $event)" />
          </template>
          <template v-if="sections.elevationProfileExpanded">
            <div class="mb-3">
              <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Placement</p>
              <div class="grid grid-cols-2 gap-1.5">
                <SegmentButton label="Overlay" :active="elevationProfilePosition === 'map-overlay'" @click="set('elevation_profile_position', 'map-overlay')" />
                <SegmentButton label="Below map" :active="elevationProfilePosition === 'separate-band'" @click="set('elevation_profile_position', 'separate-band')" />
              </div>
            </div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs" style="color: #44403C;">Profile color</span>
              <ColorSwatch :value="local.elevation_profile_color ?? local.route_color" @change="set('elevation_profile_color', $event)" />
            </div>
            <SliderRow label="Opacity" :value="local.elevation_profile_opacity ?? 0.65" :min="0.1" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('elevation_profile_opacity', $event)" />
            <SliderRow label="Height" :value="local.elevation_profile_height ?? elevationProfileHeightDefault" :min="elevationProfileHeightMin" :max="elevationProfileHeightMax" :step="1"
              :display="(v: number) => elevationProfilePosition === 'separate-band' ? Math.round(v) + 'cqh' : Math.round(v) + '%'" @change="set('elevation_profile_height', $event)" />
            <SliderRow label="Relief" :value="local.elevation_profile_relief ?? 0.65" :min="0.35" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('elevation_profile_relief', $event)" />
          </template>
        </V4Card>

        <V4Card v-if="sections.effectsCard" title="Effects" hint="Advanced — invert, duotone, posterize, grain" :default-open="false">
          <div v-if="sections.rasterEffectControls" class="mb-3">
            <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Tile effect</p>
            <div class="grid grid-cols-2 gap-1.5">
              <SegmentButton label="None"        :active="(local.tile_effect ?? 'none') === 'none'"   @click="set('tile_effect', 'none')" />
              <SegmentButton label="Invert"      :active="local.tile_effect === 'invert'"             @click="set('tile_effect', 'invert')" />
              <SegmentButton label="Duotone"     :active="local.tile_effect === 'duotone'"             @click="set('tile_effect', 'duotone')" />
              <SegmentButton label="Posterize"   :active="local.tile_effect === 'posterize'"           @click="set('tile_effect', 'posterize')" />
              <SegmentButton label="Layer Color" :active="local.tile_effect === 'layer-color'"         @click="set('tile_effect', 'layer-color')" />
            </div>
          </div>
          <template v-if="sections.duotoneControls">
            <p class="text-[10px] mb-2" style="color: #A8A29E;">Remaps tile luminance to your poster's shadow → highlight colours</p>
            <SliderRow label="Strength" :value="local.tile_duotone_strength ?? 0.9" :min="0.1" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('tile_duotone_strength', $event)" />
          </template>
          <template v-if="sections.posterizeControls">
            <p class="text-[10px] mb-2" style="color: #A8A29E;">Quantises tile colours to a limited palette — screen-print look</p>
            <SliderRow label="Levels" :value="local.tile_posterize_levels ?? 4" :min="2" :max="8" :step="1"
              :display="(v: number) => Math.round(v) + ' colours'" @change="set('tile_posterize_levels', $event)" />
          </template>
          <template v-if="sections.layerColorControls">
            <p class="text-[10px] mb-2" style="color: #A8A29E;">Maps dark / mid / light tile regions to independent colours</p>
            <ColorRow label="Shadow (dark)" :value="local.tile_shadow_color ?? local.label_text_color" @change="set('tile_shadow_color', $event)" />
            <ColorRow label="Midtone" :value="local.tile_midtone_color ?? blendForPreview(local.tile_shadow_color ?? local.label_text_color, local.tile_highlight_color ?? local.background_color)" @change="set('tile_midtone_color', $event)" />
            <ColorRow label="Highlight (light)" :value="local.tile_highlight_color ?? local.background_color" @change="set('tile_highlight_color', $event)" />
          </template>
          <template v-if="sections.rasterEffectControls">
            <div class="pt-2 border-t border-[#F5F5F4] mt-1 mb-3" />
            <SliderRow label="Contrast" :value="local.tile_contrast ?? 0" :min="-1" :max="1" :step="0.05"
              :display="(v: number) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%'" @change="set('tile_contrast', $event)" />
            <SliderRow label="Saturation" :value="local.tile_saturation ?? 0" :min="-1" :max="1" :step="0.05"
              :display="(v: number) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%'" @change="set('tile_saturation', $event)" />
            <SliderRow label="Hue shift" :value="local.tile_hue_rotate ?? 0" :min="0" :max="360" :step="5"
              :display="(v: number) => Math.round(v) + '°'" @change="set('tile_hue_rotate', $event)" />
          </template>
          <div class="pt-2 border-t border-[#F5F5F4] mt-1 mb-3" />
          <ToggleRow v-if="sections.vignetteControls" label="Vignette" :value="local.show_vignette ?? false" @change="set('show_vignette', $event)" />
          <template v-if="sections.vignetteIntensity">
            <SliderRow label="Intensity" :value="local.vignette_intensity ?? 0.45" :min="0.05" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('vignette_intensity', $event)" />
          </template>
          <SliderRow v-if="sections.grainControl" label="Grain" :value="local.tile_grain ?? 0" :min="0" :max="0.5" :step="0.02"
            :display="(v: number) => v === 0 ? 'Off' : Math.round(v * 100) + '%'" @change="set('tile_grain', $event)" />
        </V4Card>

        <V4Card v-if="sections.trailSegmentsCard" title="Trail segments" :default-open="false">
          <p class="text-[10px] mb-3" style="color: #A8A29E;">Name and color sections of your route to build a map legend</p>

          <div class="mb-3 space-y-1.5">
            <button
              class="w-full py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              :class="{ 'segment-save-pulse': activeSegmentDrawMode?.type === 'new' }"
              :style="activeSegmentDrawMode?.type === 'new'
                ? 'border: 2px solid #2D6A4F; color: #1F4D38; background: #DCEBE2;'
                : 'border: 2px dashed #E7E5E4; color: #57534E; background: #FAFAF9;'"
              :disabled="segmentDrawDisabled && activeSegmentDrawMode?.type !== 'new'"
              @click="activeSegmentDrawMode?.type === 'new' ? emit('request-segment-draw-save') : requestSegmentDraw({ type: 'new' })"
            >{{ activeSegmentDrawMode?.type === 'new' ? 'Save segment' : '+ Draw segment' }}</button>
            <p v-if="local.map_frozen" class="text-[10px] leading-snug" style="color: #A8A29E;">Starting a segment edit will unlock the map view.</p>
            <p v-else-if="segmentDrawDisabled" class="text-[10px] leading-snug" style="color: #A8A29E;">Finish the current map action before drawing a segment.</p>
          </div>

          <!-- Apply to all controls -->
          <template v-if="(local.trail_segments ?? []).length > 0">
            <div class="mb-3 p-2.5 rounded-xl" style="background: #F5F5F4;">
              <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.12em; color: #A8A29E;">Apply to all</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Width</span>
                  <input type="range" min="1" max="8" step="0.5" :value="(local.trail_segments ?? [])[0]?.width ?? DEFAULT_TRAIL_SEGMENT_WIDTH"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="applyToAll({ width: parseFloat(($event.target as HTMLInputElement).value) })" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 24px;">{{ ((local.trail_segments ?? [])[0]?.width ?? DEFAULT_TRAIL_SEGMENT_WIDTH) }}px</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Smooth</span>
                  <input type="range" min="0" max="10" step="1" :value="(local.trail_segments ?? [])[0]?.smooth ?? 0"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="applyToAll({ smooth: parseInt(($event.target as HTMLInputElement).value, 10) })" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 24px;">{{ segmentSmoothDisplay((local.trail_segments ?? [])[0]?.smooth ?? 0) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Border</span>
                  <input type="range" min="0" max="8" step="0.5" :value="local.segment_casing_width ?? DEFAULT_SEGMENT_CASING_WIDTH"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="set('segment_casing_width', parseFloat(($event.target as HTMLInputElement).value))" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 24px;">{{ local.segment_casing_width ?? DEFAULT_SEGMENT_CASING_WIDTH }}px</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Border color</span>
                  <label class="relative flex items-center gap-1.5 cursor-pointer">
                    <span class="text-[10px]" style="color: #78716C;">Pick →</span>
                    <div class="w-5 h-5 rounded-full border border-stone-200" :style="{ backgroundColor: local.segment_casing_color ?? '#FFFFFF' }" />
                    <input type="color" :value="local.segment_casing_color ?? '#FFFFFF'"
                      class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      @change="set('segment_casing_color', ($event.target as HTMLInputElement).value)" />
                  </label>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Dot size</span>
                  <input type="range" min="0.5" max="2.5" step="0.25" :value="Math.min(local.segment_dot_size ?? 1.5, 2.5)"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="set('segment_dot_size', parseFloat(($event.target as HTMLInputElement).value))" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 24px;">{{ Math.min(local.segment_dot_size ?? 1.5, 2.5) }}px</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Labels</span>
                  <input type="range" min="0.5" max="2" step="0.05" :value="local.leader_label_scale ?? 1.0"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="set('leader_label_scale', parseFloat(($event.target as HTMLInputElement).value))" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 28px;">{{ Math.round((local.leader_label_scale ?? 1.0) * 100) }}%</span>
                </div>
                <ToggleRow label="Auto-fit labels" :value="local.leader_label_auto_fit !== false" @change="set('leader_label_auto_fit', $event)" />
                <div>
                  <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.12em; color: #A8A29E;">Label font</p>
                  <div class="grid grid-cols-2 gap-1.5">
                    <SegmentButton label="Poster" :active="!local.leader_label_font_family" @click="set('leader_label_font_family', undefined)" />
                    <SegmentButton
                      v-for="font in PIN_FONTS"
                      :key="font.id"
                      :label="font.label"
                      :active="local.leader_label_font_family === font.id"
                      @click="set('leader_label_font_family', font.id)"
                    />
                  </div>
                </div>
                <button
                  class="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  style="border: 1px solid #E7E5E4; color: #78716C; background: white;"
                  @click="applyTrailLabelTypographyAuto"
                >Auto select typography</button>
                <div class="flex items-center justify-between pt-1">
                  <span class="text-xs" style="color: #44403C;">Color</span>
                  <label class="relative flex items-center gap-1.5 cursor-pointer">
                    <span class="text-[10px]" style="color: #78716C;">Pick →</span>
                    <div class="w-5 h-5 rounded-full border border-stone-200" :style="{ backgroundColor: (local.trail_segments ?? [])[0]?.color ?? '#888' }" />
                    <input type="color" :value="(local.trail_segments ?? [])[0]?.color ?? '#888888'"
                      class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      @change="applyToAll({ color: ($event.target as HTMLInputElement).value })" />
                  </label>
                </div>
                <button
                  class="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer mt-1"
                  style="border: 1px solid #E7E5E4; color: #78716C; background: white;"
                  @click="resetLabelPositions"
                >↺ Reset label positions</button>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <div v-for="seg in (local.trail_segments ?? [])" :key="seg.id" class="overflow-hidden" style="border: 1px solid #F5F5F4; border-radius: 12px;">
              <div class="flex items-center gap-2 px-3 py-2.5" style="background: #FAFAF9;">
                <div class="w-3 h-3 rounded-full shrink-0" style="border: 1px solid white; box-shadow: 0 0 0 1px #E7E5E4;" :style="{ backgroundColor: seg.color }" />
                <input :value="seg.name" class="flex-1 text-xs bg-transparent border-none outline-none min-w-0" style="color: #1C1917;" placeholder="Trail name…" @input="setSegment(seg.id, { name: ($event.target as HTMLInputElement).value })" />
                <button class="shrink-0 transition-colors cursor-pointer" style="color: #A8A29E; background: none; border: none; padding: 0;" :title="seg.visible ? 'Hide' : 'Show'" @click="setSegment(seg.id, { visible: !seg.visible })">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path v-if="seg.visible" d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path v-if="seg.visible" fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                    <path v-else fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <button class="transition-colors shrink-0 cursor-pointer" style="color: #D6D3D1; background: none; border: none; padding: 0;" @click="expandedSegmentId = expandedSegmentId === seg.id ? null : seg.id">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path v-if="expandedSegmentId === seg.id" fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
                    <path v-else fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <button class="transition-colors shrink-0 cursor-pointer" style="color: #D6D3D1; background: none; border: none; padding: 0;" @click="removeSegment(seg.id)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
              </div>
              <div v-if="expandedSegmentId === seg.id" class="px-3 py-3 space-y-3" style="border-top: 1px solid #F5F5F4;">
                <div>
                  <p class="text-xs mb-2" style="color: #44403C;">Color</p>
                  <div class="grid grid-cols-2 gap-1.5 mb-2">
                    <SegmentButton label="Solid" :active="(seg.color_mode ?? 'solid') === 'solid'" @click="setSegment(seg.id, { color_mode: 'solid' })" />
                    <SegmentButton label="Gradient" :active="seg.color_mode === 'gradient'" @click="setSegment(seg.id, { color_mode: 'gradient' })" />
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button v-for="c in SEGMENT_COLORS" :key="c" class="w-6 h-6 rounded-full border-2 transition-all cursor-pointer" :style="{ backgroundColor: c, borderColor: seg.color === c ? '#2D6A4F' : 'white', boxShadow: seg.color === c ? 'none' : '0 0 0 1px #E7E5E4', transform: seg.color === c ? 'scale(1.1)' : 'scale(1)' }" @click="setSegment(seg.id, { color: c })" />
                    <label class="relative w-6 h-6 rounded-full flex items-center justify-center cursor-pointer overflow-hidden" style="border: 2px dashed #D6D3D1;" title="Custom color">
                      <svg class="w-3 h-3 pointer-events-none" style="color: #A8A29E;" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
                      <input type="color" :value="seg.color" class="absolute inset-0 opacity-0 w-full h-full cursor-pointer" @input="setSegment(seg.id, { color: ($event.target as HTMLInputElement).value })" />
                    </label>
                  </div>
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <p class="text-xs" style="color: #44403C;">{{ isGeometryBackedSegmentSource(seg) ? 'Track section' : 'Route section' }}</p>
                    <div v-if="!isGeometryBackedSegmentSource(seg)" class="flex gap-1">
                      <button
                        @click="emit('request-plot', { segId: seg.id, field: 'start' })"
                        class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                        :style="activePlotMode?.segId === seg.id && activePlotMode?.field === 'start' ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
                      >↗ Start</button>
                      <button
                        @click="emit('request-plot', { segId: seg.id, field: 'end' })"
                        class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                        :style="activePlotMode?.segId === seg.id && activePlotMode?.field === 'end' ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
                      >↗ End</button>
                    </div>
                  </div>
                  <div v-if="isGeometryBackedSegmentSource(seg)" class="grid grid-cols-2 gap-1">
                    <button
                      class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      :class="{ 'segment-save-pulse': isActiveSegmentExtension(seg.id, 'start') }"
                      :disabled="segmentDrawDisabled && !isActiveSegmentExtension(seg.id, 'start')"
                      :style="isActiveSegmentExtension(seg.id, 'start') ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
                      @click="isActiveSegmentExtension(seg.id, 'start') ? emit('request-segment-draw-save') : requestSegmentDraw({ type: 'extend', segId: seg.id, end: 'start' })"
                    >{{ isActiveSegmentExtension(seg.id, 'start') ? 'Save' : 'Extend start' }}</button>
                    <button
                      class="text-[10px] px-2 py-1 rounded cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      :class="{ 'segment-save-pulse': isActiveSegmentExtension(seg.id, 'end') }"
                      :disabled="segmentDrawDisabled && !isActiveSegmentExtension(seg.id, 'end')"
                      :style="isActiveSegmentExtension(seg.id, 'end') ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
                      @click="isActiveSegmentExtension(seg.id, 'end') ? emit('request-segment-draw-save') : requestSegmentDraw({ type: 'extend', segId: seg.id, end: 'end' })"
                    >{{ isActiveSegmentExtension(seg.id, 'end') ? 'Save' : 'Extend end' }}</button>
                  </div>
                  <button
                    v-if="isGeometryBackedSegmentSource(seg)"
                    class="w-full text-[10px] px-2 py-1.5 rounded cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    :class="{ 'segment-save-pulse': isActiveSegmentEdit(seg.id) }"
                    :disabled="segmentEditDisabled && !isActiveSegmentEdit(seg.id)"
                    :style="isActiveSegmentEdit(seg.id) ? 'background:#DCEBE2;color:#1F4D38;border:1px solid #2D6A4F;' : 'background:white;color:#78716C;border:1px solid #E7E5E4;'"
                    @click="isActiveSegmentEdit(seg.id) ? emit('request-segment-edit-cancel') : requestSegmentEdit(seg.id)"
                  >{{ isActiveSegmentEdit(seg.id) ? 'Save points' : 'Edit points' }}</button>
                  <p v-if="seg.source_filename" class="text-[10px]" style="color: #A8A29E;">{{ seg.source_filename }}</p>
                  <SliderRow label="Start" :value="seg.section_start" :min="0" :max="100" :step="segmentStep(seg)" :display="isGeometryBackedSegmentSource(seg) ? segmentPercentDisplay : segmentPctDisplay" @change="setSegment(seg.id, { section_start: Math.min($event, seg.section_end - segmentStep(seg)) })" />
                  <SliderRow label="End" :value="seg.section_end" :min="0" :max="100" :step="segmentStep(seg)" :display="isGeometryBackedSegmentSource(seg) ? segmentPercentDisplay : segmentPctDisplay" @change="setSegment(seg.id, { section_end: Math.max($event, seg.section_start + segmentStep(seg)) })" />
                </div>
                <SliderRow label="Width" :value="seg.width ?? local.route_width ?? DEFAULT_TRAIL_SEGMENT_WIDTH" :min="1" :max="8" :step="0.5" :display="(v: number) => v + 'px'" @change="setSegment(seg.id, { width: $event })" />
                <SliderRow label="Smooth" :value="seg.smooth ?? 0" :min="0" :max="10" :step="1" :display="segmentSmoothDisplay" @change="setSegment(seg.id, { smooth: $event })" />
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Dashed</span>
                  <button class="px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer" style="border: 1px solid;" :style="seg.dash ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; color: #78716C; background: white;'" @click="setSegment(seg.id, { dash: !seg.dash })">- - -</button>
                </div>
              </div>
            </div>
            <button class="w-full py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer" style="border: 2px dashed #E7E5E4; color: #A8A29E; background: transparent;" @click="addSegment">+ Add segment</button>
            <template v-if="trackUploadAvailable">
              <input
                ref="trackUploadInputRef"
                type="file"
                accept=".gpx,application/gpx+xml"
                class="hidden"
                @change="handleTrackUploadInput"
              />
              <button
                class="w-full py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                style="border: 2px dashed #D6D3D1; color: #57534E; background: #FAFAF9;"
                :disabled="trackUploadLoading"
                @click="trackUploadInputRef?.click()"
              >{{ trackUploadLoading ? 'Importing GPX…' : '+ Upload GPX track' }}</button>
              <p v-if="trackUploadError" class="text-[10px] leading-snug" style="color: #B91C1C;">{{ trackUploadError }}</p>
            </template>
            <template v-if="sections.trailLegendControls">
              <div class="pt-2 space-y-2.5" style="border-top: 1px solid #F5F5F4;">
                <div>
                  <p class="text-xs mb-1.5" style="color: #44403C;">Label display</p>
                  <div class="grid grid-cols-2 gap-1.5">
                    <SegmentButton label="Legend" :active="(local.trail_label_style ?? 'legend') === 'legend'" @click="set('trail_label_style', 'legend')" />
                    <SegmentButton label="Leader lines" :active="local.trail_label_style === 'leader-lines'" @click="set('trail_label_style', 'leader-lines')" />
                  </div>
                </div>
                <template v-if="(local.trail_label_style ?? 'legend') === 'legend'">
                  <ToggleRow label="Show legend" :value="local.trail_legend?.show ?? true" @change="setLegend({ show: $event })" />
                  <template v-if="local.trail_legend?.show !== false">
                    <div>
                      <p class="text-xs mb-2" style="color: #44403C;">Legend position</p>
                      <div class="grid grid-cols-2 gap-1.5">
                        <SegmentButton label="↙ Bottom left"  :active="(local.trail_legend?.position ?? 'bottom-left') === 'bottom-left'" @click="setLegend({ position: 'bottom-left' })" />
                        <SegmentButton label="↘ Bottom right" :active="local.trail_legend?.position === 'bottom-right'"                   @click="setLegend({ position: 'bottom-right' })" />
                        <SegmentButton label="↖ Top left"     :active="local.trail_legend?.position === 'top-left'"                       @click="setLegend({ position: 'top-left' })" />
                        <SegmentButton label="↗ Top right"    :active="local.trail_legend?.position === 'top-right'"                      @click="setLegend({ position: 'top-right' })" />
                      </div>
                    </div>
                  </template>
                </template>
                <ToggleRow label="Segment stats" :value="local.trail_show_stats ?? false" @change="set('trail_show_stats', $event)" />
                <template v-if="local.trail_show_stats">
                  <ToggleRow label="Elevation gain" :value="local.trail_show_elevation_gain !== false" @change="set('trail_show_elevation_gain', $event)" />
                </template>
              </div>
            </template>
          </div>
        </V4Card>

      </template>

      <!-- ─── STYLE TAB ─────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'style'">

        <V4Card v-if="sections.globalColorControls" title="Colors" hint="Auto-set by theme · override below" :default-open="true">
          <ColorRow label="Background" :value="local.background_color" @change="set('background_color', $event)" />
          <ColorRow label="Label band" :value="local.label_bg_color" @change="set('label_bg_color', $event)" />
          <ColorRow label="Text" :value="local.label_text_color" @change="set('label_text_color', $event)" />
        </V4Card>

        <V4Card v-if="sections.gridControls" title="Grid" hint="Optional poster or map overlay" :default-open="false">
          <ToggleRow label="Show grid" :value="local.show_grid ?? false" @change="set('show_grid', $event)" />
          <template v-if="local.show_grid">
            <div class="pt-3 mt-3" style="border-top: 1px solid #F5F5F4;">
              <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Apply to</p>
              <div class="grid grid-cols-2 gap-1.5 mb-3">
                <SegmentButton label="Poster" :active="(local.grid_scope ?? 'poster') === 'poster'" @click="set('grid_scope', 'poster')" />
                <SegmentButton label="Map only" :active="local.grid_scope === 'map'" @click="set('grid_scope', 'map')" />
              </div>
              <ColorRow label="Grid color" :value="local.grid_color ?? local.label_text_color" @change="set('grid_color', $event)" />
              <SliderRow
                label="Opacity"
                :value="local.grid_opacity ?? 0.2"
                :min="0.05"
                :max="1"
                :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'"
                @change="set('grid_opacity', $event)"
              />
              <SliderRow
                label="Weight"
                :value="local.grid_weight ?? 1"
                :min="0.5"
                :max="3"
                :step="0.25"
                :display="(v: number) => v.toFixed(v % 1 === 0 ? 0 : 2) + 'px'"
                @change="set('grid_weight', $event)"
              />
            </div>
          </template>
        </V4Card>

        <V4Card v-if="sections.typographyControls" title="Typography" :default-open="false">
          <div class="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg" style="background: #F5F5F4;">
            <div class="w-1.5 h-1.5 rounded-full shrink-0" style="background: #2D6A4F;" />
            <p class="text-[10px] leading-snug" style="color: #57534E;">
              <span class="font-semibold" style="color: #1C1917;">{{ activeThemeTypography }}</span> is set by your theme. Pick below to override.
            </p>
          </div>
          <template v-for="group in fontGroups" :key="group.label">
            <p class="text-[9px] font-semibold uppercase mb-1.5 mt-3 first:mt-0" style="letter-spacing: 0.14em; color: #A8A29E;">{{ group.label }}</p>
            <div class="grid grid-cols-2 gap-1.5">
              <FontButton
                v-for="fontName in group.fonts"
                :key="fontName"
                :label="fontName"
                :font="fontName"
                :active="local.font_family === fontName"
                @click="selectFont(fontName)"
              />
            </div>
          </template>
        </V4Card>

        <V4Card v-if="sections.frameControls" title="Frame & padding" :default-open="false">
          <div class="mb-3">
            <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Border</p>
            <div class="grid grid-cols-3 gap-1.5">
              <SegmentButton v-for="b in BORDERS" :key="b.value" :label="b.label" :active="local.border_style === b.value" @click="set('border_style', b.value)" />
            </div>
          </div>
          <SliderRow label="Map padding" :value="local.padding_factor" :min="0.05" :max="0.35" :step="0.01"
            :display="(v: number) => Math.round(v * 100) + '%'" @change="set('padding_factor', $event)" />
        </V4Card>



      </template>

      <!-- ─── TEXT TAB ──────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'text'">

        <V4Card
          v-if="activePosterTextMeta"
          :key="`poster-text-${activePosterTextMeta.field}`"
          :title="activePosterTextMeta.title"
          hint="Selected poster text"
          :default-open="true"
          style="display: none;"
        >
          <TextRow
            :label="activePosterTextMeta.inputLabel"
            :value="activePosterTextValue"
            :placeholder="activePosterTextMeta.placeholder"
            @change="setActivePosterTextValue($event)"
          />
          <SliderRow
            :label="`${activePosterTextMeta.title} size`"
            :value="activePosterTextScale"
            :min="0.5"
            :max="2.0"
            :step="0.05"
            :display="(v: number) => Math.round(v * 100) + '%'"
            @change="setActivePosterTextScale($event)"
          />
          <ColorRow label="Text color" :value="local.label_text_color" @change="set('label_text_color', $event)" />
          <div>
            <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Font</p>
            <template v-for="group in fontGroups" :key="group.label">
              <p class="text-[9px] font-semibold uppercase mb-1 mt-2 first:mt-0" style="letter-spacing: 0.12em; color: #C5C0BB;">{{ group.label }}</p>
              <div class="grid grid-cols-2 gap-1">
                <FontButton
                  v-for="fontName in group.fonts"
                  :key="fontName"
                  :label="fontName"
                  :font="fontName"
                  :active="local.font_family === fontName"
                  @click="selectFont(fontName)"
                />
              </div>
            </template>
          </div>
        </V4Card>

        <V4Card v-else-if="false && activeTextTarget?.type !== 'text-overlay'" title="Poster text" :default-open="true">
          <TextRow label="Trail name" :value="local.trail_name" placeholder="Defaults to map title" @change="set('trail_name', $event)" />
          <SliderRow label="Trail name size" :value="local.title_scale ?? 1.0" :min="0.5" :max="2.0" :step="0.05"
            :display="(v: number) => Math.round(v * 100) + '%'" @change="set('title_scale', $event)" />
          <div class="pt-2 border-t border-[#F5F5F4] mt-1 mb-2" />
          <TextRow label="Occasion" :value="local.occasion_text" placeholder="e.g. Summit Day 2024" @change="set('occasion_text', $event)" />
          <SliderRow label="Occasion size" :value="local.occasion_scale ?? 1.0" :min="0.5" :max="2.0" :step="0.05"
            :display="(v: number) => Math.round(v * 100) + '%'" @change="set('occasion_scale', $event)" />
          <div class="pt-2 border-t border-[#F5F5F4] mt-1 mb-2" />
          <TextRow label="Subtitle" :value="local.location_text" placeholder="e.g. Moab, Utah" @change="set('location_text', $event)" />
          <SliderRow label="Subtitle size" :value="local.subtitle_scale ?? 1.0" :min="0.5" :max="2.0" :step="0.05"
            :display="(v: number) => Math.round(v * 100) + '%'" @change="set('subtitle_scale', $event)" />
        </V4Card>

        <V4Card v-if="sections.typographyControls" title="Global typography" hint="Selected poster text edits inline" :default-open="true">
          <ColorRow label="Text color" :value="local.label_text_color" @change="set('label_text_color', $event)" />
          <ColorRow label="Band background" :value="local.label_bg_color" @change="set('label_bg_color', $event)" />
          <div>
            <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Font</p>
            <template v-for="group in fontGroups" :key="group.label">
              <p class="text-[9px] font-semibold uppercase mb-1 mt-2 first:mt-0" style="letter-spacing: 0.12em; color: #C5C0BB;">{{ group.label }}</p>
              <div class="grid grid-cols-2 gap-1">
                <FontButton
                  v-for="fontName in group.fonts"
                  :key="fontName"
                  :label="fontName"
                  :font="fontName"
                  :active="local.font_family === fontName"
                  @click="selectFont(fontName)"
                />
              </div>
            </template>
          </div>
        </V4Card>

        <V4Card v-if="activeTextTarget?.type !== 'text-overlay'" title="Stats & labels" :default-open="false">
          <ToggleRow label="Trail name" :value="local.labels.show_title" @change="setLabel('show_title', $event)" />
          <ToggleRow label="Distance" :value="local.labels.show_distance" @change="setLabel('show_distance', $event)" />
          <ToggleRow label="Elevation gain" :value="local.labels.show_elevation_gain" @change="setLabel('show_elevation_gain', $event)" />
          <ToggleRow label="Date" :value="local.labels.show_date" @change="setLabel('show_date', $event)" />
          <ToggleRow label="Coordinates" :value="local.labels.show_location" @change="setLabel('show_location', $event)" />
          <div class="pt-2 border-t border-[#F5F5F4] mt-1" />
          <ToggleRow label="RadMaps credit" :value="local.show_branding ?? true" @change="set('show_branding', $event)" />
        </V4Card>

        <V4Card v-if="activeTextTarget?.type !== 'text-overlay'" title="Logo" :default-open="false">
          <div v-if="sections.logoUploadArea"
            class="cursor-pointer"
            style="padding: 20px 0; text-align: center; border: 1.5px dashed #E7E5E4; border-radius: 8px;"
            @click="logoInputRef?.click()"
          >
            <p class="text-[11px]" style="color: #A8A29E;">Tap to upload logo</p>
            <input ref="logoInputRef" type="file" :accept="IMAGE_UPLOAD_ACCEPT" class="sr-only" @change="handleLogoUpload" />
          </div>
          <div v-if="sections.logoExistingControls" class="space-y-3">
            <div class="flex items-center gap-3">
              <img :src="logoPreviewUrl" alt="Logo" class="h-10 w-auto rounded object-contain bg-white p-0.5" style="border: 1px solid #E7E5E4;" />
              <div class="flex-1 min-w-0">
                <ToggleRow label="Show logo" :value="local.show_logo ?? false" @change="set('show_logo', $event)" />
              </div>
              <button class="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0" @click="removeLogoAsset">Remove</button>
            </div>
            <template v-if="logoAsset">
              <div class="text-[10px] font-semibold uppercase" style="letter-spacing: 0.14em;" :style="{ color: qualityColor(logoAsset) }">{{ assetQualityText(logoAsset) }}</div>
              <SliderRow label="Size" :value="logoAsset.width" :min="4" :max="60" :step="1"
                :display="(v: number) => Math.round(v) + '%'" @change="resizeAssetWidth(logoAsset!.id, $event)" />
              <SliderRow label="Rotation" :value="logoAsset.rotation" :min="-180" :max="180" :step="1"
                :display="(v: number) => Math.round(v) + '°'" @change="setAsset(logoAsset!.id, { rotation: $event })" />
              <SliderRow label="Opacity" :value="logoAsset.opacity" :min="0.1" :max="1" :step="0.05"
                :display="(v: number) => Math.round(v * 100) + '%'" @change="setAsset(logoAsset!.id, { opacity: $event })" />
              <button class="w-full text-xs font-semibold rounded-lg border border-[#E7E5E4] bg-white py-2 text-[#44403C] hover:bg-[#FAFAF9]" @click="replaceLogoInputRef?.click()">Replace logo</button>
              <input ref="replaceLogoInputRef" type="file" :accept="IMAGE_UPLOAD_ACCEPT" class="sr-only" @change="handleAssetReplace($event, logoAsset!.id, 'logo')" />
            </template>
            <template v-else-if="sections.logoPositionControls">
              <SliderRow label="Size" :value="local.logo_size ?? 8" :min="4" :max="18" :step="1"
                :display="(v: number) => v + 'u'" @change="set('logo_size', $event)" />
            </template>
          </div>
        </V4Card>

        <V4Card title="Images" :default-open="activeTextTarget?.type === 'image-overlay'">
          <div
            class="cursor-pointer"
            style="padding: 18px 0; text-align: center; border: 1.5px dashed #E7E5E4; border-radius: 8px;"
            @click="imageInputRef?.click()"
          >
            <p class="text-[11px]" style="color: #A8A29E;">Drop in PNG, JPG, or WebP artwork</p>
            <input ref="imageInputRef" type="file" :accept="IMAGE_UPLOAD_ACCEPT" class="sr-only" @change="handleImageUpload" />
          </div>
          <div v-if="(local.image_overlays ?? []).filter(a => a.kind === 'image').length" class="space-y-2 mt-3">
            <div
              v-for="asset in (local.image_overlays ?? []).filter(a => a.kind === 'image')"
              :key="asset.id"
              class="overflow-hidden"
              style="border: 1px solid #F5F5F4; border-radius: 12px;"
              :style="activeAssetId === asset.id ? 'border-color: #2D6A4F; box-shadow: 0 0 0 1px #2D6A4F;' : undefined"
            >
              <div class="flex items-center gap-2 px-3 py-2.5" :style="activeAssetId === asset.id ? 'background: #DCEBE2;' : 'background: #FAFAF9;'">
                <img :src="asset.render_url" alt="" class="w-8 h-8 object-contain rounded bg-white" style="border: 1px solid #E7E5E4;" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs truncate" style="color: #1C1917;">Image</p>
                  <p class="text-[10px] font-semibold uppercase" style="letter-spacing: 0.08em;" :style="{ color: qualityColor(asset) }">{{ assetQualityText(asset) }}</p>
                </div>
                <button class="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0" @click="removeAsset(asset.id)">Remove</button>
              </div>
              <div v-if="activeAssetId === asset.id" class="px-3 py-3 space-y-3" style="border-top: 1px solid #F5F5F4;">
                <SliderRow label="Size" :value="asset.width" :min="4" :max="95" :step="1"
                  :display="(v: number) => Math.round(v) + '%'" @change="resizeAssetWidth(asset.id, $event)" />
                <SliderRow label="Rotation" :value="asset.rotation" :min="-180" :max="180" :step="1"
                  :display="(v: number) => Math.round(v) + '°'" @change="setAsset(asset.id, { rotation: $event })" />
                <SliderRow label="Opacity" :value="asset.opacity" :min="0.1" :max="1" :step="0.05"
                  :display="(v: number) => Math.round(v * 100) + '%'" @change="setAsset(asset.id, { opacity: $event })" />
                <button class="w-full text-xs font-semibold rounded-lg border border-[#E7E5E4] bg-white py-2 text-[#44403C] hover:bg-[#FAFAF9]" @click="setReplaceAsset(asset.id, 'image')">Replace image</button>
              </div>
            </div>
          </div>
          <input ref="replaceImageInputRef" type="file" :accept="IMAGE_UPLOAD_ACCEPT" class="sr-only" @change="handlePendingAssetReplace" />
        </V4Card>

        <V4Card title="Text overlays" :default-open="activeTextTarget?.type === 'text-overlay'" :key="textOverlayCardKey">
          <div class="space-y-2">
            <div
              v-for="overlay in (local.text_overlays ?? [])"
              :key="overlay.id"
              class="overflow-hidden"
              style="border: 1px solid #F5F5F4; border-radius: 12px;"
              :style="activeOverlayId === overlay.id ? 'border-color: #2D6A4F; box-shadow: 0 0 0 1px #2D6A4F;' : undefined"
            >
              <div class="flex items-center gap-2 px-3 py-2.5" :style="activeOverlayId === overlay.id ? 'background: #DCEBE2;' : 'background: #FAFAF9;'">
                <div class="w-3 h-3 rounded-full shrink-0" style="border: 1px solid white; box-shadow: 0 0 0 1px #E7E5E4;" :style="{ backgroundColor: overlay.color }" />
                <span class="flex-1 text-xs truncate min-w-0" style="color: #1C1917;">{{ overlay.content || 'Empty text' }}</span>
                <button
                  class="transition-colors ml-1 shrink-0"
                  style="color: #D6D3D1; background: none; border: none; cursor: pointer; padding: 0;"
                  :data-testid="`text-overlay-toggle-${overlay.id}`"
                  @click="expandedOverlayId = expandedOverlayId === overlay.id ? null : overlay.id"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path v-if="expandedOverlayId === overlay.id" fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
                    <path v-else fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <button class="transition-colors shrink-0" style="color: #D6D3D1; background: none; border: none; cursor: pointer; padding: 0;" @click="removeOverlay(overlay.id)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
              </div>
              <div
                v-if="expandedOverlayId === overlay.id"
                class="px-3 py-3 space-y-3"
                style="border-top: 1px solid #F5F5F4;"
                :data-testid="`text-overlay-editor-${overlay.id}`"
              >
                <div class="space-y-1">
                  <span class="text-xs" style="color: #44403C;">Content</span>
                  <textarea
                    :value="overlay.content"
                    rows="2"
                    :data-testid="`text-overlay-content-${overlay.id}`"
                    class="w-full bg-white rounded-xl px-3 py-2.5 text-[16px] leading-snug placeholder-stone-400 focus:outline-none resize-none transition-colors"
                    style="border: 1px solid #E7E5E4; color: #1C1917;"
                    autocapitalize="sentences"
                    autocorrect="on"
                    spellcheck="true"
                    enterkeyhint="done"
                    @input="setOverlay(overlay.id, { content: ($event.target as HTMLTextAreaElement).value })"
                  />
                </div>
                <ColorRow label="Color" :value="overlay.color" @change="setOverlay(overlay.id, { color: $event })" />
                <SliderRow label="Size" :value="overlay.font_size" :min="0.5" :max="10" :step="0.25"
                  :display="(v: number) => v + 'u'" @change="setOverlay(overlay.id, { font_size: $event })" />
                <SliderRow label="Opacity" :value="overlay.opacity" :min="0.1" :max="1" :step="0.05"
                  :display="(v: number) => Math.round(v * 100) + '%'" @change="setOverlay(overlay.id, { opacity: $event })" />
                <!-- Style toggles: Bold + Italic -->
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Style</span>
                  <div class="flex gap-1.5">
                    <button
                      class="w-8 h-7 rounded text-xs font-bold transition-all cursor-pointer"
                      style="border: 1px solid; font-weight: 700;"
                      :style="overlay.bold ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; color: #78716C; background: white;'"
                      @click="setOverlay(overlay.id, { bold: !overlay.bold })"
                    >B</button>
                    <button
                      class="w-8 h-7 rounded text-xs transition-all cursor-pointer"
                      style="border: 1px solid; font-style: italic;"
                      :style="overlay.italic ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; color: #78716C; background: white;'"
                      @click="setOverlay(overlay.id, { italic: !overlay.italic })"
                    ><i>I</i></button>
                  </div>
                </div>
                <!-- Font picker -->
                <div>
                  <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.14em; color: #A8A29E;">Font</p>
                  <template v-for="group in fontGroups" :key="group.label">
                    <p class="text-[9px] font-semibold uppercase mb-1 mt-2 first:mt-0" style="letter-spacing: 0.12em; color: #C5C0BB;">{{ group.label }}</p>
                    <div class="grid grid-cols-2 gap-1">
                      <FontButton
                        v-for="fontName in group.fonts"
                        :key="fontName"
                        :label="fontName"
                        :font="fontName"
                        :active="overlay.font_family === fontName"
                        @click="setOverlay(overlay.id, { font_family: fontName })"
                      />
                    </div>
                  </template>
                </div>
                <!-- Alignment -->
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Align</span>
                  <div class="flex gap-1">
                    <button v-for="a in ['left','center','right']" :key="a"
                      class="w-8 h-7 rounded text-xs transition-all cursor-pointer flex items-center justify-center"
                      style="border: 1px solid;"
                      :style="overlay.alignment === a ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; color: #78716C; background: white;'"
                      @click="setOverlay(overlay.id, { alignment: a as 'left'|'center'|'right' })"
                    >
                      <svg viewBox="0 0 16 12" width="12" height="12" fill="currentColor">
                        <template v-if="a === 'left'"><rect x="0" y="0" width="16" height="2"/><rect x="0" y="5" width="11" height="2"/><rect x="0" y="10" width="13" height="2"/></template>
                        <template v-else-if="a === 'center'"><rect x="0" y="0" width="16" height="2"/><rect x="2.5" y="5" width="11" height="2"/><rect x="1.5" y="10" width="13" height="2"/></template>
                        <template v-else><rect x="0" y="0" width="16" height="2"/><rect x="5" y="5" width="11" height="2"/><rect x="3" y="10" width="13" height="2"/></template>
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <p class="text-xs mb-2" style="color: #44403C;">Position <span style="color: #A8A29E;">(or drag)</span></p>
                  <div class="grid grid-cols-3 gap-1">
                    <button
                      v-for="pos in OVERLAY_POSITIONS"
                      :key="pos.label"
                      class="py-2 rounded text-sm font-medium transition-all cursor-pointer"
                      style="border: 1px solid #E7E5E4; color: #78716C; background: white;"
                      @click="setOverlay(overlay.id, { x: pos.x, y: pos.y })"
                    >{{ pos.label }}</button>
                  </div>
                </div>
              </div>
            </div>
            <button
              class="w-full py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              style="border: 2px dashed #E7E5E4; color: #A8A29E; background: transparent;"
              data-testid="text-overlay-add"
              @click="addOverlay"
            >+ Add text</button>
          </div>
        </V4Card>


      </template>

      <!-- ─── SCOUT TAB ─────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'scout' && showScoutTab">
        <ScoutChat
          :style-config="local"
          :route-stats="scoutRouteStats"
          @update-style="applyScoutUpdate"
        />
      </template>

      <div class="h-8" />
    </div>

  </div>
</template>

<script setup lang="ts">
import type { AtlasLayerId, AtlasLayerSettings, StyleConfig, StyleLabels, FontFamily, BorderStyle, BaseTileStyle, ThemeDefinition, TextOverlay, TrailSegment, StylePreset, RouteStats, MapAsset, MapAssetKind, PosterIconId, PosterTextSlot } from '~/types'
import { DEFAULT_CONTOUR_MAJOR_WIDTH, DEFAULT_SEGMENT_CASING_WIDTH, DEFAULT_TRAIL_SEGMENT_WIDTH } from '~/types'
import ScoutChat from '~/components/map/ScoutChat.vue'
import { useSavedThemes, type SavedTheme } from '~/composables/useSavedThemes'
import { computeSectionVisibility } from '~/utils/stylePanelGating'
import { FLAGS } from '~/utils/knownFlags'
import { IMAGE_UPLOAD_ACCEPT, classifyAssetQuality, computeEffectiveDpi, qualityLabel } from '~/utils/imageAssets'
import { getThemeDefinition } from '~/utils/themes/refined'
import { applyThemeToStyleConfig, pairedBodyFont } from '~/utils/themeApplication'
import { POSTER_ICONS } from '~/utils/posterIcons'
import { getPosterEditorElements, type PosterEditorElementPatch } from '~/utils/posterEditorElements'
import { posterEditorAllowlistForStyle } from '~/utils/posterEditorAllowlist'
import {
  CLASSIC_THEME_OPTIONS,
  QUICK_THEME_OPTION_GROUPS,
  getThemeFontName,
  getThemeFontPreview,
  getThemeThumbnailProfile,
  showsRefinedThemeBadge,
} from '~/utils/themeOptions'
import { pickContrastSafeColor } from '~/utils/colorContrast'
import { mapBackgroundColor } from '~/utils/mapStyle'
import { applyRouteLineControl, type RouteLineControlField } from '~/utils/styleControlSync'
import { defaultTrailSegmentColor } from '~/utils/trail'

type PosterTextField = 'trail_name' | 'occasion_text' | 'location_text'
type SegmentDrawMode =
  | { type: 'new' }
  | { type: 'extend'; segId: string; end: 'start' | 'end' }
type SegmentEditMode = { segId: string }
type ActiveTextTarget =
  | { type: 'poster-text'; field: PosterTextField }
  | { type: 'text-overlay'; id: string }
  | { type: 'image-overlay'; id: string }
type ContourControlField = 'contour_color' | 'contour_major_color' | 'contour_opacity' | 'contour_minor_width' | 'contour_major_width'
type PosterEditorMode = 'layout' | 'select' | 'text' | 'image' | 'icon' | 'guides'

const THEME_OPTIONS = QUICK_THEME_OPTION_GROUPS.flatMap(group => [group.theme, ...group.colorways])

const props = defineProps<{
  modelValue: StyleConfig
  saving?: boolean
  /** Pass true when the map record has a GeoJSON route attached */
  hasRoute?: boolean
  /** Pass true when the GPX has usable elevation data (hides profile toggle otherwise) */
  hasElevationData?: boolean
  /** Total route distance in km — used to display mile labels on segment sliders */
  totalDistanceKm?: number
  /** Which segment/crop field is currently being plotted on the map */
  activePlotMode?: { segId: string; field: 'start' | 'end' } | null
  /** True while the map preview is in route brush erase mode */
  activeDeleteBrush?: boolean
  /** Brush radius in screen pixels for route erase mode */
  deleteBrushSize?: number
  /** Which segment draw/extension mode is currently active on the map */
  activeSegmentDrawMode?: SegmentDrawMode | null
  /** True when drawing is blocked by another map edit mode */
  segmentDrawDisabled?: boolean
  /** Which geometry-backed segment is currently in point edit mode */
  activeSegmentEditMode?: SegmentEditMode | null
  /** True when point editing is blocked by another map edit mode */
  segmentEditDisabled?: boolean
  /** Text element selected from the poster preview */
  activeTextTarget?: ActiveTextTarget | null
  /** Enables the V2 poster elements editor tab and controls */
  posterElementsAvailable?: boolean
  /** Current V2 poster editor tool mode */
  posterEditorMode?: PosterEditorMode
  /** Currently selected normalized poster element id */
  selectedPosterElementId?: string | null
  /** Whether non-printing V2 guides are visible on the poster */
  posterGuidesVisible?: boolean
  /** Enable the staff-only Scout tab when the feature flag resolves true */
  scoutAvailable?: boolean
  /** Route stats passed to Scout for style context */
  routeStats?: RouteStats
  /** Enables importing additional GPX files into trail segments */
  trackUploadAvailable?: boolean
  /** True while an additional GPX track is being imported into the editor */
  trackUploadLoading?: boolean
  /** Last additional GPX import error, if any */
  trackUploadError?: string | null
}>()

const sections = computed(() => computeSectionVisibility({
  hasRoute: props.hasRoute ?? false,
  hasElevationData: props.hasElevationData ?? false,
  preset: local.preset,
  showHillshade: local.show_hillshade,
  showContours: local.show_contours,
  tileEffect: local.tile_effect,
  showVignette: local.show_vignette ?? false,
  logoUrl: local.logo_url,
  showLogo: local.show_logo ?? false,
  logoAssetCount: (local.image_overlays ?? []).filter(asset => asset.kind === 'logo').length,
  trailSegmentCount: (local.trail_segments ?? []).length,
  showRoads: local.show_roads ?? false,
  showElevationProfile: local.show_elevation_profile ?? false,
  showStartPin: local.show_start_pin !== false,
  showFinishPin: local.show_finish_pin !== false,
  editableFields: getThemeDefinition(local.color_theme ?? 'chalk')?.editable_fields,
}))

const DEFAULT_ATLAS_LAYER_VISIBILITY: Record<AtlasLayerId, boolean> = {
  contour: true,
  water: true,
  waterway: true,
  park: true,
  landcover: true,
  transportation: true,
  building: true,
  poi: true,
  place: true,
}

function isTonerAtlasPreset(preset?: StylePreset) {
  return preset === 'radmaps-toner-light'
    || preset === 'radmaps-toner-dark'
    || preset === 'radmaps-toner'
}

function atlasLayerVisibilityDefaults(
  preset?: StylePreset,
  defaults: Partial<StyleConfig> = {},
): Record<AtlasLayerId, boolean> {
  return {
    ...DEFAULT_ATLAS_LAYER_VISIBILITY,
    ...(isTonerAtlasPreset(preset) ? { contour: false } : {}),
    ...(defaults.show_contours === false ? { contour: false } : {}),
    ...(defaults.show_roads === false ? { transportation: false } : {}),
    ...(defaults.show_place_labels === false ? { place: false } : {}),
    ...(defaults.show_poi_labels === false && !isTonerAtlasPreset(preset) ? { poi: false } : {}),
  }
}

const ATLAS_LAYER_OPTIONS: Array<{ id: AtlasLayerId; label: string }> = [
  { id: 'contour', label: 'Contour' },
  { id: 'water', label: 'Water' },
  { id: 'waterway', label: 'Rivers' },
  { id: 'park', label: 'Parks' },
  { id: 'landcover', label: 'Land' },
  { id: 'transportation', label: 'Roads' },
  { id: 'building', label: 'Build' },
  { id: 'place', label: 'Places' },
  { id: 'poi', label: 'POIs' },
]

const activeAtlasLayerId = ref<AtlasLayerId>('contour')
const isAtlasPresetActive = computed(() => local.preset?.startsWith('radmaps-') ?? false)
const atlasEditorEnabled = useFeatureFlag(FLAGS.RADMAPS_ATLAS_EDITOR)
const showAtlasEditor = computed(() => import.meta.dev || atlasEditorEnabled.value || isAtlasPresetActive.value)
const activeAtlasLayerOption = computed(() =>
  ATLAS_LAYER_OPTIONS.find(layer => layer.id === activeAtlasLayerId.value) ?? ATLAS_LAYER_OPTIONS[0],
)

function atlasLayerVisible(layer: AtlasLayerId) {
  if (layer === 'contour' && local.show_contours === false) return false
  if (layer === 'transportation' && local.show_roads === false) return false
  if (layer === 'place' && local.show_place_labels === false) return false
  if (layer === 'poi' && local.show_poi_labels === false) return false
  return local.atlas_layers?.[layer] ?? atlasLayerVisibilityDefaults(local.preset)[layer]
}

function atlasLayerSettings<L extends keyof AtlasLayerSettings>(layer: L): NonNullable<AtlasLayerSettings[L]> {
  return ((local.atlas_layer_settings ?? {})[layer] ?? {}) as NonNullable<AtlasLayerSettings[L]>
}

function setAtlasLayerVisible(layer: AtlasLayerId, visible: boolean) {
  local.atlas_layers = {
    ...(local.atlas_layers ?? {}),
    [layer]: visible,
  }

  if (layer === 'contour') local.show_contours = visible
  if (layer === 'transportation') local.show_roads = visible
  if (layer === 'place') local.show_place_labels = visible
  if (layer === 'poi') local.show_poi_labels = visible

  emit('update:modelValue', { ...local })
}

function setAtlasLayerSetting<L extends keyof AtlasLayerSettings>(
  layer: L,
  patch: Partial<NonNullable<AtlasLayerSettings[L]>>,
) {
  const currentLayer = atlasLayerSettings(layer)
  local.atlas_layer_settings = {
    ...(local.atlas_layer_settings ?? {}),
    [layer]: {
      ...currentLayer,
      ...patch,
    },
  }
  emit('update:modelValue', { ...local })
}

const atlasContourMinorColor = computed(() => atlasLayerSettings('contour').minor_color ?? local.contour_color)
const atlasContourMajorColor = computed(() => atlasLayerSettings('contour').major_color ?? atlasLayerSettings('contour').index_color ?? local.contour_major_color)
const atlasContourOpacity = computed(() => atlasLayerSettings('contour').minor_opacity ?? local.contour_opacity ?? 0.75)
const atlasContourLabels = computed(() => atlasLayerSettings('contour').labels ?? local.show_elevation_labels)
const isDarkAtlasPreset = computed(() => local.preset === 'radmaps-night-relief' || local.preset === 'radmaps-alidade-dark')
const elevationProfilePosition = computed(() => local.elevation_profile_position ?? 'map-overlay')
const elevationProfileHeightDefault = computed(() => elevationProfilePosition.value === 'separate-band' ? 12 : 22)
const elevationProfileHeightMin = computed(() => elevationProfilePosition.value === 'separate-band' ? 6 : 8)
const elevationProfileHeightMax = computed(() => elevationProfilePosition.value === 'separate-band' ? 24 : 40)
const atlasWaterFillColor = computed(() => atlasLayerSettings('water').fill_color ?? (isDarkAtlasPreset.value ? '#040712' : local.water_color ?? '#79B7C8'))
const atlasWaterOpacity = computed(() => atlasLayerSettings('water').fill_opacity ?? 0.76)
const atlasWaterwayColor = computed(() => atlasLayerSettings('waterway').color ?? atlasLayerSettings('water').waterway_color ?? atlasWaterFillColor.value)
const atlasWaterwayOpacity = computed(() => atlasLayerSettings('waterway').opacity ?? atlasLayerSettings('water').waterway_opacity ?? 0.78)
const atlasWaterwayWidth = computed(() => atlasLayerSettings('waterway').width ?? atlasLayerSettings('water').waterway_width ?? 1.1)
const atlasParkFillColor = computed(() => atlasLayerSettings('park').fill_color ?? (isDarkAtlasPreset.value ? '#0B1020' : '#C9D29A'))
const atlasParkOpacity = computed(() => atlasLayerSettings('park').opacity ?? 0.58)
const atlasLandcoverColor = computed(() => atlasLayerSettings('landcover').color ?? (isDarkAtlasPreset.value ? '#070A14' : local.land_color ?? '#E7DFBF'))
const atlasLandcoverOpacity = computed(() => atlasLayerSettings('landcover').opacity ?? 0.82)
const atlasRoadMajorColor = computed(() => atlasLayerSettings('transportation').major_color ?? atlasLayerSettings('transportation').road_color ?? local.roads_color ?? (isDarkAtlasPreset.value ? '#F18F45' : '#B7663C'))
const atlasRoadMinorColor = computed(() => atlasLayerSettings('transportation').minor_color ?? atlasRoadMajorColor.value)
const atlasTrailColor = computed(() => atlasLayerSettings('transportation').trail_color ?? (isDarkAtlasPreset.value ? local.route_color ?? '#F4B942' : '#405340'))
const atlasRoadOpacity = computed(() => atlasLayerSettings('transportation').opacity ?? local.roads_opacity ?? (isDarkAtlasPreset.value ? 0.38 : 0.82))
const atlasShowMajorRoads = computed(() => atlasLayerSettings('transportation').show_major ?? true)
const atlasShowMinorRoads = computed(() => atlasLayerSettings('transportation').show_minor ?? true)
const atlasShowTrails = computed(() => atlasLayerSettings('transportation').show_trails ?? true)
const atlasRoadMajorWidth = computed(() => atlasLayerSettings('transportation').major_width ?? 2)
const atlasRoadMinorWidth = computed(() => atlasLayerSettings('transportation').minor_width ?? 0.9)
const atlasTrailWidth = computed(() => atlasLayerSettings('transportation').trail_width ?? 1.2)
const atlasBuildingFillColor = computed(() => atlasLayerSettings('building').fill_color ?? local.label_text_color ?? '#405340')
const atlasBuildingOpacity = computed(() => atlasLayerSettings('building').opacity ?? 0.16)
const atlasPlaceLabelColor = computed(() => atlasLayerSettings('place').label_color ?? local.place_labels_color ?? local.label_text_color)
const atlasPlaceLabelOpacity = computed(() => atlasLayerSettings('place').label_opacity ?? local.place_labels_opacity ?? 0.78)
const atlasPlaceFontSize = computed(() => atlasLayerSettings('place').font_size ?? 15)
const atlasPoiLabelColor = computed(() => atlasLayerSettings('poi').label_color ?? local.poi_labels_color ?? atlasPlaceLabelColor.value)
const atlasPoiLabelOpacity = computed(() => atlasLayerSettings('poi').label_opacity ?? local.poi_labels_opacity ?? 0.62)

const emit = defineEmits<{
  'update:modelValue': [value: StyleConfig]
  'reset': []
  'logo-upload': [file: File]
  'image-upload': [payload: { file: File; kind: MapAssetKind; replaceAssetId?: string }]
  'toggle-sheet': []
  'swipe-up': []
  'swipe-down': []
  /** User wants to set a segment/crop position by tapping the map */
  'request-plot': [payload: { segId: string; field: 'start' | 'end' }]
  /** User wants to draw a new segment or extend an existing geometry-backed segment */
  'request-segment-draw': [payload: SegmentDrawMode]
  /** User wants to save the active segment draw/extension */
  'request-segment-draw-save': []
  /** User wants to cancel segment draw/extension mode */
  'request-segment-draw-cancel': []
  /** User wants to drag-edit a geometry-backed segment's points */
  'request-segment-edit': [payload: SegmentEditMode]
  /** User wants to cancel segment point edit mode */
  'request-segment-edit-cancel': []
  /** User wants to auto-detect and hide GPS-dropout gaps */
  'request-detect-disconnected': []
  /** User wants to paint-select route sections for deletion */
  'request-brush-delete': []
  /** User changed the paint-select brush radius */
  'update-brush-size': [value: number]
  /** User wants to save the current map camera */
  'request-view-lock': []
  /** User wants to unlock pan/zoom for the map camera */
  'request-view-edit': []
  /** User wants to refit the route in the map camera */
  'request-view-reset': []
  /** User selected an additional GPX track to import into trail segments */
  'track-upload': [file: File]
  /** User wants to reopen the first-run theme browser */
  'browse-themes': []
  'poster-editor-mode-change': [mode: PosterEditorMode]
  'poster-guides-visible-change': [value: boolean]
  'poster-element-selected': [id: string | null]
  'poster-element-patch': [payload: { id: string; patch: PosterEditorElementPatch }]
  'poster-element-remove': [id: string]
  'poster-element-duplicate': [id: string]
  'poster-text-add': []
  'poster-icon-add': [icon: PosterIconId]
}>()

// ── Drag-handle swipe gesture (mobile bottom sheet) ─────────────────────────────
const SWIPE_THRESHOLD = 24
const handleTouch = { startY: 0, lastY: 0, active: false, swiped: false }

function onHandleTouchStart(e: TouchEvent) {
  if (!e.touches[0]) return
  handleTouch.startY = e.touches[0].clientY
  handleTouch.lastY = handleTouch.startY
  handleTouch.active = true
  handleTouch.swiped = false
}

function onHandleTouchMove(e: TouchEvent) {
  if (!handleTouch.active || !e.touches[0]) return
  handleTouch.lastY = e.touches[0].clientY
}

function onHandleTouchEnd(e: TouchEvent) {
  if (!handleTouch.active) return
  handleTouch.active = false
  const delta = handleTouch.lastY - handleTouch.startY
  if (Math.abs(delta) >= SWIPE_THRESHOLD) {
    handleTouch.swiped = true
    e.preventDefault()
    if (delta > 0) emit('swipe-down')
    else emit('swipe-up')
  }
}

function onHandleTouchCancel() {
  handleTouch.active = false
}

function onHandleClick() {
  // Suppress the synthetic click that follows a swipe gesture
  if (handleTouch.swiped) {
    handleTouch.swiped = false
    return
  }
  emit('toggle-sheet')
}

const local = reactive<StyleConfig>({ ...props.modelValue })

watch(() => props.modelValue, (v) => {
  if (JSON.stringify(v) !== JSON.stringify(local)) {
    Object.assign(local, v)
  }
}, { deep: true })

// ── Tab state ──────────────────────────────────────────────────────────────────
type TabId = 'quick' | 'design' | 'map' | 'style' | 'text' | 'scout'
const activeTab = ref<TabId>('quick')

const CORE_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'quick', label: 'Quick' },
  { id: 'map',   label: 'Map' },
  { id: 'style', label: 'Style' },
  { id: 'text',  label: 'Text' },
]

const scoutEnabled = useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)
const themePickerEnabled = useFeatureFlag(FLAGS.THEME_PICKER_STEP)
const showThemeBrowser = computed(() => import.meta.dev || themePickerEnabled.value)
const showScoutTab = computed(() => Boolean(props.scoutAvailable && scoutEnabled.value))
const baseTabs = computed(() => props.posterElementsAvailable
  ? [
      { id: 'quick' as const, label: 'Quick' },
      { id: 'design' as const, label: 'Design' },
      ...CORE_TABS.slice(1),
    ]
  : CORE_TABS,
)
const visibleTabs = computed(() => showScoutTab.value
  ? [...baseTabs.value, { id: 'scout' as const, label: 'Scout' }]
  : baseTabs.value,
)

watch(showScoutTab, (visible) => {
  if (!visible && activeTab.value === 'scout') activeTab.value = 'quick'
})

watch(() => props.posterElementsAvailable, (available) => {
  if (!available && activeTab.value === 'design') activeTab.value = 'quick'
})

const scoutRouteStats = computed<RouteStats>(() => props.routeStats ?? {
  distance_km: props.totalDistanceKm ?? 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  max_elevation_m: 0,
  min_elevation_m: 0,
})

const POSTER_TEXT_FIELD_META: Record<PosterTextField, {
  field: PosterTextField
  title: string
  inputLabel: string
  placeholder: string
  scaleKey: 'title_scale' | 'occasion_scale' | 'subtitle_scale'
}> = {
  trail_name: {
    field: 'trail_name',
    title: 'Trail Name',
    inputLabel: 'Text',
    placeholder: 'Defaults to map title',
    scaleKey: 'title_scale',
  },
  occasion_text: {
    field: 'occasion_text',
    title: 'Occasion',
    inputLabel: 'Text',
    placeholder: 'e.g. Summit Day 2024',
    scaleKey: 'occasion_scale',
  },
  location_text: {
    field: 'location_text',
    title: 'Subtitle',
    inputLabel: 'Text',
    placeholder: 'e.g. Moab, Utah',
    scaleKey: 'subtitle_scale',
  },
}

const activePosterTextMeta = computed(() => {
  if (props.activeTextTarget?.type !== 'poster-text') return null
  return POSTER_TEXT_FIELD_META[props.activeTextTarget.field]
})

const activePosterTextValue = computed(() => {
  const meta = activePosterTextMeta.value
  return meta ? (local[meta.field] ?? '') : ''
})

const activePosterTextScale = computed(() => {
  const meta = activePosterTextMeta.value
  return meta ? (local[meta.scaleKey] ?? 1.0) : 1.0
})

const activeOverlayId = computed(() =>
  props.activeTextTarget?.type === 'text-overlay' ? props.activeTextTarget.id : null,
)

const activeAssetId = computed(() =>
  props.activeTextTarget?.type === 'image-overlay' ? props.activeTextTarget.id : null,
)

const logoAsset = computed(() => (local.image_overlays ?? []).find(asset => asset.kind === 'logo') ?? null)
const logoPreviewUrl = computed(() => logoAsset.value?.render_url ?? local.logo_url ?? '')
const posterEditorMode = computed(() => props.posterEditorMode ?? 'layout')
const posterEditorElements = computed(() =>
  getPosterEditorElements(local as StyleConfig, props.routeStats, { includeHidden: true, editableTextSlots: posterEditorAllowlist.value.textSlots }).slice().reverse(),
)
const activePosterElement = computed(() =>
  posterEditorElements.value.find(element => element.id === props.selectedPosterElementId) ?? null,
)
const posterEditorAllowlist = computed(() => posterEditorAllowlistForStyle(local as StyleConfig))

const textOverlayCardKey = computed(() =>
  props.activeTextTarget?.type === 'text-overlay'
    ? `text-overlays-${props.activeTextTarget.id}`
    : 'text-overlays',
)

watch(() => props.activeTextTarget, (target) => {
  if (!target) return
  if (target.type === 'text-overlay') {
    expandedOverlayId.value = target.id
  }
}, { deep: true })

// ── Saved themes ───────────────────────────────────────────────────────────────
const { themes: savedThemes, saveTheme, removeTheme } = useSavedThemes()

const showSaveInput = ref(false)
const showClassicThemes = ref(false)
const newThemeName = ref('')
const saveInputRef = ref<HTMLInputElement | null>(null)

function openSaveInput() {
  newThemeName.value = ''
  showSaveInput.value = true
  nextTick(() => saveInputRef.value?.focus())
}

function handleSaveTheme() {
  if (!newThemeName.value.trim()) return
  saveTheme(newThemeName.value, { ...local } as StyleConfig)
  showSaveInput.value = false
  newThemeName.value = ''
}

function applySavedTheme(saved: SavedTheme) {
  Object.assign(local, saved.config)
  emit('update:modelValue', { ...local })
}

function set<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
  (local as StyleConfig)[key] = value
  emit('update:modelValue', { ...local })
}

function setPosterEditorMode(mode: PosterEditorMode) {
  emit('poster-editor-mode-change', mode)
}

function patchPosterElement(id: string, patch: PosterEditorElementPatch) {
  emit('poster-element-patch', { id, patch })
}

function slotFromPosterElementId(id?: string | null): PosterTextSlot | null {
  if (!id?.startsWith('slot:')) return null
  const slot = id.slice('slot:'.length) as PosterTextSlot
  return posterEditorAllowlist.value.textSlots?.includes(slot) === false ? null : slot
}

function posterSlotPanelText(slot: PosterTextSlot) {
  const override = local.poster_text_overrides?.[slot]?.text
  if (override != null) return override
  if (slot === 'trail_name') return local.trail_name ?? ''
  if (slot === 'location_text') return local.location_text ?? ''
  if (slot === 'occasion_text') return local.occasion_text ?? ''
  if (slot === 'start_pin_label') return local.start_pin_label ?? 'Start'
  if (slot === 'finish_pin_label') return local.finish_pin_label ?? 'Finish'
  return ''
}

function activePosterSlotText() {
  const slot = slotFromPosterElementId(activePosterElement.value?.id)
  return slot ? posterSlotPanelText(slot) : ''
}

function activePosterSlotSizePt() {
  const slot = slotFromPosterElementId(activePosterElement.value?.id)
  return slot ? (local.poster_text_overrides?.[slot]?.font_size_pt ?? 48) : 48
}

function selectPosterElement(id: string | null) {
  emit('poster-element-selected', id)
}

function setSelectedElementZ(delta: number) {
  const element = activePosterElement.value
  if (!element) return
  patchPosterElement(element.id, { zIndex: Math.max(1, element.zIndex + delta) })
}

function resizeSelectedElement(width: number) {
  const element = activePosterElement.value
  if (!element) return
  const aspect = element.height && element.width ? element.height / element.width : 1
  patchPosterElement(element.id, { width, height: Number(Math.max(2, width * aspect).toFixed(2)) })
}

function handleDesignUpload(e: Event, kind: MapAssetKind) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emitImageUpload(file, kind)
  input.value = ''
}

function updateAtlasContourSettings(patch: Partial<NonNullable<AtlasLayerSettings['contour']>>) {
  if (!isAtlasPresetActive.value) return
  const currentContour = atlasLayerSettings('contour')
  local.atlas_layer_settings = {
    ...(local.atlas_layer_settings ?? {}),
    contour: {
      ...currentContour,
      ...patch,
    },
  }
}

function setContourControl<K extends ContourControlField>(key: K, value: StyleConfig[K]) {
  (local as StyleConfig)[key] = value

  if (key === 'contour_color') updateAtlasContourSettings({ minor_color: value as string })
  if (key === 'contour_major_color') updateAtlasContourSettings({ major_color: value as string, index_color: value as string })
  if (key === 'contour_opacity') updateAtlasContourSettings({ minor_opacity: value as number, major_opacity: value as number })
  if (key === 'contour_minor_width') updateAtlasContourSettings({ minor_width: value as number })
  if (key === 'contour_major_width') updateAtlasContourSettings({ major_width: value as number, index_width: value as number })

  emit('update:modelValue', { ...local })
}

function setContourLabels(enabled: boolean) {
  local.show_elevation_labels = enabled
  updateAtlasContourSettings({ labels: enabled })
  emit('update:modelValue', { ...local })
}

function setRouteLineStyle<K extends RouteLineControlField>(key: K, value: StyleConfig[K]) {
  Object.assign(local, applyRouteLineControl(local as StyleConfig, key, value))
  emit('update:modelValue', { ...local })
}

function applyScoutUpdate(updates: Partial<StyleConfig>) {
  Object.assign(local, updates)
  emit('update:modelValue', { ...local })
}

function set3DTerrain(enabled: boolean) {
  local.map_3d = enabled
  local.map_pitch = enabled ? ((local.map_pitch ?? 0) > 0 ? local.map_pitch : 45) : 0
  local.map_bearing = enabled ? (local.map_bearing ?? 0) : 0
  local.terrain_exaggeration = local.terrain_exaggeration ?? 1.5
  emit('update:modelValue', { ...local })
}

function setContours(enabled: boolean) {
  local.show_contours = enabled
  if (enabled && (local.contour_major_width == null || local.contour_major_width === 1)) {
    local.contour_major_width = DEFAULT_CONTOUR_MAJOR_WIDTH
  }
  local.contour_minor_width = local.contour_minor_width ?? 1
  emit('update:modelValue', { ...local })
}

function setActivePosterTextValue(value: string) {
  const meta = activePosterTextMeta.value
  if (!meta) return
  set(meta.field, value)
}

function setActivePosterTextScale(value: number) {
  const meta = activePosterTextMeta.value
  if (!meta) return
  set(meta.scaleKey, value)
}

function setLabel(key: keyof StyleLabels, value: boolean) {
  local.labels = { ...local.labels, [key]: value }
  emit('update:modelValue', { ...local })
}

// ── Text overlay helpers ───────────────────────────────────────────────────────

function addOverlay() {
  const overlay: TextOverlay = {
    id: crypto.randomUUID(),
    content: 'Your text',
    x: 50,
    y: 50,
    font_size: 2,
    color: local.label_text_color,
    font_family: local.font_family,
    alignment: 'center',
    opacity: 1,
    bold: false,
    italic: false,
  }
  set('text_overlays', [...(local.text_overlays ?? []), overlay])
  expandedOverlayId.value = overlay.id
}

function setOverlay(id: string, patch: Partial<TextOverlay>) {
  set('text_overlays', (local.text_overlays ?? []).map(o => o.id === id ? { ...o, ...patch } : o))
}

function removeOverlay(id: string) {
  set('text_overlays', (local.text_overlays ?? []).filter(o => o.id !== id))
  if (expandedOverlayId.value === id) expandedOverlayId.value = null
}

const expandedOverlayId = ref<string | null>(null)

const OVERLAY_POSITIONS = [
  { label: '↖', x: 10, y: 10 }, { label: '↑', x: 50, y: 10 }, { label: '↗', x: 90, y: 10 },
  { label: '←', x: 10, y: 50 }, { label: '·', x: 50, y: 50 }, { label: '→', x: 90, y: 50 },
  { label: '↙', x: 10, y: 85 }, { label: '↓', x: 50, y: 85 }, { label: '↘', x: 90, y: 85 },
]

// ── Image asset helpers ───────────────────────────────────────────────────────

function assetWithQuality(asset: MapAsset): MapAsset {
  return {
    ...asset,
    quality_status: classifyAssetQuality(computeEffectiveDpi(asset, local.print_size)),
  }
}

function assetQualityText(asset: MapAsset): string {
  const withQuality = assetWithQuality(asset)
  return `${qualityLabel(withQuality.quality_status)} · ${computeEffectiveDpi(withQuality, local.print_size)} DPI`
}

function qualityColor(asset: MapAsset): string {
  const status = assetWithQuality(asset).quality_status
  if (status === 'excellent' || status === 'good') return '#2D6A4F'
  if (status === 'warning') return '#B45309'
  return '#B91C1C'
}

function setAsset(id: string, patch: Partial<MapAsset>) {
  set('image_overlays', (local.image_overlays ?? []).map(asset => asset.id === id ? assetWithQuality({ ...asset, ...patch }) : asset))
}

function resizeAssetWidth(id: string, width: number) {
  const asset = (local.image_overlays ?? []).find(a => a.id === id)
  if (!asset) return
  const aspectHeight = asset.height / Math.max(1, asset.width)
  setAsset(id, {
    width,
    height: Number(Math.max(1, Math.min(95, width * aspectHeight)).toFixed(2)),
  })
}

function removeAsset(id: string) {
  set('image_overlays', (local.image_overlays ?? []).filter(asset => asset.id !== id))
}

function removeLogoAsset() {
  const logo = logoAsset.value
  if (logo) removeAsset(logo.id)
  set('logo_url', undefined)
  set('show_logo', false)
}

const imageInputRef = ref<HTMLInputElement | null>(null)
const designImageInputRef = ref<HTMLInputElement | null>(null)
const designLogoInputRef = ref<HTMLInputElement | null>(null)
const replaceLogoInputRef = ref<HTMLInputElement | null>(null)
const replaceImageInputRef = ref<HTMLInputElement | null>(null)
const pendingReplaceAsset = ref<{ id: string; kind: MapAssetKind } | null>(null)

function emitImageUpload(file: File, kind: MapAssetKind, replaceAssetId?: string) {
  emit('image-upload', { file, kind, replaceAssetId })
}

function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emitImageUpload(file, 'image')
  if (imageInputRef.value) imageInputRef.value.value = ''
}

function handleAssetReplace(e: Event, id: string, kind: MapAssetKind) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emitImageUpload(file, kind, id)
  input.value = ''
}

function setReplaceAsset(id: string, kind: MapAssetKind) {
  pendingReplaceAsset.value = { id, kind }
  replaceImageInputRef.value?.click()
}

function handlePendingAssetReplace(e: Event) {
  const pending = pendingReplaceAsset.value
  if (!pending) return
  handleAssetReplace(e, pending.id, pending.kind)
  pendingReplaceAsset.value = null
}

// ── Trail segment helpers ──────────────────────────────────────────────────────

const SEGMENT_COLORS = ['#2D6A4F', '#3A7CA5', '#C1121F', '#E87722', '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E', '#555555', '#FFFFFF']

const PIN_FONTS: Array<{ id: FontFamily; label: string }> = [
  { id: 'Source Sans 3',          label: 'Source Sans' },
  { id: 'IBM Plex Sans',          label: 'IBM Plex' },
  { id: 'Atkinson Hyperlegible Next', label: 'Atkinson' },
  { id: 'DM Sans',               label: 'DM Sans' },
  { id: 'Space Grotesk',         label: 'Space Grotesk' },
]

const SEGMENT_DISTANCE_STEP_MI = 0.05

const segmentDistanceStepPct = computed(() => {
  const totalMi = props.totalDistanceKm ? props.totalDistanceKm * 0.621371 : 0
  if (!totalMi) return 0.01
  return Math.max(0.001, Math.min(1, (SEGMENT_DISTANCE_STEP_MI / totalMi) * 100))
})

const trackUploadInputRef = ref<HTMLInputElement | null>(null)

function handleTrackUploadInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('track-upload', file)
  input.value = ''
}

function requestSegmentDraw(mode: SegmentDrawMode) {
  if (props.segmentDrawDisabled) return
  emit('request-segment-draw', mode)
}

function requestSegmentEdit(segId: string) {
  if (props.segmentEditDisabled) return
  emit('request-segment-edit', { segId })
}

function addSegment() {
  const nextColor = defaultTrailSegmentColor(local, local.trail_segments ?? [])
  const seg: TrailSegment = {
    id: crypto.randomUUID(),
    name: `Trail ${(local.trail_segments?.length ?? 0) + 1}`,
    color: nextColor,
    visible: true,
    section_start: 0,
    section_end: 100,
    width: DEFAULT_TRAIL_SEGMENT_WIDTH,
    opacity: 0.9,
    smooth: 0,
    bend: 0,
    dash: false,
  }
  set('trail_segments', [...(local.trail_segments ?? []), seg])
  expandedSegmentId.value = seg.id
}

function segmentSmoothDisplay(value: number): string {
  return value === 0 ? 'Off' : value === 10 ? 'Max' : String(value)
}

function segmentStep(seg: TrailSegment): number {
  return isGeometryBackedSegmentSource(seg) ? 0.1 : segmentDistanceStepPct.value
}

function isGeometryBackedSegmentSource(seg: TrailSegment): boolean {
  return Boolean(seg.geojson && (seg.source === 'uploaded-track' || seg.source === 'drawn-track'))
}

function isActiveSegmentExtension(segId: string, end: 'start' | 'end'): boolean {
  return props.activeSegmentDrawMode?.type === 'extend' &&
    props.activeSegmentDrawMode.segId === segId &&
    props.activeSegmentDrawMode.end === end
}

function isActiveSegmentEdit(segId: string): boolean {
  return props.activeSegmentEditMode?.segId === segId
}

function setSegment(id: string, patch: Partial<TrailSegment>) {
  set('trail_segments', (local.trail_segments ?? []).map(s => s.id === id ? { ...s, ...patch } : s))
}

function applyToAll(patch: Partial<TrailSegment>) {
  set('trail_segments', (local.trail_segments ?? []).map(s => ({ ...s, ...patch })))
}

function applyTrailLabelTypographyAuto() {
  local.leader_label_auto_fit = true
  local.leader_label_scale = 1
  local.leader_label_font_family = 'Atkinson Hyperlegible Next'
  emit('update:modelValue', { ...local })
}

function resetLabelPositions() {
  set('trail_segments', (local.trail_segments ?? []).map(({ label_lnglat: _, ...s }) => s))
}

function segmentPctDisplay(pct: number): string {
  const km = props.totalDistanceKm
  if (km) {
    const mi = ((km * pct) / 100 * 0.621371)
    return mi < 100 ? mi.toFixed(2) + ' mi' : mi.toFixed(1) + ' mi'
  }
  return pct.toFixed(2) + '%'
}

function segmentPercentDisplay(pct: number): string {
  return pct.toFixed(pct % 1 === 0 ? 0 : 1) + '%'
}

const isDeletePlotActive = computed(() => props.activePlotMode?.segId === 'route-delete-pending')

function removeDeletedRange(index: number) {
  const ranges = [...(local.route_deleted_ranges ?? [])]
  ranges.splice(index, 1)
  set('route_deleted_ranges', ranges)
}

function removeSegment(id: string) {
  set('trail_segments', (local.trail_segments ?? []).filter(s => s.id !== id))
  if (expandedSegmentId.value === id) expandedSegmentId.value = null
}

function setLegend(patch: Partial<{ show: boolean; position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' }>) {
  const current = local.trail_legend ?? { show: true, position: 'bottom-left' as const }
  set('trail_legend', {
    show: patch.show !== undefined ? patch.show : current.show,
    position: patch.position ?? current.position ?? 'bottom-left',
  })
}

const expandedSegmentId = ref<string | null>(null)

// ── Logo upload ────────────────────────────────────────────────────────────────
const logoInputRef = ref<HTMLInputElement | null>(null)

async function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    emit('logo-upload', file)
  } finally {
    if (logoInputRef.value) logoInputRef.value.value = ''
  }
}

function applyTheme(theme: ThemeDefinition) {
  Object.assign(local, applyThemeToStyleConfig({ ...local } as StyleConfig, theme))
  emit('update:modelValue', { ...local })
}

function applyClassicTheme(theme: ThemeDefinition) {
  const target = theme.migration_target ? getThemeDefinition(theme.migration_target) : undefined
  if (target) {
    Object.assign(local, applyThemeToStyleConfig({ ...local } as StyleConfig, target))
  } else {
    Object.assign(local, applyThemeToStyleConfig({ ...local } as StyleConfig, theme))
    local.composition = undefined
    local.audience = undefined
  }
  emit('update:modelValue', { ...local })
}

function isRefinedThemeActive(theme: ThemeDefinition) {
  return local.color_theme === theme.id && local.composition === theme.composition
}

function showsRefinedBadge(theme: ThemeDefinition) {
  return showsRefinedThemeBadge(theme.id)
}

function isClassicThemeActive(theme: ThemeDefinition) {
  return (local.color_theme === theme.id && !local.composition) || (!!theme.migration_target && local.color_theme === theme.migration_target)
}

function selectFont(fontName: FontFamily) {
  local.font_family = fontName
  local.body_font_family = pairedBodyFont(fontName)
  emit('update:modelValue', { ...local })
}

const fontGroups: Array<{ label: string; fonts: FontFamily[] }> = [
  { label: 'PRINT', fonts: ['Source Sans 3', 'IBM Plex Sans', 'Atkinson Hyperlegible Next', 'Source Serif 4', 'Newsreader'] },
  { label: 'MODERN', fonts: ['DM Sans', 'Space Grotesk', 'Outfit', 'Work Sans'] },
  { label: 'DISPLAY', fonts: ['Big Shoulders Display', 'Fjalla One', 'Oswald', 'Bebas Neue'] },
  { label: 'REFINED', fonts: ['Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'DM Serif Display'] },
]

function themeThumb(theme: ThemeDefinition, classic = false) {
  return getThemeThumbnailProfile(theme, classic)
}

function themeFontPreview(theme: ThemeDefinition): string {
  return getThemeFontPreview(theme)
}

const activeThemeDefinition = computed(() => getThemeDefinition(local.color_theme ?? 'chalk'))
const activeThemeTypography = computed(() =>
  getThemeFontName(local.color_theme ?? 'chalk', activeThemeDefinition.value),
)

const contrastSafePinColor = computed(() =>
  pickContrastSafeColor(
    mapBackgroundColor(local as StyleConfig),
    [
      local.route_color,
      local.label_bg_color,
      local.label_text_color,
      local.background_color,
    ],
  )
)

const BORDERS: Array<{ label: string; value: BorderStyle }> = [
  { label: 'None', value: 'none' },
  { label: 'Thin', value: 'thin' },
  { label: 'Thick', value: 'thick' },
]

const TILE_STYLES: Array<{ label: string; value: BaseTileStyle }> = [
  { label: 'Light',   value: 'carto-light' },
  { label: 'Dark',    value: 'carto-dark' },
  { label: 'Outdoor', value: 'maptiler-outdoor' },
  { label: 'Topo',    value: 'maptiler-topo' },
  { label: 'Winter',  value: 'maptiler-winter' },
]

const TOPO_TILE_STYLES: Array<{ label: string; value: BaseTileStyle }> = [
  { label: 'Outdoor', value: 'maptiler-outdoor' },
  { label: 'Topo',    value: 'maptiler-topo' },
  { label: 'Winter',  value: 'maptiler-winter' },
]

function blendForPreview(a: string | undefined, b: string | undefined): string {
  const ca = a ?? '#1C1917', cb = b ?? '#F7F4EF'
  const ar = parseInt(ca.slice(1, 3), 16), ag = parseInt(ca.slice(3, 5), 16), ab = parseInt(ca.slice(5, 7), 16)
  const br = parseInt(cb.slice(1, 3), 16), bg = parseInt(cb.slice(3, 5), 16), bb = parseInt(cb.slice(5, 7), 16)
  const r = Math.round((ar + br) / 2).toString(16).padStart(2, '0')
  const g = Math.round((ag + bg) / 2).toString(16).padStart(2, '0')
  const bh = Math.round((ab + bb) / 2).toString(16).padStart(2, '0')
  return `#${r}${g}${bh}`
}

type MapPresetOption = {
  id: StylePreset
  label: string
  title: string
  viewBox: string
  svg: string
  beta?: boolean
  defaults?: Partial<StyleConfig>
}

const CORE_MAP_PRESETS: MapPresetOption[] = [
  {
    id: 'minimalist', label: 'Minimalist', title: 'Clean raster tiles — CARTO light or dark',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#f0ece4"/>
      <path d="M4 24 Q12 20 24 22 Q36 24 44 18" stroke="#c8b8a2" stroke-width="1" fill="none"/>
      <path d="M8 16 Q18 10 28 14 Q38 18 44 12" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'topographic', label: 'Topographic', title: 'Mapbox Outdoors — terrain + trails',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#e8dfd0"/>
      <ellipse cx="24" cy="18" rx="18" ry="10" stroke="#b8a888" stroke-width="0.8" fill="none"/>
      <ellipse cx="24" cy="18" rx="12" ry="7" stroke="#a09070" stroke-width="0.8" fill="none"/>
      <ellipse cx="24" cy="18" rx="6" ry="4" stroke="#887850" stroke-width="0.8" fill="none"/>
      <path d="M8 10 Q18 4 28 8 Q38 12 44 6" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'natural-topo', label: 'Natural', title: 'MapTiler full-colour terrain',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#c8dba8"/>
      <rect x="0" y="18" width="48" height="14" fill="#a8c878"/>
      <path d="M6 20 Q16 16 26 18 Q36 20 44 16" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'route-only', label: 'Route Only', title: 'Solid background, route line only',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#f7f4ef"/>
      <path d="M8 28 Q12 22 18 20 Q24 18 28 14 Q32 10 36 6 Q40 4 44 6" stroke="#e63946" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="8" cy="28" r="2" fill="#2d6a4f"/>
      <circle cx="44" cy="6" r="2" fill="#b91c1c"/>`,
  },
  {
    id: 'road-network', label: 'Road Net', title: 'Vector roads as ink lines',
    viewBox: '0 0 48 32',
    defaults: {
      show_roads: true,
      show_place_labels: false,
      show_poi_labels: false,
      show_contours: false,
      show_hillshade: false,
      map_3d: false,
    },
    svg: `<rect width="48" height="32" fill="#f5f5f5"/>
      <path d="M0 8 Q12 10 24 8 Q36 6 48 10" stroke="#1c1917" stroke-width="1.4" fill="none" opacity="0.7"/>
      <path d="M0 18 Q10 16 20 18 Q32 20 48 16" stroke="#1c1917" stroke-width="1.0" fill="none" opacity="0.5"/>
      <path d="M12 0 Q10 10 12 20 Q14 28 12 32" stroke="#1c1917" stroke-width="1.2" fill="none" opacity="0.6"/>
      <path d="M6 12 Q16 8 26 12 Q36 16 44 12" stroke="#e63946" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'contour-art', label: 'Contour Art', title: 'Topographic contours as standalone art',
    viewBox: '0 0 48 32',
    defaults: { show_contours: true, contour_detail: 4 },
    svg: `<rect width="48" height="32" fill="#fafafa"/>
      <ellipse cx="24" cy="18" rx="20" ry="12" stroke="#9e9082" stroke-width="0.6" fill="none"/>
      <ellipse cx="24" cy="18" rx="16" ry="9" stroke="#9e9082" stroke-width="0.6" fill="none"/>
      <ellipse cx="24" cy="18" rx="12" ry="6.5" stroke="#7a6e62" stroke-width="0.7" fill="none"/>
      <ellipse cx="24" cy="18" rx="8" ry="4" stroke="#7a6e62" stroke-width="0.9" fill="none"/>
      <ellipse cx="24" cy="18" rx="4" ry="2" stroke="#5a504a" stroke-width="1.1" fill="none"/>
      <path d="M6 6 Q14 2 24 6 Q34 10 42 6" stroke="#e63946" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'stadia-watercolor', label: 'Watercolor', title: 'Hand-painted watercolor tiles by Stamen/Stadia',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#d4dde1"/>
      <ellipse cx="14" cy="14" rx="12" ry="9" fill="#c8dbc8" opacity="0.7"/>
      <ellipse cx="34" cy="18" rx="10" ry="7" fill="#d4b8a0" opacity="0.6"/>
      <rect x="0" y="20" width="48" height="12" fill="#a8c8d8" opacity="0.55"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#e63946" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'stadia-toner', label: 'Toner', title: 'High-contrast black & white graphic style',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#ffffff"/>
      <path d="M0 8 Q12 6 24 8 Q36 10 48 7" stroke="#000" stroke-width="1.2" fill="none" opacity="0.45"/>
      <path d="M0 15 Q10 13 22 15 Q34 17 48 13" stroke="#000" stroke-width="0.8" fill="none" opacity="0.28"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#e63946" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  },
]

const BETA_MAP_PRESETS: MapPresetOption[] = [
  {
    id: 'native-toner', label: 'Toner',
    title: 'B&W vector look — Mapbox Streets roads as ink on paper',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#ffffff"/>
      <rect x="0" y="20" width="48" height="12" fill="#111111" opacity="0.82"/>
      <path d="M0 6 Q12 4 24 6 Q36 8 48 5" stroke="#111" stroke-width="1.5" fill="none" opacity="0.90"/>
      <path d="M0 14 Q10 12 22 14 Q34 16 48 12" stroke="#111" stroke-width="0.9" fill="none" opacity="0.55"/>
      <path d="M8 0 Q7 8 8 20 Q9 26 8 32" stroke="#111" stroke-width="1.1" fill="none" opacity="0.65"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#e63946" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    defaults: { background_color: '#FFFFFF', label_text_color: '#111111', label_bg_color: '#FFFFFF' },
    beta: true,
  },
  {
    id: 'native-watercolor', label: 'Blue Contour',
    title: 'Legacy pale-blue contour wash — preserved, but provider-backed',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#F0E8DC"/>
      <ellipse cx="12" cy="13" rx="11" ry="8" fill="#C8C0A8" opacity="0.45"/>
      <ellipse cx="36" cy="20" rx="9" ry="6" fill="#B8C8C0" opacity="0.40"/>
      <rect x="0" y="22" width="48" height="10" fill="#A8B8C0" opacity="0.38"/>
      <path d="M4 18 Q16 13 28 16 Q38 18 46 13" stroke="#B5451B" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    defaults: { background_color: '#F0E8DC', label_bg_color: '#F0E8DC', label_text_color: '#2A1A0A' },
    beta: true,
  },
  {
    id: 'alidade-smooth', label: 'Alidade',
    title: 'Clean modern cartography — MapTiler Streets v2',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#F5F3EE"/>
      <rect x="0" y="21" width="48" height="11" fill="#D0DDE8" opacity="0.70"/>
      <path d="M0 8 Q12 6 24 8 Q36 10 48 7" stroke="#C8C0B8" stroke-width="0.8" fill="none" opacity="0.60"/>
      <path d="M0 15 Q10 13 20 15 Q32 17 48 13" stroke="#C8C0B8" stroke-width="0.5" fill="none" opacity="0.40"/>
      <path d="M8 0 Q7 10 8 21 Q9 28 8 32" stroke="#B8B0A8" stroke-width="0.7" fill="none" opacity="0.50"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#e63946" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    defaults: { background_color: '#F5F3EE', label_bg_color: '#F5F3EE', label_text_color: '#1C1917' },
    beta: true,
  },
  {
    id: 'alidade-smooth-dark', label: 'Alidade Dark',
    title: 'Dark clean cartography — MapTiler Dataviz Dark',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#141414"/>
      <rect x="0" y="20" width="48" height="12" fill="#0A1820" opacity="0.90"/>
      <path d="M0 8 Q12 6 24 8 Q36 10 48 7" stroke="#484848" stroke-width="0.8" fill="none" opacity="0.70"/>
      <path d="M0 15 Q10 13 20 15 Q32 17 48 13" stroke="#383838" stroke-width="0.5" fill="none" opacity="0.50"/>
      <path d="M8 0 Q7 10 8 20 Q9 28 8 32" stroke="#383838" stroke-width="0.7" fill="none" opacity="0.50"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#FB923C" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    defaults: { background_color: '#141414', label_bg_color: '#141414', label_text_color: '#F0F0F0' },
    beta: true,
  },
]

const ATLAS_MAP_PRESETS: MapPresetOption[] = [
  {
    id: 'radmaps-minimalist',
    label: 'Atlas Minimal',
    title: 'Owned Atlas minimal — CARTO-like quiet context with editable vector layers',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-minimal">
      <rect width="48" height="32" fill="#F7F3EA"/>
      <rect x="0" y="22" width="48" height="10" fill="#DCE8EC" opacity="0.34"/>
      <path d="M0 10 Q13 8.8 24 10.2 Q36 11.8 48 9.7" stroke="#D7CEC0" stroke-width="0.45" fill="none" opacity="0.55"/>
      <path d="M3 18 Q15 17 27 18.5 Q39 20 48 17.4" stroke="#E6DFD3" stroke-width="0.45" fill="none" opacity="0.70"/>
      <path d="M7 24 Q18 18 30 20 Q38 22 44 16" stroke="#1C1917" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="7" cy="24" r="1.15" fill="#1C1917"/>
      <circle cx="44" cy="16" r="1.15" fill="#1C1917"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: false,
      show_roads: false,
      show_poi_labels: false,
      contour_detail: 5,
      contour_opacity: 0.26,
      contour_minor_width: 0.7,
      route_color: '#1A1A1A',
      route_width: 3.5,
      atlas_layer_settings: {
        landcover: { color: '#FAF8F3', opacity: 0.96 },
        park: { fill_color: '#E2E9D7', opacity: 0.14 },
        water: { fill_color: '#B9D3DF', fill_opacity: 0.32 },
        waterway: { color: '#8DB2C4', opacity: 0.42, width: 0.85 },
        transportation: { opacity: 0.22, major_color: '#B8AEA0', minor_color: '#D2CAC0', trail_color: '#AEA895', show_major: false, show_minor: false, show_trails: false },
        contour: { minor_color: '#E2DCCF', major_color: '#CFC7B6', minor_opacity: 0.30, major_opacity: 0.38, minor_width: 0.7, major_width: 0.55 },
        place: { label_color: '#5B554F', label_opacity: 0.54, font_size: 12, halo_color: '#F5F2EC' },
        poi: { label_opacity: 0.24 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-topographic',
    label: 'Atlas Topo',
    title: 'Owned Atlas topographic — Mapbox Outdoors-like terrain, trails, and labels',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-topographic">
      <rect width="48" height="32" fill="#E8DFCF"/>
      <path d="M0 0 L48 0 L48 13 Q35 18 22 15 Q10 12 0 17 Z" fill="#B9C983" opacity="0.52"/>
      <path d="M0 24 Q12 19 24 21 Q34 24 48 15" stroke="#2D86A1" stroke-width="1.1" fill="none"/>
      <ellipse cx="24" cy="18" rx="20" ry="11" stroke="#C2A96D" stroke-width="0.55" fill="none"/>
      <ellipse cx="24" cy="18" rx="15" ry="8.2" stroke="#A78B5D" stroke-width="0.62" fill="none"/>
      <ellipse cx="24" cy="18" rx="9" ry="5.1" stroke="#7E6841" stroke-width="0.72" fill="none"/>
      <path d="M5 7 Q16 4 27 7 Q38 10 47 6" stroke="#786B3A" stroke-width="0.55" fill="none" stroke-dasharray="2 1.2" opacity="0.8"/>
      <path d="M8 10 Q18 4 28 8 Q38 12 44 6" stroke="#9A3B27" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: false,
      show_roads: true,
      contour_detail: 5,
      contour_opacity: 0.34,
      route_color: '#9A3B27',
      route_width: 3,
      atlas_layer_settings: {
        landcover: { color: '#F3EEDD', opacity: 0.88 },
        park: { fill_color: '#C9D29A', opacity: 0.52 },
        water: { fill_color: '#79B7C8', fill_opacity: 0.72 },
        waterway: { color: '#327F96', opacity: 0.78, width: 1.2 },
        transportation: { opacity: 0.78, major_color: '#BA6A42', minor_color: '#C99B73', trail_color: '#786B3A', show_major: true, show_minor: true, show_trails: true },
        contour: { minor_color: '#CDBD8C', major_color: '#8A6D3F', minor_opacity: 0.34, major_opacity: 0.50, major_width: 0.7 },
        place: { label_color: '#29362D', label_opacity: 0.72, font_size: 14 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-natural',
    label: 'Atlas Natural',
    title: 'Owned Atlas natural terrain — MapTiler-like green topo without raster dependency',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-natural">
      <rect width="48" height="32" fill="#E7ECDC"/>
      <path d="M0 0 H48 V16 Q40 13 31 15 Q21 18 12 15 Q5 13 0 15 Z" fill="#C8D59B" opacity="0.82"/>
      <path d="M0 18 Q12 13 24 16 Q35 19 48 11" stroke="#66AFC4" stroke-width="2.2" fill="none" opacity="0.9"/>
      <ellipse cx="16" cy="23" rx="16" ry="7" fill="#9DBE72" opacity="0.55"/>
      <ellipse cx="29" cy="14" rx="16" ry="8" stroke="#5D7449" stroke-width="0.6" fill="none" opacity="0.75"/>
      <path d="M5 9 Q16 12 27 10 Q38 8 46 12" stroke="#CBA26C" stroke-width="0.85" fill="none" opacity="0.72"/>
      <path d="M6 21 Q17 16 27 18 Q37 20 44 15" stroke="#9A3B27" stroke-width="1.85" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: true,
      show_roads: true,
      contour_detail: 4,
      route_color: '#9A3B27',
      route_width: 3,
      atlas_layer_settings: {
        landcover: { color: '#E7ECDC', opacity: 0.88 },
        park: { fill_color: '#9DBE72', opacity: 0.62 },
        water: { fill_color: '#66AFC4', fill_opacity: 0.72 },
        waterway: { color: '#297D98', opacity: 0.78, width: 1.2 },
        transportation: { opacity: 0.48, major_color: '#CBA26C', minor_color: '#B8AA88', trail_color: '#6D7C45', show_major: true, show_minor: true, show_trails: true },
        contour: { minor_color: '#9FB286', major_color: '#5D7449', minor_opacity: 0.30, major_width: 0.65 },
        place: { label_color: '#2F4027', label_opacity: 0.64, font_size: 13 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-toner-light',
    label: 'Toner Light',
    title: 'First-party light toner — monochrome linework with restrained dot texture',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-toner-light">
      <rect width="48" height="32" fill="#F7F6F1"/>
      <path d="M-2 5 Q11 8 24 6 Q36 4 50 7" stroke="#111111" stroke-width="2.1" fill="none" opacity="0.85"/>
      <path d="M-2 15 Q11 12 22 15 Q35 18 50 13" stroke="#111111" stroke-width="1.35" fill="none" opacity="0.68"/>
      <path d="M7 -2 Q8 9 7 20 Q6 27 8 34" stroke="#111111" stroke-width="1.45" fill="none" opacity="0.62"/>
      <path d="M28 -2 Q29 9 28 20 Q27 27 30 34" stroke="#111111" stroke-width="0.8" fill="none" opacity="0.42"/>
      <circle cx="35" cy="8" r="0.65" fill="#111111" opacity="0.5"/>
      <circle cx="39" cy="12" r="0.65" fill="#111111" opacity="0.45"/>
      <circle cx="35" cy="16" r="0.65" fill="#111111" opacity="0.4"/>
      <path d="M6 23 Q18 17 30 20 Q38 22 44 17" stroke="#C1121F" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: false,
      show_roads: true,
      show_place_labels: true,
      show_poi_labels: false,
      contour_detail: 5,
      route_color: '#111111',
      route_width: 3.6,
      route_opacity: 1,
      pin_font_family: 'Work Sans',
      pin_opacity: 1,
      atlas_layer_settings: {
        landcover: { opacity: 1 },
        park: { opacity: 0.08 },
        water: { fill_opacity: 0.34 },
        waterway: { opacity: 0.74, width: 1.05 },
        building: { opacity: 0.05 },
        transportation: { opacity: 0.94, show_major: true, show_minor: true, show_trails: false, major_width: 3.3, minor_width: 1.2, trail_width: 1.5 },
        place: { label_opacity: 0.76, font_size: 13 },
        poi: { label_opacity: 0.18 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-toner-dark',
    label: 'Toner Dark',
    title: 'First-party dark toner — high-contrast roads with restrained dot texture',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-toner-dark">
      <rect width="48" height="32" fill="#050505"/>
      <rect width="48" height="32" fill="#1F2933" opacity="0.56"/>
      <path d="M-2 5 Q11 8 24 6 Q36 4 50 7" stroke="#FFFFFF" stroke-width="2.1" fill="none" opacity="0.85"/>
      <path d="M-2 15 Q11 12 22 15 Q35 18 50 13" stroke="#8B98A4" stroke-width="1.35" fill="none" opacity="0.88"/>
      <path d="M7 -2 Q8 9 7 20 Q6 27 8 34" stroke="#8B98A4" stroke-width="1.45" fill="none" opacity="0.74"/>
      <path d="M28 -2 Q29 9 28 20 Q27 27 30 34" stroke="#56636F" stroke-width="0.8" fill="none" opacity="0.7"/>
      <circle cx="36" cy="7" r="0.65" fill="#D8DEE5" opacity="0.55"/>
      <circle cx="40" cy="11" r="0.65" fill="#D8DEE5" opacity="0.44"/>
      <circle cx="36" cy="15" r="0.65" fill="#D8DEE5" opacity="0.34"/>
      <path d="M6 23 Q18 17 30 20 Q38 22 44 17" stroke="#FFD23F" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: false,
      show_roads: true,
      show_place_labels: true,
      show_poi_labels: false,
      contour_detail: 5,
      route_color: '#FFD23F',
      route_width: 3.4,
      route_opacity: 1,
      pin_font_family: 'Work Sans',
      pin_opacity: 1,
      atlas_layer_settings: {
        landcover: { opacity: 1 },
        park: { opacity: 0.08 },
        water: { fill_opacity: 0.34 },
        waterway: { opacity: 0.74, width: 1.05 },
        building: { opacity: 0.05 },
        transportation: { opacity: 0.94, show_major: true, show_minor: true, show_trails: false, major_width: 3.3, minor_width: 1.2, trail_width: 1.5 },
        place: { label_opacity: 0.76, font_size: 13 },
        poi: { label_opacity: 0.18 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-contour-wash',
    label: 'Contour Wash',
    title: 'Owned Atlas pale-blue contour wash — preserved as a non-watercolor quick-map style',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-contour-wash">
      <rect width="48" height="32" fill="#D7E8F7"/>
      <rect width="48" height="32" fill="#F1EDE4" opacity="0.42"/>
      <path d="M0 24 Q13 20 26 22 Q36 24 48 18" stroke="#9FC5E6" stroke-width="2" fill="none" opacity="0.42"/>
      <ellipse cx="24" cy="17" rx="23" ry="12.5" stroke="#8EB7D8" stroke-width="0.58" fill="none" opacity="0.76"/>
      <ellipse cx="24" cy="17" rx="18" ry="9.8" stroke="#8EB7D8" stroke-width="0.58" fill="none" opacity="0.72"/>
      <ellipse cx="24" cy="17" rx="13" ry="7" stroke="#6EA1C7" stroke-width="0.62" fill="none" opacity="0.72"/>
      <ellipse cx="24" cy="17" rx="8" ry="4.2" stroke="#4C7FA9" stroke-width="0.72" fill="none" opacity="0.82"/>
      <path d="M5 25 Q16 19 27 21 Q38 23 44 12" stroke="#2B2A28" stroke-width="1.75" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: false,
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      contour_detail: 5,
      contour_opacity: 0.42,
      contour_minor_width: 1.5,
      route_color: '#2B2A28',
      route_width: 2.6,
      background_color: '#ECEAE6',
      label_bg_color: '#ECEAE6',
      label_text_color: '#2B2A28',
      atlas_layer_settings: {
        landcover: { color: '#ECEAE6', opacity: 0.94 },
        park: { fill_color: '#CFE0EA', opacity: 0.26 },
        water: { fill_color: '#B7D8EF', fill_opacity: 0.34 },
        waterway: { color: '#75A8D2', opacity: 0.42, width: 0.9 },
        transportation: { opacity: 0.16, major_color: '#8AA6BD', minor_color: '#B5C8D6', trail_color: '#7D9AB3', show_major: false, show_minor: false, show_trails: false },
        contour: { minor_color: '#B7C0BD', major_color: '#8B9B96', minor_opacity: 0.55, major_width: 0.55 },
        place: { label_color: '#4F6D83', label_opacity: 0.20, font_size: 12, halo_color: '#D7E8F7' },
        poi: { label_opacity: 0.10 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-watercolor',
    label: 'Watercolor',
    title: 'First-party watercolor art tiles — painted paper, washes, roads, trails, water, parks, and sparse pigment artifacts',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-watercolor">
      <rect width="48" height="32" fill="#FFF3DF"/>
      <ellipse cx="12" cy="13" rx="15" ry="10" fill="#98BF8A" opacity="0.44"/>
      <ellipse cx="35" cy="20" rx="14" ry="9" fill="#DCA883" opacity="0.34"/>
      <ellipse cx="26" cy="9" rx="11" ry="5" fill="#F1CB7B" opacity="0.23"/>
      <path d="M0 23 Q13 18 26 20 Q36 22 48 16" stroke="#38B8D0" stroke-width="2.6" fill="none" opacity="0.78"/>
      <path d="M7 12 Q18 8 29 12 Q38 15 45 10" stroke="#89584F" stroke-width="1.15" fill="none" stroke-dasharray="1.4 1.15" opacity="0.58"/>
      <circle cx="38" cy="8" r="1.1" fill="#C2683F" opacity="0.34"/>
      <circle cx="42" cy="12" r="0.8" fill="#2DAAC5" opacity="0.28"/>
      <path d="M5 25 Q16 19 27 21 Q38 23 44 12" stroke="#C2683F" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: true,
      show_hillshade: false,
      show_roads: true,
      contour_detail: 5,
      contour_opacity: 0.36,
      route_color: '#C2683F',
      route_width: 3.2,
      atlas_layer_settings: {
        landcover: { opacity: 1 },
        park: { fill_color: '#98BF8A', opacity: 0.42 },
        water: { fill_color: '#38B8D0', fill_opacity: 0.54 },
        waterway: { color: '#14A9C8', opacity: 0.64, width: 1.6 },
        transportation: { opacity: 0.62, major_color: '#C87938', minor_color: '#D0B171', trail_color: '#6F6B50', show_major: true, show_minor: true, show_trails: true },
        contour: { minor_color: '#8AA17F', major_color: '#6F885F', minor_opacity: 0.14, major_width: 0.45 },
        place: { label_color: '#6B665C', label_opacity: 0.46, font_size: 13, halo_color: '#F4EBD8' },
        poi: { label_opacity: 0.30 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-night-relief',
    label: 'Night Relief',
    title: 'Owned Atlas dark terrain — contours, hydro, and copper route contrast',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-night-relief">
      <rect width="48" height="32" fill="#081611"/>
      <path d="M0 0 H48 V32 H0 Z" fill="#123456" opacity="0.46"/>
      <path d="M0 30 Q10 20 21 22 Q31 24 48 12 V32 H0 Z" fill="#1C5E53" opacity="0.32"/>
      <ellipse cx="24" cy="18" rx="21" ry="11.5" stroke="#39495C" stroke-width="0.7" fill="none"/>
      <ellipse cx="24" cy="18" rx="15" ry="8" stroke="#6C86A4" stroke-width="0.78" fill="none"/>
      <ellipse cx="24" cy="18" rx="8" ry="4.2" stroke="#B6C9D7" stroke-width="0.55" fill="none" opacity="0.62"/>
      <path d="M0 24 Q12 19 24 21 Q34 24 48 15" stroke="#58A4C5" stroke-width="1.2" fill="none" opacity="0.75"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#E8C66A" stroke-width="2.1" fill="none" stroke-linecap="round"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#E8C66A" stroke-width="4.2" fill="none" stroke-linecap="round" opacity="0.16"/>
    </g>`,
    defaults: { show_contours: true, show_hillshade: true, contour_detail: 5, route_color: '#E8C66A', route_width: 3, background_color: '#0A1024', label_bg_color: '#0A1024', label_text_color: '#F3E8D0' },
    beta: true,
  },
  {
    id: 'radmaps-simple-contour',
    label: 'Contours',
    title: 'Owned Atlas contour-first poster — sparse basemap, dense browser contours',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-simple-contour">
      <rect width="48" height="32" fill="#FAF8F1"/>
      <ellipse cx="24" cy="18" rx="23" ry="12.6" stroke="#B4A88E" stroke-width="0.48" fill="none"/>
      <ellipse cx="24" cy="18" rx="19" ry="10.2" stroke="#B4A88E" stroke-width="0.48" fill="none"/>
      <ellipse cx="24" cy="18" rx="15" ry="8" stroke="#A09478" stroke-width="0.52" fill="none"/>
      <ellipse cx="24" cy="18" rx="11" ry="5.8" stroke="#7C6F56" stroke-width="0.66" fill="none"/>
      <ellipse cx="24" cy="18" rx="7" ry="3.6" stroke="#7C6F56" stroke-width="0.86" fill="none"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#9A3B27" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: { show_contours: true, show_hillshade: false, contour_detail: 5, route_color: '#9A3B27', route_width: 3.2 },
    beta: true,
  },
  {
    id: 'radmaps-alidade',
    label: 'Alidade',
    title: 'Owned Atlas Alidade — clean modern cartography without MapTiler',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-alidade">
      <rect width="48" height="32" fill="#F5F3EE"/>
      <rect x="0" y="21" width="48" height="11" fill="#D0DDE8" opacity="0.76"/>
      <path d="M0 7 L48 5" stroke="#B8B0A8" stroke-width="0.9" opacity="0.72"/>
      <path d="M0 15 L48 13" stroke="#D2CBC2" stroke-width="0.7" opacity="0.72"/>
      <path d="M10 0 L8 32" stroke="#B8B0A8" stroke-width="0.85" opacity="0.68"/>
      <path d="M28 0 L29 32" stroke="#D2CBC2" stroke-width="0.62" opacity="0.62"/>
      <path d="M0 25 L48 21" stroke="#A7BAC8" stroke-width="1" opacity="0.64"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#C2502F" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: false,
      show_hillshade: false,
      show_roads: true,
      show_poi_labels: false,
      route_color: '#C2502F',
      route_width: 3,
      background_color: '#DDE3EA',
      label_bg_color: '#DDE3EA',
      label_text_color: '#1C1917',
      atlas_layer_settings: {
        landcover: { color: '#F5F3EE', opacity: 0.72 },
        park: { fill_color: '#E5EAD9', opacity: 0.26 },
        water: { fill_color: '#D0DDE8', fill_opacity: 0.70 },
        waterway: { color: '#A7BAC8', opacity: 0.62, width: 0.9 },
        transportation: { opacity: 0.46, major_color: '#B8B0A8', minor_color: '#D2CBC2', trail_color: '#AAA49A', show_major: true, show_minor: true, show_trails: false },
        place: { label_color: '#3C3832', label_opacity: 0.58, font_size: 12, halo_color: '#F5F3EE' },
        poi: { label_opacity: 0.22 },
      },
    },
    beta: true,
  },
  {
    id: 'radmaps-alidade-dark',
    label: 'Dark Atlas',
    title: 'Owned Atlas dark Alidade — dataviz-style clean dark basemap',
    viewBox: '0 0 48 32',
    svg: `<g data-thumb-key="atlas-alidade-dark">
      <rect width="48" height="32" fill="#141414"/>
      <rect x="0" y="20" width="48" height="12" fill="#0A2836" opacity="0.92"/>
      <path d="M0 7 L48 5" stroke="#6B7280" stroke-width="0.9" opacity="0.72"/>
      <path d="M0 15 L48 13" stroke="#383838" stroke-width="0.78" opacity="0.85"/>
      <path d="M10 0 L8 32" stroke="#585858" stroke-width="0.85" opacity="0.74"/>
      <path d="M28 0 L29 32" stroke="#383838" stroke-width="0.65" opacity="0.78"/>
      <path d="M0 25 L48 21" stroke="#2C5E73" stroke-width="1" opacity="0.76"/>
      <path d="M6 22 Q18 17 30 20 Q38 22 44 17" stroke="#FFD23F" stroke-width="1.95" fill="none" stroke-linecap="round"/>
    </g>`,
    defaults: {
      show_contours: false,
      show_hillshade: false,
      show_roads: true,
      show_poi_labels: false,
      route_color: '#FFD23F',
      route_width: 3,
      background_color: '#0E3A63',
      label_bg_color: '#0E3A63',
      label_text_color: '#DCEEFF',
      atlas_layer_settings: {
        landcover: { color: '#141414', opacity: 0.86 },
        park: { fill_color: '#172A22', opacity: 0.30 },
        water: { fill_color: '#0A2836', fill_opacity: 0.86 },
        waterway: { color: '#2C5E73', opacity: 0.62, width: 0.95 },
        transportation: { opacity: 0.52, major_color: '#585858', minor_color: '#383838', trail_color: '#4A544D', show_major: true, show_minor: true, show_trails: false },
        place: { label_color: '#E8E4DC', label_opacity: 0.62, font_size: 12, halo_color: '#111111' },
        poi: { label_opacity: 0.24 },
      },
    },
    beta: true,
  },
]

const PROVIDER_MAP_PRESETS: MapPresetOption[] = [
  ...CORE_MAP_PRESETS,
  ...BETA_MAP_PRESETS,
]

function applyMapPreset(p: MapPresetOption) {
  const atlasDefaults: Partial<StyleConfig> = p.id.startsWith('radmaps-')
    ? {
        atlas_style_id: p.id,
        atlas_layers: atlasLayerVisibilityDefaults(p.id, p.defaults),
        toner_variant: undefined,
        show_place_labels: true,
        show_poi_labels: true,
      }
    : {}
  Object.assign(local, { preset: p.id, ...atlasDefaults, ...(p.defaults ?? {}) })
  emit('update:modelValue', { ...local })
}
</script>

<!-- ─── Sub-components ─────────────────────────────────────────────────────── -->

<script lang="ts">
export const V4Card = defineComponent({
  props: {
    title: String,
    hint: String,
    defaultOpen: { type: Boolean, default: true },
    collapsible: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const open = ref(props.defaultOpen ?? true)
    return () => h('div', {
      style: 'margin: 10px 12px; padding: 12px 14px; background: #FAFAF9; border-radius: 14px; border: 1px solid #F5F5F4;',
    }, [
      h('div', {
        role: props.collapsible ? 'button' : undefined,
        tabindex: props.collapsible ? 0 : undefined,
        style: [
          'display: flex; align-items: center; justify-content: space-between;',
          `cursor: ${props.collapsible ? 'pointer' : 'default'};`,
          `margin-bottom: ${open.value ? (props.hint ? '2px' : '8px') : '0'};`,
          'user-select: none; color: #1C1917;',
        ].join(' '),
        onClick: () => { if (props.collapsible) open.value = !open.value },
        onKeydown: (e: KeyboardEvent) => {
          if (props.collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            open.value = !open.value
          }
        },
      }, [
        h('span', { style: 'font-size: 12px; font-weight: 700; letter-spacing: 0.04em;' }, props.title),
        h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
          slots.action?.(),
          props.collapsible && h('svg', {
            width: '14', height: '14', viewBox: '0 0 20 20', fill: 'currentColor',
            style: `color: #A8A29E; transform: ${open.value ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s;`,
          }, [
            h('path', {
              'fill-rule': 'evenodd',
              d: 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z',
              'clip-rule': 'evenodd',
            }),
          ]),
        ]),
      ]),
      open.value && props.hint
        ? h('div', { style: 'font-size: 10px; color: #A8A29E; margin-bottom: 10px;' }, props.hint)
        : null,
      open.value ? slots.default?.() : null,
    ])
  },
})

export const ToggleRow = defineComponent({
  props: { label: String, value: Boolean },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('label', { class: 'flex items-center justify-between cursor-pointer mb-3' }, [
      h('span', { style: 'font-size: 12px; color: #44403C; font-weight: 500;' }, props.label),
      h('button', {
        style: [
          'position: relative; width: 34px; height: 20px; border-radius: 999px; border: none; cursor: pointer; padding: 0;',
          `background: ${props.value ? '#2D6A4F' : '#D6D3D1'}; transition: background 0.2s;`,
        ].join(' '),
        onClick: () => emit('change', !props.value),
      }, [
        h('span', {
          style: [
            'position: absolute; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: white;',
            'box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: left 0.2s;',
            `left: ${props.value ? '16px' : '2px'};`,
          ].join(' '),
        }),
      ]),
    ])
  },
})

export const ToggleSwitch = defineComponent({
  props: { value: Boolean },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('button', {
      type: 'button',
      style: [
        'position: relative; width: 30px; height: 18px; border-radius: 999px; border: none; cursor: pointer; padding: 0;',
        `background: ${props.value ? '#2D6A4F' : '#D6D3D1'}; transition: background 0.2s;`,
      ].join(' '),
      onClick: () => emit('change', !props.value),
    }, [
      h('span', {
        style: [
          'position: absolute; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: white;',
          'box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: left 0.2s;',
          `left: ${props.value ? '14px' : '2px'};`,
        ].join(' '),
      }),
    ])
  },
})

export const SliderRow = defineComponent({
  props: {
    label: String,
    value: Number,
    min: Number,
    max: Number,
    step: Number,
    display: { type: Function as PropType<(v: number) => string | number>, default: null },
  },
  emits: ['change'],
  setup(props, { emit }) {
    const pct = computed(() => {
      const min = props.min ?? 0, max = props.max ?? 100, val = props.value ?? min
      return ((val - min) / (max - min)) * 100
    })
    return () => h('div', { class: 'mb-3' }, [
      h('div', { class: 'flex items-center justify-between mb-1' }, [
        h('span', { style: 'font-size: 12px; color: #44403C; font-weight: 500;' }, props.label),
        h('span', { style: 'font-size: 10px; color: #78716C; font-variant-numeric: tabular-nums; min-width: 36px; text-align: right;' },
          props.display?.(props.value ?? 0) ?? props.value),
      ]),
      h('input', {
        type: 'range', min: props.min, max: props.max, step: props.step, value: props.value,
        style: [
          'width: 100%; height: 4px; appearance: none; border-radius: 999px; outline: none; cursor: pointer; -webkit-appearance: none;',
          `background: linear-gradient(to right, #2D6A4F ${pct.value}%, #E7E5E4 ${pct.value}%);`,
        ].join(' '),
        onInput: (e: Event) => emit('change', parseFloat((e.target as HTMLInputElement).value)),
      }),
    ])
  },
})

export const ColorRow = defineComponent({
  props: { label: String, value: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', { class: 'flex items-center justify-between mb-3' }, [
      h('span', { style: 'font-size: 12px; color: #44403C; font-weight: 500;' }, props.label),
      h('label', { class: 'flex items-center gap-2 cursor-pointer' }, [
        h('span', { style: 'font-size: 10px; color: #A8A29E; font-family: monospace;' }, props.value?.toUpperCase()),
        h('label', {
          style: 'position: relative; display: inline-block; width: 22px; height: 22px; cursor: pointer;',
        }, [
          h('div', {
            style: [
              `width: 22px; height: 22px; border-radius: 50%; background: ${props.value};`,
              'border: 2px solid white; box-shadow: 0 0 0 1px #E7E5E4, 0 1px 2px rgba(0,0,0,0.06);',
            ].join(' '),
          }),
          h('input', {
            type: 'color', value: props.value,
            style: 'position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;',
            onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
          }),
        ]),
      ]),
    ])
  },
})

export const ColorSwatch = defineComponent({
  props: { value: String, title: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('label', { class: 'relative cursor-pointer block w-6 h-6', title: props.title }, [
      h('div', {
        style: `width: 24px; height: 24px; border-radius: 50%; background: ${props.value}; border: 2px solid white; box-shadow: 0 0 0 1px #E7E5E4;`,
      }),
      h('input', {
        type: 'color', value: props.value,
        class: 'absolute inset-0 opacity-0 w-full h-full cursor-pointer',
        onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
      }),
    ])
  },
})

export const TextRow = defineComponent({
  props: { label: String, value: String, placeholder: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', { class: 'mb-3' }, [
      h('span', { style: 'display: block; font-size: 11px; font-weight: 500; color: #78716C; margin-bottom: 4px;' }, props.label),
      h('input', {
        type: 'text',
        value: props.value,
        placeholder: props.placeholder,
        class: 'w-full bg-white rounded-xl px-3 py-2.5 text-[16px] leading-snug placeholder-stone-400 focus:outline-none transition-colors',
        style: 'border: 1px solid #E7E5E4; color: #1C1917; min-height: 44px;',
        autocapitalize: 'words',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: 'done',
        onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
      }),
    ])
  },
})

export const FontButton = defineComponent({
  props: { label: String, font: String, active: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      style: [
        'padding: 8px 6px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 100%; border: 1.5px solid;',
        props.active
          ? 'background: #DCEBE2; border-color: #2D6A4F;'
          : 'background: white; border-color: #E7E5E4;',
      ].join(' '),
      onClick: () => emit('click'),
    }, [
      h('span', {
        style: [
          `font-family: '${props.font}', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.2;`,
          props.active ? 'color: #1F4D38;' : 'color: #1C1917;',
        ].join(' '),
      }, 'SUMMIT'),
      h('span', {
        style: `font-size: 9px; color: #A8A29E; line-height: 1;`,
      }, props.label),
    ])
  },
})

export const SegmentButton = defineComponent({
  props: { label: String, active: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      style: [
        'padding: 6px 4px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 1.5px solid; width: 100%;',
        props.active
          ? 'background: #DCEBE2; border-color: #2D6A4F; color: #1F4D38;'
          : 'background: white; border-color: #E7E5E4; color: #78716C;',
      ].join(' '),
      onClick: () => emit('click'),
    }, props.label)
  },
})
</script>

<style scoped>
.segment-save-pulse:not(:disabled) {
  animation: segment-save-pulse 1.9s ease-in-out infinite;
}

@keyframes segment-save-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(45, 106, 79, 0.22);
    transform: translateY(0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(45, 106, 79, 0.08);
    transform: translateY(-0.5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .segment-save-pulse:not(:disabled) {
    animation: none;
  }
}
</style>
