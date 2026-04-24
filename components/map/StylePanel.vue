<template>
  <div class="h-full flex flex-col bg-white overflow-hidden">

    <!-- Panel header -->
    <div class="px-5 py-3 border-b flex items-center justify-between shrink-0">
      <h2 class="text-sm font-semibold text-gray-700">Style</h2>
      <UBadge v-if="saving" color="gray" size="xs" variant="subtle">Saving…</UBadge>
    </div>

    <!-- Scrollable controls -->
    <div class="flex-1 overflow-y-auto divide-y divide-gray-100">

      <!-- ── Themes ── -->
      <Section label="Theme" icon="i-heroicons-swatch">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="theme in COLOR_THEMES"
            :key="theme.id"
            @click="applyTheme(theme)"
            :class="[
              'relative flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-all overflow-hidden',
              local.color_theme === theme.id
                ? 'border-green-600'
                : 'border-gray-200 hover:border-gray-300',
            ]"
          >
            <!-- Poster mini-preview -->
            <div class="w-full rounded overflow-hidden" style="aspect-ratio: 18/24; position: relative;">
              <!-- Paper background -->
              <div class="absolute inset-0" :style="{ backgroundColor: theme.background_color }" />
              <!-- Title text (shows theme font personality) -->
              <div
                class="absolute inset-0 flex flex-col items-center justify-start pt-[8%] px-[6%] gap-[3%]"
              >
                <span
                  :style="{
                    fontFamily: THEME_FONT_PREVIEW[theme.id],
                    color: theme.label_text_color,
                    fontSize: '6px',
                    fontWeight: THEME_FONT_WEIGHT[theme.id],
                    letterSpacing: THEME_FONT_TRACKING[theme.id],
                    textTransform: 'uppercase',
                    lineHeight: '1.1',
                    textAlign: 'center',
                    display: 'block',
                    width: '100%',
                  }"
                >SUMMIT<br/>TRAIL</span>
                <!-- Divider -->
                <div class="w-full" :style="{ height: '0.5px', backgroundColor: theme.label_text_color, opacity: '0.2' }" />
                <!-- Map area (route squiggle) -->
                <div class="relative flex-1 w-full rounded-sm overflow-hidden" style="height: 55%">
                  <svg viewBox="0 0 48 32" class="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid slice">
                    <!-- Topo rings -->
                    <ellipse cx="24" cy="18" rx="18" ry="10" :stroke="theme.label_text_color" stroke-width="0.5" fill="none" opacity="0.12"/>
                    <ellipse cx="24" cy="18" rx="12" ry="7" :stroke="theme.label_text_color" stroke-width="0.5" fill="none" opacity="0.1"/>
                    <ellipse cx="24" cy="18" rx="6" ry="4" :stroke="theme.label_text_color" stroke-width="0.5" fill="none" opacity="0.08"/>
                    <!-- Route -->
                    <path d="M6 26 Q14 20 20 22 Q28 24 36 14 Q40 10 44 12"
                      :stroke="theme.route_color" stroke-width="2" fill="none" stroke-linecap="round"/>
                  </svg>
                </div>
              </div>
            </div>
            <span
              class="text-[9px] leading-none font-medium"
              :class="local.color_theme === theme.id ? 'text-green-700' : 'text-gray-500'"
            >{{ theme.label }}</span>
          </button>
        </div>
      </Section>

      <!-- ── Print Size ── -->
      <Section label="Print Size" icon="i-heroicons-rectangle-stack">
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="size in PRINT_SIZES"
            :key="size.id"
            @click="set('print_size', size.id)"
            :class="[
              'py-1.5 rounded border text-[10px] font-medium transition-all leading-tight text-center',
              local.print_size === size.id
                ? 'border-green-600 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300',
            ]"
          >{{ size.label }}</button>
        </div>
      </Section>

      <!-- ── Base Map ── -->
      <Section label="Base Map" icon="i-heroicons-map">
        <div class="space-y-3">
          <!-- 3×2 preset grid -->
          <div class="grid grid-cols-3 gap-1.5">
            <button v-for="p in MAP_PRESETS" :key="p.id"
              class="flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all overflow-hidden"
              :class="local.preset === p.id
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'"
              @click="set('preset', p.id)"
              :title="p.title"
            >
              <div class="w-full rounded overflow-hidden" style="aspect-ratio:3/2">
                <svg :viewBox="p.viewBox" class="w-full h-full" preserveAspectRatio="xMidYMid slice" v-html="p.svg" />
              </div>
              <span class="text-[9px] leading-none font-medium"
                :class="local.preset === p.id ? 'text-green-700' : 'text-gray-500'"
              >{{ p.label }}</span>
            </button>
          </div>

          <!-- Tile style variant (minimalist + natural-topo only) -->
          <template v-if="local.preset === 'minimalist'">
            <p class="text-[10px] text-gray-400 -mb-1">Tile style</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button v-for="ts in TILE_STYLES" :key="ts.value"
                class="rounded border text-[10px] py-1 px-1.5 text-center transition-colors"
                :class="(local.base_tile_style ?? 'carto-light') === ts.value
                  ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'"
                @click="set('base_tile_style', ts.value)"
              >{{ ts.label }}</button>
            </div>
          </template>

          <template v-if="local.preset === 'natural-topo'">
            <p class="text-[10px] text-gray-400 -mb-1">Tile variant</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button v-for="ts in TOPO_TILE_STYLES" :key="ts.value"
                class="rounded border text-[10px] py-1 px-1.5 text-center transition-colors"
                :class="(local.base_tile_style ?? 'maptiler-outdoor') === ts.value
                  ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'"
                @click="set('base_tile_style', ts.value)"
              >{{ ts.label }}</button>
            </div>
          </template>

          <!-- Freeze status (shown when map is frozen) -->
          <div v-if="local.map_frozen" class="flex items-center gap-2 px-2.5 py-2 bg-green-50 border border-green-200 rounded-lg">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <p class="text-[10px] text-green-700 leading-snug flex-1">
              View frozen at Z{{ local.map_zoom?.toFixed(1) }} · position locked
            </p>
          </div>
        </div>
      </Section>

      <!-- ── Poster Text ── -->
      <Section label="Poster Text" icon="i-heroicons-pencil">
        <div class="space-y-3">
          <TextRow label="Trail name" :value="local.trail_name" placeholder="Defaults to map title"
            @change="set('trail_name', $event)" />
          <TextRow label="Occasion" :value="local.occasion_text" placeholder="e.g. Summit Day 2024"
            @change="set('occasion_text', $event)" />
          <TextRow label="Location" :value="local.location_text" placeholder="e.g. Moab, Utah"
            @change="set('location_text', $event)" />
        </div>
      </Section>

      <!-- ── Route ── -->
      <Section label="Route" icon="i-heroicons-map-pin">
        <div class="space-y-3">
          <ColorRow label="Colour" :value="local.route_color" @change="set('route_color', $event)" />
          <SliderRow label="Width" :value="local.route_width" :min="1" :max="10" :step="0.5"
            :display="v => v + 'px'" @change="set('route_width', $event)" />
          <SliderRow label="Opacity" :value="local.route_opacity" :min="0.1" :max="1" :step="0.05"
            :display="v => Math.round(v * 100) + '%'" @change="set('route_opacity', $event)" />
          <SliderRow label="Smooth" :value="local.route_smooth ?? 0" :min="0" :max="5" :step="1"
            :display="v => (['Off','Light','Gentle','Medium','Strong','Max'] as const)[Math.round(v)]"
            @change="set('route_smooth', $event)" />
          <!-- Start / Finish pins -->
          <div class="pt-1 border-t border-gray-100" />
          <p class="text-[10px] text-gray-400 -mb-1">Pins</p>
          <div class="flex items-center gap-3">
            <!-- Start pin preview -->
            <div class="flex flex-col items-center gap-1 shrink-0">
              <svg viewBox="0 0 28 28" width="28" height="28" class="overflow-visible">
                <circle cx="14" cy="14" r="11" fill="white" opacity="0.88"/>
                <circle cx="14" cy="14" r="8" :fill="local.route_color"/>
                <circle cx="14" cy="14" r="3.5" fill="white"/>
              </svg>
              <span class="text-[9px] text-gray-400 leading-none">Start</span>
            </div>
            <div class="flex-1 space-y-2">
              <ToggleRow label="Show start" :value="local.show_start_pin ?? true" @change="set('show_start_pin', $event)" />
              <ToggleRow label="Show finish" :value="local.show_finish_pin ?? true" @change="set('show_finish_pin', $event)" />
            </div>
            <!-- Finish pin preview -->
            <div class="flex flex-col items-center gap-1 shrink-0">
              <svg viewBox="0 0 28 28" width="28" height="28" class="overflow-visible">
                <circle cx="14" cy="14" r="11" fill="white" opacity="0.88"/>
                <circle cx="14" cy="14" r="9" :fill="local.route_color"/>
                <circle cx="14" cy="14" r="3" fill="white"/>
              </svg>
              <span class="text-[9px] text-gray-400 leading-none">Finish</span>
            </div>
          </div>
        </div>
      </Section>

      <!-- ── Terrain ── -->
      <Section label="Terrain" icon="i-heroicons-signal">
        <div class="space-y-3">
          <ToggleRow label="Hillshade" :value="local.show_hillshade" @change="set('show_hillshade', $event)" />
          <template v-if="local.show_hillshade">
            <SliderRow label="Intensity" :value="local.hillshade_intensity" :min="0" :max="1" :step="0.05"
              :display="v => Math.round(v * 100) + '%'" @change="set('hillshade_intensity', $event)" />
          </template>
          <div class="pt-1 border-t border-gray-100" />
          <ToggleRow label="Contour lines" :value="local.show_contours" @change="set('show_contours', $event)" />
          <template v-if="local.show_contours">
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>Minor / Major colour</span>
              <div class="flex gap-2">
                <ColorSwatch :value="local.contour_color" @change="set('contour_color', $event)" title="Minor" />
                <ColorSwatch :value="local.contour_major_color" @change="set('contour_major_color', $event)" title="Major" />
              </div>
            </div>
            <SliderRow label="Opacity" :value="local.contour_opacity" :min="0" :max="1" :step="0.05"
              :display="v => Math.round(v * 100) + '%'" @change="set('contour_opacity', $event)" />
            <SliderRow label="Detail" :value="local.contour_detail ?? 2" :min="0" :max="4" :step="1"
              :display="v => (['~200m','~100m','~50m','~20m','~10m'] as const)[Math.round(v)]"
              @change="set('contour_detail', $event)" />
            <ToggleRow label="Elevation labels" :value="local.show_elevation_labels"
              @change="set('show_elevation_labels', $event)" />
          </template>
          <div class="pt-1 border-t border-gray-100" />
          <ToggleRow label="Roads &amp; place labels" :value="local.show_roads ?? false" @change="set('show_roads', $event)" />
        </div>
      </Section>

      <!-- ── Effects ── -->
      <Section label="Effects" icon="i-heroicons-sparkles">
        <div class="space-y-3">

          <!-- Tile effect picker -->
          <div>
            <p class="text-xs text-gray-500 mb-2">Tile effect</p>
            <div class="grid grid-cols-2 gap-1.5">
              <SegmentButton label="None"         :active="(local.tile_effect ?? 'none') === 'none'"  @click="set('tile_effect', 'none')" />
              <SegmentButton label="Duotone"      :active="local.tile_effect === 'duotone'"            @click="set('tile_effect', 'duotone')" />
              <SegmentButton label="Posterize"    :active="local.tile_effect === 'posterize'"          @click="set('tile_effect', 'posterize')" />
              <SegmentButton label="Layer Color"  :active="local.tile_effect === 'layer-color'"        @click="set('tile_effect', 'layer-color')" />
            </div>
          </div>

          <!-- Duotone controls -->
          <template v-if="local.tile_effect === 'duotone'">
            <p class="text-[10px] text-gray-400 -mb-1">Remaps tile luminance to your poster's shadow → highlight colours</p>
            <SliderRow label="Strength" :value="local.tile_duotone_strength ?? 0.9" :min="0.1" :max="1" :step="0.05"
              :display="v => Math.round(v * 100) + '%'" @change="set('tile_duotone_strength', $event)" />
          </template>

          <!-- Posterize controls -->
          <template v-if="local.tile_effect === 'posterize'">
            <p class="text-[10px] text-gray-400 -mb-1">Quantises tile colours to a limited palette — screen-print look</p>
            <SliderRow label="Levels" :value="local.tile_posterize_levels ?? 4" :min="2" :max="8" :step="1"
              :display="v => Math.round(v) + ' colours'" @change="set('tile_posterize_levels', $event)" />
          </template>

          <!-- Layer-color controls -->
          <template v-if="local.tile_effect === 'layer-color'">
            <p class="text-[10px] text-gray-400 -mb-1">Maps dark / mid / light tile regions to independent colours</p>
            <ColorRow
              label="Shadow (dark)"
              :value="local.tile_shadow_color ?? local.label_text_color"
              @change="set('tile_shadow_color', $event)"
            />
            <ColorRow
              label="Midtone"
              :value="local.tile_midtone_color ?? blendForPreview(local.tile_shadow_color ?? local.label_text_color, local.tile_highlight_color ?? local.background_color)"
              @change="set('tile_midtone_color', $event)"
            />
            <ColorRow
              label="Highlight (light)"
              :value="local.tile_highlight_color ?? local.background_color"
              @change="set('tile_highlight_color', $event)"
            />
          </template>

          <div class="pt-1 border-t border-gray-100" />

          <!-- Raster adjustments (work with or without tile effect) -->
          <SliderRow label="Contrast" :value="local.tile_contrast ?? 0" :min="-1" :max="1" :step="0.05"
            :display="v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%'" @change="set('tile_contrast', $event)" />
          <SliderRow label="Saturation" :value="local.tile_saturation ?? 0" :min="-1" :max="1" :step="0.05"
            :display="v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%'" @change="set('tile_saturation', $event)" />
          <SliderRow label="Hue shift" :value="local.tile_hue_rotate ?? 0" :min="0" :max="360" :step="5"
            :display="v => Math.round(v) + '°'" @change="set('tile_hue_rotate', $event)" />

          <div class="pt-1 border-t border-gray-100" />

          <!-- Vignette -->
          <ToggleRow label="Vignette" :value="local.show_vignette ?? false" @change="set('show_vignette', $event)" />
          <template v-if="local.show_vignette">
            <SliderRow label="Intensity" :value="local.vignette_intensity ?? 0.45" :min="0.05" :max="1" :step="0.05"
              :display="v => Math.round(v * 100) + '%'" @change="set('vignette_intensity', $event)" />
          </template>

          <!-- Film grain -->
          <SliderRow label="Grain" :value="local.tile_grain ?? 0" :min="0" :max="0.5" :step="0.02"
            :display="v => v === 0 ? 'Off' : Math.round(v * 100) + '%'" @change="set('tile_grain', $event)" />

        </div>
      </Section>

      <!-- ── Colours ── -->
      <Section label="Colours" icon="i-heroicons-swatch">
        <p class="text-[10px] text-gray-400 mb-3 -mt-1">Auto-set by theme · override below</p>
        <div class="space-y-3">
          <ColorRow label="Background" :value="local.background_color" @change="set('background_color', $event)" />
          <ColorRow label="Label band" :value="local.label_bg_color" @change="set('label_bg_color', $event)" />
          <ColorRow label="Text" :value="local.label_text_color" @change="set('label_text_color', $event)" />
          <ColorRow label="Water" :value="local.water_color" @change="set('water_color', $event)" />
        </div>
      </Section>

      <!-- ── Typography ── -->
      <Section label="Typography" icon="i-heroicons-bars-3-bottom-left">
        <!-- Theme typography hint -->
        <div class="flex items-center gap-2 mb-3 px-2.5 py-2 bg-gray-50 rounded-lg border border-gray-100">
          <div class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <p class="text-[10px] text-gray-500 leading-snug">
            <span class="font-semibold text-gray-700">{{ activeThemeTypography }}</span> is set by your theme.
            Pick below to override.
          </p>
        </div>
        <template v-for="group in fontGroups" :key="group.label">
          <p :class="['text-[9px] font-semibold tracking-widest uppercase text-gray-400 mb-1.5 mt-3', group === fontGroups[0] ? 'mt-0' : '']">{{ group.label }}</p>
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
        <p v-if="local.body_font_family && local.body_font_family !== local.font_family" class="text-[9px] text-gray-400 mt-3 pl-0.5">
          Body paired with <span class="font-medium text-gray-500" :style="{ fontFamily: local.body_font_family }">{{ local.body_font_family }}</span>
        </p>
      </Section>

      <!-- ── Labels ── -->
      <Section label="Labels" icon="i-heroicons-tag">
        <div class="space-y-2.5">
          <ToggleRow label="Trail name" :value="local.labels.show_title"
            @change="setLabel('show_title', $event)" />
          <ToggleRow label="Distance" :value="local.labels.show_distance"
            @change="setLabel('show_distance', $event)" />
          <ToggleRow label="Elevation gain" :value="local.labels.show_elevation_gain"
            @change="setLabel('show_elevation_gain', $event)" />
          <ToggleRow label="Date" :value="local.labels.show_date"
            @change="setLabel('show_date', $event)" />
          <ToggleRow label="Location" :value="local.labels.show_location"
            @change="setLabel('show_location', $event)" />
          <div class="pt-1 border-t border-gray-100" />
          <ToggleRow label="RadMaps credit" :value="local.show_branding ?? true"
            @change="set('show_branding', $event)" />
        </div>
      </Section>

      <!-- ── Logo ── -->
      <Section label="Logo" icon="i-heroicons-photo">
        <div class="space-y-3">
          <!-- Upload area -->
          <div v-if="!local.logo_url" class="relative">
            <label class="flex flex-col items-center justify-center gap-2 w-full min-h-[60px] border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-green-400 transition-colors bg-gray-50">
              <svg class="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
              <span class="text-xs text-gray-500">Tap to upload logo</span>
              <input ref="logoInputRef" type="file" accept="image/*" class="sr-only" @change="handleLogoUpload" />
            </label>
          </div>
          <!-- Preview + remove -->
          <div v-else class="flex items-center gap-3">
            <img :src="local.logo_url" alt="Logo" class="h-10 w-auto rounded border border-gray-200 object-contain bg-white p-0.5" />
            <div class="flex-1 min-w-0">
              <ToggleRow label="Show logo" :value="local.show_logo ?? false" @change="set('show_logo', $event)" />
            </div>
            <button class="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0" @click="set('logo_url', undefined); set('show_logo', false)">Remove</button>
          </div>
          <template v-if="local.logo_url && local.show_logo">
            <div>
              <p class="text-xs text-gray-500 mb-2">Position</p>
              <div class="grid grid-cols-3 gap-1.5">
                <SegmentButton label="Map" :active="(local.logo_position ?? 'map-top-right') === 'map-top-right'" @click="set('logo_position', 'map-top-right')" />
                <SegmentButton label="Header" :active="local.logo_position === 'header-right'" @click="set('logo_position', 'header-right')" />
                <SegmentButton label="Footer" :active="local.logo_position === 'footer-left'" @click="set('logo_position', 'footer-left')" />
              </div>
            </div>
            <SliderRow label="Size" :value="local.logo_size ?? 8" :min="4" :max="18" :step="1"
              :display="v => v + 'u'" @change="set('logo_size', $event)" />
          </template>
        </div>
      </Section>

      <!-- ── Text Overlays ── -->
      <Section label="Text" icon="i-heroicons-cursor-arrow-rays">
        <div class="space-y-2">
          <div
            v-for="overlay in (local.text_overlays ?? [])"
            :key="overlay.id"
            class="border border-gray-100 rounded-xl overflow-hidden"
          >
            <!-- Row header -->
            <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
              <div class="w-3 h-3 rounded-full shrink-0 border border-white ring-1 ring-gray-200" :style="{ backgroundColor: overlay.color }" />
              <span class="flex-1 text-xs text-gray-700 truncate min-w-0">{{ overlay.content || 'Empty text' }}</span>
              <button class="text-gray-300 hover:text-gray-500 transition-colors ml-1 shrink-0" @click="expandedOverlayId = expandedOverlayId === overlay.id ? null : overlay.id">
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path v-if="expandedOverlayId === overlay.id" fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
                  <path v-else fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button class="text-gray-300 hover:text-red-400 transition-colors shrink-0" @click="removeOverlay(overlay.id)">
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </button>
            </div>
            <!-- Expanded controls -->
            <div v-if="expandedOverlayId === overlay.id" class="px-3 py-3 space-y-3 border-t border-gray-100">
              <div class="space-y-1">
                <span class="text-xs text-gray-600">Content</span>
                <textarea
                  :value="overlay.content"
                  rows="2"
                  class="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  @input="setOverlay(overlay.id, { content: ($event.target as HTMLTextAreaElement).value })"
                />
              </div>
              <ColorRow label="Colour" :value="overlay.color" @change="setOverlay(overlay.id, { color: $event })" />
              <SliderRow label="Size" :value="overlay.font_size" :min="0.5" :max="8" :step="0.25"
                :display="v => v + 'u'" @change="setOverlay(overlay.id, { font_size: $event })" />
              <SliderRow label="Opacity" :value="overlay.opacity" :min="0.1" :max="1" :step="0.05"
                :display="v => Math.round(v * 100) + '%'" @change="setOverlay(overlay.id, { opacity: $event })" />
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-600">Bold</span>
                <button
                  class="px-2 py-1 rounded border text-xs font-medium transition-all"
                  :class="overlay.bold ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'"
                  @click="setOverlay(overlay.id, { bold: !overlay.bold })"
                >B</button>
              </div>
              <!-- Position grid (mobile-friendly) -->
              <div>
                <p class="text-xs text-gray-500 mb-2">Position <span class="text-gray-400">(or drag on desktop)</span></p>
                <div class="grid grid-cols-3 gap-1">
                  <button
                    v-for="pos in OVERLAY_POSITIONS"
                    :key="pos.label"
                    class="py-2 rounded border text-sm font-medium transition-all border-gray-200 text-gray-500 hover:border-green-400 active:bg-green-50"
                    @click="setOverlay(overlay.id, { x: pos.x, y: pos.y })"
                  >{{ pos.label }}</button>
                </div>
              </div>
            </div>
          </div>

          <button
            class="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-500 hover:border-green-400 hover:text-green-600 transition-all font-medium"
            @click="addOverlay"
          >+ Add text</button>
        </div>
      </Section>

      <!-- ── Trails ── -->
      <Section label="Trails" icon="i-heroicons-map-pin">
        <div class="space-y-2">
          <p class="text-[10px] text-gray-400 -mt-1 mb-2">Name segments of your route to build a map legend</p>

          <div
            v-for="seg in (local.trail_segments ?? [])"
            :key="seg.id"
            class="border border-gray-100 rounded-xl overflow-hidden"
          >
            <!-- Row header -->
            <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
              <div class="w-3 h-3 rounded-full shrink-0 border border-white ring-1 ring-gray-200" :style="{ backgroundColor: seg.color }" />
              <input
                :value="seg.name"
                class="flex-1 text-xs text-gray-700 bg-transparent border-none outline-none min-w-0 placeholder-gray-400"
                placeholder="Trail name…"
                @input="setSegment(seg.id, { name: ($event.target as HTMLInputElement).value })"
              />
              <!-- Visibility toggle -->
              <button
                class="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                :title="seg.visible ? 'Hide' : 'Show'"
                @click="setSegment(seg.id, { visible: !seg.visible })"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path v-if="seg.visible" d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path v-if="seg.visible" fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                  <path v-else fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
                </svg>
              </button>
              <!-- Expand toggle -->
              <button class="text-gray-300 hover:text-gray-500 transition-colors shrink-0" @click="expandedSegmentId = expandedSegmentId === seg.id ? null : seg.id">
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path v-if="expandedSegmentId === seg.id" fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
                  <path v-else fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
              <!-- Delete -->
              <button class="text-gray-300 hover:text-red-400 transition-colors shrink-0" @click="removeSegment(seg.id)">
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </button>
            </div>
            <!-- Expanded controls -->
            <div v-if="expandedSegmentId === seg.id" class="px-3 py-3 space-y-3 border-t border-gray-100">
              <!-- Color palette -->
              <div>
                <p class="text-xs text-gray-600 mb-2">Colour</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="c in SEGMENT_COLORS"
                    :key="c"
                    class="w-6 h-6 rounded-full border-2 transition-all"
                    :style="{ backgroundColor: c }"
                    :class="seg.color === c ? 'border-green-600 scale-110' : 'border-white ring-1 ring-gray-200'"
                    @click="setSegment(seg.id, { color: c })"
                  />
                  <!-- Custom color -->
                  <label class="relative w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-green-400 transition-colors overflow-hidden" title="Custom color">
                    <svg class="w-3 h-3 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
                    <input type="color" :value="seg.color" class="absolute inset-0 opacity-0 w-full h-full cursor-pointer" @input="setSegment(seg.id, { color: ($event.target as HTMLInputElement).value })" />
                  </label>
                </div>
              </div>
              <!-- Section range -->
              <div class="space-y-2">
                <p class="text-xs text-gray-600">Route section</p>
                <SliderRow
                  label="Start"
                  :value="seg.section_start"
                  :min="0"
                  :max="100"
                  :step="1"
                  :display="v => Math.round(v) + '%'"
                  @change="setSegment(seg.id, { section_start: Math.min($event, seg.section_end - 1) })"
                />
                <SliderRow
                  label="End"
                  :value="seg.section_end"
                  :min="0"
                  :max="100"
                  :step="1"
                  :display="v => Math.round(v) + '%'"
                  @change="setSegment(seg.id, { section_end: Math.max($event, seg.section_start + 1) })"
                />
              </div>
              <SliderRow label="Width" :value="seg.width ?? 3" :min="1" :max="8" :step="0.5"
                :display="v => v + 'px'" @change="setSegment(seg.id, { width: $event })" />
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-600">Dashed</span>
                <button
                  class="px-2 py-1 rounded border text-xs font-medium transition-all"
                  :class="seg.dash ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'"
                  @click="setSegment(seg.id, { dash: !seg.dash })"
                >- - -</button>
              </div>
            </div>
          </div>

          <button
            class="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-500 hover:border-green-400 hover:text-green-600 transition-all font-medium"
            @click="addSegment"
          >+ Add segment</button>

          <!-- Legend controls (show when there are segments) -->
          <template v-if="(local.trail_segments ?? []).length > 0">
            <div class="pt-2 border-t border-gray-100 space-y-2.5">
              <ToggleRow label="Show legend" :value="local.trail_legend?.show ?? true" @change="setLegend({ show: $event })" />
              <template v-if="local.trail_legend?.show !== false">
                <div>
                  <p class="text-xs text-gray-500 mb-2">Legend position</p>
                  <div class="grid grid-cols-2 gap-1.5">
                    <SegmentButton label="↙ Bottom left" :active="(local.trail_legend?.position ?? 'bottom-left') === 'bottom-left'" @click="setLegend({ position: 'bottom-left' })" />
                    <SegmentButton label="↘ Bottom right" :active="local.trail_legend?.position === 'bottom-right'" @click="setLegend({ position: 'bottom-right' })" />
                    <SegmentButton label="↖ Top left" :active="local.trail_legend?.position === 'top-left'" @click="setLegend({ position: 'top-left' })" />
                    <SegmentButton label="↗ Top right" :active="local.trail_legend?.position === 'top-right'" @click="setLegend({ position: 'top-right' })" />
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </Section>

      <!-- ── Frame ── -->
      <Section label="Frame & Padding" icon="i-heroicons-square-2-stack">
        <div class="space-y-3">
          <div>
            <p class="text-xs text-gray-500 mb-2">Border</p>
            <div class="grid grid-cols-3 gap-1.5">
              <SegmentButton v-for="b in BORDERS" :key="b.value"
                :label="b.label" :active="local.border_style === b.value"
                @click="set('border_style', b.value)" />
            </div>
          </div>
          <SliderRow label="Map padding" :value="local.padding_factor" :min="0.05" :max="0.35" :step="0.01"
            :display="v => Math.round(v * 100) + '%'" @change="set('padding_factor', $event)" />
        </div>
      </Section>

    </div>

    <!-- Reset footer -->
    <div class="px-5 py-3 border-t shrink-0">
      <button class="text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="$emit('reset')">
        Reset to defaults
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { StyleConfig, StyleLabels, FontFamily, BorderStyle, BaseTileStyle, ThemeDefinition, TextOverlay, TextOverlayAlignment, TrailSegment, StylePreset } from '~/types'
import { COLOR_THEMES, PRINT_SIZES } from '~/types'

