<template>
  <!-- Outer: fills parent, centers the poster canvas -->
  <div
    :class="previewRootClass"
    :style="previewRootStyle"
  >
    <InlineTextToolbar
      v-if="editable && activeToolbarState"
      :label="activeToolbarState.label"
      :anchor-rect="activeTextAnchor"
      :font-family="activeToolbarState.fontFamily"
      :color="activeToolbarState.color"
      :background-color="activeToolbarState.backgroundColor"
      :supports-highlight="activeToolbarState.supportsHighlight"
      :scale="activeToolbarState.scale"
      :bold="activeToolbarState.bold"
      :italic="activeToolbarState.italic"
      :can-reset="activeToolbarState.canReset"
      :text-value="activeToolbarState.textValue"
      @patch="applyToolbarPatch"
      @reset="resetActiveText"
      @done="finishActiveTextEdit"
    />

    <!-- Poster canvas — maintains print aspect ratio -->
    <div
      ref="posterCanvasEl"
      class="poster-canvas relative flex flex-col"
      :class="posterCanvasClass"
      :style="posterCanvasStyle"
      :data-composition="composition.id"
      :data-theme="styleConfig.color_theme"
      data-testid="poster-canvas"
    >

      <!-- ── Inset frame (optional) ───────────────────────────────────────── -->
      <div
        v-if="showPosterInsetFrame"
        class="poster-inset-frame absolute z-20 pointer-events-none"
        :style="frameStyle"
        data-testid="poster-inset-frame"
      />

      <div
        v-if="composition.showPaperTexture"
        class="composition-paper-texture"
        data-testid="composition-paper-texture"
      />
      <div
        v-if="showPosterGrid"
        class="composition-grid-overlay"
        :style="gridOverlayStyle"
        data-testid="composition-grid-overlay"
      />
      <div
        v-if="composition.showStarField"
        class="composition-star-field"
        data-testid="composition-star-field"
      />
      <div
        v-if="composition.showSideRail && !sideRailInsideMap"
        class="composition-side-rail"
        data-testid="composition-side-rail"
      />
      <div
        v-if="compositionDecor.sideRailLabel && !sideRailInsideMap"
        class="composition-side-rail-label"
        :class="{ 'editable-text': editable, 'is-selected-text': isSlotActive('composition_side_rail') }"
        :style="compositionSideRailLabelStyle"
        :contenteditable="editable ? 'true' : 'false'"
        :suppressContentEditableWarning="true"
        role="textbox"
        aria-label="Side rail label"
        enterkeyhint="done"
        spellcheck="true"
        data-testid="composition-side-rail-label"
        @focus="onSlotFocus($event, 'composition_side_rail')"
        @blur="onSlotBlur($event, 'composition_side_rail')"
        @click="onSlotClick($event, 'composition_side_rail')"
        @keydown.enter.exact.prevent="finishActiveTextEdit"
      >{{ compositionDecor.sideRailLabel }}</div>

      <!-- ── Top-right controls: undo/redo + zoom lock ────────────────────── -->
      <div
        v-if="editable && mapReady"
        class="poster-controls"
        :class="{ 'map-hovered': mapHovered }"
      >
        <!-- Undo / redo pill -->
        <div class="control-pill">
          <button
            class="control-btn"
            :disabled="!canUndo"
            title="Undo (⌘Z)"
            @click="emit('undo')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clip-rule="evenodd"/>
            </svg>
          </button>
          <span class="control-divider"/>
          <button
            class="control-btn"
            :disabled="!canRedo"
            title="Redo (⌘⇧Z)"
            @click="emit('redo')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75H9.25a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.061.025z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>

        <FreezeControl
          :frozen="styleConfig.map_frozen ?? false"
          :map-hovered="mapHovered"
          @freeze="freezeView"
          @unfreeze="unfreezeView"
        />
      </div>

      <!-- ── Logo: header-right position ──────────────────────────────────── -->
      <img
        v-if="showLegacyLogo && styleConfig.logo_position === 'header-right'"
        :src="styleConfig.logo_url"
        alt=""
        class="logo-header-right"
        :style="logoHeaderStyle"
      />

      <!-- ── HEADER BAND ─────────────────────────────────────────────────── -->
      <div class="poster-header shrink-0" :style="headerBandStyle" data-testid="poster-header">
        <div
          v-if="compositionDecor.kicker"
          class="composition-kicker"
          :class="{ 'editable-text': editable, 'is-selected-text': isSlotActive('composition_kicker') }"
          :style="compositionKickerStyle"
          :contenteditable="editable ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Composition kicker"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-kicker"
          @focus="onSlotFocus($event, 'composition_kicker')"
          @blur="onSlotBlur($event, 'composition_kicker')"
          @click="onSlotClick($event, 'composition_kicker')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.kicker }}</div>

        <!-- Thin rule at top — only for bottom-positioned header -->
        <div v-if="layout.titlePosition === 'bottom'" class="poster-rule" :style="ruleStyle" />

        <!-- Trail name — static or editable -->
        <h1
          v-if="!editable && styleConfig.labels?.show_title !== false"
          class="poster-trail-name"
          :style="trailNameStyle"
        >{{ trailName }}</h1>
        <h1
          v-else-if="editable"
          class="poster-trail-name editable-text"
          :class="{ 'is-selected-text': isSlotActive('trail_name') }"
          :style="trailNameStyle"
          contenteditable="true"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Trail name"
          enterkeyhint="done"
          spellcheck="true"
          @focus="onSlotFocus($event, 'trail_name')"
          @blur="onSlotBlur($event, 'trail_name')"
          @click="onSlotClick($event, 'trail_name')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ trailName }}</h1>

        <!-- Location / elevation line -->
        <p
          v-if="locationLine && !editable"
          class="poster-location-line"
          :style="locationLineStyle"
        >{{ locationLine }}</p>
        <p
          v-else-if="locationLine && editable"
          class="poster-location-line editable-text"
          :class="{ 'is-selected-text': isSlotActive('location_text') }"
          :style="locationLineStyle"
          contenteditable="true"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Location"
          enterkeyhint="done"
          spellcheck="true"
          @focus="onSlotFocus($event, 'location_text')"
          @blur="onSlotBlur($event, 'location_text')"
          @click="onSlotClick($event, 'location_text')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ locationLine }}</p>

        <div
          v-if="compositionDecor.meta"
          class="composition-meta-line"
          :class="{ 'editable-text': editable, 'is-selected-text': isSlotActive('composition_meta') }"
          :style="compositionMetaStyle"
          :contenteditable="editable ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Composition metadata"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-meta-line"
          @focus="onSlotFocus($event, 'composition_meta')"
          @blur="onSlotBlur($event, 'composition_meta')"
          @click="onSlotClick($event, 'composition_meta')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.meta }}</div>

        <!-- Thin rule at bottom — only for top-positioned header -->
        <div v-if="layout.titlePosition === 'top'" class="poster-rule" :style="ruleStyle" />
      </div>

      <!-- ── MAP (hero — takes all remaining height) ─────────────────────── -->
      <div ref="mapContainer" class="relative flex-1 overflow-hidden" :style="mapAreaStyle" data-testid="poster-map"
        @mouseenter="mapHovered = true" @mouseleave="mapHovered = false"
      >
        <div
          v-if="sideRailInsideMap"
          class="composition-side-rail composition-side-rail--left"
          data-testid="composition-side-rail"
        />
        <div
          v-if="sideRailInsideMap"
          class="composition-side-rail composition-side-rail--right"
          data-testid="composition-side-rail-right"
        />
        <div
          v-if="compositionDecor.sideRailLabel && sideRailInsideMap"
          class="composition-side-rail-label composition-side-rail-label--left"
          :class="{ 'editable-text': editable, 'is-selected-text': isSlotActive('composition_side_rail') }"
          :style="compositionSideRailLabelStyle"
          :contenteditable="editable ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Side rail label"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-side-rail-label"
          @focus="onSlotFocus($event, 'composition_side_rail')"
          @blur="onSlotBlur($event, 'composition_side_rail')"
          @click="onSlotClick($event, 'composition_side_rail')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.sideRailLabel }}</div>
        <div
          v-if="showMapGrid"
          class="composition-grid-overlay composition-grid-overlay--map"
          :style="gridOverlayStyle"
          data-testid="composition-map-grid-overlay"
        />

        <!-- Plot mode overlay — instruction banner + cancel -->
        <div
          v-if="plotMode"
          class="absolute top-0 inset-x-0 z-20 flex items-center justify-between pointer-events-none"
          style="padding: 0.8cqh 1.4cqw; background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%);"
        >
          <span style="color: white; font-size: 0.85cqh; font-weight: 600; letter-spacing: 0.06em; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
            {{ plotMode.segId === 'route-delete-pending'
              ? (plotMode.field === 'start' ? 'Tap route: mark delete start…' : 'Tap route: mark delete end…')
              : `Tap route to set ${plotMode.field === 'start' ? 'start' : 'end'}` }}
          </span>
          <button
            class="pointer-events-auto"
            style="background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.4); color: white; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 600; cursor: pointer; backdrop-filter: blur(4px);"
            @click="emit('plot-cancelled')"
          >Cancel</button>
        </div>

        <!-- Brush delete overlay — preview stays local until Apply -->
        <div
          v-if="deleteBrushActive"
          class="absolute top-0 inset-x-0 z-20 flex items-center justify-between pointer-events-none"
          style="padding: 0.8cqh 1.4cqw; background: linear-gradient(to bottom, rgba(127,29,29,0.62) 0%, transparent 100%);"
        >
          <span style="color: white; font-size: 0.85cqh; font-weight: 700; letter-spacing: 0.06em; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
            Brush erase route sections
          </span>
          <div class="pointer-events-auto flex items-center gap-1.5">
            <button
              style="background: rgba(255,255,255,0.92); border: 1.5px solid rgba(255,255,255,0.65); color: #7F1D1D; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 800; cursor: pointer; backdrop-filter: blur(4px);"
              :disabled="brushPreviewRanges.length === 0"
              @click="applyDeleteBrush"
            >Apply</button>
            <button
              style="background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.4); color: white; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px);"
              @click="cancelDeleteBrush"
            >Cancel</button>
          </div>
        </div>

        <div
          v-if="deleteBrushActive && brushCursor"
          class="absolute rounded-full pointer-events-none"
          :style="brushCursorStyle"
        />
        <!-- Loading placeholder -->
        <div
          v-if="!mapReady"
          class="absolute inset-0 flex items-center justify-center z-10"
          :style="{ backgroundColor: styleConfig.background_color }"
        >
          <svg class="w-12 h-12 opacity-10" viewBox="0 0 48 48" fill="none" :stroke="styleConfig.label_text_color">
            <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
            <path d="M10 28 Q18 25 24 27 Q30 29 38 26" stroke-width="0.7" opacity="0.4"/>
          </svg>
        </div>

        <!-- ── Logo: map-top-right position ─────────────────────────────── -->
        <img
          v-if="showLegacyLogo && (styleConfig.logo_position === 'map-top-right' || !styleConfig.logo_position)"
          :src="styleConfig.logo_url"
          alt=""
          class="logo-map"
          :style="logoMapStyle"
        />

        <!-- ── Trail Legend ───────────────────────────────────────────────── -->
        <div
          v-if="showTrailLegend"
          class="trail-legend"
          :style="trailLegendStyle"
        >
          <div
            v-for="seg in visibleNamedSegments"
            :key="seg.id"
            class="legend-item"
          >
            <div class="legend-swatch" :style="{ backgroundColor: seg.color }" />
            <span class="legend-label" :style="legendLabelStyle">{{ seg.name }}</span>
          </div>
        </div>

        <!-- ── Elevation profile ─────────────────────────────────────────── -->
        <ElevationProfile
          v-if="styleConfig.show_elevation_profile && mapReady"
          :map="map"
          :style-config="styleConfig"
        />

        <!-- ── Leader lines + pin label SVG overlay ──────────────────────── -->
        <svg
          v-if="mapReady && (showLeaderLines || showPinOverlay)"
          class="absolute inset-0 w-full h-full"
          style="z-index: 14; overflow: visible; pointer-events: none;"
        >
          <!-- Pin labels with leader lines (labels are draggable) -->
          <g v-if="showPinOverlay">
            <template v-for="pin in pinOverlayItems" :key="pin.id">
              <line
                :x1="pin.dotX" :y1="pin.dotY"
                :x2="pin.labelX" :y2="pin.labelY"
                :stroke="pin.color" :stroke-width="svgLineW"
                :stroke-opacity="pin.opacity * 0.55"
                style="pointer-events: none;"
              />
              <text
                :x="pin.labelX" :y="pin.labelY"
                :text-anchor="pin.anchor"
                :font-size="pinLabelFontSize(pin.id)"
                :font-family="pinLabelFontFamily(pin.id)"
                :fill="pinLabelColor(pin.id)"
                :opacity="pin.opacity"
                :stroke="styleConfig.background_color ?? '#FFFFFF'"
                stroke-width="3"
                paint-order="stroke fill"
                :font-weight="pinLabelWeight(pin.id)"
                :font-style="pinLabelItalic(pin.id)"
                letter-spacing="0.12em"
                dominant-baseline="middle"
                :style="editable ? 'pointer-events: all; cursor: grab; user-select: none;' : 'pointer-events: none;'"
                :class="{ 'is-selected-svg-text': activeTextTarget?.type === 'slot' && activeTextTarget.slot === pinSlot(pin.id) }"
                @click.stop="onPinLabelClick($event, pin.id)"
                @pointerdown.stop="editable && startLabelDrag($event, pin.id as 'start' | 'finish')"
                @pointermove="draggingPin === pin.id && onLabelDragMove($event)"
                @pointerup="draggingPin === pin.id && onLabelDragEnd($event)"
                @pointercancel="draggingPin = null"
              >{{ pin.label.toUpperCase() }}</text>
            </template>
          </g>

          <!-- Trail segment leader lines -->
          <g v-if="showLeaderLines">
            <template v-for="item in leaderLineItems" :key="item.id">
              <circle :cx="item.dotX" :cy="item.dotY" :r="svgDotR" :fill="item.color"
                vector-effect="non-scaling-stroke" style="pointer-events: none;" />
              <line
                :x1="item.dotX" :y1="item.dotY"
                :x2="item.labelX" :y2="item.labelY"
                :stroke="item.color" :stroke-width="svgLineW" stroke-opacity="0.6"
                style="pointer-events: none;"
              />
              <text
                :x="item.labelX" :y="item.labelY"
                :text-anchor="item.anchor"
                :font-size="item.fontSize"
                :font-family="leaderLabelFontFamily"
                :fill="item.color"
                :stroke="styleConfig.background_color ?? '#FFFFFF'"
                :stroke-width="selectedLeaderIds.includes(item.id) ? 5 : 3"
                paint-order="stroke fill"
                font-weight="700"
                letter-spacing="0.1em"
                dominant-baseline="middle"
                :style="editable ? 'pointer-events: all; cursor: grab; user-select: none;' : 'pointer-events: none;'"
                @pointerdown.stop="editable && startLeaderDrag($event, item.id)"
                @pointermove="isLeaderDragActive(item.id) && onLeaderDragMove($event)"
                @pointerup="isLeaderDragActive(item.id) && onLeaderDragEnd($event)"
                @pointercancel="cancelLeaderDrag"
              >{{ item.name }}</text>
            </template>
          </g>
        </svg>

        <!-- ── Vignette overlay ──────────────────────────────────────────── -->
        <div
          v-if="styleConfig.show_vignette"
          class="absolute inset-0 pointer-events-none"
          style="z-index: 11;"
          :style="vignetteStyle"
        />

        <!-- ── Film grain overlay ────────────────────────────────────────── -->
        <svg
          v-if="grainOpacity > 0"
          class="absolute inset-0 w-full h-full pointer-events-none"
          style="z-index: 11; mix-blend-mode: overlay;"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" result="noiseOut"/>
            <feColorMatrix type="saturate" values="0" in="noiseOut"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-noise)" :opacity="grainOpacity"/>
        </svg>
      </div>

      <!-- ── FOOTER BAND ─────────────────────────────────────────────────── -->
      <div class="poster-footer shrink-0" :style="footerBandStyle" data-testid="poster-footer">
        <div class="poster-footer-rule" :style="footerRuleStyle" data-testid="poster-footer-rule" />
        <div
          v-if="compositionDecor.footerNote"
          class="composition-footer-note"
          :class="{ 'editable-text': editable, 'is-selected-text': isSlotActive('composition_footer') }"
          :style="compositionFooterNoteStyle"
          :contenteditable="editable ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Composition footer note"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-footer-note"
          @focus="onSlotFocus($event, 'composition_footer')"
          @blur="onSlotBlur($event, 'composition_footer')"
          @click="onSlotClick($event, 'composition_footer')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.footerNote }}</div>

        <!-- Logo: footer-left position -->
        <img
          v-if="showLegacyLogo && styleConfig.logo_position === 'footer-left'"
          :src="styleConfig.logo_url"
          alt=""
          :style="logoFooterStyle"
        />

        <!-- Stat blocks (left) -->
        <div class="poster-stats" :style="posterStatsStyle">
          <div
            v-if="showDistanceSlot"
            class="stat-block editable-text"
            :class="{ 'is-selected-text': isSlotActive('distance') }"
            :contenteditable="editable ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Distance"
            enterkeyhint="done"
            spellcheck="true"
            @focus="onSlotFocus($event, 'distance')"
            @blur="onSlotBlur($event, 'distance')"
            @click="onSlotClick($event, 'distance')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span v-if="hasTextOverride('distance')" class="stat-custom-text" :style="statCustomTextStyle('distance')">{{ distanceText }}</span>
            <template v-else>
              <span class="stat-number" :style="statNumberStyleFor('distance')">{{ formattedDistance }}</span>
              <span class="stat-unit" :style="statUnitStyleFor('distance')">miles</span>
            </template>
          </div>

          <div
            v-if="showDistanceSlot && showElevationGainSlot"
            class="stat-divider"
            :style="dividerStyle"
          />

          <div
            v-if="showElevationGainSlot"
            class="stat-block editable-text"
            :class="{ 'is-selected-text': isSlotActive('elevation_gain') }"
            :contenteditable="editable ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Elevation gain"
            enterkeyhint="done"
            spellcheck="true"
            @focus="onSlotFocus($event, 'elevation_gain')"
            @blur="onSlotBlur($event, 'elevation_gain')"
            @click="onSlotClick($event, 'elevation_gain')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span v-if="hasTextOverride('elevation_gain')" class="stat-custom-text" :style="statCustomTextStyle('elevation_gain')">{{ elevationGainText }}</span>
            <template v-else>
              <span class="stat-number" :style="statNumberStyleFor('elevation_gain')">{{ formattedGain }}</span>
              <span class="stat-unit" :style="statUnitStyleFor('elevation_gain')">ft gain</span>
            </template>
          </div>

          <div v-if="showDateSlot && (showDistanceSlot || showElevationGainSlot)" class="stat-divider" :style="dividerStyle" />

          <div
            v-if="showDateSlot"
            class="stat-block editable-text"
            :class="{ 'is-selected-text': isSlotActive('date') }"
            :contenteditable="editable ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Date"
            enterkeyhint="done"
            spellcheck="true"
            @focus="onSlotFocus($event, 'date')"
            @blur="onSlotBlur($event, 'date')"
            @click="onSlotClick($event, 'date')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span class="stat-custom-text" :style="statCustomTextStyle('date')">{{ dateText }}</span>
          </div>

          <div v-if="showCoordinatesSlot && (showDistanceSlot || showElevationGainSlot || showDateSlot)" class="stat-divider" :style="dividerStyle" />

          <div
            v-if="showCoordinatesSlot"
            class="stat-block stat-block--coords editable-text"
            :class="{ 'is-selected-text': isSlotActive('coordinates') }"
            :contenteditable="editable ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Coordinates"
            enterkeyhint="done"
            spellcheck="true"
            @focus="onSlotFocus($event, 'coordinates')"
            @blur="onSlotBlur($event, 'coordinates')"
            @click="onSlotClick($event, 'coordinates')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span v-if="hasTextOverride('coordinates')" class="stat-custom-text" :style="coordStyleFor('coordinates')">{{ coordinatesText }}</span>
            <template v-else-if="coords">
              <span :style="coordStyleFor('coordinates')">{{ coords.lat }}</span>
              <span :style="coordStyleFor('coordinates')">{{ coords.lng }}</span>
            </template>
          </div>
        </div>

        <!-- Occasion / subtitle (centre, optional) -->
        <p
          v-if="occasionText && !editable"
          class="poster-occasion"
          :style="occasionStyle"
        >{{ occasionText }}</p>
        <p
          v-else-if="editable"
          class="poster-occasion editable-text"
          :class="{ 'is-selected-text': isSlotActive('occasion_text') }"
          :style="{ ...occasionStyle, minWidth: '4cqw', minHeight: '1.2cqh' }"
          contenteditable="true"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Occasion"
          enterkeyhint="done"
          spellcheck="true"
          @focus="onSlotFocus($event, 'occasion_text')"
          @blur="onSlotBlur($event, 'occasion_text')"
          @click="onSlotClick($event, 'occasion_text')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ occasionText }}</p>

        <!-- Rad Maps mark (right) -->
        <div v-if="styleConfig.show_branding !== false" class="poster-mark">
          <svg viewBox="0 0 32 32" fill="none" class="mark-svg" :style="{ color: styleConfig.label_text_color, opacity: '0.4' }">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.9" fill="none"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.65" fill="none" opacity="0.6"/>
            <circle cx="11" cy="8" r="1.1" fill="currentColor"/>
          </svg>
          <span class="mark-label" :style="markLabelStyle">RAD MAPS</span>
          <span class="branding-note" :style="brandingNoteStyle">radmaps.studio</span>
        </div>

      </div>

      <!-- ── Image overlays (poster-level — can span header, map, footer) ─── -->
      <div
        v-if="(styleConfig.image_overlays ?? []).length > 0"
        class="asset-layer"
        style="pointer-events: none;"
        @click.self="selectedAssetId = null"
      >
        <div
          v-for="asset in visibleImageAssets"
          :key="asset.id"
          :data-asset-id="asset.id"
          class="image-asset"
          :class="{ 'is-editable': editable, 'is-selected': editable && selectedAssetId === asset.id }"
          :style="imageAssetStyle(asset)"
          @click.stop="editable ? onAssetClick(asset.id) : undefined"
        >
          <img :src="asset.render_url" alt="" draggable="false" />
          <span
            v-if="editable && selectedAssetId === asset.id"
            class="asset-quality-badge"
            :class="`asset-quality-${asset.quality_status}`"
          >{{ assetQualityLabel(asset) }}</span>
          <template v-if="editable">
            <div
              class="overlay-move-handle"
              title="Drag to move"
              @pointerdown.stop
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                <path d="M10 2l2.5 2.5h-2V8h3.5V6l2.5 2.5L14 11v-2h-3.5v3.5h2L10 15l-2.5-2.5h2V9H6v2L3.5 8.5 6 6v2h3.5V4.5h-2L10 2z"/>
              </svg>
            </div>
            <button
              class="overlay-delete-btn"
              title="Remove"
              @click.stop="onAssetDelete(asset.id)"
              @pointerdown.stop
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
            <div
              class="overlay-resize-handle"
              title="Drag to resize"
              @pointerdown.stop.prevent="onAssetResizeStart($event, asset.id)"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="9" height="9">
                <path d="M13.5 6.5L17 10l-3.5 3.5V6.5zM6.5 13.5L3 10l3.5-3.5v7z" opacity="0.8"/>
              </svg>
            </div>
          </template>
        </div>
      </div>

      <!-- ── Text overlays (poster-level — can span header, map, footer) ──── -->
      <div
        v-if="(styleConfig.text_overlays ?? []).length > 0"
        class="overlay-layer"
        style="pointer-events: none;"
        @click.self="selectedOverlayId = null"
      >
        <div
          v-for="overlay in styleConfig.text_overlays"
          :key="overlay.id"
          :data-overlay-id="overlay.id"
          class="text-overlay"
          :class="{ 'is-editable': editable, 'is-selected': editable && selectedOverlayId === overlay.id }"
          :style="overlayStyle(overlay)"
          @click.stop="editable ? onOverlayClick(overlay.id) : undefined"
        >
          <span
            class="overlay-content editable-text"
            contenteditable="true"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Text overlay"
            enterkeyhint="done"
            spellcheck="true"
            @focus="onOverlayTextFocus($event, overlay.id)"
            @blur="onOverlayTextBlur($event, overlay.id)"
            @pointerdown.stop="onOverlayTextPointerDown($event, overlay.id)"
            @click.stop="onOverlayTextClick($event, overlay.id)"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >{{ overlay.content }}</span>
          <template v-if="editable">
            <div
              class="overlay-move-handle"
              title="Drag to move"
              @pointerdown.stop
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                <path d="M10 2l2.5 2.5h-2V8h3.5V6l2.5 2.5L14 11v-2h-3.5v3.5h2L10 15l-2.5-2.5h2V9H6v2L3.5 8.5 6 6v2h3.5V4.5h-2L10 2z"/>
              </svg>
            </div>
            <button
              class="overlay-delete-btn"
              title="Remove"
              @click.stop="onOverlayDelete(overlay.id)"
              @pointerdown.stop
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
            <div
              class="overlay-resize-handle"
              title="Drag to resize"
              @pointerdown.stop.prevent="onResizeStart($event, overlay.id)"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="9" height="9">
                <path d="M13.5 6.5L17 10l-3.5 3.5V6.5zM6.5 13.5L3 10l3.5-3.5v7z" opacity="0.8"/>
              </svg>
            </div>
          </template>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// maplibre-contour 0.1.0 has a broken package `exports` map, so the bare
