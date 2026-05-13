<template>
  <div class="h-full flex flex-col bg-white overflow-hidden" style="border-radius: 18px 18px 0 0">

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
              class="flex flex-col items-center gap-1 bg-white cursor-pointer transition-all border-none p-0"
              style="border-radius: 10px; border: 2px solid; padding: 4px;"
              :style="{ borderColor: local.color_theme === theme.id ? '#2D6A4F' : '#E7E5E4' }"
            >
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
                }">
                  <svg viewBox="0 0 60 40" style="width: 100%; height: 100%;" fill="none" preserveAspectRatio="xMidYMid slice">
                    <ellipse cx="30" cy="22" rx="22" ry="12" :stroke="theme.label_text_color" stroke-width="0.4" fill="none" opacity="0.18"/>
                    <ellipse cx="30" cy="22" rx="14" ry="8" :stroke="theme.label_text_color" stroke-width="0.4" fill="none" opacity="0.14"/>
                    <path d="M6 32 Q16 26 24 28 Q34 30 44 18 Q50 12 56 14" :stroke="theme.route_color" stroke-width="1.6" fill="none" stroke-linecap="round"/>
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
                :style="{ color: local.color_theme === theme.id ? '#2D6A4F' : '#78716C' }"
              >{{ theme.label }}</span>
            </button>
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
          <ColorRow label="Color" :value="local.route_color" @change="set('route_color', $event)" />
          <SliderRow label="Width" :value="local.route_width" :min="1" :max="10" :step="0.5"
            :display="(v: number) => v + 'px'" @change="set('route_width', $event)" />
        </V4Card>

      </template>

      <!-- ─── MAP TAB ───────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'map'">

        <V4Card title="Base map" :default-open="true">
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="p in MAP_PRESETS"
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
          <ToggleRow label="Elevation gradient" :value="(local.route_color_mode ?? 'solid') === 'gradient'"
            @change="set('route_color_mode', $event ? 'gradient' : 'solid')" />
          <ColorRow label="Color" :value="local.route_color" @change="set('route_color', $event)" />
          <SliderRow label="Width" :value="local.route_width" :min="1" :max="10" :step="0.5"
            :display="(v: number) => v + 'px'" @change="set('route_width', $event)" />
          <SliderRow label="Opacity" :value="local.route_opacity" :min="0.1" :max="1" :step="0.05"
            :display="(v: number) => Math.round(v * 100) + '%'" @change="set('route_opacity', $event)" />
          <SliderRow label="Smooth" :value="local.route_smooth ?? 0" :min="0" :max="10" :step="1"
            :display="(v: number) => v === 0 ? 'Off' : v === 10 ? 'Max' : String(v)"
            @change="set('route_smooth', $event)" />
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
        </V4Card>

        <V4Card title="Terrain" :default-open="false">
          <ToggleRow label="3D terrain" :value="local.map_3d ?? false" @change="set3DTerrain($event)" />
          <template v-if="local.map_3d">
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
          <template v-if="sections.contourDetails">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs" style="color: #44403C;">Minor / Major color</span>
              <div class="flex gap-2">
                <ColorSwatch :value="local.contour_color" @change="set('contour_color', $event)" title="Minor" />
                <ColorSwatch :value="local.contour_major_color" @change="set('contour_major_color', $event)" title="Major" />
              </div>
            </div>
            <SliderRow label="Opacity" :value="local.contour_opacity" :min="0" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('contour_opacity', $event)" />
            <SliderRow label="Detail" :value="local.contour_detail ?? 2" :min="0" :max="5" :step="1"
              :display="(v: number) => (['~200m','~100m','~50m','~20m','~10m','~2m'] as const)[Math.round(v)]"
              @change="set('contour_detail', $event)" />
            <SliderRow label="Minor weight" :value="local.contour_minor_width ?? 1" :min="0.25" :max="2.5" :step="0.25"
              :display="(v: number) => v + '×'" @change="set('contour_minor_width', $event)" />
            <SliderRow label="Major weight" :value="local.contour_major_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH" :min="0.25" :max="2.5" :step="0.25"
              :display="(v: number) => v + '×'" @change="set('contour_major_width', $event)" />
            <ToggleRow label="Elevation labels" :value="local.show_elevation_labels"
              @change="set('show_elevation_labels', $event)" />
          </template>
          <template v-if="sections.elevationProfileToggle">
            <ToggleRow label="Elevation profile" :value="local.show_elevation_profile ?? false" @change="set('show_elevation_profile', $event)" />
          </template>
          <template v-if="sections.elevationProfileExpanded">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs" style="color: #44403C;">Profile color</span>
              <ColorSwatch :value="local.elevation_profile_color ?? local.route_color" @change="set('elevation_profile_color', $event)" />
            </div>
            <SliderRow label="Opacity" :value="local.elevation_profile_opacity ?? 0.65" :min="0.1" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('elevation_profile_opacity', $event)" />
            <SliderRow label="Height" :value="local.elevation_profile_height ?? 22" :min="8" :max="40" :step="2"
              :display="(v: number) => Math.round(v) + '%'" @change="set('elevation_profile_height', $event)" />
          </template>
        </V4Card>

        <V4Card title="Effects" hint="Advanced — invert, duotone, posterize, grain" :default-open="false">
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
          <ToggleRow label="Vignette" :value="local.show_vignette ?? false" @change="set('show_vignette', $event)" />
          <template v-if="sections.vignetteIntensity">
            <SliderRow label="Intensity" :value="local.vignette_intensity ?? 0.45" :min="0.05" :max="1" :step="0.05"
              :display="(v: number) => Math.round(v * 100) + '%'" @change="set('vignette_intensity', $event)" />
          </template>
          <SliderRow label="Grain" :value="local.tile_grain ?? 0" :min="0" :max="0.5" :step="0.02"
            :display="(v: number) => v === 0 ? 'Off' : Math.round(v * 100) + '%'" @change="set('tile_grain', $event)" />
        </V4Card>

        <V4Card v-if="sections.trailSegmentsCard" title="Trail segments" :default-open="false">
          <p class="text-[10px] mb-3" style="color: #A8A29E;">Name and color sections of your route to build a map legend</p>

          <!-- Apply to all controls -->
          <template v-if="(local.trail_segments ?? []).length > 0">
            <div class="mb-3 p-2.5 rounded-xl" style="background: #F5F5F4;">
              <p class="text-[10px] font-semibold uppercase mb-2" style="letter-spacing: 0.12em; color: #A8A29E;">Apply to all</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Width</span>
                  <input type="range" min="1" max="8" step="0.5" :value="(local.trail_segments ?? [])[0]?.width ?? 3"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="applyToAll({ width: parseFloat(($event.target as HTMLInputElement).value) })" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 24px;">{{ ((local.trail_segments ?? [])[0]?.width ?? 3) }}px</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs shrink-0" style="color: #44403C; width: 44px;">Border</span>
                  <input type="range" min="0" max="8" step="0.5" :value="local.segment_casing_width ?? 3"
                    class="flex-1 h-1 rounded-full appearance-none cursor-pointer" style="accent-color: #2D6A4F;"
                    @change="set('segment_casing_width', parseFloat(($event.target as HTMLInputElement).value))" />
                  <span class="text-[10px] shrink-0 text-right" style="color: #78716C; width: 24px;">{{ local.segment_casing_width ?? 3 }}px</span>
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
                    <p class="text-xs" style="color: #44403C;">Route section</p>
                    <div class="flex gap-1">
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
                  <SliderRow label="Start" :value="seg.section_start" :min="0" :max="100" :step="segmentDistanceStepPct" :display="segmentPctDisplay" @change="setSegment(seg.id, { section_start: Math.min($event, seg.section_end - segmentDistanceStepPct) })" />
                  <SliderRow label="End" :value="seg.section_end" :min="0" :max="100" :step="segmentDistanceStepPct" :display="segmentPctDisplay" @change="setSegment(seg.id, { section_end: Math.max($event, seg.section_start + segmentDistanceStepPct) })" />
                </div>
                <SliderRow label="Width" :value="seg.width ?? 3" :min="1" :max="8" :step="0.5" :display="(v: number) => v + 'px'" @change="setSegment(seg.id, { width: $event })" />
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: #44403C;">Dashed</span>
                  <button class="px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer" style="border: 1px solid;" :style="seg.dash ? 'border-color: #2D6A4F; background: #DCEBE2; color: #1F4D38;' : 'border-color: #E7E5E4; color: #78716C; background: white;'" @click="setSegment(seg.id, { dash: !seg.dash })">- - -</button>
                </div>
              </div>
            </div>
            <button class="w-full py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer" style="border: 2px dashed #E7E5E4; color: #A8A29E; background: transparent;" @click="addSegment">+ Add segment</button>
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
              </div>
            </template>
          </div>
        </V4Card>

      </template>

      <!-- ─── STYLE TAB ─────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'style'">

        <V4Card title="Colors" hint="Auto-set by theme · override below" :default-open="true">
          <ColorRow label="Background" :value="local.background_color" @change="set('background_color', $event)" />
          <ColorRow label="Label band" :value="local.label_bg_color" @change="set('label_bg_color', $event)" />
          <ColorRow label="Text" :value="local.label_text_color" @change="set('label_text_color', $event)" />
        </V4Card>

        <V4Card title="Grid" hint="Optional poster or map overlay" :default-open="false">
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

        <V4Card title="Typography" :default-open="false">
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

        <V4Card title="Frame & padding" :default-open="false">
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

        <V4Card title="Global typography" hint="Selected poster text edits inline" :default-open="true">
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
                <button class="transition-colors ml-1 shrink-0" style="color: #D6D3D1; background: none; border: none; cursor: pointer; padding: 0;" @click="expandedOverlayId = expandedOverlayId === overlay.id ? null : overlay.id">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path v-if="expandedOverlayId === overlay.id" fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
                    <path v-else fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <button class="transition-colors shrink-0" style="color: #D6D3D1; background: none; border: none; cursor: pointer; padding: 0;" @click="removeOverlay(overlay.id)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
              </div>
              <div v-if="false && expandedOverlayId === overlay.id" class="px-3 py-3 space-y-3" style="border-top: 1px solid #F5F5F4;">
                <div class="space-y-1">
                  <span class="text-xs" style="color: #44403C;">Content</span>
                  <textarea
                    :value="overlay.content"
                    rows="2"
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
import type { StyleConfig, StyleLabels, FontFamily, BorderStyle, BaseTileStyle, ThemeDefinition, TextOverlay, TrailSegment, StylePreset, RouteStats, MapAsset, MapAssetKind } from '~/types'
import { COLOR_THEMES, DEFAULT_CONTOUR_MAJOR_WIDTH } from '~/types'
import { useSavedThemes, type SavedTheme } from '~/composables/useSavedThemes'
import { computeSectionVisibility } from '~/utils/stylePanelGating'
import { FLAGS } from '~/utils/knownFlags'
import { IMAGE_UPLOAD_ACCEPT, classifyAssetQuality, computeEffectiveDpi, qualityLabel } from '~/utils/imageAssets'
import { REFINED_THEMES, getThemeDefinition } from '~/utils/themes/refined'
import { getPosterCompositionProfile } from '~/utils/posterCompositions'
import { applyThemeToStyleConfig, pairedBodyFont } from '~/utils/themeApplication'
import { pickContrastSafeColor } from '~/utils/colorContrast'
import { mapBackgroundColor } from '~/utils/mapStyle'