const props = defineProps<{
  modelValue: StyleConfig
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StyleConfig]
  'reset': []
  'logo-upload': [file: File]
}>()

const local = reactive<StyleConfig>({ ...props.modelValue })

watch(() => props.modelValue, (v) => {
  if (JSON.stringify(v) !== JSON.stringify(local)) {
    Object.assign(local, v)
  }
}, { deep: true })

function set<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
  (local as StyleConfig)[key] = value
  emit('update:modelValue', { ...local })
}

function setLabel(key: keyof StyleLabels, value: boolean) {
  local.labels = { ...local.labels, [key]: value }
  emit('update:modelValue', { ...local })
}

// ── Text overlay helpers ───────────────────────────────────────────────────────

const OUTDOOR_COLORS = ['#2D6A4F', '#3A7CA5', '#C1121F', '#E87722', '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E', '#4A4A4A', '#F7F4EF']

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

// ── Trail segment helpers ──────────────────────────────────────────────────────

const SEGMENT_COLORS = ['#2D6A4F', '#3A7CA5', '#C1121F', '#E87722', '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E', '#555555', '#FFFFFF']

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

// Logo upload
const logoInputRef = ref<HTMLInputElement | null>(null)
const logoUploading = ref(false)

async function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  logoUploading.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)
    // We need the mapId but StylePanel doesn't have it — emit up instead
    emit('logo-upload', file)
  } finally {
    logoUploading.value = false
    if (logoInputRef.value) logoInputRef.value.value = ''
  }
}