// specifier cannot be resolved in the browser. Import the built ESM file
// directly and keep it excluded from Vite optimizeDeps in nuxt.config.ts.
// @ts-expect-error maplibre-contour does not publish declarations for this direct build-file import.
import mlContour from '../../node_modules/maplibre-contour/dist/index.mjs'
import { buildMapStyle, CONTOUR_THRESHOLDS, contourMajorLineWidthExpression, contourMidLineWidthExpression, contourMinorLineWidthExpression, mapBackgroundColor, styleUsesContours } from '~/utils/mapStyle'
import { sliceRouteByPercent, excludeRangesFromRoute, trailSourceId, findRoutePercent, getAllRouteCoords, getRouteEndpoints, deletedRangesFromRouteIndexes, routeRangesToGeojson, distanceMeters, DEFAULT_COORD_GAP_THRESHOLD_METERS } from '~/utils/trail'
import { getPosterTypography, getPosterLayout, toFontStack } from '~/utils/posterData'
import { getPosterCompositionProfile, posterCompositionClassName } from '~/utils/posterCompositions'
import { applyViewportScaleToStyle, getViewportVisualScale, VIEWPORT_SCALED_LAYOUT_PROPERTIES, VIEWPORT_SCALED_PAINT_PROPERTIES } from '~/utils/render/viewportScale'
import { getGraphFullReloadFields } from '~/utils/styleLayerGraph'
import { pickContrastSafeColor } from '~/utils/colorContrast'
import type { DeletedRange, MapAsset, PosterTextOverride, PosterTextSlot, StyleConfig, TrailMap, TextOverlay } from '~/types'
import { classifyAssetQuality, computeEffectiveDpi, qualityLabel } from '~/utils/imageAssets'
import type { PrintFraming } from '~/utils/print/printFraming'
import FreezeControl from '~/components/map/FreezeControl.vue'
import ElevationProfile from '~/components/map/ElevationProfile.vue'
import InlineTextToolbar from '~/components/map/InlineTextToolbar.vue'

interface PrintContext {
  framing: PrintFraming
  cssWidthPx: number
  cssHeightPx: number
  deviceScaleFactor: number
}

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
  editable?: boolean
  renderMode?: 'editor' | 'print'
  printContext?: PrintContext
  /** When set, the map enters crosshair mode: user taps to set a segment or crop position */
  plotMode?: { segId: string; field: 'start' | 'end' } | null
  /** When true, the map enters paint-select mode for route deletion */
  deleteBrushActive?: boolean
  /** Brush radius in screen pixels for route deletion selection */
  deleteBrushSize?: number
  canUndo?: boolean
  canRedo?: boolean
}>()

const emit = defineEmits<{
  'update:trailName': [value: string]
  'update:occasionText': [value: string]
  'update:locationText': [value: string]
  'overlay-moved': [payload: { id: string; x: number; y: number }]
  'overlay-selected': [id: string]
  'overlay-deleted': [id: string]
  'overlay-resized': [payload: { id: string; font_size: number }]
  'overlay-updated': [payload: { id: string; patch: Partial<TextOverlay> }]
  'asset-moved': [payload: { id: string; x: number; y: number }]
  'asset-selected': [id: string]
  'asset-deleted': [id: string]
  'asset-resized': [payload: { id: string; width: number; height: number }]
  'edit-requested': [payload: { field: 'trail_name' | 'occasion_text' | 'location_text'; value: string }]
  'poster-text-override': [payload: { slot: PosterTextSlot; patch: PosterTextOverride }]
  'poster-text-reset': [slot: PosterTextSlot]
  'freeze-changed': [payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number]; map_editor_width?: number; map_pitch?: number; map_bearing?: number }]
  /** Fired when user taps the route in plot mode; parent should update the segment and clear plotMode */
  'segment-plotted': [payload: { segId: string; field: 'start' | 'end'; pct: number }]
  /** Fired when user cancels plot mode (Escape key or cancel button) */
  'plot-cancelled': []
  /** Fired when user applies a brush-selected route deletion preview */
  'route-delete-brush-applied': [payload: { ranges: DeletedRange[] }]
  /** Fired when user cancels brush route deletion */
  'route-delete-brush-cancelled': []
  /** Fired when user drags a pin label to a new position */
  'label-moved': [payload: { pin: 'start' | 'finish'; lnglat: [number, number] }]
  /** Fired when manual segment-label editing starts; parent persists the current auto layout */
  'segment-label-edit-started': [payload: { labels: Array<{ id: string; lnglat: [number, number] }> }]
  /** Fired when user drags a trail segment label to a new position */
  'segment-label-moved': [payload: { id: string; lnglat: [number, number] }]
  /** Fired when a selected group of trail segment labels moves together */
  'segment-labels-moved': [payload: { labels: Array<{ id: string; lnglat: [number, number] }> }]
  /** Fired (debounced) when map pan/zoom changes so the view can be persisted */
  'view-changed': [payload: { map_zoom: number; map_center: [number, number]; map_editor_width: number; map_pitch: number; map_bearing: number }]
  'undo': []
  'redo': []
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLDivElement | null>(null)
const posterCanvasEl = ref<HTMLDivElement | null>(null)
const mapReady = ref(false)
const renderReady = ref(false)
const liveZoom = ref<number | undefined>(undefined)
const mapHovered = ref(false)

const BRUSH_PREVIEW_SOURCE_ID = 'route-delete-brush-preview'
const BRUSH_PREVIEW_CASING_LAYER_ID = 'route-delete-brush-preview-casing'
const BRUSH_PREVIEW_LAYER_ID = 'route-delete-brush-preview-line'
const BRUSH_ROUTE_SEGMENT_MAX_METERS = DEFAULT_COORD_GAP_THRESHOLD_METERS

const brushCursor = ref<{ x: number; y: number } | null>(null)
const brushPreviewRanges = ref<DeletedRange[]>([])
const brushSelectedIndexes = ref<Set<number>>(new Set())
const brushPointerDown = ref(false)
let brushPointCache: Array<{ index: number; x: number; y: number }> = []
let brushSegmentCache: Array<{ startIndex: number; endIndex: number; x1: number; y1: number; x2: number; y2: number }> = []
let lastBrushPoint: { x: number; y: number } | null = null