type PosterTextField = 'trail_name' | 'occasion_text' | 'location_text'
type ActiveTextTarget =
  | { type: 'poster-text'; field: PosterTextField }
  | { type: 'text-overlay'; id: string }
  | { type: 'image-overlay'; id: string }

const THEME_THUMB: Record<string, {
  titlePosition: 'top' | 'bottom'
  titleAlign: 'center' | 'left'
  fontWeight: string
  fontSize: string
  letterSpacing: string
  textTransform: string
  lineHeight: string
  headerBackground?: 'paper' | 'label'
  footerBackground?: 'paper' | 'label'
}> = {
  chalk:           { titlePosition: 'top',    titleAlign: 'center', fontWeight: '300', fontSize: '5.5px', letterSpacing: '0.32em', textTransform: 'uppercase', lineHeight: '1.2'  },
  topaz:           { titlePosition: 'top',    titleAlign: 'center', fontWeight: '700', fontSize: '7.5px', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: '1.05' },
  dusk:            { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '7.5px', letterSpacing: '0.03em', textTransform: 'none',      lineHeight: '1.1'  },
  obsidian:        { titlePosition: 'top',    titleAlign: 'center', fontWeight: '800', fontSize: '9px',   letterSpacing: '-0.01em', textTransform: 'uppercase', lineHeight: '0.95' },
  forest:          { titlePosition: 'top',    titleAlign: 'center', fontWeight: '600', fontSize: '7.5px', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '1.05' },
  midnight:        { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '7px',   letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: '1.05' },
  editorial:       { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '400', fontSize: '7.5px', letterSpacing: '0.02em', textTransform: 'none',      lineHeight: '1.1'  },
  bauhaus:         { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '900', fontSize: '9.5px', letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: '0.9'  },
  vintage:         { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '8px',   letterSpacing: '0.04em', textTransform: 'none',      lineHeight: '1.08' },
  brutalist:       { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '400', fontSize: '9.5px', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: '0.92' },
  risograph:       { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '500', fontSize: '7px',   letterSpacing: '0.10em', textTransform: 'uppercase', lineHeight: '1.0'  },
  blueprint:       { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '700', fontSize: '6px',   letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: '1.05' },
  kertok:          { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '200', fontSize: '7px',   letterSpacing: '0.06em', textTransform: 'none',      lineHeight: '1.12' },
  'mid-century':   { titlePosition: 'bottom', titleAlign: 'center', fontWeight: '400', fontSize: '6px',   letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: '1.05' },
  'topo-art':      { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '5.5px', letterSpacing: '0.28em', textTransform: 'uppercase', lineHeight: '1.15' },
  'dark-sky':      { titlePosition: 'bottom', titleAlign: 'center', fontWeight: '400', fontSize: '8px',   letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '1.0'  },
}