function applyTheme(theme: ThemeDefinition) {
  Object.assign(local, {
    color_theme: theme.id,
    background_color: theme.background_color,
    label_bg_color: theme.label_bg_color,
    label_text_color: theme.label_text_color,
    route_color: theme.route_color,
    water_color: theme.water_color,
    land_color: theme.land_color,
    base_tile_style: theme.base_tile_style,
    contour_color: theme.contour_color,
    contour_major_color: theme.contour_major_color,
  })
  emit('update:modelValue', { ...local })
}

// Each title font auto-pairs with a body font for stats/meta text
const FONT_PAIRINGS: Record<FontFamily, FontFamily> = {
  'Big Shoulders Display': 'DM Sans',
  'Fjalla One': 'Work Sans',
  'Oswald': 'Work Sans',
  'Bebas Neue': 'DM Sans',
  'DM Sans': 'DM Sans',
  'Space Grotesk': 'Space Grotesk',
  'Outfit': 'Outfit',
  'Work Sans': 'Work Sans',
  'Playfair Display': 'Libre Baskerville',
  'Cormorant Garamond': 'Libre Baskerville',
  'Libre Baskerville': 'Libre Baskerville',
  'DM Serif Display': 'DM Sans',
}

function selectFont(fontName: FontFamily) {
  local.font_family = fontName
  local.body_font_family = FONT_PAIRINGS[fontName] ?? fontName
  emit('update:modelValue', { ...local })
}