const brushCursorStyle = computed(() => {
  const radius = props.deleteBrushSize ?? 8
  const cursor = brushCursor.value
  if (!cursor) return {}
  return {
    zIndex: 21,
    left: `${cursor.x - radius}px`,
    top: `${cursor.y - radius}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    border: '1.5px solid rgba(248, 113, 113, 0.95)',
    background: 'rgba(239, 68, 68, 0.12)',
    boxShadow: '0 0 0 1px rgba(127, 29, 29, 0.38)',
  }
})
let mapInstance: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null
let interactInstances: Array<{ unset: () => void }> = []
let sessionFrameWidth: number | null = null
let styleReloadCameraHold: MapCameraSnapshot | null = null
let styleReloadCameraHoldTimer: ReturnType<typeof setTimeout> | null = null

// ── Plot mode (map-tap segment/crop position picking) ─────────────────────────
let plotGhostMarker: maplibregl.Marker | null = null
let plotAnimFrame = 0
let plotRouteCoords: number[][] = []

// ── Tile effect protocol (styledtile://) ──────────────────────────────────────
// Intercepts raster tile fetches and applies per-pixel colour transforms:
//   invert    — flips RGB channels for black/white map variants
//   duotone   — remaps luminance to the poster's shadow + highlight colours
//   posterize — quantises each channel to N discrete levels
//
// URL format: styledtile://{effect},{...params}|{realTileUrl}
// Params are baked into the URL so MapLibre cache-busts on any config change.

let tileEffectProtocolRegistered = false

// Per-session cache: keyed by the full styledtile:// URL (includes all effect params).
// Stable when zoom is frozen — same tile coords → same URL → cache hit.
const _tileCache = new Map<string, ArrayBuffer>()

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function ensureTileEffectProtocol() {
  if (tileEffectProtocolRegistered) return
  tileEffectProtocolRegistered = true

  maplibregl.addProtocol('styledtile', async (params: { url: string }, abortController: AbortController) => {
    // Check cache first — avoids re-processing the same tile when params haven't changed
    const cached = _tileCache.get(params.url)
    if (cached) return { data: cached }

    const withoutScheme = params.url.slice('styledtile://'.length)
    const pipeIdx = withoutScheme.indexOf('|')
    if (pipeIdx === -1) throw new Error('Invalid styledtile URL: missing | separator')

    const effectPart = withoutScheme.slice(0, pipeIdx)
    const realUrl    = withoutScheme.slice(pipeIdx + 1)
    const [effect, ...args] = effectPart.split(',')

    const res = await fetch(realUrl, { signal: abortController.signal })
    if (!res.ok) throw new Error(`Tile fetch failed: ${res.status}`)

    const blob = await res.blob()
    const img  = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(img.width, img.height)
    const ctx  = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imgData = ctx.getImageData(0, 0, img.width, img.height)
    const d = imgData.data

    if (effect === 'invert') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i]
        d[i + 1] = 255 - d[i + 1]
        d[i + 2] = 255 - d[i + 2]
      }
    } else if (effect === 'duotone') {
      // args: [shadowHex, highlightHex, strengthPercent]
      const sh = args[0], hi = args[1]
      const strength = parseInt(args[2]) / 100
      const sr = parseInt(sh.slice(0, 2), 16), sg = parseInt(sh.slice(2, 4), 16), sb = parseInt(sh.slice(4, 6), 16)
      const hr = parseInt(hi.slice(0, 2), 16), hg = parseInt(hi.slice(2, 4), 16), hb = parseInt(hi.slice(4, 6), 16)
      for (let i = 0; i < d.length; i += 4) {
        // Perceptual luminance
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
        // Lerp from shadow to highlight, then blend with original by strength
        d[i]     = Math.round(d[i]     + (sr + (hr - sr) * lum - d[i])     * strength)
        d[i + 1] = Math.round(d[i + 1] + (sg + (hg - sg) * lum - d[i + 1]) * strength)
        d[i + 2] = Math.round(d[i + 2] + (sb + (hb - sb) * lum - d[i + 2]) * strength)
        // alpha unchanged
      }
    } else if (effect === 'posterize') {
      // args: [levels]
      const levels = Math.max(2, parseInt(args[0]))
      const step = 255 / (levels - 1)
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = Math.round(Math.round(d[i]     / step) * step)
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step)
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step)
      }
    } else if (effect === 'layer-color') {
      // args: [shadowHex, midHex, highlightHex]
      // Trilinear luminance-band mapping:
      //   L → 0   : pure shadow colour
      //   L → 0.5 : pure midtone colour
      //   L → 1   : pure highlight colour
      const sr = hexToRgb(args[0]), mr = hexToRgb(args[1]), hr = hexToRgb(args[2])
      for (let i = 0; i < d.length; i += 4) {
        const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        const sw = Math.max(0, 1 - L * 2)           // 1 at L=0, 0 at L≥0.5
        const hw = Math.max(0, (L - 0.5) * 2)        // 0 at L≤0.5, 1 at L=1
        const mw = 1 - sw - hw                        // peaks at L=0.5
        d[i]     = Math.round(sr.r * sw + mr.r * mw + hr.r * hw)
        d[i + 1] = Math.round(sr.g * sw + mr.g * mw + hr.g * hw)
        d[i + 2] = Math.round(sr.b * sw + mr.b * mw + hr.b * hw)
        // alpha unchanged
      }
    }

    ctx.putImageData(imgData, 0, 0)
    const resultBlob = await canvas.convertToBlob({ type: 'image/png' })
    const buffer = await resultBlob.arrayBuffer()

    // Cache the result (bounded to ~200 tiles to avoid unbounded memory growth)
    if (_tileCache.size < 200) _tileCache.set(params.url, buffer)

    return { data: buffer }
  })
}

// ── maplibre-contour protocol ─────────────────────────────────────────────────
// Set up once per component mount. The DemSource registers a custom
// "dem-contour://" tile protocol with MapLibre that generates vector contour
// tiles on-the-fly from free AWS terrarium DEM tiles at any elevation interval.

let mlDemSource: any = null

async function ensureContourProtocol() {
  if (mlDemSource) return
  // UMD module: DemSource lives on .default under ESM interop, fall back to root
  const { DemSource } = mlContour as any
  mlDemSource = new DemSource({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: 'terrarium',
    maxzoom: 15,
    // worker: true — DEM decoding runs in its own thread; the ArrayBuffer it
    // returns to MapLibre is always clean (never double-transferred), which
    // fixes the DataCloneError / blank tile that worker:false caused.
    worker: true,
  })
  mlDemSource.setupMaplibre(maplibregl)
}

function getContourTileUrl(cfg: StyleConfig): string | undefined {
  if (!styleUsesContours(cfg) || !mlDemSource) return undefined
  const detail = Math.round(cfg.contour_detail ?? 3)
  const thresholds = CONTOUR_THRESHOLDS[detail] ?? CONTOUR_THRESHOLDS[3]
  // overzoom: 2 — fetch DEM tiles 2 zoom levels higher than the map zoom,
  // giving accurate contours even when the poster is zoomed out to fit a long route.
  return mlDemSource.contourProtocolUrl({ thresholds, overzoom: 2 })
}

type ActiveTextTarget =
  | { type: 'slot'; slot: PosterTextSlot }
  | { type: 'overlay'; id: string }

const activeTextTarget = ref<ActiveTextTarget | null>(null)
const activeTextAnchor = ref<DOMRect | null>(null)

const SLOT_LABELS: Record<PosterTextSlot, string> = {
  trail_name: 'Trail name',
  occasion_text: 'Occasion',
  location_text: 'Location',
  distance: 'Distance',
  elevation_gain: 'Elevation gain',
  date: 'Date',
  coordinates: 'Coordinates',
  start_pin_label: 'Start label',
  finish_pin_label: 'Finish label',
  composition_kicker: 'Theme kicker',
  composition_meta: 'Theme metadata',
  composition_footer: 'Footer note',
  composition_side_rail: 'Side rail label',
}

function selectTextTarget(target: ActiveTextTarget, el: HTMLElement) {
  activeTextTarget.value = target
  activeTextAnchor.value = el.getBoundingClientRect()
}

function isSlotActive(slot: PosterTextSlot) {
  return activeTextTarget.value?.type === 'slot' && activeTextTarget.value.slot === slot
}

function slotOverride(slot: PosterTextSlot): PosterTextOverride {
  return props.styleConfig.poster_text_overrides?.[slot] ?? {}
}

function hasTextOverride(slot: PosterTextSlot) {
  return slotOverride(slot).text != null
}

function textWithOverride(slot: PosterTextSlot, fallback: string) {
  return slotOverride(slot).text ?? fallback
}

function defaultSlotText(slot: PosterTextSlot) {
  if (slot === 'trail_name') return props.styleConfig.trail_name || props.map.title || 'Your Trail'
  if (slot === 'location_text') {
    const text = props.styleConfig.location_text?.trim() || ((props.map.stats as unknown as { location?: string })?.location?.trim() ?? '')
    return text ? text.toUpperCase() : ''
  }
  if (slot === 'occasion_text') return props.styleConfig.occasion_text || ''
  if (slot === 'distance') return formattedDistance.value ? `${formattedDistance.value}\nmiles` : ''
  if (slot === 'elevation_gain') return formattedGain.value ? `${formattedGain.value}\nft gain` : ''
  if (slot === 'date') return formattedDate.value
  if (slot === 'start_pin_label') return props.styleConfig.start_pin_label ?? 'Start'
  if (slot === 'finish_pin_label') return props.styleConfig.finish_pin_label ?? 'Finish'
  if (slot === 'composition_kicker') return compositionDecorDefaults.value.kicker ?? ''
  if (slot === 'composition_meta') return compositionDecorDefaults.value.meta ?? ''
  if (slot === 'composition_footer') return compositionDecorDefaults.value.footerNote ?? ''
  if (slot === 'composition_side_rail') return compositionDecorDefaults.value.sideRailLabel ?? ''
  return coords.value ? `${coords.value.lat}\n${coords.value.lng}` : ''
}

function onSlotFocus(e: FocusEvent, slot: PosterTextSlot) {
  const el = e.currentTarget as HTMLElement
  selectTextTarget({ type: 'slot', slot }, el)
  if (slot === 'trail_name' || slot === 'occasion_text' || slot === 'location_text') {
    emit('edit-requested', { field: slot, value: el.innerText.trim() })
  }
}

function onSlotClick(e: MouseEvent, slot: PosterTextSlot) {
  selectTextTarget({ type: 'slot', slot }, e.currentTarget as HTMLElement)
}

function onSlotBlur(e: FocusEvent, slot: PosterTextSlot) {
  const nextText = (e.currentTarget as HTMLElement).innerText.trim()
  if (nextText === defaultSlotText(slot)) {
    if (hasTextOverride(slot)) emit('poster-text-reset', slot)
    return
  }
  emit('poster-text-override', { slot, patch: { text: nextText } })
}

function onOverlayTextFocus(e: FocusEvent, id: string) {
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectTextTarget({ type: 'overlay', id }, e.currentTarget as HTMLElement)
  emit('overlay-selected', id)
}

function onOverlayTextPointerDown(e: PointerEvent, id: string) {
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectTextTarget({ type: 'overlay', id }, e.currentTarget as HTMLElement)
  emit('overlay-selected', id)
}

function onOverlayTextClick(e: MouseEvent, id: string) {
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectTextTarget({ type: 'overlay', id }, e.currentTarget as HTMLElement)
  emit('overlay-selected', id)
}

function onOverlayTextBlur(e: FocusEvent, id: string) {
  emit('overlay-updated', { id, patch: { content: (e.currentTarget as HTMLElement).innerText.trim() } })
}

function finishActiveTextEdit() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  activeTextTarget.value = null
  activeTextAnchor.value = null
}

function resetActiveText() {
  const target = activeTextTarget.value
  if (!target) return
  if (target.type === 'slot') emit('poster-text-reset', target.slot)
  else {
    const overlay = props.styleConfig.text_overlays?.find(o => o.id === target.id)
    if (overlay) {
      emit('overlay-updated', {
        id: target.id,
        patch: {
          font_family: props.styleConfig.font_family,
          color: props.styleConfig.label_text_color,
          bold: false,
          italic: false,
        },
      })
    }
  }
}

function onPinLabelClick(e: MouseEvent, pin: 'start' | 'finish') {
  if (!props.editable) return
  selectTextTarget({ type: 'slot', slot: pinSlot(pin) }, e.currentTarget as HTMLElement)
}

const selectedOverlayId = ref<string | null>(null)
const selectedAssetId = ref<string | null>(null)
const resizePreview = ref<{ id: string; font_size: number } | null>(null)
const assetResizePreview = ref<{ id: string; width: number; height: number } | null>(null)
let deselectTimer: ReturnType<typeof setTimeout> | null = null

const visibleImageAssets = computed(() => {
  return (props.styleConfig.image_overlays ?? [])
    .filter(asset => asset.kind !== 'logo' || props.styleConfig.show_logo !== false)
    .map(asset => ({
      ...asset,
      quality_status: classifyAssetQuality(computeEffectiveDpi(asset, props.styleConfig.print_size)),
    }))
})

const showLegacyLogo = computed(() => {
  const hasLogoAsset = (props.styleConfig.image_overlays ?? []).some(asset => asset.kind === 'logo')
  return Boolean(props.styleConfig.show_logo && props.styleConfig.logo_url && !hasLogoAsset)
})

function scheduleDeselect() {
  if (deselectTimer) clearTimeout(deselectTimer)
  deselectTimer = setTimeout(() => {
    selectedOverlayId.value = null
    selectedAssetId.value = null
  }, 2000)
}

function onOverlayClick(id: string) {
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectedAssetId.value = null
  const el = posterCanvasEl.value?.querySelector<HTMLElement>(`[data-overlay-id="${id}"] .overlay-content`)
  if (el) selectTextTarget({ type: 'overlay', id }, el)
  emit('overlay-selected', id)
}

function onOverlayDelete(id: string) {
  selectedOverlayId.value = null
  emit('overlay-deleted', id)
}

function onAssetClick(id: string) {
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedAssetId.value = id
  selectedOverlayId.value = null
  activeTextTarget.value = null
  activeTextAnchor.value = null
  emit('asset-selected', id)
}

function onAssetDelete(id: string) {
  selectedAssetId.value = null
  emit('asset-deleted', id)
}

function onResizeStart(e: PointerEvent, id: string) {
  const overlay = props.styleConfig.text_overlays?.find(o => o.id === id)
  if (!overlay || !posterCanvasEl.value) return
  e.preventDefault()

  const startY = e.clientY
  const startSize = overlay.font_size
  const containerH = posterCanvasEl.value.offsetHeight

  resizePreview.value = { id, font_size: startSize }

  function onMove(e: PointerEvent) {
    const dy = e.clientY - startY
    const newSize = Math.max(0.5, Math.min(10, startSize + (dy / containerH) * 10))
    resizePreview.value = { id, font_size: newSize }
  }

  function onUp() {
    if (resizePreview.value) {
      emit('overlay-resized', { id, font_size: parseFloat(resizePreview.value.font_size.toFixed(2)) })
    }
    resizePreview.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    scheduleDeselect()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onAssetResizeStart(e: PointerEvent, id: string) {
  const asset = props.styleConfig.image_overlays?.find(a => a.id === id)
  if (!asset || !posterCanvasEl.value) return
  e.preventDefault()

  const startX = e.clientX
  const startWidth = asset.width
  const startHeight = asset.height
  const containerW = posterCanvasEl.value.offsetWidth

  assetResizePreview.value = { id, width: startWidth, height: startHeight }

  function onMove(e: PointerEvent) {
    const dx = e.clientX - startX
    const scale = Math.max(0.15, 1 + (dx / Math.max(1, containerW)) * 3)
    assetResizePreview.value = {
      id,
      width: Math.max(2, Math.min(95, startWidth * scale)),
      height: Math.max(2, Math.min(95, startHeight * scale)),
    }
  }

  function onUp() {
    if (assetResizePreview.value) {
      emit('asset-resized', {
        id,
        width: parseFloat(assetResizePreview.value.width.toFixed(2)),
        height: parseFloat(assetResizePreview.value.height.toFixed(2)),
      })
    }
    assetResizePreview.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    scheduleDeselect()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// ── Print canvas ─────────────────────────────────────────────────────────────

const isPrintRender = computed(() => props.renderMode === 'print')

const previewRootClass = computed(() => isPrintRender.value
  ? 'radmaps-print-root'
  : 'w-full h-full flex items-center justify-center overflow-hidden')

const previewRootStyle = computed(() => ({
  background: isPrintRender.value ? props.styleConfig.background_color : '#e8e5e0',
}))

const posterCanvasClass = computed(() => ({
  'shadow-[0_32px_80px_rgba(0,0,0,0.35)]': !isPrintRender.value,
  'poster-canvas--print': isPrintRender.value,
  'poster-composition': true,
  [posterCompositionClassName(composition.value.id)]: true,
}))

const posterCanvasStyle = computed(() => isPrintRender.value
  ? {
      width: '100%',
      height: '100%',
      maxWidth: 'none',
      aspectRatio: 'auto',
      backgroundColor: props.styleConfig.background_color,
      containerType: 'size',
      '--print-bleed': `${printBleedCssPx.value}px`,
      '--water-color': props.styleConfig.water_color ?? props.styleConfig.label_text_color,
      '--composition-ink': props.styleConfig.label_text_color,
      '--composition-paper': props.styleConfig.background_color,
      '--composition-body-font': typography.value.subFont,
      '--composition-rule-left': compositionRuleInset.value.left,
      '--composition-rule-right': compositionRuleInset.value.right,
      '--label-bg-color': props.styleConfig.label_bg_color ?? props.styleConfig.background_color,
      '--route-color': props.styleConfig.route_color,
    }
  : {
      aspectRatio: '2 / 3',
      backgroundColor: props.styleConfig.background_color,
      height: '100%',
      maxWidth: '100%',
      containerType: 'size',
      '--print-bleed': '0px',
      '--water-color': props.styleConfig.water_color ?? props.styleConfig.label_text_color,
      '--composition-ink': props.styleConfig.label_text_color,
      '--composition-paper': props.styleConfig.background_color,
      '--composition-body-font': typography.value.subFont,
      '--composition-rule-left': compositionRuleInset.value.left,
      '--composition-rule-right': compositionRuleInset.value.right,
      '--label-bg-color': props.styleConfig.label_bg_color ?? props.styleConfig.background_color,
      '--route-color': props.styleConfig.route_color,
    })

const typography = computed(() => getPosterTypography(props.styleConfig))

const layout = computed(() => getPosterLayout(props.styleConfig))

const composition = computed(() => getPosterCompositionProfile(props.styleConfig))
const sideRailInsideMap = computed(() => composition.value.id === 'modernist-block')

interface CompositionDecor {
  kicker?: string
  meta?: string
  footerNote?: string
  sideRailLabel?: string
}

// ── Poster content ────────────────────────────────────────────────────────────

const trailName = computed(() =>
  textWithOverride('trail_name', props.styleConfig.trail_name || props.map.title || 'Your Trail'),
)

const locationLine = computed(() => {
  const text = props.styleConfig.location_text?.trim() || ((props.map.stats as unknown as { location?: string })?.location?.trim() ?? '')
  const display = textWithOverride('location_text', text)
  return display ? display.toUpperCase() : ''
})

const occasionText = computed(() => textWithOverride('occasion_text', props.styleConfig.occasion_text || ''))

const coords = computed(() => {
  const b = props.map.bbox
  if (!b) return null
  const lat = (b[1] + b[3]) / 2
  const lng = (b[0] + b[2]) / 2
  const fmt = (v: number, pos: string, neg: string) => {
    const d = Math.abs(Math.floor(v))
    const m = Math.round((Math.abs(v) - d) * 60)
    return `${d}°${m.toString().padStart(2, '0')}'${v >= 0 ? pos : neg}`
  }
  return { lat: fmt(lat, 'N', 'S'), lng: fmt(lng, 'E', 'W') }
})

const formattedDistance = computed(() => {
  const km = props.map.stats?.distance_km ?? 0
  return km ? (km * 0.621371).toFixed(1) : ''
})

const formattedGain = computed(() => {
  const m = props.map.stats?.elevation_gain_m ?? 0
  return m ? Math.round(m * 3.28084).toLocaleString() : ''
})

const formattedDate = computed(() => {
  const value = props.map.stats?.date
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const distanceText = computed(() => textWithOverride('distance', formattedDistance.value ? `${formattedDistance.value}\nmiles` : ''))
const elevationGainText = computed(() => textWithOverride('elevation_gain', formattedGain.value ? `${formattedGain.value}\nft gain` : ''))
const dateText = computed(() => textWithOverride('date', formattedDate.value))
const coordinatesText = computed(() => textWithOverride('coordinates', coords.value ? `${coords.value.lat}\n${coords.value.lng}` : ''))
const startPinLabel = computed(() => textWithOverride('start_pin_label', props.styleConfig.start_pin_label ?? 'Start'))
const finishPinLabel = computed(() => textWithOverride('finish_pin_label', props.styleConfig.finish_pin_label ?? 'Finish'))

const compositionDecorDefaults = computed<CompositionDecor>(() => {
  const distance = formattedDistance.value ? `${formattedDistance.value} mi` : 'route study'
  const gain = formattedGain.value ? `${formattedGain.value} ft` : 'field notes'
  const date = dateText.value || 'undated'
  const location = locationLine.value || 'trail record'

  switch (composition.value.id) {
    case 'editorial-tall':
      return {
        kicker: 'No. 01 — A field record',
        meta: `${location} · ${date}`,
        footerNote: 'Drawn from route telemetry and terrain data',
      }
    case 'park-quad':
      return {
        kicker: 'United States · Department of the Interior',
        meta: 'Geological Survey · 7.5-minute series',
        footerNote: `${coords.value?.lat ?? ''} ${coords.value?.lng ?? ''}`.trim(),
      }
    case 'travel-banner':
      return {
        kicker: 'Visit · Explore · Return',
        meta: 'Souvenir route poster',
      }
    case 'riso-stack':
      return {
        kicker: 'Edition 01 / 50',
        meta: 'Two-color trail print',
        footerNote: 'Overprint grain · limited run',
      }
    case 'blueprint-grid':
      return {
        kicker: 'DWG · RM-001',
        meta: 'SHEET 01 / 01 · DATUM WGS84',
        footerNote: 'Grid overlay · route geometry locked to print frame',
      }
    case 'blueprint-strava':
      return {
        kicker: 'STRAVA FILE · ACTIVITY',
        meta: `${date} · SHEET 01 / 01`,
        footerNote: 'Distance · gain · coordinates · route trace',
      }
    case 'journal-spread':
      return {
        kicker: 'IX · MMXXVI — A field study',
        meta: 'Annotated trail specimen',
        footerNote: `${distance} · ${gain} · fair / clear`,
        sideRailLabel: 'FIELD NOTES',
      }
    case 'modernist-block':
      return {
        kicker: 'RADMAPS / ROUTE OBJECT',
        meta: `${distance} · ${gain}`,
        footerNote: 'Form follows route',
        sideRailLabel: 'RAD',
      }
    case 'splits-grid':
      return {
        kicker: 'MORNING RUN / DATA SHEET',
        meta: `${distance} · ${date}`,
        footerNote: 'Segment stats normalized for print',
      }
    case 'bib-numerals':
      return {
        kicker: 'The forty-first',
        meta: 'Race commemorative',
        footerNote: `${distance} / ${gain}`,
      }
    case 'darksky-stars':
      return {
        kicker: 'Dark · sky · reserve',
        meta: 'New moon route plate',
        footerNote: 'Zodiacal light · clear sky window',
      }
    case 'botanical-plate':
      return {
        kicker: 'Plate XLI — Cordillera Cascadia',
        meta: 'Observed along the route transect',
        footerNote: 'Drawn from life · elevation and terrain survey',
      }
    case 'brutalist-slab':
      return {
        kicker: 'RADMAPS · 001',
        meta: 'LOT 12 / 50',
        footerNote: '250 GSM · UNCOATED · ROUTE SLAB',
      }
    default:
      return {}
  }
})

const compositionDecor = computed<CompositionDecor>(() => {
  const defaults = compositionDecorDefaults.value
  return {
    kicker: defaults.kicker != null ? textWithOverride('composition_kicker', defaults.kicker) : undefined,
    meta: defaults.meta != null ? textWithOverride('composition_meta', defaults.meta) : undefined,
    footerNote: defaults.footerNote != null ? textWithOverride('composition_footer', defaults.footerNote) : undefined,
    sideRailLabel: defaults.sideRailLabel != null ? textWithOverride('composition_side_rail', defaults.sideRailLabel) : undefined,
  }
})

const showDistanceSlot = computed(() =>
  props.styleConfig.labels.show_distance && (editableTextVisible(distanceText.value)),
)
const showElevationGainSlot = computed(() =>
  props.styleConfig.labels.show_elevation_gain && (editableTextVisible(elevationGainText.value)),
)
const showDateSlot = computed(() =>
  props.styleConfig.labels.show_date && editableTextVisible(dateText.value),
)
const showCoordinatesSlot = computed(() =>
  props.styleConfig.labels?.show_location !== false && editableTextVisible(coordinatesText.value),
)

function editableTextVisible(text: string) {
  return !!text || !!props.editable
}

// ── Style objects ─────────────────────────────────────────────────────────────

const fg = computed(() => props.styleConfig.label_text_color || '#1C1917')
const bg = computed(() => props.styleConfig.label_bg_color || props.styleConfig.background_color)
const headerBg = computed(() =>
  composition.value.headerBackground === 'label'
    ? (props.styleConfig.label_bg_color || props.styleConfig.background_color)
    : props.styleConfig.background_color,
)
const borderW = computed(() =>
  props.styleConfig.border_style === 'thick' ? '2px'
  : props.styleConfig.border_style === 'thin' ? '1px' : '0',
)
const showPosterInsetFrame = computed(() =>
  composition.value.id === 'legacy-classic' && props.styleConfig.border_style !== 'none',
)
const printBleedCssPx = computed(() =>
  props.printContext ? props.printContext.framing.trimBox.x / props.printContext.deviceScaleFactor : 0,
)

function effectiveSlotFont(slot: PosterTextSlot, fallbackStack: string): string {
  const family = slotOverride(slot).font_family
  return family ? toFontStack(family) : fallbackStack
}

function effectiveSlotColor(slot: PosterTextSlot, fallback: string): string {
  return slotOverride(slot).color ?? fallback
}

function effectiveSlotScale(slot: PosterTextSlot, fallback: number): number {
  return slotOverride(slot).scale ?? fallback
}

function effectiveSlotWeight(slot: PosterTextSlot, fallback: string): string {
  const bold = slotOverride(slot).bold
  if (bold == null) return fallback
  return bold ? '700' : '400'
}

function effectiveSlotItalic(slot: PosterTextSlot): string {
  return slotOverride(slot).italic ? 'italic' : 'normal'
}

function getTextHalo(color = props.styleConfig.background_color ?? '#FFF') {
  // 8-direction solid offsets create a crisp outline; blur fills any gaps
  return [
    `-2px -2px 0 ${color}`, `0 -2px 0 ${color}`, `2px -2px 0 ${color}`,
    `-2px 0 0 ${color}`,                           `2px 0 0 ${color}`,
    `-2px 2px 0 ${color}`,  `0 2px 0 ${color}`,  `2px 2px 0 ${color}`,
    `0 0 4px ${color}`,
  ].join(', ')
}

const headerBandStyle = computed(() => ({
  backgroundColor: headerBg.value,
  color: fg.value,
  padding: composition.value.id === 'legacy-classic'
    ? (layout.value.titlePosition === 'bottom'
        ? `2.4cqh calc(7cqw + ${printBleedCssPx.value}px) calc(3.5cqh + ${printBleedCssPx.value}px)`
        : `calc(5cqh + ${printBleedCssPx.value}px) calc(7cqw + ${printBleedCssPx.value}px) 2.8cqh`)
    : composition.value.headerPadding,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: composition.value.titleAlign === 'left' ? 'flex-start' : 'center',
  justifyContent: 'center',
  gap: '1.1cqh',
  position: 'relative' as const,
  order: String(composition.value.headerOrder),
  zIndex: 3,
}))

const trailNameStyle = computed(() => ({
  fontFamily: effectiveSlotFont('trail_name', typography.value.titleFont),
  fontWeight: effectiveSlotWeight('trail_name', typography.value.titleWeight),
  fontStyle: effectiveSlotItalic('trail_name'),
  letterSpacing: typography.value.titleTracking,
  textTransform: typography.value.titleCase === 'uppercase' ? 'uppercase' as const : 'none' as const,
  fontSize: `${typography.value.titleSize * effectiveSlotScale('trail_name', props.styleConfig.title_scale ?? 1.0)}cqh`,
  lineHeight: typography.value.titleLineHeight,
  color: effectiveSlotColor('trail_name', fg.value),
  textAlign: composition.value.titleAlign === 'left' ? 'left' as const : 'center' as const,
  margin: '0',
  padding: '0',
  outline: 'none',
  textShadow: getTextHalo(headerBg.value),
}))

const locationLineStyle = computed(() => ({
  fontFamily: effectiveSlotFont('location_text', typography.value.subFont),
  fontWeight: effectiveSlotWeight('location_text', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('location_text'),
  letterSpacing: typography.value.subTracking,
  fontSize: `${typography.value.subSize * effectiveSlotScale('location_text', props.styleConfig.subtitle_scale ?? 1.0)}cqh`,
  color: effectiveSlotColor('location_text', fg.value),
  opacity: '0.5',
  textTransform: 'uppercase' as const,
  textAlign: composition.value.titleAlign === 'left' ? 'left' as const : 'center' as const,
  margin: '0',
  padding: '0',
  outline: 'none',
  textShadow: getTextHalo(headerBg.value),
}))

const compositionKickerStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_kicker', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_kicker', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('composition_kicker'),
  fontSize: `${0.88 * effectiveSlotScale('composition_kicker', 1)}cqh`,
  letterSpacing: composition.value.id === 'editorial-tall' || composition.value.id === 'botanical-plate'
    ? '0.08em'
    : '0.24em',
  color: effectiveSlotColor('composition_kicker', fg.value),
  backgroundColor: slotOverride('composition_kicker').bg_color ?? 'transparent',
  opacity: composition.value.id === 'brutalist-slab' ? '0.92' : '0.64',
}))

const compositionMetaStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_meta', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_meta', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('composition_meta'),
  fontSize: `${0.72 * effectiveSlotScale('composition_meta', 1)}cqh`,
  letterSpacing: '0.18em',
  color: effectiveSlotColor('composition_meta', fg.value),
  backgroundColor: slotOverride('composition_meta').bg_color ?? 'transparent',
  opacity: '0.52',
}))

const compositionFooterNoteStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_footer', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_footer', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('composition_footer'),
  fontSize: `${0.62 * effectiveSlotScale('composition_footer', 1)}cqh`,
  color: effectiveSlotColor('composition_footer', fg.value),
  backgroundColor: slotOverride('composition_footer').bg_color ?? 'transparent',
}))

const compositionSideRailLabelStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_side_rail', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_side_rail', '700'),
  fontStyle: effectiveSlotItalic('composition_side_rail'),
  fontSize: `${0.82 * effectiveSlotScale('composition_side_rail', 1)}cqh`,
  color: effectiveSlotColor('composition_side_rail', fg.value),
  backgroundColor: slotOverride('composition_side_rail').bg_color ?? 'transparent',
}))

const ruleStyle = computed(() => ({
  width: '100%',
  height: '1px',
  backgroundColor: fg.value,
  opacity: '0.12',
  marginTop: layout.value.titlePosition === 'bottom' ? '0' : '0.4cqh',
  flexShrink: '0',
}))

const compositionRuleInset = computed(() => {
  const bleed = 'var(--print-bleed, 0px)'
  switch (composition.value.id) {
    case 'editorial-tall':
    case 'riso-stack':
      return { left: `calc(8cqw + ${bleed})`, right: `calc(8cqw + ${bleed})` }
    case 'park-quad':
    case 'botanical-plate':
      return { left: `calc(5cqw + ${bleed})`, right: `calc(5cqw + ${bleed})` }
    case 'blueprint-strava':
    case 'splits-grid':
      return { left: `calc(5cqw + ${bleed})`, right: `calc(5cqw + ${bleed})` }
    case 'modernist-block':
      return { left: `calc(9cqw + ${bleed})`, right: `calc(5.5cqw + ${bleed})` }
    case 'brutalist-slab':
      return { left: `calc(5cqw + ${bleed})`, right: `calc(5cqw + ${bleed})` }
    case 'travel-banner':
    case 'darksky-stars':
      return { left: `calc(7cqw + ${bleed})`, right: `calc(7cqw + ${bleed})` }
    default:
      return { left: `calc(7cqw + ${bleed})`, right: `calc(7cqw + ${bleed})` }
  }
})

const footerRuleStyle = computed(() => ({
  left: 'var(--composition-rule-left)',
  right: 'var(--composition-rule-right)',
  backgroundColor: fg.value,
  opacity: composition.value.id === 'brutalist-slab' ? '0.12' : '0.1',
}))

const footerBandStyle = computed(() => ({
  backgroundColor: bg.value,
  color: fg.value,
  padding: composition.value.id === 'legacy-classic'
    ? `${props.styleConfig.border_style !== 'none' ? 'calc(1.8cqh + 14px)' : '1.8cqh'} calc(7cqw + ${printBleedCssPx.value}px) ${props.styleConfig.border_style !== 'none'
        ? `calc(1.8cqh + 14px + ${printBleedCssPx.value}px)`
        : `calc(1.8cqh + ${printBleedCssPx.value}px)`}`
    : composition.value.footerPadding,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative' as const,
  borderTop: '0',
  order: String(composition.value.footerOrder),
  zIndex: 3,
}))

const mapAreaStyle = computed(() => ({
  order: String(composition.value.mapOrder),
  margin: composition.value.mapMargin,
  border: composition.value.mapBorder,
  boxShadow: composition.value.mapShadow,
  minHeight: '0',
  zIndex: 2,
  color: fg.value,
}))

const gridScope = computed(() => props.styleConfig.grid_scope ?? 'poster')
const showPosterGrid = computed(() => props.styleConfig.show_grid === true && gridScope.value === 'poster')
const showMapGrid = computed(() => props.styleConfig.show_grid === true && gridScope.value === 'map')
const gridOverlayStyle = computed(() => {
  const color = props.styleConfig.grid_color ?? props.styleConfig.label_text_color ?? '#1C1917'
  const weight = props.styleConfig.grid_weight ?? 1
  return {
    opacity: String(props.styleConfig.grid_opacity ?? 0.2),
    backgroundImage: [
      `linear-gradient(to right, ${color} 0 ${weight}px, transparent ${weight}px)`,
      `linear-gradient(to bottom, ${color} 0 ${weight}px, transparent ${weight}px)`,
    ].join(', '),
  }
})

const posterStatsStyle = computed(() => ({
  gap: composition.value.statsEmphasis === 'numeric' ? '1.6cqw' : '2.4cqw',
  transform: composition.value.statsEmphasis === 'large' ? 'scale(1.12)' : 'none',
  transformOrigin: 'left center',
}))

function statNumberStyleFor(slot: PosterTextSlot) {
  return {
  fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
  fontWeight: effectiveSlotWeight(slot, typography.value.statsWeight),
  fontStyle: effectiveSlotItalic(slot),
  fontSize: `${2.6 * effectiveSlotScale(slot, 1)}cqh`,
  letterSpacing: '-0.01em',
  lineHeight: '1',
  color: effectiveSlotColor(slot, fg.value),
  display: 'block',
  }
}

function statUnitStyleFor(slot: PosterTextSlot) {
  return {
  fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
  fontWeight: effectiveSlotWeight(slot, '400'),
  fontStyle: effectiveSlotItalic(slot),
  fontSize: `${0.8 * effectiveSlotScale(slot, 1)}cqh`,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: effectiveSlotColor(slot, fg.value),
  opacity: '0.45',
  display: 'block',
  marginTop: '0.55cqh',
  }
}

function coordStyleFor(slot: PosterTextSlot) {
  return {
  fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
  fontWeight: effectiveSlotWeight(slot, typography.value.statsWeight),
  fontStyle: effectiveSlotItalic(slot),
  fontSize: `${1.2 * effectiveSlotScale(slot, 1)}cqh`,
  letterSpacing: '0.04em',
  lineHeight: '1.45',
  color: effectiveSlotColor(slot, fg.value),
  opacity: '0.65',
  display: 'block',
  whiteSpace: 'pre-line' as const,
  }
}

function statCustomTextStyle(slot: PosterTextSlot) {
  return {
    ...statNumberStyleFor(slot),
    fontSize: `${1.6 * effectiveSlotScale(slot, 1)}cqh`,
    whiteSpace: 'pre-line' as const,
  }
}

function pinSlot(pin: 'start' | 'finish'): PosterTextSlot {
  return pin === 'start' ? 'start_pin_label' : 'finish_pin_label'
}

function pinLabelFontFamily(pin: 'start' | 'finish') {
  const slot = pinSlot(pin)
  const family = slotOverride(slot).font_family ?? props.styleConfig.pin_font_family
  return family ? toFontStack(family) : typography.value.statsFont
}

function pinLabelColor(pin: 'start' | 'finish') {
  return effectiveSlotColor(pinSlot(pin), contrastSafePinColor.value)
}

function pinLabelFontSize(pin: 'start' | 'finish') {
  return svgPinFontSize.value * effectiveSlotScale(pinSlot(pin), 1)
}

function pinLabelWeight(pin: 'start' | 'finish') {
  return effectiveSlotWeight(pinSlot(pin), '600')
}

function pinLabelItalic(pin: 'start' | 'finish') {
  return effectiveSlotItalic(pinSlot(pin))
}

const dividerStyle = computed(() => ({
  width: '1px',
  height: '3cqh',
  backgroundColor: fg.value,
  opacity: '0.15',
  alignSelf: 'center',
  flexShrink: '0',
}))

const occasionStyle = computed(() => ({
  fontFamily: effectiveSlotFont('occasion_text', typography.value.subFont),
  fontWeight: effectiveSlotWeight('occasion_text', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('occasion_text'),
  fontSize: `${0.95 * effectiveSlotScale('occasion_text', props.styleConfig.occasion_scale ?? 1.0)}cqh`,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color: effectiveSlotColor('occasion_text', fg.value),
  opacity: '0.5',
  textAlign: 'center' as const,
  position: 'absolute' as const,
  left: '50%',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap' as const,
  outline: 'none',
  textShadow: getTextHalo(bg.value),
}))

const markLabelStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '700',
  fontSize: '0.55cqh',
  letterSpacing: '0.22em',
  color: fg.value,
  opacity: '0.4',
  textTransform: 'uppercase' as const,
}))

const brandingNoteStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '400',
  fontSize: '0.42cqh',
  letterSpacing: '0.14em',
  color: fg.value,
  opacity: '0.28',
  textTransform: 'lowercase' as const,
}))

const frameStyle = computed(() => ({
  top: `${14 + printBleedCssPx.value}px`,
  right: `${14 + printBleedCssPx.value}px`,
  bottom: `${14 + printBleedCssPx.value}px`,
  left: composition.value.showSideRail
    ? `calc(9cqw + ${14 + printBleedCssPx.value}px)`
    : `${14 + printBleedCssPx.value}px`,
  border: `${borderW.value !== '0' ? borderW.value : '1px'} solid ${fg.value}`,
  opacity: '0.18',
}))

function correctedFrameZoom(savedZoom: number): number {
  const editorWidth = props.styleConfig.map_editor_width ?? sessionFrameWidth ?? 0
  const renderWidth = mapContainer.value?.offsetWidth ?? props.printContext?.cssWidthPx ?? 0
  if (!editorWidth || !renderWidth) return savedZoom
  return savedZoom + Math.log2(renderWidth / editorWidth)
}

function canUseSavedCamera(): boolean {
  if (props.styleConfig.map_zoom == null || props.styleConfig.map_center == null) return false
  // Legacy rows may have a frozen zoom/center without the editor frame width
  // needed to scale that camera into a print screenshot. In print mode, fit the
  // route bounds instead of guessing and producing a zoomed-out poster.
  return !isPrintRender.value || props.styleConfig.map_editor_width != null
}

function currentVisualScale(): number {
  return getViewportVisualScale({
    currentWidth: mapContainer.value?.offsetWidth ?? props.printContext?.cssWidthPx,
    savedEditorWidth: props.styleConfig.map_editor_width,
  })
}

function buildScaledMapStyle(styleConfig: StyleConfig): maplibregl.StyleSpecification {
  const style = buildMapStyle(
    styleConfig,
    config.public.mapboxToken,
    config.public.maptilerToken,
    getContourTileUrl(styleConfig),
    config.public.stadiaToken,
  ) as maplibregl.StyleSpecification
  return applyViewportScaleToStyle(style, currentVisualScale()) as maplibregl.StyleSpecification
}

function applyViewportScaledLayerProperties(styleConfig: StyleConfig = props.styleConfig) {
  if (!mapInstance) return
  const scaledStyle = buildScaledMapStyle(styleConfig) as { layers?: Array<Record<string, unknown>> }
  if (!Array.isArray(scaledStyle.layers)) return

  for (const layer of scaledStyle.layers) {
    const id = String(layer.id ?? '')
    if (!mapInstance.getLayer(id)) continue
    const paint = layer.paint as Record<string, unknown> | undefined
    const layout = layer.layout as Record<string, unknown> | undefined
    if (paint) {
      for (const property of VIEWPORT_SCALED_PAINT_PROPERTIES) {
        if (paint[property] != null) {
          mapInstance.setPaintProperty(id, property, paint[property])
        }
      }
    }
    if (layout) {
      for (const property of VIEWPORT_SCALED_LAYOUT_PROPERTIES) {
        if (layout[property] != null) {
          mapInstance.setLayoutProperty(id, property, layout[property])
        }
      }
    }
  }
}

async function waitForPrintableAssets() {
  await nextTick()
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
  if (fonts?.ready) await fonts.ready

  const images = Array.from(posterCanvasEl.value?.querySelectorAll('img') ?? [])
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return img.decode().catch(() => undefined)
  }))

  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