const DEFAULT_THEME_THUMB = {
  titlePosition: 'top',
  titleAlign: 'center',
  fontWeight: '700',
  fontSize: '7px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  lineHeight: '1.1',
} as const

const THEME_OPTIONS: ThemeDefinition[] = [
  ...REFINED_THEMES,
  ...COLOR_THEMES.filter(theme => !theme.legacy && !REFINED_THEMES.some(refined => refined.id === theme.id)),
]

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
  /** Text element selected from the poster preview */
  activeTextTarget?: ActiveTextTarget | null
  /** Enable the staff-only Scout tab when the feature flag resolves true */
  scoutAvailable?: boolean
  /** Route stats passed to Scout for style context */
  routeStats?: RouteStats
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
}))

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
type TabId = 'quick' | 'map' | 'style' | 'text' | 'scout'
const activeTab = ref<TabId>('quick')

const BASE_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'quick', label: 'Quick' },
  { id: 'map',   label: 'Map' },
  { id: 'style', label: 'Style' },
  { id: 'text',  label: 'Text' },
]

const scoutEnabled = useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)
const showScoutTab = computed(() => Boolean(props.scoutAvailable && scoutEnabled.value))
const visibleTabs = computed(() => showScoutTab.value
  ? [...BASE_TABS, { id: 'scout' as const, label: 'Scout' }]
  : BASE_TABS,
)