const fontGroups: Array<{ label: string; fonts: FontFamily[] }> = [
  { label: 'EDITORIAL', fonts: ['Big Shoulders Display', 'Fjalla One', 'Oswald', 'Bebas Neue'] },
  { label: 'MODERN', fonts: ['DM Sans', 'Space Grotesk', 'Outfit', 'Work Sans'] },
  { label: 'REFINED', fonts: ['Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'DM Serif Display'] },
]

// Theme font preview data — mirrors the THEME_TYPOGRAPHY in MapPreview.vue
const THEME_FONT_PREVIEW: Record<string, string> = {
  chalk: "'Work Sans', sans-serif",
  topaz: "'Space Grotesk', sans-serif",
  dusk: "'DM Serif Display', serif",
  obsidian: "'Big Shoulders Display', sans-serif",
  forest: "'Oswald', sans-serif",
  midnight: "'Fjalla One', sans-serif",
}
const THEME_FONT_WEIGHT: Record<string, string> = {
  chalk: '300', topaz: '700', dusk: '400', obsidian: '800', forest: '600', midnight: '400',
}
const THEME_FONT_TRACKING: Record<string, string> = {
  chalk: '0.3em', topaz: '0.06em', dusk: '0.02em', obsidian: '-0.01em', forest: '0.08em', midnight: '0.12em',
}
const THEME_FONT_NAME: Record<string, string> = {
  chalk: 'Work Sans Light',
  topaz: 'Space Grotesk Bold',
  dusk: 'DM Serif Display',
  obsidian: 'Big Shoulders Display',
  forest: 'Oswald SemiBold',
  midnight: 'Fjalla One',
}

const activeThemeTypography = computed(() =>
  THEME_FONT_NAME[local.color_theme ?? 'chalk'] ?? 'Work Sans',
)

const BORDERS: Array<{ label: string; value: BorderStyle }> = [
  { label: 'None', value: 'none' },
  { label: 'Thin', value: 'thin' },
  { label: 'Thick', value: 'thick' },
]

const TILE_STYLES: Array<{ label: string; value: BaseTileStyle }> = [
  { label: 'Light', value: 'carto-light' },
  { label: 'Dark', value: 'carto-dark' },
  { label: 'Outdoor', value: 'maptiler-outdoor' },
  { label: 'Topo', value: 'maptiler-topo' },
  { label: 'Winter', value: 'maptiler-winter' },
]

const TOPO_TILE_STYLES: Array<{ label: string; value: BaseTileStyle }> = [
  { label: 'Outdoor', value: 'maptiler-outdoor' },
  { label: 'Topo', value: 'maptiler-topo' },
  { label: 'Winter', value: 'maptiler-winter' },
]

// Blend two hex colors at 50% for the midtone preview swatch
function blendForPreview(a: string | undefined, b: string | undefined): string {
  const ca = a ?? '#1C1917', cb = b ?? '#F7F4EF'
  const ar = parseInt(ca.slice(1, 3), 16), ag = parseInt(ca.slice(3, 5), 16), ab = parseInt(ca.slice(5, 7), 16)
  const br = parseInt(cb.slice(1, 3), 16), bg = parseInt(cb.slice(3, 5), 16), bb = parseInt(cb.slice(5, 7), 16)
  const r = Math.round((ar + br) / 2).toString(16).padStart(2, '0')
  const g = Math.round((ag + bg) / 2).toString(16).padStart(2, '0')
  const bh = Math.round((ab + bb) / 2).toString(16).padStart(2, '0')
  return `#${r}${g}${bh}`
}

// ── Map preset definitions ─────────────────────────────────────────────────────
// Each entry has an SVG thumbnail (raw HTML string) rendered inside a viewBox.

const MAP_PRESETS: Array<{ id: StylePreset; label: string; title: string; viewBox: string; svg: string }> = [
  {
    id: 'minimalist',
    label: 'Minimalist',
    title: 'Clean raster tiles — CARTO light or dark',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#f0ece4"/>
      <path d="M4 24 Q12 20 24 22 Q36 24 44 18" stroke="#c8b8a2" stroke-width="1" fill="none"/>
      <path d="M8 16 Q18 10 28 14 Q38 18 44 12" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'topographic',
    label: 'Topographic',
    title: 'Mapbox Outdoors — terrain + trails (requires Mapbox token)',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#e8dfd0"/>
      <ellipse cx="24" cy="18" rx="18" ry="10" stroke="#b8a888" stroke-width="0.8" fill="none"/>
      <ellipse cx="24" cy="18" rx="12" ry="7" stroke="#a09070" stroke-width="0.8" fill="none"/>
      <ellipse cx="24" cy="18" rx="6" ry="4" stroke="#887850" stroke-width="0.8" fill="none"/>
      <path d="M8 10 Q18 4 28 8 Q38 12 44 6" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'natural-topo',
    label: 'Natural',
    title: 'MapTiler full-colour terrain — greens, blues, earth tones (requires MapTiler token)',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#c8dba8"/>
      <rect x="0" y="18" width="48" height="14" fill="#a8c878"/>
      <rect x="22" y="10" width="26" height="22" fill="#d4e8b0" rx="2"/>
      <path d="M0 16 Q8 12 16 14 Q24 16 32 10 Q38 6 48 8" stroke="#5a8a30" stroke-width="0.8" fill="none" opacity="0.5"/>
      <path d="M14 8 Q20 4 28 6 Q36 8 42 4" stroke="#3a6e20" stroke-width="0.8" fill="none" opacity="0.4"/>
      <path d="M6 20 Q16 16 26 18 Q36 20 44 16" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'route-only',
    label: 'Route Only',
    title: 'Solid background, route line only — no base tiles',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#f7f4ef"/>
      <path d="M8 28 Q12 22 18 20 Q24 18 28 14 Q32 10 36 6 Q40 4 44 6" stroke="#e63946" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="8" cy="28" r="2" fill="#2d6a4f"/>
      <circle cx="44" cy="6" r="2" fill="#b91c1c"/>`,
  },
  {
    id: 'road-network',
    label: 'Road Net',
    title: 'Vector roads as ink lines on a clean background — city map look (requires Mapbox token)',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#f5f5f5"/>
      <path d="M0 8 Q12 10 24 8 Q36 6 48 10" stroke="#1c1917" stroke-width="1.4" fill="none" opacity="0.7"/>
      <path d="M0 18 Q10 16 20 18 Q32 20 48 16" stroke="#1c1917" stroke-width="1.0" fill="none" opacity="0.5"/>
      <path d="M0 26 Q8 24 16 26 Q28 28 40 24 Q44 23 48 24" stroke="#1c1917" stroke-width="0.6" fill="none" opacity="0.35"/>
      <path d="M12 0 Q10 10 12 20 Q14 28 12 32" stroke="#1c1917" stroke-width="1.2" fill="none" opacity="0.6"/>
      <path d="M28 0 Q26 8 28 16 Q30 26 28 32" stroke="#1c1917" stroke-width="0.8" fill="none" opacity="0.4"/>
      <path d="M40 0 Q38 6 40 14 Q42 22 40 32" stroke="#1c1917" stroke-width="0.5" fill="none" opacity="0.3"/>
      <path d="M6 12 Q16 8 26 12 Q36 16 44 12" stroke="#e63946" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'contour-art',
    label: 'Contour Art',
    title: 'Topographic contours as standalone art — no raster tiles',
    viewBox: '0 0 48 32',
    svg: `<rect width="48" height="32" fill="#fafafa"/>
      <ellipse cx="24" cy="18" rx="20" ry="12" stroke="#9e9082" stroke-width="0.6" fill="none"/>
      <ellipse cx="24" cy="18" rx="16" ry="9" stroke="#9e9082" stroke-width="0.6" fill="none"/>
      <ellipse cx="24" cy="18" rx="12" ry="6.5" stroke="#7a6e62" stroke-width="0.7" fill="none"/>
      <ellipse cx="24" cy="18" rx="8" ry="4" stroke="#7a6e62" stroke-width="0.9" fill="none"/>
      <ellipse cx="24" cy="18" rx="4" ry="2" stroke="#5a504a" stroke-width="1.1" fill="none"/>
      <path d="M6 6 Q14 2 24 6 Q34 10 42 6" stroke="#e63946" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  },
]
</script>

<!-- ─── Sub-components ─────────────────────────────────────────────────────── -->

<script lang="ts">
export const Section = defineComponent({
  props: { label: String, icon: String },
  setup(props, { slots }) {
    const open = ref(true)
    return () => h('div', { class: 'px-5 py-3' }, [
      h('button', {
        class: 'flex items-center justify-between w-full mb-3 group',
        onClick: () => { open.value = !open.value },
      }, [
        h('div', { class: 'flex items-center gap-1.5' }, [
          h(resolveComponent('UIcon'), { name: props.icon, class: 'w-3.5 h-3.5 text-gray-400' }),
          h('span', { class: 'text-xs font-semibold text-gray-500 uppercase tracking-wider' }, props.label),
        ]),
        h(resolveComponent('UIcon'), {
          name: open.value ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down',
          class: 'w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-colors',
        }),
      ]),
      open.value && slots.default ? h('div', slots.default()) : null,
    ])
  },
})

export const ToggleRow = defineComponent({
  props: { label: String, value: Boolean },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('label', { class: 'flex items-center justify-between cursor-pointer' }, [
      h('span', { class: 'text-xs text-gray-600' }, props.label),
      h('button', {
        class: ['relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none',
          props.value ? 'bg-green-600' : 'bg-gray-200'],
        onClick: () => emit('change', !props.value),
      }, [
        h('span', {
          class: ['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            props.value ? 'translate-x-4' : 'translate-x-0'],
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
    return () => h('div', { class: 'space-y-1' }, [
      h('div', { class: 'flex items-center justify-between' }, [
        h('span', { class: 'text-xs text-gray-600' }, props.label),
        h('span', { class: 'text-xs text-gray-400 tabular-nums' }, props.display?.(props.value ?? 0) ?? props.value),
      ]),
      h('input', {
        type: 'range', min: props.min, max: props.max, step: props.step, value: props.value,
        class: 'w-full h-1 rounded-full appearance-none bg-gray-200 accent-green-600 cursor-pointer',
        onInput: (e: Event) => emit('change', parseFloat((e.target as HTMLInputElement).value)),
      }),
    ])
  },
})

export const ColorRow = defineComponent({
  props: { label: String, value: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'text-xs text-gray-600' }, props.label),
      h('label', { class: 'flex items-center gap-2 cursor-pointer' }, [
        h('span', { class: 'text-xs text-gray-400 font-mono' }, props.value?.toUpperCase()),
        h('input', {
          type: 'color', value: props.value,
          class: 'w-7 h-7 rounded cursor-pointer border border-gray-200 p-0.5 bg-white',
          onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
        }),
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
        class: 'w-6 h-6 rounded border-2 border-white ring-1 ring-gray-200 shadow-sm',
        style: { backgroundColor: props.value },
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
    return () => h('div', { class: 'space-y-1' }, [
      h('span', { class: 'text-xs text-gray-600' }, props.label),
      h('input', {
        type: 'text', value: props.value, placeholder: props.placeholder,
        class: 'w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500',
        onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
      }),
    ])
  },
})

export const PresetButton = defineComponent({
  props: { label: String, active: Boolean },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      class: ['flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 text-xs font-medium transition-all',
        props.active ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'],
      onClick: () => emit('click'),
    }, slots.default?.())
  },
})

export const FontButton = defineComponent({
  props: { label: String, font: String, active: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      class: ['py-2 px-2 rounded border transition-all text-center flex flex-col items-center gap-0.5 w-full',
        props.active ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'],
      onClick: () => emit('click'),
    }, [
      h('span', {
        class: [props.active ? 'text-green-700' : 'text-gray-800'],
        style: { fontFamily: props.font, fontSize: '13px', lineHeight: '1.2', letterSpacing: '0.04em' },
      }, 'SUMMIT'),
      h('span', {
        class: ['leading-none tracking-wide', props.active ? 'text-green-600' : 'text-gray-400'],
        style: { fontSize: '8px' },
      }, props.label),
    ])
  },
})

export const SegmentButton = defineComponent({
  props: { label: String, active: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      class: ['py-1.5 rounded border text-xs font-medium transition-all',
        props.active ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'],
      onClick: () => emit('click'),
    }, props.label)
  },
})
</script>