function markPrintRenderReady() {
  if (!isPrintRender.value || renderReady.value || !mapInstance) return
  const instance = mapInstance
  let readyTimer: ReturnType<typeof setTimeout> | null = null
  const complete = async () => {
    if (renderReady.value) return
    if (readyTimer) clearTimeout(readyTimer)
    try {
      await waitForPrintableAssets()
      const status = {
        ready: true,
        mapLoaded: instance.loaded(),
        routeLayerPresent: !!instance.getLayer('route-line'),
        routeFeatureCount: (props.map.geojson as GeoJSON.FeatureCollection | undefined)?.features?.length ?? 0,
      }
      renderReady.value = true
      ;(window as unknown as { __RADMAPS_RENDER_STATUS?: typeof status; __RENDER_READY?: boolean }).__RADMAPS_RENDER_STATUS = status
      ;(window as unknown as { __RENDER_READY?: boolean }).__RENDER_READY = true
      document.dispatchEvent(new CustomEvent('radmaps-render-ready', { detail: status }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ;(window as unknown as { __RADMAPS_RENDER_STATUS?: { ready: false; error: string }; __RENDER_ERROR?: string }).__RADMAPS_RENDER_STATUS = { ready: false, error: message }
      ;(window as unknown as { __RENDER_ERROR?: string }).__RENDER_ERROR = message
    }
  }
  instance.once('idle', complete)
  readyTimer = setTimeout(complete, 12_000)
}

// ── Logo styles ───────────────────────────────────────────────────────────────

const logoSize = computed(() => `${props.styleConfig.logo_size ?? 8}cqh`)

const logoMapStyle = computed(() => ({
  position: 'absolute' as const,
  top: '2%',
  right: '2%',
  maxHeight: logoSize.value,
  maxWidth: '15%',
  zIndex: 10,
  objectFit: 'contain' as const,
  pointerEvents: 'none' as const,
}))

const logoHeaderStyle = computed(() => ({
  position: 'absolute' as const,
  top: '50%',
  right: '7cqw',
  transform: 'translateY(-50%)',
  maxHeight: logoSize.value,
  maxWidth: '12%',
  objectFit: 'contain' as const,
  pointerEvents: 'none' as const,
  zIndex: 5,
}))

const logoFooterStyle = computed(() => ({
  maxHeight: '4cqh',
  maxWidth: '10%',
  objectFit: 'contain' as const,
  pointerEvents: 'none' as const,
  flexShrink: '0',
}))

// ── Text overlay styles ────────────────────────────────────────────────────────

function overlayStyle(o: TextOverlay): Record<string, string> {
  const xOffset = o.alignment === 'center' ? '-50%' : o.alignment === 'right' ? '-100%' : '0%'
  const fontSize = resizePreview.value?.id === o.id ? resizePreview.value.font_size : o.font_size
  return {
    position: 'absolute',
    left: `${o.x}%`,
    top: `${o.y}%`,
    fontFamily: toFontStack(o.font_family),
    fontSize: `${fontSize}cqh`,
    color: o.color,
    textAlign: o.alignment,
    opacity: String(o.opacity),
    fontWeight: o.bold ? '700' : '400',
    fontStyle: o.italic ? 'italic' : 'normal',
    transform: `translateX(${xOffset})`,
    whiteSpace: 'pre',
    width: 'max-content',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: '8',
    // Halo: skip when bg_color is set (the pill background already provides contrast)
    ...(!o.bg_color ? { textShadow: getTextHalo() } : {}),
    ...(o.bg_color ? {
      backgroundColor: o.bg_color,
      padding: '0.3cqh 0.8cqh',
      borderRadius: '0.4cqh',
    } : {}),
  }
}

function imageAssetStyle(asset: MapAsset): Record<string, string> {
  const preview = assetResizePreview.value?.id === asset.id ? assetResizePreview.value : null
  return {
    position: 'absolute',
    left: `${asset.x}%`,
    top: `${asset.y}%`,
    width: `${preview?.width ?? asset.width}%`,
    height: `${preview?.height ?? asset.height}%`,
    opacity: String(asset.opacity),
    transform: `rotate(${asset.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: String(asset.z_index),
  }
}

function assetQualityLabel(asset: MapAsset): string {
  return `${qualityLabel(asset.quality_status)} · ${computeEffectiveDpi(asset, props.styleConfig.print_size)} DPI`
}

const activeToolbarState = computed(() => {
  const target = activeTextTarget.value
  if (!target) return null

  if (target.type === 'overlay') {
    const overlay = props.styleConfig.text_overlays?.find(o => o.id === target.id)
    if (!overlay) return null
    return {
      label: 'Text overlay',
      textValue: overlay.content,
      fontFamily: overlay.font_family,
      color: overlay.color,
      backgroundColor: overlay.bg_color || '',
      scale: Math.max(0.5, Math.min(2, overlay.font_size / 2)),
      bold: overlay.bold,
      italic: overlay.italic ?? false,
      supportsHighlight: true,
      canReset: false,
    }
  }

  const slot = target.slot
  const override = slotOverride(slot)
  const defaultFont = slot === 'trail_name'
    ? props.styleConfig.font_family
    : slot === 'start_pin_label' || slot === 'finish_pin_label'
      ? (props.styleConfig.pin_font_family ?? props.styleConfig.body_font_family)
      : props.styleConfig.body_font_family
  const defaultWeight = slot === 'trail_name'
    ? typography.value.titleWeight
    : slot === 'start_pin_label' || slot === 'finish_pin_label'
      ? '600'
    : slot === 'occasion_text' ||
        slot === 'location_text' ||
        slot === 'composition_kicker' ||
        slot === 'composition_meta' ||
        slot === 'composition_footer' ||
        slot === 'composition_side_rail'
      ? typography.value.subWeight
      : typography.value.statsWeight

  return {
    label: SLOT_LABELS[slot],
    textValue: textWithOverride(slot, defaultSlotText(slot)),
    fontFamily: override.font_family ?? defaultFont,
    color: override.color ?? fg.value,
    backgroundColor: override.bg_color ?? '',
    scale: effectiveSlotScale(slot, legacySlotScale(slot)),
    bold: override.bold ?? Number.parseInt(defaultWeight, 10) >= 600,
    italic: override.italic ?? false,
    supportsHighlight: false,
    canReset: !!props.styleConfig.poster_text_overrides?.[slot],
  }
})

function legacySlotScale(slot: PosterTextSlot) {
  if (slot === 'trail_name') return props.styleConfig.title_scale ?? 1
  if (slot === 'occasion_text') return props.styleConfig.occasion_scale ?? 1
  if (slot === 'location_text') return props.styleConfig.subtitle_scale ?? 1
  if (slot === 'start_pin_label' || slot === 'finish_pin_label') return 1
  return 1
}

function applyToolbarPatch(patch: PosterTextOverride) {
  const target = activeTextTarget.value
  if (!target) return
  if (target.type === 'slot') {
    emit('poster-text-override', { slot: target.slot, patch })
    return
  }

  const overlayPatch: Partial<TextOverlay> = {}
  if (patch.text != null) overlayPatch.content = patch.text
  if (patch.font_family) overlayPatch.font_family = patch.font_family
  if (patch.color) overlayPatch.color = patch.color
  if (patch.bg_color != null) overlayPatch.bg_color = patch.bg_color || undefined
  if (patch.scale != null) overlayPatch.font_size = Number((patch.scale * 2).toFixed(2))
  if (patch.bold != null) overlayPatch.bold = patch.bold
  if (patch.italic != null) overlayPatch.italic = patch.italic
  emit('overlay-updated', { id: target.id, patch: overlayPatch })
}

// ── Trail legend ──────────────────────────────────────────────────────────────

const visibleNamedSegments = computed(() =>
  (props.styleConfig.trail_segments ?? []).filter(s => s.visible && s.name),
)

const showTrailLegend = computed(() =>
  props.styleConfig.trail_legend?.show !== false &&
  visibleNamedSegments.value.length > 0 &&
  props.styleConfig.trail_label_style !== 'leader-lines',
)

const trailLegendStyle = computed(() => {
  const pos = props.styleConfig.trail_legend?.position ?? 'bottom-left'
  const hasBorder = props.styleConfig.border_style !== 'none'
  const edge = hasBorder ? 'calc(2% + 20px)' : '2%'
  const posStyles: Record<string, string> = {
    'bottom-left': `bottom: ${edge}; left: ${edge};`,
    'bottom-right': `bottom: ${edge}; right: ${edge};`,
    'top-left': `top: ${edge}; left: ${edge};`,
    'top-right': `top: ${edge}; right: ${edge};`,
  }
  const parts = posStyles[pos]?.split(';').filter(Boolean) ?? []
  const style: Record<string, string> = {
    position: 'absolute',
    zIndex: '9',
    background: bg.value,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: '0.6cqh',
    padding: '0.8cqh 1.2cqw',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5cqh',
    pointerEvents: 'none',
  }
  for (const part of parts) {
    const [k, v] = part.split(':').map(s => s.trim())
    if (k && v) style[k] = v
  }
  return style
})

const legendLabelStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '500',
  fontSize: '0.75cqh',
  letterSpacing: '0.06em',
  color: fg.value,
  opacity: '0.85',
}))

// ── Vignette + grain computed values ─────────────────────────────────────────

const vignetteStyle = computed(() => {
  const intensity = props.styleConfig.vignette_intensity ?? 0.45
  // Dark themes get a pure-black vignette; light themes get a softer version
  const isDark = ['obsidian', 'forest', 'midnight'].includes(props.styleConfig.color_theme ?? '')
  const alpha = isDark ? intensity : intensity * 0.65
  return {
    background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${alpha.toFixed(2)}) 100%)`,
  }
})

const grainOpacity = computed(() => props.styleConfig.tile_grain ?? 0)

// ── SVG overlay state (leader lines + pin labels) ─────────────────────────────
// All positions are in px relative to the map container, recomputed on every
// map move/zoom via recomputeOverlays(). Sizes scale with container height so
// they look correct at both browser-preview and Puppeteer print dimensions.

interface LeaderItem {
  id: string
  name: string
  color: string
  fontSize: number
  dotX: number
  dotY: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

interface LeaderDragState {
  ids: string[]
  startX: number
  startY: number
  hasMoved: boolean
  initialItems: Record<string, Pick<LeaderItem, 'labelX' | 'labelY' | 'dotX'>>
}

interface PinItem {
  id: 'start' | 'finish'
  label: string
  color: string
  opacity: number
  dotX: number
  dotY: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

const containerDims  = ref({ w: 0, h: 0 })
const leaderLineItems = ref<LeaderItem[]>([])
const pinOverlayItems = ref<PinItem[]>([])
const draggingPin    = ref<'start' | 'finish' | null>(null)
const draggingLeader = ref<LeaderDragState | null>(null)
const selectedLeaderIds = ref<string[]>([])

const posterContentMinPx = (editorMin: number) => isPrintRender.value ? 0 : editorMin
const svgDotR         = computed(() => Math.max(posterContentMinPx(1.5), containerDims.value.h * 0.00125))
const svgLineW        = computed(() => Math.max(posterContentMinPx(0.8), containerDims.value.h * 0.0012))
const svgPinFontSize  = computed(() => Math.max(posterContentMinPx(11),  containerDims.value.h * 0.022))
const svgLeaderFontSize = computed(() => Math.max(posterContentMinPx(9), containerDims.value.h * 0.014) * (props.styleConfig.leader_label_scale ?? 1.0))
const svgPinOffset    = computed(() => Math.max(posterContentMinPx(40),  containerDims.value.h * 0.07))
const leaderLabelFontFamily = computed(() => `'${props.styleConfig.leader_label_font_family ?? props.styleConfig.font_family}', sans-serif`)

let measureCanvas: HTMLCanvasElement | null = null

function estimateSvgTextWidth(text: string, fontSize: number, fontFamily: string, fontWeight = 700, letterSpacingEm = 0): number {
  const label = text.toUpperCase()
  const fallback = label.length * fontSize * 0.62
  if (typeof document === 'undefined') return fallback

  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return fallback

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const letterSpacing = Math.max(0, label.length - 1) * fontSize * letterSpacingEm
  return ctx.measureText(label).width + letterSpacing
}

function clampValue(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2
  return Math.min(Math.max(value, min), max)
}

function leaderLabelBounds(W: number, H: number, labelWidth: number, fontSize: number): {
  hMargin: number
  vMargin: number
  minLeftX: number
  maxLeftX: number
  minRightX: number
  maxRightX: number
} {
  const hMargin = Math.max(posterContentMinPx(24), Math.min(W, H) * 0.045)
  const labelHalfHeight = fontSize * 0.62
  const vMargin = Math.max(posterContentMinPx(24), H * 0.07, labelHalfHeight + posterContentMinPx(8))

  return {
    hMargin,
    vMargin,
    minLeftX: hMargin + labelWidth,
    maxLeftX: W - hMargin,
    minRightX: hMargin,
    maxRightX: W - hMargin - labelWidth,
  }
}

function clampLeaderLabelPoint(opts: {
  labelX: number
  labelY: number
  dotX: number
  name: string
  fontSize: number
  fontFamily: string
  W: number
  H: number
}): { labelX: number; labelY: number; anchor: 'start' | 'end' } {
  const labelWidth = estimateSvgTextWidth(opts.name, opts.fontSize, opts.fontFamily, 700, 0.1)
  const bounds = leaderLabelBounds(opts.W, opts.H, labelWidth, opts.fontSize)
  const anchor: 'start' | 'end' = opts.labelX < opts.dotX ? 'end' : 'start'
  const minX = anchor === 'end' ? bounds.minLeftX : bounds.minRightX
  const maxX = anchor === 'end' ? bounds.maxLeftX : bounds.maxRightX

  return {
    labelX: clampValue(opts.labelX, minX, maxX),
    labelY: clampValue(opts.labelY, bounds.vMargin, opts.H - bounds.vMargin),
    anchor,
  }
}

const showLeaderLines = computed(() =>
  props.styleConfig.trail_label_style === 'leader-lines' &&
  (props.styleConfig.trail_segments ?? []).some(s => s.visible && s.name),
)
const showPinOverlay = computed(() =>
  mapReady.value && (
    (props.styleConfig.show_start_pin !== false) ||
    (props.styleConfig.show_finish_pin !== false)
  ),
)

const contrastSafePinColor = computed(() =>
  props.styleConfig.pin_color ?? pickContrastSafeColor(
    mapBackgroundColor(props.styleConfig),
    [
      props.styleConfig.route_color,
      props.styleConfig.label_bg_color,
      props.styleConfig.label_text_color,
      props.styleConfig.background_color,
    ],
  )
)

function recomputeOverlays() {
  if (!mapInstance || !mapContainer.value) return
  const W = mapContainer.value.offsetWidth
  const H = mapContainer.value.offsetHeight
  containerDims.value = { w: W, h: H }
  const offset = svgPinOffset.value

  // ── Pin labels ────────────────────────────────────────────────────────────
  // Skip recomputing dot/label positions while the user is actively dragging
  // (pinOverlayItems is updated live in onLabelDragMove instead)
  if (draggingPin.value) {
    // Still need to reproject the dot position for the active drag
    for (let i = 0; i < pinOverlayItems.value.length; i++) {
      const pin = pinOverlayItems.value[i]
      const marker = pin.id === 'start' ? startMarker : finishMarker
      if (!marker) continue
      const pt = mapInstance.project(marker.getLngLat())
      pinOverlayItems.value[i] = { ...pin, dotX: pt.x, dotY: pt.y }
    }
  } else {
    const newPins: PinItem[] = []
    const pinColor   = contrastSafePinColor.value
    const pinOpacity = props.styleConfig.pin_opacity ?? 0.9

    for (const which of ['start', 'finish'] as const) {
      const show = which === 'start'
        ? props.styleConfig.show_start_pin !== false
        : props.styleConfig.show_finish_pin !== false
      if (!show) continue

      const marker = which === 'start' ? startMarker : finishMarker
      if (!marker) continue

      const ll = marker.getLngLat()
      const pt = mapInstance.project(ll)
      if (pt.x < -offset * 2 || pt.x > W + offset * 2 || pt.y < -offset * 2 || pt.y > H + offset * 2) continue

      const label = which === 'start'
        ? startPinLabel.value
        : finishPinLabel.value

      // Use saved label lnglat (from prior drag) or auto-offset from dot
      const savedLabelLnglat = which === 'start'
        ? props.styleConfig.start_label_lnglat
        : props.styleConfig.finish_label_lnglat

      let labelX: number, labelY: number, anchor: 'start' | 'end'
      if (savedLabelLnglat) {
        const lp = mapInstance.project(savedLabelLnglat as [number, number])
        labelX = lp.x
        labelY = lp.y
        anchor = lp.x < pt.x ? 'end' : 'start'
      } else {
        // Default: start label goes upper-left, finish goes upper-right
        anchor = which === 'start' ? 'end' : 'start'
        labelX = which === 'start' ? pt.x - offset * 0.7 : pt.x + offset * 0.7
        labelY = pt.y - offset * 0.8
      }

      newPins.push({ id: which, label, color: pinColor, opacity: pinOpacity, dotX: pt.x, dotY: pt.y, labelX, labelY, anchor })
    }
    pinOverlayItems.value = newPins
  }

  // ── Trail leader lines ────────────────────────────────────────────────────
  if (!showLeaderLines.value) { leaderLineItems.value = []; return }

  // While dragging a leader label, only reproject the dot; keep label pos
  if (draggingLeader.value) {
    const instance = mapInstance
    if (!instance) return
    leaderLineItems.value = leaderLineItems.value.map(item => {
      const seg = (props.styleConfig.trail_segments ?? []).find(s => s.id === item.id)
      if (!seg) return item
      const allC   = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
      const idx    = Math.min(Math.floor(allC.length * seg.section_start / 100), allC.length - 1)
      if (idx < 0) return item
      const pt = instance.project([allC[idx][0], allC[idx][1]] as [number, number])
      return { ...item, dotX: pt.x, dotY: pt.y }
    })
    return
  }

  const allCoords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)

  interface Candidate {
    seg: NonNullable<typeof props.styleConfig.trail_segments>[number]
    dotX: number
    dotY: number
    labelWidth: number
  }
  const candidates: Candidate[] = []
  const manualItems: LeaderItem[] = []
  const fontFamily = leaderLabelFontFamily.value
  let labelFontSize = svgLeaderFontSize.value

  for (const seg of (props.styleConfig.trail_segments ?? [])) {
    if (!seg.visible || !seg.name) continue
    const idx = Math.min(Math.floor(allCoords.length * seg.section_start / 100), allCoords.length - 1)
    if (idx < 0) continue
    const [lng, lat] = allCoords[idx]
    const pt = mapInstance.project([lng, lat])
    // Include segments slightly off-screen too (leader line still useful)
    if (pt.x < -W * 0.5 || pt.x > W * 1.5 || pt.y < -H * 0.5 || pt.y > H * 1.5) continue

    if (seg.label_lnglat) {
      const lp = mapInstance.project(seg.label_lnglat as [number, number])
      const labelPoint = clampLeaderLabelPoint({
        labelX: lp.x,
        labelY: lp.y,
        dotX: pt.x,
        name: seg.name,
        fontSize: labelFontSize,
        fontFamily,
        W,
        H,
      })
      manualItems.push({
        id: seg.id,
        name: seg.name,
        color: seg.color,
        fontSize: labelFontSize,
        dotX: pt.x,
        dotY: pt.y,
        ...labelPoint,
      })
      continue
    }

    candidates.push({
      seg,
      dotX: pt.x,
      dotY: pt.y,
      labelWidth: estimateSvgTextWidth(seg.name, labelFontSize, fontFamily, 700, 0.1),
    })
  }

  // Start labels on the side nearest their segment start, then rebalance near-center
  // labels so dense routes don't pile every name onto one edge.
  const leftCandidates: Candidate[] = candidates
    .filter(c => c.dotX <= W / 2)
  const rightCandidates: Candidate[] = candidates
    .filter(c => c.dotX > W / 2)

  function moveCenterMost(from: Candidate[], to: Candidate[]) {
    if (!from.length) return
    let moveIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < from.length; i++) {
      const distance = Math.abs(from[i].dotX - W / 2)
      if (distance < bestDistance) {
        bestDistance = distance
        moveIndex = i
      }
    }
    const [moved] = from.splice(moveIndex, 1)
    to.push(moved)
  }

  while (leftCandidates.length > rightCandidates.length + 1) {
    moveCenterMost(leftCandidates, rightCandidates)
  }
  while (rightCandidates.length > leftCandidates.length + 1) {
    moveCenterMost(rightCandidates, leftCandidates)
  }

  leftCandidates.sort((a, b) => a.dotY - b.dotY)
  rightCandidates.sort((a, b) => a.dotY - b.dotY)

  const fitLabelNames = [
    ...candidates.map(c => c.seg.name),
    ...manualItems.map(item => item.name),
  ]

  if (props.styleConfig.leader_label_auto_fit !== false && fitLabelNames.length) {
    const maxMeasuredWidth = Math.max(
      0,
      ...fitLabelNames.map(name => estimateSvgTextWidth(name, labelFontSize, fontFamily, 700, 0.1)),
    )
    const maxSideCount = Math.max(leftCandidates.length, rightCandidates.length, Math.ceil(fitLabelNames.length / 2))
    const widthLimit = maxMeasuredWidth > 0 ? labelFontSize * (W * 0.34) / maxMeasuredWidth : labelFontSize
    const verticalLimit = maxSideCount > 1 ? (H * 0.38 / (maxSideCount - 1)) / 1.45 : labelFontSize
    const minFontSize = Math.max(posterContentMinPx(7), H * 0.008)
    const fittedFontSize = clampValue(Math.min(labelFontSize, widthLimit, verticalLimit), minFontSize, labelFontSize)

    if (fittedFontSize < labelFontSize) {
      labelFontSize = fittedFontSize
      for (const c of candidates) {
        c.labelWidth = estimateSvgTextWidth(c.seg.name, labelFontSize, fontFamily, 700, 0.1)
      }
      for (const item of manualItems) item.fontSize = labelFontSize
    }
  }

  // Anchor x is the inner edge of the label. Reserve measured text width so the
  // outer edge keeps a real margin from the map border.
  const maxLeftWidth = Math.max(0, ...leftCandidates.map(c => c.labelWidth))
  const maxRightWidth = Math.max(0, ...rightCandidates.map(c => c.labelWidth))
  const leftBounds = leaderLabelBounds(W, H, maxLeftWidth, labelFontSize)
  const rightBounds = leaderLabelBounds(W, H, maxRightWidth, labelFontSize)
  const hMargin = Math.max(leftBounds.hMargin, rightBounds.hMargin)
  const vMargin = Math.max(leftBounds.vMargin, rightBounds.vMargin)
  const leftX = clampValue(Math.max(W * 0.16, hMargin + maxLeftWidth), hMargin, W - hMargin)
  const rightX = clampValue(Math.min(W * 0.84, W - hMargin - maxRightWidth), hMargin, W - hMargin)

  function packLabelYs(cands: Candidate[]): number[] {
    if (cands.length === 0) return []

    const minY = vMargin
    const maxY = H - vMargin
    const minGap = Math.max(posterContentMinPx(15), labelFontSize * 1.45)
    const ys = cands.map(c => clampValue(c.dotY, minY, maxY))

    for (let i = 1; i < ys.length; i++) {
      ys[i] = Math.max(ys[i], ys[i - 1] + minGap)
    }

    const overflow = ys[ys.length - 1] - maxY
    if (overflow > 0) {
      for (let i = 0; i < ys.length; i++) ys[i] -= overflow
    }

    for (let i = ys.length - 2; i >= 0; i--) {
      ys[i] = Math.min(ys[i], ys[i + 1] - minGap)
    }

    const underflow = minY - ys[0]
    if (underflow > 0) {
      for (let i = 0; i < ys.length; i++) ys[i] += underflow
    }

    return ys.map(y => clampValue(y, minY, maxY))
  }

  const leftYs  = packLabelYs(leftCandidates)
  const rightYs = packLabelYs(rightCandidates)

  const items: LeaderItem[] = [...manualItems]

  for (let i = 0; i < leftCandidates.length; i++) {
    const c = leftCandidates[i]
    items.push({ id: c.seg.id, name: c.seg.name, color: c.seg.color, fontSize: labelFontSize, dotX: c.dotX, dotY: c.dotY, labelX: leftX, labelY: leftYs[i], anchor: 'end' })
  }
  for (let i = 0; i < rightCandidates.length; i++) {
    const c = rightCandidates[i]
    items.push({ id: c.seg.id, name: c.seg.name, color: c.seg.color, fontSize: labelFontSize, dotX: c.dotX, dotY: c.dotY, labelX: rightX, labelY: rightYs[i], anchor: 'start' })
  }

  leaderLineItems.value = items
}

// ── Pin label drag (label moves, dot stays at route endpoint) ─────────────────

function startLabelDrag(e: PointerEvent, pinId: 'start' | 'finish') {
  draggingPin.value = pinId
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onLabelDragMove(e: PointerEvent) {
  if (!draggingPin.value || !mapContainer.value || !mapInstance) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  pinOverlayItems.value = pinOverlayItems.value.map(pin => {
    if (pin.id !== draggingPin.value) return pin
    const anchor: 'start' | 'end' = x < pin.dotX ? 'end' : 'start'
    return { ...pin, labelX: x, labelY: y, anchor }
  })
}

function onLabelDragEnd(e: PointerEvent) {
  if (!draggingPin.value || !mapContainer.value || !mapInstance) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const lngLat = mapInstance.unproject([x, y])
  emit('label-moved', { pin: draggingPin.value, lnglat: [lngLat.lng, lngLat.lat] })
  draggingPin.value = null
}

// ── Trail segment label drag ──────────────────────────────────────────────────

function startLeaderDrag(e: PointerEvent, segId: string) {
  if (e.shiftKey) {
    toggleLeaderSelection(segId)
    e.preventDefault()
    return
  }

  if (!mapContainer.value) return
  const rect = mapContainer.value.getBoundingClientRect()
  const selected = selectedLeaderIds.value.includes(segId)
  const ids = selected ? [...selectedLeaderIds.value] : [segId]

  if (!selected) selectedLeaderIds.value = []

  const initialItems: LeaderDragState['initialItems'] = {}
  for (const item of leaderLineItems.value) {
    if (!ids.includes(item.id)) continue
    initialItems[item.id] = { labelX: item.labelX, labelY: item.labelY, dotX: item.dotX }
  }

  draggingLeader.value = {
    ids,
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
    hasMoved: false,
    initialItems,
  }

  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function toggleLeaderSelection(segId: string) {
  selectedLeaderIds.value = selectedLeaderIds.value.includes(segId)
    ? selectedLeaderIds.value.filter(id => id !== segId)
    : [...selectedLeaderIds.value, segId]
}

function isLeaderDragActive(segId: string): boolean {
  return draggingLeader.value?.ids.includes(segId) ?? false
}

function lockCurrentLeaderLabelPositions() {
  if (!mapInstance || !leaderLineItems.value.length) return

  const labels = leaderLineItems.value.map(item => {
    const lngLat = mapInstance!.unproject([item.labelX, item.labelY])
    return { id: item.id, lnglat: [lngLat.lng, lngLat.lat] as [number, number] }
  })

  emit('segment-label-edit-started', { labels })
}

function onLeaderDragMove(e: PointerEvent) {
  if (!draggingLeader.value || !mapContainer.value) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const dx = x - draggingLeader.value.startX
  const dy = y - draggingLeader.value.startY

  if (!draggingLeader.value.hasMoved) {
    if (Math.hypot(dx, dy) < 4) return
    draggingLeader.value = { ...draggingLeader.value, hasMoved: true }
    lockCurrentLeaderLabelPositions()
  }

  const dragState = draggingLeader.value
  leaderLineItems.value = leaderLineItems.value.map(item => {
    const initial = dragState.initialItems[item.id]
    if (!initial) return item
    const labelPoint = clampLeaderLabelPoint({
      labelX: initial.labelX + dx,
      labelY: initial.labelY + dy,
      dotX: item.dotX,
      name: item.name,
      fontSize: item.fontSize,
      fontFamily: leaderLabelFontFamily.value,
      W: rect.width,
      H: rect.height,
    })
    return { ...item, ...labelPoint }
  })
}

function onLeaderDragEnd(_e: PointerEvent) {
  if (!draggingLeader.value || !mapContainer.value || !mapInstance) return
  const dragState = draggingLeader.value

  if (!dragState.hasMoved) {
    draggingLeader.value = null
    return
  }

  const labels = leaderLineItems.value
    .filter(item => dragState.ids.includes(item.id))
    .map(item => {
      const lngLat = mapInstance!.unproject([item.labelX, item.labelY])
      return { id: item.id, lnglat: [lngLat.lng, lngLat.lat] as [number, number] }
    })

  if (labels.length === 1) {
    emit('segment-label-moved', labels[0])
  } else if (labels.length > 1) {
    emit('segment-labels-moved', { labels })
  }

  draggingLeader.value = null
}

function cancelLeaderDrag() {
  draggingLeader.value = null
}

// ── Map lifecycle ─────────────────────────────────────────────────────────────

function fullReloadKeysFor(cfg: StyleConfig): Array<keyof StyleConfig> {
  // trail_segments intentionally stay structural/data-driven below: segment ID
  // changes rebuild sources/layers, while geometry/color/width use fast paths.
  return getGraphFullReloadFields(cfg).filter(key => key !== 'trail_segments')
}

// Computes a cache key for all parameters baked into the styledtile:// URL.
// When this key changes, MapLibre needs a full style reload to re-fetch tiles.
function effectiveTileKey(cfg: StyleConfig): string {
  const effect = cfg.tile_effect ?? 'none'
  if (effect === 'duotone') {
    const shadow    = cfg.label_text_color ?? '#1C1917'
    const highlight = cfg.background_color ?? '#F7F4EF'
    const strength  = Math.round((cfg.tile_duotone_strength ?? 0.9) * 100)
    return `duo:${shadow}:${highlight}:${strength}`
  }
  if (effect === 'posterize') {
    return `post:${cfg.tile_posterize_levels ?? 4}`
  }
  if (effect === 'invert') {
    return 'invert'
  }
  if (effect === 'layer-color') {
    const shadow    = cfg.tile_shadow_color    ?? cfg.label_text_color  ?? '#1C1917'
    const highlight = cfg.tile_highlight_color ?? cfg.background_color  ?? '#F7F4EF'
    const mid       = cfg.tile_midtone_color   ?? 'auto'
    return `lc:${shadow}:${mid}:${highlight}`
  }
  return 'none'
}

function effectivePitch(cfg: StyleConfig = props.styleConfig): number {
  return cfg.map_3d ? (cfg.map_pitch ?? 45) : 0
}

function effectiveBearing(cfg: StyleConfig = props.styleConfig): number {
  return cfg.map_3d ? (cfg.map_bearing ?? 0) : 0
}

type MapCameraSnapshot = {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}

function snapshotCurrentCamera(): MapCameraSnapshot | null {
  if (!mapInstance) return null
  const center = mapInstance.getCenter()
  return {
    center: [center.lng, center.lat],
    zoom: mapInstance.getZoom(),
    pitch: mapInstance.getPitch(),
    bearing: mapInstance.getBearing(),
  }
}

function restoreCameraAfterStyleReload(camera: MapCameraSnapshot | null) {
  if (!mapInstance) return
  if (camera) {
    styleReloadCameraHold = camera
    if (styleReloadCameraHoldTimer) clearTimeout(styleReloadCameraHoldTimer)
    styleReloadCameraHoldTimer = setTimeout(() => {
      styleReloadCameraHold = null
      styleReloadCameraHoldTimer = null
    }, 1_500)
    mapInstance.jumpTo(camera)
    return
  }
  if (canUseSavedCamera()) {
    mapInstance.jumpTo({
      zoom: correctedFrameZoom(props.styleConfig.map_zoom as number),
      center: props.styleConfig.map_center as [number, number],
      pitch: effectivePitch(),
      bearing: effectiveBearing(),
    })
  }
}

function publishDevCameraHandle() {
  if (!import.meta.dev || typeof window === 'undefined') return
  ;(window as unknown as {
    __RADMAPS_MAP_CAMERA__?: {
      get: () => MapCameraSnapshot | null
      jumpTo: (camera: Partial<MapCameraSnapshot>) => void
    }
  }).__RADMAPS_MAP_CAMERA__ = {
    get: snapshotCurrentCamera,
    jumpTo: (camera) => { mapInstance?.jumpTo(camera) },
  }
}

onMounted(async () => {
  await nextTick()
  if (!mapContainer.value) return

  // Register tile effect protocol unconditionally — cheap and avoids
  // conditional logic when the user enables duotone/posterize later.
  ensureTileEffectProtocol()
  if (styleUsesContours(props.styleConfig)) await ensureContourProtocol()
  const style = buildScaledMapStyle(props.styleConfig)

  // Restore saved zoom/center whenever they exist (user panned/zoomed before).
  // Zoom is corrected against the current frame width so the map composition
  // scales with the poster chrome when the editor viewport changes.
  const hasSavedView = canUseSavedCamera()
  if (hasSavedView && !props.styleConfig.map_editor_width) {
    sessionFrameWidth = mapContainer.value.offsetWidth
  }
  const savedZoom = hasSavedView ? correctedFrameZoom(props.styleConfig.map_zoom as number) : undefined

  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style,
    ...(hasSavedView
      ? { center: props.styleConfig.map_center as [number, number], zoom: savedZoom as number }
      : { bounds: props.map.bbox, fitBoundsOptions: { padding: Math.round(mapContainer.value.offsetHeight * (props.styleConfig.padding_factor ?? 0.15)) } }),
    pitch: effectivePitch(),
    bearing: effectiveBearing(),
    attributionControl: false,
    interactive: props.editable !== false && !(props.styleConfig.map_frozen),
  })
  publishDevCameraHandle()

  // Debounced view-change emitter so pan/zoom is auto-saved without flooding saves
  let viewSaveTimer: ReturnType<typeof setTimeout> | null = null
  let suppressViewSave = false
  function scheduleViewSave() {
    if (!mapInstance || !props.editable || suppressViewSave) return
    if (viewSaveTimer) clearTimeout(viewSaveTimer)
    viewSaveTimer = setTimeout(() => {
      if (!mapInstance || suppressViewSave) return
      const z = mapInstance.getZoom()
      const c = mapInstance.getCenter()
      const w = mapContainer.value?.offsetWidth ?? 0
      emit('view-changed', {
        map_zoom: z,
        map_center: [c.lng, c.lat],
        map_editor_width: w,
        map_pitch: mapInstance.getPitch(),
        map_bearing: mapInstance.getBearing(),
      })
    }, 800)
  }

  let resizeFrame = 0
  function syncCameraToFrame() {
    if (!mapInstance || !mapContainer.value) return

    suppressViewSave = true
    mapInstance.resize()

    if (styleReloadCameraHold) {
      mapInstance.jumpTo(styleReloadCameraHold)
    } else if (canUseSavedCamera()) {
      mapInstance.jumpTo({
        zoom: correctedFrameZoom(props.styleConfig.map_zoom as number),
        center: props.styleConfig.map_center as [number, number],
        pitch: effectivePitch(),
        bearing: effectiveBearing(),
      })
    } else if (!props.styleConfig.map_frozen) {
      mapInstance.fitBounds(props.map.bbox as maplibregl.LngLatBoundsLike, {
        padding: Math.round(mapContainer.value.offsetHeight * (props.styleConfig.padding_factor ?? 0.15)),
      })
    }

    applyViewportScaledLayerProperties()
    placePinMarkers()
    recomputeOverlays()
    window.setTimeout(() => { suppressViewSave = false }, 250)
  }

  mapInstance.on('load', () => {
    populateRouteSource()
    populateSegmentSources()
    placePinMarkers()
    setPaintBackground()
    apply3DTerrain()
    mapReady.value = true
    liveZoom.value = mapInstance!.getZoom()
    if (props.editable) initOverlayDrag()
    recomputeOverlays()
    markPrintRenderReady()
    if (props.deleteBrushActive) nextTick(activateDeleteBrush)
  })

  mapInstance.on('zoom', () => {
    liveZoom.value = mapInstance?.getZoom()
    recomputeOverlays()
  })

  mapInstance.on('move', recomputeOverlays)
  mapInstance.on('moveend', scheduleViewSave)

  resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(syncCameraToFrame)
  })
  resizeObserver.observe(mapContainer.value)
})