watch(showScoutTab, (visible) => {
  if (!visible && activeTab.value === 'scout') activeTab.value = 'quick'
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
  { id: 'DM Sans',               label: 'DM Sans' },
  { id: 'Space Grotesk',         label: 'Space Grotesk' },
  { id: 'Oswald',                label: 'Oswald' },
  { id: 'Big Shoulders Display', label: 'Big Shoulders' },
]

const SEGMENT_DISTANCE_STEP_MI = 0.05

const segmentDistanceStepPct = computed(() => {
  const totalMi = props.totalDistanceKm ? props.totalDistanceKm * 0.621371 : 0
  if (!totalMi) return 0.01
  return Math.max(0.001, Math.min(1, (SEGMENT_DISTANCE_STEP_MI / totalMi) * 100))
})

function addSegment() {
  const usedColors = (local.trail_segments ?? []).map(s => s.color)
  const nextColor = SEGMENT_COLORS.find(c => !usedColors.includes(c)) ?? SEGMENT_COLORS[0]
  const seg: TrailSegment = {
    id: crypto.randomUUID(),
    name: `Trail ${(local.trail_segments?.length ?? 0) + 1}`,
    color: nextColor,
    visible: true,
    section_start: 0,
    section_end: 100,
    width: 3,
    opacity: 0.9,
    dash: false,
  }
  set('trail_segments', [...(local.trail_segments ?? []), seg])
  expandedSegmentId.value = seg.id
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
  local.leader_label_font_family = 'Big Shoulders Display'
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

function selectFont(fontName: FontFamily) {
  local.font_family = fontName
  local.body_font_family = pairedBodyFont(fontName)
  emit('update:modelValue', { ...local })
}

const fontGroups: Array<{ label: string; fonts: FontFamily[] }> = [
  { label: 'EDITORIAL', fonts: ['Big Shoulders Display', 'Fjalla One', 'Oswald', 'Bebas Neue'] },
  { label: 'MODERN', fonts: ['DM Sans', 'Space Grotesk', 'Outfit', 'Work Sans'] },
  { label: 'REFINED', fonts: ['Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'DM Serif Display'] },
]

const THEME_FONT_PREVIEW: Record<string, string> = {
  chalk:       "'Work Sans', sans-serif",
  topaz:       "'Space Grotesk', sans-serif",
  dusk:        "'DM Serif Display', serif",
  obsidian:    "'Big Shoulders Display', sans-serif",
  forest:      "'Oswald', sans-serif",
  midnight:    "'Fjalla One', sans-serif",
  editorial:   "'Playfair Display', serif",
  bauhaus:     "'Big Shoulders Display', sans-serif",
  vintage:     "'DM Serif Display', serif",
  brutalist:   "'Bebas Neue', sans-serif",
  risograph:   "'Oswald', sans-serif",
  blueprint:   "'Space Grotesk', sans-serif",
  kertok:      "'Work Sans', sans-serif",
  'mid-century': "'Oswald', sans-serif",
  'topo-art':  "'Work Sans', sans-serif",
  'dark-sky':  "'Fjalla One', sans-serif",
}

const THEME_FONT_NAME: Record<string, string> = {
  chalk:       'Work Sans Light',
  topaz:       'Space Grotesk Bold',
  dusk:        'DM Serif Display',
  obsidian:    'Big Shoulders Display',
  forest:      'Oswald SemiBold',
  midnight:    'Fjalla One',
  editorial:   'Playfair Display',
  bauhaus:     'Big Shoulders Display',
  vintage:     'DM Serif Display',
  brutalist:   'Bebas Neue',
  risograph:   'Oswald',
  blueprint:   'Space Grotesk',
  kertok:      'Work Sans',
  'mid-century': 'Oswald',
  'topo-art':  'Work Sans',
  'dark-sky':  'Fjalla One',
}

function themeThumb(theme: ThemeDefinition) {
  const composition = getPosterCompositionProfile({
    color_theme: theme.id,
    composition: theme.composition,
  })
  const base = THEME_THUMB[theme.id] ?? DEFAULT_THEME_THUMB
  return {
    ...base,
    titlePosition: composition.titlePosition,
    titleAlign: composition.titleAlign,
    fontWeight: theme.id === 'brutalist' || theme.id === 'marathon-bib' ? '900' : base.fontWeight,
    fontSize: theme.id === 'brutalist' || theme.id === 'bold-modern' ? '8px' : base.fontSize,
    letterSpacing: theme.id === 'editorial-minimal' ? '0.02em' : base.letterSpacing,
    textTransform: theme.id === 'editorial-minimal' ? 'none' : base.textTransform,
    headerBackground: composition.headerBackground,
    footerBackground: 'label',
  }
}

function themeFontPreview(theme: ThemeDefinition): string {
  return THEME_FONT_PREVIEW[theme.id] ?? (theme.font_family ? `'${theme.font_family}', sans-serif` : 'system-ui')
}

const activeThemeDefinition = computed(() => getThemeDefinition(local.color_theme ?? 'chalk'))
const activeThemeTypography = computed(() =>
  THEME_FONT_NAME[local.color_theme ?? 'chalk'] ?? activeThemeDefinition.value?.font_family ?? 'Work Sans',
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
    id: 'native-watercolor', label: 'Watercolor',
    title: 'Warm paper wash — CARTO tiles at low opacity over cream background',
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

const MAP_PRESETS: MapPresetOption[] = [
  ...CORE_MAP_PRESETS,
  ...BETA_MAP_PRESETS,
]

function applyMapPreset(p: MapPresetOption) {
  Object.assign(local, { preset: p.id, ...(p.defaults ?? {}) })
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