// ── Route smoothing (moving-window average) ───────────────────────────────────
// Chaikin corner-cutting is ineffective on dense GPS tracks because individual
// corner cuts are sub-pixel. A moving window average instead drags each point
// toward the mean of its neighborhood — this visibly rounds GPS jitter at any
// point density.

const SMOOTH_PRESETS = [
  null,                        // 0 — Off
  { radius: 2,  passes: 1 },  // 1
  { radius: 3,  passes: 2 },  // 2
  { radius: 4,  passes: 2 },  // 3
  { radius: 6,  passes: 3 },  // 4
  { radius: 8,  passes: 3 },  // 5
  { radius: 10, passes: 4 },  // 6
  { radius: 13, passes: 4 },  // 7
  { radius: 16, passes: 5 },  // 8
  { radius: 20, passes: 5 },  // 9
  { radius: 25, passes: 6 },  // 10 — Max
]

function smoothLine(coords: number[][], strength: number): number[][] {
  const preset = SMOOTH_PRESETS[strength]
  if (!preset || coords.length < 3) return coords

  const { radius, passes } = preset
  let pts = coords.map(c => c.slice())

  for (let p = 0; p < passes; p++) {
    const out = pts.map(c => c.slice())
    for (let i = 1; i < pts.length - 1; i++) {
      const lo = Math.max(0, i - radius)
      const hi = Math.min(pts.length - 1, i + radius)
      const n = hi - lo + 1
      out[i] = pts[i].map((_, dim) => {
        let sum = 0
        for (let j = lo; j <= hi; j++) sum += pts[j][dim]
        return sum / n
      })
    }
    pts = out
    // Always keep the start and finish points anchored
    pts[0] = coords[0].slice()
    pts[pts.length - 1] = coords[coords.length - 1].slice()
  }

  return pts
}

function smoothGeojson(geojson: GeoJSON.FeatureCollection, strength: number): GeoJSON.FeatureCollection {
  if (strength === 0) return geojson
  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const g = feature.geometry
      if (g.type === 'LineString') {
        return { ...feature, geometry: { ...g, coordinates: smoothLine(g.coordinates, strength) } }
      }
      if (g.type === 'MultiLineString') {
        return { ...feature, geometry: { ...g, coordinates: g.coordinates.map(line => smoothLine(line, strength)) } }
      }
      return feature
    }),
  }
}

function populateRouteSource() {
  if (!mapInstance) return
  const raw = props.map.geojson as GeoJSON.FeatureCollection
  const cropStart = props.styleConfig.route_crop_start ?? 0
  const cropEnd = props.styleConfig.route_crop_end ?? 100
  const deletedRanges = props.styleConfig.route_deleted_ranges ?? []
  const hasModification = cropStart > 0 || cropEnd < 100 || deletedRanges.length > 0
  const processed = hasModification
    ? excludeRangesFromRoute(raw, cropStart, cropEnd, deletedRanges)
    : raw

  const iterations = props.styleConfig.route_smooth ?? 0
  const geojson = smoothGeojson(processed, iterations)
  const src = mapInstance.getSource('route') as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(geojson)
  else mapInstance.addSource('route', { type: 'geojson', data: geojson })
}

function populateSegmentSources() {
  if (!mapInstance) return
  const handleFeatures: GeoJSON.Feature[] = []

  for (const seg of (props.styleConfig.trail_segments ?? [])) {
    if (!seg.visible) continue
    const sliced = sliceRouteByPercent(
      props.map.geojson as GeoJSON.FeatureCollection,
      seg.section_start,
      seg.section_end,
      props.styleConfig.route_deleted_ranges ?? [],
    )
    const src = mapInstance.getSource(trailSourceId(seg)) as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(sliced)

    // Collect start + end handle dots for this segment
    const coords = sliced.features.flatMap(feature => {
      const geometry = feature.geometry
      if (geometry.type === 'LineString') return geometry.coordinates
      if (geometry.type === 'MultiLineString') return geometry.coordinates.flat()
      return []
    })
    if (coords && coords.length >= 2) {
      handleFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: { color: seg.color } })
      handleFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] }, properties: { color: seg.color } })
    }
  }

  const handleSrc = mapInstance.getSource('segment-handles') as maplibregl.GeoJSONSource | undefined
  if (handleSrc) handleSrc.setData({ type: 'FeatureCollection', features: handleFeatures })
}

// ── Start / finish pin markers ────────────────────────────────────────────────
// The dot sits fixed at the route endpoint. Drag the SVG text label instead.
// The leader line stretches from the fixed dot to wherever the label is placed.

let startMarker: maplibregl.Marker | null = null
let finishMarker: maplibregl.Marker | null = null

function makePinDotEl(): HTMLElement {
  const color   = contrastSafePinColor.value
  const opacity = props.styleConfig.pin_opacity ?? 0.9
  const size    = Math.max(posterContentMinPx(10), (containerDims.value.h || 600) * 0.015)
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, 'border-radius:50%',
    `background:${color}`, `opacity:${opacity}`,
    'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
    'cursor:default', 'pointer-events:none',
  ].join(';')
  return el
}

function placePinMarkers() {
  if (!mapInstance) return

  startMarker?.remove(); startMarker = null
  finishMarker?.remove(); finishMarker = null

  const { start: routeStart, finish: routeFinish } = getRouteEndpoints(props.map.geojson as GeoJSON.FeatureCollection)

  const startCoord: [number, number] | null = routeStart
  const endCoord:   [number, number] | null = routeFinish

  if (startCoord && props.styleConfig.show_start_pin !== false) {
    startMarker = new maplibregl.Marker({ element: makePinDotEl(), anchor: 'center', draggable: false })
      .setLngLat(startCoord)
      .addTo(mapInstance)
  }

  if (endCoord && props.styleConfig.show_finish_pin !== false) {
    finishMarker = new maplibregl.Marker({ element: makePinDotEl(), anchor: 'center', draggable: false })
      .setLngLat(endCoord)
      .addTo(mapInstance)
  }

  nextTick(recomputeOverlays)
}

function apply3DTerrain() {
  if (!mapInstance) return
  const pitch = effectivePitch()
  const bearing = effectiveBearing()
  if (props.styleConfig.map_3d && mapInstance.getSource('mapbox-dem')) {
    mapInstance.setTerrain({
      source: 'mapbox-dem',
      exaggeration: props.styleConfig.terrain_exaggeration ?? 1.5,
    })
  } else {
    try { mapInstance.setTerrain(null as any) } catch {}
  }
  mapInstance.easeTo({ pitch, bearing, duration: props.editable === false ? 0 : 600 })
}

function setPaintBackground() {
  if (!mapInstance) return
  if (mapInstance.getLayer('background')) {
    mapInstance.setPaintProperty('background', 'background-color', mapBackgroundColor(props.styleConfig))
  }
}

// ── interactjs drag for text overlays ────────────────────────────────────────

async function initOverlayDrag() {
  if (!props.editable || !posterCanvasEl.value) return
  // Clean up previous instances
  for (const inst of interactInstances) inst.unset()
  interactInstances = []

  const { default: interact } = await import('interactjs')

  // Use the poster canvas as the bounds reference so overlays can be dragged
  // over the header and footer bands, not just the map area.
  const container = posterCanvasEl.value
  const overlays = container.querySelectorAll<HTMLElement>('.text-overlay.is-editable')
  overlays.forEach(el => {
    const inst = interact(el).draggable({
      allowFrom: '.overlay-move-handle',
      listeners: {
        move(event: { dx: number; dy: number; target: HTMLElement }) {
          const containerRect = container.getBoundingClientRect()
          const currentLeft = parseFloat(el.style.left) || 0
          const currentTop = parseFloat(el.style.top) || 0
          const newLeft = currentLeft + (event.dx / containerRect.width) * 100
          const newTop = currentTop + (event.dy / containerRect.height) * 100
          el.style.left = `${Math.max(0, Math.min(100, newLeft))}%`
          el.style.top = `${Math.max(0, Math.min(100, newTop))}%`
        },
        end(event: { target: HTMLElement }) {
          const id = event.target.dataset.overlayId
          if (!id) return
          // Read the logical % position accumulated by the move handler — NOT
          // getBoundingClientRect(), which includes the translateX offset applied
          // by overlayStyle() for center/right alignment and would cause a jump
          // when Vue re-renders the element back to those coordinates.
          const x = Math.round(parseFloat(el.style.left) || 0)
          const y = Math.round(parseFloat(el.style.top)  || 0)
          emit('overlay-moved', { id, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
          scheduleDeselect()
        },
      },
    })
    interactInstances.push(inst)
  })

  const assets = container.querySelectorAll<HTMLElement>('.image-asset.is-editable')
  assets.forEach(el => {
    const inst = interact(el).draggable({
      allowFrom: '.overlay-move-handle',
      listeners: {
        move(event: { dx: number; dy: number; target: HTMLElement }) {
          const containerRect = container.getBoundingClientRect()
          const currentLeft = parseFloat(el.style.left) || 0
          const currentTop = parseFloat(el.style.top) || 0
          const newLeft = currentLeft + (event.dx / containerRect.width) * 100
          const newTop = currentTop + (event.dy / containerRect.height) * 100
          el.style.left = `${Math.max(0, Math.min(100, newLeft))}%`
          el.style.top = `${Math.max(0, Math.min(100, newTop))}%`
        },
        end(event: { target: HTMLElement }) {
          const id = event.target.dataset.assetId
          if (!id) return
          const x = Math.round(parseFloat(el.style.left) || 0)
          const y = Math.round(parseFloat(el.style.top) || 0)
          emit('asset-moved', { id, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
          scheduleDeselect()
        },
      },
    })
    interactInstances.push(inst)
  })
}

// ── Style config watcher ──────────────────────────────────────────────────────

watch(
  () => props.styleConfig,
  async (newConfig, oldConfig) => {
    if (!mapInstance || !mapReady.value) return

    // Tile effect params are baked into tile URLs — require a full style rebuild
    const tileKeyChanged = effectiveTileKey(newConfig) !== effectiveTileKey(oldConfig ?? newConfig)

    // Segment source/layer structure changes when segment IDs are added/removed
    const newSegIds = (newConfig.trail_segments ?? []).map(s => s.id).join(',')
    const oldSegIds = (oldConfig?.trail_segments ?? []).map(s => s.id).join(',')
    const segStructureChanged = newSegIds !== oldSegIds

    const needsFullReload = tileKeyChanged || segStructureChanged || fullReloadKeysFor(newConfig).some(
      key => JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key]),
    )

    if (needsFullReload) {
      // Clear tile cache when effect params change so stale processed tiles aren't reused
      if (tileKeyChanged) _tileCache.clear()
      const cameraBeforeReload = snapshotCurrentCamera()
      mapReady.value = false
      if (styleUsesContours(newConfig)) await ensureContourProtocol()
      const newStyle = buildScaledMapStyle(newConfig)
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        populateSegmentSources()
        placePinMarkers()
        apply3DTerrain()
        // setStyle() can reset the viewport; layer toggles must not reframe the poster.
        restoreCameraAfterStyleReload(cameraBeforeReload)
        applyViewportScaledLayerProperties(newConfig)
        mapReady.value = true
        if (props.editable) nextTick(() => initOverlayDrag())
        nextTick(recomputeOverlays)
        if (props.deleteBrushActive) nextTick(activateDeleteBrush)
      })
      return
    }

    // Segment data changed (section_start/end, color, width, visibility, opacity)
    // — update GeoJSON sources and paint properties without any style reload
    if (JSON.stringify(newConfig.trail_segments) !== JSON.stringify(oldConfig?.trail_segments)) {
      populateSegmentSources()
      const newSegs = newConfig.trail_segments ?? []
      for (const seg of newSegs) {
        const lineId = `trail-seg-line-${seg.id}`
        const casingId = `trail-seg-casing-${seg.id}`
        if (!mapInstance.getLayer(lineId)) continue
        const vis = seg.visible ? 'visible' : 'none'
        mapInstance.setLayoutProperty(lineId, 'visibility', vis)
        mapInstance.setLayoutProperty(casingId, 'visibility', vis)
        if (seg.visible) {
          const width = seg.width ?? newConfig.route_width ?? 2
          mapInstance.setPaintProperty(lineId, 'line-color', seg.color)
          mapInstance.setPaintProperty(lineId, 'line-width', width)
          mapInstance.setPaintProperty(lineId, 'line-opacity', seg.opacity ?? 0.9)
          mapInstance.setPaintProperty(casingId, 'line-width', width + (newConfig.segment_casing_width ?? 3))
        }
      }
      nextTick(recomputeOverlays)
    }

    if (
      newConfig.map_pitch !== oldConfig?.map_pitch ||
      newConfig.map_bearing !== oldConfig?.map_bearing ||
      newConfig.terrain_exaggeration !== oldConfig?.terrain_exaggeration
    ) {
      apply3DTerrain()
    }

    if (newConfig.background_color !== oldConfig?.background_color) setPaintBackground()

    // Contour line-width fast path — avoids full reload for width multiplier changes
    if (newConfig.contour_minor_width !== oldConfig?.contour_minor_width) {
      if (mapInstance.getLayer('contours-minor'))
        mapInstance.setPaintProperty('contours-minor', 'line-width',
          contourMinorLineWidthExpression(newConfig))
      if (mapInstance.getLayer('contours-mid'))
        mapInstance.setPaintProperty('contours-mid', 'line-width',
          contourMidLineWidthExpression(newConfig))
    }
    if (newConfig.contour_major_width !== oldConfig?.contour_major_width) {
      if (mapInstance.getLayer('contours-major'))
        mapInstance.setPaintProperty('contours-major', 'line-width',
          contourMajorLineWidthExpression(newConfig))
    }

    // Raster layer paint-only updates (contrast / saturation / hue) —
    // these are MapLibre paint properties and don't need a tile re-fetch.
    const rasterLayerId = newConfig.preset === 'topographic' ? 'outdoors-tiles' : 'base-tiles'
    if (newConfig.tile_contrast !== oldConfig?.tile_contrast) {
      if (mapInstance.getLayer(rasterLayerId))
        mapInstance.setPaintProperty(rasterLayerId, 'raster-contrast', newConfig.tile_contrast ?? 0)
    }
    if (newConfig.tile_saturation !== oldConfig?.tile_saturation) {
      if (mapInstance.getLayer(rasterLayerId))
        mapInstance.setPaintProperty(rasterLayerId, 'raster-saturation', newConfig.tile_saturation ?? 0)
    }
    if (newConfig.tile_hue_rotate !== oldConfig?.tile_hue_rotate) {
      if (mapInstance.getLayer(rasterLayerId))
        mapInstance.setPaintProperty(rasterLayerId, 'raster-hue-rotate', newConfig.tile_hue_rotate ?? 0)
    }

    if (mapInstance.getLayer('route-line')) {
      if ((newConfig.route_color_mode ?? 'solid') !== 'gradient') {
        mapInstance.setPaintProperty('route-line', 'line-color', newConfig.route_color)
      }
      mapInstance.setPaintProperty('route-line', 'line-width', newConfig.route_width)
      mapInstance.setPaintProperty('route-line', 'line-opacity', newConfig.route_opacity)
      mapInstance.setPaintProperty('route-line-casing', 'line-width', newConfig.route_width + 4)
      mapInstance.setPaintProperty('route-line-casing', 'line-opacity', newConfig.route_opacity)
      mapInstance.setPaintProperty('route-line-casing', 'line-color', mapBackgroundColor(newConfig))
    }
    applyViewportScaledLayerProperties(newConfig)

    // Re-place pin markers when visibility or dot appearance changes
    if (
      newConfig.show_start_pin    !== oldConfig?.show_start_pin    ||
      newConfig.show_finish_pin   !== oldConfig?.show_finish_pin   ||
      newConfig.pin_color         !== oldConfig?.pin_color         ||
      newConfig.pin_opacity       !== oldConfig?.pin_opacity       ||
      newConfig.route_color       !== oldConfig?.route_color       ||
      newConfig.label_text_color  !== oldConfig?.label_text_color
    ) {
      placePinMarkers()
    }

    // Recompute SVG overlay when label-affecting config changes
    if (
      newConfig.trail_label_style   !== oldConfig?.trail_label_style   ||
      newConfig.start_pin_label     !== oldConfig?.start_pin_label     ||
      newConfig.finish_pin_label    !== oldConfig?.finish_pin_label    ||
      newConfig.pin_font_family     !== oldConfig?.pin_font_family     ||
      JSON.stringify(newConfig.poster_text_overrides) !== JSON.stringify(oldConfig?.poster_text_overrides) ||
      JSON.stringify(newConfig.start_label_lnglat)  !== JSON.stringify(oldConfig?.start_label_lnglat)  ||
      JSON.stringify(newConfig.finish_label_lnglat) !== JSON.stringify(oldConfig?.finish_label_lnglat)
    ) {
      nextTick(recomputeOverlays)
    }
  },
  { deep: true },
)

watch(
  () => props.styleConfig.route_smooth,
  () => { if (mapInstance && mapReady.value) populateRouteSource() },
)

watch(
  [() => props.styleConfig.route_crop_start, () => props.styleConfig.route_crop_end],
  () => { if (mapInstance && mapReady.value) populateRouteSource() },
)

watch(
  () => props.styleConfig.route_deleted_ranges,
  (newRanges, oldRanges) => {
    if (!mapInstance || !mapReady.value) return
    const isGradient = (props.styleConfig.route_color_mode ?? 'solid') === 'gradient'
    const hadRanges = (oldRanges ?? []).length > 0
    const hasRanges = (newRanges ?? []).length > 0
    // In gradient mode, crossing the empty↔non-empty boundary changes both the
    // source lineMetrics flag and the layer paint (line-gradient vs line-color).
    // A full style reload is required — same path as graph full-reload dependencies.
    if (isGradient && hadRanges !== hasRanges) {
      const cameraBeforeReload = snapshotCurrentCamera()
      mapReady.value = false
      const newStyle = buildScaledMapStyle(props.styleConfig)
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        populateSegmentSources()
        placePinMarkers()
        apply3DTerrain()
        restoreCameraAfterStyleReload(cameraBeforeReload)
        applyViewportScaledLayerProperties()
        mapReady.value = true
        if (props.editable) nextTick(() => initOverlayDrag())
        nextTick(recomputeOverlays)
        if (props.deleteBrushActive) nextTick(activateDeleteBrush)
      })
      return
    }
    populateRouteSource()
    populateSegmentSources()
    if (props.deleteBrushActive) {
      rebuildBrushPointCache()
      updateDeleteBrushPreviewSource()
    }
  },
  { deep: true },
)

// ── Brush delete mode: paint-select route indexes, preview, then apply ────────

function isBrushSelectableIndex(index: number, total: number): boolean {
  const pct = (index / Math.max(total - 1, 1)) * 100
  const cropStart = props.styleConfig.route_crop_start ?? 0
  const cropEnd = props.styleConfig.route_crop_end ?? 100
  if (pct < cropStart || pct > cropEnd) return false
  return !(props.styleConfig.route_deleted_ranges ?? []).some(range => pct >= range.start && pct <= range.end)
}

function rebuildBrushPointCache() {
  if (!mapInstance) return
  const coords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
  brushPointCache = coords
    .map((coord, index) => ({ coord, index }))
    .filter(({ index }) => isBrushSelectableIndex(index, coords.length))
    .map(({ coord, index }) => {
      const p = mapInstance!.project([coord[0], coord[1]])
      return { index, x: p.x, y: p.y }
    })

  const byIndex = new Map(brushPointCache.map(point => [point.index, point]))
  brushSegmentCache = []
  for (let index = 0; index < coords.length - 1; index++) {
    if (distanceMeters(coords[index], coords[index + 1]) > BRUSH_ROUTE_SEGMENT_MAX_METERS) continue
    const a = byIndex.get(index)
    const b = byIndex.get(index + 1)
    if (!a || !b) continue
    brushSegmentCache.push({
      startIndex: index,
      endIndex: index + 1,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
    })
  }
}

function ensureDeleteBrushPreviewLayer() {
  if (!mapInstance) return
  if (!mapInstance.getSource(BRUSH_PREVIEW_SOURCE_ID)) {
    mapInstance.addSource(BRUSH_PREVIEW_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!mapInstance.getLayer(BRUSH_PREVIEW_CASING_LAYER_ID)) {
    mapInstance.addLayer({
      id: BRUSH_PREVIEW_CASING_LAYER_ID,
      type: 'line',
      source: BRUSH_PREVIEW_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': props.styleConfig.background_color ?? '#FFFFFF',
        'line-width': (props.styleConfig.route_width ?? 3) + 6,
        'line-opacity': 0.92,
      },
    })
  }
  if (!mapInstance.getLayer(BRUSH_PREVIEW_LAYER_ID)) {
    mapInstance.addLayer({
      id: BRUSH_PREVIEW_LAYER_ID,
      type: 'line',
      source: BRUSH_PREVIEW_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#EF4444',
        'line-width': (props.styleConfig.route_width ?? 3) + 2,
        'line-opacity': 0.96,
      },
    })
  }
}

function removeDeleteBrushPreviewLayer() {
  if (!mapInstance) return
  if (mapInstance.getLayer(BRUSH_PREVIEW_LAYER_ID)) mapInstance.removeLayer(BRUSH_PREVIEW_LAYER_ID)
  if (mapInstance.getLayer(BRUSH_PREVIEW_CASING_LAYER_ID)) mapInstance.removeLayer(BRUSH_PREVIEW_CASING_LAYER_ID)
  if (mapInstance.getSource(BRUSH_PREVIEW_SOURCE_ID)) mapInstance.removeSource(BRUSH_PREVIEW_SOURCE_ID)
}

function updateDeleteBrushPreviewSource() {
  if (!mapInstance) return
  const src = mapInstance.getSource(BRUSH_PREVIEW_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(routeRangesToGeojson(
    props.map.geojson as GeoJSON.FeatureCollection,
    brushPreviewRanges.value,
    props.styleConfig.route_crop_start ?? 0,
    props.styleConfig.route_crop_end ?? 100,
  ))
}

function pointToSegmentDistanceSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const ex = px - x1
    const ey = py - y1
    return ex * ex + ey * ey
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  const x = x1 + t * dx
  const y = y1 + t * dy
  const ex = px - x
  const ey = py - y
  return ex * ex + ey * ey
}

function selectDeleteBrushPoint(x: number, y: number, selected: Set<number>) {
  const radius = props.deleteBrushSize ?? 8
  const radiusSq = radius * radius

  // Select rendered route geometry, not standalone coordinates. Selecting points
  // can delete tiny disconnected coordinate runs that never read as a red preview
  // line, which breaks the "red preview equals applied deletion" contract.
  for (const segment of brushSegmentCache) {
    if (pointToSegmentDistanceSq(x, y, segment.x1, segment.y1, segment.x2, segment.y2) <= radiusSq) {
      selected.add(segment.startIndex)
      selected.add(segment.endIndex)
    }
  }
}

function refreshDeleteBrushRanges(next: Set<number>) {
  const coords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
  brushSelectedIndexes.value = next
  brushPreviewRanges.value = deletedRangesFromRouteIndexes(
    next,
    coords,
    0,
    0,
    BRUSH_ROUTE_SEGMENT_MAX_METERS,
  )
  updateDeleteBrushPreviewSource()
}

function addDeleteBrushSelection(x: number, y: number) {
  const next = new Set(brushSelectedIndexes.value)
  if (lastBrushPoint) {
    const dx = x - lastBrushPoint.x
    const dy = y - lastBrushPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const step = Math.max(2, (props.deleteBrushSize ?? 8) * 0.45)
    const samples = Math.max(1, Math.ceil(distance / step))
    for (let i = 1; i <= samples; i++) {
      const t = i / samples
      selectDeleteBrushPoint(lastBrushPoint.x + dx * t, lastBrushPoint.y + dy * t, next)
    }
  } else {
    selectDeleteBrushPoint(x, y, next)
  }
  lastBrushPoint = { x, y }
  refreshDeleteBrushRanges(next)
}

function onDeleteBrushMouseDown(e: maplibregl.MapMouseEvent) {
  if (!props.deleteBrushActive) return
  e.preventDefault()
  brushPointerDown.value = true
  brushCursor.value = { x: e.point.x, y: e.point.y }
  lastBrushPoint = null
  addDeleteBrushSelection(e.point.x, e.point.y)
}

function onDeleteBrushMouseMove(e: maplibregl.MapMouseEvent) {
  if (!props.deleteBrushActive) return
  brushCursor.value = { x: e.point.x, y: e.point.y }
  if (brushPointerDown.value) addDeleteBrushSelection(e.point.x, e.point.y)
}

function onDeleteBrushMouseUp() {
  brushPointerDown.value = false
  lastBrushPoint = null
}

function onDeleteBrushKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') cancelDeleteBrush()
}

function setBrushInteractions(enabled: boolean) {
  if (!mapInstance) return
  if (enabled && !props.styleConfig.map_frozen) {
    mapInstance.dragPan.enable()
    mapInstance.scrollZoom.enable()
    mapInstance.doubleClickZoom.enable()
    mapInstance.touchZoomRotate.enable()
    mapInstance.keyboard.enable()
    return
  }
  mapInstance.dragPan.disable()
  mapInstance.scrollZoom.disable()
  mapInstance.doubleClickZoom.disable()
  mapInstance.touchZoomRotate.disable()
  mapInstance.keyboard.disable()
}

function activateDeleteBrush() {
  if (!mapInstance || !mapReady.value) return
  ensureDeleteBrushPreviewLayer()
  rebuildBrushPointCache()
  updateDeleteBrushPreviewSource()
  setBrushInteractions(false)
  mapInstance.getCanvas().style.cursor = 'none'
  mapInstance.on('mousedown', onDeleteBrushMouseDown)
  mapInstance.on('mousemove', onDeleteBrushMouseMove)
  mapInstance.on('mouseup', onDeleteBrushMouseUp)
  document.addEventListener('mouseup', onDeleteBrushMouseUp)
  document.addEventListener('keydown', onDeleteBrushKeydown)
}

function deactivateDeleteBrush() {
  if (!mapInstance) return
  mapInstance.getCanvas().style.cursor = ''
  mapInstance.off('mousedown', onDeleteBrushMouseDown)
  mapInstance.off('mousemove', onDeleteBrushMouseMove)
  mapInstance.off('mouseup', onDeleteBrushMouseUp)
  document.removeEventListener('mouseup', onDeleteBrushMouseUp)
  document.removeEventListener('keydown', onDeleteBrushKeydown)
  removeDeleteBrushPreviewLayer()
  setBrushInteractions(true)
  brushPointerDown.value = false
  brushCursor.value = null
  brushSelectedIndexes.value = new Set()
  brushPreviewRanges.value = []
  brushPointCache = []
  brushSegmentCache = []
  lastBrushPoint = null
}

function applyDeleteBrush() {
  const ranges = brushPreviewRanges.value
  if (!ranges.length) return
  emit('route-delete-brush-applied', { ranges })
}

function cancelDeleteBrush() {
  emit('route-delete-brush-cancelled')
}

watch(
  () => props.deleteBrushActive,
  (active, wasActive) => {
    if (wasActive) deactivateDeleteBrush()
    if (active) nextTick(activateDeleteBrush)
  },
)

watch(
  () => props.deleteBrushSize,
  () => {
    if (!props.deleteBrushActive) return
    updateDeleteBrushPreviewSource()
  },
)

// ── Plot mode: crosshair + ghost marker + click handler ───────────────────────

function nearestRouteCoord(lngLat: maplibregl.LngLat): [number, number] {
  let bestIdx = 0, bestDist = Infinity
  for (let i = 0; i < plotRouteCoords.length; i++) {
    const dx = plotRouteCoords[i][0] - lngLat.lng
    const dy = plotRouteCoords[i][1] - lngLat.lat
    const d = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  return [plotRouteCoords[bestIdx][0], plotRouteCoords[bestIdx][1]]
}

function onPlotMouseMove(e: maplibregl.MapMouseEvent) {
  if (!plotGhostMarker || plotRouteCoords.length === 0) return
  cancelAnimationFrame(plotAnimFrame)
  plotAnimFrame = requestAnimationFrame(() => {
    const [lng, lat] = nearestRouteCoord(e.lngLat)
    plotGhostMarker!.setLngLat([lng, lat])
  })
}

function onPlotClick(e: maplibregl.MapMouseEvent) {
  if (!props.plotMode || !mapInstance) return
  const pct = findRoutePercent([e.lngLat.lng, e.lngLat.lat], props.map.geojson as GeoJSON.FeatureCollection)
  emit('segment-plotted', { segId: props.plotMode.segId, field: props.plotMode.field, pct })
}

function onPlotKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('plot-cancelled')
}

watch(
  () => props.plotMode,
  (mode, prevMode) => {
    if (!mapInstance) return

    // Tear down previous plot mode
    if (prevMode) {
      mapInstance.getCanvas().style.cursor = ''
      mapInstance.off('mousemove', onPlotMouseMove)
      mapInstance.off('click', onPlotClick)
      document.removeEventListener('keydown', onPlotKeydown)
      cancelAnimationFrame(plotAnimFrame)
      if (plotGhostMarker) { plotGhostMarker.remove(); plotGhostMarker = null }
    }

    if (!mode) return

    // Pre-compute route coords for fast nearest-point lookup
    plotRouteCoords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
    if (plotRouteCoords.length === 0) return

    // Position ghost marker at current segment position
    const pct = mode.field === 'start'
      ? (mode.segId === 'route-crop'
          ? (props.styleConfig.route_crop_start ?? 0)
          : (props.styleConfig.trail_segments ?? []).find(s => s.id === mode.segId)?.section_start ?? 0)
      : (mode.segId === 'route-crop'
          ? (props.styleConfig.route_crop_end ?? 100)
          : (props.styleConfig.trail_segments ?? []).find(s => s.id === mode.segId)?.section_end ?? 100)
    const idx = Math.round((pct / 100) * Math.max(plotRouteCoords.length - 1, 0))
    const initCoord = plotRouteCoords[Math.min(idx, plotRouteCoords.length - 1)]

    // Create ghost marker element
    const isDeleteMode = mode.segId === 'route-delete-pending'
    const isStart = mode.field === 'start'
    const markerColor = isDeleteMode ? '#EA580C' : (isStart ? '#2D6A4F' : '#C1121F')
    const el = document.createElement('div')
    el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${markerColor};box-shadow:0 1px 4px rgba(0,0,0,0.4);pointer-events:none;`
    plotGhostMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([initCoord[0], initCoord[1]])
      .addTo(mapInstance)

    mapInstance.getCanvas().style.cursor = 'crosshair'
    mapInstance.on('mousemove', onPlotMouseMove)
    mapInstance.on('click', onPlotClick)
    document.addEventListener('keydown', onPlotKeydown)
  },
)

watch(
  () => props.styleConfig.padding_factor,
  (val) => {
    if (!mapInstance || !mapReady.value || !mapContainer.value) return
    // Padding changes only refits when not frozen — frozen view holds its position
    if (props.styleConfig.map_frozen) return
    mapInstance.fitBounds(props.map.bbox as maplibregl.LngLatBoundsLike, {
      padding: Math.round(mapContainer.value.offsetHeight * (val ?? 0.15)),
    })
  },
)

// ── Freeze / unfreeze watcher ─────────────────────────────────────────────────
// Enables / disables interactive pan+zoom when map_frozen changes externally
// (e.g. from StylePanel or restored from DB on page load).
// Also jumps to saved position when frozen state is restored from DB — the map
// may have initialized with bounds before the DB record loaded, so we need
// to explicitly reposition it here.

watch(
  () => props.styleConfig.map_frozen,
  (frozen) => {
    if (!mapInstance || !mapReady.value) return
    if (frozen) {
      mapInstance.dragPan.disable()
      mapInstance.scrollZoom.disable()
      mapInstance.doubleClickZoom.disable()
      mapInstance.touchZoomRotate.disable()
      mapInstance.keyboard.disable()
      if (canUseSavedCamera()) {
        mapInstance.jumpTo({
          zoom: correctedFrameZoom(props.styleConfig.map_zoom as number),
          center: props.styleConfig.map_center as [number, number],
        })
      }
    } else {
      mapInstance.dragPan.enable()
      mapInstance.scrollZoom.enable()
      mapInstance.doubleClickZoom.enable()
      mapInstance.touchZoomRotate.enable()
      mapInstance.keyboard.enable()
    }
  },
)

// ── Freeze / unfreeze API (called by FreezeControl.vue) ───────────────────────

function freezeView() {
  if (!mapInstance) return
  const zoom = mapInstance.getZoom()
  const center = mapInstance.getCenter()
  // Clear tile cache — we're establishing a new fixed tile set
  _tileCache.clear()
  mapInstance.dragPan.disable()
  mapInstance.scrollZoom.disable()
  mapInstance.doubleClickZoom.disable()
  mapInstance.touchZoomRotate.disable()
  mapInstance.keyboard.disable()
  emit('freeze-changed', {
    map_frozen: true,
    map_zoom: zoom,
    map_center: [center.lng, center.lat],
    map_editor_width: mapContainer.value?.offsetWidth ?? 0,
    map_pitch: mapInstance.getPitch(),
    map_bearing: mapInstance.getBearing(),
  })
}

function unfreezeView() {
  if (!mapInstance) return
  mapInstance.dragPan.enable()
  mapInstance.scrollZoom.enable()
  mapInstance.doubleClickZoom.enable()
  mapInstance.touchZoomRotate.enable()
  mapInstance.keyboard.enable()
  emit('freeze-changed', { map_frozen: false })
}

function resetViewToRoute() {
  if (!mapInstance || !mapContainer.value) {
    emit('freeze-changed', {
      map_frozen: false,
      map_zoom: undefined,
      map_center: undefined,
      map_editor_width: undefined,
      map_pitch: 0,
      map_bearing: 0,
    })
    return
  }

  mapInstance.dragPan.enable()
  mapInstance.scrollZoom.enable()
  mapInstance.doubleClickZoom.enable()
  mapInstance.touchZoomRotate.enable()
  mapInstance.keyboard.enable()

  let emitted = false
  const emitCamera = () => {
    if (emitted || !mapInstance) return
    emitted = true
    const zoom = mapInstance.getZoom()
    const center = mapInstance.getCenter()
    emit('freeze-changed', {
      map_frozen: false,
      map_zoom: zoom,
      map_center: [center.lng, center.lat],
      map_editor_width: mapContainer.value?.offsetWidth ?? 0,
      map_pitch: mapInstance.getPitch(),
      map_bearing: mapInstance.getBearing(),
    })
  }

  mapInstance.once('moveend', emitCamera)
  mapInstance.fitBounds(props.map.bbox as maplibregl.LngLatBoundsLike, {
    padding: Math.round(mapContainer.value.offsetHeight * (props.styleConfig.padding_factor ?? 0.15)),
    pitch: 0,
    bearing: 0,
    duration: props.editable === false ? 0 : 250,
  } as maplibregl.FitBoundsOptions)
  window.setTimeout(emitCamera, 320)
}

defineExpose({ freezeView, unfreezeView, resetViewToRoute })

// Re-init drag when text_overlays change (new overlays added)
watch(
  () => [(props.styleConfig.text_overlays ?? []).length, (props.styleConfig.image_overlays ?? []).length],
  () => {
    if (props.editable && mapReady.value) nextTick(() => initOverlayDrag())
  },
)

onUnmounted(() => {
  for (const inst of interactInstances) inst.unset()
  resizeObserver?.disconnect()
  deactivateDeleteBrush()
  startMarker?.remove()
  finishMarker?.remove()
  plotGhostMarker?.remove()
  document.removeEventListener('keydown', onPlotKeydown)
  cancelAnimationFrame(plotAnimFrame)
  if (styleReloadCameraHoldTimer) clearTimeout(styleReloadCameraHoldTimer)
  mapInstance?.remove()
  mapInstance = null
  if (import.meta.dev && typeof window !== 'undefined') {
    delete (window as unknown as {
      __RADMAPS_MAP_CAMERA__?: {
        get: () => MapCameraSnapshot | null
        jumpTo: (camera: Partial<MapCameraSnapshot>) => void
      }
    }).__RADMAPS_MAP_CAMERA__
  }
})
</script>

<style scoped>
.poster-canvas {
  container-type: size;
  color: var(--composition-ink, currentColor);
}

.radmaps-print-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: block;
}

.poster-canvas--print {
  box-shadow: none !important;
}

.poster-stats {
  display: flex;
  align-items: flex-start;
  gap: 2.4cqw;
}

.stat-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stat-block--coords {
  gap: 0;
}

.poster-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4cqh;
  flex-shrink: 0;
}

.mark-svg {
  width: 4cqh;
  height: 4cqh;
}

.poster-composition {
  isolation: isolate;
}

.composition-paper-texture,
.composition-grid-overlay,
.composition-star-field,
.composition-side-rail {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.composition-paper-texture {
  z-index: 1;
  opacity: 0.22;
  background-image:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 5px),
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.18), transparent 20%),
    radial-gradient(circle at 82% 76%, rgba(0, 0, 0, 0.07), transparent 24%);
  mix-blend-mode: multiply;
}

.composition-grid-overlay {
  z-index: 4;
  background-size: 8cqw 8cqw;
}

.composition-grid-overlay--map {
  inset: 0;
}

.composition-star-field {
  z-index: 1;
  opacity: 0.7;
  background-image:
    radial-gradient(circle at 16% 18%, currentColor 0 0.08cqw, transparent 0.1cqw),
    radial-gradient(circle at 74% 11%, currentColor 0 0.06cqw, transparent 0.09cqw),
    radial-gradient(circle at 88% 34%, currentColor 0 0.07cqw, transparent 0.1cqw),
    radial-gradient(circle at 28% 69%, currentColor 0 0.06cqw, transparent 0.09cqw),
    radial-gradient(circle at 54% 82%, currentColor 0 0.05cqw, transparent 0.08cqw);
}

.composition-side-rail {
  z-index: 3;
  right: auto;
  width: 7cqw;
  border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  opacity: 0.72;
}

.composition-side-rail-label {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 7cqw;
  padding: 2cqh 0;
  color: currentColor;
  opacity: 0.32;
  transform: rotate(180deg);
  transform-origin: center;
  font-family: var(--composition-body-font, inherit);
  font-size: 0.82cqh;
  font-weight: 700;
  letter-spacing: 0.32em;
  line-height: 1;
  overflow: hidden;
  white-space: nowrap;
  writing-mode: vertical-rl;
  pointer-events: none;
}

.composition-kicker,
.composition-meta-line,
.composition-footer-note {
  position: relative;
  z-index: 2;
  width: 100%;
  text-transform: uppercase;
  pointer-events: none;
}

.composition-kicker {
  font-size: 0.88cqh;
  line-height: 1.2;
}

.composition-meta-line {
  font-size: 0.72cqh;
  line-height: 1.3;
  margin-top: -0.2cqh;
}

.poster-footer-rule {
  position: absolute;
  top: 0;
  height: 1px;
  pointer-events: none;
  z-index: 1;
}

.composition-footer-note {
  position: absolute;
  left: var(--composition-rule-left);
  right: var(--composition-rule-right);
  top: 0.65cqh;
  overflow: hidden;
  color: currentColor;
  font-family: var(--composition-body-font, inherit);
  font-size: 0.62cqh;
  font-weight: 600;
  letter-spacing: 0.22em;
  line-height: 1;
  opacity: 0.36;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster-composition--modernist-block .composition-side-rail {
  background: var(--label-bg-color, currentColor);
  opacity: 1;
  mix-blend-mode: normal;
}

.poster-composition--modernist-block .composition-side-rail--left {
  left: 0;
  right: auto;
  width: var(--composition-rule-left);
  border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-left: 0;
}

.poster-composition--modernist-block .composition-side-rail--right {
  left: auto;
  right: 0;
  width: var(--composition-rule-right);
  border-right: 0;
  border-left: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}

.poster-composition--modernist-block .composition-side-rail-label--left {
  left: 0;
  right: auto;
  width: var(--composition-rule-left);
}

.poster-composition--splits-grid .poster-footer-rule,
.poster-composition--blueprint-strava .poster-footer-rule,
.poster-composition--bib-numerals .poster-footer-rule {
  height: 0;
  background: transparent !important;
  border-top: 1px dashed currentColor;
}

.poster-composition--riso-stack .poster-header::before {
  content: "";
  position: absolute;
  top: 3cqh;
  right: 7cqw;
  width: 7cqw;
  height: 7cqw;
  background: var(--water-color, currentColor);
  opacity: 0.85;
  mix-blend-mode: multiply;
}

.poster-composition--botanical-plate .poster-header::before,
.poster-composition--botanical-plate .poster-header::after {
  content: "";
  position: absolute;
  top: calc(2.8cqh + var(--print-bleed, 0px));
  width: 6cqw;
  height: 1px;
  background: currentColor;
  opacity: 0.22;
}

.poster-composition--botanical-plate .poster-header::before {
  left: 7cqw;
}

.poster-composition--botanical-plate .poster-header::after {
  right: 7cqw;
}

/* Editable text: subtle hover indicator */
.editable-text:hover {
  outline: 1.5px dashed rgba(45, 106, 79, 0.35);
  border-radius: 2px;
  cursor: text;
}
.editable-text:focus {
  outline: 1.5px dashed rgba(45, 106, 79, 0.6);
  border-radius: 2px;
}
.editable-text.is-selected-text {
  outline: 1.5px solid rgba(45, 106, 79, 0.72);
  border-radius: 2px;
}
.editable-text[contenteditable="true"] {
  -webkit-user-select: text;
  pointer-events: auto;
  user-select: text;
}
.stat-custom-text {
  display: block;
}

/* Text overlay layer */
.overlay-layer,
.asset-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 25;
}

.image-asset {
  position: absolute;
}

.image-asset img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.image-asset.is-editable {
  pointer-events: auto !important;
  border-radius: 2px;
  outline: 1.5px dashed transparent;
  transition: outline-color 0.2s;
}

.text-overlay.is-editable {
  pointer-events: auto !important;
  cursor: text !important;
  position: relative;
  border-radius: 2px;
  outline: 1.5px dashed transparent;
  transition: outline-color 0.2s;
}

.overlay-content {
  display: inline-block;
  min-width: 1.5cqh;
  min-height: 1em;
  outline: none;
  white-space: pre;
}

.text-overlay.is-editable:hover,
.image-asset.is-editable:hover {
  outline-color: rgba(45, 106, 79, 0.35);
}

.text-overlay.is-editable.is-selected,
.image-asset.is-editable.is-selected {
  outline-color: rgba(45, 106, 79, 0.65);
}

/* Delete + resize buttons: hidden by default, revealed on hover/selected */
.overlay-move-handle,
.overlay-delete-btn,
.overlay-resize-handle {
  opacity: 0;
  transform: scale(0.6);
  pointer-events: none !important;
  transition: opacity 0.18s, transform 0.18s;
}

.text-overlay.is-editable:hover .overlay-move-handle,
.text-overlay.is-editable:hover .overlay-delete-btn,
.text-overlay.is-editable:hover .overlay-resize-handle,
.text-overlay.is-editable.is-selected .overlay-move-handle,
.text-overlay.is-editable.is-selected .overlay-delete-btn,
.text-overlay.is-editable.is-selected .overlay-resize-handle,
.image-asset.is-editable:hover .overlay-move-handle,
.image-asset.is-editable:hover .overlay-delete-btn,
.image-asset.is-editable:hover .overlay-resize-handle,
.image-asset.is-editable.is-selected .overlay-move-handle,
.image-asset.is-editable.is-selected .overlay-delete-btn,
.image-asset.is-editable.is-selected .overlay-resize-handle {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto !important;
}

.asset-quality-badge {
  position: absolute;
  left: 50%;
  bottom: -24px;
  transform: translateX(-50%);
  white-space: nowrap;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  line-height: 1;
  font-family: system-ui, sans-serif;
  font-weight: 700;
  background: rgba(28, 25, 23, 0.84);
  color: white;
  border: 1px solid rgba(255,255,255,0.75);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  pointer-events: none;
}

.asset-quality-excellent,
.asset-quality-good {
  background: rgba(45, 106, 79, 0.9);
}

.asset-quality-warning {
  background: rgba(180, 83, 9, 0.92);
}

.asset-quality-poor {
  background: rgba(185, 28, 28, 0.92);
}

.overlay-move-handle {
  position: absolute;
  top: -9px;
  left: -9px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(28, 25, 23, 0.78);
  color: white;
  border: 1.5px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}

/* Delete button — top-right corner */
.overlay-delete-btn {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.92);
  color: white;
  border: 1.5px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
.overlay-delete-btn:hover {
  background: rgb(220, 38, 38);
  transform: scale(1.1) !important;
}

/* Resize handle — bottom-right corner */
.overlay-resize-handle {
  position: absolute;
  bottom: -9px;
  right: -9px;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: rgba(45, 106, 79, 0.88);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: se-resize;
  touch-action: none;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  border: 1.5px solid white;
}
.overlay-resize-handle:hover {
  background: rgba(35, 88, 64, 0.95);
}

/* Trail legend */
.trail-legend {
  pointer-events: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.8cqw;
}

.legend-swatch {
  width: 2.2cqw;
  height: 0.35cqh;
  border-radius: 2px;
  flex-shrink: 0;
}

.logo-map {
  pointer-events: none;
}

/* ── Top-right poster controls group (undo/redo + zoom lock) ───────────────── */
.poster-controls {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.55;
  transition: opacity 0.2s ease;
  pointer-events: auto;
}
.poster-controls.map-hovered {
  opacity: 0.9;
}
.poster-controls:hover {
  opacity: 1;
}

/* Shared pill for undo/redo buttons */
.control-pill {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6B7280;
  transition: background 0.12s, color 0.12s;
}
.control-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
  color: #1C1917;
}
.control-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.control-divider {
  width: 1px;
  height: 14px;
  background: rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}
</style>
