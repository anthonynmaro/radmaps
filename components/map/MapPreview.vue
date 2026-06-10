<template>
  <!-- Outer: fills parent, centers the poster canvas -->
  <div
    :class="previewRootClass"
    :style="previewRootStyle"
  >
    <InlineTextToolbar
      v-if="editable && activeToolbarState && (!chromeGridRendering || activeTextTarget?.type === 'overlay' || (guidedPosterEditor && activeTextTarget?.type === 'slot'))"
      :label="activeToolbarState.label"
      :anchor-rect="activeTextAnchor"
      :font-family="activeToolbarState.fontFamily"
      :color="activeToolbarState.color"
      :background-color="activeToolbarState.backgroundColor"
      :supports-highlight="activeToolbarState.supportsHighlight"
      :font-size-pt="activeToolbarState.fontSizePt"
      :align="activeToolbarState.align"
      :opacity="activeToolbarState.opacity"
      :bold="activeToolbarState.bold"
      :italic="activeToolbarState.italic"
      :can-reset="activeToolbarState.canReset"
      :text-value="activeToolbarState.textValue"
      @patch="applyToolbarPatch"
      @reset="resetActiveText"
      @done="finishActiveTextEdit"
    />

    <div
      v-if="chromeToolbarVisible && activeChromeBlock && !chromeMobile"
      ref="chromeToolbarEl"
      class="chrome-selection-toolbar"
      :class="`chrome-selection-toolbar--${activeChromeBand}`"
      :style="chromeToolbarFloatingStyle"
      data-testid="chrome-selection-toolbar"
      @pointerdown.stop
      @click.stop
    >
      <span class="chrome-toolbar-kind">{{ chromeBlockLabel(activeChromeBlock) }}</span>
      <span class="chrome-toolbar-divider" />
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeBold }" title="Bold" @click="toggleChromeBold">B</button>
      <button class="chrome-toolbar-btn chrome-toolbar-btn--italic" :class="{ 'is-active': activeChromeItalic }" title="Italic" @click="toggleChromeItalic">I</button>
      <button class="chrome-toolbar-btn" title="Smaller" @click="nudgeChromeScale(-0.05)">A-</button>
      <button class="chrome-toolbar-btn" title="Larger" @click="nudgeChromeScale(0.05)">A+</button>
      <label class="chrome-toolbar-color" title="Text color">
        <input type="color" :value="activeChromeColor" @input="setChromeColor(($event.target as HTMLInputElement).value)" />
      </label>
      <span class="chrome-toolbar-divider" />
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeAlign === 'left' }" title="Align left" aria-label="Align left" @click="setChromeAlign('left')">
        <span class="chrome-align-icon chrome-align-icon--left" aria-hidden="true" />
      </button>
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeAlign === 'center' }" title="Align center" aria-label="Align center" @click="setChromeAlign('center')">
        <span class="chrome-align-icon chrome-align-icon--center" aria-hidden="true" />
      </button>
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeAlign === 'right' }" title="Align right" aria-label="Align right" @click="setChromeAlign('right')">
        <span class="chrome-align-icon chrome-align-icon--right" aria-hidden="true" />
      </button>
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeValign === 'top' }" title="Align top" aria-label="Align top" @click="setChromeValign('top')">
        <span class="chrome-valign-icon chrome-valign-icon--top" aria-hidden="true" />
      </button>
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeValign === 'center' }" title="Align middle" aria-label="Align middle" @click="setChromeValign('center')">
        <span class="chrome-valign-icon chrome-valign-icon--middle" aria-hidden="true" />
      </button>
      <button class="chrome-toolbar-btn" :class="{ 'is-active': activeChromeValign === 'bottom' }" title="Align bottom" aria-label="Align bottom" @click="setChromeValign('bottom')">
        <span class="chrome-valign-icon chrome-valign-icon--bottom" aria-hidden="true" />
      </button>
      <span class="chrome-toolbar-divider" />
      <button
        class="chrome-toolbar-btn"
        :class="{ 'is-active': chromePaddingPanelOpen }"
        title="Spacing"
        aria-label="Spacing"
        @click="chromePaddingPanelOpen = !chromePaddingPanelOpen"
      >
        <UIcon name="i-heroicons-adjustments-horizontal" class="chrome-toolbar-svg" />
      </button>
      <button class="chrome-toolbar-btn" title="Done" @click="finishActiveTextEdit">Done</button>
      <div
        v-if="chromePaddingPanelOpen"
        class="chrome-padding-popover"
        data-testid="chrome-padding-popover"
        @pointerdown.stop
        @click.stop
      >
        <span class="chrome-padding-title">Padding</span>
        <div
          v-for="side in chromePaddingSides"
          :key="side.key"
          class="chrome-padding-side"
        >
          <span>{{ side.label }}</span>
          <button :title="`Reduce ${side.name} padding`" @click="nudgeActiveChromeCellPadding(-1, side.index)">-</button>
          <output>{{ activeChromePaddingValues[side.index] }}</output>
          <button :title="`Increase ${side.name} padding`" @click="nudgeActiveChromeCellPadding(1, side.index)">+</button>
        </div>
      </div>
      <span class="chrome-toolbar-pointer" :style="chromeToolbarPointerFloatingStyle" />
    </div>

    <div
      v-if="chromeStructurePopoverVisible"
      ref="chromeStructurePopoverEl"
      class="chrome-inline-popover chrome-inline-popover--floating"
      :style="chromeStructurePopoverFloatingStyle"
      data-testid="chrome-structure-popover"
      @pointerdown.stop
      @click.stop
    >
      <button @pointerdown.prevent.stop="addColumnForSelection" @click.stop>+ Col</button>
      <button @pointerdown.prevent.stop="addRowForSelection" @click.stop>+ Row</button>
      <button @pointerdown.prevent.stop="duplicateChromeBlock" @click.stop>Dup</button>
      <button @pointerdown.prevent.stop="deleteChromeBlock" @click.stop>Clear</button>
      <button @pointerdown.prevent.stop="removeSelectedCell" @click.stop>Remove</button>
      <button @pointerdown.prevent.stop="resetChromeSection(activeChromeBand)" @click.stop>Reset</button>
    </div>

    <div
      v-if="chromeStructureEditing && chromeLayoutBuilderVisible"
      class="chrome-editor-app-bar"
      data-testid="chrome-editor-app-bar"
      @pointerdown.stop
      @click.stop
    >
      <button class="chrome-editor-app-action" @click="finishActiveTextEdit">Done</button>
      <span class="chrome-editor-app-title">Editing Poster Layout</span>
      <button
        class="chrome-editor-add-button"
        :class="{ 'is-active': chromeAddPanelOpen }"
        data-testid="chrome-editor-add-block"
        @click="toggleChromeAddPanel"
      >
        Add Block
      </button>
    </div>

    <div
      v-if="chromeStructureEditing && chromeLayoutBuilderVisible && chromeAddPanelOpen"
      class="chrome-add-block-panel"
      data-testid="chrome-add-block-panel"
      @pointerdown.stop
      @click.stop
    >
      <span class="chrome-add-block-section">Essentials</span>
      <div class="chrome-add-block-grid">
        <button class="chrome-add-block-card" data-testid="chrome-builder-add-text" @click="addChromeTextFromPalette">
          <UIcon name="i-heroicons-pencil-square" class="chrome-add-block-icon" />
          <span>Text</span>
        </button>
        <button class="chrome-add-block-card" data-testid="chrome-builder-add-column" @click="addColumnFromPalette">
          <UIcon name="i-heroicons-view-columns" class="chrome-add-block-icon" />
          <span>Column</span>
        </button>
        <button class="chrome-add-block-card" data-testid="chrome-builder-add-row" @click="addRowFromPalette">
          <UIcon name="i-heroicons-queue-list" class="chrome-add-block-icon" />
          <span>Row</span>
        </button>
        <button class="chrome-add-block-card" data-testid="chrome-builder-add-spacer" @click="addSpacerFromPalette">
          <UIcon name="i-heroicons-arrows-pointing-out" class="chrome-add-block-icon" />
          <span>Spacer</span>
        </button>
      </div>
    </div>

    <div
      v-if="chromeContextToolbarVisible"
      ref="chromeLayoutBuilderEl"
      class="chrome-layout-builder"
      :class="[
        chromeLayoutBuilderPopoverVertical === 'top' ? 'is-popover-above' : '',
        chromeLayoutBuilderPopoverAlign === 'left' ? 'is-popover-left' : '',
      ]"
      :style="chromeLayoutBuilderFloatingStyle"
      data-testid="chrome-layout-builder"
      @pointerdown.stop
      @click.stop
    >
      <button
        type="button"
        class="chrome-context-handle"
        data-testid="chrome-context-toolbar-handle"
        title="Drag toolbar"
        aria-label="Drag toolbar"
        @pointerdown.prevent.stop="startChromeContextToolbarDrag"
      >
        <span />
        <span />
        <span />
        <span />
      </button>

      <div
        v-if="!activeChromeBlock"
        class="chrome-layout-builder-main chrome-layout-builder-main--content"
      >
        <button
          class="chrome-layout-builder-primary"
          data-testid="chrome-builder-add-text-primary"
          @click="addChromeTextForSelection"
        >
          Add text
        </button>
      </div>

      <span v-if="activeChromeBlock && !isChromeSpacerBlock(activeChromeBlock)" class="chrome-layout-divider" />

      <div v-if="activeChromeBlock && !isChromeSpacerBlock(activeChromeBlock)" class="chrome-layout-builder-group chrome-layout-builder-group--icons">
        <button :class="{ active: activeChromeBold }" title="Bold" data-testid="chrome-builder-bold" @click="toggleChromeBold">B</button>
        <button :class="{ active: activeChromeItalic }" title="Italic" data-testid="chrome-builder-italic" @click="toggleChromeItalic">I</button>
        <button title="Smaller" @click="nudgeChromeScale(-0.05)">A-</button>
        <button title="Larger" @click="nudgeChromeScale(0.05)">A+</button>
        <label class="chrome-layout-color" title="Text color">
          <input type="color" :value="activeChromeColor" @input="setChromeColor(($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <details class="chrome-layout-more" data-testid="chrome-builder-style-menu">
        <summary data-testid="chrome-builder-style-toggle">
          <UIcon name="i-heroicons-adjustments-horizontal" class="chrome-layout-icon" />
        </summary>
        <div class="chrome-layout-popover">
          <div v-if="activeChromeBlock && !isChromeSpacerBlock(activeChromeBlock)" class="chrome-layout-builder-group chrome-layout-builder-group--icons">
            <button :class="{ active: activeChromeAlign === 'left' }" title="Align left" aria-label="Align left" @click="setChromeAlign('left')">
              <UIcon name="i-heroicons-bars-3-bottom-left" class="chrome-layout-icon" />
            </button>
            <button :class="{ active: activeChromeAlign === 'center' }" title="Align center" aria-label="Align center" @click="setChromeAlign('center')">
              <UIcon name="i-heroicons-bars-3" class="chrome-layout-icon" />
            </button>
            <button :class="{ active: activeChromeAlign === 'right' }" title="Align right" aria-label="Align right" @click="setChromeAlign('right')">
              <UIcon name="i-heroicons-bars-3-bottom-right" class="chrome-layout-icon" />
            </button>
            <span class="chrome-layout-mini-divider" />
            <button :class="{ active: activeChromeValign === 'top' }" title="Align top" @click="setChromeValign('top')">Top</button>
            <button :class="{ active: activeChromeValign === 'center' }" title="Align middle" @click="setChromeValign('center')">Mid</button>
            <button :class="{ active: activeChromeValign === 'bottom' }" title="Align bottom" @click="setChromeValign('bottom')">Bottom</button>
          </div>

          <div v-if="chromeStructureEditing" class="chrome-layout-builder-group">
            <button :disabled="!activeChromeBlock" data-testid="chrome-builder-duplicate" @click="duplicateChromeBlock">Duplicate</button>
            <button :disabled="!activeChromeBlock" data-testid="chrome-builder-clear" @click="deleteChromeBlock">Clear</button>
            <button :disabled="selectedChromeTarget?.type !== 'cell'" data-testid="chrome-builder-remove" @click="removeSelectedCell">Remove</button>
            <button data-testid="chrome-builder-reset" @click="resetChromeSection(activeChromeBand)">Reset</button>
          </div>

          <div v-if="chromeStructureEditing" class="chrome-layout-builder-spacing">
            <span>Cell padding</span>
            <div
              v-for="side in chromePaddingSides"
              :key="`cell-${side.key}`"
              class="chrome-layout-stepper"
            >
              <label>{{ side.label }}</label>
              <button
                :disabled="selectedChromeTarget?.type !== 'cell'"
                :data-testid="`chrome-builder-cell-padding-${side.key}-decrease`"
                @click="nudgeActiveChromeCellPadding(-1, side.index)"
              >
                -
              </button>
              <output>{{ activeChromePaddingValues[side.index] }}</output>
              <button
                :disabled="selectedChromeTarget?.type !== 'cell'"
                :data-testid="`chrome-builder-cell-padding-${side.key}-increase`"
                @click="nudgeActiveChromeCellPadding(1, side.index)"
              >
                +
              </button>
            </div>
          </div>

          <div v-if="chromeStructureEditing" class="chrome-layout-builder-spacing">
            <span>Section padding</span>
            <div
              v-for="side in chromePaddingSides"
              :key="`band-${side.key}`"
              class="chrome-layout-stepper"
            >
              <label>{{ side.label }}</label>
              <button
                :data-testid="`chrome-builder-section-padding-${side.key}-decrease`"
                @click="nudgeChromeBandPaddingSide(activeChromeBand, -1, side.index)"
              >
                -
              </button>
              <output>{{ activeChromeBandPaddingValues[side.index] }}</output>
              <button
                :data-testid="`chrome-builder-section-padding-${side.key}-increase`"
                @click="nudgeChromeBandPaddingSide(activeChromeBand, 1, side.index)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>

    <div
      v-if="chromeMobileDrawerOpen && activeChromeBlock"
      class="chrome-mobile-drawer"
      data-testid="chrome-mobile-drawer"
      @pointerdown.stop
      @click.stop
    >
      <div class="chrome-mobile-handle" />
      <div class="chrome-mobile-head">
        <span>{{ chromeBandLabel(activeChromeBand).toUpperCase() }} · {{ chromeBlockLabel(activeChromeBlock).toUpperCase() }}</span>
        <button @click="finishActiveTextEdit">Done</button>
      </div>
      <input
        v-if="activeChromeTextValue != null"
        class="chrome-mobile-input"
        :value="activeChromeTextValue"
        @input="setActiveChromeText(($event.target as HTMLInputElement).value)"
      />
      <div class="chrome-mobile-chip-row">
        <button :class="{ active: activeChromeBold }" @click="toggleChromeBold">B</button>
        <button :class="{ active: activeChromeItalic }" @click="toggleChromeItalic">I</button>
        <button @click="nudgeChromeScale(-0.05)">A-</button>
        <button @click="nudgeChromeScale(0.05)">A+</button>
        <button @click="setChromeAlign('left')">L</button>
        <button @click="setChromeAlign('center')">C</button>
        <button @click="setChromeAlign('right')">R</button>
        <label>
          Color
          <input type="color" :value="activeChromeColor" @input="setChromeColor(($event.target as HTMLInputElement).value)" />
        </label>
      </div>
      <div v-if="chromeStructureEditing" class="chrome-mobile-actions">
        <button @click="addColumnForSelection">+ Column</button>
        <button @click="addRowForSelection">+ Row</button>
        <button @click="deleteChromeBlock">Clear</button>
        <button @click="duplicateChromeBlock">Duplicate</button>
        <button @click="resetChromeSection(activeChromeBand)">Reset section</button>
        <button class="danger" @click="removeSelectedCell">Remove cell</button>
      </div>
    </div>

    <ClientOnly>
      <Moveable
        v-if="posterElementsEditing && posterMoveableTarget && selectedPosterElementCanTransform"
        class-name="poster-element-moveable"
        :target="posterMoveableTarget"
        :draggable="selectedPosterElementDraggable"
        :drag-area="true"
        :resizable="selectedPosterElementResizable"
        :rotatable="selectedPosterElementRotatable"
        :snappable="true"
        :snap-container="posterCanvasEl"
        :vertical-guidelines="posterVerticalGuidelines"
        :horizontal-guidelines="posterHorizontalGuidelines"
        :snap-threshold="6"
        :snap-grid-width="posterSnapGridPx.width"
        :snap-grid-height="posterSnapGridPx.height"
        :bounds="posterMoveableBounds"
        :keep-ratio="selectedPosterElementKeepRatio"
        :origin="false"
        :throttle-drag="0"
        :throttle-resize="0"
        :throttle-rotate="1"
        @drag="onPosterMoveableDrag"
        @drag-end="onPosterMoveableDragEnd"
        @resize-start="onPosterMoveableResizeStart"
        @resize="onPosterMoveableResize"
        @resize-end="onPosterMoveableResizeEnd"
        @rotate="onPosterMoveableRotate"
        @rotate-end="onPosterMoveableRotateEnd"
      />
    </ClientOnly>

    <!-- Poster canvas — maintains print aspect ratio -->
    <div
      ref="posterCanvasEl"
      class="poster-canvas relative flex flex-col"
      :class="posterCanvasClass"
      :style="posterCanvasStyle"
      :data-composition="composition.id"
      :data-theme="styleConfig.color_theme"
      data-testid="poster-canvas"
      @pointerdown.self="onChromeCanvasPointerDown"
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
        v-if="composition.id === 'brutalist-slab'"
        class="composition-brutalist-registration-marks"
        data-testid="composition-brutalist-registration-marks"
        aria-hidden="true"
      />
      <div
        v-if="isBlueprintDraftingTheme"
        class="blueprint-drafting-topline"
        data-testid="blueprint-drafting-topline"
        aria-hidden="true"
      >
        <span>{{ blueprintDraftingToplineLabel }}</span>
        <span data-testid="blueprint-drafting-coordinate">{{ coords?.lat ?? '36.5785°N' }}</span>
      </div>
      <div
        v-if="isBlueprintDraftingTheme"
        class="blueprint-drafting-figure"
        data-testid="blueprint-drafting-figure"
        aria-hidden="true"
      >
        {{ blueprintDraftingFigureLabel }}
      </div>
      <div
        v-if="isBlueprintDraftingTheme"
        class="blueprint-sheet-neatline"
        data-testid="blueprint-sheet-neatline"
        aria-hidden="true"
      />
      <div
        v-if="showEditorGuides"
        class="poster-editor-guides"
        data-testid="poster-editor-guides"
      >
        <span class="poster-editor-guide poster-editor-guide--safe" />
        <span class="poster-editor-guide poster-editor-guide--center-v" />
        <span class="poster-editor-guide poster-editor-guide--center-h" />
        <span class="poster-editor-guide poster-editor-guide--third-v poster-editor-guide--third-v-1" />
        <span class="poster-editor-guide poster-editor-guide--third-v poster-editor-guide--third-v-2" />
        <span class="poster-editor-guide poster-editor-guide--third-h poster-editor-guide--third-h-1" />
        <span class="poster-editor-guide poster-editor-guide--third-h poster-editor-guide--third-h-2" />
      </div>
      <div
        v-if="composition.showStarField"
        class="composition-star-field"
        data-testid="composition-star-field"
      />
      <svg
        v-if="composition.id === 'darksky-stars'"
        class="composition-star-constellation"
        viewBox="0 0 100 26"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-testid="composition-star-constellation"
      >
        <g class="star-constellation-shape star-constellation-shape--horizon">
          <path class="star-constellation-line" d="M6 13 L24 10 L48 16 L72 11 L91 15" />
          <path class="star-constellation-line star-constellation-line--secondary" d="M24 10 L39 5 L72 11 L84 4" />
          <g class="star-constellation-points">
            <circle cx="6" cy="13" r="1.35" />
            <circle cx="24" cy="10" r="0.78" />
            <circle cx="39" cy="5" r="0.54" />
            <circle cx="48" cy="16" r="1.05" />
            <circle cx="72" cy="11" r="1.22" />
            <circle cx="84" cy="4" r="0.62" />
            <circle cx="91" cy="15" r="1.05" />
          </g>
        </g>
        <g class="star-constellation-shape star-constellation-shape--summit">
          <path class="star-constellation-line" d="M57 2 L43 19 L28 24 L57 2 L75 17 L83 23" />
          <path class="star-constellation-line star-constellation-line--secondary" d="M43 19 L66 8 L75 17 L68 22 L83 23" />
          <g class="star-constellation-points">
            <ellipse cx="57" cy="2" rx="1.22" ry="0.32" />
            <ellipse cx="43" cy="19" rx="0.82" ry="0.22" />
            <ellipse cx="28" cy="24" rx="0.92" ry="0.24" />
            <ellipse cx="66" cy="8" rx="0.62" ry="0.16" />
            <ellipse cx="75" cy="17" rx="0.86" ry="0.23" />
            <ellipse cx="68" cy="22" rx="0.62" ry="0.16" />
            <ellipse cx="83" cy="23" rx="0.78" ry="0.21" />
          </g>
        </g>
      </svg>
      <svg
        v-if="composition.id === 'darksky-stars'"
        class="composition-darksky-ridge"
        viewBox="0 0 100 36"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-testid="composition-darksky-ridge"
      >
        <path class="darksky-ridge-line darksky-ridge-line--back" d="M0 24 L8 20 L15 22 L24 12 L31 19 L38 15 L46 23 L54 10 L63 19 L72 14 L82 23 L91 18 L100 22 L100 36 L0 36 Z" />
        <path class="darksky-ridge-line darksky-ridge-line--front" d="M0 29 L10 25 L18 27 L29 18 L38 26 L49 21 L60 30 L69 20 L80 27 L90 24 L100 28 L100 36 L0 36 Z" />
      </svg>
      <div
        v-if="composition.id === 'bib-numerals'"
        class="composition-bib-paper"
        data-testid="composition-bib-paper"
        aria-hidden="true"
      >
        <span class="composition-bib-pin-hole composition-bib-pin-hole--tl" data-testid="composition-bib-pin-hole" />
        <span class="composition-bib-pin-hole composition-bib-pin-hole--tr" data-testid="composition-bib-pin-hole" />
        <span class="composition-bib-pin-hole composition-bib-pin-hole--br" data-testid="composition-bib-pin-hole" />
        <span class="composition-bib-pin-hole composition-bib-pin-hole--bl" data-testid="composition-bib-pin-hole" />
      </div>
      <div
        v-if="composition.id === 'bib-numerals'"
        class="composition-bib-topline"
        data-testid="composition-bib-topline"
        aria-hidden="true"
      >
        {{ marathonBibTopline }}
      </div>
      <div
        v-if="composition.id === 'bib-numerals'"
        class="composition-bib-ghost"
        data-testid="composition-bib-ghost"
        aria-hidden="true"
      >
        {{ marathonBibYear }}
      </div>
      <div
        v-if="composition.id === 'bib-numerals'"
        class="composition-bib-tear-strip"
        data-testid="composition-bib-tear-strip"
        aria-hidden="true"
      />
      <div
        v-if="composition.id === 'bib-numerals'"
        class="composition-bib-finish-headline"
        data-testid="composition-bib-finish-headline"
        aria-hidden="true"
      >
        <span>Finisher ·</span>
        <b>{{ marathonFinishHeadline }}</b>
      </div>
      <div
        v-if="styleConfig.color_theme === 'plein-air'"
        class="composition-plein-air-deckle"
        data-testid="composition-plein-air-deckle"
        aria-hidden="true"
      >
        <span class="plein-air-deckle-edge plein-air-deckle-edge--top" />
        <span class="plein-air-deckle-edge plein-air-deckle-edge--right" />
        <span class="plein-air-deckle-edge plein-air-deckle-edge--bottom" />
        <span class="plein-air-deckle-edge plein-air-deckle-edge--left" />
      </div>
      <aside
        v-if="styleConfig.color_theme === 'field-journal'"
        class="composition-journal-notes"
        data-testid="composition-journal-notes"
        aria-hidden="true"
      >
        <span class="journal-note-heading">Field Notes</span>
        <span class="journal-note-rule" />
        <span class="journal-note-rule" />
        <span class="journal-note-rule" />
        <span class="journal-note-rule journal-note-rule--short" />
      </aside>
      <aside
        v-if="styleConfig.color_theme === 'field-journal'"
        class="composition-journal-route-sketch"
        data-testid="composition-journal-route-sketch"
        aria-hidden="true"
      >
        <span class="journal-specimen-tag">Route specimen</span>
        <span class="journal-specimen-line" />
        <span>{{ formattedDistance ? `${formattedDistance} mi` : 'measured route' }}</span>
        <span>{{ formattedGain ? `${formattedGain} ft gain` : 'field survey' }}</span>
      </aside>
      <div
        v-if="composition.showSideRail && !sideRailInsideMap"
        class="composition-side-rail"
        data-testid="composition-side-rail"
        @pointerenter="chromeDirectEditing && (hoveredChromeBand = 'railLeft')"
        @pointerleave="chromeDirectEditing && (hoveredChromeBand = null)"
      />
      <div
        v-if="compositionDecor.sideRailLabel && !sideRailInsideMap && chromeSlotVisible('composition_side_rail')"
        class="composition-side-rail-label"
        :class="{ 'editable-text': slotEditable('composition_side_rail'), 'is-selected-text': isSlotActive('composition_side_rail') }"
        :style="compositionSideRailLabelStyle"
        :contenteditable="slotEditable('composition_side_rail') ? 'true' : 'false'"
        :suppressContentEditableWarning="true"
        role="textbox"
        aria-label="Side rail label"
        enterkeyhint="done"
        spellcheck="true"
        data-testid="composition-side-rail-label"
        :data-poster-element-id="slotEditorElementId('composition_side_rail')"
        @focus="onSlotFocus($event, 'composition_side_rail')"
        @blur="onSlotBlur($event, 'composition_side_rail')"
        @click="onSlotClick($event, 'composition_side_rail')"
        @keydown.enter.exact.prevent="finishActiveTextEdit"
      >{{ compositionDecor.sideRailLabel }}</div>
      <button
        v-if="chromeDirectEditing && hoveredChromeBand === 'railLeft' && !sideRailInsideMap"
        class="chrome-section-chip chrome-section-chip--rail"
        @click.stop="openChromeSection('railLeft')"
      >LEFT RAIL</button>

      <!-- ── Top-right controls: undo/redo + zoom lock ────────────────────── -->
      <div
        v-if="editable && mapReady && !chromeGridRendering"
        class="poster-controls"
        :class="{ 'map-hovered': mapHovered }"
      >
        <!-- Undo / redo pill -->
        <div class="control-pill">
          <button
            class="control-btn"
            :disabled="segmentDrawMode ? !canUndoSegmentDrawPoint : !canUndo"
            title="Undo (⌘Z)"
            @click="requestUndo"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clip-rule="evenodd"/>
            </svg>
          </button>
          <span class="control-divider"/>
          <button
            class="control-btn"
            :disabled="segmentDrawMode ? true : !canRedo"
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
      <div
        class="poster-header shrink-0"
        :class="{
          'is-chrome-grid-mode': chromeGridRendering,
          'is-chrome-elevated-band': chromeBandElevated('header'),
        }"
        :style="headerBandStyle"
        data-testid="poster-header"
        @pointerenter="chromeDirectEditing && (hoveredChromeBand = 'header')"
        @pointerleave="chromeDirectEditing && (hoveredChromeBand = null)"
      >
        <div
          v-if="chromeAffordancesVisible"
          class="chrome-band-layer"
          :class="{ 'is-active': chromeBandActive('header') }"
          data-testid="chrome-band-header"
        >
          <button
            v-if="chromeSectionActive('header')"
            class="chrome-section-chip"
            @click.stop="openChromeSection('header')"
          >Header</button>
          <button
            v-if="chromeSectionActive('header')"
            class="chrome-insert-btn"
            title="Add text block"
            @click.stop="addChromeTextBlock('header')"
          >+</button>
        </div>
        <div
          v-if="composition.id === 'modernist-block'"
          class="composition-modernist-accent"
          data-testid="composition-modernist-accent"
          aria-hidden="true"
        />
        <div
          v-if="chromeGridRendering"
          class="chrome-grid-band chrome-grid-band--header"
          :class="{
            'is-editable': chromeDirectEditing,
            'is-resizing-columns': activeChromeColumnResize?.band === 'header',
            'is-resizing-rows': activeChromeRowResize?.band === 'header',
          }"
          data-testid="chrome-band-header"
          :style="chromeBandGridStyle('header')"
          @click.self="selectChromeBand('header')"
        >
          <div
            v-for="row in chromeRowsFor('header')"
            :key="row.id"
            class="chrome-grid-row"
            :class="{
              'is-selected': chromeDirectEditing && selectedChromeTarget?.type === 'row' && selectedChromeTarget.band === 'header' && selectedChromeTarget.rowId === row.id,
              'has-selected-cell': chromeDirectEditing && selectedChromeTarget?.type === 'cell' && selectedChromeTarget.band === 'header' && selectedChromeTarget.rowId === row.id,
              'is-resizing-row': chromeDirectEditing && activeChromeRowResize?.band === 'header' && activeChromeRowResize.rowId === row.id,
            }"
            :style="chromeRowStyle(row)"
            :data-chrome-row-id="row.id"
            @click.stop="selectChromeRow('header', row.id)"
          >
            <div
              v-for="cell in chromeCellsFor(row)"
              :key="cell.id"
              class="chrome-grid-cell"
              :class="{
                'is-selected': chromeDirectEditing && selectedChromeTarget?.type === 'cell' && selectedChromeTarget.band === 'header' && selectedChromeTarget.rowId === row.id && selectedChromeTarget.cellId === cell.id,
                'is-resizing-col': chromeDirectEditing && activeChromeColumnResize?.band === 'header' && activeChromeColumnResize.rowId === row.id && activeChromeColumnResize.cellId === cell.id,
                'is-empty': !cell.block || cell.block.empty,
                'is-spacer': isChromeSpacerCell(cell),
              }"
              :style="chromeCellStyle(cell)"
              :data-chrome-cell-id="cell.id"
              @click.stop="selectChromeCellFromInteraction('header', row.id, cell.id)"
            >
              <button
                v-if="chromeStructureEditing && (chromeCellSelected('header', row.id, cell.id) || isChromeSpacerCell(cell))"
                class="chrome-cell-trash"
                :class="{ 'is-passive': !chromeCellSelected('header', row.id, cell.id) }"
                :data-testid="chromeCellSelected('header', row.id, cell.id) ? 'chrome-cell-trash' : undefined"
                :title="isChromeSpacerCell(cell) ? 'Remove spacer' : cell.block && !cell.block.empty ? 'Delete text' : 'Remove cell'"
                aria-label="Delete selected cell"
                @pointerdown.prevent.stop="trashChromeCell('header', row.id, cell.id)"
                @click.prevent.stop="trashChromeCell('header', row.id, cell.id)"
              >
                <UIcon name="i-heroicons-trash" class="chrome-cell-trash-icon" />
              </button>
              <div
                v-if="isChromeSpacerCell(cell)"
                class="chrome-grid-spacer"
                :data-chrome-block-id="cell.block?.id"
                role="separator"
                :aria-label="cell.block?.label ?? 'Spacer'"
                @pointerdown.stop="selectChromeCellFromInteraction('header', row.id, cell.id)"
                @click.stop="selectChromeCellFromInteraction('header', row.id, cell.id)"
              >
                <span>{{ cell.block?.label ?? 'Spacer' }}</span>
              </div>
              <div
                v-else-if="cell.block && !cell.block.empty && (!cell.block.slot || compositionAllowsSlot(cell.block.slot))"
                class="chrome-grid-block"
                :class="[
                  `chrome-grid-block--${cell.block.kind}`,
                  cell.block.slot ? `chrome-grid-block--slot-${chromeSlotClass(cell.block.slot)}` : '',
                  { 'editable-text': chromeDirectEditing && chromeBlockEditable(cell.block) },
                ]"
                :style="chromeGridBlockStyle(cell)"
                :contenteditable="editable && chromeDirectEditing && chromeBlockEditable(cell.block) ? 'true' : 'false'"
                :suppressContentEditableWarning="true"
                role="textbox"
                :aria-label="chromeBlockLabel(cell.block)"
                :data-chrome-block-id="cell.block.id"
                :data-chrome-slot="cell.block.slot"
                :data-chrome-kind="cell.block.kind"
                :data-poster-element-id="cell.block.slot ? slotEditorElementId(cell.block.slot) : undefined"
                :data-riso-title="cell.block.kind === 'title' ? chromeBlockText(cell.block) : undefined"
                @pointerdown.stop="selectChromeCellFromInteraction('header', row.id, cell.id)"
                @focus="onChromeGridBlockFocus($event, 'header', row.id, cell.id)"
                @click.stop="selectChromeCellFromInteraction('header', row.id, cell.id)"
                @blur="onChromeGridBlockBlur($event, 'header', row.id, cell.id)"
                @keydown.enter.exact.prevent="finishActiveTextEdit"
              >{{ chromeBlockText(cell.block) }}</div>
              <button
                v-else-if="chromeStructureEditing"
                class="chrome-empty-cell-btn"
                title="Add text"
                @click.stop="addChromeTextToCell('header', row.id, cell.id)"
              >+</button>
              <button
                v-if="chromeStructureEditing && canInsertColumnAfter(row, cell)"
                class="chrome-cell-add-col chrome-cell-add-col--right"
                :class="{ 'chrome-cell-add-col--after-resize': canResizeChromeCell(row, cell) }"
                data-testid="chrome-cell-add-column"
                title="Add column after this cell"
                aria-label="Add column after this cell"
                @pointerdown.prevent.stop="addColumnAfter('header', row.id, cell.id)"
                @click.stop
              >
                <UIcon name="i-heroicons-plus" class="chrome-cell-add-col-icon" />
              </button>
              <button
                v-if="chromeStructureEditing && canResizeChromeCell(row, cell)"
                class="chrome-cell-resize-col"
                data-testid="chrome-cell-resize-column"
                title="Drag to resize column"
                @pointerdown.prevent.stop="startChromeColumnResize($event, 'header', row.id, cell.id)"
                @click.stop
              />
            </div>
            <button
              v-if="chromeStructureEditing"
              class="chrome-row-add-row"
              data-testid="chrome-row-add-row"
              title="Add row below"
              aria-label="Add row below"
              @pointerdown.prevent.stop="addRowAfter('header', row.id)"
              @click.stop
            >
              <UIcon name="i-heroicons-plus" class="chrome-row-add-row-icon" />
            </button>
            <button
              v-if="chromeStructureEditing && canResizeChromeRowEdge('header', row, 'top')"
              class="chrome-row-resize-row chrome-row-resize-row--top"
              data-testid="chrome-row-resize-row"
              data-edge="top"
              title="Drag to adjust top spacing"
              aria-label="Adjust row top spacing"
              @pointerdown.prevent.stop="startChromeRowResize($event, 'header', row.id, 'top')"
              @click.stop
            />
            <button
              v-if="chromeStructureEditing && canResizeChromeRowEdge('header', row, 'bottom')"
              class="chrome-row-resize-row chrome-row-resize-row--bottom"
              data-testid="chrome-row-resize-row"
              data-edge="bottom"
              title="Drag to adjust bottom spacing"
              aria-label="Adjust row bottom spacing"
              @pointerdown.prevent.stop="startChromeRowResize($event, 'header', row.id, 'bottom')"
              @click.stop
            />
          </div>
          <button v-if="chromeStructureEditing" class="chrome-band-add-row" data-testid="chrome-band-add-row" @pointerdown.prevent.stop="addRowAfter('header')" @click.stop>Row +</button>
        </div>
        <div
          v-if="composition.id === 'botanical-plate'"
          class="botanical-titleblock-eyebrow"
          data-testid="composition-kicker"
          aria-hidden="true"
        >
          {{ compositionDecor.kicker }}
        </div>
        <div
          v-if="compositionDecor.kicker && chromeSlotVisible('composition_kicker')"
          class="composition-kicker"
          :class="{ 'editable-text': slotEditable('composition_kicker'), 'is-selected-text': isSlotActive('composition_kicker') }"
          :style="compositionKickerStyle"
          :contenteditable="slotEditable('composition_kicker') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Composition kicker"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-kicker"
          :data-poster-element-id="slotEditorElementId('composition_kicker')"
          @focus="onSlotFocus($event, 'composition_kicker')"
          @blur="onSlotBlur($event, 'composition_kicker')"
          @click="onSlotClick($event, 'composition_kicker')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.kicker }}</div>

        <!-- Thin rule at top — only for bottom-positioned header -->
        <div v-if="layout.titlePosition === 'bottom'" class="poster-rule" :style="ruleStyle" />

        <!-- Trail name — static or editable -->
        <h1
          v-if="!editable && styleConfig.labels?.show_title !== false && chromeSlotVisible('trail_name')"
          class="poster-trail-name"
          :style="trailNameStyle"
          :data-riso-title="trailName"
        >{{ trailName }}</h1>
        <h1
          v-else-if="editable && chromeSlotVisible('trail_name')"
          class="poster-trail-name editable-text"
          :class="{ 'is-selected-text': isSlotActive('trail_name'), 'editable-text': slotEditable('trail_name') }"
          :style="trailNameStyle"
          :data-poster-element-id="slotEditorElementId('trail_name')"
          :data-riso-title="trailName"
          :contenteditable="slotEditable('trail_name') ? 'true' : 'false'"
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
          v-if="locationLine && !editable && chromeSlotVisible('location_text')"
          class="poster-location-line"
          :style="locationLineStyle"
        >{{ locationLine }}</p>
        <p
          v-else-if="locationLine && editable && chromeSlotVisible('location_text')"
          class="poster-location-line editable-text"
          :class="{ 'is-selected-text': isSlotActive('location_text'), 'editable-text': slotEditable('location_text') }"
          :style="locationLineStyle"
          :data-poster-element-id="slotEditorElementId('location_text')"
          :contenteditable="slotEditable('location_text') ? 'true' : 'false'"
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
          v-if="compositionDecor.meta && chromeSlotVisible('composition_meta')"
          class="composition-meta-line"
          :class="{ 'editable-text': slotEditable('composition_meta'), 'is-selected-text': isSlotActive('composition_meta') }"
          :style="compositionMetaStyle"
          :contenteditable="slotEditable('composition_meta') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Composition metadata"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-meta-line"
          :data-poster-element-id="slotEditorElementId('composition_meta')"
          @focus="onSlotFocus($event, 'composition_meta')"
          @blur="onSlotBlur($event, 'composition_meta')"
          @click="onSlotClick($event, 'composition_meta')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.meta }}</div>
        <div
          v-if="composition.id === 'botanical-plate'"
          class="botanical-titleblock-coordinate"
          data-testid="composition-meta-line"
          aria-hidden="true"
        >
          {{ compositionDecor.meta }}
        </div>

        <!-- Thin rule at bottom — only for top-positioned header -->
        <div v-if="layout.titlePosition === 'top'" class="poster-rule" :style="ruleStyle" />
        <div
          v-for="block in customChromeBlocks('header')"
          :key="block.id"
          class="chrome-custom-block editable-text"
          :class="{ 'is-selected-text': activeChromeBlockId === block.id }"
          :style="chromeCustomBlockStyle('header', block)"
          contenteditable="true"
          :suppressContentEditableWarning="true"
          role="textbox"
          :aria-label="chromeBlockLabel(block)"
          data-testid="chrome-custom-block"
          @focus="onCustomChromeFocus($event, block.id)"
          @blur="onCustomChromeBlur($event, block.id)"
          @click.stop="onCustomChromeClick($event, block.id)"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ chromeBlockText(block) }}</div>
      </div>

      <!-- ── MAP (hero — takes all remaining height) ─────────────────────── -->
      <div ref="mapContainer" class="relative flex-1 overflow-hidden" :style="mapAreaStyle" data-testid="poster-map"
        @mouseenter="mapHovered = true" @mouseleave="mapHovered = false"
      >
        <div
          v-if="sideRailInsideMap"
          class="composition-side-rail composition-side-rail--left"
          data-testid="composition-side-rail"
          @pointerenter="chromeDirectEditing && (hoveredChromeBand = 'railLeft')"
          @pointerleave="chromeDirectEditing && (hoveredChromeBand = null)"
        />
        <div
          v-if="sideRailInsideMap"
          class="composition-side-rail composition-side-rail--right"
          data-testid="composition-side-rail-right"
          @pointerenter="chromeDirectEditing && (hoveredChromeBand = 'railRight')"
          @pointerleave="chromeDirectEditing && (hoveredChromeBand = null)"
        />
        <div
          v-if="compositionDecor.sideRailLabel && sideRailInsideMap && chromeSlotVisible('composition_side_rail')"
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
        <div
          v-if="styleConfig.color_theme === 'electric-atlas'"
          class="composition-electric-trace"
          data-testid="composition-electric-trace"
          aria-hidden="true"
        >
          <span class="electric-trace-line electric-trace-line--a" />
          <span class="electric-trace-line electric-trace-line--b" />
          <span class="electric-trace-line electric-trace-line--c" />
        </div>
        <div
          v-if="styleConfig.color_theme === 'electric-atlas'"
          class="composition-electric-chip"
          data-testid="composition-electric-chip"
          aria-hidden="true"
        >
          <span>LIVE GPX</span>
          <b>{{ formattedDistance ? `${formattedDistance} MI` : 'ROUTE' }}</b>
        </div>
        <svg
          v-if="styleConfig.color_theme === 'relief-shaded'"
          class="composition-relief-bands"
          viewBox="0 0 100 150"
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="composition-relief-bands"
        >
          <path class="relief-band relief-band--low" d="M0 116 C18 105 31 122 49 112 C66 103 80 110 100 98 L100 150 L0 150 Z" />
          <path class="relief-band relief-band--mid" d="M0 86 C20 76 34 91 51 82 C69 72 79 84 100 70 L100 104 C80 116 66 104 49 114 C31 124 18 106 0 118 Z" />
          <path class="relief-band relief-band--high" d="M0 52 C19 44 34 59 50 49 C67 39 80 48 100 34 L100 72 C80 86 68 73 51 84 C34 94 20 77 0 88 Z" />
        </svg>
        <div
          v-if="styleConfig.color_theme === 'relief-shaded'"
          class="composition-relief-legend"
          data-testid="composition-relief-legend"
          aria-hidden="true"
        >
          <span class="relief-legend-swatch relief-legend-swatch--low" />
          <span class="relief-legend-swatch relief-legend-swatch--mid" />
          <span class="relief-legend-swatch relief-legend-swatch--high" />
        </div>
        <div
          v-if="styleConfig.color_theme === 'relief-shaded'"
          class="composition-relief-stamp"
          data-testid="composition-relief-stamp"
          aria-hidden="true"
        >
          Relief
        </div>
        <div
          v-if="styleConfig.color_theme === 'plein-air'"
          class="composition-plein-air-palette"
          data-testid="composition-plein-air-palette"
          aria-hidden="true"
        >
          <span class="plein-air-palette-swatch plein-air-palette-swatch--route" />
          <span class="plein-air-palette-swatch plein-air-palette-swatch--water" />
          <span class="plein-air-palette-swatch plein-air-palette-swatch--contour" />
        </div>
        <div
          v-if="styleConfig.color_theme === 'field-journal'"
          class="composition-journal-tape"
          data-testid="composition-journal-tape"
          aria-hidden="true"
        >
          <span class="journal-tape-strip journal-tape-strip--top" />
          <span class="journal-tape-strip journal-tape-strip--bottom" />
        </div>
        <div
          v-if="styleConfig.color_theme === 'botanical'"
          class="composition-botanical-frame"
          data-testid="composition-botanical-frame"
          aria-hidden="true"
        >
          <span class="botanical-corner botanical-corner--tl" />
          <span class="botanical-corner botanical-corner--tr" />
          <span class="botanical-corner botanical-corner--br" />
          <span class="botanical-corner botanical-corner--bl" />
        </div>
        <div
          v-if="showPlateFrameOverlay"
          class="composition-plate-frame"
          data-testid="composition-plate-frame"
        />
        <div
          v-if="showCartoucheHills"
          class="composition-cartouche-hills"
          data-testid="composition-cartouche-hills"
          aria-hidden="true"
        >
          <span class="composition-cartouche-hill composition-cartouche-hill--left" />
          <span class="composition-cartouche-hill composition-cartouche-hill--right" />
        </div>
        <svg
          v-if="composition.id === 'travel-banner'"
          class="composition-travel-sun"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="composition-travel-sun"
        >
          <circle class="composition-travel-sun__disk" cx="50" cy="82" r="78" />
          <circle class="composition-travel-sun__arc composition-travel-sun__arc--wide" cx="50" cy="82" r="58" />
          <circle class="composition-travel-sun__arc composition-travel-sun__arc--mid" cx="50" cy="82" r="38" />
          <circle class="composition-travel-sun__arc composition-travel-sun__arc--inner" cx="50" cy="82" r="22" />
          <path class="composition-travel-sun__horizon" d="M5 82 H95" />
        </svg>
        <svg
          v-if="composition.id === 'sea-chart'"
          class="composition-sea-chart-art"
          viewBox="0 0 100 150"
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="composition-sea-chart-art"
        >
          <rect class="sea-chart-neatline sea-chart-neatline--outer" x="4" y="5" width="92" height="140" />
          <rect class="sea-chart-neatline sea-chart-neatline--inner" x="6.2" y="7.2" width="87.6" height="135.6" />
          <g class="sea-chart-graticule">
            <path d="M0 34 H100 M0 70 H100 M0 106 H100" />
            <path d="M18 0 V150 M50 0 V150 M82 0 V150" />
          </g>
          <g class="sea-chart-rhumb-lines">
            <path d="M-8 128 L46 74 L108 12" />
            <path d="M-12 36 L34 82 L82 130" />
            <path d="M50 -10 L50 160" />
            <path d="M-10 75 H110" />
            <path d="M81 28 L-10 10" />
            <path d="M81 28 L108 62" />
            <path d="M81 28 L8 150" />
            <path d="M81 28 L100 120" />
            <path d="M81 28 L18 86" />
            <path d="M81 28 L42 -10" />
          </g>
          <g class="sea-chart-depth-bands">
            <path d="M-4 117 C17 106 31 123 49 113 C67 103 76 116 104 105" />
            <path d="M-2 127 C19 117 34 132 51 122 C68 113 82 126 102 116" />
          </g>
          <g class="sea-chart-soundings">
            <text x="14" y="27">7</text>
            <text x="32" y="43">12</text>
            <text x="71" y="31">5</text>
            <text x="86" y="58">9</text>
            <text x="51" y="64">11</text>
            <text x="11" y="69">6</text>
            <text x="18" y="91">4</text>
            <text x="43" y="86">13</text>
            <text x="66" y="101">16</text>
            <text x="36" y="116">8</text>
            <text x="79" y="121">14</text>
            <text x="18" y="132">10</text>
            <text x="57" y="137">18</text>
            <text x="91" y="142">7</text>
            <text x="8" y="111">3</text>
            <text x="58" y="16">9</text>
            <text x="45" y="27">15</text>
            <text x="88" y="92">12</text>
            <text x="25" y="73">8</text>
            <circle cx="24" cy="55" r="0.7" />
            <circle cx="43" cy="31" r="0.7" />
            <circle cx="78" cy="82" r="0.7" />
            <circle cx="55" cy="119" r="0.7" />
            <circle cx="32" cy="101" r="0.7" />
            <circle cx="69" cy="48" r="0.7" />
            <circle cx="91" cy="109" r="0.7" />
            <circle cx="12" cy="42" r="0.7" />
          </g>
          <g class="sea-chart-rose" data-testid="sea-chart-rose" transform="translate(81 27) scale(1.25)">
            <circle r="8.5" />
            <path d="M0 -12 L2.2 -2.2 L12 0 L2.2 2.2 L0 12 L-2.2 2.2 L-12 0 L-2.2 -2.2 Z" />
            <path d="M0 -8 V8 M-8 0 H8" />
            <text x="0" y="-14">N</text>
          </g>
        </svg>
        <svg
          v-if="composition.id === 'transit-diagram'"
          class="transit-diagram-route-stations"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="transit-diagram-route-stations"
        >
          <g>
            <circle class="transit-station transit-station--terminal" cx="30" cy="43" r="1.9" />
            <text x="33" y="43.8">START</text>
            <circle class="transit-station" cx="39" cy="43" r="1.55" />
            <text x="41.6" y="40.4">RIDGE</text>
            <circle class="transit-station transit-station--secondary" cx="46" cy="52" r="1.55" />
            <text x="48.6" y="52.8">OVERLOOK</text>
            <circle class="transit-station" cx="46" cy="59" r="1.55" />
            <text x="48.6" y="60">CELLAR</text>
            <circle class="transit-station transit-station--secondary" cx="55" cy="77" r="1.55" />
            <text x="52.4" y="75.9" text-anchor="end">VINEYARD</text>
            <circle class="transit-station transit-station--terminal" cx="64" cy="77" r="1.9" />
            <text x="66.8" y="77.8">FINISH</text>
          </g>
        </svg>
        <div
          v-if="composition.id === 'transit-diagram'"
          class="composition-transit-diagram-art"
          data-testid="composition-transit-diagram-art"
          aria-hidden="true"
        >
          <div class="transit-diagram-legend" data-testid="transit-diagram-legend">
            <span class="transit-diagram-badge">T1</span>
            <span class="transit-diagram-line-key">
              <i />
              <b />
              <i />
            </span>
            <span class="transit-diagram-legend-text">45/90 GPX LINE</span>
          </div>
          <div class="transit-diagram-station-key" data-testid="transit-diagram-station-key">
            <span><i /> START</span>
            <span><i /> STOP</span>
            <span><i /> FINISH</span>
          </div>
        </div>
        <div
          v-if="isUsgsHeritageTheme && compositionDecor.kicker"
          class="usgs-heritage-map-label usgs-heritage-map-label--coord"
          :class="{ 'editable-text': slotEditable('composition_kicker'), 'is-selected-text': isSlotActive('composition_kicker') }"
          :contenteditable="slotEditable('composition_kicker') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Map coordinate label"
          enterkeyhint="done"
          spellcheck="false"
          data-testid="usgs-heritage-coordinate"
          :data-poster-element-id="slotEditorElementId('composition_kicker')"
          @pointerdown.stop
          @focus="onSlotFocus($event, 'composition_kicker')"
          @blur="onSlotBlur($event, 'composition_kicker')"
          @click="onSlotClick($event, 'composition_kicker')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.kicker }}</div>
        <div
          v-if="isUsgsHeritageTheme && compositionDecor.meta"
          class="usgs-heritage-map-label usgs-heritage-map-label--scale"
          :class="{ 'editable-text': slotEditable('composition_meta'), 'is-selected-text': isSlotActive('composition_meta') }"
          :contenteditable="slotEditable('composition_meta') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Map scale label"
          enterkeyhint="done"
          spellcheck="false"
          data-testid="usgs-heritage-scale"
          :data-poster-element-id="slotEditorElementId('composition_meta')"
          @pointerdown.stop
          @focus="onSlotFocus($event, 'composition_meta')"
          @blur="onSlotBlur($event, 'composition_meta')"
          @click="onSlotClick($event, 'composition_meta')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.meta }}</div>
        <div
          v-if="isClassicTrailTheme && compositionDecor.kicker"
          class="classic-trail-map-label classic-trail-map-label--coord"
          data-testid="classic-trail-coordinate"
          aria-hidden="true"
        >
          {{ compositionDecor.kicker }}
        </div>
        <div
          v-if="isClassicTrailTheme && compositionDecor.meta"
          class="classic-trail-map-label classic-trail-map-label--scale"
          data-testid="classic-trail-scale"
          aria-hidden="true"
        >
          {{ compositionDecor.meta }}
        </div>
        <div
          v-if="isUsgsHeritageTheme && usgsCoordinateTicks.length"
          class="usgs-coordinate-ticks"
          data-testid="usgs-coordinate-ticks"
          aria-hidden="true"
        >
          <span
            v-for="tick in usgsCoordinateTicks"
            :key="tick.id"
            class="usgs-coordinate-tick"
            :class="`usgs-coordinate-tick--${tick.id}`"
            data-testid="usgs-coordinate-tick"
          >{{ tick.label }}</span>
        </div>
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

        <!-- Segment draw overlay — point-to-point drawing for geometry-backed segments -->
        <div
          v-if="segmentDrawMode"
          class="absolute top-0 inset-x-0 z-20 flex items-center justify-between pointer-events-none"
          style="padding: 0.8cqh 1.4cqw; background: linear-gradient(to bottom, rgba(45,106,79,0.66) 0%, transparent 100%);"
        >
          <span style="color: white; font-size: 0.85cqh; font-weight: 700; letter-spacing: 0.06em; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
            {{ segmentDrawMode.type === 'new'
              ? `Click points to draw segment · ${segmentDrawPointCount} point${segmentDrawPointCount === 1 ? '' : 's'}`
              : `Click points to extend ${segmentDrawMode.end} · ${segmentDrawPointCount} point${segmentDrawPointCount === 1 ? '' : 's'}` }}
          </span>
          <div class="pointer-events-auto flex items-center gap-1.5">
            <button
              style="background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.4); color: white; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px);"
              :disabled="!canFinishSegmentDraw"
              @click="finishSegmentDraw"
            >Done</button>
            <button
              style="background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.4); color: white; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 600; cursor: pointer; backdrop-filter: blur(4px);"
              @click="emit('segment-draw-cancelled')"
            >Cancel</button>
          </div>
        </div>

        <!-- Segment point editing overlay -->
        <div
          v-if="segmentEditMode"
          class="absolute top-0 inset-x-0 z-20 flex items-center justify-between pointer-events-none"
          style="padding: 0.8cqh 1.4cqw; background: linear-gradient(to bottom, rgba(45,106,79,0.66) 0%, transparent 100%);"
        >
          <span style="color: white; font-size: 0.85cqh; font-weight: 700; letter-spacing: 0.06em; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
            Drag points to edit track · {{ segmentEditPointCount }} point{{ segmentEditPointCount === 1 ? '' : 's' }}
          </span>
          <div class="pointer-events-auto flex items-center gap-1.5">
            <button
              style="background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.4); color: white; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px);"
              @click="emit('segment-edit-cancelled')"
            >Save</button>
          </div>
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
            <div class="legend-swatch" :style="segmentSwatchStyle(seg)" />
            <span class="legend-text">
              <span class="legend-label" :style="legendLabelStyle">{{ seg.name }}</span>
              <span v-if="segmentMetaText(seg)" class="legend-meta" :style="legendMetaStyle">{{ segmentMetaText(seg) }}</span>
            </span>
          </div>
        </div>

        <!-- ── Elevation profile ─────────────────────────────────────────── -->
        <ElevationProfile
          v-if="showOverlayElevationProfile"
          :map="map"
          :style-config="styleConfig"
          placement="map-overlay"
        />

        <!-- ── Leader lines + pin label SVG overlay ──────────────────────── -->
        <svg
          v-if="mapReady && (showLeaderLines || showPinOverlay)"
          class="absolute inset-0 w-full h-full"
          style="z-index: 14; overflow: visible; pointer-events: none;"
        >
          <!-- Pin labels with leader lines (labels are draggable) -->
          <g v-if="showPinOverlay && !isUsgsHeritageTheme && styleConfig.color_theme !== 'classic-trail' && styleConfig.color_theme !== 'editorial-minimal' && styleConfig.color_theme !== 'relief-shaded'">
            <template v-for="pin in pinOverlayItems" :key="pin.id">
              <line
                v-if="pin.label.trim() && composition.id !== 'travel-banner' && composition.id !== 'modernist-block'"
                :x1="pin.dotX" :y1="pin.dotY"
                :x2="pin.labelX" :y2="pin.labelY"
                :stroke="pin.color" :stroke-width="svgLineW"
                :stroke-opacity="pin.opacity * 0.55"
                style="pointer-events: none;"
              />
              <text
                v-if="pin.label.trim() && composition.id !== 'travel-banner' && composition.id !== 'modernist-block'"
                :x="pin.labelX" :y="pin.labelY"
                :text-anchor="pin.anchor"
                :font-size="pinLabelFontSize(pin.id)"
                :font-family="pinLabelFontFamily(pin.id)"
                :fill="pinLabelColor(pin.id)"
                :opacity="pinLabelOpacity(pin.id, pin.opacity)"
                :stroke="pinLabelHaloColor"
                stroke-width="3"
                paint-order="stroke fill"
                :font-weight="pinLabelWeight(pin.id)"
                :font-style="pinLabelItalic(pin.id)"
                :letter-spacing="pinLabelLetterSpacing"
                dominant-baseline="middle"
                :data-testid="`pin-label-${pin.id}`"
                :style="editable ? 'pointer-events: all; cursor: grab; user-select: none;' : 'pointer-events: none;'"
                :class="{ 'is-selected-svg-text': activeTextTarget?.type === 'slot' && activeTextTarget.slot === pinSlot(pin.id) }"
                @click.stop="onPinLabelClick($event, pin.id)"
                @pointerdown.stop="editable && startLabelDrag($event, pin.id as 'start' | 'finish')"
                @pointermove="draggingPin === pin.id && onLabelDragMove($event)"
                @pointerup="draggingPin === pin.id && onLabelDragEnd($event)"
                @pointercancel="draggingPin = null"
              >{{ pinLabelDisplayText(pin.label) }}</text>
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
                :dominant-baseline="item.meta ? 'auto' : 'middle'"
                :style="editable ? 'pointer-events: all; cursor: grab; user-select: none;' : 'pointer-events: none;'"
                @pointerdown.stop="editable && startLeaderDrag($event, item.id)"
                @pointermove="isLeaderDragActive(item.id) && onLeaderDragMove($event)"
                @pointerup="isLeaderDragActive(item.id) && onLeaderDragEnd($event)"
                @pointercancel="cancelLeaderDrag"
              >
                <tspan :x="item.labelX" :dy="item.meta ? '-0.35em' : '0'">{{ item.name }}</tspan>
                <tspan
                  v-if="item.meta"
                  :x="item.labelX"
                  dy="1.25em"
                  :font-size="item.fontSize * 0.72"
                  font-weight="600"
                  letter-spacing="0.04em"
                >{{ item.meta }}</tspan>
              </text>
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

      <!-- ── Elevation profile band ─────────────────────────────────────── -->
      <div
        v-if="showSeparateElevationProfile"
        class="relative shrink-0 overflow-hidden"
        :style="elevationProfileBandStyle"
        data-testid="elevation-profile-band"
      >
        <ElevationProfile
          :map="map"
          :style-config="styleConfig"
          placement="separate-band"
        />
        <div
          v-if="showSplitsProfileChrome"
          class="composition-profile-labels"
          data-testid="composition-profile-labels"
          aria-hidden="true"
        >
          <div class="composition-profile-labels__header">
            <span>Elevation Profile</span>
            <strong>{{ profileGainLabel }}</strong>
          </div>
          <div class="composition-profile-labels__axis">
            <span>Start</span>
            <span>High Point</span>
            <span>Finish</span>
          </div>
        </div>
      </div>

      <!-- ── FOOTER BAND ─────────────────────────────────────────────────── -->
      <div
        class="poster-footer shrink-0"
        :class="{
          'is-chrome-grid-mode': chromeGridRendering,
          'is-chrome-elevated-band': chromeBandElevated('footer'),
        }"
        :style="footerBandStyle"
        data-testid="poster-footer"
        @pointerenter="chromeDirectEditing && (hoveredChromeBand = 'footer')"
        @pointerleave="chromeDirectEditing && (hoveredChromeBand = null)"
      >
        <div
          v-if="chromeAffordancesVisible"
          class="chrome-band-layer"
          :class="{ 'is-active': chromeBandActive('footer') }"
          data-testid="chrome-band-footer"
        >
          <button
            v-if="chromeSectionActive('footer')"
            class="chrome-section-chip chrome-section-chip--footer"
            @click.stop="openChromeSection('footer')"
          >Footer</button>
          <button
            v-if="chromeSectionActive('footer')"
            class="chrome-insert-btn chrome-insert-btn--footer"
            title="Add text block"
            @click.stop="addChromeTextBlock('footer')"
          >+</button>
        </div>
        <div
          v-if="chromeGridRendering"
          class="chrome-grid-band chrome-grid-band--footer"
          :class="{
            'is-editable': chromeDirectEditing,
            'is-resizing-columns': activeChromeColumnResize?.band === 'footer',
            'is-resizing-rows': activeChromeRowResize?.band === 'footer',
          }"
          data-testid="chrome-band-footer"
          :style="chromeBandGridStyle('footer')"
          @click.self="selectChromeBand('footer')"
        >
          <div
            v-for="row in chromeRowsFor('footer')"
            :key="row.id"
            class="chrome-grid-row"
            :class="{
              'is-selected': chromeDirectEditing && selectedChromeTarget?.type === 'row' && selectedChromeTarget.band === 'footer' && selectedChromeTarget.rowId === row.id,
              'has-selected-cell': chromeDirectEditing && selectedChromeTarget?.type === 'cell' && selectedChromeTarget.band === 'footer' && selectedChromeTarget.rowId === row.id,
              'is-resizing-row': chromeDirectEditing && activeChromeRowResize?.band === 'footer' && activeChromeRowResize.rowId === row.id,
            }"
            :style="chromeRowStyle(row)"
            :data-chrome-row-id="row.id"
            @click.stop="selectChromeRow('footer', row.id)"
          >
            <div
              v-for="cell in chromeCellsFor(row)"
              :key="cell.id"
              class="chrome-grid-cell"
              :class="{
                'is-selected': chromeDirectEditing && selectedChromeTarget?.type === 'cell' && selectedChromeTarget.band === 'footer' && selectedChromeTarget.rowId === row.id && selectedChromeTarget.cellId === cell.id,
                'is-resizing-col': chromeDirectEditing && activeChromeColumnResize?.band === 'footer' && activeChromeColumnResize.rowId === row.id && activeChromeColumnResize.cellId === cell.id,
                'is-empty': !cell.block || cell.block.empty,
                'is-spacer': isChromeSpacerCell(cell),
              }"
              :style="chromeCellStyle(cell)"
              :data-chrome-cell-id="cell.id"
              @click.stop="selectChromeCellFromInteraction('footer', row.id, cell.id)"
            >
              <button
                v-if="chromeStructureEditing && (chromeCellSelected('footer', row.id, cell.id) || isChromeSpacerCell(cell))"
                class="chrome-cell-trash"
                :class="{ 'is-passive': !chromeCellSelected('footer', row.id, cell.id) }"
                :data-testid="chromeCellSelected('footer', row.id, cell.id) ? 'chrome-cell-trash' : undefined"
                :title="isChromeSpacerCell(cell) ? 'Remove spacer' : cell.block && !cell.block.empty ? 'Delete text' : 'Remove cell'"
                aria-label="Delete selected cell"
                @pointerdown.prevent.stop="trashChromeCell('footer', row.id, cell.id)"
                @click.prevent.stop="trashChromeCell('footer', row.id, cell.id)"
              >
                <UIcon name="i-heroicons-trash" class="chrome-cell-trash-icon" />
              </button>
              <div
                v-if="isChromeSpacerCell(cell)"
                class="chrome-grid-spacer"
                :data-chrome-block-id="cell.block?.id"
                role="separator"
                :aria-label="cell.block?.label ?? 'Spacer'"
                @pointerdown.stop="selectChromeCellFromInteraction('footer', row.id, cell.id)"
                @click.stop="selectChromeCellFromInteraction('footer', row.id, cell.id)"
              >
                <span>{{ cell.block?.label ?? 'Spacer' }}</span>
              </div>
              <div
                v-else-if="cell.block && !cell.block.empty && (!cell.block.slot || compositionAllowsSlot(cell.block.slot))"
                class="chrome-grid-block"
                :class="[
                  `chrome-grid-block--${cell.block.kind}`,
                  cell.block.slot ? `chrome-grid-block--slot-${chromeSlotClass(cell.block.slot)}` : '',
                  { 'editable-text': chromeDirectEditing && chromeBlockEditable(cell.block) },
                ]"
                :style="chromeGridBlockStyle(cell)"
                :contenteditable="editable && chromeDirectEditing && chromeBlockEditable(cell.block) ? 'true' : 'false'"
                :suppressContentEditableWarning="true"
                role="textbox"
                :aria-label="chromeBlockLabel(cell.block)"
                :data-chrome-block-id="cell.block.id"
                :data-chrome-slot="cell.block.slot"
                :data-chrome-kind="cell.block.kind"
                :data-poster-element-id="cell.block.slot ? slotEditorElementId(cell.block.slot) : undefined"
                :data-riso-title="cell.block.kind === 'title' ? chromeBlockText(cell.block) : undefined"
                @pointerdown.stop="selectChromeCellFromInteraction('footer', row.id, cell.id)"
                @focus="onChromeGridBlockFocus($event, 'footer', row.id, cell.id)"
                @click.stop="selectChromeCellFromInteraction('footer', row.id, cell.id)"
                @blur="onChromeGridBlockBlur($event, 'footer', row.id, cell.id)"
                @keydown.enter.exact.prevent="finishActiveTextEdit"
              >{{ chromeBlockText(cell.block) }}</div>
              <button
                v-else-if="chromeStructureEditing"
                class="chrome-empty-cell-btn"
                title="Add text"
                @click.stop="addChromeTextToCell('footer', row.id, cell.id)"
              >+</button>
              <button
                v-if="chromeStructureEditing && canInsertColumnAfter(row, cell)"
                class="chrome-cell-add-col chrome-cell-add-col--right"
                :class="{ 'chrome-cell-add-col--after-resize': canResizeChromeCell(row, cell) }"
                data-testid="chrome-cell-add-column"
                title="Add column after this cell"
                aria-label="Add column after this cell"
                @pointerdown.prevent.stop="addColumnAfter('footer', row.id, cell.id)"
                @click.stop
              >
                <UIcon name="i-heroicons-plus" class="chrome-cell-add-col-icon" />
              </button>
              <button
                v-if="chromeStructureEditing && canResizeChromeCell(row, cell)"
                class="chrome-cell-resize-col"
                data-testid="chrome-cell-resize-column"
                title="Drag to resize column"
                @pointerdown.prevent.stop="startChromeColumnResize($event, 'footer', row.id, cell.id)"
                @click.stop
              />
            </div>
            <button
              v-if="chromeStructureEditing"
              class="chrome-row-add-row"
              data-testid="chrome-row-add-row"
              title="Add row below"
              aria-label="Add row below"
              @pointerdown.prevent.stop="addRowAfter('footer', row.id)"
              @click.stop
            >
              <UIcon name="i-heroicons-plus" class="chrome-row-add-row-icon" />
            </button>
            <button
              v-if="chromeStructureEditing && canResizeChromeRowEdge('footer', row, 'top')"
              class="chrome-row-resize-row chrome-row-resize-row--top"
              data-testid="chrome-row-resize-row"
              data-edge="top"
              title="Drag to adjust top spacing"
              aria-label="Adjust row top spacing"
              @pointerdown.prevent.stop="startChromeRowResize($event, 'footer', row.id, 'top')"
              @click.stop
            />
            <button
              v-if="chromeStructureEditing && canResizeChromeRowEdge('footer', row, 'bottom')"
              class="chrome-row-resize-row chrome-row-resize-row--bottom"
              data-testid="chrome-row-resize-row"
              data-edge="bottom"
              title="Drag to adjust bottom spacing"
              aria-label="Adjust row bottom spacing"
              @pointerdown.prevent.stop="startChromeRowResize($event, 'footer', row.id, 'bottom')"
              @click.stop
            />
          </div>
          <button v-if="chromeStructureEditing" class="chrome-band-add-row" data-testid="chrome-band-add-row" @pointerdown.prevent.stop="addRowAfter('footer')" @click.stop>Row +</button>
        </div>
        <div class="poster-footer-rule" :style="footerRuleStyle" data-testid="poster-footer-rule" />
        <div
          v-if="compositionDecor.footerNote && chromeSlotVisible('composition_footer')"
          class="composition-footer-note"
          :class="{ 'editable-text': slotEditable('composition_footer'), 'is-selected-text': isSlotActive('composition_footer') }"
          :style="compositionFooterNoteStyle"
          :contenteditable="slotEditable('composition_footer') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Composition footer note"
          enterkeyhint="done"
          spellcheck="true"
          data-testid="composition-footer-note"
          :data-poster-element-id="slotEditorElementId('composition_footer')"
          @focus="onSlotFocus($event, 'composition_footer')"
          @blur="onSlotBlur($event, 'composition_footer')"
          @click="onSlotClick($event, 'composition_footer')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ compositionDecor.footerNote }}</div>
        <div
          v-if="composition.id === 'brutalist-slab' && chromeSlotVisible('distance')"
          class="composition-brutalist-distance editable-text"
          :class="{ 'is-selected-text': isSlotActive('distance') }"
          :contenteditable="slotEditable('distance') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Distance"
          enterkeyhint="done"
          spellcheck="false"
          data-testid="composition-brutalist-distance"
          :data-poster-element-id="slotEditorElementId('distance')"
          @focus="onSlotFocus($event, 'distance')"
          @blur="onSlotBlur($event, 'distance')"
          @click="onSlotClick($event, 'distance')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ brutalistDistanceText }}</div>
        <div
          v-if="composition.id === 'riso-stack'"
          class="composition-riso-caption"
          data-testid="composition-riso-caption"
        >
          <strong>{{ risoCaptionText }}</strong>
          <span>{{ risoLocationText }}</span>
        </div>
        <div
          v-if="composition.id === 'riso-stack'"
          class="composition-riso-meta"
          data-testid="composition-riso-meta"
        >
          <span>{{ risoMetaLabel }}</span>
          <span>{{ formattedDistance ? `${formattedDistance} mi` : compositionDecor.meta }}</span>
        </div>
        <div
          v-if="showTechnicalDataFooter"
          class="composition-technical-data-footer"
          data-testid="composition-technical-data-footer"
        >
          <div
            v-for="item in technicalDataFooterItems"
            :key="item.label"
            class="composition-technical-data-item"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div
          v-if="showMoonstoneTechnicalFooter"
          class="composition-technical-line-footer"
          data-testid="composition-technical-line-footer"
        >
          <span>DIST {{ formattedDistanceKm }} km</span>
          <span>GAIN {{ formattedGainM }} m</span>
          <span>{{ formattedMonthYear }}</span>
        </div>
        <div
          v-if="showBibDataFooter"
          class="composition-bib-data-footer"
          data-testid="composition-bib-data-footer"
          aria-label="Race bib footer data"
        >
          <span
            v-for="item in marathonBibFooterItems"
            :key="item"
            class="composition-bib-data-footer__item"
          >{{ item }}</span>
        </div>

        <!-- Logo: footer-left position -->
        <img
          v-if="showLegacyLogo && styleConfig.logo_position === 'footer-left'"
          :src="styleConfig.logo_url"
          alt=""
          :style="logoFooterStyle"
        />

        <!-- Stat blocks (left) -->
        <div v-if="!showTechnicalDataFooter && !hideGenericFooterStats" class="poster-stats" :style="posterStatsStyle">
          <div
            v-if="showDistanceSlot"
            class="stat-block editable-text"
            :class="{ 'is-selected-text': isSlotActive('distance') }"
            :contenteditable="slotEditable('distance') ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Distance"
            enterkeyhint="done"
            spellcheck="true"
            :data-poster-element-id="slotEditorElementId('distance')"
            @focus="onSlotFocus($event, 'distance')"
            @blur="onSlotBlur($event, 'distance')"
            @click="onSlotClick($event, 'distance')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span v-if="isBlueprintTheme && !hasTextOverride('distance')" class="stat-custom-text" :style="blueprintTitleblockStatStyle('distance')">DIST {{ formattedDistance }} mi</span>
            <span v-else-if="hasTextOverride('distance')" class="stat-custom-text" :style="statCustomTextStyle('distance')">{{ distanceText }}</span>
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
            :contenteditable="slotEditable('elevation_gain') ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Elevation gain"
            enterkeyhint="done"
            spellcheck="true"
            :data-poster-element-id="slotEditorElementId('elevation_gain')"
            @focus="onSlotFocus($event, 'elevation_gain')"
            @blur="onSlotBlur($event, 'elevation_gain')"
            @click="onSlotClick($event, 'elevation_gain')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span v-if="isBlueprintTheme && !hasTextOverride('elevation_gain')" class="stat-custom-text" :style="blueprintTitleblockStatStyle('elevation_gain')">GAIN {{ formattedGain }} ft</span>
            <span v-else-if="hasTextOverride('elevation_gain')" class="stat-custom-text" :style="statCustomTextStyle('elevation_gain')">{{ elevationGainText }}</span>
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
            :contenteditable="slotEditable('date') ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Date"
            enterkeyhint="done"
            spellcheck="true"
            :data-poster-element-id="slotEditorElementId('date')"
            @focus="onSlotFocus($event, 'date')"
            @blur="onSlotBlur($event, 'date')"
            @click="onSlotClick($event, 'date')"
            @keydown.enter.exact.prevent="finishActiveTextEdit"
          >
            <span class="stat-custom-text" :style="isBlueprintTheme ? blueprintTitleblockStatStyle('date') : statCustomTextStyle('date')">{{ dateText }}</span>
          </div>

          <div v-if="showCoordinatesSlot && (showDistanceSlot || showElevationGainSlot || showDateSlot)" class="stat-divider" :style="dividerStyle" />

          <div
            v-if="showCoordinatesSlot"
            class="stat-block stat-block--coords editable-text"
            :class="{ 'is-selected-text': isSlotActive('coordinates') }"
            :contenteditable="slotEditable('coordinates') ? 'true' : 'false'"
            :suppressContentEditableWarning="true"
            role="textbox"
            aria-label="Coordinates"
            enterkeyhint="done"
            spellcheck="true"
            :data-poster-element-id="slotEditorElementId('coordinates')"
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
          v-if="showOccasionSlot && occasionText && !editable && chromeSlotVisible('occasion_text')"
          class="poster-occasion"
          :style="occasionStyle"
        >{{ occasionText }}</p>
        <p
          v-else-if="showOccasionSlot && editable && chromeSlotVisible('occasion_text')"
          class="poster-occasion editable-text"
          :class="{ 'is-selected-text': isSlotActive('occasion_text') }"
          :style="{ ...occasionStyle, minWidth: '4cqw', minHeight: '1.2cqh' }"
          :contenteditable="slotEditable('occasion_text') ? 'true' : 'false'"
          :suppressContentEditableWarning="true"
          role="textbox"
          aria-label="Occasion"
          enterkeyhint="done"
          spellcheck="true"
          :data-poster-element-id="slotEditorElementId('occasion_text')"
          @focus="onSlotFocus($event, 'occasion_text')"
          @blur="onSlotBlur($event, 'occasion_text')"
          @click="onSlotClick($event, 'occasion_text')"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ occasionText }}</p>

        <!-- RadMaps mark (right) -->
        <div v-if="styleConfig.show_branding !== false && chromeBrandVisible && !showTechnicalDataFooter && !hideGenericFooterStats" class="poster-mark">
          <svg viewBox="0 0 32 32" fill="none" class="mark-svg" :style="{ color: styleConfig.label_text_color, opacity: '0.4' }">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.9" fill="none"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.65" fill="none" opacity="0.6"/>
            <circle cx="11" cy="8" r="1.1" fill="currentColor"/>
          </svg>
          <span class="mark-label" :style="markLabelStyle">RADMAPS</span>
          <span class="branding-note" :style="brandingNoteStyle">radmaps.studio</span>
        </div>

        <div
          v-for="block in customChromeBlocks('footer')"
          :key="block.id"
          class="chrome-custom-block editable-text"
          :class="{ 'is-selected-text': activeChromeBlockId === block.id }"
          :style="chromeCustomBlockStyle('footer', block)"
          contenteditable="true"
          :suppressContentEditableWarning="true"
          role="textbox"
          :aria-label="chromeBlockLabel(block)"
          data-testid="chrome-custom-block"
          @focus="onCustomChromeFocus($event, block.id)"
          @blur="onCustomChromeBlur($event, block.id)"
          @click.stop="onCustomChromeClick($event, block.id)"
          @keydown.enter.exact.prevent="finishActiveTextEdit"
        >{{ chromeBlockText(block) }}</div>

      </div>

      <!-- ── Image overlays (poster-level — can span header, map, footer) ─── -->
      <div
        v-if="visibleImageAssets.length > 0"
        class="asset-layer"
        style="pointer-events: none;"
        @click.self="selectedAssetId = null"
      >
        <div
          v-for="asset in visibleImageAssets"
          :key="asset.id"
          :data-asset-id="asset.id"
          :data-poster-element-id="freeOverlayEditorBlocked ? undefined : `asset:${asset.id}`"
          class="image-asset"
          :class="{
            'is-editable': editable && !freeOverlayEditorBlocked,
            'is-selected': editable && !freeOverlayEditorBlocked && (selectedAssetId === asset.id || selectedPosterElementId === `asset:${asset.id}`),
            'is-dragging': editable && !freeOverlayEditorBlocked && draggingAssetId === asset.id,
            'is-poster-v2': posterElementsEditing,
          }"
          :style="imageAssetStyle(asset)"
          :tabindex="editable && !freeOverlayEditorBlocked ? 0 : undefined"
          @click.stop="editable && !freeOverlayEditorBlocked ? onAssetClick(asset.id, $event) : undefined"
        >
          <img :src="asset.render_url" alt="" draggable="false" />
          <template v-if="editable && !posterElementsEditing">
            <div
              class="overlay-move-handle"
              title="Drag to move"
              @pointerdown.prevent
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

      <!-- ── Icon overlays (poster-level local SVG marks) ───────────────────── -->
      <div
        v-if="visibleIconOverlays.length > 0"
        class="icon-layer"
        style="pointer-events: none;"
      >
        <div
          v-for="icon in visibleIconOverlays"
          :key="icon.id"
          :data-icon-id="icon.id"
          :data-poster-element-id="guidedPosterEditor ? undefined : `icon:${icon.id}`"
          class="icon-overlay"
          :class="{
            'is-editable': editable && !guidedPosterEditor,
            'is-selected': editable && !guidedPosterEditor && selectedPosterElementId === `icon:${icon.id}`,
            'is-poster-v2': posterElementsEditing,
          }"
          :style="iconOverlayStyle(icon)"
          :tabindex="editable && !guidedPosterEditor ? 0 : undefined"
          @click.stop="editable && !guidedPosterEditor ? onIconClick(icon.id) : undefined"
        >
          <svg :viewBox="getPosterIcon(icon.icon).viewBox" aria-hidden="true" focusable="false">
            <path
              v-for="path in getPosterIcon(icon.icon).paths"
              :key="path"
              :d="path"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      <!-- ── Text overlays (poster-level — can span header, map, footer) ──── -->
      <div
        v-if="visibleTextOverlays.length > 0"
        class="overlay-layer"
        style="pointer-events: none;"
        @click.self="selectedOverlayId = null"
      >
        <div
          v-for="overlay in visibleTextOverlays"
          :key="overlay.id"
          :data-overlay-id="overlay.id"
          :data-poster-element-id="freeOverlayEditorBlocked ? undefined : `text:${overlay.id}`"
          class="text-overlay"
          :class="{ 'is-editable': editable && !freeOverlayEditorBlocked, 'is-selected': editable && !freeOverlayEditorBlocked && (selectedOverlayId === overlay.id || selectedPosterElementId === `text:${overlay.id}`), 'is-poster-v2': posterElementsEditing }"
          :style="overlayStyle(overlay)"
          @click.stop="editable && !freeOverlayEditorBlocked ? onOverlayClick(overlay.id) : undefined"
        >
          <span
            class="overlay-content editable-text"
            :contenteditable="editable && !freeOverlayEditorBlocked ? 'true' : 'false'"
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
          <template v-if="editable && !posterElementsEditing">
            <div
              class="overlay-move-handle"
              title="Drag to move"
              @pointerdown.prevent
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
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom'
// maplibre-contour 0.1.0 has a broken package `exports` map, so the bare
// specifier cannot be resolved in the browser. Import the built ESM file
// directly and keep it excluded from Vite optimizeDeps in nuxt.config.ts.
// @ts-expect-error maplibre-contour does not publish declarations for this direct build-file import.
import mlContour from '../../node_modules/maplibre-contour/dist/index.mjs'
import { buildMapStyle, contourMajorLineWidthExpression, contourMidLineWidthExpression, contourMinorLineOpacityExpression, contourMinorLineWidthExpression, mapBackgroundColor, resolveAdaptiveContourOverzoom, resolveAdaptiveContourReliefProfile, resolveAdaptiveContourStyleConfig, resolveAdaptiveContourThresholds, resolveTonerRouteStyle, shouldRenderPrimaryRoute, styleUsesContours, TONER_DOT_PATTERN_ID_PREFIX, TONER_DOT_PATTERN_IDS } from '~/utils/mapStyle'
import { excludeRangesFromRoute, trailSourceId, findRoutePercent, getAllRouteCoords, getRouteEndpoints, deletedRangesFromRouteIndexes, routeRangesToGeojson, distanceMeters, DEFAULT_COORD_GAP_THRESHOLD_METERS, resolveTrailSegmentGeojson, trailSegmentEndpointFeatures, segmentSourceGeojson, unionBboxes, lineStringFeatureCollection, routeStatsForCoords, coordsHaveElevation, normalizeLineCoords, bendSegmentGeojson, sanitizeSegmentBends } from '~/utils/trail'
import { getPosterTypography, getPosterLayout, toFontStack } from '~/utils/posterData'
import { getPosterCompositionProfile, posterCompositionClassName } from '~/utils/posterCompositions'
import { CHROME_BANDS, CHROME_BLOCK_KIND_LABELS, bandsToAnchorFrames, clampChromeBandHeight, effectivePosterLayout, patchPosterLayout } from '~/utils/posterLayout'
import { leaderAnchorCoord } from '~/utils/render/overlayLayout'
import { applyViewportScaleToStyle, applyViewportZoomCompensationToStyle, getViewportVisualScale, VIEWPORT_SCALED_LAYOUT_PROPERTIES, VIEWPORT_SCALED_PAINT_PROPERTIES } from '~/utils/render/viewportScale'
import { shouldExpectPrimaryRouteContent } from '~/utils/render/routeReadiness'
import { buildTransitDiagramGeojson, buildTransitStationGeojson } from '~/utils/transitDiagram'
import { getGraphFullReloadFields } from '~/utils/styleLayerGraph'
import { pickContrastSafeColor } from '~/utils/colorContrast'
import { DEFAULT_ROUTE_CASING_WIDTH, DEFAULT_ROUTE_WIDTH, DEFAULT_SEGMENT_CASING_WIDTH } from '~/types'
import type { AnchorFrame, ChromeBand, ChromeBandId, ChromeBlock, ChromeGridCell, ChromeGridRow, DeletedRange, IconOverlay, MapAsset, PartialPosterLayout, PosterTextOverride, PosterTextSlot, RouteStats, StyleConfig, TrailMap, TrailSegment, TextOverlay } from '~/types'
import { classifyAssetQuality, computeEffectiveDpi } from '~/utils/imageAssets'
import { getPosterIcon } from '~/utils/posterIcons'
import { computePosterPrintGuardViolations } from '~/utils/posterPrintGuards'
import { resolveFreeOverlayBox } from '~/utils/posterEditorElements'
import type { PosterEditorElementPatch } from '~/utils/posterEditorElements'
import type { PrintFraming } from '~/utils/print/printFraming'
import FreezeControl from '~/components/map/FreezeControl.vue'
import ElevationProfile from '~/components/map/ElevationProfile.vue'
import InlineTextToolbar from '~/components/map/InlineTextToolbar.vue'
import Moveable from 'vue3-moveable'

interface PrintContext {
  framing: PrintFraming
  cssWidthPx: number
  cssHeightPx: number
  deviceScaleFactor: number
}

type SegmentDrawMode =
  | { type: 'new' }
  | { type: 'extend'; segId: string; end: 'start' | 'end' }
type SegmentEditMode = { segId: string }
type PosterEditorMode = 'layout' | 'select' | 'text' | 'image' | 'icon' | 'guides'

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
  editable?: boolean
  mapInteractive?: boolean
  renderMode?: 'editor' | 'print'
  printContext?: PrintContext
  chromeEditing?: boolean
  chromePreview?: boolean
  chromeExternalShell?: boolean
  posterElementsEditing?: boolean
  posterEditorMode?: PosterEditorMode
  posterGuidesVisible?: boolean
  selectedPosterElementId?: string | null
  editableTextSlots?: readonly PosterTextSlot[] | null
  guidedPosterEditor?: boolean
  posterTier2Editor?: boolean
  /** When set, the map enters crosshair mode: user taps to set a segment or crop position */
  plotMode?: { segId: string; field: 'start' | 'end' } | null
  /** When true, the map enters paint-select mode for route deletion */
  deleteBrushActive?: boolean
  /** Brush radius in screen pixels for route deletion selection */
  deleteBrushSize?: number
  /** When set, click points on the map to draw or extend a geometry-backed segment */
  segmentDrawMode?: SegmentDrawMode | null
  /** When set, drag existing points to reshape a geometry-backed segment */
  segmentEditMode?: SegmentEditMode | null
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
  'poster-element-selected': [id: string | null]
  'poster-element-patched': [payload: { id: string; patch: PosterEditorElementPatch }]
  'edit-requested': [payload: { field: 'trail_name' | 'occasion_text' | 'location_text'; value: string }]
  'poster-text-override': [payload: { slot: PosterTextSlot; patch: PosterTextOverride }]
  'poster-text-reset': [slot: PosterTextSlot]
  'poster-layout-updated': [value: PartialPosterLayout | undefined]
  'chrome-selection-changed': [payload:
    | { type: 'band'; band: ChromeBandId }
    | { type: 'row'; band: ChromeBandId; rowId: string }
    | { type: 'cell'; band: ChromeBandId; rowId: string; cellId: string; blockId: string | null }
    | null
  ]
  'freeze-changed': [payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number]; map_editor_width?: number; map_pitch?: number; map_bearing?: number }]
  /** Fired when user taps the route in plot mode; parent should update the segment and clear plotMode */
  'segment-plotted': [payload: { segId: string; field: 'start' | 'end'; pct: number }]
  /** Fired when user cancels plot mode (Escape key or cancel button) */
  'plot-cancelled': []
  /** Fired when user finishes drawing or extending a segment */
  'segment-draw-finished': [payload: { mode: SegmentDrawMode; coords: Array<[number, number]> }]
  /** Fired when user cancels segment draw mode */
  'segment-draw-cancelled': []
  /** Fired when user drag-edits a geometry-backed segment's coordinates */
  'segment-geometry-edited': [payload: { segId: string; coords: number[][]; bends?: number[] }]
  /** Fired when user exits segment point edit mode */
  'segment-edit-cancelled': []
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
const chromeToolbarEl = ref<HTMLElement | null>(null)
const chromeStructurePopoverEl = ref<HTMLElement | null>(null)
const chromeLayoutBuilderEl = ref<HTMLElement | null>(null)
const mapReady = ref(false)
const renderReady = ref(false)
const liveZoom = ref<number | undefined>(undefined)
const mapHovered = ref(false)
const posterElementsEditing = computed(() => props.editable === true && props.posterElementsEditing === true && props.renderMode !== 'print')
const mapViewerInteractive = computed(() => props.editable !== false || props.mapInteractive === true)

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
const devCameraHandleId = Symbol('radmaps-map-camera')
let resizeObserver: ResizeObserver | null = null
let interactInstances: Array<{ unset: () => void }> = []
let sessionFrameWidth: number | null = null
let styleReloadCameraHold: MapCameraSnapshot | null = null
let styleReloadCameraHoldTimer: ReturnType<typeof setTimeout> | null = null

// ── Plot mode (map-tap segment/crop position picking) ─────────────────────────
let plotGhostMarker: maplibregl.Marker | null = null
let plotAnimFrame = 0
let plotRouteCoords: number[][] = []
let segmentDrawDisabledDoubleClickZoom = false
const segmentDrawCoords = ref<Array<[number, number]>>([])
const segmentDrawPointCount = computed(() => segmentDrawCoords.value.length)
const canUndoSegmentDrawPoint = computed(() => Boolean(props.segmentDrawMode && segmentDrawCoords.value.length > 0))
const segmentEditCoords = ref<number[][]>([])
const segmentEditBends = ref<number[]>([])
const segmentEditPointCount = computed(() => segmentEditCoords.value.length)
let segmentEditDragIndex: number | null = null
let segmentEditDragChanged = false
let segmentBendDrag: { index: number; startSignedPx: number; initialBend: number } | null = null
let segmentBendDragChanged = false
const canFinishSegmentDraw = computed(() => {
  if (!props.segmentDrawMode) return false
  return props.segmentDrawMode.type === 'new'
    ? segmentDrawCoords.value.length >= 2
    : segmentDrawCoords.value.length >= 1
})

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
const contourViewStats = ref<Partial<RouteStats> | null>(null)
let contourViewRefreshTimer: ReturnType<typeof setTimeout> | null = null
let contourProfileReloading = false

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

function activeContourStats(): Partial<RouteStats> | null | undefined {
  return contourViewStats.value ?? props.map.stats
}

function getContourTileUrl(cfg: StyleConfig): string | undefined {
  if (!styleUsesContours(cfg) || !mlDemSource) return undefined
  const thresholds = resolveAdaptiveContourThresholds(cfg, activeContourStats())
  return mlDemSource.contourProtocolUrl({
    thresholds,
    overzoom: resolveAdaptiveContourOverzoom(cfg),
  })
}

type ActiveTextTarget =
  | { type: 'slot'; slot: PosterTextSlot }
  | { type: 'overlay'; id: string }

const activeTextTarget = ref<ActiveTextTarget | null>(null)
const activeTextAnchor = ref<DOMRect | null>(null)
const activeChromeBlockId = ref<string | null>(null)
const posterMoveableTarget = ref<HTMLElement | null>(null)
const moveableResizePreview = ref<{ id: string; width: number; height: number } | null>(null)
const moveableTextResizePreview = ref<{ id: string; font_size: number } | null>(null)
const moveableSlotResizePreview = ref<{ slot: PosterTextSlot; font_size_pt: number } | null>(null)
const hoveredChromeBand = ref<ChromeBandId | null>(null)
const chromeMobile = ref(false)
const chromePaddingPanelOpen = ref(false)
const chromeAddPanelOpen = ref(false)
const lastChromeTextStyle = ref<Partial<ChromeBlock> | null>(null)
type ChromeSelection =
  | { type: 'band'; band: ChromeBandId }
  | { type: 'row'; band: ChromeBandId; rowId: string }
  | { type: 'cell'; band: ChromeBandId; rowId: string; cellId: string }
type ChromeRowResizeEdge = 'top' | 'bottom'
const selectedChromeTarget = ref<ChromeSelection | null>(null)
function emitChromeSelectionChanged(target: ChromeSelection | null) {
  if (!chromeDirectEditing.value || !target) {
    emit('chrome-selection-changed', null)
    return
  }
  if (target.type === 'cell') {
    emit('chrome-selection-changed', {
      ...target,
      blockId: findChromeCell(target.band, target.rowId, target.cellId)?.block?.id ?? null,
    })
    return
  }
  emit('chrome-selection-changed', target)
}
const chromePaddingSides = [
  { key: 'top', name: 'top', label: 'Top', index: 0 },
  { key: 'right', name: 'right', label: 'Right', index: 1 },
  { key: 'bottom', name: 'bottom', label: 'Bottom', index: 2 },
  { key: 'left', name: 'left', label: 'Left', index: 3 },
] as const
const activeChromeBandResize = ref<{
  band: Extract<ChromeBandId, 'header' | 'footer'>
  startY: number
  startHeight: number
  posterHeight: number
} | null>(null)
const activeChromeColumnResize = ref<{
  band: ChromeBandId
  rowId: string
  cellId: string
  nextCellId: string
  startX: number
  rowWidth: number
  startFr: number
  nextFr: number
  totalFr: number
} | null>(null)
const activeChromeRowResize = ref<{
  band: ChromeBandId
  rowId: string
  adjacentRowId?: string
  edge: ChromeRowResizeEdge
  startY: number
  startFr: number
  adjacentStartFr?: number
  startBandHeight: number
  frUnitPx: number
  posterHeight: number
  startRows: ChromeGridRow[]
} | null>(null)

const chromeGridRendering = computed(() =>
  Boolean(props.editable && props.chromeEditing && !isPrintRender.value),
)
const chromeDirectEditing = computed(() =>
  chromeGridRendering.value && props.chromePreview !== true,
)
const guidedPosterEditor = computed(() =>
  Boolean(props.guidedPosterEditor && posterElementsEditing.value),
)
const tier2PosterEditor = computed(() =>
  Boolean(props.posterTier2Editor && posterElementsEditing.value),
)
const freeOverlayEditorBlocked = computed(() =>
  guidedPosterEditor.value && !tier2PosterEditor.value,
)
const chromeStructureEditing = computed(() =>
  chromeDirectEditing.value && !guidedPosterEditor.value,
)
const chromeInternalShellVisible = computed(() =>
  chromeDirectEditing.value && props.chromeExternalShell !== true,
)
const chromeToolbarVisible = computed(() =>
  chromeInternalShellVisible.value && !posterElementsEditing.value && !chromeMobile.value && activeChromeBlock.value != null && !isChromeSpacerBlock(activeChromeBlock.value),
)
const chromeStructurePopoverVisible = computed(() =>
  chromeInternalShellVisible.value && !posterElementsEditing.value && !chromeMobile.value && selectedChromeTarget.value?.type === 'cell',
)
const chromeLayoutBuilderVisible = computed(() =>
  chromeInternalShellVisible.value && !chromeMobile.value,
)
const chromeContextToolbarVisible = computed(() =>
  chromeLayoutBuilderVisible.value && selectedChromeTarget.value != null && (!guidedPosterEditor.value || activeChromeBlock.value != null),
)
const chromeToolbarFloatingStyle = ref<Record<string, string>>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  width: '508px',
  visibility: 'hidden',
})
const chromeLayoutBuilderFloatingStyle = ref<Record<string, string>>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  visibility: 'hidden',
  transform: 'none',
})
const chromeLayoutBuilderPopoverVertical = ref<'top' | 'bottom'>('bottom')
const chromeLayoutBuilderPopoverAlign = ref<'left' | 'right'>('right')
const chromeStructurePopoverFloatingStyle = ref<Record<string, string>>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  visibility: 'hidden',
})
const chromeToolbarPointerFloatingStyle = ref<Record<string, string>>({
  left: '50%',
  top: '100%',
  bottom: 'auto',
  borderWidth: '7px 6px 0 6px',
  borderColor: '#fff transparent transparent transparent',
})
const chromeToolbarPlacement = ref('top')
const chromeContextToolbarManualPosition = ref<{ left: number; top: number } | null>(null)
const activeChromeContextToolbarDrag = ref<{
  startX: number
  startY: number
  startLeft: number
  startTop: number
} | null>(null)
const chromeAffordancesVisible = computed(() => false)
const chromeMobileDrawerOpen = computed(() =>
  chromeInternalShellVisible.value && chromeMobile.value && activeChromeBlock.value != null,
)

const posterLayout = computed(() => effectivePosterLayout(props.styleConfig, props.map.stats))
const posterAnchorFrames = computed<AnchorFrame[]>(() =>
  posterLayout.value.anchors?.length
    ? posterLayout.value.anchors
    : bandsToAnchorFrames(posterLayout.value),
)
let cleanupChromeToolbarFloating: (() => void) | null = null
let cleanupChromeStructureFloating: (() => void) | null = null
let cleanupChromeLayoutBuilderFloating: (() => void) | null = null

function syncChromeViewportMode() {
  if (typeof window === 'undefined') return
  chromeMobile.value = window.matchMedia('(max-width: 767px)').matches
}

onMounted(() => {
  syncChromeViewportMode()
  window.addEventListener('resize', syncChromeViewportMode)
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  nextTick(() => {
    syncPosterMoveableTarget()
    requestAnimationFrame(syncPosterMoveableTarget)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', syncChromeViewportMode)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  cleanupChromeFloating()
  teardownChromeContextToolbarDrag()
  teardownChromeBandResize()
  teardownChromeColumnResize()
  teardownChromeRowResize()
})

function bandAnchorFrame(band: ChromeBandId): AnchorFrame | null {
  return posterAnchorFrames.value.find(anchor => anchor.id === `band-${band}` && anchor.displacesMap) ?? null
}

function chromeRowsFor(band: ChromeBandId) {
  return (bandAnchorFrame(band)?.rows ?? posterLayout.value.bands[band].rows).filter(row => !row.deleted)
}

function chromeCellsFor(row: ChromeGridRow) {
  return row.cells.filter(cell => !cell.deleted)
}

function chromeCellSelected(band: ChromeBandId, rowId: string, cellId: string) {
  return selectedChromeTarget.value?.type === 'cell'
    && selectedChromeTarget.value.band === band
    && selectedChromeTarget.value.rowId === rowId
    && selectedChromeTarget.value.cellId === cellId
}

function canInsertColumnAfter(_row: ChromeGridRow, cell: ChromeGridCell) {
  return !cell.deleted
}

function canResizeChromeCell(row: ChromeGridRow, cell: ChromeGridCell) {
  const cells = chromeCellsFor(row)
  return cells.length > 1 && cells.findIndex(item => item.id === cell.id) < cells.length - 1
}

function canResizeChromeRowEdge(band: ChromeBandId, row: ChromeGridRow, edge: ChromeRowResizeEdge) {
  const rows = chromeRowsFor(band)
  const index = rows.findIndex(item => item.id === row.id)
  if ((band !== 'header' && band !== 'footer') || index < 0) return false
  return edge === 'top' ? index > 0 : true
}

function chromeBlocksFor(band: ChromeBandId) {
  return chromeRowsFor(band).flatMap(row => chromeCellsFor(row).map(cell => cell.block).filter((block): block is ChromeBlock => Boolean(block && !block.deleted)))
}

function chromeBlockForSlot(slot: PosterTextSlot): ChromeBlock | null {
  for (const band of CHROME_BANDS) {
    const found = chromeBlocksFor(band).find(block => block.slot === slot && !block.empty && !block.removed)
    if (found) return found
  }
  return null
}

function chromeBlockForId(id: string | undefined): ChromeBlock | null {
  if (!id) return null
  for (const band of CHROME_BANDS) {
    const found = chromeBlocksFor(band).find(block => block.id === id && !block.empty && !block.removed)
    if (found) return found
  }
  return null
}

function _chromeBandForBlock(id: string | null): ChromeBandId | null {
  if (!id) return null
  for (const band of CHROME_BANDS) {
    if (chromeBlocksFor(band).some(block => block.id === id)) return band
  }
  return null
}

const activeChromeBand = computed<ChromeBandId>(() => selectedChromeTarget.value?.band ?? hoveredChromeBand.value ?? 'header')

const activeChromeBlock = computed(() => {
  const target = selectedChromeTarget.value
  if (target?.type !== 'cell') return null
  return findChromeCell(target.band, target.rowId, target.cellId)?.block ?? null
})

function compositionAllowsSlot(slot: PosterTextSlot) {
  if (slot === 'occasion_text' && !showOccasionSlot.value) return false
  return true
}

function chromeSlotVisible(slot: PosterTextSlot) {
  if (!compositionAllowsSlot(slot)) return false
  return chromeBlockForSlot(slot) != null
}

const chromeBrandVisible = computed(() =>
  !chromeDirectEditing.value && chromeBlocksFor('footer').some(block => block.kind === 'brand' && !block.slot && !block.empty),
)

function customChromeBlocks(_band: ChromeBandId): ChromeBlock[] {
  return []
}

function chromeBandActive(band: ChromeBandId) {
  return hoveredChromeBand.value === band || activeChromeBand.value === band
}

function chromeBandElevated(band: ChromeBandId) {
  return chromeDirectEditing.value && (
    selectedChromeTarget.value?.band === band ||
    activeChromeColumnResize.value?.band === band ||
    activeChromeRowResize.value?.band === band
  )
}

function chromeSectionActive(band: ChromeBandId) {
  return chromeBandActive(band) && activeChromeBlockId.value == null
}

function chromeBandLabel(band: ChromeBandId) {
  if (band === 'railLeft') return 'Left rail'
  if (band === 'railRight') return 'Right rail'
  if (band === 'header') return 'Header'
  if (band === 'footer') return 'Footer'
  return band
}

function chromeBlockLabel(block: ChromeBlock) {
  return CHROME_BLOCK_KIND_LABELS[block.kind] ?? 'Text'
}

function isChromeSpacerBlock(block: ChromeBlock | null | undefined) {
  return block?.kind === 'spacer'
}

function isChromeSpacerCell(cell: ChromeGridCell | null | undefined) {
  return isChromeSpacerBlock(cell?.block) && !cell?.block?.empty && !cell?.block?.deleted && !cell?.block?.removed
}

function isChromeSpacerRow(row: ChromeGridRow | null | undefined) {
  const cells = row ? chromeCellsFor(row) : []
  return cells.length > 0 && cells.every(isChromeSpacerCell)
}

function firstChromeContentRow(band: ChromeBandId) {
  const rows = chromeRowsFor(band)
  return rows.find(row => !isChromeSpacerRow(row)) ?? rows[0] ?? null
}

function _chromeGridStyle(band: ChromeBandId) {
  const rows = Math.max(1, posterLayout.value.bands[band].rows.length)
  return {
    backgroundImage: [
      `linear-gradient(to right, rgba(42,91,204,0.24) 1px, transparent 1px)`,
      `linear-gradient(to bottom, rgba(42,91,204,0.18) 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: `8.33% 100%, 100% ${100 / rows}%`,
  }
}

function _chromeBandBackground(band: ChromeBandId) {
  return posterLayout.value.bands[band].background ?? (band === 'header' ? headerBg.value : bg.value)
}

function updateChromeBand(band: ChromeBandId, patch: Partial<ChromeBand>) {
  updatePosterLayout({
    bands: {
      [band]: {
        ...(props.styleConfig.poster_layout?.bands?.[band] ?? {}),
        ...patch,
      },
    },
  })
}

function _setChromeBandBackground(band: ChromeBandId, background: string) {
  updateChromeBand(band, { background })
}

function _nudgeChromeBandCols(band: ChromeBandId, direction: -1 | 1) {
  const rowId = selectedChromeTarget.value?.type === 'row' || selectedChromeTarget.value?.type === 'cell'
    ? selectedChromeTarget.value.rowId
    : chromeRowsFor(band)[0]?.id
  if (!rowId) return
  if (direction > 0) addColumnAfter(band, rowId)
  else {
    const row = findChromeRow(band, rowId)
    const last = row?.cells[row.cells.length - 1]
    if (row && last && row.cells.length > 1) removeCell(band, rowId, last.id)
  }
}

function _nudgeChromeBandRows(band: ChromeBandId, direction: -1 | 1) {
  if (direction > 0) addRowAfter(band)
  else {
    const rows = chromeRowsFor(band)
    if (rows.length > 1) updateChromeRows(band, rows.slice(0, -1))
  }
}

function _nudgeChromeBandPadding(band: ChromeBandId, direction: -1 | 1) {
  const current = posterLayout.value.bands[band].padding ?? [0, 0, 0, 0]
  const next = current.map(value => Math.min(12, Math.max(0, value + direction))) as [number, number, number, number]
  updateChromeBand(band, { padding: next })
}

function nudgeChromeBandPaddingSide(band: ChromeBandId, direction: -1 | 1, sideIndex: 0 | 1 | 2 | 3) {
  const current = posterLayout.value.bands[band].padding ?? [0, 0, 0, 0]
  const next = current.map((value, index) =>
    index === sideIndex ? Math.min(12, Math.max(0, value + direction)) : value,
  ) as [number, number, number, number]
  updateChromeBand(band, { padding: next })
}

function nudgeActiveChromeCellPadding(direction: -1 | 1, sideIndex?: 0 | 1 | 2 | 3) {
  const target = selectedChromeTarget.value
  if (target?.type !== 'cell') return
  updateChromeCell(target.band, target.rowId, target.cellId, cell => {
    const current = cell.padding ?? [0, 0, 0, 0]
    const next = current.map((value, index) =>
      sideIndex == null || sideIndex === index ? Math.min(12, Math.max(0, value + direction)) : value,
    ) as [number, number, number, number]
    return { ...cell, padding: next }
  })
}

function chromeBandPaddingCss(band: ChromeBandId, fallback: string) {
  const padding = posterLayout.value.bands[band].padding
  if (!padding) return fallback
  return `${padding[0]}cqh ${padding[1]}cqw ${padding[2]}cqh ${padding[3]}cqw`
}

function chromeBandEditingPaddingCss() {
  const inset = compositionRuleInset.value
  return `0 ${inset.right} 0 ${inset.left}`
}

function chromeBandGridStyle(band: ChromeBandId) {
  const cfg = posterLayout.value.bands[band]
  return {
    display: 'grid',
    gridTemplateRows: chromeRowsFor(band).map(row => `${row.fr ?? 1}fr`).join(' ') || '1fr',
    gap: '0.55cqh',
    width: '100%',
    height: '100%',
    minHeight: '0',
    boxSizing: 'border-box' as const,
    backgroundColor: cfg.background ?? 'transparent',
  }
}

function chromeRowStyle(row: ChromeGridRow) {
  return {
    display: 'grid',
    gridTemplateColumns: chromeCellsFor(row).map(cell => `${cell.fr ?? 1}fr`).join(' ') || '1fr',
    gap: '0.7cqw',
    minHeight: '0',
    minWidth: '0',
  }
}

function chromeCellStyle(cell: ChromeGridCell) {
  const slotAlign = cell.block?.slot ? slotOverride(cell.block.slot).align : undefined
  const align = slotAlign ?? cell.align ?? cell.block?.align ?? 'left'
  const style: Record<string, string> = {
    justifyItems: align === 'right' ? 'end' : align === 'center' ? 'center' : 'start',
    alignItems: cell.valign === 'bottom' ? 'end' : cell.valign === 'top' ? 'start' : 'center',
    textAlign: align,
    boxSizing: 'border-box',
    overflow: 'hidden',
  }
  if (cell.padding) style.padding = `${cell.padding[0]}cqh ${cell.padding[1]}cqw ${cell.padding[2]}cqh ${cell.padding[3]}cqw`
  return style
}

function chromeSlotClass(slot: PosterTextSlot) {
  return slot.replace(/_/g, '-')
}

function chromeGridBlockStyle(cell: ChromeGridCell): Record<string, string> {
  const block = cell.block
  if (!block) return {}
  const override = block.slot ? slotOverride(block.slot) : {}
  const align = override.align ?? cell.align ?? block.align ?? 'left'
  const bold = override.bold ?? block.bold
  const italic = override.italic ?? block.italic
  const style: Record<string, string> = {
    width: '100%',
    fontFamily: chromeBlockFontFamily(block, override),
    fontSize: `${override.font_size_pt != null ? ptToCqh(override.font_size_pt) : chromeBlockFontSize(block)}cqh`,
    lineHeight: chromeBlockLineHeight(block),
    letterSpacing: chromeBlockLetterSpacing(block),
    textTransform: chromeBlockTextTransform(block),
    color: override.color ?? block.color ?? fg.value,
    opacity: String(override.opacity ?? block.opacity ?? chromeBlockOpacity(block)),
    fontWeight: bold ? '800' : chromeBlockWeight(block),
    fontStyle: italic ? 'italic' : 'normal',
    textAlign: align,
    backgroundColor: override.bg_color ?? block.bg_color ?? 'transparent',
    outline: 'none',
  }
  const minHeight = chromeBlockMinHeight(block)
  if (minHeight) style.minHeight = minHeight
  return style
}

function chromeBlockFontFamily(block: ChromeBlock, override: PosterTextOverride) {
  if (override.font_family) return toFontStack(override.font_family)
  if (block.font_family) return toFontStack(block.font_family)
  if (block.kind === 'title') return typography.value.titleFont
  if (block.kind === 'stat') return typography.value.statsFont
  if (block.kind === 'coords' || block.kind === 'brand') return typography.value.subFont
  return typography.value.subFont
}

function chromeBlockFontSize(block: ChromeBlock) {
  if (block.font_size_pt != null) return ptToCqh(block.font_size_pt)
  const scale = block.scale ?? 1
  if (block.kind === 'title') return typography.value.titleSize * scale
  if (block.kind === 'stat') return 0.72 * scale
  if (block.kind === 'coords') return 0.72 * scale
  if (block.kind === 'brand') return 0.48 * scale
  return 0.9 * scale
}

function chromeBlockLineHeight(block: ChromeBlock) {
  if (block.kind === 'title') {
    if (composition.value.id === 'travel-banner') return '1.08'
    if (composition.value.id === 'modernist-block') return '1.02'
    if (composition.value.id === 'brutalist-slab') return '1.02'
    return typography.value.titleLineHeight
  }
  if (block.kind === 'stat') return '0.92'
  if (block.kind === 'coords') return '1.25'
  if (block.kind === 'brand') return '1'
  return '1.12'
}

function chromeBlockMinHeight(block: ChromeBlock) {
  if (block.kind !== 'title') return undefined
  const length = chromeBlockText(block).trim().length
  if (length < 54) return undefined
  const estimatedLines = length > 96 ? 3 : 2
  const leading = composition.value.id === 'travel-banner' ? 1.08 : 1
  return `${(estimatedLines * leading) + 0.45}em`
}

function chromeBlockLetterSpacing(block: ChromeBlock) {
  if (block.kind === 'title') return typography.value.titleTracking
  if (block.kind === 'stat') return '0.14em'
  if (block.kind === 'coords') return '0.08em'
  if (block.kind === 'brand') return '0.22em'
  return '0.16em'
}

function chromeBlockTextTransform(block: ChromeBlock) {
  if (block.kind === 'title') return typography.value.titleCase
  if (
    block.kind === 'subtitle' ||
    block.kind === 'eyebrow' ||
    block.kind === 'note' ||
    block.kind === 'stat' ||
    block.kind === 'brand'
  ) return 'uppercase'
  return 'none'
}

function chromeBlockWeight(block: ChromeBlock) {
  if (block.kind === 'title') return typography.value.titleWeight
  if (block.kind === 'stat') return typography.value.statsWeight
  if (block.kind === 'coords') return '600'
  if (block.kind === 'brand') return '800'
  return '600'
}

function chromeBlockOpacity(block: ChromeBlock) {
  if (block.kind === 'coords') return 0.76
  if (block.kind === 'brand') {
    if (
      composition.value.id === 'editorial-tall' ||
      composition.value.id === 'journal-spread' ||
      composition.value.id === 'botanical-plate'
    ) return 0.46
    if (composition.value.id === 'travel-banner' || composition.value.id === 'darksky-stars') return 0.5
    if (
      composition.value.id === 'blueprint-grid' ||
      composition.value.id === 'blueprint-strava' ||
      composition.value.id === 'splits-grid'
    ) return 0.56
    if (
      composition.value.id === 'bib-numerals' ||
      composition.value.id === 'brutalist-slab' ||
      composition.value.id === 'modernist-block'
    ) return 0.72
    return 0.66
  }
  return 1
}

function chromeBlockEditable(block: ChromeBlock) {
  if (block.slot && !slotEditable(block.slot)) return false
  return block.kind !== 'brand' && block.kind !== 'logo' && block.kind !== 'image' && !isChromeSpacerBlock(block)
}

function chromeCustomBlockStyle(_band: ChromeBandId, _block: ChromeBlock): Record<string, string> {
  return {}
}

function chromeBlockText(block: ChromeBlock) {
  if (block.empty || isChromeSpacerBlock(block)) return ''
  if (block.text != null) return block.text
  if (block.slot) return chromeSlotText(block)
  return 'Your text'
}

function chromeSlotText(block: ChromeBlock) {
  if (!block.slot) return ''
  const override = slotOverride(block.slot)
  if (override.text != null) return override.text
  if (block.kind !== 'stat' && block.kind !== 'coords') return defaultSlotText(block.slot)

  if (composition.value.id === 'blueprint-grid' && props.styleConfig.color_theme === 'blueprint') {
    if (block.slot === 'distance') return formattedDistance.value ? `DIST ${formattedDistance.value} mi` : ''
    if (block.slot === 'elevation_gain') return formattedGain.value ? `GAIN ${formattedGain.value} ft` : ''
    if (block.slot === 'date') return formattedDate.value
  }
  if (block.slot === 'distance') return formattedDistance.value ? `${formattedDistance.value}\nMILES` : ''
  if (block.slot === 'elevation_gain') return formattedGain.value ? `${formattedGain.value}\nFT GAIN` : ''
  if (block.slot === 'date') return formattedDateCompact.value ? `${formattedDateCompact.value}\nDATE` : defaultSlotText(block.slot)
  if (block.slot === 'coordinates') return chromeCoordinatesText.value
  return defaultSlotText(block.slot)
}

function emitPosterLayout(value: PartialPosterLayout | undefined) {
  emit('poster-layout-updated', value)
}

function updatePosterLayout(patch: PartialPosterLayout) {
  emitPosterLayout(patchPosterLayout(props.styleConfig.poster_layout, patch))
}

function cloneChromeCell(cell: ChromeGridCell): ChromeGridCell {
  return {
    ...cell,
    padding: cell.padding ? [...cell.padding] as [number, number, number, number] : undefined,
    block: cell.block ? { ...cell.block } : undefined,
  }
}

function cloneChromeRow(row: ChromeGridRow): ChromeGridRow {
  return {
    ...row,
    cells: row.cells.map(cloneChromeCell),
  }
}

function sparseBandRows(band: ChromeBandId) {
  const rows = posterLayout.value.bands[band].rows.map(cloneChromeRow)
  const sparseRows = props.styleConfig.poster_layout?.bands?.[band]?.rows
  if (!sparseRows) return rows

  const rowsById = new Map(rows.map(row => [row.id, row]))
  const order = rows.map(row => row.id)

  for (const sparseRow of sparseRows) {
    const existing = rowsById.get(sparseRow.id)
    if (!existing) {
      rowsById.set(sparseRow.id, cloneChromeRow(sparseRow))
      if (!order.includes(sparseRow.id)) order.push(sparseRow.id)
      continue
    }

    const cellIds = new Set(existing.cells.map(cell => cell.id))
    for (const sparseCell of sparseRow.cells) {
      if (sparseCell.deleted && !cellIds.has(sparseCell.id)) {
        existing.cells.push(cloneChromeCell(sparseCell))
        cellIds.add(sparseCell.id)
      }
    }
  }

  return order
    .map(id => rowsById.get(id))
    .filter((row): row is ChromeGridRow => Boolean(row))
}

function updateChromeRows(band: ChromeBandId, rows: ChromeGridRow[]) {
  updateChromeBand(band, { rows })
}

function findChromeRow(band: ChromeBandId, rowId: string) {
  return posterLayout.value.bands[band].rows.find(row => row.id === rowId) ?? null
}

function findChromeCell(band: ChromeBandId, rowId: string, cellId: string) {
  return findChromeRow(band, rowId)?.cells.find(cell => cell.id === cellId) ?? null
}

function updateChromeCell(band: ChromeBandId, rowId: string, cellId: string, updater: (cell: ChromeGridCell) => ChromeGridCell) {
  const rows = sparseBandRows(band).map(row => row.id === rowId
    ? { ...row, cells: row.cells.map(cell => cell.id === cellId ? updater(cell) : cell) }
    : row)
  updateChromeRows(band, rows)
}

function selectChromeBand(band: ChromeBandId) {
  if (!chromeDirectEditing.value) return
  selectedChromeTarget.value = { type: 'band', band }
  hoveredChromeBand.value = band
  chromePaddingPanelOpen.value = false
  emitChromeSelectionChanged(selectedChromeTarget.value)
}

function selectChromeRow(band: ChromeBandId, rowId: string) {
  if (!chromeDirectEditing.value) return
  selectedChromeTarget.value = { type: 'row', band, rowId }
  hoveredChromeBand.value = band
  chromePaddingPanelOpen.value = false
  emitChromeSelectionChanged(selectedChromeTarget.value)
}

function selectChromeCell(band: ChromeBandId, rowId: string, cellId: string) {
  if (!chromeDirectEditing.value) return
  selectedChromeTarget.value = { type: 'cell', band, rowId, cellId }
  hoveredChromeBand.value = band
  const cell = findChromeCell(band, rowId, cellId)
  activeChromeBlockId.value = cell?.block?.id ?? null
  if (cell?.block && !cell.block.empty && !isChromeSpacerBlock(cell.block)) rememberChromeTextStyle(cell.block, cell)
  if (posterElementsEditing.value && cell?.block?.slot && slotEditable(cell.block.slot)) {
    emit('poster-element-selected', `slot:${cell.block.slot}`)
    activeTextTarget.value = { type: 'slot', slot: cell.block.slot }
    const selector = `[data-chrome-block-id="${globalThis.CSS?.escape?.(cell.block.id) ?? cell.block.id.replace(/"/g, '\\"')}"]`
    const el = posterCanvasEl.value?.querySelector<HTMLElement>(selector)
    if (el) activeTextAnchor.value = el.getBoundingClientRect()
  }
  chromePaddingPanelOpen.value = false
  emitChromeSelectionChanged(selectedChromeTarget.value)
}

function selectChromeCellFromInteraction(band: ChromeBandId, rowId: string, cellId: string) {
  selectChromeCell(band, rowId, cellId)
  if (typeof window === 'undefined') return
  window.requestAnimationFrame(() => selectChromeCell(band, rowId, cellId))
}

function setChromeCellSelection(band: ChromeBandId, rowId: string, cellId: string, blockId: string | null = null) {
  selectedChromeTarget.value = { type: 'cell', band, rowId, cellId }
  hoveredChromeBand.value = band
  activeChromeBlockId.value = blockId
  emitChromeSelectionChanged(selectedChromeTarget.value)
  activeTextTarget.value = null
  chromePaddingPanelOpen.value = false
}

async function focusChromeBlockInline(blockId: string) {
  await nextTick()
  if (!posterCanvasEl.value) return
  const selector = `[data-chrome-block-id="${globalThis.CSS?.escape?.(blockId) ?? blockId.replace(/"/g, '\\"')}"]`
  const blockEl = posterCanvasEl.value.querySelector<HTMLElement>(selector)
  if (!blockEl) return
  blockEl.focus()
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(blockEl)
  selection.removeAllRanges()
  selection.addRange(range)
}

function selectChromeBlock(id: string) {
  if (!chromeDirectEditing.value) return
  for (const band of CHROME_BANDS) {
    for (const row of chromeRowsFor(band)) {
      const cell = chromeCellsFor(row).find(cell => cell.block?.id === id)
      if (cell) {
        selectChromeCell(band, row.id, cell.id)
        return
      }
    }
  }
}

function openChromeSection(band: ChromeBandId) {
  selectChromeBand(band)
  activeTextTarget.value = null
}

function resetChromeBand(band: ChromeBandId) {
  const currentBands = { ...(props.styleConfig.poster_layout?.bands ?? {}) }
  delete currentBands[band]
  emitPosterLayout(Object.keys(currentBands).length ? { bands: currentBands } : undefined)
  selectedChromeTarget.value = null
  activeChromeBlockId.value = null
}

function resetChromeSection(band: ChromeBandId) {
  resetChromeBand(band)
}

function _startChromeBandResize(e: PointerEvent, band: Extract<ChromeBandId, 'header' | 'footer'>) {
  if (!chromeDirectEditing.value || typeof window === 'undefined') return
  const posterBox = posterCanvasEl.value?.getBoundingClientRect()
  if (!posterBox?.height) return
  activeChromeBandResize.value = {
    band,
    startY: e.clientY,
    startHeight: posterLayout.value.bands[band].height ?? (band === 'header' ? 22 : 14),
    posterHeight: posterBox.height,
  }
  window.addEventListener('pointermove', onChromeBandResizeMove)
  window.addEventListener('pointerup', finishChromeBandResize, { once: true })
  window.addEventListener('pointercancel', finishChromeBandResize, { once: true })
}

function onChromeBandResizeMove(e: PointerEvent) {
  const resize = activeChromeBandResize.value
  if (!resize) return
  const deltaPct = ((e.clientY - resize.startY) / resize.posterHeight) * 100
  const rawHeight = resize.band === 'header'
    ? resize.startHeight + deltaPct
    : resize.startHeight - deltaPct
  const height = clampChromeBandHeight(rawHeight)
  updatePosterLayout({
    bands: {
      [resize.band]: {
        ...(props.styleConfig.poster_layout?.bands?.[resize.band] ?? {}),
        height,
      },
    },
  })
}

function finishChromeBandResize() {
  teardownChromeBandResize()
}

function teardownChromeBandResize() {
  if (typeof window === 'undefined') return
  activeChromeBandResize.value = null
  window.removeEventListener('pointermove', onChromeBandResizeMove)
  window.removeEventListener('pointerup', finishChromeBandResize)
  window.removeEventListener('pointercancel', finishChromeBandResize)
}

function startChromeColumnResize(e: PointerEvent, band: ChromeBandId, rowId: string, cellId: string) {
  if (!chromeDirectEditing.value || typeof window === 'undefined') return
  const row = findChromeRow(band, rowId)
  const cells = row ? chromeCellsFor(row) : []
  const index = cells.findIndex(cell => cell.id === cellId)
  const nextCell = index >= 0 ? cells[index + 1] : undefined
  const rowEl = e.currentTarget instanceof HTMLElement
    ? e.currentTarget.closest<HTMLElement>('.chrome-grid-row')
    : null
  const rowWidth = rowEl?.getBoundingClientRect().width ?? 0
  if (!row || !nextCell || rowWidth <= 0) return

  activeChromeColumnResize.value = {
    band,
    rowId,
    cellId,
    nextCellId: nextCell.id,
    startX: e.clientX,
    rowWidth,
    startFr: cells[index]?.fr ?? 1,
    nextFr: nextCell.fr ?? 1,
    totalFr: cells.reduce((sum, cell) => sum + (cell.fr ?? 1), 0),
  }
  setChromeCellSelection(band, rowId, cellId, cells[index]?.block?.id ?? null)
  window.addEventListener('pointermove', onChromeColumnResizeMove)
  window.addEventListener('pointerup', finishChromeColumnResize, { once: true })
  window.addEventListener('pointercancel', finishChromeColumnResize, { once: true })
}

function onChromeColumnResizeMove(e: PointerEvent) {
  const resize = activeChromeColumnResize.value
  if (!resize) return

  const pairTotal = resize.startFr + resize.nextFr
  const minFr = Math.min(0.45, pairTotal / 2)
  const deltaFr = ((e.clientX - resize.startX) / resize.rowWidth) * resize.totalFr
  const currentFr = Math.round(Math.min(pairTotal - minFr, Math.max(minFr, resize.startFr + deltaFr)) * 20) / 20
  const nextFr = Math.round(Math.max(minFr, pairTotal - currentFr) * 20) / 20

  const rows = sparseBandRows(resize.band).map(row => row.id === resize.rowId
    ? {
        ...row,
        cells: row.cells.map(cell => {
          if (cell.id === resize.cellId) return { ...cell, fr: currentFr }
          if (cell.id === resize.nextCellId) return { ...cell, fr: nextFr }
          return cell
        }),
      }
    : row)
  updateChromeRows(resize.band, rows)
}

function finishChromeColumnResize() {
  teardownChromeColumnResize()
}

function teardownChromeColumnResize() {
  if (typeof window === 'undefined') return
  activeChromeColumnResize.value = null
  window.removeEventListener('pointermove', onChromeColumnResizeMove)
  window.removeEventListener('pointerup', finishChromeColumnResize)
  window.removeEventListener('pointercancel', finishChromeColumnResize)
}

function startChromeRowResize(e: PointerEvent, band: ChromeBandId, rowId: string, edge: ChromeRowResizeEdge = 'bottom') {
  if (!chromeDirectEditing.value || typeof window === 'undefined') return
  const rows = chromeRowsFor(band)
  const index = rows.findIndex(row => row.id === rowId)
  const row = index >= 0 ? rows[index] : undefined
  const bandEl = posterCanvasEl.value?.querySelector<HTMLElement>(`.chrome-grid-band--${band}`)
    ?? (e.currentTarget instanceof HTMLElement
      ? e.currentTarget.closest<HTMLElement>('.chrome-grid-band')
      : null)
  const bandHeight = bandEl?.getBoundingClientRect().height ?? 0
  const posterHeight = posterCanvasEl.value?.getBoundingClientRect().height ?? 0
  if (!row || bandHeight <= 0 || posterHeight <= 0) return
  const rowGap = bandEl ? Number.parseFloat(window.getComputedStyle(bandEl).rowGap || '0') || 0 : 0
  const startGapHeight = rowGap * Math.max(0, rows.length - 1)
  const startTrackHeight = Math.max(1, bandHeight - startGapHeight)
  const totalFr = rows.reduce((sum, row) => sum + (row.fr ?? 1), 0)
  const frUnitPx = Math.max(1, startTrackHeight / Math.max(1, totalFr))
  const rowHeights = new Map<string, number>()
  for (const rowEl of bandEl?.querySelectorAll<HTMLElement>('.chrome-grid-row') ?? []) {
    const id = rowEl.dataset.chromeRowId
    if (id) rowHeights.set(id, rowEl.getBoundingClientRect().height)
  }
  const normalizedRows = sparseBandRows(band).map(rowValue => {
    const measuredHeight = rowHeights.get(rowValue.id)
    if (!measuredHeight) return rowValue
    return {
      ...rowValue,
      fr: Math.round(Math.max(0.25, measuredHeight / frUnitPx) * 20) / 20,
    }
  })
  const normalizedRow = normalizedRows.find(item => item.id === rowId)
  const adjacentRow = edge === 'top'
    ? normalizedRows[index - 1]
    : normalizedRows[index + 1]

  activeChromeRowResize.value = {
    band,
    rowId,
    adjacentRowId: adjacentRow?.id,
    edge,
    startY: e.clientY,
    startFr: normalizedRow?.fr ?? row.fr ?? 1,
    adjacentStartFr: adjacentRow?.fr,
    startBandHeight: (bandHeight / posterHeight) * 100,
    frUnitPx,
    posterHeight,
    startRows: normalizedRows,
  }
  selectChromeRow(band, rowId)
  window.addEventListener('pointermove', onChromeRowResizeMove)
  window.addEventListener('pointerup', finishChromeRowResize, { once: true })
  window.addEventListener('pointercancel', finishChromeRowResize, { once: true })
}

function onChromeRowResizeMove(e: PointerEvent) {
  const resize = activeChromeRowResize.value
  if (!resize) return

  const minFr = 0.25
  const rawDeltaFr = (e.clientY - resize.startY) / resize.frUnitPx
  const rowDeltaFr = resize.edge === 'top' ? -rawDeltaFr : rawDeltaFr
  const minDeltaFr = minFr - resize.startFr
  const maxDeltaFr = resize.adjacentStartFr != null ? resize.adjacentStartFr - minFr : Number.POSITIVE_INFINITY
  const deltaFr = Math.round(Math.min(maxDeltaFr, Math.max(minDeltaFr, rowDeltaFr)) * 20) / 20
  const currentFr = Math.round((resize.startFr + deltaFr) * 20) / 20
  const adjacentFr = resize.adjacentStartFr != null ? Math.round((resize.adjacentStartFr - deltaFr) * 20) / 20 : undefined

  const rows = resize.startRows.map(row => {
    if (row.id === resize.rowId) return { ...row, fr: currentFr }
    if (row.id === resize.adjacentRowId && adjacentFr != null) return { ...row, fr: adjacentFr }
    return row
  })
  if (resize.adjacentRowId) {
    updateChromeBand(resize.band, { rows })
    return
  }

  const deltaPx = (currentFr - resize.startFr) * resize.frUnitPx
  const height = clampChromeBandHeight(resize.startBandHeight + (deltaPx / resize.posterHeight) * 100)
  updateChromeBand(resize.band, { rows, height })
}

function finishChromeRowResize() {
  teardownChromeRowResize()
}

function teardownChromeRowResize() {
  if (typeof window === 'undefined') return
  activeChromeRowResize.value = null
  window.removeEventListener('pointermove', onChromeRowResizeMove)
  window.removeEventListener('pointerup', finishChromeRowResize)
  window.removeEventListener('pointercancel', finishChromeRowResize)
}

function newChromeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`
}

function makeEmptyCell(): ChromeGridCell {
  return { id: newChromeId('chrome-cell'), fr: 1, align: 'left', valign: 'center' }
}

function makeSpacerBlock(label = 'Spacer'): ChromeBlock {
  return {
    id: newChromeId('chrome-spacer'),
    kind: 'spacer',
    source: 'user',
    label,
    align: 'center',
    valign: 'center',
  }
}

function makeSpacerCell(label = 'Spacer'): ChromeGridCell {
  return {
    id: newChromeId('chrome-cell'),
    fr: 1,
    align: 'center',
    valign: 'center',
    block: makeSpacerBlock(label),
  }
}

function defaultChromeFontFamily(block: ChromeBlock) {
  if (block.font_family) return block.font_family
  if (block.kind === 'title') return props.styleConfig.font_family
  return props.styleConfig.body_font_family
}

function rememberChromeTextStyle(block: ChromeBlock, cell: ChromeGridCell) {
  const override = block.slot ? slotOverride(block.slot) : {}
  const fontWeight = Number.parseInt(String(chromeBlockWeight(block)), 10)
  lastChromeTextStyle.value = {
    font_family: override.font_family ?? defaultChromeFontFamily(block),
    font_size_pt: override.font_size_pt ?? block.font_size_pt ?? cqhToPt(chromeBlockFontSize(block)),
    align: override.align ?? cell.align ?? block.align ?? 'left',
    valign: cell.valign ?? block.valign ?? 'center',
    color: override.color ?? block.color ?? fg.value,
    bg_color: override.bg_color ?? block.bg_color,
    opacity: override.opacity ?? block.opacity,
    bold: override.bold ?? block.bold ?? fontWeight >= 700,
    italic: override.italic ?? block.italic ?? false,
    scale: block.scale,
  }
}

function makeTextBlock(text = 'Your text'): ChromeBlock {
  const inherited = lastChromeTextStyle.value ?? {}
  return {
    id: newChromeId('chrome-text'),
    kind: 'text',
    source: 'user',
    text,
    align: inherited.align ?? 'left',
    valign: inherited.valign ?? 'center',
    font_family: inherited.font_family ?? props.styleConfig.body_font_family,
    font_size_pt: inherited.font_size_pt,
    color: inherited.color ?? props.styleConfig.label_text_color,
    bg_color: inherited.bg_color,
    opacity: inherited.opacity,
    bold: inherited.bold,
    italic: inherited.italic,
    scale: inherited.font_size_pt != null ? undefined : inherited.scale ?? 1,
  }
}

function addChromeTextToCell(band: ChromeBandId, rowId: string, cellId: string) {
  const block = makeTextBlock()
  updateChromeCell(band, rowId, cellId, cell => {
    return {
      ...cell,
      align: block.align ?? cell.align,
      valign: block.valign ?? cell.valign,
      block,
    }
  })
  setChromeCellSelection(band, rowId, cellId, block.id)
  void focusChromeBlockInline(block.id)
}

function chromeCellAcceptsText(cell: ChromeGridCell) {
  return !cell.deleted && (!cell.block || cell.block.empty || cell.block.deleted || cell.block.removed)
}

function addChromeTextBlock(band: ChromeBandId, preferredRowId?: string, afterCellId?: string) {
  const block = makeTextBlock()
  let nextSelection: { rowId: string; cellId: string } | null = null
  const rows = sparseBandRows(band)
  const workingRows = rows.length
    ? rows
    : [{ id: newChromeId('chrome-row'), fr: 1, cells: [] as ChromeGridCell[] }]
  const fallbackRow = workingRows.find(row => !isChromeSpacerRow(row)) ?? workingRows[0]
  const rowId = preferredRowId && workingRows.some(row => row.id === preferredRowId)
    ? preferredRowId
    : fallbackRow?.id

  if (!rowId) return

  const nextRows = workingRows.map(row => {
    if (row.id !== rowId) return row

    const existingEmptyCell = afterCellId ? undefined : row.cells.find(chromeCellAcceptsText)
    if (existingEmptyCell) {
      nextSelection = { rowId: row.id, cellId: existingEmptyCell.id }
      return {
        ...row,
        cells: row.cells.map(cell => cell.id === existingEmptyCell.id
          ? {
              ...cell,
              align: block.align ?? cell.align,
              valign: block.valign ?? cell.valign,
              block,
            }
          : cell),
      }
    }

    const nextCell: ChromeGridCell = {
      ...makeEmptyCell(),
      align: block.align,
      valign: block.valign,
      block,
    }
    const index = afterCellId ? row.cells.findIndex(cell => cell.id === afterCellId) : row.cells.length - 1
    const insertIndex = index >= 0 ? index + 1 : row.cells.length
    const cells = [...row.cells]
    cells.splice(insertIndex, 0, nextCell)
    nextSelection = { rowId: row.id, cellId: nextCell.id }
    return { ...row, cells }
  })

  updateChromeRows(band, nextRows)
  const selectedCell = nextSelection as { rowId: string; cellId: string } | null
  if (selectedCell) {
    setChromeCellSelection(band, selectedCell.rowId, selectedCell.cellId, block.id)
    void focusChromeBlockInline(block.id)
  }
}

function addChromeTextForSelection() {
  const target = selectedChromeTarget.value
  if (target?.type === 'cell') {
    const cell = findChromeCell(target.band, target.rowId, target.cellId)
    if (cell && chromeCellAcceptsText(cell)) addChromeTextToCell(target.band, target.rowId, target.cellId)
    else addChromeTextBlock(target.band, target.rowId, target.cellId)
    return
  }
  addChromeTextBlock(target?.band ?? activeChromeBand.value, target?.type === 'row' ? target.rowId : undefined)
}

function addColumnAfter(band: ChromeBandId, rowId: string, afterCellId?: string) {
  let nextCellId: string | null = null
  const rows = sparseBandRows(band).map(row => {
    if (row.id !== rowId) return row
    const nextCell = makeEmptyCell()
    nextCellId = nextCell.id
    const index = afterCellId ? row.cells.findIndex(cell => cell.id === afterCellId) : row.cells.length - 1
    const insertIndex = index >= 0 ? index + 1 : row.cells.length
    const cells = [...row.cells]
    cells.splice(insertIndex, 0, nextCell)
    return { ...row, cells }
  })
  if (!nextCellId) return null
  updateChromeRows(band, rows)
  setChromeCellSelection(band, rowId, nextCellId)
  return nextCellId
}

function addRowAfter(band: ChromeBandId, afterRowId?: string) {
  const nextCell = makeEmptyCell()
  const nextRow: ChromeGridRow = { id: newChromeId('chrome-row'), fr: 1, cells: [nextCell] }
  const rows = [...sparseBandRows(band)]
  const index = afterRowId ? rows.findIndex(row => row.id === afterRowId) : rows.length - 1
  const insertIndex = index >= 0 ? index + 1 : rows.length
  rows.splice(insertIndex, 0, nextRow)
  updateChromeRows(band, rows)
  setChromeCellSelection(band, nextRow.id, nextCell.id)
  return nextRow.id
}

function addSpacerRowAfter(band: ChromeBandId, afterRowId?: string) {
  const nextCell = makeSpacerCell()
  const nextRow: ChromeGridRow = { id: newChromeId('chrome-spacer-row'), fr: 0.85, cells: [nextCell] }
  const rows = [...sparseBandRows(band)]
  const index = afterRowId ? rows.findIndex(row => row.id === afterRowId) : rows.length - 1
  const insertIndex = index >= 0 ? index + 1 : rows.length
  rows.splice(insertIndex, 0, nextRow)
  updateChromeRows(band, rows)
  setChromeCellSelection(band, nextRow.id, nextCell.id, nextCell.block?.id ?? null)
  return nextRow.id
}

function deleteCellContent(band: ChromeBandId, rowId: string, cellId: string) {
  updateChromeCell(band, rowId, cellId, cell => ({
    ...cell,
    block: cell.block ? { ...cell.block, empty: true, text: '', slot: undefined } : undefined,
  }))
}

function removeCell(band: ChromeBandId, rowId: string, cellId: string) {
  const currentRows = sparseBandRows(band)
  let nextSelection: ChromeSelection | null = { type: 'row', band, rowId }

  const rows = currentRows.map((row) => {
    if (row.id !== rowId) return row

    const visibleCells = row.cells.filter(cell => !cell.deleted)
    if (visibleCells.length > 1) {
      return {
        ...row,
        cells: row.cells.map(cell => cell.id === cellId ? { ...cell, deleted: true, block: undefined } : cell),
      }
    }

    nextSelection = { type: 'band', band }
    return {
      ...row,
      deleted: true,
      cells: row.cells.map(cell => cell.id === cellId ? { ...cell, deleted: true, block: undefined } : cell),
    }
  })
  updateChromeRows(band, rows)
  selectedChromeTarget.value = nextSelection
  activeChromeBlockId.value = null
  activeTextTarget.value = null
  chromePaddingPanelOpen.value = false
}

function addColumnForSelection() {
  const target = selectedChromeTarget.value
  const band = target?.band ?? activeChromeBand.value
  if (target?.type === 'cell') {
    addColumnAfter(target.band, target.rowId, target.cellId)
    return
  }
  if (target?.type === 'row') {
    addColumnAfter(target.band, target.rowId)
    return
  }
  const firstRow = firstChromeContentRow(band)
  if (firstRow) addColumnAfter(band, firstRow.id)
  else addRowAfter(band)
}

function addRowForSelection() {
  const target = selectedChromeTarget.value
  const band = target?.band ?? activeChromeBand.value
  addRowAfter(band, target?.type === 'cell' || target?.type === 'row' ? target.rowId : undefined)
}

function closeChromeAddPanel() {
  chromeAddPanelOpen.value = false
}

function toggleChromeAddPanel() {
  if (chromeAddPanelOpen.value) closeChromeAddPanel()
  else chromeAddPanelOpen.value = true
}

function addChromeTextFromPalette() {
  addChromeTextForSelection()
  closeChromeAddPanel()
}

function addColumnFromPalette() {
  addColumnForSelection()
  closeChromeAddPanel()
}

function addRowFromPalette() {
  addRowForSelection()
  closeChromeAddPanel()
}

function addSpacerFromPalette() {
  const target = selectedChromeTarget.value
  const band = target?.band ?? activeChromeBand.value
  addSpacerRowAfter(band, target?.type === 'cell' || target?.type === 'row' ? target.rowId : undefined)
  closeChromeAddPanel()
}

function removeSelectedCell() {
  const target = selectedChromeTarget.value
  if (target?.type !== 'cell') return
  removeCell(target.band, target.rowId, target.cellId)
}

function deleteChromeBlock() {
  const target = selectedChromeTarget.value
  if (target?.type !== 'cell') return
  deleteCellContent(target.band, target.rowId, target.cellId)
  activeChromeBlockId.value = null
  activeTextTarget.value = null
}

function trashChromeCell(band: ChromeBandId, rowId: string, cellId: string) {
  const cell = findChromeCell(band, rowId, cellId)
  if (isChromeSpacerCell(cell)) {
    removeCell(band, rowId, cellId)
    return
  }
  if (cell?.block && !cell.block.empty) {
    removeCell(band, rowId, cellId)
    return
  }
  removeCell(band, rowId, cellId)
}

function duplicateChromeBlock() {
  const target = selectedChromeTarget.value
  const block = activeChromeBlock.value
  if (target?.type !== 'cell' || !block) return
  const rows = sparseBandRows(target.band).map(row => {
    if (row.id !== target.rowId) return row
    const source = row.cells.find(cell => cell.id === target.cellId)
    if (!source) return row
    const index = row.cells.findIndex(cell => cell.id === target.cellId)
    const duplicate: ChromeGridCell = {
      ...source,
      id: newChromeId('chrome-cell'),
      block: source.block
        ? {
            ...source.block,
            id: newChromeId('chrome-block'),
            slot: undefined,
            source: 'user',
          }
        : undefined,
    }
    const cells = [...row.cells]
    cells.splice(Math.max(0, index) + 1, 0, duplicate)
    return { ...row, cells }
  })
  updateChromeRows(target.band, rows)
}

function onChromeCanvasPointerDown() {
  if (posterElementsEditing.value) emit('poster-element-selected', null)
  if (!chromeDirectEditing.value) return
  closeChromeAddPanel()
  selectedChromeTarget.value = null
  activeChromeBlockId.value = null
  activeTextTarget.value = null
  chromePaddingPanelOpen.value = false
}

function onCustomChromeFocus(_e: FocusEvent, _id: string) {}
function onCustomChromeClick(_e: MouseEvent, _id: string) {}
function onCustomChromeBlur(_e: FocusEvent, _id: string) {}

function onChromeGridBlockFocus(e: FocusEvent, band: ChromeBandId, rowId: string, cellId: string) {
  selectChromeCellFromInteraction(band, rowId, cellId)
  activeTextAnchor.value = e.currentTarget instanceof HTMLElement ? e.currentTarget.getBoundingClientRect() : null
}

function onChromeGridBlockBlur(e: FocusEvent, band: ChromeBandId, rowId: string, cellId: string) {
  const currentCell = findChromeCell(band, rowId, cellId)
  const currentBlock = currentCell?.block
  if (!currentCell || !currentBlock || currentBlock.empty || currentBlock.deleted) return
  const text = (e.currentTarget as HTMLElement).innerText.trim()
  if (currentBlock.slot) {
    emit('poster-text-override', { slot: currentBlock.slot, patch: { text } })
    return
  }
  updateChromeCell(band, rowId, cellId, cell => ({
    ...cell,
    block: cell.block ? { ...cell.block, text, slot: undefined, empty: text.length === 0 } : makeTextBlock(text),
  }))
}

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

function slotEditable(slot: PosterTextSlot) {
  if (!props.editable) return false
  return !props.editableTextSlots || props.editableTextSlots.includes(slot)
}

function slotEditorElementId(slot: PosterTextSlot) {
  return posterElementsEditing.value && slotEditable(slot) ? `slot:${slot}` : undefined
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

function hasVisibleTextOverride(slot: PosterTextSlot) {
  return Boolean(slotOverride(slot).text?.trim())
}

function textWithOverride(slot: PosterTextSlot, fallback: string) {
  return slotOverride(slot).text ?? fallback
}

function defaultSlotText(slot: PosterTextSlot) {
  if (slot === 'trail_name') return props.styleConfig.trail_name || props.map.title || 'Your Trail'
  if (slot === 'location_text') {
    const text = props.styleConfig.location_text?.trim() || ((props.map.stats as unknown as { location?: string })?.location?.trim() ?? '')
    if (composition.value.id === 'blueprint-strava') return text
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
  if (posterElementsEditing.value && slotEditable(slot)) emit('poster-element-selected', `slot:${slot}`)
  if (chromeDirectEditing.value) {
    const block = chromeBlockForSlot(slot)
    if (block) selectChromeBlock(block.id)
  }
  if (slot === 'trail_name' || slot === 'occasion_text' || slot === 'location_text') {
    emit('edit-requested', { field: slot, value: el.innerText.trim() })
  }
}

function onSlotClick(e: MouseEvent, slot: PosterTextSlot) {
  selectTextTarget({ type: 'slot', slot }, e.currentTarget as HTMLElement)
  if (posterElementsEditing.value && slotEditable(slot)) emit('poster-element-selected', `slot:${slot}`)
  if (chromeDirectEditing.value) {
    const block = chromeBlockForSlot(slot)
    if (block) selectChromeBlock(block.id)
  }
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
  if (freeOverlayEditorBlocked.value) return
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectTextTarget({ type: 'overlay', id }, e.currentTarget as HTMLElement)
  emit('overlay-selected', id)
  if (tier2PosterEditor.value) emit('poster-element-selected', `text:${id}`)
}

function onOverlayTextPointerDown(e: PointerEvent, id: string) {
  if (freeOverlayEditorBlocked.value) return
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectTextTarget({ type: 'overlay', id }, e.currentTarget as HTMLElement)
  emit('overlay-selected', id)
  if (tier2PosterEditor.value) emit('poster-element-selected', `text:${id}`)
}

function onOverlayTextClick(e: MouseEvent, id: string) {
  if (freeOverlayEditorBlocked.value) return
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectTextTarget({ type: 'overlay', id }, e.currentTarget as HTMLElement)
  emit('overlay-selected', id)
  if (tier2PosterEditor.value) emit('poster-element-selected', `text:${id}`)
}

function onOverlayTextBlur(e: FocusEvent, id: string) {
  if (freeOverlayEditorBlocked.value) return
  emit('overlay-updated', { id, patch: { content: (e.currentTarget as HTMLElement).innerText.trim() } })
}

function finishActiveTextEdit() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  activeTextTarget.value = null
  activeTextAnchor.value = null
  activeChromeBlockId.value = null
  chromePaddingPanelOpen.value = false
  closeChromeAddPanel()
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
const draggingAssetId = ref<string | null>(null)
const resizePreview = ref<{ id: string; font_size: number } | null>(null)
const assetResizePreview = ref<{ id: string; width: number; height: number } | null>(null)
let deselectTimer: ReturnType<typeof setTimeout> | null = null

const visibleImageAssets = computed(() => {
  return (props.styleConfig.image_overlays ?? [])
    .filter(asset => !asset.hidden)
    .filter(asset => asset.kind !== 'logo' || props.styleConfig.show_logo !== false)
    .map(asset => ({
      ...asset,
      quality_status: classifyAssetQuality(computeEffectiveDpi(asset, props.styleConfig.print_size)),
    }))
})
const visibleTextOverlays = computed(() => (props.styleConfig.text_overlays ?? []).filter(overlay => !overlay.hidden))
const visibleIconOverlays = computed(() => (props.styleConfig.icon_overlays ?? []).filter(icon => !icon.hidden))
const showEditorGuides = computed(() =>
  (posterElementsEditing.value || chromeDirectEditing.value) &&
    (props.posterEditorMode === 'guides' || props.posterGuidesVisible === true),
)

type PosterSelectableElement =
  | { type: 'text'; id: string; item: TextOverlay }
  | { type: 'asset'; id: string; item: MapAsset }
  | { type: 'icon'; id: string; item: IconOverlay }
  | { type: 'slot'; id: string; slot: PosterTextSlot }

function selectedPosterElement(): PosterSelectableElement | null {
  const id = props.selectedPosterElementId
  if (!id) return null
  if (guidedPosterEditor.value && !id.startsWith('slot:')) {
    if (!tier2PosterEditor.value || (!id.startsWith('text:') && !id.startsWith('asset:'))) return null
  }
  if (id.startsWith('text:')) {
    const rawId = id.slice('text:'.length)
    const item = props.styleConfig.text_overlays?.find(overlay => overlay.id === rawId)
    return item ? { type: 'text', id, item } : null
  }
  if (id.startsWith('asset:')) {
    const rawId = id.slice('asset:'.length)
    const item = props.styleConfig.image_overlays?.find(asset => asset.id === rawId)
    return item ? { type: 'asset', id, item } : null
  }
  if (id.startsWith('icon:')) {
    const rawId = id.slice('icon:'.length)
    const item = props.styleConfig.icon_overlays?.find(icon => icon.id === rawId)
    return item ? { type: 'icon', id, item } : null
  }
  if (id.startsWith('slot:')) {
    const slot = id.slice('slot:'.length) as PosterTextSlot
    return slotEditable(slot) ? { type: 'slot', id, slot } : null
  }
  return null
}

const selectedPosterElementCanTransform = computed(() => {
  const selected = selectedPosterElement()
  if (!selected) return false
  if (selected.type === 'slot') return true
  if (selected.type === 'text') return selected.item.locked !== true
  if (selected.type === 'asset') return selected.item.locked !== true
  return selected.item.locked !== true
})
const selectedPosterElementResizable = computed(() => selectedPosterElementCanTransform.value)
const selectedPosterElementDraggable = computed(() => {
  const selected = selectedPosterElement()
  return selectedPosterElementCanTransform.value && selected?.type !== 'slot'
})
const selectedPosterElementRotatable = computed(() => {
  const selected = selectedPosterElement()
  return selectedPosterElementCanTransform.value && selected?.type !== 'slot'
})
const selectedPosterElementKeepRatio = computed(() => {
  const selected = selectedPosterElement()
  return selected?.type === 'asset' || selected?.type === 'icon'
})
const selectedPosterElementAllowsBleed = computed(() => {
  const selected = selectedPosterElement()
  return selected?.type === 'asset' && selected.item.allow_bleed === true
})
const posterMoveableBounds = computed(() => {
  if (selectedPosterElementAllowsBleed.value) return undefined
  const rect = posterCanvasEl.value?.getBoundingClientRect()
  if (!rect) return undefined
  const safe = Math.min(rect.width, rect.height) * 0.04
  return {
    left: safe,
    top: safe,
    right: rect.width - safe,
    bottom: rect.height - safe,
  }
})
const posterSnapGridPx = computed(() => {
  const rect = posterCanvasEl.value?.getBoundingClientRect()
  const spacing = Math.max(3, Math.min(16, props.styleConfig.grid_spacing ?? 8)) / 100
  return {
    width: Math.max(8, (rect?.width ?? 520) * spacing),
    height: Math.max(8, (rect?.height ?? 780) * spacing),
  }
})
const posterVerticalGuidelines = computed(() => posterGuidePixels('x'))
const posterHorizontalGuidelines = computed(() => posterGuidePixels('y'))

const showLegacyLogo = computed(() => {
  const hasLogoAsset = (props.styleConfig.image_overlays ?? []).some(asset => asset.kind === 'logo')
  return Boolean(props.styleConfig.show_logo && props.styleConfig.logo_url && !hasLogoAsset)
})

function posterGuidePixels(axis: 'x' | 'y') {
  const canvas = posterCanvasEl.value?.getBoundingClientRect()
  if (!canvas) return []
  const size = axis === 'x' ? canvas.width : canvas.height
  const safe = size * 0.04
  const guides = [0, safe, size / 3, size / 2, (size * 2) / 3, size - safe, size]
  if (mapContainer.value) {
    const map = mapContainer.value.getBoundingClientRect()
    guides.push(axis === 'x' ? map.left - canvas.left : map.top - canvas.top)
    guides.push(axis === 'x' ? map.right - canvas.left : map.bottom - canvas.top)
  }
  if (tier2PosterEditor.value && posterCanvasEl.value) {
    posterCanvasEl.value.querySelectorAll<HTMLElement>('[data-poster-element-id]').forEach((element) => {
      if (element === posterMoveableTarget.value) return
      const rect = element.getBoundingClientRect()
      const start = axis === 'x' ? rect.left - canvas.left : rect.top - canvas.top
      const end = axis === 'x' ? rect.right - canvas.left : rect.bottom - canvas.top
      guides.push(start, (start + end) / 2, end)
    })
  }
  return guides.map(value => Math.round(value)).filter(value => Number.isFinite(value))
}

function syncPosterMoveableTarget() {
  if (!posterElementsEditing.value || !props.selectedPosterElementId || !posterCanvasEl.value) {
    posterMoveableTarget.value = null
    moveableResizePreview.value = null
    moveableTextResizePreview.value = null
    moveableSlotResizePreview.value = null
    return
  }
  const selectorId = props.selectedPosterElementId.replace(/"/g, '\\"')
  posterMoveableTarget.value = posterCanvasEl.value.querySelector<HTMLElement>(`[data-poster-element-id="${selectorId}"]`)
}

function scheduleDeselect() {
  if (deselectTimer) clearTimeout(deselectTimer)
  deselectTimer = setTimeout(() => {
    selectedOverlayId.value = null
    selectedAssetId.value = null
  }, 2000)
}

function onOverlayClick(id: string) {
  if (freeOverlayEditorBlocked.value) return
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  selectedAssetId.value = null
  const el = posterCanvasEl.value?.querySelector<HTMLElement>(`[data-overlay-id="${id}"] .overlay-content`)
  if (el) selectTextTarget({ type: 'overlay', id }, el)
  emit('overlay-selected', id)
  emit('poster-element-selected', `text:${id}`)
}

function onOverlayDelete(id: string) {
  selectedOverlayId.value = null
  emit('overlay-deleted', id)
  emit('poster-element-selected', null)
}

function onAssetClick(id: string, event?: MouseEvent) {
  if (freeOverlayEditorBlocked.value) return
  if (deselectTimer) clearTimeout(deselectTimer)
  if (event?.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
  selectedAssetId.value = id
  selectedOverlayId.value = null
  activeTextTarget.value = null
  activeTextAnchor.value = null
  emit('asset-selected', id)
  emit('poster-element-selected', `asset:${id}`)
}

function clearAssetSelection() {
  selectedAssetId.value = null
  draggingAssetId.value = null
  emit('poster-element-selected', null)
}

function findImageAsset(id: string): MapAsset | undefined {
  return props.styleConfig.image_overlays?.find(a => a.id === id)
}

function assetPlacementBounds(asset: Pick<MapAsset, 'width' | 'height'>) {
  return {
    minX: -asset.width,
    maxX: 100,
    minY: -asset.height,
    maxY: 100,
  }
}

function clampAssetPosition(asset: Pick<MapAsset, 'width' | 'height'>, x: number, y: number) {
  const bounds = assetPlacementBounds(asset)
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
  }
}

function roundedPercent(value: number) {
  return Number(value.toFixed(2))
}

function clampPercent(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function selectedPosterPercentBounds(id: string) {
  const selected = selectedPosterElement()
  const safe = selectedPosterElementAllowsBleed.value ? 0 : 4
  if (!selected || selected.id !== id) {
    return { minX: safe, maxX: 100 - safe, minY: safe, maxY: 100 - safe }
  }
  if (selected.type === 'asset') {
    if (selected.item.allow_bleed === true) {
      return {
        minX: -selected.item.width,
        maxX: 100,
        minY: -selected.item.height,
        maxY: 100,
      }
    }
    return {
      minX: safe,
      maxX: Math.max(safe, 100 - safe - selected.item.width),
      minY: safe,
      maxY: Math.max(safe, 100 - safe - selected.item.height),
    }
  }
  if (selected.type === 'icon') {
    return {
      minX: safe,
      maxX: Math.max(safe, 100 - safe - selected.item.width),
      minY: safe,
      maxY: Math.max(safe, 100 - safe - selected.item.height),
    }
  }
  return { minX: safe, maxX: 100 - safe, minY: safe, maxY: 100 - safe }
}

function patchPosterElement(id: string, patch: PosterEditorElementPatch) {
  emit('poster-element-patched', { id, patch })
}

function positionTargetByDelta(target: HTMLElement, dx: number, dy: number) {
  const id = target.dataset.posterElementId
  const container = posterCanvasEl.value
  if (!id || !container) return null
  const rect = container.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const bounds = selectedPosterPercentBounds(id)
  const left = parseFloat(target.style.left) || 0
  const top = parseFloat(target.style.top) || 0
  const nextX = clampPercent(left + (dx / rect.width) * 100, bounds.minX, bounds.maxX)
  const nextY = clampPercent(top + (dy / rect.height) * 100, bounds.minY, bounds.maxY)
  target.style.left = `${nextX}%`
  target.style.top = `${nextY}%`
  return { x: roundedPercent(nextX), y: roundedPercent(nextY) }
}

function selectedTextAlignmentOffset() {
  const selected = selectedPosterElement()
  if (selected?.type !== 'text') return '0%'
  return selected.item.alignment === 'center'
    ? '-50%'
    : selected.item.alignment === 'right'
      ? '-100%'
      : '0%'
}

function applyPosterElementRotation(target: HTMLElement, rotation: number) {
  const id = target.dataset.posterElementId
  if (!id) return
  const normalized = Number.isFinite(rotation) ? rotation : 0
  if (id.startsWith('text:')) {
    target.style.transform = `translateX(${selectedTextAlignmentOffset()}) rotate(${normalized}deg)`
  } else {
    target.style.transform = `rotate(${normalized}deg)`
  }
}

function moveableDelta(event: unknown): [number, number] {
  const payload = event as { delta?: [number, number]; beforeDelta?: [number, number] }
  const delta = payload.delta ?? payload.beforeDelta ?? [0, 0]
  return [Number(delta[0]) || 0, Number(delta[1]) || 0]
}

function onPosterMoveableDrag(event: unknown) {
  const payload = event as { target?: HTMLElement }
  if (!payload.target) return
  const [dx, dy] = moveableDelta(event)
  positionTargetByDelta(payload.target, dx, dy)
}

function onPosterMoveableDragEnd(event: unknown) {
  const payload = event as { target?: HTMLElement }
  const id = payload.target?.dataset.posterElementId
  if (!id || !payload.target) return
  patchPosterElement(id, {
    x: roundedPercent(parseFloat(payload.target.style.left) || 0),
    y: roundedPercent(parseFloat(payload.target.style.top) || 0),
  })
}

function onPosterMoveableResizeStart() {
  moveableResizePreview.value = null
  moveableTextResizePreview.value = null
  moveableSlotResizePreview.value = null
}

function onPosterMoveableResize(event: unknown) {
  const payload = event as {
    target?: HTMLElement
    width?: number
    height?: number
    drag?: { delta?: [number, number]; beforeDelta?: [number, number] }
  }
  const target = payload.target
  const id = target?.dataset.posterElementId
  const container = posterCanvasEl.value
  if (!target || !id || !container) return
  const rect = container.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  if (id.startsWith('slot:')) {
    const slot = id.slice('slot:'.length) as PosterTextSlot
    const nextSizeCqh = clampPercent(((payload.height ?? target.getBoundingClientRect().height) / rect.height) * 100, 0.35, 12)
    const fontSizePt = clampTextSizePt(cqhToPt(nextSizeCqh))
    moveableSlotResizePreview.value = { slot, font_size_pt: fontSizePt }
    target.style.fontSize = `${nextSizeCqh}cqh`
    return
  }

  const dx = payload.drag?.delta?.[0] ?? payload.drag?.beforeDelta?.[0] ?? 0
  const dy = payload.drag?.delta?.[1] ?? payload.drag?.beforeDelta?.[1] ?? 0
  positionTargetByDelta(target, dx, dy)

  if (id.startsWith('text:')) {
    const nextSize = clampPercent(((payload.height ?? target.getBoundingClientRect().height) / rect.height) * 100, 0.5, 12)
    moveableTextResizePreview.value = { id: id.slice('text:'.length), font_size: nextSize }
    target.style.fontSize = `${nextSize}cqh`
    return
  }

  const width = clampPercent(((payload.width ?? target.getBoundingClientRect().width) / rect.width) * 100, 2, 100)
  const height = clampPercent(((payload.height ?? target.getBoundingClientRect().height) / rect.height) * 100, 2, 100)
  target.style.width = `${width}%`
  target.style.height = `${height}%`
  moveableResizePreview.value = { id, width, height }
}

function onPosterMoveableResizeEnd(event: unknown) {
  const payload = event as { target?: HTMLElement }
  const id = payload.target?.dataset.posterElementId
  if (!id || !payload.target) {
    moveableResizePreview.value = null
    moveableTextResizePreview.value = null
    moveableSlotResizePreview.value = null
    return
  }

  if (id.startsWith('slot:')) {
    const slot = id.slice('slot:'.length) as PosterTextSlot
    const preview = moveableSlotResizePreview.value
    if (preview?.slot === slot) emit('poster-text-override', { slot, patch: { font_size_pt: preview.font_size_pt } })
    moveableSlotResizePreview.value = null
    return
  }

  const patch: PosterEditorElementPatch = {
    x: roundedPercent(parseFloat(payload.target.style.left) || 0),
    y: roundedPercent(parseFloat(payload.target.style.top) || 0),
  }
  if (id.startsWith('text:')) {
    const preview = moveableTextResizePreview.value
    if (preview) patch.font_size = Number(preview.font_size.toFixed(2))
    patchPosterElement(id, patch)
  } else {
    const preview = moveableResizePreview.value
    if (preview) {
      patch.width = roundedPercent(preview.width)
      patch.height = roundedPercent(preview.height)
    }
    patchPosterElement(id, patch)
  }
  moveableResizePreview.value = null
  moveableTextResizePreview.value = null
  moveableSlotResizePreview.value = null
}

function moveableRotation(event: unknown): number {
  const payload = event as { beforeRotate?: number; rotation?: number; rotate?: number }
  return Number(payload.beforeRotate ?? payload.rotation ?? payload.rotate ?? 0)
}

function onPosterMoveableRotate(event: unknown) {
  const payload = event as { target?: HTMLElement }
  if (!payload.target) return
  applyPosterElementRotation(payload.target, moveableRotation(event))
}

function onPosterMoveableRotateEnd(event: unknown) {
  const payload = event as { target?: HTMLElement }
  const id = payload.target?.dataset.posterElementId
  if (!id) return
  patchPosterElement(id, { rotation: Number(moveableRotation(event).toFixed(1)) })
}

function isEditableTextElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .inline-text-toolbar'))
}

function onDocumentPointerDown(event: PointerEvent) {
  if (chromeAddPanelOpen.value) {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!target?.closest('.chrome-editor-app-bar, .chrome-add-block-panel, .chrome-layout-builder')) {
      closeChromeAddPanel()
    }
  }
  if (!props.editable || !selectedAssetId.value) return
  if (event.target instanceof HTMLElement && event.target.closest('.image-asset')) return
  clearAssetSelection()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && chromeAddPanelOpen.value) {
    closeChromeAddPanel()
    return
  }
  if (!props.editable || !selectedAssetId.value) return
  if (isEditableTextElement(event.target)) return

  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const direction = directions[event.key]
  if (!direction) {
    if (event.key === 'Escape') clearAssetSelection()
    return
  }

  const id = selectedAssetId.value
  const asset = findImageAsset(id)
  if (!asset) return

  event.preventDefault()
  const step = event.shiftKey ? 1 : event.altKey ? 0.05 : 0.25
  const next = clampAssetPosition(asset, asset.x + direction[0] * step, asset.y + direction[1] * step)
  emit('asset-moved', { id, x: roundedPercent(next.x), y: roundedPercent(next.y) })
}

function onAssetDelete(id: string) {
  selectedAssetId.value = null
  emit('asset-deleted', id)
  emit('poster-element-selected', null)
}

function onIconClick(id: string) {
  if (guidedPosterEditor.value) return
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedAssetId.value = null
  selectedOverlayId.value = null
  activeTextTarget.value = null
  activeTextAnchor.value = null
  emit('poster-element-selected', `icon:${id}`)
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
  selectedAssetId.value = id
  selectedOverlayId.value = null
  draggingAssetId.value = id
  emit('asset-selected', id)

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
    draggingAssetId.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
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
  alignItems: chromeMobileDrawerOpen.value ? 'flex-start' : undefined,
  justifyContent: chromeMobileDrawerOpen.value ? 'center' : undefined,
  containerType: isPrintRender.value ? undefined : 'size',
}))

const effectiveRoutePaint = computed(() => resolveTonerRouteStyle(props.styleConfig))

const posterCanvasClass = computed(() => ({
  'shadow-[0_32px_80px_rgba(0,0,0,0.35)]': !isPrintRender.value,
  'poster-canvas--print': isPrintRender.value,
  'poster-composition': true,
  'poster-has-route': hasRenderableRoute.value,
  'poster-place-map': !hasRenderableRoute.value,
  [posterCompositionClassName(composition.value.id)]: true,
}))

const editorPosterAspect = computed(() => {
  const [width, height] = String(props.styleConfig.print_size ?? '').split('x').map(Number)
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height }
  }
  return { width: 2, height: 3 }
})

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
      '--land-color': props.styleConfig.land_color ?? props.styleConfig.background_color,
      '--label-text-color': props.styleConfig.label_text_color,
      '--contour-major-color': props.styleConfig.contour_major_color ?? props.styleConfig.label_text_color,
      '--composition-ink': props.styleConfig.label_text_color,
      '--composition-paper': props.styleConfig.background_color,
      '--composition-title-font': typography.value.titleFont,
      '--composition-body-font': typography.value.subFont,
      '--composition-rule-left': compositionRuleInset.value.left,
      '--composition-rule-right': compositionRuleInset.value.right,
      '--label-bg-color': props.styleConfig.label_bg_color ?? props.styleConfig.background_color,
      '--route-color': effectiveRoutePaint.value.route_color,
    }
  : {
      aspectRatio: `${editorPosterAspect.value.width} / ${editorPosterAspect.value.height}`,
      backgroundColor: props.styleConfig.background_color,
      width: `min(100cqw, calc(100cqh * ${editorPosterAspect.value.width / editorPosterAspect.value.height}))`,
      height: chromeMobileDrawerOpen.value
        ? `min(100cqh, calc(100cqw * ${editorPosterAspect.value.height / editorPosterAspect.value.width}), calc(100dvh - min(300px, 48vh) - 80px))`
        : `min(100cqh, calc(100cqw * ${editorPosterAspect.value.height / editorPosterAspect.value.width}))`,
      maxWidth: '100%',
      maxHeight: '100%',
      containerType: 'size',
      '--print-bleed': '0px',
      '--water-color': props.styleConfig.water_color ?? props.styleConfig.label_text_color,
      '--land-color': props.styleConfig.land_color ?? props.styleConfig.background_color,
      '--label-text-color': props.styleConfig.label_text_color,
      '--contour-major-color': props.styleConfig.contour_major_color ?? props.styleConfig.label_text_color,
      '--composition-ink': props.styleConfig.label_text_color,
      '--composition-paper': props.styleConfig.background_color,
      '--composition-title-font': typography.value.titleFont,
      '--composition-body-font': typography.value.subFont,
      '--composition-rule-left': compositionRuleInset.value.left,
      '--composition-rule-right': compositionRuleInset.value.right,
      '--label-bg-color': props.styleConfig.label_bg_color ?? props.styleConfig.background_color,
      '--route-color': effectiveRoutePaint.value.route_color,
    })

const typography = computed(() => getPosterTypography(props.styleConfig))

const layout = computed(() => getPosterLayout(props.styleConfig))

const composition = computed(() => getPosterCompositionProfile(props.styleConfig))
const sideRailInsideMap = computed(() => composition.value.id === 'modernist-block' && composition.value.showSideRail)
const showPlateFrameOverlay = computed(() => composition.value.id === 'place-frame')
const showCartoucheHills = computed(() => composition.value.id === 'place-frame')

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

const locationText = computed(() => {
  const text = props.styleConfig.location_text?.trim() || ((props.map.stats as unknown as { location?: string })?.location?.trim() ?? '')
  return textWithOverride('location_text', text)
})
const locationLine = computed(() => {
  if (!locationText.value) return ''
  if (props.styleConfig.color_theme === 'blueprint' && composition.value.id === 'blueprint-grid') return locationText.value
  if (composition.value.id === 'modernist-block') return locationText.value
  if (composition.value.id === 'bib-numerals') return locationText.value
  if (composition.value.id === 'botanical-plate') return locationText.value
  if (composition.value.id === 'place-frame') return locationText.value
  if (composition.value.id === 'darksky-stars') return locationText.value
  if (composition.value.id === 'blueprint-strava') return locationText.value
  return locationText.value.toUpperCase()
})

const occasionText = computed(() => textWithOverride('occasion_text', props.styleConfig.occasion_text || ''))
const genericOccasionText = new Set(['complete trail network'])
const risoCaptionText = computed(() => {
  const occasion = occasionText.value.trim()
  return occasion && !genericOccasionText.has(occasion.toLowerCase()) ? occasion : trailName.value
})
const risoLocationText = computed(() => locationText.value.trim() || 'Route study')
const risoMetaLabel = computed(() => {
  const text = risoLocationText.value.trim()
  if (!text || text.toLowerCase() === 'route study') return 'ROUTE'
  const parts = text.split(',').map(part => part.trim()).filter(Boolean)
  return (parts[parts.length - 1] || text).toUpperCase()
})
const OCCASION_SLOT_COMPOSITIONS = new Set([
  'legacy-classic',
  'editorial-tall',
  'park-quad',
  'riso-stack',
  'journal-spread',
  'darksky-stars',
  'botanical-plate',
])
const showOccasionSlot = computed(() => OCCASION_SLOT_COMPOSITIONS.has(composition.value.id))

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

function formatDms(value: number, pos: string, neg: string) {
  const abs = Math.abs(value)
  const d = Math.floor(abs)
  const mFloat = (abs - d) * 60
  const m = Math.floor(mFloat)
  const s = Math.round((mFloat - m) * 60)
  const normalizedSeconds = s === 60 ? 0 : s
  const normalizedMinutes = s === 60 ? m + 1 : m
  const normalizedDegrees = normalizedMinutes === 60 ? d + 1 : d
  const finalMinutes = normalizedMinutes === 60 ? 0 : normalizedMinutes
  return `${normalizedDegrees}°${finalMinutes.toString().padStart(2, '0')}'${normalizedSeconds.toString().padStart(2, '0')}"${value >= 0 ? pos : neg}`
}

const usgsCoordinateTicks = computed(() => {
  const b = props.map.bbox
  if (!b || b.length < 4) return []
  const [minLng, minLat, maxLng, maxLat] = b
  return [
    { id: 'nw', label: `${formatDms(maxLat, 'N', 'S')} · ${formatDms(minLng, 'E', 'W')}` },
    { id: 'ne', label: `${formatDms(maxLat, 'N', 'S')} · ${formatDms(maxLng, 'E', 'W')}` },
    { id: 'se', label: `${formatDms(minLat, 'N', 'S')} · ${formatDms(maxLng, 'E', 'W')}` },
    { id: 'sw', label: `${formatDms(minLat, 'N', 'S')} · ${formatDms(minLng, 'E', 'W')}` },
  ]
})

const formattedDistance = computed(() => {
  const km = props.map.stats?.distance_km ?? 0
  return km ? (km * 0.621371).toFixed(1) : ''
})

const formattedDistanceKm = computed(() => {
  const km = props.map.stats?.distance_km ?? 0
  return km ? km.toFixed(1) : ''
})

const compositionFooterDistance = computed(() => {
  if (props.styleConfig.composition_footer_distance_unit === 'km') {
    return formattedDistanceKm.value ? `${formattedDistanceKm.value} km` : ''
  }
  return formattedDistance.value ? `${formattedDistance.value} mi` : ''
})

const formattedGain = computed(() => {
  const m = props.map.stats?.elevation_gain_m ?? 0
  return m ? Math.round(m * 3.28084).toLocaleString() : ''
})

const formattedGainM = computed(() => {
  const m = props.map.stats?.elevation_gain_m ?? 0
  return m ? Math.round(m).toLocaleString() : ''
})

const formattedDuration = computed(() => {
  const total = props.map.stats?.duration_seconds
  if (!total || total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = Math.floor(total % 60)
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const marathonFinishHeadline = computed(() => {
  if (formattedDuration.value) return formattedDuration.value
  if (formattedDistance.value) return `${formattedDistance.value} MI`
  if (formattedGain.value) return `${formattedGain.value} FT`
  return 'ROUTE DATA'
})
const marathonBibYear = computed(() => {
  const value = props.map.stats?.date
  if (!value) return '2025'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 4) || '2025'
  return String(date.getUTCFullYear())
})
const marathonBibTopline = computed(() => {
  const region = (props.map.stats?.location?.trim() || locationText.value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .pop()
    ?.toUpperCase() || 'MASSACHUSETTS'
  return `${region} · BIB ${marathonBibYear.value}`
})
const marathonBibLatitude = computed(() => {
  const routeCoords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
  const first = routeCoords[0]
  const lat = Array.isArray(first) ? first[1] : undefined
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return coords.value?.lat ?? ''
  const suffix = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(4)}°${suffix}`
})
const showBibDataFooter = computed(() => composition.value.id === 'bib-numerals')
const marathonBibFooterItems = computed(() => [
  formattedDistance.value ? `${formattedDistance.value} mi` : '26.2 mi',
  formattedGain.value ? `${formattedGain.value} ft GAIN` : '813 ft GAIN',
  marathonBibLatitude.value || '42.3601°N',
])
const botanicalPlateLatitude = computed(() => {
  const routeCoords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
  const first = routeCoords[0]
  const lat = Array.isArray(first) ? first[1] : undefined
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return coords.value?.lat ?? ''
  const suffix = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(4)}°${suffix}`
})
const contourWashEyebrow = computed(() => {
  return `ITALIA · ${botanicalPlateLatitude.value || '46.6186°N'}`
})

const hasRenderableRoute = computed(() => {
  const hasVisibleSegments = (props.styleConfig.trail_segments ?? []).some(segment => segment.visible)
  if (props.styleConfig.show_primary_route === false && !hasVisibleSegments) return false
  const coords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
  return coords.length > 1
})

const formattedDate = computed(() => {
  const value = props.map.stats?.date
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (composition.value.id === 'blueprint-grid' && props.styleConfig.color_theme === 'blueprint') {
    const day = date.getUTCDate().toString().padStart(2, '0')
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
    return `${day} ${month} ${date.getUTCFullYear()}`
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const formattedDateCompact = computed(() => {
  const value = props.map.stats?.date
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (props.styleConfig.composition_footer_date_format === 'month-year') {
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
    return `${month} ${date.getUTCFullYear()}`
  }
  if (composition.value.id === 'darksky-stars') {
    const day = date.getUTCDate().toString().padStart(2, '0')
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
    return `${day} ${month} ${date.getUTCFullYear()}`
  }
  if (
    composition.value.id === 'travel-banner' ||
    composition.value.id === 'modernist-block' ||
    composition.value.id === 'blueprint-grid' ||
    composition.value.id === 'blueprint-strava' ||
    composition.value.id === 'splits-grid' ||
    composition.value.id === 'brutalist-slab'
  ) {
    return value.slice(0, 10)
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const formattedMonthYear = computed(() => {
  const value = props.map.stats?.date
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  return `${month} ${date.getUTCFullYear()}`
})

const distanceText = computed(() => textWithOverride('distance', formattedDistance.value ? `${formattedDistance.value}\nmiles` : ''))
const brutalistDistanceText = computed(() => textWithOverride('distance', formattedDistance.value ? `${formattedDistance.value} mi` : ''))
const elevationGainText = computed(() => textWithOverride('elevation_gain', formattedGain.value ? `${formattedGain.value}\nft gain` : ''))
const dateText = computed(() => textWithOverride('date', formattedDate.value))
const coordinatesText = computed(() => textWithOverride('coordinates', coords.value ? `${coords.value.lat}\n${coords.value.lng}` : ''))
const chromeCoordinatesText = computed(() => {
  const location = props.map.stats?.location?.trim() || props.styleConfig.location_text?.trim() || ''
  if (
    composition.value.id === 'blueprint-grid' ||
    composition.value.id === 'blueprint-strava' ||
    composition.value.id === 'splits-grid'
  ) {
    return coords.value ? `${coords.value.lat}\n${coords.value.lng}` : location
  }
  return location || (coords.value ? `${coords.value.lat}\n${coords.value.lng}` : '')
})
const technicalDataRegion = computed(() => {
  const source = props.map.stats?.location?.trim() || locationLine.value
  return source
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .pop()
    ?.toUpperCase() || 'ROUTE'
})
const formattedTechnicalDate = computed(() => {
  const value = props.map.stats?.date
  if (!value) return formattedDateCompact.value || 'DATE'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10).replaceAll('-', '.')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${month}.${day}.${date.getUTCFullYear()}`
})
const showTechnicalDataFooter = computed(() =>
  composition.value.id === 'blueprint-strava' ||
  composition.value.id === 'splits-grid',
)
const showMoonstoneTechnicalFooter = computed(() =>
  composition.value.id === 'blueprint-grid' && props.styleConfig.color_theme === 'moonstone',
)
const hideGenericFooterStats = computed(() =>
  composition.value.id === 'darksky-stars' ||
  composition.value.id === 'botanical-plate' ||
  props.styleConfig.color_theme === 'editorial-minimal' ||
  showBibDataFooter.value ||
  showMoonstoneTechnicalFooter.value,
)
const technicalDataFooterItems = computed(() => [
  { label: 'Distance', value: formattedDistance.value ? `${formattedDistance.value} mi` : '—' },
  { label: 'Elev Gain', value: formattedGain.value ? `${formattedGain.value} ft` : '—' },
  { label: 'Location', value: technicalDataRegion.value },
  { label: 'Date', value: props.styleConfig.color_theme === 'night-ride' ? formattedMonthYear.value : formattedTechnicalDate.value },
])
const blueprintDraftingToplineLabel = computed(() =>
  composition.value.id === 'blueprint-strava'
    ? `RADMAPS · ${technicalDataRegion.value}`
    : 'RADMAPS · SHEET A',
)
const blueprintDraftingFigureLabel = computed(() => 'FIG. 01 · ROUTE PLAN')
const showSplitsProfileChrome = computed(() => composition.value.id === 'splits-grid')
const profileGainLabel = computed(() => formattedGain.value ? `${formattedGain.value} ft GAIN` : 'GAIN')
const startPinLabel = computed(() =>
  composition.value.id === 'bib-numerals' || composition.value.id === 'botanical-plate'
    ? ''
    : textWithOverride('start_pin_label', props.styleConfig.start_pin_label ?? 'Start'),
)
const finishPinLabel = computed(() =>
  composition.value.id === 'bib-numerals' || composition.value.id === 'botanical-plate'
    ? ''
    : textWithOverride('finish_pin_label', props.styleConfig.finish_pin_label ?? 'Finish'),
)
const isUsgsHeritageTheme = computed(() => props.styleConfig.color_theme === 'usgs-vintage')
const isClassicTrailTheme = computed(() => props.styleConfig.color_theme === 'classic-trail')
const isBlueprintTheme = computed(() => props.styleConfig.color_theme === 'blueprint' && composition.value.id === 'blueprint-grid')
const isBlueprintDraftingTheme = computed(() =>
  (composition.value.id === 'blueprint-grid' &&
    (props.styleConfig.color_theme === 'blueprint' || props.styleConfig.color_theme === 'moonstone')) ||
  composition.value.id === 'blueprint-strava',
)

const compositionDecorDefaults = computed<CompositionDecor>(() => {
  const distance = formattedDistance.value ? `${formattedDistance.value} mi` : 'route study'
  const gain = formattedGain.value ? `${formattedGain.value} ft` : 'field notes'
  const date = dateText.value || 'undated'
  const location = locationLine.value || 'trail record'
  const locationRegion = locationLine.value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .pop()
    ?? location

  switch (composition.value.id) {
    case 'editorial-tall':
      if (props.styleConfig.color_theme === 'relief-shaded') {
        return {
          kicker: 'WASHINGTON',
          meta: `${coords.value ? `${coords.value.lat} ${coords.value.lng}` : location}\n${distance} · ${formattedMonthYear.value || date}`,
        }
      }
      return {
        kicker: 'WASHINGTON',
        meta: `${coords.value ? `${coords.value.lat} ${coords.value.lng}` : location}\n${distance} · ${formattedMonthYear.value || date}`,
      }
    case 'park-quad':
      if (isUsgsHeritageTheme.value) {
        return {
          kicker: coords.value?.lat ?? '36.5785°N',
          meta: 'SCALE 1:24 000',
        }
      }
      if (isClassicTrailTheme.value) {
        return {
          kicker: coords.value?.lat ?? '56°07\'N',
          meta: 'SCALE 1:24,000',
        }
      }
      return {
        kicker: 'United States · Department of the Interior',
        meta: 'Geological Survey · 7.5-minute series',
        footerNote: `${coords.value?.lat ?? ''} ${coords.value?.lng ?? ''}`.trim(),
      }
    case 'travel-banner':
      return {
        kicker: 'VISIT',
        meta: `${location} · ${date}`,
      }
    case 'riso-stack':
      return {
        kicker: 'Edition 01 / 50',
        meta: 'Two-color trail print',
      }
    case 'blueprint-grid':
      if (isBlueprintDraftingTheme.value) return {}
      return {
        kicker: 'WGS84',
        meta: 'SHEET 01',
      }
    case 'blueprint-strava':
      return {}
    case 'journal-spread':
      return {
        kicker: 'IX · MMXXVI — A field study',
        meta: 'Annotated trail specimen',
        footerNote: `${distance} · ${gain} · fair / clear`,
        sideRailLabel: 'FIELD NOTES',
      }
    case 'modernist-block':
      return {
        kicker: locationRegion,
        meta: `${distance}\n${coords.value?.lat ?? gain}`,
      }
    case 'splits-grid':
      return {}
    case 'bib-numerals':
      return {}
    case 'darksky-stars':
      return {
        kicker: `${locationRegion || location} · ${coords.value?.lat ?? ''}`.trim(),
        footerNote: `${location}\n${compositionFooterDistance.value || distance} · ${formattedDateCompact.value || date}`,
      }
    case 'botanical-plate':
      return {
        kicker: 'Plate IX — Italia',
        meta: botanicalPlateLatitude.value || '46.6186°N',
      }
    case 'brutalist-slab':
      return {
        kicker: 'RADMAPS',
        meta: date,
        footerNote: `${occasionText.value || trailName.value}\n${locationText.value}`,
      }
    case 'art-wash':
      if (props.styleConfig.color_theme === 'contour-wash') {
        return {
          kicker: contourWashEyebrow.value,
        }
      }
      return {
        kicker: `${location} · ${coords.value?.lat ?? ''}`.trim(),
      }
    case 'place-frame':
      return {
        kicker: occasionText.value || location || 'PLACE PORTRAIT',
        meta: `${coords.value?.lat ?? ''} ${coords.value?.lng ?? ''} · ${formattedGainM.value ? `${formattedGainM.value} m` : gain}`.trim(),
      }
    case 'sea-chart':
      return {
        kicker: `Chart No. 1 · ${location || 'COASTAL ROUTE'}`,
        meta: `${coords.value?.lat ?? ''} ${coords.value?.lng ?? ''} · SOUNDINGS IN FATHOMS`.trim(),
      }
    case 'transit-diagram':
      return {
        kicker: location || 'TOUR LINE',
        meta: `STATION · ${date} · ${coords.value?.lat ?? ''}`.trim(),
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
  chromeSlotVisible('distance') && props.styleConfig.labels.show_distance && (editableTextVisible(distanceText.value)),
)
const showElevationGainSlot = computed(() =>
  chromeSlotVisible('elevation_gain') &&
  props.styleConfig.labels.show_elevation_gain &&
  Boolean(formattedGain.value || hasVisibleTextOverride('elevation_gain')),
)
const showDateSlot = computed(() =>
  chromeSlotVisible('date') && props.styleConfig.labels.show_date && editableTextVisible(dateText.value),
)
const showCoordinatesSlot = computed(() =>
  chromeSlotVisible('coordinates') && props.styleConfig.labels?.show_location !== false && editableTextVisible(coordinatesText.value),
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

const MIN_TEXT_SIZE_PT = 6
const MAX_TEXT_SIZE_PT = 240
const DEFAULT_PRINT_HEIGHT_IN = 36

function clampTextSizePt(value: number): number {
  if (!Number.isFinite(value)) return MIN_TEXT_SIZE_PT
  return Math.min(MAX_TEXT_SIZE_PT, Math.max(MIN_TEXT_SIZE_PT, Number(value.toFixed(1))))
}

function printHeightInches(): number {
  const [, height] = String(props.styleConfig.print_size ?? '').split('x').map(Number)
  return Number.isFinite(height) && height > 0 ? height : DEFAULT_PRINT_HEIGHT_IN
}

function cqhToPt(cqh: number): number {
  return clampTextSizePt((cqh / 100) * printHeightInches() * 72)
}

function ptToCqh(pt: number): number {
  return (clampTextSizePt(pt) / (printHeightInches() * 72)) * 100
}

function posterHeightPx(): number {
  return posterCanvasEl.value?.getBoundingClientRect().height || containerDims.value.h || 0
}

function posterPxToPt(px: number): number {
  const heightPx = posterHeightPx()
  if (!heightPx) return cqhToPt(px)
  return clampTextSizePt((px / heightPx) * printHeightInches() * 72)
}

function ptToPosterPx(pt: number): number {
  const heightPx = posterHeightPx()
  if (!heightPx) return ptToCqh(pt)
  return (clampTextSizePt(pt) / (printHeightInches() * 72)) * heightPx
}

function defaultSlotAlign(slot: PosterTextSlot): NonNullable<ChromeBlock['align']> {
  if (slot === 'trail_name' || slot === 'location_text') {
    return composition.value.titleAlign === 'left' ? 'left' : 'center'
  }
  if (slot === 'occasion_text') return 'center'
  return 'left'
}

function effectiveSlotAlign(slot: PosterTextSlot, fallback = defaultSlotAlign(slot)): NonNullable<ChromeBlock['align']> {
  return slotOverride(slot).align ?? fallback
}

function effectiveSlotFontSizeCqh(slot: PosterTextSlot, baseCqh: number, autoScale = 1): number {
  const override = slotOverride(slot)
  if (override.font_size_pt != null) return ptToCqh(override.font_size_pt)
  return baseCqh * effectiveSlotScale(slot, legacySlotScale(slot)) * autoScale
}

function effectiveSlotOpacity(slot: PosterTextSlot, fallback: number): number {
  return slotOverride(slot).opacity ?? fallback
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
  backgroundColor: posterLayout.value.bands.header.background ?? headerBg.value,
  color: fg.value,
  padding: chromeGridRendering.value
    ? chromeBandPaddingCss('header', chromeBandEditingPaddingCss())
    : chromeBandPaddingCss('header', composition.value.id === 'legacy-classic'
        ? (layout.value.titlePosition === 'bottom'
            ? `2.4cqh calc(7cqw + ${printBleedCssPx.value}px) calc(3.5cqh + ${printBleedCssPx.value}px)`
            : `calc(5cqh + ${printBleedCssPx.value}px) calc(7cqw + ${printBleedCssPx.value}px) 2.8cqh`)
        : composition.value.headerPadding),
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: composition.value.titleAlign === 'left' ? 'flex-start' : 'center',
  justifyContent: 'center',
  gap: composition.value.id === 'legacy-classic' ? '1.1cqh' : '0.8cqh',
  position: 'relative' as const,
  order: String(composition.value.headerOrder),
  zIndex: chromeBandElevated('header') ? 60 : 3,
  boxSizing: 'border-box' as const,
  minHeight: '0',
  flex: composition.value.id === 'transit-diagram'
    ? '0 0 17%'
    : posterLayout.value.bands.header.height != null
      ? `0 0 ${posterLayout.value.bands.header.height}%`
      : undefined,
  height: composition.value.id === 'transit-diagram'
    ? '17%'
    : posterLayout.value.bands.header.height != null
    ? `${posterLayout.value.bands.header.height}%`
    : undefined,
}))

const trailNameStyle = computed(() => ({
  fontFamily: effectiveSlotFont('trail_name', typography.value.titleFont),
  fontWeight: effectiveSlotWeight('trail_name', typography.value.titleWeight),
  fontStyle: effectiveSlotItalic('trail_name'),
  letterSpacing: typography.value.titleTracking,
  textTransform: typography.value.titleCase === 'uppercase' ? 'uppercase' as const : 'none' as const,
  fontSize: `${effectiveSlotFontSizeCqh('trail_name', typography.value.titleSize)}cqh`,
  '--trail-title-size': `${effectiveSlotFontSizeCqh('trail_name', typography.value.titleSize)}cqh`,
  lineHeight: typography.value.titleLineHeight,
  color: effectiveSlotColor('trail_name', fg.value),
  opacity: String(effectiveSlotOpacity('trail_name', 1)),
  textAlign: effectiveSlotAlign('trail_name', composition.value.titleAlign === 'left' ? 'left' : 'center'),
  width: '100%',
  maxWidth: '100%',
  margin: '0',
  padding: '0',
  outline: 'none',
  overflowWrap: 'anywhere' as const,
  textWrap: 'balance' as const,
  hyphens: 'auto' as const,
  textShadow: getTextHalo(headerBg.value),
}))

const locationLineStyle = computed(() => ({
  fontFamily: effectiveSlotFont('location_text', typography.value.subFont),
  fontWeight: effectiveSlotWeight('location_text', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('location_text'),
  letterSpacing: typography.value.subTracking,
  fontSize: `${effectiveSlotFontSizeCqh('location_text', typography.value.subSize)}cqh`,
  color: effectiveSlotColor('location_text', fg.value),
  opacity: String(effectiveSlotOpacity('location_text', 0.5)),
  textTransform: 'uppercase' as const,
  textAlign: effectiveSlotAlign('location_text', composition.value.titleAlign === 'left' ? 'left' : 'center'),
  width: '100%',
  maxWidth: '100%',
  margin: '0',
  padding: '0',
  outline: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  textShadow: getTextHalo(headerBg.value),
}))

const compositionKickerStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_kicker', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_kicker', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('composition_kicker'),
  fontSize: `${effectiveSlotFontSizeCqh('composition_kicker', 0.88)}cqh`,
  letterSpacing: composition.value.id === 'editorial-tall' || composition.value.id === 'botanical-plate'
    ? '0.08em'
    : '0.24em',
  color: effectiveSlotColor('composition_kicker', fg.value),
  backgroundColor: slotOverride('composition_kicker').bg_color ?? 'transparent',
  opacity: String(effectiveSlotOpacity('composition_kicker', composition.value.id === 'brutalist-slab' ? 0.92 : 0.64)),
  textAlign: effectiveSlotAlign('composition_kicker'),
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}))

const compositionMetaStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_meta', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_meta', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('composition_meta'),
  fontSize: `${effectiveSlotFontSizeCqh('composition_meta', 0.72)}cqh`,
  letterSpacing: '0.18em',
  color: effectiveSlotColor('composition_meta', fg.value),
  backgroundColor: slotOverride('composition_meta').bg_color ?? 'transparent',
  opacity: String(effectiveSlotOpacity('composition_meta', 0.52)),
  textAlign: effectiveSlotAlign('composition_meta'),
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}))

const compositionFooterNoteStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_footer', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_footer', typography.value.subWeight),
  fontStyle: effectiveSlotItalic('composition_footer'),
  fontSize: `${effectiveSlotFontSizeCqh('composition_footer', 0.62)}cqh`,
  color: effectiveSlotColor('composition_footer', fg.value),
  backgroundColor: slotOverride('composition_footer').bg_color ?? 'transparent',
  opacity: String(effectiveSlotOpacity('composition_footer', 0.36)),
  textAlign: effectiveSlotAlign('composition_footer', 'center'),
  width: '100%',
}))

const compositionSideRailLabelStyle = computed(() => ({
  fontFamily: effectiveSlotFont('composition_side_rail', typography.value.subFont),
  fontWeight: effectiveSlotWeight('composition_side_rail', '700'),
  fontStyle: effectiveSlotItalic('composition_side_rail'),
  fontSize: `${effectiveSlotFontSizeCqh('composition_side_rail', 0.82)}cqh`,
  color: effectiveSlotColor('composition_side_rail', fg.value),
  backgroundColor: slotOverride('composition_side_rail').bg_color ?? 'transparent',
  opacity: String(effectiveSlotOpacity('composition_side_rail', 0.32)),
  textAlign: effectiveSlotAlign('composition_side_rail', 'center'),
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
      return { left: `calc(6.8cqw + ${bleed})`, right: `calc(6.8cqw + ${bleed})` }
    case 'park-quad':
    case 'botanical-plate':
      return { left: `calc(4.25cqw + ${bleed})`, right: `calc(4.25cqw + ${bleed})` }
    case 'blueprint-strava':
    case 'splits-grid':
      return { left: `calc(4.35cqw + ${bleed})`, right: `calc(4.35cqw + ${bleed})` }
    case 'modernist-block':
      return { left: `calc(18.9cqw + ${bleed})`, right: `calc(5.5cqw + ${bleed})` }
    case 'brutalist-slab':
      return { left: `calc(6.7cqw + ${bleed})`, right: `calc(6.7cqw + ${bleed})` }
    case 'travel-banner':
    case 'darksky-stars':
      return { left: `calc(3.6cqw + ${bleed})`, right: `calc(3.6cqw + ${bleed})` }
    default:
      return { left: `calc(6cqw + ${bleed})`, right: `calc(6cqw + ${bleed})` }
  }
})

const footerRuleStyle = computed(() => ({
  left: 'var(--composition-rule-left)',
  right: 'var(--composition-rule-right)',
  backgroundColor: fg.value,
  opacity: composition.value.id === 'brutalist-slab' ? '0.12' : '0.1',
}))

const footerBandStyle = computed(() => ({
  backgroundColor: posterLayout.value.bands.footer.background ?? bg.value,
  color: fg.value,
  padding: composition.value.footerVariant === 'hidden'
    ? '0'
    : chromeGridRendering.value
    ? chromeBandPaddingCss('footer', chromeBandEditingPaddingCss())
    : chromeBandPaddingCss('footer', composition.value.id === 'legacy-classic'
        ? `${props.styleConfig.border_style !== 'none' ? 'calc(1.8cqh + 14px)' : '1.8cqh'} calc(7cqw + ${printBleedCssPx.value}px) ${props.styleConfig.border_style !== 'none'
            ? `calc(1.8cqh + 14px + ${printBleedCssPx.value}px)`
            : `calc(1.8cqh + ${printBleedCssPx.value}px)`}`
        : composition.value.footerPadding),
  display: composition.value.footerVariant === 'hidden' ? 'none' : 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative' as const,
  borderTop: '0',
  order: String(composition.value.footerOrder),
  zIndex: chromeBandElevated('footer') ? 60 : 3,
  boxSizing: 'border-box' as const,
  minHeight: '0',
  flex: composition.value.footerVariant === 'hidden'
    ? '0 0 0'
    : composition.value.id === 'transit-diagram'
      ? '0 0 8%'
      : posterLayout.value.bands.footer.height != null
        ? `0 0 ${posterLayout.value.bands.footer.height}%`
      : undefined,
  height: composition.value.footerVariant === 'hidden'
    ? '0'
    : composition.value.id === 'transit-diagram'
      ? '8%'
      : posterLayout.value.bands.footer.height != null
    ? `${posterLayout.value.bands.footer.height}%`
    : undefined,
}))

const mapAreaStyle = computed(() => ({
  order: String(composition.value.mapOrder),
  margin: composition.value.mapMargin,
  border: composition.value.mapBorder,
  boxShadow: composition.value.mapShadow,
  flex: composition.value.id === 'transit-diagram'
    ? '0 0 75%'
    : props.styleConfig.color_theme === 'editorial-minimal'
      ? '0 0 64%'
      : undefined,
  height: composition.value.id === 'transit-diagram'
    ? '75%'
    : props.styleConfig.color_theme === 'editorial-minimal'
      ? '64%'
      : undefined,
  boxSizing: 'border-box' as const,
  minHeight: '0',
  zIndex: 2,
  color: fg.value,
}))

const gridScope = computed(() => props.styleConfig.grid_scope ?? 'poster')
const showPosterGrid = computed(() => props.styleConfig.show_grid === true && gridScope.value === 'poster')
const showMapGrid = computed(() => props.styleConfig.show_grid === true && gridScope.value === 'map')
const elevationProfilePosition = computed(() => props.styleConfig.elevation_profile_position ?? 'map-overlay')
const elevationProfileHeight = computed(() => props.styleConfig.elevation_profile_height ?? (elevationProfilePosition.value === 'separate-band' ? 12 : 22))
const showElevationProfile = computed(() => props.styleConfig.show_elevation_profile === true && mapReady.value)
const showOverlayElevationProfile = computed(() => showElevationProfile.value && elevationProfilePosition.value === 'map-overlay')
const showSeparateElevationProfile = computed(() => showElevationProfile.value && elevationProfilePosition.value === 'separate-band')
const elevationProfileBandStyle = computed(() => ({
  order: String(composition.value.id === 'splits-grid' ? composition.value.headerOrder + 1 : composition.value.mapOrder),
  margin: composition.value.mapMargin,
  height: `${elevationProfileHeight.value}cqh`,
  minHeight: '0',
  zIndex: 2,
  color: fg.value,
  backgroundColor: props.styleConfig.label_bg_color ?? props.styleConfig.background_color,
}))
const gridOverlayStyle = computed(() => {
  const color = props.styleConfig.grid_color ?? props.styleConfig.label_text_color ?? '#1C1917'
  const weight = props.styleConfig.grid_weight ?? 1
  const spacing = Math.max(3, Math.min(16, props.styleConfig.grid_spacing ?? 8))
  return {
    opacity: String(props.styleConfig.grid_opacity ?? 0.2),
    backgroundSize: `${spacing}cqw ${spacing}cqh`,
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
  maxWidth: showOccasionSlot.value && occasionText.value ? '52cqw' : '68cqw',
}))

function statNumberStyleFor(slot: PosterTextSlot) {
  return {
  fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
  fontWeight: effectiveSlotWeight(slot, typography.value.statsWeight),
  fontStyle: effectiveSlotItalic(slot),
  fontSize: `${effectiveSlotFontSizeCqh(slot, 2.6)}cqh`,
  letterSpacing: '0',
  lineHeight: '1',
  color: effectiveSlotColor(slot, fg.value),
  opacity: String(effectiveSlotOpacity(slot, 1)),
  display: 'block',
  textAlign: effectiveSlotAlign(slot),
  }
}

function statUnitStyleFor(slot: PosterTextSlot) {
  return {
  fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
  fontWeight: effectiveSlotWeight(slot, '400'),
  fontStyle: effectiveSlotItalic(slot),
  fontSize: `${Math.max(0.32, effectiveSlotFontSizeCqh(slot, 2.6) * 0.31)}cqh`,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: effectiveSlotColor(slot, fg.value),
  opacity: String(effectiveSlotOpacity(slot, 0.45)),
  display: 'block',
  marginTop: '0.55cqh',
  textAlign: effectiveSlotAlign(slot),
  }
}

function coordStyleFor(slot: PosterTextSlot) {
  return {
  fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
  fontWeight: effectiveSlotWeight(slot, typography.value.statsWeight),
  fontStyle: effectiveSlotItalic(slot),
  fontSize: `${effectiveSlotFontSizeCqh(slot, 1.2)}cqh`,
  letterSpacing: '0.04em',
  lineHeight: '1.45',
  color: effectiveSlotColor(slot, fg.value),
  opacity: String(effectiveSlotOpacity(slot, 0.65)),
  display: 'block',
  whiteSpace: 'pre-line' as const,
  textAlign: effectiveSlotAlign(slot),
  }
}

function statCustomTextStyle(slot: PosterTextSlot) {
  return {
    ...statNumberStyleFor(slot),
    fontSize: `${effectiveSlotFontSizeCqh(slot, 1.6)}cqh`,
    whiteSpace: 'pre-line' as const,
    textAlign: effectiveSlotAlign(slot),
  }
}

function blueprintTitleblockStatStyle(slot: PosterTextSlot) {
  return {
    fontFamily: effectiveSlotFont(slot, typography.value.statsFont),
    fontWeight: effectiveSlotWeight(slot, '520'),
    fontStyle: effectiveSlotItalic(slot),
    fontSize: `${effectiveSlotFontSizeCqh(slot, 1.34)}cqh`,
    letterSpacing: '0.14em',
    lineHeight: '1',
    color: effectiveSlotColor(slot, fg.value),
    opacity: String(effectiveSlotOpacity(slot, 0.76)),
    display: 'block',
    whiteSpace: 'nowrap' as const,
    textAlign: effectiveSlotAlign(slot),
  }
}

function pinSlot(pin: 'start' | 'finish'): PosterTextSlot {
  return pin === 'start' ? 'start_pin_label' : 'finish_pin_label'
}

function pinLabelFontFamily(pin: 'start' | 'finish') {
  const slot = pinSlot(pin)
  const family = slotOverride(slot).font_family ?? props.styleConfig.pin_font_family
  return family
    ? toFontStack(family)
    : props.styleConfig.preset === 'radmaps-toner'
      || props.styleConfig.preset === 'radmaps-toner-light'
      || props.styleConfig.preset === 'radmaps-toner-dark'
      ? toFontStack('Work Sans')
      : typography.value.statsFont
}

function pinLabelDisplayText(label: string) {
  return props.styleConfig.preset === 'radmaps-toner'
    || props.styleConfig.preset === 'radmaps-toner-light'
    || props.styleConfig.preset === 'radmaps-toner-dark'
    ? label
    : label.toUpperCase()
}

const pinLabelLetterSpacing = computed(() =>
  props.styleConfig.preset === 'radmaps-toner'
  || props.styleConfig.preset === 'radmaps-toner-light'
  || props.styleConfig.preset === 'radmaps-toner-dark'
    ? '0.04em'
    : '0.12em',
)

function pinLabelColor(pin: 'start' | 'finish') {
  return effectiveSlotColor(pinSlot(pin), contrastSafePinColor.value)
}

function pinLabelFontSize(pin: 'start' | 'finish') {
  const slot = pinSlot(pin)
  const override = slotOverride(slot)
  if (override.font_size_pt != null) return ptToPosterPx(override.font_size_pt)
  return svgPinFontSize.value * effectiveSlotScale(slot, 1)
}

function pinLabelWeight(pin: 'start' | 'finish') {
  return effectiveSlotWeight(pinSlot(pin), '600')
}

function pinLabelItalic(pin: 'start' | 'finish') {
  return effectiveSlotItalic(pinSlot(pin))
}

function pinLabelOpacity(pin: 'start' | 'finish', fallback: number) {
  return effectiveSlotOpacity(pinSlot(pin), fallback)
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
  fontSize: `${effectiveSlotFontSizeCqh('occasion_text', 0.95)}cqh`,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color: effectiveSlotColor('occasion_text', fg.value),
  opacity: String(effectiveSlotOpacity('occasion_text', 0.5)),
  textAlign: effectiveSlotAlign('occasion_text', 'center'),
  position: 'relative' as const,
  flex: '1 1 auto',
  minWidth: '0',
  maxWidth: '36cqw',
  margin: '0 2cqw',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
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

function printZoomCompensationDelta(): number {
  if (!isPrintRender.value) return 0
  const editorWidth = props.styleConfig.map_editor_width ?? sessionFrameWidth ?? 0
  const renderWidth = mapContainer.value?.offsetWidth ?? props.printContext?.cssWidthPx ?? 0
  if (!editorWidth || !renderWidth) return 0
  return Math.max(0, Math.log2(renderWidth / editorWidth))
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

function contourAdaptedStyleConfig(styleConfig: StyleConfig): StyleConfig {
  return resolveAdaptiveContourStyleConfig(styleConfig, activeContourStats())
}

function buildScaledMapStyle(styleConfig: StyleConfig): maplibregl.StyleSpecification {
  const contourStyleConfig = contourAdaptedStyleConfig(styleConfig)
  const style = buildMapStyle(
    contourStyleConfig,
    config.public.mapboxToken,
    config.public.maptilerToken,
    getContourTileUrl(contourStyleConfig),
    config.public.stadiaToken,
  ) as maplibregl.StyleSpecification
  const zoomCompensatedStyle = applyViewportZoomCompensationToStyle(style, printZoomCompensationDelta())
  return applyViewportScaleToStyle(zoomCompensatedStyle, currentVisualScale()) as maplibregl.StyleSpecification
}

function visibleRouteContourStats(): Partial<RouteStats> | null {
  if (!mapInstance) return null
  const routeGeojson = props.map.geojson as GeoJSON.FeatureCollection | undefined
  if (!routeGeojson?.features?.length) return null

  const bounds = mapInstance.getBounds()
  const visibleCoords = getAllRouteCoords(routeGeojson).filter(coord => (
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1]) &&
    Number.isFinite(coord[2]) &&
    bounds.contains([coord[0], coord[1]] as [number, number])
  ))
  if (visibleCoords.length < 4 || !coordsHaveElevation(visibleCoords)) return null

  const stats = routeStatsForCoords(visibleCoords)
  const reliefM = (stats.max_elevation_m ?? 0) - (stats.min_elevation_m ?? 0)
  if (reliefM <= 0 && (stats.elevation_gain_m ?? 0) <= 0 && (stats.elevation_loss_m ?? 0) <= 0) return null
  return stats
}

function contourAdaptationSignature(styleConfig: StyleConfig = props.styleConfig): string {
  if (!styleUsesContours(styleConfig)) return 'contours-disabled'
  const stats = activeContourStats()
  const contourConfig = contourAdaptedStyleConfig(styleConfig)
  return JSON.stringify({
    detail: contourConfig.contour_detail,
    thresholds: resolveAdaptiveContourThresholds(contourConfig, stats),
    overzoom: resolveAdaptiveContourOverzoom(contourConfig),
    opacity: contourConfig.contour_opacity,
    minorWidth: contourConfig.contour_minor_width,
    majorWidth: contourConfig.contour_major_width,
    atlasContour: contourConfig.atlas_layer_settings?.contour ?? null,
  })
}

function devContourProfile() {
  const stats = activeContourStats()
  const contourConfig = contourAdaptedStyleConfig(props.styleConfig)
  return {
    source: contourViewStats.value ? 'visible-route' : props.map.stats ? 'route-stats' : 'unknown',
    stats,
    relief: resolveAdaptiveContourReliefProfile(stats),
    detail: contourConfig.contour_detail,
    thresholds: resolveAdaptiveContourThresholds(contourConfig, stats),
    overzoom: resolveAdaptiveContourOverzoom(contourConfig),
  }
}

async function reloadStyleForContourProfile(styleConfig: StyleConfig = props.styleConfig): Promise<boolean> {
  if (!mapInstance || contourProfileReloading) return false
  contourProfileReloading = true
  const instance = mapInstance
  const cameraBeforeReload = snapshotCurrentCamera()
  mapReady.value = false
  if (styleUsesContours(styleConfig)) await ensureContourProtocol()

  return await new Promise<boolean>((resolve) => {
    const complete = () => {
      populateRouteSource()
      populateSegmentSources()
      placePinMarkers()
      apply3DTerrain({ animate: false })
      restoreCameraAfterStyleReload(cameraBeforeReload)
      applyViewportScaledLayerProperties(styleConfig)
      mapReady.value = true
      contourProfileReloading = false
      if (props.editable && !posterElementsEditing.value) nextTick(() => initOverlayDrag())
      nextTick(recomputeOverlays)
      if (props.deleteBrushActive) nextTick(activateDeleteBrush)
      if (props.segmentDrawMode) nextTick(syncSegmentDrawSources)
      if (props.segmentEditMode) nextTick(syncSegmentEditSources)
      markPrintRenderReady()
      resolve(true)
    }

    try {
      instance.once('styledata', complete)
      instance.setStyle(buildScaledMapStyle(styleConfig))
    } catch {
      instance.off('styledata', complete)
      contourProfileReloading = false
      mapReady.value = true
      resolve(false)
    }
  })
}

async function refreshContourViewProfile(options: { reloadStyle?: boolean } = {}): Promise<boolean> {
  if (!mapInstance || !styleUsesContours(props.styleConfig)) return false
  const before = contourAdaptationSignature()
  contourViewStats.value = visibleRouteContourStats()
  const after = contourAdaptationSignature()
  if (!options.reloadStyle || before === after) return false
  return await reloadStyleForContourProfile()
}

function scheduleContourViewProfileRefresh() {
  if (!mapInstance || !mapReady.value || contourProfileReloading || !styleUsesContours(props.styleConfig)) return
  if (contourViewRefreshTimer) clearTimeout(contourViewRefreshTimer)
  contourViewRefreshTimer = setTimeout(() => {
    contourViewRefreshTimer = null
    void refreshContourViewProfile({ reloadStyle: true })
  }, 180)
}

function addTonerDotPatternImage(instance: maplibregl.Map, id: string): boolean {
  if (!id.startsWith(TONER_DOT_PATTERN_ID_PREFIX) || typeof document === 'undefined') return false
  if (instance.hasImage(id)) return true

  const match = id.match(/^radmaps-toner-dot-(light|dark)-(soft|medium|dense)$/)
  if (!match) return false
  const [, variant, density] = match
  const size = density === 'dense' ? 6 : density === 'medium' ? 7 : 8
  const radius = density === 'dense' ? 0.86 : density === 'medium' ? 0.82 : 0.78
  const offset = density === 'dense' ? 1.5 : density === 'medium' ? 1.75 : 2
  const color = variant === 'dark' ? 'rgba(190, 190, 190, 0.96)' : 'rgba(0, 0, 0, 0.88)'
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = color
  for (const [x, y] of [[offset, offset], [size - offset, size - offset]] as const) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  try {
    instance.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: 1 })
    return true
  } catch {
    return false
  }
}

function onStyleImageMissing(event: { id: string }) {
  if (!mapInstance) return
  addTonerDotPatternImage(mapInstance, event.id)
}

function ensureTonerDotPatternImages(instance: maplibregl.Map) {
  for (const id of TONER_DOT_PATTERN_IDS) addTonerDotPatternImage(instance, id)
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

function sourceLoaded(instance: maplibregl.Map, sourceId: string) {
  if (!instance.getSource(sourceId)) return true
  const maybeSourceLoaded = instance as maplibregl.Map & { isSourceLoaded?: (id: string) => boolean }
  return typeof maybeSourceLoaded.isSourceLoaded === 'function'
    ? maybeSourceLoaded.isSourceLoaded(sourceId)
    : true
}

function printableMapStatus(instance: maplibregl.Map, timedOut = false) {
  const contoursExpected = styleUsesContours(props.styleConfig)
  const contourSourceId = instance.getSource('contours') ? 'contours' : null
  const demExpected = props.styleConfig.show_hillshade === true || props.styleConfig.map_3d === true
  const tilesLoaded = typeof instance.areTilesLoaded === 'function' ? instance.areTilesLoaded() : instance.loaded()
  const visibleSegmentCount = (props.styleConfig.trail_segments ?? []).filter(segment => segment.visible).length
  const visibleSegmentLayerCount = (props.styleConfig.trail_segments ?? []).filter(segment =>
    segment.visible && !!instance.getLayer(`trail-seg-line-${segment.id}`),
  ).length
  const primaryRouteExpected = shouldExpectPrimaryRouteContent(
    props.styleConfig,
    props.map.geojson as GeoJSON.FeatureCollection | undefined,
  )
  const routeLayerPresent = !!instance.getLayer('route-line')
  const routeSourcePresent = !!instance.getSource('route')
  const routeSourceLoaded = !primaryRouteExpected || sourceLoaded(instance, 'route')
  const routeFeatureCount = (props.map.geojson as GeoJSON.FeatureCollection | undefined)?.features?.length ?? 0
  const segmentLayersPresent = visibleSegmentCount === 0 || visibleSegmentLayerCount === visibleSegmentCount
  const routeContentPresent = (
    primaryRouteExpected
      ? routeLayerPresent && routeSourcePresent && routeSourceLoaded && routeFeatureCount > 0
      : true
  ) && segmentLayersPresent
  return {
    ready: true,
    mapLoaded: instance.loaded(),
    tilesLoaded,
    primaryRouteExpected,
    routeLayerPresent,
    routeSourcePresent,
    routeSourceLoaded,
    routeFeatureCount,
    visibleSegmentCount,
    visibleSegmentLayerCount,
    segmentLayersPresent,
    routeContentPresent,
    contoursExpected,
    contourSourcePresent: !!contourSourceId,
    contourSourceLoaded: !contoursExpected || (!!contourSourceId && sourceLoaded(instance, contourSourceId)),
    demExpected,
    demSourceLoaded: !demExpected || sourceLoaded(instance, 'mapbox-dem'),
    timedOut,
  }
}

function printableMapComplete(status: ReturnType<typeof printableMapStatus>) {
  return status.mapLoaded
    && status.tilesLoaded
    && status.routeContentPresent
    && status.contourSourceLoaded
    && status.demSourceLoaded
}

function markPrintRenderReady() {
  if (!isPrintRender.value || renderReady.value || !mapInstance) return
  const instance = mapInstance
  let readyTimer: ReturnType<typeof setTimeout> | null = null
  const cleanup = () => {
    if (readyTimer) clearTimeout(readyTimer)
    instance.off('idle', check)
    instance.off('sourcedata', check)
    instance.off('styledata', check)
  }
  const complete = async (timedOut = false) => {
    if (renderReady.value) return
    const status = printableMapStatus(instance, timedOut)
    const statusComplete = printableMapComplete(status)
    if (!timedOut && !statusComplete) return
    const finalStatus = timedOut && statusComplete
      ? printableMapStatus(instance, false)
      : status
    cleanup()
    try {
      await waitForPrintableAssets()
      const printGuardErrors = isPrintRender.value
        ? computePosterPrintGuardViolations(props.styleConfig).filter(violation => violation.severity === 'error')
        : []
      if (printGuardErrors.length) {
        throw new Error(`Poster print guards failed: ${printGuardErrors.map(violation => violation.message).join(' ')}`)
      }
      renderReady.value = true
      ;(window as unknown as { __RADMAPS_RENDER_STATUS?: typeof finalStatus; __RENDER_READY?: boolean }).__RADMAPS_RENDER_STATUS = finalStatus
      ;(window as unknown as { __RENDER_READY?: boolean }).__RENDER_READY = true
      document.dispatchEvent(new CustomEvent('radmaps-render-ready', { detail: finalStatus }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ;(window as unknown as { __RADMAPS_RENDER_STATUS?: { ready: false; error: string }; __RENDER_ERROR?: string }).__RADMAPS_RENDER_STATUS = { ready: false, error: message }
      ;(window as unknown as { __RENDER_ERROR?: string }).__RENDER_ERROR = message
    }
  }
  const check = () => { void complete(false) }
  instance.on('idle', check)
  instance.on('sourcedata', check)
  instance.on('styledata', check)
  readyTimer = setTimeout(() => { void complete(true) }, 25_000)
  requestAnimationFrame(check)
}

function publishEditorRenderStatus() {
  if (isPrintRender.value || !mapInstance || typeof window === 'undefined') return
  const status = printableMapStatus(mapInstance)
  ;(window as unknown as { __RADMAPS_RENDER_STATUS?: typeof status }).__RADMAPS_RENDER_STATUS = status
  document.dispatchEvent(new CustomEvent('radmaps-render-status', { detail: status }))
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
  const anchorBox = resolveFreeOverlayBox(props.styleConfig, `text:${o.id}`)
  const xOffset = o.alignment === 'center' ? '-50%' : o.alignment === 'right' ? '-100%' : '0%'
  const fontSize = moveableTextResizePreview.value?.id === o.id
    ? moveableTextResizePreview.value.font_size
    : resizePreview.value?.id === o.id ? resizePreview.value.font_size : o.font_size
  const rotation = o.rotation ?? 0
  return {
    position: 'absolute',
    left: `${anchorBox.x ?? o.x}%`,
    top: `${anchorBox.y ?? o.y}%`,
    fontFamily: toFontStack(o.font_family),
    fontSize: `${fontSize}cqh`,
    color: o.color,
    textAlign: o.alignment,
    opacity: String(o.opacity),
    fontWeight: o.bold ? '700' : '400',
    fontStyle: o.italic ? 'italic' : 'normal',
    transform: `translateX(${xOffset}) rotate(${rotation}deg)`,
    transformOrigin: o.alignment === 'center' ? 'center center' : o.alignment === 'right' ? 'right center' : 'left center',
    whiteSpace: 'pre',
    width: 'max-content',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: String(anchorBox.zIndex ?? o.z_index ?? 30),
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
  const anchorBox = resolveFreeOverlayBox(props.styleConfig, `asset:${asset.id}`)
  const preview = moveableResizePreview.value?.id === `asset:${asset.id}`
    ? moveableResizePreview.value
    : assetResizePreview.value?.id === asset.id ? assetResizePreview.value : null
  return {
    position: 'absolute',
    left: `${anchorBox.x ?? asset.x}%`,
    top: `${anchorBox.y ?? asset.y}%`,
    width: `${preview?.width ?? anchorBox.width ?? asset.width}%`,
    height: `${preview?.height ?? anchorBox.height ?? asset.height}%`,
    opacity: String(asset.opacity),
    transform: `rotate(${asset.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: String(anchorBox.zIndex ?? asset.z_index),
  }
}

function iconOverlayStyle(icon: IconOverlay): Record<string, string> {
  const preview = moveableResizePreview.value?.id === `icon:${icon.id}` ? moveableResizePreview.value : null
  return {
    position: 'absolute',
    left: `${icon.x}%`,
    top: `${icon.y}%`,
    width: `${preview?.width ?? icon.width}%`,
    height: `${preview?.height ?? icon.height}%`,
    color: icon.color,
    opacity: String(icon.opacity),
    transform: `rotate(${icon.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: String(icon.z_index),
  }
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
      fontSizePt: cqhToPt(overlay.font_size),
      align: overlay.alignment ?? 'left',
      opacity: overlay.opacity,
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
  const defaultFontSizePt = slot === 'start_pin_label' || slot === 'finish_pin_label'
    ? posterPxToPt(svgPinFontSize.value * effectiveSlotScale(slot, legacySlotScale(slot)))
    : cqhToPt(effectiveSlotFontSizeCqh(slot, slotBaseFontSizeCqh(slot)))

  return {
    label: SLOT_LABELS[slot],
    textValue: textWithOverride(slot, defaultSlotText(slot)),
    fontFamily: override.font_family ?? defaultFont,
    color: override.color ?? fg.value,
    backgroundColor: override.bg_color ?? '',
    fontSizePt: override.font_size_pt ?? defaultFontSizePt,
    align: effectiveSlotAlign(slot),
    opacity: effectiveSlotOpacity(slot, legacySlotOpacity(slot)),
    bold: override.bold ?? Number.parseInt(defaultWeight, 10) >= 600,
    italic: override.italic ?? false,
    supportsHighlight: false,
    canReset: !!props.styleConfig.poster_text_overrides?.[slot],
  }
})

function slotBaseFontSizeCqh(slot: PosterTextSlot) {
  if (slot === 'trail_name') return typography.value.titleSize
  if (slot === 'location_text') return typography.value.subSize
  if (slot === 'occasion_text') return 0.95
  if (slot === 'distance' || slot === 'elevation_gain') return 2.6
  if (slot === 'date' || slot === 'coordinates') return 1.2
  if (slot === 'start_pin_label' || slot === 'finish_pin_label') return svgPinFontSize.value
  if (slot === 'composition_kicker') return 0.88
  if (slot === 'composition_meta') return 0.72
  if (slot === 'composition_footer') return 0.62
  if (slot === 'composition_side_rail') return 0.82
  return 1
}

function legacySlotScale(slot: PosterTextSlot) {
  if (slot === 'trail_name') return props.styleConfig.title_scale ?? 1
  if (slot === 'occasion_text') return props.styleConfig.occasion_scale ?? 1
  if (slot === 'location_text') return props.styleConfig.subtitle_scale ?? 1
  if (slot === 'start_pin_label' || slot === 'finish_pin_label') return 1
  return 1
}

function legacySlotOpacity(slot: PosterTextSlot) {
  if (slot === 'location_text' || slot === 'occasion_text') return 0.5
  if (slot === 'composition_kicker') return composition.value.id === 'brutalist-slab' ? 0.92 : 0.64
  if (slot === 'composition_meta') return 0.52
  if (slot === 'composition_footer') return 0.36
  if (slot === 'composition_side_rail') return 0.32
  if (slot === 'date' || slot === 'coordinates') return 0.65
  if (slot === 'distance' || slot === 'elevation_gain') return 1
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
  if (patch.font_size_pt != null) overlayPatch.font_size = Number(ptToCqh(patch.font_size_pt).toFixed(3))
  else if (patch.scale != null) overlayPatch.font_size = Number((patch.scale * 2).toFixed(2))
  if (patch.align != null) overlayPatch.alignment = patch.align
  if (patch.opacity != null) overlayPatch.opacity = patch.opacity
  if (patch.bold != null) overlayPatch.bold = patch.bold
  if (patch.italic != null) overlayPatch.italic = patch.italic
  emit('overlay-updated', { id: target.id, patch: overlayPatch })
}

const activeChromeColor = computed(() => {
  const block = activeChromeBlock.value
  if (!block) return fg.value
  if (block.slot) return slotOverride(block.slot).color ?? fg.value
  return block.color ?? fg.value
})

const activeChromeBold = computed(() => {
  const block = activeChromeBlock.value
  if (!block) return false
  if (block.slot) return slotOverride(block.slot).bold ?? false
  return block.bold ?? false
})

const activeChromeItalic = computed(() => {
  const block = activeChromeBlock.value
  if (!block) return false
  if (block.slot) return slotOverride(block.slot).italic ?? false
  return block.italic ?? false
})

const activeChromeTextValue = computed(() => {
  const block = activeChromeBlock.value
  if (!block || isChromeSpacerBlock(block)) return null
  return chromeBlockText(block)
})

const activeChromeAlign = computed(() => {
  const block = activeChromeBlock.value
  if (!block) return 'left'
  if (block.slot) return slotOverride(block.slot).align ?? block.align ?? 'left'
  return block.align ?? 'left'
})

const activeChromeValign = computed(() => {
  const target = selectedChromeTarget.value
  if (target?.type !== 'cell') return 'center'
  return findChromeCell(target.band, target.rowId, target.cellId)?.valign ?? activeChromeBlock.value?.valign ?? 'center'
})

const activeChromePaddingValues = computed<[number, number, number, number]>(() => {
  const target = selectedChromeTarget.value
  return target?.type === 'cell'
    ? findChromeCell(target.band, target.rowId, target.cellId)?.padding ?? [0, 0, 0, 0]
    : [0, 0, 0, 0]
})

const activeChromeBandPaddingValues = computed<[number, number, number, number]>(() =>
  posterLayout.value.bands[activeChromeBand.value].padding ?? [0, 0, 0, 0],
)

function activeChromeToolbarAnchorElement() {
  return activeChromeCellAnchorElement() ?? activeChromeTextAnchorElement()
}

function activeChromeTextAnchorElement() {
  if (!posterCanvasEl.value) return null
  const blockId = activeChromeBlockId.value
  if (blockId) {
    const selector = `[data-chrome-block-id="${globalThis.CSS?.escape?.(blockId) ?? blockId.replace(/"/g, '\\"')}"]`
    const blockEl = posterCanvasEl.value.querySelector<HTMLElement>(selector)
    const rect = blockEl?.getBoundingClientRect()
    if (blockEl && rect && rect.width > 0 && rect.height > 0) return blockEl
  }
  return activeChromeCellAnchorElement()
}

function activeChromeCellAnchorElement() {
  const target = selectedChromeTarget.value
  if (target?.type !== 'cell' || !posterCanvasEl.value) return null
  const cellSelector = `[data-chrome-cell-id="${globalThis.CSS?.escape?.(target.cellId) ?? target.cellId.replace(/"/g, '\\"')}"]`
  return posterCanvasEl.value.querySelector<HTMLElement>(cellSelector)
}

function patchActiveChromeBlock(patch: PosterTextOverride) {
  const block = activeChromeBlock.value
  const target = selectedChromeTarget.value
  if (!block || target?.type !== 'cell') return
  lastChromeTextStyle.value = { ...(lastChromeTextStyle.value ?? {}), ...patch }
  if (block.slot) {
    emit('poster-text-override', { slot: block.slot, patch })
    return
  }
  updateChromeCell(target.band, target.rowId, target.cellId, cell => ({
    ...cell,
    align: patch.align ?? cell.align,
    block: {
      ...block,
      text: patch.text ?? block.text,
      font_family: patch.font_family ?? block.font_family,
      font_size_pt: patch.font_size_pt ?? block.font_size_pt,
      align: patch.align ?? block.align,
      color: patch.color ?? block.color,
      bg_color: patch.bg_color ?? block.bg_color,
      scale: patch.scale ?? block.scale,
      opacity: patch.opacity ?? block.opacity,
      bold: patch.bold ?? block.bold,
      italic: patch.italic ?? block.italic,
    },
  }))
}

function patchActiveChromeLayoutBlock(patch: Partial<ChromeBlock>) {
  const block = activeChromeBlock.value
  const target = selectedChromeTarget.value
  if (!block || target?.type !== 'cell') return
  lastChromeTextStyle.value = { ...(lastChromeTextStyle.value ?? {}), ...patch }
  updateChromeCell(target.band, target.rowId, target.cellId, cell => ({
    ...cell,
    align: patch.align ?? cell.align,
    valign: patch.valign ?? cell.valign,
    block: { ...block, ...patch },
  }))
}

function setActiveChromeText(text: string) {
  patchActiveChromeBlock({ text })
}

function toggleChromeBold() {
  patchActiveChromeBlock({ bold: !activeChromeBold.value })
}

function toggleChromeItalic() {
  patchActiveChromeBlock({ italic: !activeChromeItalic.value })
}

function setChromeColor(color: string) {
  patchActiveChromeBlock({ color })
}

function nudgeChromeScale(delta: number) {
  const block = activeChromeBlock.value
  if (!block) return
  const currentPt = block.slot
    ? slotOverride(block.slot).font_size_pt ?? cqhToPt(effectiveSlotFontSizeCqh(block.slot, slotBaseFontSizeCqh(block.slot)))
    : block.font_size_pt ?? cqhToPt(1.1 * (block.scale ?? 1))
  patchActiveChromeBlock({ font_size_pt: clampTextSizePt(currentPt + (delta > 0 ? 2 : -2)) })
}

function setChromeAlign(align: NonNullable<ChromeBlock['align']>) {
  patchActiveChromeLayoutBlock({ align })
  const block = activeChromeBlock.value
  if (block?.slot) emit('poster-text-override', { slot: block.slot, patch: { align } })
}

function setChromeValign(valign: NonNullable<ChromeBlock['valign']>) {
  patchActiveChromeLayoutBlock({ valign })
}

type ChromeFloatingRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

function chromeFloatingPadding() {
  return {
    top: 64,
    right: window.innerWidth >= 1024 ? 376 : 16,
    bottom: 16,
    left: 16,
  }
}

function chromeFloatingBounds() {
  const padding = chromeFloatingPadding()
  return {
    left: padding.left,
    top: padding.top,
    right: window.innerWidth - padding.right,
    bottom: window.innerHeight - padding.bottom,
  }
}

function rectFromDomRect(rect: DOMRect): ChromeFloatingRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function rectFromPosition(left: number, top: number, width: number, height: number): ChromeFloatingRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  }
}

function rectOverlapArea(a: ChromeFloatingRect, b: ChromeFloatingRect) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return width * height
}

function elementVisibleForChromeCollision(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.08
}

function selectedChromeCollisionRects() {
  const rects: Array<{ rect: ChromeFloatingRect; weight: number }> = []
  const seen = new Set<HTMLElement>()
  const addElement = (el: HTMLElement | null | undefined, weight: number) => {
    if (!el || seen.has(el) || !elementVisibleForChromeCollision(el)) return
    seen.add(el)
    rects.push({ rect: rectFromDomRect(el.getBoundingClientRect()), weight })
  }
  const cell = activeChromeCellAnchorElement()
  const text = activeChromeTextAnchorElement()
  addElement(cell, 8)
  addElement(text, 12)
  if (posterCanvasEl.value) {
    posterCanvasEl.value.querySelectorAll<HTMLElement>('.chrome-grid-block').forEach(el => addElement(el, 4))
  }
  if (cell) {
    addElement(cell.querySelector<HTMLElement>('.chrome-cell-trash'), 18)
    cell.querySelectorAll<HTMLElement>('.chrome-cell-add-col, .chrome-cell-resize-col').forEach(el => addElement(el, 10))
    cell.closest<HTMLElement>('.chrome-grid-row')
      ?.querySelectorAll<HTMLElement>('.chrome-row-add-row, .chrome-row-resize-row')
      .forEach(el => addElement(el, 8))
  }
  return rects
}

function clampChromeContextToolbarPosition(left: number, top: number) {
  const toolbar = chromeLayoutBuilderEl.value
  const rect = toolbar?.getBoundingClientRect()
  const bounds = chromeFloatingBounds()
  const width = rect?.width ?? 0
  const height = rect?.height ?? 0
  const maxLeft = Math.max(bounds.left, bounds.right - width)
  const maxTop = Math.max(bounds.top, bounds.bottom - height)
  return {
    left: Math.round(Math.min(maxLeft, Math.max(bounds.left, left))),
    top: Math.round(Math.min(maxTop, Math.max(bounds.top, top))),
  }
}

function bestChromeContextToolbarPosition(reference: HTMLElement, toolbar: HTMLElement) {
  const referenceRect = rectFromDomRect(reference.getBoundingClientRect())
  const cellRect = activeChromeCellAnchorElement()?.getBoundingClientRect()
  const anchorRect = cellRect ? rectFromDomRect(cellRect) : referenceRect
  const posterRect = posterCanvasEl.value ? rectFromDomRect(posterCanvasEl.value.getBoundingClientRect()) : null
  const toolbarRect = toolbar.getBoundingClientRect()
  const width = toolbarRect.width
  const height = toolbarRect.height
  const gap = 14
  const bounds = chromeFloatingBounds()
  const centerLeft = anchorRect.left + anchorRect.width / 2 - width / 2
  const centerTop = anchorRect.top + anchorRect.height / 2 - height / 2
  const collisionRects = selectedChromeCollisionRects()
  const contentBottom = Math.max(anchorRect.bottom, ...collisionRects.map(collision => collision.rect.bottom))
  const contentTop = Math.min(anchorRect.top, ...collisionRects.map(collision => collision.rect.top))
  const preferBelow = posterRect
    ? anchorRect.top + anchorRect.height / 2 < posterRect.top + posterRect.height / 2
    : anchorRect.top < window.innerHeight / 2
  const candidates: Array<{ left: number; top: number; priority: number }> = [
    {
      left: posterRect ? posterRect.left + posterRect.width / 2 - width / 2 : centerLeft,
      top: contentBottom + gap,
      priority: 0,
    },
    {
      left: posterRect ? posterRect.left + posterRect.width / 2 - width / 2 : centerLeft,
      top: contentTop - height - gap,
      priority: 1,
    },
    {
      left: centerLeft,
      top: preferBelow ? anchorRect.bottom + gap : anchorRect.top - height - gap,
      priority: 2,
    },
    {
      left: centerLeft,
      top: preferBelow ? anchorRect.top - height - gap : anchorRect.bottom + gap,
      priority: 3,
    },
    {
      left: anchorRect.right + gap,
      top: centerTop,
      priority: 4,
    },
    {
      left: anchorRect.left - width - gap,
      top: centerTop,
      priority: 5,
    },
  ]
  if (posterRect) {
    candidates.push(
      {
        left: posterRect.left + posterRect.width / 2 - width / 2,
        top: posterRect.top + 12,
        priority: 6,
      },
      {
        left: posterRect.left + posterRect.width / 2 - width / 2,
        top: posterRect.bottom - height - 12,
        priority: 7,
      },
      {
        left: posterRect.right + gap,
        top: centerTop,
        priority: 8,
      },
      {
        left: posterRect.left - width - gap,
        top: centerTop,
        priority: 9,
      },
    )
  }
  candidates.push({
    left: bounds.left + (bounds.right - bounds.left - width) / 2,
    top: bounds.top + 10,
    priority: 10,
  })
  let best = clampChromeContextToolbarPosition(candidates[0].left, candidates[0].top)
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const clamped = clampChromeContextToolbarPosition(candidate.left, candidate.top)
    const candidateRect = rectFromPosition(clamped.left, clamped.top, width, height)
    let score = candidate.priority * 100
    for (const collision of collisionRects) {
      score += rectOverlapArea(candidateRect, collision.rect) * collision.weight
    }
    if (posterRect) {
      score += rectOverlapArea(candidateRect, posterRect) * 0.02
    }
    if (score < bestScore) {
      bestScore = score
      best = clamped
    }
  }
  return best
}

function setChromeContextToolbarFloatingStyle(left: number, top: number) {
  const position = clampChromeContextToolbarPosition(left, top)
  const rect = chromeLayoutBuilderEl.value?.getBoundingClientRect()
  const height = rect?.height ?? 0
  chromeLayoutBuilderPopoverVertical.value = position.top + height > window.innerHeight * 0.58 ? 'top' : 'bottom'
  chromeLayoutBuilderPopoverAlign.value = position.left < 80 ? 'left' : 'right'
  chromeLayoutBuilderFloatingStyle.value = {
    position: 'fixed',
    left: `${position.left}px`,
    top: `${position.top}px`,
    visibility: 'visible',
    transform: 'none',
  }
}

function startChromeContextToolbarDrag(e: PointerEvent) {
  if (!chromeLayoutBuilderEl.value || typeof window === 'undefined') return
  const rect = chromeLayoutBuilderEl.value.getBoundingClientRect()
  activeChromeContextToolbarDrag.value = {
    startX: e.clientX,
    startY: e.clientY,
    startLeft: rect.left,
    startTop: rect.top,
  }
  chromeContextToolbarManualPosition.value = { left: rect.left, top: rect.top }
  chromeLayoutBuilderEl.value.classList.add('is-dragging')
  window.addEventListener('pointermove', onChromeContextToolbarDragMove)
  window.addEventListener('pointerup', finishChromeContextToolbarDrag, { once: true })
  window.addEventListener('pointercancel', finishChromeContextToolbarDrag, { once: true })
}

function onChromeContextToolbarDragMove(e: PointerEvent) {
  const drag = activeChromeContextToolbarDrag.value
  if (!drag) return
  const next = clampChromeContextToolbarPosition(
    drag.startLeft + e.clientX - drag.startX,
    drag.startTop + e.clientY - drag.startY,
  )
  chromeContextToolbarManualPosition.value = next
  setChromeContextToolbarFloatingStyle(next.left, next.top)
}

function finishChromeContextToolbarDrag() {
  teardownChromeContextToolbarDrag()
}

function teardownChromeContextToolbarDrag() {
  if (typeof window === 'undefined') return
  activeChromeContextToolbarDrag.value = null
  chromeLayoutBuilderEl.value?.classList.remove('is-dragging')
  window.removeEventListener('pointermove', onChromeContextToolbarDragMove)
  window.removeEventListener('pointerup', finishChromeContextToolbarDrag)
  window.removeEventListener('pointercancel', finishChromeContextToolbarDrag)
}

function cleanupChromeFloating() {
  cleanupChromeToolbarFloating?.()
  cleanupChromeStructureFloating?.()
  cleanupChromeLayoutBuilderFloating?.()
  cleanupChromeToolbarFloating = null
  cleanupChromeStructureFloating = null
  cleanupChromeLayoutBuilderFloating = null
}

function toolbarPointerStyle(reference: HTMLElement, floatingX: number, floatingWidth: number, placement: string) {
  const referenceRect = reference.getBoundingClientRect()
  const anchorX = Math.max(18, Math.min(floatingWidth - 18, referenceRect.left + referenceRect.width / 2 - floatingX))
  const above = placement.startsWith('top')
  chromeToolbarPointerFloatingStyle.value = {
    left: `${anchorX}px`,
    top: above ? '100%' : 'auto',
    bottom: above ? 'auto' : '100%',
    borderWidth: above ? '7px 6px 0 6px' : '0 6px 7px 6px',
    borderColor: above ? '#fff transparent transparent transparent' : 'transparent transparent #fff transparent',
  }
}

async function updateChromeToolbarFloating() {
  if (!chromeToolbarVisible.value || !chromeToolbarEl.value) {
    chromeToolbarFloatingStyle.value = { ...chromeToolbarFloatingStyle.value, visibility: 'hidden' }
    return
  }
  const reference = activeChromeToolbarAnchorElement()
  if (!reference) return
  const width = Math.min(508, window.innerWidth - 24)
  chromeToolbarFloatingStyle.value = {
    ...chromeToolbarFloatingStyle.value,
    width: `${width}px`,
  }
  const { x, y, placement } = await computePosition(reference, chromeToolbarEl.value, {
    strategy: 'fixed',
    placement: 'top',
    middleware: [
      offset(12),
      flip({ fallbackPlacements: ['bottom'] }),
      shift({ padding: 8 }),
    ],
  })
  chromeToolbarPlacement.value = placement
  chromeToolbarFloatingStyle.value = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    visibility: 'visible',
  }
  toolbarPointerStyle(reference, x, width, placement)
}

async function updateChromeStructureFloating() {
  if (!chromeStructurePopoverVisible.value || !chromeStructurePopoverEl.value) {
    chromeStructurePopoverFloatingStyle.value = { ...chromeStructurePopoverFloatingStyle.value, visibility: 'hidden' }
    return
  }
  const reference = activeChromeCellAnchorElement()
  if (!reference) return
  const posterRect = posterCanvasEl.value?.getBoundingClientRect()
  const referenceRect = reference.getBoundingClientRect()
  const preferLeftSide = posterRect
    ? referenceRect.left + referenceRect.width / 2 > posterRect.left + posterRect.width / 2
    : false
  const placement: Placement = chromeToolbarVisible.value
    ? preferLeftSide ? 'left' : 'right'
    : 'bottom'
  const fallbackPlacements: Placement[] = chromeToolbarVisible.value
    ? [preferLeftSide ? 'right' : 'left', 'bottom', 'top']
    : ['top']
  const { x, y } = await computePosition(reference, chromeStructurePopoverEl.value, {
    strategy: 'fixed',
    placement,
    middleware: [
      offset(12),
      flip({ fallbackPlacements }),
      shift({ padding: 8 }),
    ],
  })
  chromeStructurePopoverFloatingStyle.value = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    visibility: 'visible',
  }
}

async function updateChromeLayoutBuilderFloating() {
  if (!chromeContextToolbarVisible.value || !chromeLayoutBuilderEl.value) {
    chromeLayoutBuilderFloatingStyle.value = { ...chromeLayoutBuilderFloatingStyle.value, visibility: 'hidden' }
    return
  }
  const manualPosition = chromeContextToolbarManualPosition.value
  if (manualPosition) {
    setChromeContextToolbarFloatingStyle(manualPosition.left, manualPosition.top)
    return
  }
  const reference = activeChromeCellAnchorElement() ?? activeChromeTextAnchorElement()
  if (!reference) return
  const position = bestChromeContextToolbarPosition(reference, chromeLayoutBuilderEl.value)
  setChromeContextToolbarFloatingStyle(position.left, position.top)
}

async function syncChromeFloating() {
  if (typeof window === 'undefined') return
  await nextTick()
  cleanupChromeFloating()
  const layoutReference = activeChromeCellAnchorElement() ?? activeChromeTextAnchorElement()
  if (chromeContextToolbarVisible.value && layoutReference && chromeLayoutBuilderEl.value) {
    cleanupChromeLayoutBuilderFloating = autoUpdate(layoutReference, chromeLayoutBuilderEl.value, updateChromeLayoutBuilderFloating)
    await updateChromeLayoutBuilderFloating()
  }
  const toolbarReference = activeChromeToolbarAnchorElement()
  if (chromeToolbarVisible.value && toolbarReference && chromeToolbarEl.value) {
    cleanupChromeToolbarFloating = autoUpdate(toolbarReference, chromeToolbarEl.value, updateChromeToolbarFloating)
    await updateChromeToolbarFloating()
  }
  const structureReference = activeChromeCellAnchorElement()
  if (chromeStructurePopoverVisible.value && structureReference && chromeStructurePopoverEl.value) {
    cleanupChromeStructureFloating = autoUpdate(structureReference, chromeStructurePopoverEl.value, updateChromeStructureFloating)
    await updateChromeStructureFloating()
  }
}

watch(
  [chromeToolbarVisible, chromeStructurePopoverVisible, chromeContextToolbarVisible, activeChromeBlockId, chromePaddingPanelOpen, selectedChromeTarget],
  () => { void syncChromeFloating() },
  { flush: 'post' },
)

watch(
  () => {
    const target = selectedChromeTarget.value
    if (!target) return ''
    if (target.type === 'band') return `${target.band}:band`
    if (target.type === 'row') return `${target.band}:${target.rowId}:row`
    return `${target.band}:${target.rowId}:${target.cellId}`
  },
  () => {
    chromeContextToolbarManualPosition.value = null
  },
)

watch(posterLayout, () => { void syncChromeFloating() }, { flush: 'post' })

watch(selectedChromeTarget, target => emitChromeSelectionChanged(target), { deep: true })

// ── Trail legend ──────────────────────────────────────────────────────────────

const visibleNamedSegments = computed(() =>
  (props.styleConfig.trail_segments ?? []).filter(s => s.visible && s.name),
)

function segmentResolvedCoords(seg: NonNullable<typeof props.styleConfig.trail_segments>[number]): number[][] {
  const primary = props.map.geojson as GeoJSON.FeatureCollection | undefined
  if (!primary) return []
  return getAllRouteCoords(resolveTrailSegmentGeojson(primary, seg, props.styleConfig.route_deleted_ranges ?? []))
}

function segmentMetaText(seg: NonNullable<typeof props.styleConfig.trail_segments>[number]): string {
  if (!props.styleConfig.trail_show_stats) return ''
  const coords = segmentResolvedCoords(seg)
  if (coords.length < 2) return ''
  const stats = routeStatsForCoords(coords)
  const distanceMi = stats.distance_km * 0.621371
  const distance = distanceMi < 100 ? `${distanceMi.toFixed(2)} mi` : `${distanceMi.toFixed(1)} mi`
  if (props.styleConfig.trail_show_elevation_gain === false || !coordsHaveElevation(coords)) return distance
  return `${distance} · ${Math.round(stats.elevation_gain_m * 3.28084).toLocaleString()} ft gain`
}

function segmentSwatchStyle(seg: NonNullable<typeof props.styleConfig.trail_segments>[number]) {
  return seg.color_mode === 'gradient'
    ? { background: 'linear-gradient(to right, #4F8EF7, #52B788 28%, #F4A261 60%, #E76F51 82%, #C1121F)' }
    : { backgroundColor: seg.color }
}

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

const legendMetaStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '500',
  fontSize: '0.58cqh',
  letterSpacing: '0.04em',
  color: fg.value,
  opacity: '0.62',
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
  meta?: string
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

function estimateLeaderLabelWidth(name: string, meta: string | undefined, fontSize: number, fontFamily: string): number {
  const nameWidth = estimateSvgTextWidth(name, fontSize, fontFamily, 700, 0.1)
  if (!meta) return nameWidth
  const metaWidth = estimateSvgTextWidth(meta, fontSize * 0.72, fontFamily, 600, 0.04)
  return Math.max(nameWidth, metaWidth)
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

const pinLabelHaloColor = computed(() => mapBackgroundColor(props.styleConfig))

const contrastSafePinColor = computed(() =>
  props.styleConfig.pin_color ?? pickContrastSafeColor(
    mapBackgroundColor(props.styleConfig),
    [
      effectiveRoutePaint.value.route_color,
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
      const allC = segmentResolvedCoords(seg)
      const anchor = leaderAnchorCoord(allC)
      if (!anchor) return item
      const pt = instance.project(anchor)
      return { ...item, dotX: pt.x, dotY: pt.y }
    })
    return
  }

  interface Candidate {
    seg: NonNullable<typeof props.styleConfig.trail_segments>[number]
    meta?: string
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
    const resolvedCoords = segmentResolvedCoords(seg)
    const anchor = leaderAnchorCoord(resolvedCoords)
    if (!anchor) continue
    const pt = mapInstance.project(anchor)
    const meta = segmentMetaText(seg)
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
        meta,
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
      meta,
      dotX: pt.x,
      dotY: pt.y,
      labelWidth: estimateLeaderLabelWidth(seg.name, meta, labelFontSize, fontFamily),
    })
  }

  let minLeaderGap = Math.max(posterContentMinPx(15), labelFontSize * (props.styleConfig.trail_show_stats ? 2.05 : 1.45))
  const leftCandidates: Candidate[] = []
  const rightCandidates: Candidate[] = []
  const centerCandidates: Candidate[] = []

  for (const c of candidates) {
    if (c.dotX < W * 0.36) leftCandidates.push(c)
    else if (c.dotX > W * 0.64) rightCandidates.push(c)
    else centerCandidates.push(c)
  }

  function sideCost(side: Candidate[], candidate: Candidate, target: 'left' | 'right'): number {
    const nearestGap = side.length
      ? Math.min(...side.map(item => Math.abs(item.dotY - candidate.dotY)))
      : Number.POSITIVE_INFINITY
    const collisionPenalty = nearestGap < minLeaderGap ? (minLeaderGap - nearestGap) * 4 : 0
    const sidePreference = target === 'left' ? candidate.dotX / W : (W - candidate.dotX) / W
    return side.length * 100 + collisionPenalty + sidePreference * 18
  }

  centerCandidates
    .sort((a, b) => a.dotY - b.dotY)
    .forEach(candidate => {
      if (sideCost(leftCandidates, candidate, 'left') <= sideCost(rightCandidates, candidate, 'right')) {
        leftCandidates.push(candidate)
      } else {
        rightCandidates.push(candidate)
      }
    })

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
    ...candidates.map(c => ({ name: c.seg.name, meta: c.meta })),
    ...manualItems.map(item => ({ name: item.name, meta: item.meta })),
  ]

  if (props.styleConfig.leader_label_auto_fit !== false && fitLabelNames.length) {
    const maxMeasuredWidth = Math.max(
      0,
      ...fitLabelNames.map(label => estimateLeaderLabelWidth(label.name, label.meta, labelFontSize, fontFamily)),
    )
    const maxSideCount = Math.max(leftCandidates.length, rightCandidates.length, Math.ceil(fitLabelNames.length / 2))
    const widthLimit = maxMeasuredWidth > 0 ? labelFontSize * (W * 0.34) / maxMeasuredWidth : labelFontSize
    const verticalLimit = maxSideCount > 1 ? (H * 0.70 / (maxSideCount - 1)) / 1.45 : labelFontSize
    const minFontSize = Math.max(posterContentMinPx(7), H * 0.008)
    const fittedFontSize = clampValue(Math.min(labelFontSize, widthLimit, verticalLimit), minFontSize, labelFontSize)

    if (fittedFontSize < labelFontSize) {
      labelFontSize = fittedFontSize
      for (const c of candidates) {
        c.labelWidth = estimateLeaderLabelWidth(c.seg.name, c.meta, labelFontSize, fontFamily)
      }
      for (const item of manualItems) item.fontSize = labelFontSize
      minLeaderGap = Math.max(posterContentMinPx(15), labelFontSize * (props.styleConfig.trail_show_stats ? 2.05 : 1.45))
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
  const leftX = clampValue(Math.max(W * 0.10, hMargin + maxLeftWidth), hMargin, W - hMargin)
  const rightX = clampValue(Math.min(W * 0.90, W - hMargin - maxRightWidth), hMargin, W - hMargin)

  function packLabelYs(cands: Candidate[]): number[] {
    if (cands.length === 0) return []

    const minY = vMargin
    const maxY = H - vMargin
    const minGap = minLeaderGap
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
    items.push({ id: c.seg.id, name: c.seg.name, meta: c.meta, color: c.seg.color, fontSize: labelFontSize, dotX: c.dotX, dotY: c.dotY, labelX: leftX, labelY: leftYs[i], anchor: 'end' })
  }
  for (let i = 0; i < rightCandidates.length; i++) {
    const c = rightCandidates[i]
    items.push({ id: c.seg.id, name: c.seg.name, meta: c.meta, color: c.seg.color, fontSize: labelFontSize, dotX: c.dotX, dotY: c.dotY, labelX: rightX, labelY: rightYs[i], anchor: 'start' })
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

function effectiveHillshadeExaggeration(cfg: StyleConfig = props.styleConfig): number {
  const intensity = cfg.hillshade_intensity ?? 0.3
  return cfg.preset === 'contour-art' ? Math.min(intensity, 0.25) : intensity
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
  const priority = props.mapInteractive === true ? 2 : props.editable !== false ? 1 : 0
  const devWindow = window as unknown as {
    __RADMAPS_MAP_CAMERA__?: {
      get: () => MapCameraSnapshot | null
      jumpTo: (camera: Partial<MapCameraSnapshot>) => void
      getLayerIds: () => string[]
      hasImage: (id: string) => boolean
      getPaintProperty: (layerId: string, property: string) => unknown
      getContourProfile: () => ReturnType<typeof devContourProfile>
      getInteractionState: () => {
        dragPan: boolean
        scrollZoom: boolean
        doubleClickZoom: boolean
        touchZoomRotate: boolean
      }
    }
    __RADMAPS_MAP_CAMERA_OWNER__?: symbol
    __RADMAPS_MAP_CAMERA_PRIORITY__?: number
  }
  if ((devWindow.__RADMAPS_MAP_CAMERA_PRIORITY__ ?? -1) > priority) return
  devWindow.__RADMAPS_MAP_CAMERA_OWNER__ = devCameraHandleId
  devWindow.__RADMAPS_MAP_CAMERA_PRIORITY__ = priority
  devWindow.__RADMAPS_MAP_CAMERA__ = {
    get: snapshotCurrentCamera,
    jumpTo: (camera) => { mapInstance?.jumpTo(camera) },
    getLayerIds: () => mapInstance?.getStyle?.()?.layers?.map(layer => layer.id) ?? [],
    hasImage: (id) => mapInstance?.hasImage(id) ?? false,
    getPaintProperty: (layerId, property) => mapInstance?.getPaintProperty(layerId, property) ?? null,
    getContourProfile: devContourProfile,
    getInteractionState: () => ({
      dragPan: mapInstance?.dragPan.isEnabled() ?? false,
      scrollZoom: mapInstance?.scrollZoom.isEnabled() ?? false,
      doubleClickZoom: mapInstance?.doubleClickZoom.isEnabled() ?? false,
      touchZoomRotate: mapInstance?.touchZoomRotate.isEnabled() ?? false,
    }),
  }
}

onMounted(async () => {
  await nextTick()
  if (!mapContainer.value) return

  // Register tile effect protocol unconditionally — cheap and avoids
  // conditional logic when the user enables duotone/posterize later.
  ensureTileEffectProtocol()
  if (styleUsesContours(props.styleConfig)) await ensureContourProtocol()
  const mountedStyleConfig = JSON.parse(JSON.stringify(props.styleConfig)) as StyleConfig
  const mountedStyleSignature = styleConfigSignature(mountedStyleConfig)
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
    interactive: mapViewerInteractive.value && (props.mapInteractive === true || !(props.styleConfig.map_frozen)),
  })
  mapInstance.on('styleimagemissing', onStyleImageMissing)
  mapInstance.on('styledata', () => {
    if (mapInstance) ensureTonerDotPatternImages(mapInstance)
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

  mapInstance.on('load', async () => {
    populateRouteSource()
    populateSegmentSources()
    placePinMarkers()
    setPaintBackground()
    apply3DTerrain()
    mapReady.value = true
    liveZoom.value = mapInstance!.getZoom()
    if (props.editable && !posterElementsEditing.value) initOverlayDrag()
    recomputeOverlays()
    if (queuedStyleConfig || styleConfigSignature(props.styleConfig) !== mountedStyleSignature) {
      queuedStyleConfig = null
      void applyStyleConfigUpdate(props.styleConfig, mountedStyleConfig)
    }
    if (await refreshContourViewProfile({ reloadStyle: true })) return
    markPrintRenderReady()
    if (!isPrintRender.value) {
      const publishStatus = () => requestAnimationFrame(publishEditorRenderStatus)
      mapInstance!.on('idle', publishStatus)
      mapInstance!.on('sourcedata', publishStatus)
      mapInstance!.on('styledata', publishStatus)
      publishStatus()
    }
    if (props.deleteBrushActive) nextTick(activateDeleteBrush)
    // Reconcile freeze state on initial load — the map_frozen watcher returns
    // early before mapReady, so a frozen view saved in the DB would otherwise
    // load with gestures still enabled.
    if (props.styleConfig.map_frozen && !canEnableMapGestures()) disableAllMapGestures()
  })

  mapInstance.on('zoom', () => {
    liveZoom.value = mapInstance?.getZoom()
    recomputeOverlays()
  })

  mapInstance.on('move', recomputeOverlays)
  mapInstance.on('moveend', scheduleViewSave)
  mapInstance.on('moveend', scheduleContourViewProfileRefresh)

  resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      syncCameraToFrame()
    })
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

const TRANSIT_STATIONS_SOURCE_ID = 'transit-stations'
const TRANSIT_STATION_HALO_LAYER_ID = 'transit-station-halo'
const TRANSIT_STATION_DOT_LAYER_ID = 'transit-station-dot'
const TRANSIT_STATION_LABEL_LAYER_ID = 'transit-station-label'

function removeTransitStationLayers() {
  if (!mapInstance) return
  for (const layerId of [TRANSIT_STATION_LABEL_LAYER_ID, TRANSIT_STATION_DOT_LAYER_ID, TRANSIT_STATION_HALO_LAYER_ID]) {
    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId)
  }
  if (mapInstance.getSource(TRANSIT_STATIONS_SOURCE_ID)) mapInstance.removeSource(TRANSIT_STATIONS_SOURCE_ID)
}

function syncTransitStationSource(routeGeojson: GeoJSON.FeatureCollection) {
  if (!mapInstance) return
  if (composition.value.id !== 'transit-diagram') {
    removeTransitStationLayers()
    return
  }

  const data = buildTransitStationGeojson(routeGeojson)
  const source = mapInstance.getSource(TRANSIT_STATIONS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (source) source.setData(data)
  else mapInstance.addSource(TRANSIT_STATIONS_SOURCE_ID, { type: 'geojson', data })

  if (!mapInstance.getLayer(TRANSIT_STATION_HALO_LAYER_ID)) {
    mapInstance.addLayer({
      id: TRANSIT_STATION_HALO_LAYER_ID,
      type: 'circle',
      source: TRANSIT_STATIONS_SOURCE_ID,
      paint: {
        'circle-radius': ['case', ['get', 'terminal'], 14, 10],
        'circle-color': props.styleConfig.background_color ?? '#F7F5F0',
        'circle-opacity': 1,
      },
    })
  }
  if (!mapInstance.getLayer(TRANSIT_STATION_DOT_LAYER_ID)) {
    mapInstance.addLayer({
      id: TRANSIT_STATION_DOT_LAYER_ID,
      type: 'circle',
      source: TRANSIT_STATIONS_SOURCE_ID,
      paint: {
        'circle-radius': ['case', ['get', 'terminal'], 11.5, 8],
        'circle-color': props.styleConfig.background_color ?? '#F7F5F0',
        'circle-stroke-color': ['case', ['get', 'secondary'], '#1F8A5B', props.styleConfig.route_color ?? '#7A1FA2'],
        'circle-stroke-width': 4.2,
      },
    })
  }
  if (!mapInstance.getLayer(TRANSIT_STATION_LABEL_LAYER_ID)) {
    mapInstance.addLayer({
      id: TRANSIT_STATION_LABEL_LAYER_ID,
      type: 'symbol',
      source: TRANSIT_STATIONS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 14,
        'text-anchor': 'left',
        'text-offset': [1.35, 0],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': props.styleConfig.label_text_color ?? '#181818',
        'text-halo-color': props.styleConfig.background_color ?? '#F7F5F0',
        'text-halo-width': 1.5,
      },
    })
  }
  for (const layerId of [TRANSIT_STATION_HALO_LAYER_ID, TRANSIT_STATION_DOT_LAYER_ID, TRANSIT_STATION_LABEL_LAYER_ID]) {
    if (mapInstance.getLayer(layerId)) mapInstance.moveLayer(layerId)
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
  const smoothed = smoothGeojson(processed, iterations)
  const geojson = composition.value.id === 'transit-diagram'
    ? buildTransitDiagramGeojson(processed, props.map.bbox)
    : smoothed
  const src = mapInstance.getSource('route') as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(geojson)
  else mapInstance.addSource('route', { type: 'geojson', data: geojson })
  syncTransitStationSource(geojson)
}

function lineMetricsSafeGeojson(geojson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const lines: number[][][] = []
  for (const feature of geojson.features) {
    const geometry = feature.geometry
    if (geometry.type === 'LineString' && geometry.coordinates.length >= 2) {
      lines.push(geometry.coordinates as number[][])
    } else if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        if (line.length >= 2) lines.push(line as number[][])
      }
    }
  }
  if (lines.length <= 1) return geojson
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: lines },
    }],
  }
}

function populateSegmentSources() {
  if (!mapInstance) return
  const handleFeatures: GeoJSON.Feature[] = []

  for (const seg of (props.styleConfig.trail_segments ?? [])) {
    if (!seg.visible) continue
    const isActiveEditSegment = props.segmentEditMode?.segId === seg.id && segmentEditCoords.value.length >= 2
    const rendered = isActiveEditSegment
      ? activeSegmentEditLineGeojson()
      : smoothGeojson(
          bendSegmentGeojson(
            resolveTrailSegmentGeojson(
              props.map.geojson as GeoJSON.FeatureCollection,
              seg,
              props.styleConfig.route_deleted_ranges ?? [],
            ),
            seg.bend ?? 0,
            seg.bends,
          ),
          seg.smooth ?? 0,
        )
    const src = mapInstance.getSource(trailSourceId(seg)) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(seg.color_mode === 'gradient' ? lineMetricsSafeGeojson(rendered) : rendered)

    handleFeatures.push(...trailSegmentEndpointFeatures(rendered, seg.color))
  }

  const handleSrc = mapInstance.getSource('segment-handles') as maplibregl.GeoJSONSource | undefined
  if (handleSrc) handleSrc.setData({ type: 'FeatureCollection', features: handleFeatures })
}

function activeSegmentEditLineGeojson(): GeoJSON.FeatureCollection {
  const base = lineStringFeatureCollection(segmentEditCoords.value)
  if (!segmentBendDrag) return base
  const bends = Array(Math.max(0, segmentEditCoords.value.length - 1)).fill(0)
  bends[segmentBendDrag.index] = segmentEditBends.value[segmentBendDrag.index] ?? 0
  return bendSegmentGeojson(base, 0, bends)
}

// ── Start / finish pin markers ────────────────────────────────────────────────
// The dot sits fixed at the route endpoint. Drag the SVG text label instead.
// The leader line stretches from the fixed dot to wherever the label is placed.

let startMarker: maplibregl.Marker | null = null
let finishMarker: maplibregl.Marker | null = null

function makePinDotEl(kind: 'start' | 'finish' = 'finish'): HTMLElement {
  const color   = contrastSafePinColor.value
  const opacity = props.styleConfig.pin_opacity ?? 0.9
  const size    = Math.max(posterContentMinPx(10), (containerDims.value.h || 600) * 0.015)
  const el = document.createElement('div')
  const usgs = isUsgsHeritageTheme.value
  const editorial = props.styleConfig.color_theme === 'editorial-minimal'
  const relief = props.styleConfig.color_theme === 'relief-shaded'
  const modernist = props.styleConfig.color_theme === 'bold-modern'
  const bib = composition.value.id === 'bib-numerals'
  const botanical = composition.value.id === 'botanical-plate'
  const markerSize = relief ? size * 1.18 : editorial ? size * 0.82 : usgs ? size * (kind === 'start' ? 0.92 : 1.04) : modernist ? size * 1.04 : bib || botanical ? size * 1.08 : size
  const radius = editorial || modernist || (usgs && kind === 'start') || ((bib || botanical || relief) && kind === 'finish') ? '0' : '50%'
  el.dataset.testid = `pin-marker-${kind}`
  el.className = `pin-marker pin-marker--${kind}`
  el.style.cssText = [
    `width:${markerSize}px`, `height:${markerSize}px`, `border-radius:${radius}`,
    `background:${color}`, `opacity:${opacity}`,
    editorial
      ? 'box-shadow:0 0 0 2px #F8F3EA'
      : relief ? 'box-shadow:0 0 0 3px #F5EFE2'
      : modernist ? 'box-shadow:0 0 0 2px #FFFFFB'
      : usgs ? 'box-shadow:0 0 0 3px #F0ECDE' : 'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
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
    startMarker = new maplibregl.Marker({ element: makePinDotEl('start'), anchor: 'center', draggable: false })
      .setLngLat(startCoord)
      .addTo(mapInstance)
  }

  if (endCoord && props.styleConfig.show_finish_pin !== false) {
    finishMarker = new maplibregl.Marker({ element: makePinDotEl('finish'), anchor: 'center', draggable: false })
      .setLngLat(endCoord)
      .addTo(mapInstance)
  }

  nextTick(recomputeOverlays)
}

function apply3DTerrain(options: { animate?: boolean } = {}) {
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
  const shouldAnimate = options.animate !== false &&
    props.editable !== false &&
    (Math.abs(mapInstance.getPitch() - pitch) > 0.01 || Math.abs(mapInstance.getBearing() - bearing) > 0.01)
  if (shouldAnimate) {
    mapInstance.easeTo({ pitch, bearing, duration: 600 })
  } else {
    mapInstance.jumpTo({ pitch, bearing })
  }
}

function setPaintBackground() {
  if (!mapInstance) return
  if (mapInstance.getLayer('background')) {
    mapInstance.setPaintProperty('background', 'background-color', mapBackgroundColor(props.styleConfig))
  }
}

function setLayerPaint(layerId: string, property: string, value: unknown) {
  if (!mapInstance?.getLayer(layerId)) return
  mapInstance.setPaintProperty(layerId, property, value)
}

const PRIMARY_ROUTE_LAYER_IDS = ['route-line-wash', 'route-line-casing', 'route-line', 'route-label-collision'] as const

function syncPrimaryRouteLayerVisibility(config: StyleConfig) {
  if (!mapInstance) return
  const visibility = shouldRenderPrimaryRoute(config) ? 'visible' : 'none'
  for (const layerId of PRIMARY_ROUTE_LAYER_IDS) {
    if (!mapInstance.getLayer(layerId)) continue
    mapInstance.setLayoutProperty(layerId, 'visibility', visibility)
  }
}

function applyRoadPaint(config: StyleConfig) {
  const color = config.roads_color ?? config.label_text_color
  const opacity = config.roads_opacity ?? 0.6
  for (const [layerId, multiplier] of [
    ['roads-major', 0.50],
    ['roads-primary', 0.37],
    ['roads-minor', 0.23],
    ['rn-service', 0.18],
    ['rn-street', 0.32],
    ['rn-secondary', 0.55],
    ['rn-motorway', 0.75],
    ['nt-service', 0.25],
    ['nt-street', 0.55],
    ['nt-secondary', 0.80],
    ['nt-motorway', 1.0],
  ] as const) {
    setLayerPaint(layerId, 'line-color', color)
    setLayerPaint(layerId, 'line-opacity', opacity * multiplier)
  }
}

function applyPlaceLabelPaint(config: StyleConfig) {
  setLayerPaint('roads-place-labels', 'text-color', config.place_labels_color ?? config.label_text_color)
  setLayerPaint('roads-place-labels', 'text-opacity', config.place_labels_opacity ?? 0.75)
  setLayerPaint('roads-place-labels', 'text-halo-color', mapBackgroundColor(config))
}

function applyPoiLabelPaint(config: StyleConfig) {
  setLayerPaint('roads-poi-labels', 'text-color', config.poi_labels_color ?? config.label_text_color)
  setLayerPaint('roads-poi-labels', 'text-opacity', config.poi_labels_opacity ?? 0.65)
  setLayerPaint('roads-poi-labels', 'text-halo-color', mapBackgroundColor(config))
}

function applyWaterPaint(config: StyleConfig) {
  const contourWaterColor = config.water_color ?? '#9CCFD8'
  const roadNetworkWaterColor = config.water_color ?? '#7FB3C8'
  setLayerPaint('contour-art-water', 'fill-color', contourWaterColor)
  setLayerPaint('contour-art-waterways', 'line-color', contourWaterColor)
  setLayerPaint('rn-water', 'fill-color', roadNetworkWaterColor)
  setLayerPaint('rn-waterways', 'line-color', roadNetworkWaterColor)
}

function applyContourPaint(config: StyleConfig) {
  const contourConfig = contourAdaptedStyleConfig(config)
  const contourOpacity = contourConfig.contour_opacity ?? 0.65
  const minorColor = contourConfig.contour_color ?? contourConfig.label_text_color ?? '#64748B'
  const majorColor = contourConfig.contour_major_color ?? minorColor
  setLayerPaint('contours-minor', 'line-color', minorColor)
  setLayerPaint('contours-minor', 'line-opacity', contourMinorLineOpacityExpression(contourOpacity))
  setLayerPaint('contours-mid', 'line-color', minorColor)
  setLayerPaint('contours-mid', 'line-opacity', contourOpacity)
  setLayerPaint('contours-major', 'line-color', majorColor)
  setLayerPaint('contours-major', 'line-opacity', contourOpacity)
  setLayerPaint('contours-labels', 'text-color', majorColor)
  setLayerPaint('contours-labels', 'text-opacity', contourOpacity)
  setLayerPaint('contours-labels', 'text-halo-color', mapBackgroundColor(contourConfig))
}

function applyHillshadePaint(config: StyleConfig) {
  setLayerPaint('hillshade', 'hillshade-exaggeration', effectiveHillshadeExaggeration(config))
}

function applyRasterPaint(config: StyleConfig) {
  const rasterLayerId = config.preset === 'topographic' ? 'outdoors-tiles' : 'base-tiles'
  setLayerPaint(rasterLayerId, 'raster-contrast', config.tile_contrast ?? 0)
  setLayerPaint(rasterLayerId, 'raster-saturation', config.tile_saturation ?? 0)
  setLayerPaint(rasterLayerId, 'raster-hue-rotate', config.tile_hue_rotate ?? 0)
}

type GeneratedStyleLayer = {
  id?: string
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
}

function atlasLayerSettingsStructureKey(config: StyleConfig | undefined): string {
  const settings = config?.atlas_layer_settings
  return JSON.stringify({
    contourLabels: settings?.contour?.labels,
    showMajorRoads: settings?.transportation?.show_major,
    showMinorRoads: settings?.transportation?.show_minor,
    showTrails: settings?.transportation?.show_trails,
  })
}

function applyAtlasLayerSettingsPaint(config: StyleConfig) {
  if (!mapInstance) return
  const preset = config.preset ?? ''
  if (!preset.startsWith('radmaps-')) return

  const nextStyle = buildScaledMapStyle(config) as { layers?: GeneratedStyleLayer[] }
  for (const layer of nextStyle.layers ?? []) {
    if (!layer.id || !mapInstance.getLayer(layer.id)) continue
    const isAtlasLayer = layer.id.startsWith(`${preset}-`)
      || layer.id === 'contours-ghost-texture'
      || layer.id === 'contours-minor'
      || layer.id === 'contours-mid'
      || layer.id === 'contours-major'
      || layer.id === 'contours-labels'
    if (!isAtlasLayer) continue

    for (const [property, value] of Object.entries(layer.paint ?? {})) {
      mapInstance.setPaintProperty(layer.id, property, value)
    }
    for (const [property, value] of Object.entries(layer.layout ?? {})) {
      mapInstance.setLayoutProperty(layer.id, property, value)
    }
  }
}

// ── interactjs drag for text overlays ────────────────────────────────────────

async function initOverlayDrag() {
  if (!props.editable || !posterCanvasEl.value || posterElementsEditing.value) return
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
      ignoreFrom: '.overlay-delete-btn, .overlay-resize-handle',
      listeners: {
        start(event: { target: HTMLElement }) {
          const id = event.target.dataset.assetId
          if (!id) return
          selectedAssetId.value = id
          selectedOverlayId.value = null
          draggingAssetId.value = id
          emit('asset-selected', id)
        },
        move(event: { dx: number; dy: number; target: HTMLElement }) {
          const id = event.target.dataset.assetId
          const asset = id ? findImageAsset(id) : undefined
          if (!asset) return
          const containerRect = container.getBoundingClientRect()
          const currentLeft = parseFloat(el.style.left) || 0
          const currentTop = parseFloat(el.style.top) || 0
          const next = clampAssetPosition(asset, currentLeft + (event.dx / containerRect.width) * 100, currentTop + (event.dy / containerRect.height) * 100)
          el.style.left = `${next.x}%`
          el.style.top = `${next.y}%`
        },
        end(event: { target: HTMLElement }) {
          const id = event.target.dataset.assetId
          const asset = id ? findImageAsset(id) : undefined
          draggingAssetId.value = null
          if (!id || !asset) return
          const next = clampAssetPosition(asset, parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0)
          el.style.left = `${next.x}%`
          el.style.top = `${next.y}%`
          emit('asset-moved', { id, x: roundedPercent(next.x), y: roundedPercent(next.y) })
        },
      },
    })
    interactInstances.push(inst)
  })
}

// ── Style config watcher ──────────────────────────────────────────────────────

let queuedStyleConfig: StyleConfig | null = null

function styleConfigSignature(config: StyleConfig | undefined): string {
  return JSON.stringify(config ?? null)
}

async function applyStyleConfigUpdate(newConfig: StyleConfig, oldConfig?: StyleConfig) {
  if (!mapInstance) return
  if (!mapReady.value) {
    queuedStyleConfig = newConfig
    return
  }
  queuedStyleConfig = null

  // Tile effect params are baked into tile URLs — require a full style rebuild
  const tileKeyChanged = effectiveTileKey(newConfig) !== effectiveTileKey(oldConfig ?? newConfig)

    // Segment source/layer structure changes when segment IDs are added/removed
    const newSegIds = (newConfig.trail_segments ?? []).map(s => `${s.id}:${s.visible}:${s.color_mode ?? 'solid'}`).join(',')
    const oldSegIds = (oldConfig?.trail_segments ?? []).map(s => `${s.id}:${s.visible}:${s.color_mode ?? 'solid'}`).join(',')
    const segStructureChanged = newSegIds !== oldSegIds

    const atlasLayerSettingsStructureChanged = atlasLayerSettingsStructureKey(newConfig) !== atlasLayerSettingsStructureKey(oldConfig)

    const needsFullReload = tileKeyChanged || segStructureChanged || atlasLayerSettingsStructureChanged || fullReloadKeysFor(newConfig).some(
      key => JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key]),
    )

    if (needsFullReload) {
      // Clear tile cache when effect params change so stale processed tiles aren't reused
      if (tileKeyChanged) _tileCache.clear()
      const cameraBeforeReload = snapshotCurrentCamera()
      const cameraAfterReload = cameraBeforeReload
        ? { ...cameraBeforeReload, pitch: effectivePitch(newConfig), bearing: effectiveBearing(newConfig) }
        : null
      mapReady.value = false
      if (styleUsesContours(newConfig)) await ensureContourProtocol()
      const newStyle = buildScaledMapStyle(newConfig)
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        populateSegmentSources()
        placePinMarkers()
        apply3DTerrain({ animate: false })
        syncPrimaryRouteLayerVisibility(newConfig)
        // setStyle() can reset the viewport; layer toggles must not reframe the poster.
        restoreCameraAfterStyleReload(cameraAfterReload)
        applyViewportScaledLayerProperties(newConfig)
        mapReady.value = true
        if (props.editable && !posterElementsEditing.value) nextTick(() => initOverlayDrag())
        nextTick(recomputeOverlays)
        if (props.deleteBrushActive) nextTick(activateDeleteBrush)
        if (props.segmentDrawMode) nextTick(syncSegmentDrawSources)
        if (props.segmentEditMode) nextTick(syncSegmentEditSources)
        const latestConfig = props.styleConfig
        const needsQueuedRefresh = queuedStyleConfig || styleConfigSignature(latestConfig) !== styleConfigSignature(newConfig)
        if (needsQueuedRefresh) {
          queuedStyleConfig = null
          nextTick(() => {
            void applyStyleConfigUpdate(latestConfig, newConfig)
          })
        }
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
          if (seg.color_mode !== 'gradient') mapInstance.setPaintProperty(lineId, 'line-color', seg.color)
          mapInstance.setPaintProperty(lineId, 'line-width', width)
          mapInstance.setPaintProperty(lineId, 'line-opacity', seg.opacity ?? 0.9)
          mapInstance.setPaintProperty(casingId, 'line-width', width + (newConfig.segment_casing_width ?? DEFAULT_SEGMENT_CASING_WIDTH))
        }
      }
      applyViewportScaledLayerProperties(newConfig)
      if (props.segmentEditMode) nextTick(reloadSegmentEditCoordsFromStyle)
      nextTick(recomputeOverlays)
    }

    if (
      newConfig.map_pitch !== oldConfig?.map_pitch ||
      newConfig.map_bearing !== oldConfig?.map_bearing ||
      newConfig.terrain_exaggeration !== oldConfig?.terrain_exaggeration
    ) {
      apply3DTerrain()
    }

    if (newConfig.hillshade_intensity !== oldConfig?.hillshade_intensity) applyHillshadePaint(newConfig)

    if (newConfig.background_color !== oldConfig?.background_color) {
      setPaintBackground()
      applyPlaceLabelPaint(newConfig)
      applyPoiLabelPaint(newConfig)
      applyContourPaint(newConfig)
    }

    if (
      newConfig.roads_color !== oldConfig?.roads_color ||
      newConfig.roads_opacity !== oldConfig?.roads_opacity ||
      newConfig.label_text_color !== oldConfig?.label_text_color
    ) {
      applyRoadPaint(newConfig)
    }

    if (JSON.stringify(newConfig.atlas_layer_settings) !== JSON.stringify(oldConfig?.atlas_layer_settings)) {
      applyAtlasLayerSettingsPaint(newConfig)
    }

    if (
      newConfig.place_labels_color !== oldConfig?.place_labels_color ||
      newConfig.place_labels_opacity !== oldConfig?.place_labels_opacity ||
      newConfig.label_text_color !== oldConfig?.label_text_color
    ) {
      applyPlaceLabelPaint(newConfig)
    }

    if (
      newConfig.poi_labels_color !== oldConfig?.poi_labels_color ||
      newConfig.poi_labels_opacity !== oldConfig?.poi_labels_opacity ||
      newConfig.label_text_color !== oldConfig?.label_text_color
    ) {
      applyPoiLabelPaint(newConfig)
    }

    if (newConfig.water_color !== oldConfig?.water_color) applyWaterPaint(newConfig)

    // Contour line-width fast path — avoids full reload for width multiplier changes
    if (
      newConfig.contour_color !== oldConfig?.contour_color ||
      newConfig.contour_major_color !== oldConfig?.contour_major_color ||
      newConfig.contour_opacity !== oldConfig?.contour_opacity
    ) {
      applyContourPaint(newConfig)
    }
    if (newConfig.contour_minor_width !== oldConfig?.contour_minor_width) {
      const contourConfig = contourAdaptedStyleConfig(newConfig)
      if (mapInstance.getLayer('contours-minor'))
        mapInstance.setPaintProperty('contours-minor', 'line-width',
          contourMinorLineWidthExpression(contourConfig))
      if (mapInstance.getLayer('contours-mid'))
        mapInstance.setPaintProperty('contours-mid', 'line-width',
          contourMidLineWidthExpression(contourConfig))
    }
    if (newConfig.contour_major_width !== oldConfig?.contour_major_width) {
      const contourConfig = contourAdaptedStyleConfig(newConfig)
      if (mapInstance.getLayer('contours-major'))
        mapInstance.setPaintProperty('contours-major', 'line-width',
          contourMajorLineWidthExpression(contourConfig))
    }

    // Raster layer paint-only updates (contrast / saturation / hue) —
    // these are MapLibre paint properties and don't need a tile re-fetch.
    if (
      newConfig.tile_contrast !== oldConfig?.tile_contrast ||
      newConfig.tile_saturation !== oldConfig?.tile_saturation ||
      newConfig.tile_hue_rotate !== oldConfig?.tile_hue_rotate
    ) {
      applyRasterPaint(newConfig)
    }

    if (mapInstance.getLayer('route-line')) {
      syncPrimaryRouteLayerVisibility(newConfig)
      const routePaint = resolveTonerRouteStyle(newConfig)
      if ((newConfig.route_color_mode ?? 'solid') !== 'gradient') {
        mapInstance.setPaintProperty('route-line', 'line-color', routePaint.route_color)
      }
      mapInstance.setPaintProperty('route-line', 'line-width', routePaint.route_width)
      mapInstance.setPaintProperty('route-line', 'line-opacity', routePaint.route_opacity)
      mapInstance.setPaintProperty('route-line-casing', 'line-width', routePaint.route_width + DEFAULT_ROUTE_CASING_WIDTH)
      mapInstance.setPaintProperty('route-line-casing', 'line-opacity', routePaint.route_opacity)
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
      newConfig.trail_show_stats !== oldConfig?.trail_show_stats ||
      newConfig.trail_show_elevation_gain !== oldConfig?.trail_show_elevation_gain ||
      newConfig.start_pin_label     !== oldConfig?.start_pin_label     ||
      newConfig.finish_pin_label    !== oldConfig?.finish_pin_label    ||
      newConfig.pin_font_family     !== oldConfig?.pin_font_family     ||
      JSON.stringify(newConfig.poster_text_overrides) !== JSON.stringify(oldConfig?.poster_text_overrides) ||
      JSON.stringify(newConfig.start_label_lnglat)  !== JSON.stringify(oldConfig?.start_label_lnglat)  ||
      JSON.stringify(newConfig.finish_label_lnglat) !== JSON.stringify(oldConfig?.finish_label_lnglat)
    ) {
      nextTick(recomputeOverlays)
    }
}

watch(
  () => props.styleConfig,
  (newConfig, oldConfig) => {
    void applyStyleConfigUpdate(newConfig, oldConfig)
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
        apply3DTerrain({ animate: false })
        restoreCameraAfterStyleReload(cameraBeforeReload)
        applyViewportScaledLayerProperties()
        mapReady.value = true
        if (props.editable && !posterElementsEditing.value) nextTick(() => initOverlayDrag())
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
        'line-width': (props.styleConfig.route_width ?? DEFAULT_ROUTE_WIDTH) + DEFAULT_ROUTE_CASING_WIDTH + 1.4,
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
        'line-width': (props.styleConfig.route_width ?? DEFAULT_ROUTE_WIDTH) + 1.4,
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
  if (enabled && canEnableMapGestures()) {
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

// ── Segment draw mode: freehand point-to-point segment creation/extension ─────

function drawModeAnchorCoord(): [number, number] | null {
  const mode = props.segmentDrawMode
  if (!mode || mode.type !== 'extend') return null
  const seg = (props.styleConfig.trail_segments ?? []).find(segment => segment.id === mode.segId)
  if (!seg?.geojson) return null
  const coords = getAllRouteCoords(seg.geojson)
  if (!coords.length) return null
  const coord = mode.end === 'start' ? coords[0] : coords[coords.length - 1]
  return [coord[0], coord[1]]
}

function ensureSegmentDrawLayers() {
  if (!mapInstance) return
  if (!mapInstance.getSource('segment-draw-line')) {
    mapInstance.addSource('segment-draw-line', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!mapInstance.getSource('segment-draw-points')) {
    mapInstance.addSource('segment-draw-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!mapInstance.getLayer('segment-draw-line')) {
    mapInstance.addLayer({
      id: 'segment-draw-line',
      type: 'line',
      source: 'segment-draw-line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#2D6A4F',
        'line-width': 3,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1],
      },
    })
  }
  if (!mapInstance.getLayer('segment-draw-points-halo')) {
    mapInstance.addLayer({
      id: 'segment-draw-points-halo',
      type: 'circle',
      source: 'segment-draw-points',
      paint: {
        'circle-radius': 8,
        'circle-color': '#FFFFFF',
        'circle-opacity': 0.9,
      },
    })
  }
  if (!mapInstance.getLayer('segment-draw-points')) {
    mapInstance.addLayer({
      id: 'segment-draw-points',
      type: 'circle',
      source: 'segment-draw-points',
      paint: {
        'circle-radius': 4.5,
        'circle-color': '#2D6A4F',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 1.5,
      },
    })
  }
}

function segmentDrawPreviewCoords(): Array<[number, number]> {
  const anchor = drawModeAnchorCoord()
  return anchor ? [anchor, ...segmentDrawCoords.value] : segmentDrawCoords.value
}

function syncSegmentDrawSources() {
  if (!mapInstance) return
  ensureSegmentDrawLayers()
  const previewCoords = segmentDrawPreviewCoords()
  const line = previewCoords.length >= 2
    ? lineStringFeatureCollection(previewCoords)
    : { type: 'FeatureCollection' as const, features: [] }
  const points = {
    type: 'FeatureCollection' as const,
    features: previewCoords.map((coord, idx) => ({
      type: 'Feature' as const,
      properties: { idx },
      geometry: { type: 'Point' as const, coordinates: coord },
    })),
  }
  const lineSource = mapInstance.getSource('segment-draw-line') as maplibregl.GeoJSONSource | undefined
  const pointsSource = mapInstance.getSource('segment-draw-points') as maplibregl.GeoJSONSource | undefined
  lineSource?.setData(line)
  pointsSource?.setData(points)
}

function clearSegmentDrawSources() {
  const empty = { type: 'FeatureCollection' as const, features: [] }
  const lineSource = mapInstance?.getSource('segment-draw-line') as maplibregl.GeoJSONSource | undefined
  const pointsSource = mapInstance?.getSource('segment-draw-points') as maplibregl.GeoJSONSource | undefined
  lineSource?.setData(empty)
  pointsSource?.setData(empty)
}

function onSegmentDrawClick(e: maplibregl.MapMouseEvent) {
  if (!props.segmentDrawMode) return
  segmentDrawCoords.value = [...segmentDrawCoords.value, [e.lngLat.lng, e.lngLat.lat]]
  syncSegmentDrawSources()
}

function onSegmentDrawDoubleClick(e: maplibregl.MapMouseEvent) {
  e.preventDefault()
  if (canFinishSegmentDraw.value) finishSegmentDraw()
}

function undoSegmentDrawPoint() {
  if (!canUndoSegmentDrawPoint.value) return false
  segmentDrawCoords.value = segmentDrawCoords.value.slice(0, -1)
  syncSegmentDrawSources()
  return true
}

function finishSegmentDraw() {
  if (!props.segmentDrawMode || !canFinishSegmentDraw.value) return
  emit('segment-draw-finished', {
    mode: props.segmentDrawMode,
    coords: [...segmentDrawCoords.value],
  })
}

function onSegmentDrawKeydown(e: KeyboardEvent) {
  if (!props.segmentDrawMode) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('segment-draw-cancelled')
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    undoSegmentDrawPoint()
  } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    undoSegmentDrawPoint()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    finishSegmentDraw()
  }
}

watch(
  () => props.segmentDrawMode,
  (mode, prevMode) => {
    if (!mapInstance) return
    if (prevMode) {
      mapInstance.getCanvas().style.cursor = ''
      mapInstance.off('click', onSegmentDrawClick)
      mapInstance.off('dblclick', onSegmentDrawDoubleClick)
      if (segmentDrawDisabledDoubleClickZoom) {
        if (canEnableMapGestures()) mapInstance.doubleClickZoom.enable()
        segmentDrawDisabledDoubleClickZoom = false
      }
      document.removeEventListener('keydown', onSegmentDrawKeydown)
      segmentDrawCoords.value = []
      clearSegmentDrawSources()
    }
    if (!mode) return

    mapInstance.getCanvas().style.cursor = 'crosshair'
    if (mapInstance.doubleClickZoom.isEnabled()) {
      mapInstance.doubleClickZoom.disable()
      segmentDrawDisabledDoubleClickZoom = true
    }
    ensureSegmentDrawLayers()
    segmentDrawCoords.value = []
    syncSegmentDrawSources()
    mapInstance.on('click', onSegmentDrawClick)
    mapInstance.on('dblclick', onSegmentDrawDoubleClick)
    document.addEventListener('keydown', onSegmentDrawKeydown)
  },
)

// ── Segment point edit mode: drag existing geometry-backed track vertices ─────

function currentEditSegment() {
  const mode = props.segmentEditMode
  if (!mode) return null
  return (props.styleConfig.trail_segments ?? []).find(segment => segment.id === mode.segId) ?? null
}

function setSegmentEditInteractions(enabled: boolean) {
  if (!mapInstance) return
  if (enabled && canEnableMapGestures()) {
    mapInstance.dragPan.enable()
    mapInstance.touchZoomRotate.enable()
    return
  }
  mapInstance.dragPan.disable()
  mapInstance.touchZoomRotate.disable()
}

function loadSegmentEditCoords() {
  const seg = currentEditSegment()
  segmentEditCoords.value = seg?.geojson ? normalizeLineCoords(seg.geojson) : []
  segmentEditBends.value = normalizedSegmentEditBends(seg, segmentEditCoords.value.length)
}

function reloadSegmentEditCoordsFromStyle() {
  if (!props.segmentEditMode || segmentEditDragIndex != null || segmentBendDrag) return
  loadSegmentEditCoords()
  syncSegmentEditSources()
}

function normalizedSegmentEditBends(seg: TrailSegment | null, coordCount: number): number[] {
  const edgeCount = Math.max(0, coordCount - 1)
  const values = Array(edgeCount).fill(0)
  const fallback = typeof seg?.bend === 'number' && Number.isFinite(seg.bend)
    ? Math.max(-1, Math.min(1, seg.bend))
    : 0
  for (let i = 0; i < edgeCount; i++) {
    const raw = seg?.bends?.[i] ?? fallback
    values[i] = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0
  }
  return values
}

function normalizeBendsForCoords(bends: number[], coordCount: number): number[] {
  return sanitizeSegmentBends(bends, Math.max(0, coordCount - 1))
}

function ensureSegmentEditLayers() {
  if (!mapInstance) return
  if (!mapInstance.getSource('segment-edit-bend-hit')) {
    mapInstance.addSource('segment-edit-bend-hit', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!mapInstance.getSource('segment-edit-points')) {
    mapInstance.addSource('segment-edit-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!mapInstance.getLayer('segment-edit-bend-hit')) {
    mapInstance.addLayer({
      id: 'segment-edit-bend-hit',
      type: 'line',
      source: 'segment-edit-bend-hit',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#2D6A4F',
        'line-opacity': 0.01,
        'line-width': 20,
      },
    })
  }
  if (!mapInstance.getLayer('segment-edit-points-halo')) {
    mapInstance.addLayer({
      id: 'segment-edit-points-halo',
      type: 'circle',
      source: 'segment-edit-points',
      paint: {
        'circle-radius': 7,
        'circle-color': '#FFFFFF',
        'circle-opacity': 0.9,
      },
    })
  }
  if (!mapInstance.getLayer('segment-edit-points')) {
    mapInstance.addLayer({
      id: 'segment-edit-points',
      type: 'circle',
      source: 'segment-edit-points',
      paint: {
        'circle-radius': 4.25,
        'circle-color': '#2D6A4F',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 1.4,
      },
    })
  }
}

function segmentEditPointCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: segmentEditCoords.value.map((coord, idx) => ({
      type: 'Feature' as const,
      properties: { idx },
      geometry: { type: 'Point' as const, coordinates: [coord[0], coord[1]] },
    })),
  }
}

function syncSegmentEditSources() {
  if (!mapInstance || !props.segmentEditMode) return
  ensureSegmentEditLayers()
  const pointsSource = mapInstance.getSource('segment-edit-points') as maplibregl.GeoJSONSource | undefined
  const bendHitSource = mapInstance.getSource('segment-edit-bend-hit') as maplibregl.GeoJSONSource | undefined
  bendHitSource?.setData(activeSegmentEditLineGeojson())
  pointsSource?.setData(segmentEditPointCollection())

  const seg = currentEditSegment()
  if (!seg) return
  const source = mapInstance.getSource(trailSourceId(seg)) as maplibregl.GeoJSONSource | undefined
  if (source && segmentEditCoords.value.length >= 2) {
    source.setData(activeSegmentEditLineGeojson())
  }
}

function clearSegmentEditSources() {
  const empty = { type: 'FeatureCollection' as const, features: [] }
  const pointsSource = mapInstance?.getSource('segment-edit-points') as maplibregl.GeoJSONSource | undefined
  const bendHitSource = mapInstance?.getSource('segment-edit-bend-hit') as maplibregl.GeoJSONSource | undefined
  pointsSource?.setData(empty)
  bendHitSource?.setData(empty)
  if (mapInstance) populateSegmentSources()
}

function pointIndexFromFeature(feature: maplibregl.MapGeoJSONFeature | undefined): number | null {
  const raw = feature?.properties?.idx
  const idx = typeof raw === 'number' ? raw : Number(raw)
  return Number.isInteger(idx) && idx >= 0 ? idx : null
}

function screenSegmentMetrics(index: number) {
  if (!mapInstance) return null
  const a = segmentEditCoords.value[index]
  const b = segmentEditCoords.value[index + 1]
  if (!a || !b) return null
  const pa = mapInstance.project([a[0], a[1]])
  const pb = mapInstance.project([b[0], b[1]])
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null
  return {
    midX: (pa.x + pb.x) / 2,
    midY: (pa.y + pb.y) / 2,
    len,
    normalX: -dy / len,
    normalY: dx / len,
  }
}

function signedBendDistancePx(index: number, point: { x: number; y: number }): number {
  const metrics = screenSegmentMetrics(index)
  if (!metrics) return 0
  return ((point.x - metrics.midX) * metrics.normalX) + ((point.y - metrics.midY) * metrics.normalY)
}

function distanceToScreenSegment(point: { x: number; y: number }, index: number): number {
  if (!mapInstance) return Number.POSITIVE_INFINITY
  const a = segmentEditCoords.value[index]
  const b = segmentEditCoords.value[index + 1]
  if (!a || !b) return Number.POSITIVE_INFINITY
  const pa = mapInstance.project([a[0], a[1]])
  const pb = mapInstance.project([b[0], b[1]])
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const lenSq = dx * dx + dy * dy
  if (!lenSq) return Math.hypot(point.x - pa.x, point.y - pa.y)
  const t = Math.max(0, Math.min(1, (((point.x - pa.x) * dx) + ((point.y - pa.y) * dy)) / lenSq))
  const x = pa.x + dx * t
  const y = pa.y + dy * t
  return Math.hypot(point.x - x, point.y - y)
}

function nearestEditStretchIndex(point: { x: number; y: number }): number | null {
  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < segmentEditCoords.value.length - 1; index++) {
    const distance = distanceToScreenSegment(point, index)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function onSegmentEditMouseDown(e: maplibregl.MapLayerMouseEvent) {
  if (!props.segmentEditMode) return
  const idx = pointIndexFromFeature(e.features?.[0])
  if (idx == null || idx >= segmentEditCoords.value.length) return
  e.preventDefault()
  segmentEditDragIndex = idx
  segmentEditDragChanged = false
  setSegmentEditInteractions(false)
  mapInstance?.getCanvas().classList.add('segment-point-dragging')
}

function onSegmentPointMouseEnter() {
  if (!segmentEditDragIndex && !segmentBendDrag) {
    mapInstance?.getCanvas().classList.add('segment-point-hover')
    mapInstance?.getCanvas().classList.remove('segment-point-bend-hover')
  }
}

function onSegmentPointMouseLeave() {
  if (!segmentEditDragIndex) mapInstance?.getCanvas().classList.remove('segment-point-hover')
}

function onSegmentBendMouseDown(e: maplibregl.MapLayerMouseEvent) {
  if (!props.segmentEditMode || segmentEditDragIndex != null) return
  const index = nearestEditStretchIndex(e.point)
  if (index == null) return
  e.preventDefault()
  segmentBendDrag = {
    index,
    startSignedPx: signedBendDistancePx(index, e.point),
    initialBend: segmentEditBends.value[index] ?? 0,
  }
  segmentBendDragChanged = false
  setSegmentEditInteractions(false)
  mapInstance?.getCanvas().classList.add('segment-point-dragging')
}

function onSegmentEditMouseMove(e: maplibregl.MapMouseEvent) {
  if (props.segmentEditMode && segmentBendDrag) {
    const metrics = screenSegmentMetrics(segmentBendDrag.index)
    if (!metrics) return
    const signed = signedBendDistancePx(segmentBendDrag.index, e.point)
    const nextBend = Math.max(-1, Math.min(1, segmentBendDrag.initialBend + ((signed - segmentBendDrag.startSignedPx) / Math.max(24, metrics.len * 0.45))))
    const next = normalizeBendsForCoords(segmentEditBends.value, segmentEditCoords.value.length)
    next[segmentBendDrag.index] = Math.abs(nextBend) < 0.03 ? 0 : nextBend
    segmentEditBends.value = next
    segmentBendDragChanged = true
    syncSegmentEditSources()
    return
  }
  if (!props.segmentEditMode || segmentEditDragIndex == null) return
  const current = segmentEditCoords.value[segmentEditDragIndex]
  if (!current) return
  const nextCoord = [e.lngLat.lng, e.lngLat.lat, ...(current[2] != null ? [current[2]] : [])]
  const next = segmentEditCoords.value.slice()
  next[segmentEditDragIndex] = nextCoord
  segmentEditCoords.value = next
  segmentEditDragChanged = true
  syncSegmentEditSources()
}

function finishSegmentEditDrag() {
  if (props.segmentEditMode && segmentEditDragIndex != null && segmentEditDragChanged) {
    emit('segment-geometry-edited', {
      segId: props.segmentEditMode.segId,
      coords: segmentEditCoords.value.map(coord => coord.slice()),
      bends: normalizeBendsForCoords(segmentEditBends.value, segmentEditCoords.value.length),
    })
  } else if (props.segmentEditMode && segmentBendDrag && segmentBendDragChanged) {
    emit('segment-geometry-edited', {
      segId: props.segmentEditMode.segId,
      coords: segmentEditCoords.value.map(coord => coord.slice()),
      bends: normalizeBendsForCoords(segmentEditBends.value, segmentEditCoords.value.length),
    })
  }
  resetSegmentEditDrag()
}

function resetSegmentEditDrag() {
  segmentEditDragIndex = null
  segmentEditDragChanged = false
  segmentBendDrag = null
  segmentBendDragChanged = false
  setSegmentEditInteractions(true)
  mapInstance?.getCanvas().classList.remove('segment-point-dragging')
  mapInstance?.getCanvas().classList.remove('segment-point-hover')
  mapInstance?.getCanvas().classList.remove('segment-point-bend-hover')
}

function onSegmentBendMouseEnter() {
  if (!segmentEditDragIndex && !segmentBendDrag && !mapInstance?.getCanvas().classList.contains('segment-point-hover')) {
    mapInstance?.getCanvas().classList.add('segment-point-bend-hover')
  }
}

function onSegmentBendMouseLeave() {
  if (!segmentBendDrag) mapInstance?.getCanvas().classList.remove('segment-point-bend-hover')
}

function onSegmentEditKeydown(e: KeyboardEvent) {
  if (!props.segmentEditMode) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('segment-edit-cancelled')
  }
}

let activeSegmentEditSegId: string | null = null

function deactivateSegmentEditMode() {
  if (mapInstance && activeSegmentEditSegId) {
    mapInstance.off('mousedown', 'segment-edit-points', onSegmentEditMouseDown)
    mapInstance.off('mouseenter', 'segment-edit-points', onSegmentPointMouseEnter)
    mapInstance.off('mouseleave', 'segment-edit-points', onSegmentPointMouseLeave)
    mapInstance.off('mousedown', 'segment-edit-bend-hit', onSegmentBendMouseDown)
    mapInstance.off('mouseenter', 'segment-edit-bend-hit', onSegmentBendMouseEnter)
    mapInstance.off('mouseleave', 'segment-edit-bend-hit', onSegmentBendMouseLeave)
    mapInstance.off('mousemove', onSegmentEditMouseMove)
    clearSegmentEditSources()
    mapInstance.getCanvas().style.cursor = ''
    mapInstance.getCanvas().classList.remove('segment-point-hover')
    mapInstance.getCanvas().classList.remove('segment-point-bend-hover')
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('mouseup', finishSegmentEditDrag)
    document.removeEventListener('keydown', onSegmentEditKeydown)
  }
  resetSegmentEditDrag()
  segmentEditCoords.value = []
  activeSegmentEditSegId = null
}

function activateSegmentEditMode() {
  if (!mapInstance || !mapReady.value || !props.segmentEditMode) return
  if (activeSegmentEditSegId === props.segmentEditMode.segId) {
    reloadSegmentEditCoordsFromStyle()
    return
  }
  deactivateSegmentEditMode()
  loadSegmentEditCoords()
  ensureSegmentEditLayers()
  syncSegmentEditSources()
  mapInstance.getCanvas().style.cursor = ''
  mapInstance.on('mousedown', 'segment-edit-points', onSegmentEditMouseDown)
  mapInstance.on('mouseenter', 'segment-edit-points', onSegmentPointMouseEnter)
  mapInstance.on('mouseleave', 'segment-edit-points', onSegmentPointMouseLeave)
  mapInstance.on('mousedown', 'segment-edit-bend-hit', onSegmentBendMouseDown)
  mapInstance.on('mouseenter', 'segment-edit-bend-hit', onSegmentBendMouseEnter)
  mapInstance.on('mouseleave', 'segment-edit-bend-hit', onSegmentBendMouseLeave)
  mapInstance.on('mousemove', onSegmentEditMouseMove)
  if (typeof document !== 'undefined') {
    document.addEventListener('mouseup', finishSegmentEditDrag)
    document.addEventListener('keydown', onSegmentEditKeydown)
  }
  activeSegmentEditSegId = props.segmentEditMode.segId
}

watch(
  [() => props.segmentEditMode?.segId ?? null, () => mapReady.value],
  ([segId, ready]) => {
    if (!segId || !ready) {
      deactivateSegmentEditMode()
      return
    }
    activateSegmentEditMode()
  },
  { immediate: true },
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

function plotModeGeojson(): GeoJSON.FeatureCollection {
  const primary = props.map.geojson as GeoJSON.FeatureCollection
  const mode = props.plotMode
  if (!mode || mode.segId === 'route-crop' || mode.segId === 'route-delete-pending') return primary
  const seg = (props.styleConfig.trail_segments ?? []).find(s => s.id === mode.segId)
  return seg ? segmentSourceGeojson(primary, seg) : primary
}

function onPlotClick(e: maplibregl.MapMouseEvent) {
  if (!props.plotMode || !mapInstance) return
  const pct = findRoutePercent([e.lngLat.lng, e.lngLat.lat], plotModeGeojson())
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
    plotRouteCoords = getAllRouteCoords(plotModeGeojson())
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

function canEnableMapGestures() {
  return mapViewerInteractive.value && (props.mapInteractive === true || !props.styleConfig.map_frozen)
}

function disableAllMapGestures() {
  if (!mapInstance) return
  mapInstance.dragPan.disable()
  mapInstance.scrollZoom.disable()
  mapInstance.doubleClickZoom.disable()
  mapInstance.touchZoomRotate.disable()
  mapInstance.touchPitch?.disable()
  mapInstance.dragRotate.disable()
  mapInstance.boxZoom.disable()
  mapInstance.keyboard.disable()
}

function enableAllMapGestures() {
  if (!mapInstance) return
  if (!canEnableMapGestures()) {
    disableAllMapGestures()
    return
  }
  mapInstance.dragPan.enable()
  mapInstance.scrollZoom.enable()
  mapInstance.doubleClickZoom.enable()
  mapInstance.touchZoomRotate.enable()
  mapInstance.touchPitch?.enable()
  mapInstance.dragRotate.enable()
  mapInstance.boxZoom.enable()
  mapInstance.keyboard.enable()
}

watch(
  () => props.styleConfig.map_frozen,
  (frozen) => {
    if (!mapInstance || !mapReady.value) return
    if (frozen) {
      if (canEnableMapGestures()) {
        enableAllMapGestures()
      } else {
        disableAllMapGestures()
      }
      if (canUseSavedCamera()) {
        mapInstance.jumpTo({
          zoom: correctedFrameZoom(props.styleConfig.map_zoom as number),
          center: props.styleConfig.map_center as [number, number],
        })
      }
    } else {
      enableAllMapGestures()
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
  disableAllMapGestures()
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
  enableAllMapGestures()
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

  enableAllMapGestures()

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

function getVisibleBounds(): [number, number, number, number] | null {
  if (!mapInstance) return null
  const bounds = mapInstance.getBounds()
  return [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ]
}

function fitToRouteAndSegments(segmentBboxes: Array<[number, number, number, number]> = []) {
  if (!mapInstance || !mapContainer.value) return
  const bbox = unionBboxes([props.map.bbox, ...segmentBboxes])
  if (!bbox) return

  let emitted = false
  const emitCamera = () => {
    if (emitted || !mapInstance) return
    emitted = true
    const center = mapInstance.getCenter()
    emit('freeze-changed', {
      map_frozen: props.styleConfig.map_frozen ?? false,
      map_zoom: mapInstance.getZoom(),
      map_center: [center.lng, center.lat],
      map_editor_width: mapContainer.value?.offsetWidth ?? 0,
      map_pitch: mapInstance.getPitch(),
      map_bearing: mapInstance.getBearing(),
    })
  }

  mapInstance.once('moveend', emitCamera)
  mapInstance.fitBounds(bbox as maplibregl.LngLatBoundsLike, {
    padding: Math.round(mapContainer.value.offsetHeight * (props.styleConfig.padding_factor ?? 0.15)),
    duration: props.editable === false ? 0 : 350,
  })
  window.setTimeout(emitCamera, 450)
}

function requestUndo() {
  if (props.segmentDrawMode) {
    undoSegmentDrawPoint()
    return
  }
  emit('undo')
}

defineExpose({ freezeView, unfreezeView, resetViewToRoute, getVisibleBounds, fitToRouteAndSegments, finishSegmentDraw, undoSegmentDrawPoint })

// Re-init drag when text_overlays change (new overlays added)
watch(
  () => [(props.styleConfig.text_overlays ?? []).length, (props.styleConfig.image_overlays ?? []).length],
  () => {
    if (props.editable && !posterElementsEditing.value && mapReady.value) nextTick(() => initOverlayDrag())
  },
)

watch(
  () => [
    props.selectedPosterElementId,
    posterElementsEditing.value,
    (props.styleConfig.text_overlays ?? []).length,
    (props.styleConfig.image_overlays ?? []).length,
    (props.styleConfig.icon_overlays ?? []).length,
  ],
  () => nextTick(syncPosterMoveableTarget),
  { immediate: true, flush: 'post' },
)

watch(posterElementsEditing, (enabled) => {
  if (enabled) {
    for (const inst of interactInstances) inst.unset()
    interactInstances = []
    nextTick(syncPosterMoveableTarget)
  } else if (props.editable && mapReady.value) {
    nextTick(() => initOverlayDrag())
  }
})

onUnmounted(() => {
  for (const inst of interactInstances) inst.unset()
  resizeObserver?.disconnect()
  deactivateDeleteBrush()
  startMarker?.remove()
  finishMarker?.remove()
  plotGhostMarker?.remove()
  document.removeEventListener('keydown', onPlotKeydown)
  document.removeEventListener('keydown', onSegmentDrawKeydown)
  document.removeEventListener('mouseup', finishSegmentEditDrag)
  document.removeEventListener('keydown', onSegmentEditKeydown)
  cancelAnimationFrame(plotAnimFrame)
  if (styleReloadCameraHoldTimer) clearTimeout(styleReloadCameraHoldTimer)
  if (contourViewRefreshTimer) clearTimeout(contourViewRefreshTimer)
  mapInstance?.remove()
  mapInstance = null
  if (import.meta.dev && typeof window !== 'undefined') {
    const devWindow = window as unknown as {
      __RADMAPS_MAP_CAMERA__?: {
        get: () => MapCameraSnapshot | null
        jumpTo: (camera: Partial<MapCameraSnapshot>) => void
      }
      __RADMAPS_MAP_CAMERA_OWNER__?: symbol
      __RADMAPS_MAP_CAMERA_PRIORITY__?: number
    }
    if (devWindow.__RADMAPS_MAP_CAMERA_OWNER__ === devCameraHandleId) {
      delete devWindow.__RADMAPS_MAP_CAMERA__
      delete devWindow.__RADMAPS_MAP_CAMERA_OWNER__
      delete devWindow.__RADMAPS_MAP_CAMERA_PRIORITY__
    }
  }
})
</script>

<style scoped>
.poster-canvas {
  container-type: size;
  color: var(--composition-ink, currentColor);
}

.poster-header,
.poster-footer {
  overflow: hidden;
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
  flex: 0 1 auto;
  flex-wrap: wrap;
  min-width: 0;
  row-gap: 0.8cqh;
}

.stat-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
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
.composition-star-constellation,
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

.composition-plate-frame {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
}

.composition-plate-frame {
  inset: 4.4cqh 4.8cqw;
  border: 2px solid currentColor;
  opacity: 0.42;
  z-index: 10;
  box-shadow: none;
}

.poster-composition--place-frame .composition-plate-frame {
  opacity: 0.58;
  border-color: color-mix(in srgb, currentColor 58%, transparent);
}

.poster-composition--place-frame .composition-grid-overlay--map {
  inset: -11cqh -10cqw;
  opacity: 0.28 !important;
  transform: rotate(14deg);
  transform-origin: center;
  background-size: 10cqw 10cqh !important;
  mix-blend-mode: multiply;
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

.poster-composition--darksky-stars .composition-star-field {
  z-index: 6;
  inset: 0 0 42% 0;
  color: var(--label-text-color, #e7ecfb);
  opacity: 0.85;
  mix-blend-mode: screen;
  background-image:
    radial-gradient(circle at 14% 16%, currentColor 0 0.08cqw, transparent 0.1cqw),
    radial-gradient(circle at 26% 28%, currentColor 0 0.045cqw, transparent 0.08cqw),
    radial-gradient(circle at 43% 12%, currentColor 0 0.06cqw, transparent 0.09cqw),
    radial-gradient(circle at 66% 22%, currentColor 0 0.05cqw, transparent 0.08cqw),
    radial-gradient(circle at 83% 13%, currentColor 0 0.075cqw, transparent 0.11cqw),
    radial-gradient(circle at 91% 35%, currentColor 0 0.045cqw, transparent 0.08cqw),
    radial-gradient(circle at 52% 38%, var(--route-color, #e8c66a) 0 0.065cqw, transparent 0.1cqw);
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) [data-testid="poster-map"] {
  order: 0 !important;
  flex: 1 1 100% !important;
  height: 100% !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) [data-testid="poster-map"] .maplibregl-canvas-container {
  transform: translateY(12.5cqh) scale(1.16);
  transform-origin: 50% 52%;
}

.poster-composition--darksky-stars[data-theme="dark-sky"] [data-testid="poster-map"] .maplibregl-canvas-container {
  transform: translateY(30cqh) scale(1.36);
  transform-origin: 50% 58%;
}

.poster-composition--darksky-stars[data-theme="copper-night"] [data-testid="poster-map"] .maplibregl-canvas-container {
  transform: translateY(31cqh) scale(1.38);
  transform-origin: 50% 58%;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-header {
  inset: calc(7.8cqh + var(--print-bleed, 0px)) 0 auto 0 !important;
  overflow: visible !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-header {
  position: absolute !important;
  inset: calc(6.4cqh + var(--print-bleed, 0px)) 0 auto 0 !important;
  z-index: 14 !important;
  padding: 0 calc(8.4cqw + var(--print-bleed, 0px)) !important;
  background: transparent !important;
  color: var(--label-text-color, #e7ecfb) !important;
  pointer-events: none;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-rule {
  display: none !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-kicker {
  order: 0;
  color: var(--route-color, #e8c66a) !important;
  font-family: "IBM Plex Mono", monospace !important;
  letter-spacing: 0.34em !important;
  opacity: 0.88 !important;
  text-transform: uppercase;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-trail-name {
  order: 1;
  width: 62cqw !important;
  font-size: 10.8cqh !important;
  line-height: 0.84 !important;
  max-width: 62cqw !important;
  margin: 3.2cqh auto 0 !important;
  text-shadow:
    0 0 1.6cqh color-mix(in srgb, var(--background-color, #070c1e) 90%, transparent),
    0 0 0.25cqh var(--background-color, #070c1e) !important;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .poster-trail-name {
  width: 74cqw !important;
  max-width: 74cqw !important;
  font-size: 8.9cqh !important;
  line-height: 0.92 !important;
  margin-top: 3.7cqh !important;
  white-space: nowrap !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-kicker,
.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-location-line {
  display: block !important;
  min-height: 1.45cqh;
  line-height: 1.2 !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-location-line {
  order: 2;
  color: color-mix(in srgb, var(--label-text-color, #e7ecfb) 72%, var(--contour-major-color, #50689c) 28%) !important;
  font-size: 1.45cqh !important;
  letter-spacing: 0.08em !important;
  margin-top: 2.2cqh !important;
  opacity: 0.72 !important;
  text-transform: none !important;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .poster-location-line {
  color: color-mix(in srgb, var(--label-text-color, #f0d9bf) 82%, var(--route-color, #f0b15f) 18%) !important;
  opacity: 0.88 !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-meta-line {
  display: none !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-footer {
  display: flex !important;
  background: transparent !important;
  box-shadow: none !important;
  color: color-mix(in srgb, var(--label-text-color, #e7ecfb) 72%, transparent) !important;
  pointer-events: none;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-footer .poster-stats,
.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .poster-footer .poster-mark {
  display: none !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-footer-note {
  top: auto;
  bottom: calc(2.6cqh + var(--print-bleed, 0px));
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  white-space: pre-line;
  text-align: left !important;
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 1.18cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.08em !important;
  line-height: 1.45 !important;
  opacity: 0.78 !important;
  text-transform: none !important;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-footer-note::first-line {
  color: color-mix(in srgb, var(--label-text-color, #e7ecfb) 76%, transparent);
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-star-field {
  inset: 0;
  opacity: 1;
  color: color-mix(in srgb, var(--label-text-color, #e7ecfb) 82%, transparent);
  filter: drop-shadow(0 0 0.35cqh color-mix(in srgb, currentColor 38%, transparent));
  background-image:
    radial-gradient(circle at 4% 28%, currentColor 0 0.12cqw, transparent 0.17cqw),
    radial-gradient(circle at 6% 7%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 7% 78%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 12% 55%, var(--route-color, #e8c66a) 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 15% 8%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 18% 62%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 22% 24%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 26% 42%, currentColor 0 0.065cqw, transparent 0.11cqw),
    radial-gradient(circle at 31% 15%, currentColor 0 0.13cqw, transparent 0.19cqw),
    radial-gradient(circle at 35% 17%, currentColor 0 0.075cqw, transparent 0.12cqw),
    radial-gradient(circle at 38% 37%, var(--route-color, #e8c66a) 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 43% 31%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 49% 7%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 50% 62%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 55% 44%, currentColor 0 0.09cqw, transparent 0.14cqw),
    radial-gradient(circle at 59% 72%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 62% 22%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 66% 7%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 69% 37%, currentColor 0 0.14cqw, transparent 0.2cqw),
    radial-gradient(circle at 72% 52%, var(--route-color, #e8c66a) 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 75% 12%, currentColor 0 0.085cqw, transparent 0.13cqw),
    radial-gradient(circle at 78% 52%, currentColor 0 0.075cqw, transparent 0.12cqw),
    radial-gradient(circle at 82% 29%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 86% 72%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 91% 18%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 93% 67%, currentColor 0 0.13cqw, transparent 0.19cqw),
    radial-gradient(circle at 96% 44%, currentColor 0 0.09cqw, transparent 0.14cqw);
}

.poster-composition--darksky-stars[data-theme="dark-sky"] .composition-star-field {
  z-index: 12;
  color: color-mix(in srgb, var(--label-text-color, #e7ecfb) 94%, transparent);
  filter: drop-shadow(0 0 0.42cqh color-mix(in srgb, currentColor 42%, transparent));
  background-image:
    radial-gradient(circle at 3% 20%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 5% 51%, currentColor 0 0.14cqw, transparent 0.2cqw),
    radial-gradient(circle at 7% 78%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 10% 38%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 13% 6%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 16% 44%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 19% 26%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 21% 70%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 25% 16%, currentColor 0 0.13cqw, transparent 0.19cqw),
    radial-gradient(circle at 29% 31%, currentColor 0 0.06cqw, transparent 0.11cqw),
    radial-gradient(circle at 33% 62%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 36% 12%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 39% 40%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 43% 23%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 47% 56%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 51% 7%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 53% 37%, var(--route-color, #e8c66a) 0 0.08cqw, transparent 0.14cqw),
    radial-gradient(circle at 57% 76%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 61% 21%, currentColor 0 0.09cqw, transparent 0.14cqw),
    radial-gradient(circle at 64% 44%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 68% 10%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 70% 60%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 73% 32%, currentColor 0 0.15cqw, transparent 0.21cqw),
    radial-gradient(circle at 77% 15%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 80% 48%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 83% 4%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 86% 72%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 89% 28%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 92% 12%, currentColor 0 0.13cqw, transparent 0.19cqw),
    radial-gradient(circle at 95% 43%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 97% 68%, currentColor 0 0.11cqw, transparent 0.17cqw);
}

.poster-composition--darksky-stars[data-theme="copper-night"] .composition-star-field {
  z-index: 13;
  inset: 0 0 30% 0;
  color: color-mix(in srgb, var(--route-color, #f0b15f) 78%, var(--label-text-color, #f0d9bf) 22%);
  filter: drop-shadow(0 0 0.5cqh color-mix(in srgb, currentColor 52%, transparent));
  mix-blend-mode: normal;
  background-image:
    radial-gradient(circle at 3% 20%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 5% 51%, currentColor 0 0.14cqw, transparent 0.2cqw),
    radial-gradient(circle at 7% 78%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 10% 38%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 13% 6%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 16% 44%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 19% 26%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 21% 70%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 25% 16%, currentColor 0 0.13cqw, transparent 0.19cqw),
    radial-gradient(circle at 29% 31%, currentColor 0 0.06cqw, transparent 0.11cqw),
    radial-gradient(circle at 33% 62%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 36% 12%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 39% 40%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 43% 23%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 47% 56%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 51% 7%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 53% 37%, var(--route-color, #f0b15f) 0 0.08cqw, transparent 0.14cqw),
    radial-gradient(circle at 57% 76%, currentColor 0 0.11cqw, transparent 0.17cqw),
    radial-gradient(circle at 61% 21%, currentColor 0 0.09cqw, transparent 0.14cqw),
    radial-gradient(circle at 64% 44%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 68% 10%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 70% 60%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 73% 32%, currentColor 0 0.15cqw, transparent 0.21cqw),
    radial-gradient(circle at 77% 15%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 80% 48%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 83% 4%, currentColor 0 0.07cqw, transparent 0.12cqw),
    radial-gradient(circle at 86% 72%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 89% 28%, currentColor 0 0.08cqw, transparent 0.13cqw),
    radial-gradient(circle at 92% 12%, currentColor 0 0.13cqw, transparent 0.19cqw),
    radial-gradient(circle at 95% 43%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 97% 68%, currentColor 0 0.11cqw, transparent 0.17cqw);
}

.poster-composition--darksky-stars[data-theme="copper-night"] .composition-star-field::before {
  content: "";
  position: absolute;
  inset: 0;
  color: var(--route-color, #f0b15f);
  background-image:
    radial-gradient(circle at 6% 18%, currentColor 0 0.13cqw, transparent 0.2cqw),
    radial-gradient(circle at 13% 31%, currentColor 0 0.10cqw, transparent 0.16cqw),
    radial-gradient(circle at 18% 9%, currentColor 0 0.08cqw, transparent 0.14cqw),
    radial-gradient(circle at 24% 51%, currentColor 0 0.11cqw, transparent 0.18cqw),
    radial-gradient(circle at 31% 36%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 36% 22%, currentColor 0 0.12cqw, transparent 0.19cqw),
    radial-gradient(circle at 43% 11%, currentColor 0 0.08cqw, transparent 0.14cqw),
    radial-gradient(circle at 48% 66%, currentColor 0 0.10cqw, transparent 0.17cqw),
    radial-gradient(circle at 54% 28%, currentColor 0 0.13cqw, transparent 0.2cqw),
    radial-gradient(circle at 60% 49%, currentColor 0 0.09cqw, transparent 0.15cqw),
    radial-gradient(circle at 67% 18%, currentColor 0 0.11cqw, transparent 0.18cqw),
    radial-gradient(circle at 72% 39%, currentColor 0 0.14cqw, transparent 0.21cqw),
    radial-gradient(circle at 79% 8%, currentColor 0 0.08cqw, transparent 0.14cqw),
    radial-gradient(circle at 84% 57%, currentColor 0 0.10cqw, transparent 0.17cqw),
    radial-gradient(circle at 90% 25%, currentColor 0 0.12cqw, transparent 0.19cqw),
    radial-gradient(circle at 96% 41%, currentColor 0 0.09cqw, transparent 0.15cqw);
  opacity: 0.72;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .composition-star-field::after {
  content: none;
  position: absolute;
  inset: 0;
  color: color-mix(in srgb, var(--route-color, #f0b15f) 68%, var(--label-text-color, #f0d9bf) 32%);
  background-image:
    radial-gradient(circle at 21% 23%, currentColor 0 0.12cqw, transparent 0.18cqw),
    radial-gradient(circle at 68% 37%, currentColor 0 0.085cqw, transparent 0.14cqw),
    radial-gradient(circle at 42% 71%, var(--route-color, #f0b15f) 0 0.105cqw, transparent 0.16cqw),
    radial-gradient(circle at 83% 14%, currentColor 0 0.15cqw, transparent 0.22cqw),
    radial-gradient(circle at 13% 82%, currentColor 0 0.075cqw, transparent 0.13cqw);
  background-position:
    0 0,
    5.2cqw 2.4cqh,
    2.8cqw 5.6cqh,
    8.6cqw 1.2cqh,
    1.4cqw 7.8cqh;
  background-repeat: repeat;
  background-size:
    4cqw 4cqh,
    5cqw 5cqh,
    6cqw 6cqh,
    7cqw 7cqh,
    4cqw 5cqh;
  opacity: 1;
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-star-constellation {
  z-index: 13;
  top: calc(6.4cqh + var(--print-bleed, 0px));
  right: calc(10cqw + var(--print-bleed, 0px));
  bottom: auto;
  left: calc(20cqw + var(--print-bleed, 0px));
  height: 15.5cqh;
  color: color-mix(in srgb, var(--label-text-color, #e7ecfb) 76%, transparent);
  opacity: 0.9;
}

.poster-composition--darksky-stars[data-theme="dark-sky"] .composition-star-constellation {
  top: calc(2.9cqh + var(--print-bleed, 0px));
  right: calc(9cqw + var(--print-bleed, 0px));
  left: calc(24cqw + var(--print-bleed, 0px));
  height: 13.5cqh;
  opacity: 0.98;
}

.star-constellation-shape--summit {
  display: none;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .star-constellation-shape--horizon {
  display: none;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .star-constellation-shape--summit {
  display: inline;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .composition-star-constellation {
  z-index: 15;
  top: calc(7.2cqh + var(--print-bleed, 0px));
  right: auto;
  left: calc(26cqw + var(--print-bleed, 0px));
  width: 56cqw;
  height: 36cqh;
  color: color-mix(in srgb, var(--route-color, #f0b15f) 76%, var(--label-text-color, #f0d9bf) 24%);
  opacity: 0.98;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .star-constellation-line {
  stroke-width: 0.42;
  opacity: 0.88;
}

.poster-composition--darksky-stars[data-theme="copper-night"] .star-constellation-line--secondary {
  opacity: 0.5;
}

.star-constellation-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 0.22;
  opacity: 0.62;
  vector-effect: non-scaling-stroke;
}

.star-constellation-line--secondary {
  opacity: 0.36;
}

.star-constellation-points {
  fill: currentColor;
  filter: drop-shadow(0 0 0.28cqh color-mix(in srgb, currentColor 52%, transparent));
}

.poster-composition--darksky-stars:is([data-theme="dark-sky"], [data-theme="copper-night"]) .composition-darksky-ridge {
  top: 87%;
  height: 9.5cqh;
  opacity: 0.22;
  filter: none;
}

.composition-darksky-ridge {
  position: absolute;
  z-index: 7;
  left: 0;
  right: 0;
  top: 35.5%;
  height: 13.4cqh;
  pointer-events: none;
  color: var(--label-text-color, #e7ecfb);
  opacity: 0.78;
  filter: drop-shadow(0 -0.25cqh 1.1cqh color-mix(in srgb, var(--route-color, #e8c66a) 14%, transparent));
}

.darksky-ridge-line {
  stroke: none;
}

.darksky-ridge-line--back {
  fill: color-mix(in srgb, var(--contour-major-color, #50689c) 34%, var(--background-color, #070c1e) 66%);
  opacity: 0.48;
}

.darksky-ridge-line--front {
  fill: color-mix(in srgb, var(--background-color, #070c1e) 78%, #000 22%);
  opacity: 0.92;
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

.poster-composition--modernist-block .poster-header {
  flex: 0 0 34.2%;
  height: 34.2%;
  min-height: 34.2%;
  justify-content: center !important;
  align-items: flex-start !important;
  gap: 0.72cqh !important;
  background: var(--composition-paper, #f2e8da) !important;
  color: var(--label-text-color, #15130f) !important;
}

.poster-composition--modernist-block .composition-modernist-accent {
  position: absolute;
  z-index: 0;
  left: 0;
  top: 0;
  bottom: 0;
  width: 14.6cqw;
  pointer-events: none;
  background: var(--label-bg-color, #e2483d);
}

.poster-composition--modernist-block .composition-kicker {
  position: relative;
  z-index: 1;
  order: 1;
  margin: 0;
  color: color-mix(in srgb, var(--label-text-color, #15130f) 56%, transparent) !important;
  font-family: var(--composition-body-font, inherit) !important;
  font-size: 1.58cqh !important;
  font-weight: 600 !important;
  letter-spacing: 0.34em !important;
  line-height: 1 !important;
}

.poster-composition--modernist-block .poster-rule {
  position: relative;
  z-index: 1;
  order: 3;
  width: 100%;
  height: 0.18cqh !important;
  margin: 1.35cqh 0 1.05cqh !important;
  background: var(--label-text-color, #15130f) !important;
  opacity: 0.92 !important;
}

.poster-composition--modernist-block .poster-trail-name {
  position: relative;
  z-index: 1;
  order: 2;
  margin: 0;
  max-width: 100%;
  color: var(--label-text-color, #15130f) !important;
  font-family: var(--composition-title-font, 'Big Shoulders Display'), sans-serif !important;
  font-size: min(max(var(--trail-title-size, 8.9cqh), 8.9cqh), 10.4cqh) !important;
  font-weight: 900 !important;
  letter-spacing: 0 !important;
  line-height: 0.86 !important;
  text-transform: uppercase !important;
}

.poster-composition--modernist-block .poster-location-line {
  position: relative;
  z-index: 1;
  order: 4;
  max-width: 57%;
  margin: 0;
  color: color-mix(in srgb, var(--label-text-color, #15130f) 62%, transparent) !important;
  font-family: var(--composition-body-font, inherit) !important;
  font-size: 1.95cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0 !important;
  line-height: 1.3 !important;
  text-transform: none !important;
  white-space: pre-line !important;
}

.poster-composition--modernist-block .composition-meta-line {
  position: absolute;
  z-index: 1;
  right: var(--composition-rule-right);
  bottom: calc(4.2cqh + var(--print-bleed, 0px));
  width: 18cqw !important;
  color: var(--label-text-color, #15130f) !important;
  font-family: var(--composition-body-font, inherit) !important;
  font-size: 1.9cqh !important;
  font-weight: 800 !important;
  letter-spacing: 0.02em !important;
  line-height: 1.45 !important;
  opacity: 1 !important;
  text-align: right !important;
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: pre-line !important;
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

.poster-composition--modernist-block[data-theme="blackline"] .poster-header {
  background: #f7f7f4 !important;
  color: #000 !important;
}

.poster-composition--modernist-block[data-theme="blackline"] .poster-rule {
  background: #000 !important;
}

.poster-composition--modernist-block[data-theme="blackline"] .composition-kicker,
.poster-composition--modernist-block[data-theme="blackline"] .poster-trail-name,
.poster-composition--modernist-block[data-theme="blackline"] .poster-location-line,
.poster-composition--modernist-block[data-theme="blackline"] .composition-meta-line {
  color: #000 !important;
}

.poster-composition--modernist-block[data-theme="blackline"] .poster-trail-name {
  font-size: min(max(var(--trail-title-size, 12.2cqh), 12.2cqh), 13.2cqh) !important;
  line-height: 0.82 !important;
}

.poster-composition--modernist-block[data-theme="blackline"] [data-testid="poster-map"]::before {
  display: none !important;
}

.poster-composition--splits-grid .poster-footer-rule,
.poster-composition--blueprint-strava .poster-footer-rule,
.poster-composition--bib-numerals .poster-footer-rule {
  height: 0;
  background: transparent !important;
  border-top: 1px dashed currentColor;
}

.poster-composition--bib-numerals {
  background: var(--composition-paper, #f0ede5) !important;
}

.composition-bib-paper {
  position: absolute;
  z-index: 1;
  inset: calc(1.15cqh + var(--print-bleed, 0px)) calc(3.8cqw + var(--print-bleed, 0px));
  pointer-events: none;
  border: 1px dashed color-mix(in srgb, var(--label-text-color, #14264a) 24%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--route-color, #e0322c) 4%, transparent) 0 1px, transparent 1px) 0 0 / 8cqw 100%,
    color-mix(in srgb, var(--composition-paper, #f0ede5) 90%, #fff 10%);
  opacity: 0.46;
}

.composition-bib-topline {
  position: absolute;
  z-index: 12;
  top: calc(7.55cqh + var(--print-bleed, 0px));
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  color: var(--label-text-color, #14264a);
  font-family: "IBM Plex Mono", "Roboto Mono", monospace;
  font-size: 1.55cqh;
  font-weight: 500;
  letter-spacing: 0.42em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.composition-bib-ghost {
  position: absolute;
  z-index: 6;
  top: 63.5cqh;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  color: color-mix(in srgb, var(--label-text-color, #14264a) 18%, #b9bec4);
  font-family: "Bebas Neue", "Arial Narrow", sans-serif;
  font-size: 33.5cqh;
  font-weight: 900;
  line-height: 0.78;
  letter-spacing: 0.015em;
  opacity: 0.34;
  mix-blend-mode: multiply;
}

.composition-bib-pin-hole {
  position: absolute;
  width: 1.25cqw;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--label-text-color, #14264a) 42%, transparent) 0 38%, transparent 39%),
    color-mix(in srgb, var(--composition-paper, #f4f1ea) 72%, transparent);
  box-shadow: inset 0 0.12cqh 0.3cqh rgba(20, 38, 74, 0.12);
}

.composition-bib-pin-hole--tl {
  top: 2.2cqh;
  left: 3.2cqw;
}

.composition-bib-pin-hole--tr {
  top: 2.2cqh;
  right: 3.2cqw;
}

.composition-bib-pin-hole--br {
  right: 3.2cqw;
  bottom: 2.2cqh;
}

.composition-bib-pin-hole--bl {
  bottom: 2.2cqh;
  left: 3.2cqw;
}

.composition-bib-tear-strip {
  position: absolute;
  z-index: 5;
  left: calc(8.8cqw + var(--print-bleed, 0px));
  right: calc(8.8cqw + var(--print-bleed, 0px));
  bottom: calc(9.2cqh + var(--print-bleed, 0px));
  height: 0.33cqh;
  pointer-events: none;
  background: var(--label-text-color, #14264a);
  opacity: 0.94;
}

.composition-bib-finish-headline {
  position: absolute;
  z-index: 12;
  left: 50%;
  top: calc(67.8cqh + var(--print-bleed, 0px));
  transform: translateX(-50%);
  display: flex;
  gap: 1.35cqw;
  align-items: baseline;
  justify-content: center;
  min-width: 0;
  padding: 0;
  pointer-events: none;
  color: var(--route-color, #e0322c);
  font-family: "IBM Plex Mono", "Roboto Mono", monospace;
  font-size: 1.9cqh;
  font-weight: 900;
  letter-spacing: 0.24em;
  line-height: 1;
  text-transform: uppercase;
  border: 0;
  background: transparent;
}

.composition-bib-finish-headline b {
  color: var(--route-color, #e0322c);
  font-family: "IBM Plex Mono", "Roboto Mono", monospace;
  font-size: 1em;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.poster-composition--bib-numerals .poster-header {
  flex: 0 0 29.2cqh !important;
  min-height: 29.2cqh !important;
  padding: 6.25cqh 7.4cqw 1.65cqh !important;
  border: 0;
  background: transparent !important;
  z-index: 8 !important;
}

.poster-composition--bib-numerals .poster-header::before,
.poster-composition--bib-numerals .poster-header::after {
  content: none;
  position: absolute;
  top: 1.6cqh;
  bottom: 1.4cqh;
  width: 0.22cqw;
  opacity: 0.28;
  background:
    repeating-linear-gradient(0deg, currentColor 0 0.42cqh, transparent 0.42cqh 0.92cqh);
}

.poster-composition--bib-numerals .poster-header::before {
  left: 5.6cqw;
}

.poster-composition--bib-numerals .poster-header::after {
  right: 5.6cqw;
}

.poster-composition--bib-numerals .composition-kicker {
  width: auto;
  padding: 0.18cqh 0.95cqw;
  color: var(--composition-paper, #fbfaf4) !important;
  background: var(--route-color, currentColor);
  border-radius: 0;
  font-family: "Atkinson Hyperlegible Next", "Inter", sans-serif !important;
  font-size: 0.7cqh !important;
  font-weight: 900 !important;
  letter-spacing: 0.22em !important;
  opacity: 1 !important;
}

.poster-composition--bib-numerals .poster-trail-name {
  position: relative;
  z-index: 9;
  color: var(--label-text-color, #14264a) !important;
  font-size: 11.6cqh !important;
  line-height: 0.78 !important;
  letter-spacing: 0.015em !important;
  text-transform: uppercase !important;
  max-width: 72cqw !important;
  text-wrap: balance;
  text-shadow: none !important;
}

.poster-composition--bib-numerals .poster-location-line {
  position: relative;
  z-index: 9;
  margin-top: 1.75cqh !important;
  max-width: 72cqw !important;
  font-family: "Atkinson Hyperlegible Next", "Inter", sans-serif !important;
  font-size: min(var(--location-size, 2.35cqh), 2.35cqh) !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
  text-transform: none !important;
  color: #687386 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

.poster-composition--bib-numerals .composition-meta-line {
  position: absolute;
  right: 7.4cqw;
  bottom: 1.45cqh;
  width: 18cqw !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 0.74cqh !important;
  font-weight: 700 !important;
  letter-spacing: 0.18em !important;
  text-align: right !important;
  opacity: 0.66 !important;
}

.poster-composition--bib-numerals [data-testid="poster-map"] {
  margin: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  z-index: 3;
}

.poster-composition--bib-numerals .poster-footer {
  flex: 0 0 9.6cqh !important;
  min-height: 9.6cqh !important;
  padding: 1.15cqh 8.8cqw 2.15cqh !important;
  border: 0;
  background: transparent !important;
  z-index: 9 !important;
}

.poster-composition--bib-numerals .poster-rule {
  display: none;
}

.poster-composition--bib-numerals .poster-footer-rule {
  display: none;
}

.composition-bib-data-footer {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  width: 100%;
  height: 100%;
  color: var(--label-text-color, #14264a);
  font-family: "IBM Plex Mono", "Roboto Mono", monospace;
  font-size: 2.08cqh;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: none;
}

.composition-bib-data-footer__item {
  display: block;
  white-space: nowrap;
}

.composition-bib-data-footer__item:nth-child(2) {
  text-align: center;
}

.composition-bib-data-footer__item:nth-child(3) {
  text-align: right;
}

.poster-composition--bib-numerals .composition-footer-note {
  top: 0.55cqh;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 0.62cqh !important;
  font-weight: 800 !important;
  letter-spacing: 0.28em !important;
  opacity: 0.52;
}

.poster-composition--splits-grid [data-testid="elevation-profile-band"] {
  border-top: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-bottom: 1px solid color-mix(in srgb, currentColor 16%, transparent);
  background-image:
    linear-gradient(color-mix(in srgb, currentColor 10%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, currentColor 8%, transparent) 1px, transparent 1px);
  background-size: 100% 50%, 10% 100%;
}

.poster-composition--splits-grid [data-testid="elevation-profile"] {
  opacity: 0.98;
  mix-blend-mode: screen;
}

.poster-composition--splits-grid[data-theme="splits-stats"] [data-testid="poster-map"],
.poster-composition--splits-grid[data-theme="night-ride"] [data-testid="poster-map"] {
  border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-bottom: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, currentColor 10%, transparent),
    inset 0 0 4.2cqh color-mix(in srgb, var(--route-color, #ff5a36) 8%, transparent) !important;
}

.poster-composition--splits-grid[data-theme="night-ride"] [data-testid="poster-map"] {
  border-top: 0 !important;
  border-bottom: 0 !important;
  box-shadow: none !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .poster-header,
.poster-composition--splits-grid[data-theme="night-ride"] .poster-header {
  background: transparent !important;
  box-shadow: none !important;
  gap: 0.68cqh !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .poster-trail-name,
.poster-composition--splits-grid[data-theme="night-ride"] .poster-trail-name,
.poster-composition--splits-grid[data-theme="splits-stats"] .chrome-grid-block--title,
.poster-composition--splits-grid[data-theme="night-ride"] .chrome-grid-block--title {
  font-weight: 820 !important;
  font-size: clamp(6.6cqh, var(--trail-title-size, 8.2cqh), 8.8cqh) !important;
  letter-spacing: 0.055em !important;
  line-height: 0.92 !important;
  text-transform: uppercase !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .poster-location-line,
.poster-composition--splits-grid[data-theme="night-ride"] .poster-location-line {
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 1.28cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.18em !important;
  color: color-mix(in srgb, var(--label-text-color, currentColor) 66%, transparent) !important;
  opacity: 1 !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .poster-rule,
.poster-composition--splits-grid[data-theme="night-ride"] .poster-rule {
  display: none !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .chrome-grid-block--stat::first-line,
.poster-composition--splits-grid[data-theme="night-ride"] .chrome-grid-block--stat::first-line {
  color: var(--route-color, currentColor);
}

.poster-composition--splits-grid[data-theme="night-ride"] [data-testid="elevation-profile-band"] {
  border-top: 0 !important;
  border-bottom: 0 !important;
  background-color: transparent !important;
  background-image: none !important;
  padding-inline: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  box-sizing: border-box !important;
}

.poster-composition--splits-grid[data-theme="night-ride"] [data-testid="elevation-profile"] {
  height: 46% !important;
  margin-top: 5.3cqh !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] [data-testid="elevation-profile-band"] {
  border-top: 0 !important;
  border-bottom: 0 !important;
  background-color: transparent !important;
  background-image: none !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .composition-profile-labels {
  inset: 0.75cqh 6.8cqw 2.25cqh;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .poster-footer {
  padding: 0.95cqh calc(6.2cqw + var(--print-bleed, 0px)) calc(4.5cqh + var(--print-bleed, 0px)) !important;
  align-items: flex-end !important;
}

.poster-composition--splits-grid[data-theme="splits-stats"] .poster-footer-rule {
  top: 0 !important;
  display: block !important;
  left: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  right: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  border-top-style: solid !important;
  border-top-color: color-mix(in srgb, currentColor 24%, transparent) !important;
  opacity: 1 !important;
}

.poster-composition--splits-grid[data-theme="night-ride"] .composition-profile-labels {
  inset: 0.65cqh 6.8cqw 2.2cqh;
}

.poster-composition--splits-grid[data-theme="night-ride"] .poster-footer {
  background: transparent !important;
  padding: 0.9cqh calc(6.35cqw + var(--print-bleed, 0px)) calc(4.4cqh + var(--print-bleed, 0px)) !important;
  align-items: flex-end !important;
}

.poster-composition--splits-grid[data-theme="night-ride"] .poster-footer-rule {
  top: 0 !important;
  display: block !important;
  left: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  right: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  border-top-style: solid !important;
  border-top-color: color-mix(in srgb, currentColor 24%, transparent) !important;
  opacity: 1 !important;
}

.poster-composition--splits-grid[data-theme="night-ride"] .composition-technical-data-footer {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 2.2cqw;
  align-items: end;
}

.poster-composition--splits-grid[data-theme="night-ride"] .composition-technical-data-item {
  padding-left: 1.6cqw;
  border-left-color: color-mix(in srgb, currentColor 24%, transparent);
}

.poster-composition--splits-grid[data-theme="night-ride"] .composition-technical-data-item span {
  margin-bottom: 1.34cqh;
  font-size: 1.16cqh;
  letter-spacing: 0.2em;
  color: color-mix(in srgb, currentColor 64%, transparent);
}

.poster-composition--splits-grid[data-theme="night-ride"] .composition-technical-data-item strong {
  font-size: clamp(2.05cqh, 2.32cqh, 2.52cqh);
  font-weight: 840;
  letter-spacing: 0.01em;
}

.composition-profile-labels {
  position: absolute;
  z-index: 3;
  inset: 1.05cqh 6.8cqw 1cqh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  color: var(--label-text-color, currentColor);
  font-family: "IBM Plex Mono", monospace;
  text-transform: uppercase;
}

.composition-profile-labels__header,
.composition-profile-labels__axis {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.composition-profile-labels__header span,
.composition-profile-labels__axis span {
  font-size: 1.08cqh;
  font-weight: 500;
  letter-spacing: 0.24em;
  color: color-mix(in srgb, currentColor 58%, transparent);
}

.composition-profile-labels__header strong {
  font-size: 1.15cqh;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--route-color, currentColor);
}

.poster-composition--splits-grid .composition-technical-data-footer {
  grid-template-columns: 0.95fr 0.95fr 1.45fr 1.12fr;
  column-gap: 0.9cqw;
}

.poster-composition--splits-grid .composition-technical-data-item {
  padding-left: 0.95cqw;
}

.poster-composition--splits-grid .composition-technical-data-item strong {
  font-size: clamp(1.45cqh, 1.78cqh, 1.95cqh);
  letter-spacing: 0;
}

.poster-composition--travel-banner [data-testid="poster-map"] {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  border: 0 !important;
  box-shadow: inset 0 -1px 0 color-mix(in srgb, currentColor 18%, transparent) !important;
}

.composition-travel-sun {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 63%;
  z-index: 4;
  pointer-events: none;
  color: var(--route-color, #c4561f);
  mix-blend-mode: multiply;
  opacity: 0.74;
}

.composition-travel-sun__disk {
  fill: color-mix(in srgb, #d89a55 38%, transparent);
  stroke: none;
}

.composition-travel-sun__arc,
.composition-travel-sun__horizon {
  fill: color-mix(in srgb, #bf7236 36%, transparent);
  stroke: none;
  vector-effect: non-scaling-stroke;
}

.composition-travel-sun__arc--wide {
  opacity: 0.38;
}

.composition-travel-sun__arc--mid {
  opacity: 0.34;
}

.composition-travel-sun__arc--inner {
  opacity: 0.30;
}

.composition-travel-sun__horizon {
  display: none;
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .composition-travel-sun {
  height: 76%;
  opacity: 0.78;
  color: var(--contour-major-color, #be624a);
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .composition-travel-sun__disk {
  fill: color-mix(in srgb, #d98270 28%, transparent);
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .composition-travel-sun__arc {
  fill: color-mix(in srgb, #be624a 24%, transparent);
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .composition-travel-sun__arc--wide {
  opacity: 0.48;
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .composition-travel-sun__arc--mid {
  opacity: 0.40;
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .composition-travel-sun__arc--inner {
  opacity: 0.36;
}

.composition-sea-chart-art {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  color: var(--label-text-color, #1d2a36);
  opacity: 0.92;
  mix-blend-mode: multiply;
}

.composition-sea-chart-art path,
.composition-sea-chart-art circle,
.composition-sea-chart-art rect {
  fill: none;
  stroke: currentColor;
  vector-effect: non-scaling-stroke;
}

.sea-chart-neatline {
  opacity: 0.82;
  stroke-width: 0.95;
}

.sea-chart-neatline--inner {
  opacity: 0.52;
  stroke-width: 0.5;
}

.composition-sea-chart-art text {
  font-family: "IBM Plex Mono", monospace;
  font-size: 3.1px;
  letter-spacing: 0.08em;
  fill: currentColor;
  stroke: none;
}

.sea-chart-graticule {
  opacity: 0.48;
}

.sea-chart-graticule path {
  stroke-width: 0.5;
}

.sea-chart-rhumb-lines {
  opacity: 0.66;
}

.sea-chart-rhumb-lines path {
  stroke-width: 0.72;
  stroke-dasharray: 2 2.4;
}

.sea-chart-depth-bands {
  color: var(--water-color, #d7e7e0);
  opacity: 0.78;
}

.sea-chart-depth-bands path {
  stroke-width: 0.86;
}

.sea-chart-soundings {
  color: color-mix(in srgb, var(--label-text-color, #1d2a36) 84%, var(--water-color, #d7e7e0));
  opacity: 0.84;
}

.sea-chart-soundings circle {
  fill: currentColor;
  stroke: none;
}

.sea-chart-rose {
  color: var(--route-color, #a6245d);
  opacity: 0.96;
  filter: drop-shadow(0 0 0.18cqh color-mix(in srgb, currentColor 20%, transparent));
}

.sea-chart-rose circle {
  stroke-width: 0.9;
}

.sea-chart-rose path {
  stroke-width: 0.82;
}

.sea-chart-rose text {
  text-anchor: middle;
  font-size: 3px;
  font-weight: 700;
}

.composition-transit-diagram-art {
  position: absolute;
  left: calc(5.6cqw + var(--print-bleed, 0px));
  right: calc(5.6cqw + var(--print-bleed, 0px));
  bottom: calc(2.1cqh + var(--print-bleed, 0px));
  z-index: 12;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2cqw;
  pointer-events: none;
  color: var(--label-text-color, #181818);
  font-family: "IBM Plex Mono", monospace;
}

.transit-diagram-route-stations {
  position: absolute;
  inset: 0 0 17%;
  z-index: 13;
  pointer-events: none;
  color: var(--route-color, #7a1fa2);
  font-family: "IBM Plex Mono", monospace;
}

.transit-diagram-route-stations .transit-station {
  fill: var(--composition-paper, #f7f5f0);
  stroke: currentColor;
  stroke-width: 0.65;
  vector-effect: non-scaling-stroke;
}

.transit-diagram-route-stations .transit-station--secondary {
  stroke: var(--contour-major-color, #1f8a5b);
}

.transit-diagram-route-stations text {
  fill: var(--label-text-color, #181818);
  stroke: var(--composition-paper, #f7f5f0);
  stroke-width: 0.32;
  paint-order: stroke;
  font-size: 1.45px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.transit-diagram-legend,
.transit-diagram-station-key {
  display: inline-flex;
  align-items: center;
  gap: 1.1cqw;
  min-height: 2.25cqh;
  padding: 0.5cqh 1.3cqw;
  background: color-mix(in srgb, var(--composition-paper, #f7f5f0) 86%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  box-shadow: 0 0 0 0.22cqh color-mix(in srgb, var(--composition-paper, #f7f5f0) 54%, transparent);
}

.transit-diagram-badge {
  display: grid;
  place-items: center;
  width: 2.4cqh;
  height: 2.4cqh;
  border-radius: 999px;
  color: var(--composition-paper, #f7f5f0);
  background: var(--route-color, #7a1fa2);
  font-family: "IBM Plex Sans", sans-serif;
  font-size: 0.88cqh;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.transit-diagram-line-key {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 10.5cqw;
  height: 1.6cqh;
}

.transit-diagram-line-key::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 0.42cqh;
  border-radius: 999px;
  background: var(--route-color, #7a1fa2);
  transform: translateY(-50%);
}

.transit-diagram-line-key i,
.transit-diagram-line-key b,
.transit-diagram-station-key i {
  position: relative;
  z-index: 1;
  display: inline-block;
  width: 1.15cqh;
  height: 1.15cqh;
  border-radius: 999px;
  background: var(--composition-paper, #f7f5f0);
  border: 0.28cqh solid var(--route-color, #7a1fa2);
}

.transit-diagram-line-key b {
  margin-left: auto;
  margin-right: auto;
  border-color: var(--contour-major-color, #1f8a5b);
}

.transit-diagram-line-key i:last-child {
  margin-left: auto;
}

.transit-diagram-legend-text,
.transit-diagram-station-key span {
  font-size: 0.66cqh;
  font-weight: 800;
  letter-spacing: 0.13em;
  white-space: nowrap;
}

.transit-diagram-station-key span {
  display: inline-flex;
  align-items: center;
  gap: 0.55cqw;
}

.transit-diagram-station-key span:first-child i,
.transit-diagram-station-key span:last-child i {
  width: 1.35cqh;
  height: 1.35cqh;
}

.composition-plein-air-deckle {
  position: absolute;
  inset: calc(1.15cqh + var(--print-bleed, 0px)) calc(1.35cqw + var(--print-bleed, 0px));
  z-index: 8;
  pointer-events: none;
  color: color-mix(in srgb, var(--label-text-color, #33302a) 48%, transparent);
  opacity: 0.9;
}

.composition-plein-air-deckle::before,
.composition-plein-air-deckle::after {
  content: "";
  position: absolute;
  pointer-events: none;
  opacity: 0.48;
}

.composition-plein-air-deckle::before {
  inset: 0.98cqh 1.05cqw;
  border: 1px solid color-mix(in srgb, currentColor 50%, transparent);
  border-radius: 1.7cqw 1.2cqw 1.55cqw 1.3cqw;
}

.composition-plein-air-deckle::after {
  inset: 0.3cqh 0.34cqw;
  background:
    linear-gradient(90deg, transparent 0 8%, currentColor 8% 8.2%, transparent 8.2% 91.8%, currentColor 91.8% 92%, transparent 92%) top / 100% 1px no-repeat,
    linear-gradient(90deg, transparent 0 7%, currentColor 7% 7.18%, transparent 7.18% 93%, currentColor 93% 93.18%, transparent 93.18%) bottom / 100% 1px no-repeat,
    linear-gradient(0deg, transparent 0 9%, currentColor 9% 9.18%, transparent 9.18% 91%, currentColor 91% 91.18%, transparent 91.18%) left / 1px 100% no-repeat,
    linear-gradient(0deg, transparent 0 7%, currentColor 7% 7.18%, transparent 7.18% 93%, currentColor 93% 93.18%, transparent 93.18%) right / 1px 100% no-repeat;
}

.plein-air-deckle-edge {
  position: absolute;
  display: block;
  pointer-events: none;
  color: currentColor;
  opacity: 0.92;
  filter: blur(0.12px);
}

.plein-air-deckle-edge--top,
.plein-air-deckle-edge--bottom {
  left: 0.3cqw;
  right: 0.3cqw;
  height: 1.08cqh;
  background:
    radial-gradient(ellipse at 3% 46%, currentColor 0 0.07cqh, transparent 0.09cqh),
    radial-gradient(ellipse at 10% 62%, currentColor 0 0.1cqh, transparent 0.12cqh),
    radial-gradient(ellipse at 18% 42%, currentColor 0 0.06cqh, transparent 0.09cqh),
    radial-gradient(ellipse at 31% 54%, currentColor 0 0.11cqh, transparent 0.13cqh),
    radial-gradient(ellipse at 47% 44%, currentColor 0 0.07cqh, transparent 0.1cqh),
    radial-gradient(ellipse at 63% 58%, currentColor 0 0.1cqh, transparent 0.12cqh),
    radial-gradient(ellipse at 79% 46%, currentColor 0 0.07cqh, transparent 0.1cqh),
    radial-gradient(ellipse at 93% 60%, currentColor 0 0.1cqh, transparent 0.12cqh),
    linear-gradient(currentColor, currentColor) center / 100% 1px no-repeat;
}

.plein-air-deckle-edge--top {
  top: 0;
}

.plein-air-deckle-edge--bottom {
  bottom: 0;
  transform: scaleY(-1);
}

.plein-air-deckle-edge--left,
.plein-air-deckle-edge--right {
  top: 0.25cqh;
  bottom: 0.25cqh;
  width: 1.08cqw;
  background:
    radial-gradient(ellipse at 48% 4%, currentColor 0 0.07cqw, transparent 0.09cqw),
    radial-gradient(ellipse at 36% 13%, currentColor 0 0.1cqw, transparent 0.12cqw),
    radial-gradient(ellipse at 58% 24%, currentColor 0 0.06cqw, transparent 0.09cqw),
    radial-gradient(ellipse at 42% 37%, currentColor 0 0.1cqw, transparent 0.12cqw),
    radial-gradient(ellipse at 56% 51%, currentColor 0 0.07cqw, transparent 0.1cqw),
    radial-gradient(ellipse at 38% 68%, currentColor 0 0.1cqw, transparent 0.12cqw),
    radial-gradient(ellipse at 54% 82%, currentColor 0 0.07cqw, transparent 0.1cqw),
    radial-gradient(ellipse at 40% 94%, currentColor 0 0.1cqw, transparent 0.12cqw),
    linear-gradient(currentColor, currentColor) center / 1px 100% no-repeat;
}

.plein-air-deckle-edge--left {
  left: 0;
}

.plein-air-deckle-edge--right {
  right: 0;
  transform: scaleX(-1);
}

.composition-plein-air-palette {
  position: absolute;
  right: calc(5.4cqw + var(--print-bleed, 0px));
  bottom: calc(4.9cqh + var(--print-bleed, 0px));
  z-index: 13;
  display: flex;
  align-items: center;
  gap: 0.86cqw;
  pointer-events: none;
  opacity: 0.96;
}

.plein-air-palette-swatch {
  display: block;
  width: 2.18cqh;
  height: 2.18cqh;
  border-radius: 46% 54% 42% 58%;
  border: 1px solid color-mix(in srgb, var(--label-text-color, #33302a) 44%, transparent);
  box-shadow:
    0 0 0 0.18cqh color-mix(in srgb, var(--composition-paper, #f6f1e8) 78%, transparent),
    0 0.18cqh 0.5cqh color-mix(in srgb, var(--label-text-color, #33302a) 22%, transparent);
  mix-blend-mode: multiply;
}

.plein-air-palette-swatch--route {
  background: color-mix(in srgb, var(--route-color, #c2683f) 84%, var(--composition-paper, #f6f1e8));
}

.plein-air-palette-swatch--water {
  background: color-mix(in srgb, var(--water-color, #a9c2b4) 86%, var(--composition-paper, #f6f1e8));
}

.plein-air-palette-swatch--contour {
  background: color-mix(in srgb, var(--contour-color, #c0b59a) 92%, var(--composition-paper, #f6f1e8));
}

.poster-composition--park-quad[data-theme="classic-trail"] [data-testid="poster-map"] {
  border: 1px solid color-mix(in srgb, currentColor 42%, transparent) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent),
    inset 0 0 3.2cqh color-mix(in srgb, var(--water-color, #BCCAD2) 18%, transparent) !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-header {
  background:
    linear-gradient(90deg, transparent 0 12%, color-mix(in srgb, currentColor 14%, transparent) 12% calc(12% + 1px), transparent calc(12% + 1px)),
    linear-gradient(90deg, transparent 0 88%, color-mix(in srgb, currentColor 14%, transparent) 88% calc(88% + 1px), transparent calc(88% + 1px)),
    var(--label-bg-color, #EEEEEA) !important;
}

.composition-classic-trail-markers {
  position: absolute;
  inset: 0;
  z-index: 11;
  pointer-events: none;
  color: var(--label-text-color, #26313b);
}

.classic-trail-blaze,
.classic-trail-quad {
  position: absolute;
  pointer-events: none;
}

.classic-trail-blaze {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6.6cqw;
  height: 2.25cqh;
  padding: 0 0.8cqw;
  border: 1px solid color-mix(in srgb, var(--route-color, #2f536a) 64%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--label-bg-color, #eeeeea) 86%, transparent);
  color: var(--route-color, #2f536a);
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.62cqh;
  font-weight: 800;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
  box-shadow:
    0 0.3cqh 1.2cqh rgba(38, 49, 59, 0.08),
    inset 0 0 0 0.12cqw color-mix(in srgb, var(--label-bg-color, #eeeeea) 70%, transparent);
  opacity: 0.88;
}

.classic-trail-blaze--start {
  left: 6.4cqw;
  top: 20.8cqh;
  transform: rotate(-4deg);
}

.classic-trail-blaze--end {
  right: 6.7cqw;
  bottom: 16.4cqh;
  transform: rotate(3.2deg);
}

.classic-trail-quad {
  opacity: 0.48;
  background: var(--route-color, #2f536a);
}

.classic-trail-quad--top,
.classic-trail-quad--bottom {
  left: 14cqw;
  right: 14cqw;
  height: 1px;
}

.classic-trail-quad--top {
  top: 18.4cqh;
}

.classic-trail-quad--bottom {
  bottom: 15.2cqh;
}

.classic-trail-quad--left,
.classic-trail-quad--right {
  top: 22cqh;
  bottom: 18.4cqh;
  width: 1px;
}

.classic-trail-quad--left {
  left: 6.2cqw;
}

.classic-trail-quad--right {
  right: 6.2cqw;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-trail-name,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--title {
  color: var(--label-text-color, #26313B) !important;
  letter-spacing: 0.04em !important;
  line-height: 0.96 !important;
  text-shadow: 0 1px 0 color-mix(in srgb, var(--label-bg-color, #EEEEEA) 84%, transparent);
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-location-line,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--subtitle,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--occasion {
  color: color-mix(in srgb, currentColor 58%, transparent) !important;
  letter-spacing: 0.18em !important;
  text-transform: uppercase !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .classic-trail-map-label {
  position: absolute;
  z-index: 22;
  color: color-mix(in srgb, #26313b 68%, transparent);
  font-family: "IBM Plex Mono", "Roboto Mono", monospace;
  font-size: 0.92cqh;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
  pointer-events: none;
}

.poster-composition--park-quad[data-theme="classic-trail"] .classic-trail-map-label--coord {
  top: calc(2.1cqh + var(--print-bleed, 0px));
  left: calc(6.25cqw + var(--print-bleed, 0px));
}

.poster-composition--park-quad[data-theme="classic-trail"] .classic-trail-map-label--scale {
  right: calc(6.25cqw + var(--print-bleed, 0px));
  bottom: calc(17.8cqh + var(--print-bleed, 0px));
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-footer {
  background:
    repeating-linear-gradient(90deg, color-mix(in srgb, currentColor 7%, transparent) 0 1px, transparent 1px 6.4cqw),
    var(--label-bg-color, #EEEEEA) !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--stat::first-line {
  color: var(--route-color, currentColor);
}

.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--brand {
  opacity: 0.42;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] {
  background:
    linear-gradient(color-mix(in srgb, #243021 18%, transparent) 0 0) 0 0 / 100% 1px no-repeat,
    linear-gradient(color-mix(in srgb, #243021 18%, transparent) 0 0) 0 100% / 100% 1px no-repeat,
    var(--label-bg-color, #f0ecde) !important;
  gap: 0 !important;
  color: #243021 !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] [data-testid="poster-map"] {
  order: 0 !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  margin: calc(4.25cqh + var(--print-bleed, 0px)) calc(6.25cqw + var(--print-bleed, 0px)) 0 !important;
  border: 2px solid #243021 !important;
  background-color: var(--label-bg-color, #f0ecde) !important;
  box-shadow: none !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] [data-testid="poster-map"]::before {
  content: "";
  position: absolute;
  inset: -0.42cqh -0.42cqw;
  z-index: 22;
  pointer-events: none;
  background:
    linear-gradient(#243021 0 0) left top / 3.6cqw 0.32cqh no-repeat,
    linear-gradient(#243021 0 0) left top / 0.32cqw 3.6cqh no-repeat,
    linear-gradient(#243021 0 0) right top / 3.6cqw 0.32cqh no-repeat,
    linear-gradient(#243021 0 0) right top / 0.32cqw 3.6cqh no-repeat,
    linear-gradient(#243021 0 0) left bottom / 3.6cqw 0.32cqh no-repeat,
    linear-gradient(#243021 0 0) left bottom / 0.32cqw 3.6cqh no-repeat,
    linear-gradient(#243021 0 0) right bottom / 3.6cqw 0.32cqh no-repeat,
    linear-gradient(#243021 0 0) right bottom / 0.32cqw 3.6cqh no-repeat;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-heritage-map-label {
  position: absolute;
  z-index: 26;
  color: color-mix(in srgb, #243021 72%, transparent);
  font-family: "IBM Plex Mono", "Source Sans 3", monospace;
  font-size: 1.28cqh;
  line-height: 1;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  pointer-events: auto;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-heritage-map-label--coord {
  top: 2.15cqh;
  left: 2.35cqw;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-heritage-map-label--scale {
  right: 2.5cqw;
  bottom: 2.05cqh;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-ticks {
  position: absolute;
  inset: 0;
  z-index: 25;
  pointer-events: none;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick {
  position: absolute;
  max-width: 24cqw;
  color: color-mix(in srgb, #243021 76%, transparent);
  font-family: "IBM Plex Mono", "Source Sans 3", monospace;
  font-size: 0.72cqh;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick::before {
  content: "";
  position: absolute;
  width: 2.1cqw;
  height: 1.55cqh;
  border-color: #243021;
  opacity: 0.82;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--nw {
  top: 0.82cqh;
  left: 0.9cqw;
  padding-left: 2.75cqw;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--nw::before {
  left: 0;
  top: -0.18cqh;
  border-top: 0.24cqh solid;
  border-left: 0.24cqw solid;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--ne {
  top: 0.82cqh;
  right: 0.9cqw;
  padding-right: 2.75cqw;
  text-align: right;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--ne::before {
  right: 0;
  top: -0.18cqh;
  border-top: 0.24cqh solid;
  border-right: 0.24cqw solid;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--se {
  right: 0.9cqw;
  bottom: 0.82cqh;
  padding-right: 2.75cqw;
  text-align: right;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--se::before {
  right: 0;
  bottom: -0.18cqh;
  border-right: 0.24cqw solid;
  border-bottom: 0.24cqh solid;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--sw {
  left: 0.9cqw;
  bottom: 0.82cqh;
  padding-left: 2.75cqw;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .usgs-coordinate-tick--sw::before {
  left: 0;
  bottom: -0.18cqh;
  border-left: 0.24cqw solid;
  border-bottom: 0.24cqh solid;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-header {
  order: 1 !important;
  flex: 0 0 12.6cqh !important;
  min-height: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 calc(6.25cqw + var(--print-bleed, 0px)) !important;
  text-align: center !important;
  background: transparent !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-header::before,
.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-header::after {
  content: none !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .composition-kicker,
.poster-composition--park-quad[data-theme="usgs-vintage"] .composition-meta-line,
.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-rule {
  display: none !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-trail-name,
.poster-composition--park-quad[data-theme="usgs-vintage"] .chrome-grid-block--title {
  color: #243021 !important;
  font-family: "Libre Baskerville", Georgia, serif !important;
  font-size: min(var(--trail-title-size, 5.35cqh), 5.35cqh) !important;
  font-weight: 800 !important;
  line-height: 0.92 !important;
  letter-spacing: 0.01em !important;
  text-align: center !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
  text-shadow: 0 1px 0 color-mix(in srgb, var(--label-bg-color, #f0ecde) 72%, transparent);
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-location-line,
.poster-composition--park-quad[data-theme="usgs-vintage"] .chrome-grid-block--subtitle,
.poster-composition--park-quad[data-theme="usgs-vintage"] .chrome-grid-block--occasion {
  color: color-mix(in srgb, #617349 88%, #243021) !important;
  font-family: "IBM Plex Mono", "Source Sans 3", monospace !important;
  font-size: 1.15cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.23em !important;
  line-height: 1.1 !important;
  text-align: center !important;
  text-transform: uppercase !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-footer {
  order: 2 !important;
  flex: 0 0 calc(5.05cqh + var(--print-bleed, 0px)) !important;
  min-height: 0 !important;
  padding: 0 calc(6.25cqw + var(--print-bleed, 0px)) calc(2.8cqh + var(--print-bleed, 0px)) !important;
  background: transparent !important;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-footer::before,
.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-footer::after {
  content: "";
  position: absolute;
  bottom: calc(2.1cqh + var(--print-bleed, 0px));
  width: 3.8cqw;
  height: 2.4cqh;
  pointer-events: none;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-footer::before {
  left: calc(6.25cqw + var(--print-bleed, 0px));
  border-left: 0.32cqw solid #243021;
  border-bottom: 0.32cqh solid #243021;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-footer::after {
  right: calc(6.25cqw + var(--print-bleed, 0px));
  border-right: 0.32cqw solid #243021;
  border-bottom: 0.32cqh solid #243021;
}

.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-footer-rule,
.poster-composition--park-quad[data-theme="usgs-vintage"] .composition-footer-note,
.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-stats,
.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-date,
.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-coords,
.poster-composition--park-quad[data-theme="usgs-vintage"] .chrome-grid-band--footer {
  display: none !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] {
  background: var(--label-bg-color, #eeeeea) !important;
  gap: 0 !important;
  color: #26313b !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] [data-testid="poster-map"] {
  order: 0 !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  margin: calc(4.25cqh + var(--print-bleed, 0px)) calc(6.25cqw + var(--print-bleed, 0px)) 0 !important;
  border: 1.5px solid #26313b !important;
  background-color: var(--label-bg-color, #eeeeea) !important;
  box-shadow: none !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-header {
  order: 1 !important;
  flex: 0 0 12.6cqh !important;
  min-height: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 calc(6.25cqw + var(--print-bleed, 0px)) !important;
  text-align: center !important;
  background: transparent !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-header::before,
.poster-composition--park-quad[data-theme="classic-trail"] .poster-header::after,
.poster-composition--park-quad[data-theme="classic-trail"] .composition-kicker,
.poster-composition--park-quad[data-theme="classic-trail"] .composition-meta-line,
.poster-composition--park-quad[data-theme="classic-trail"] .poster-rule {
  display: none !important;
  content: none !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-trail-name,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--title {
  color: #26313b !important;
  font-family: "Libre Baskerville", Georgia, serif !important;
  font-size: min(var(--trail-title-size, 4.9cqh), 4.9cqh) !important;
  font-weight: 800 !important;
  line-height: 0.92 !important;
  letter-spacing: 0.015em !important;
  text-align: center !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-location-line,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--subtitle,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-block--occasion {
  color: color-mix(in srgb, #5f6e7e 88%, #26313b) !important;
  font-family: "IBM Plex Mono", "Source Sans 3", monospace !important;
  font-size: 1.12cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.22em !important;
  line-height: 1.1 !important;
  text-align: center !important;
  text-transform: uppercase !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-footer {
  order: 2 !important;
  flex: 0 0 calc(5.05cqh + var(--print-bleed, 0px)) !important;
  min-height: 0 !important;
  padding: 0 calc(6.25cqw + var(--print-bleed, 0px)) calc(2.8cqh + var(--print-bleed, 0px)) !important;
  background: transparent !important;
}

.poster-composition--park-quad[data-theme="classic-trail"] .poster-footer-rule,
.poster-composition--park-quad[data-theme="classic-trail"] .composition-footer-note,
.poster-composition--park-quad[data-theme="classic-trail"] .poster-stats,
.poster-composition--park-quad[data-theme="classic-trail"] .poster-mark,
.poster-composition--park-quad[data-theme="classic-trail"] .poster-date,
.poster-composition--park-quad[data-theme="classic-trail"] .poster-coords,
.poster-composition--park-quad[data-theme="classic-trail"] .chrome-grid-band--footer {
  display: none !important;
}

.poster-composition--travel-banner .poster-header {
  flex: 0 0 20.8% !important;
  min-height: 0 !important;
  justify-content: center !important;
  gap: 1.1cqh !important;
  background: var(--composition-paper, var(--label-bg-color, #f4ead3)) !important;
  border-top: 0.55cqh solid var(--route-color, currentColor);
}

.poster-composition--travel-banner[data-theme="midcentury-travel"] .poster-header {
  background: #F3EAD6 !important;
}

.poster-composition--travel-banner[data-theme="ranch-ochre"] .poster-header {
  background: #EDE2C6 !important;
}

.poster-composition--travel-banner[data-theme="daybreak-trace"] .poster-header {
  background: #F5E8E0 !important;
}

.poster-composition--travel-banner .poster-header::before {
  content: "VISIT";
  display: block;
  font-family: "IBM Plex Mono", "Source Sans 3", monospace;
  font-size: 1.75cqh;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--route-color, currentColor) 62%, #d75c2b);
  opacity: 0.9;
  text-align: center;
}

.poster-composition--travel-banner .composition-kicker {
  font-family: "IBM Plex Mono", "Source Sans 3", monospace !important;
  font-size: 1.75cqh !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  letter-spacing: 0.42em !important;
  text-transform: uppercase !important;
  color: var(--route-color, currentColor) !important;
  opacity: 0.88 !important;
  text-align: center !important;
}

.poster-composition--travel-banner .poster-trail-name {
  font-size: min(max(var(--trail-title-size, 9.4cqh), 9.4cqh), 10.5cqh) !important;
  line-height: 0.82 !important;
  letter-spacing: 0.01em !important;
  text-transform: uppercase !important;
  color: var(--route-color, currentColor) !important;
  text-shadow: none !important;
}

.poster-composition--travel-banner .poster-location-line {
  margin-top: 0.38cqh !important;
  font-family: "IBM Plex Mono", "Source Sans 3", monospace !important;
  font-size: 1.55cqh !important;
  letter-spacing: 0.26em !important;
  text-transform: uppercase !important;
  color: color-mix(in srgb, var(--route-color, currentColor) 62%, var(--label-text-color, currentColor)) !important;
  opacity: 0.72 !important;
  text-shadow: none !important;
}

.poster-composition--travel-banner .poster-footer,
.poster-composition--travel-banner .poster-stats,
.poster-composition--travel-banner .chrome-grid-band--footer {
  display: none !important;
}

.poster-composition--blueprint-grid .poster-header {
  border-top: 1px solid color-mix(in srgb, currentColor 32%, transparent);
}

.poster-composition--blueprint-grid .poster-trail-name {
  font-family: "IBM Plex Mono", monospace !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

.poster-composition--blueprint-strava .poster-trail-name {
  font-family: "Space Grotesk", "IBM Plex Sans", sans-serif !important;
  font-size: clamp(7.65cqh, var(--trail-title-size, 8.8cqh), 9.3cqh) !important;
  font-weight: 920 !important;
  line-height: 0.82 !important;
  letter-spacing: 0.035em !important;
  text-transform: uppercase !important;
}

.poster-composition--blueprint-strava .poster-header {
  z-index: 5 !important;
  border-top: 0 !important;
  background-color: transparent !important;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--label-text-color, currentColor) 15%, transparent) 0 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--label-text-color, currentColor) 15%, transparent) 0 1px, transparent 1px) !important;
  background-size: 8cqw 8cqh !important;
  background-position: 0 0 !important;
  box-shadow: none !important;
  align-items: flex-start !important;
  gap: 0.52cqh !important;
  padding-top: 0.72cqh !important;
  padding-bottom: 0.82cqh !important;
}

.poster-composition--blueprint-strava .poster-location-line {
  font-family: "IBM Plex Sans", sans-serif !important;
  font-size: 1.62cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
  text-transform: none !important;
  color: color-mix(in srgb, var(--label-text-color, currentColor) 68%, transparent) !important;
  opacity: 1 !important;
}

.poster-composition--blueprint-strava .poster-rule {
  display: none !important;
}

.poster-composition--blueprint-strava [data-testid="poster-map"] {
  border-color: color-mix(in srgb, var(--label-text-color, currentColor) 48%, transparent) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--label-text-color, currentColor) 14%, transparent),
    0 0 0 1px color-mix(in srgb, var(--label-text-color, currentColor) 10%, transparent) !important;
}

.poster-composition--blueprint-strava .blueprint-drafting-topline,
.poster-composition--blueprint-strava .blueprint-drafting-figure {
  position: absolute;
  z-index: 18;
  pointer-events: none;
  color: color-mix(in srgb, var(--label-text-color, #ddf7ec) 70%, transparent);
  font-family: "IBM Plex Mono", monospace;
  font-size: 1.12cqh;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.poster-composition--blueprint-strava .blueprint-drafting-topline {
  left: 5.2cqw;
  right: 5.2cqw;
  top: 4.9cqh;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.poster-composition--blueprint-strava .blueprint-drafting-figure {
  left: 6.9cqw;
  top: 8.45cqh;
}

.poster-composition--blueprint-strava .blueprint-sheet-neatline {
  display: none !important;
}

.poster-composition--blueprint-strava .logo-map,
.poster-composition--blueprint-strava .logo-header-right,
.poster-composition--blueprint-strava .poster-footer img {
  display: none !important;
}

.poster-composition--blueprint-strava .poster-footer {
  z-index: 5 !important;
  background-color: transparent !important;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--label-text-color, currentColor) 15%, transparent) 0 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--label-text-color, currentColor) 15%, transparent) 0 1px, transparent 1px) !important;
  background-size: 8cqw 8cqh !important;
  background-position: 0 0 !important;
  box-shadow: none !important;
}

.poster-composition--blueprint-strava[data-theme="blueprint-strava"] .poster-trail-name {
  font-size: clamp(8.9cqh, var(--trail-title-size, 10.35cqh), 10.7cqh) !important;
}

.poster-composition--blueprint-strava[data-theme="blueprint-strava"] .poster-location-line {
  font-size: 1.82cqh !important;
}

.poster-composition--blueprint-strava[data-theme="blueprint-strava"] .poster-footer-rule {
  top: 0 !important;
  display: block !important;
  left: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  right: calc(6.8cqw + var(--print-bleed, 0px)) !important;
  border-top-style: solid !important;
  border-top-color: color-mix(in srgb, currentColor 36%, transparent) !important;
  opacity: 1 !important;
}

.composition-technical-data-footer {
  width: 100%;
  display: grid;
  grid-template-columns: 0.92fr 0.92fr 1.32fr 1.08fr;
  column-gap: 1.25cqw;
  align-items: end;
  color: var(--label-text-color, currentColor);
  font-family: "IBM Plex Mono", monospace;
}

.composition-technical-data-item {
  min-width: 0;
  border-left: 1px solid color-mix(in srgb, currentColor 36%, transparent);
  padding-left: 1.25cqw;
}

.composition-technical-data-item:first-child {
  border-left: 0;
  padding-left: 0;
}

.composition-technical-data-item span,
.composition-technical-data-item strong {
  display: block;
  white-space: nowrap;
}

.composition-technical-data-item span {
  margin-bottom: 1.05cqh;
  font-size: 1.05cqh;
  font-weight: 400;
  letter-spacing: 0.22em;
  color: color-mix(in srgb, currentColor 62%, transparent);
}

.composition-technical-data-item strong {
  font-size: clamp(1.45cqh, 1.82cqh, 2.04cqh);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.poster-composition--blueprint-strava[data-theme="electric-atlas"] .poster-trail-name,
.poster-composition--blueprint-strava[data-theme="electric-atlas"] .chrome-grid-block--title {
  font-family: "Big Shoulders Display", "IBM Plex Sans", sans-serif !important;
  font-weight: 900 !important;
  letter-spacing: 0.035em !important;
  line-height: 0.86 !important;
  text-transform: uppercase !important;
  color: var(--route-color, #FA498E) !important;
}

.poster-composition--blueprint-strava[data-theme="electric-atlas"] .poster-trail-name {
  font-size: clamp(7cqh, var(--trail-title-size, 8.2cqh), 8.8cqh) !important;
}

.poster-composition--blueprint-strava[data-theme="electric-atlas"] .poster-location-line,
.poster-composition--blueprint-strava[data-theme="electric-atlas"] .blueprint-drafting-topline,
.poster-composition--blueprint-strava[data-theme="electric-atlas"] .blueprint-drafting-figure,
.poster-composition--blueprint-strava[data-theme="electric-atlas"] .composition-technical-data-item span {
  color: color-mix(in srgb, var(--label-text-color, #B8B6F4) 82%, transparent) !important;
}

.poster-composition--blueprint-strava[data-theme="electric-atlas"] .composition-technical-data-item strong {
  color: #5FC3DD !important;
}

.composition-electric-trace {
  position: absolute;
  z-index: 8;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0.78;
  mix-blend-mode: screen;
}

.electric-trace-line {
  position: absolute;
  display: block;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--water-color, #22e3ff), var(--route-color, #ff2e88), transparent);
  box-shadow: 0 0 0.9cqh color-mix(in srgb, var(--water-color, #22e3ff) 52%, transparent);
}

.electric-trace-line--a {
  top: 18%;
  left: -14%;
  width: 52%;
  transform: rotate(-18deg);
}

.electric-trace-line--b {
  top: 62%;
  right: -10%;
  width: 48%;
  transform: rotate(14deg);
}

.electric-trace-line--c {
  bottom: 16%;
  left: 18%;
  width: 28%;
  transform: rotate(9deg);
  opacity: 0.56;
}

.composition-electric-chip {
  position: absolute;
  z-index: 9;
  right: 2.3cqw;
  top: 2.1cqh;
  display: grid;
  gap: 0.15cqh;
  min-width: 12cqw;
  padding: 0.58cqh 0.74cqw;
  pointer-events: none;
  color: var(--label-text-color, #B8B6F4);
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68cqh;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--water-color, #22e3ff) 28%, transparent) 0 1px, transparent 1px) 0 0 / 2.4cqw 100%,
    color-mix(in srgb, var(--background-color, #0A0A11) 74%, transparent);
  border: 1px solid color-mix(in srgb, var(--water-color, #22e3ff) 48%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--route-color, #FA498E) 18%, transparent),
    0 0 1.6cqh color-mix(in srgb, var(--water-color, #22e3ff) 20%, transparent);
}

.composition-electric-chip b {
  color: var(--route-color, #ff2e88);
  font-size: 0.86cqh;
  letter-spacing: 0.08em;
}

.poster-composition--blueprint-grid [data-testid="poster-map"] {
  margin: 0 4.8cqw !important;
  border: 1px solid color-mix(in srgb, currentColor 46%, transparent) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, currentColor 24%, transparent),
    0 0 0 0.7cqw color-mix(in srgb, currentColor 5%, transparent) !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] [data-testid="poster-map"] {
  margin: calc(7.6cqh + var(--print-bleed, 0px)) 8.8cqw 0 !important;
  border-color: color-mix(in srgb, currentColor 58%, transparent) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, currentColor 28%, transparent),
    inset 0 0 4cqh color-mix(in srgb, var(--water-color, #071b32) 32%, transparent),
    0 0 0 0.7cqw color-mix(in srgb, currentColor 6%, transparent) !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .blueprint-drafting-topline,
.poster-composition--blueprint-grid[data-theme="blueprint"] .blueprint-drafting-figure,
.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-drafting-topline,
.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-drafting-figure {
  position: absolute;
  z-index: 18;
  pointer-events: none;
  color: color-mix(in srgb, var(--label-text-color, #dceeff) 72%, transparent);
  font-family: "IBM Plex Mono", monospace;
  font-size: 1.08cqh;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .blueprint-drafting-topline,
.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-drafting-topline {
  left: 8.8cqw;
  right: 8.8cqw;
  top: 5.2cqh;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .blueprint-drafting-figure,
.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-drafting-figure {
  left: 13cqw;
  top: 10.2cqh;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .blueprint-sheet-neatline,
.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-sheet-neatline {
  position: absolute;
  inset: 3.7cqh 3.9cqw 3.8cqh;
  z-index: 17;
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--label-text-color, #dceeff) 58%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--label-text-color, #dceeff) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--label-text-color, #dceeff) 22%, transparent);
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-header,
.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-footer {
  background:
    linear-gradient(90deg, color-mix(in srgb, currentColor 10%, transparent) 0 1px, transparent 1px) 0 0 / 7.2cqw 100%,
    linear-gradient(0deg, color-mix(in srgb, currentColor 10%, transparent) 0 1px, transparent 1px) 0 0 / 100% 2.35cqh,
    var(--label-bg-color, #0b2948) !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-header {
  flex: 0 0 16.5% !important;
  height: 16.5% !important;
  padding-top: 2cqh !important;
  padding-left: calc(8.8cqw + var(--print-bleed, 0px)) !important;
  padding-right: calc(4.2cqw + var(--print-bleed, 0px)) !important;
  padding-bottom: 1.4cqh !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-footer {
  flex: 0 0 8.5% !important;
  height: 8.5% !important;
  padding-top: 0.8cqh !important;
  padding-left: calc(9.4cqw + var(--print-bleed, 0px)) !important;
  padding-right: calc(3.8cqw + var(--print-bleed, 0px)) !important;
  padding-bottom: calc(1.25cqh + var(--print-bleed, 0px)) !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-footer-rule {
  height: 1.5px !important;
  background: color-mix(in srgb, var(--label-text-color, #dceeff) 74%, transparent) !important;
  opacity: 1 !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-trail-name,
.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--title {
  color: var(--label-text-color, #dceeff) !important;
  font-family: "Space Grotesk", "IBM Plex Sans", sans-serif !important;
  font-weight: 760 !important;
  letter-spacing: 0.12em !important;
  line-height: 0.92 !important;
  text-transform: uppercase !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-trail-name {
  font-size: min(8.1cqh, 9.4cqw) !important;
  letter-spacing: 0.015em !important;
  transform: translateY(-1.45cqh);
  white-space: nowrap !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-location-line,
.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--subtitle,
.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--occasion {
  color: color-mix(in srgb, var(--label-text-color, #dceeff) 68%, transparent) !important;
  font-family: "IBM Plex Mono", monospace !important;
  letter-spacing: 0.02em !important;
  text-transform: none !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-location-line {
  font-size: 2.25cqh !important;
  transform: translateY(-1.55cqh);
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-stats {
  flex: 1 1 100% !important;
  width: 100% !important;
  max-width: none !important;
  justify-content: space-between !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  gap: 2.2cqw !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-stats .stat-block {
  flex: 0 1 auto !important;
  min-width: max-content !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-stats .stat-divider {
  display: none !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .poster-stats .stat-block:last-child {
  text-align: right !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--stat::first-line {
  color: var(--route-color, #ffd45a);
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--stat,
.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--coords {
  color: color-mix(in srgb, var(--label-text-color, #dceeff) 68%, transparent) !important;
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 1.44cqh !important;
  font-weight: 520 !important;
  letter-spacing: 0.14em !important;
  line-height: 1.1 !important;
  white-space: nowrap !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--stat::first-line,
.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--slot-date::first-line {
  color: color-mix(in srgb, var(--label-text-color, #dceeff) 76%, transparent) !important;
  font-size: 1em !important;
  font-weight: 520 !important;
  letter-spacing: 0.14em !important;
  line-height: 1 !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--slot-date {
  text-align: right !important;
}

.poster-composition--blueprint-grid[data-theme="blueprint"] .chrome-grid-block--brand {
  opacity: 0.50;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] [data-testid="poster-map"] {
  margin: 0 4.2cqw !important;
  border: 1px solid color-mix(in srgb, currentColor 56%, transparent) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, currentColor 28%, transparent),
    inset 0 0 3.5cqh color-mix(in srgb, var(--water-color, #b7c9cc) 22%, transparent),
    0 0 0 0.6cqw color-mix(in srgb, currentColor 4%, transparent) !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-header {
  border-top: 1px solid color-mix(in srgb, currentColor 38%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, currentColor 8%, transparent) 0 1px, transparent 1px) 0 0 / 8.8cqw 100%,
    linear-gradient(0deg, color-mix(in srgb, currentColor 9%, transparent) 0 1px, transparent 1px) 0 0 / 100% 2.6cqh,
    var(--label-bg-color, #EEF0ED) !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-footer {
  background:
    linear-gradient(90deg, color-mix(in srgb, currentColor 8%, transparent) 0 1px, transparent 1px) 0 0 / 8.8cqw 100%,
    linear-gradient(0deg, color-mix(in srgb, currentColor 9%, transparent) 0 1px, transparent 1px) 0 0 / 100% 2.6cqh,
    var(--label-bg-color, #EEF0ED) !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-drafting-topline,
.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-drafting-figure {
  color: color-mix(in srgb, var(--label-text-color, #243238) 68%, transparent);
  font-size: 1.03cqh;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .blueprint-sheet-neatline {
  border-color: color-mix(in srgb, var(--label-text-color, #243238) 36%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--label-text-color, #243238) 12%, transparent),
    0 0 0 1px color-mix(in srgb, var(--label-text-color, #243238) 16%, transparent);
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-trail-name,
.poster-composition--blueprint-grid[data-theme="moonstone"] .chrome-grid-block--title {
  font-family: "Space Grotesk", "IBM Plex Sans", sans-serif !important;
  font-weight: 760 !important;
  letter-spacing: 0.18em !important;
  line-height: 0.92 !important;
  text-transform: uppercase !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-location-line,
.poster-composition--blueprint-grid[data-theme="moonstone"] .chrome-grid-block--subtitle {
  color: color-mix(in srgb, var(--label-text-color, #243238) 62%, transparent) !important;
  font-family: "IBM Plex Sans", sans-serif !important;
  font-size: 1.55cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
  text-transform: none !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .chrome-grid-block--stat::first-line {
  color: var(--route-color, currentColor);
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .chrome-grid-block--brand {
  opacity: 0.42;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-stats {
  flex: 1 1 100% !important;
  width: 100% !important;
  max-width: none !important;
  justify-content: space-between !important;
  gap: 2.2cqw !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-stats .stat-divider,
.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-mark {
  display: none !important;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .composition-technical-line-footer {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: end;
  gap: 2cqw;
  padding: 0 calc(5.2cqw + var(--print-bleed, 0px)) calc(0.9cqh + var(--print-bleed, 0px));
  color: color-mix(in srgb, var(--label-text-color, #243238) 70%, transparent);
  font-family: "IBM Plex Mono", monospace;
  font-size: 1.62cqh;
  font-weight: 500;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .composition-technical-line-footer span:nth-child(2) {
  text-align: center;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .composition-technical-line-footer span:nth-child(3) {
  text-align: right;
}

.poster-composition--blueprint-grid[data-theme="moonstone"] .stat-block,
.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-date,
.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-coords {
  font-family: "IBM Plex Mono", monospace !important;
  letter-spacing: 0.13em !important;
  text-transform: uppercase !important;
}

.poster-composition--journal-spread [data-testid="poster-map"] {
  margin: 0 calc(27cqw + var(--print-bleed, 0px)) 0 calc(6.4cqw + var(--print-bleed, 0px)) !important;
  border: 1.5px solid color-mix(in srgb, currentColor 34%, transparent) !important;
  overflow: visible !important;
  box-shadow:
    0 0 0 1.05cqw color-mix(in srgb, var(--composition-paper, #e8ded0) 62%, transparent),
    0 1.25cqh 2.8cqh rgba(45, 36, 25, 0.18) !important;
  transform: rotate(-0.45deg);
  transform-origin: center;
}

.composition-journal-notes {
  position: absolute;
  z-index: 8;
  top: calc(19.4cqh + var(--print-bleed, 0px));
  right: calc(6.2cqw + var(--print-bleed, 0px));
  width: 19cqw;
  height: 24cqh;
  pointer-events: none;
  color: color-mix(in srgb, var(--label-text-color, #362616) 92%, transparent);
  font-family: "Source Serif 4", "Cormorant Garamond", serif;
  font-size: 1.18cqh;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.journal-note-heading {
  display: block;
  margin-bottom: 1.2cqh;
  font-family: "Cormorant Garamond", serif;
  font-size: 1.9cqh;
  font-style: italic;
  letter-spacing: 0.01em;
  text-transform: none;
}

.journal-note-rule {
  display: block;
  height: 4.2cqh;
  border-top: 1px solid color-mix(in srgb, var(--route-color, #6a4a2a) 58%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, currentColor 28%, transparent) 0 0.5cqw, transparent 0.5cqw) 0 1.4cqh / 4.4cqw 1px no-repeat;
  opacity: 1;
}

.journal-note-rule--short {
  width: 72%;
}

.composition-journal-route-sketch {
  position: absolute;
  z-index: 8;
  right: calc(6.2cqw + var(--print-bleed, 0px));
  bottom: calc(15.2cqh + var(--print-bleed, 0px));
  width: 18.2cqw;
  min-height: 10.8cqh;
  padding: 1.25cqh 1.45cqw;
  pointer-events: none;
  color: var(--label-text-color, #362616);
  font-family: "Source Serif 4", "Cormorant Garamond", serif;
  font-size: 1.16cqh;
  line-height: 1.32;
  background:
    linear-gradient(135deg, color-mix(in srgb, #fff 38%, transparent), transparent 34%),
    color-mix(in srgb, var(--composition-paper, #e8ded0) 82%, #cdbb91 18%);
  border: 1px solid color-mix(in srgb, var(--route-color, #6a4a2a) 24%, transparent);
  box-shadow: 0 0.45cqh 1cqh rgba(45, 36, 25, 0.1);
  transform: rotate(1.2deg);
}

.composition-journal-route-sketch span {
  display: block;
}

.journal-specimen-tag {
  margin-bottom: 0.75cqh;
  font-size: 0.92cqh;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--label-text-color, #362616) 72%, transparent);
}

.journal-specimen-line {
  width: 100%;
  height: 1.1cqh;
  margin: 0.1cqh 0 0.9cqh;
  border-top: 0.24cqh solid var(--route-color, #6a4a2a);
  border-bottom: 1px solid color-mix(in srgb, var(--route-color, #6a4a2a) 26%, transparent);
}

.composition-journal-tape {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}

.journal-tape-strip {
  position: absolute;
  display: block;
  width: 13cqw;
  height: 2.2cqh;
  background:
    linear-gradient(90deg, color-mix(in srgb, #fff 34%, transparent), transparent 22% 78%, color-mix(in srgb, #6a4a2a 12%, transparent)),
    color-mix(in srgb, #d6c39a 64%, var(--composition-paper, #e8ded0) 36%);
  opacity: 0.9;
  mix-blend-mode: multiply;
  box-shadow: 0 0.25cqh 0.8cqh rgba(45, 36, 25, 0.12);
}

.journal-tape-strip--top {
  top: -1.45cqh;
  left: 7cqw;
  transform: rotate(-5deg);
}

.journal-tape-strip--bottom {
  right: 5cqw;
  bottom: -1.25cqh;
  transform: rotate(4deg);
}

.poster-composition--journal-spread .poster-header {
  padding-right: calc(27cqw + var(--print-bleed, 0px)) !important;
}

.poster-composition--journal-spread[data-theme="field-journal"] .poster-footer {
  display: none !important;
}

.poster-composition--journal-spread[data-theme="field-journal"] [data-testid="poster-map"] {
  flex: 0 0 76% !important;
  height: 76% !important;
  margin-bottom: calc(4cqh + var(--print-bleed, 0px)) !important;
}

.poster-composition--journal-spread .poster-trail-name {
  font-family: "Cormorant Garamond", "Source Serif 4", serif !important;
  font-size: min(var(--trail-title-size, 4.9cqh), 5.8cqh) !important;
  font-style: italic !important;
  letter-spacing: 0 !important;
}

.poster-composition--botanical-plate [data-testid="poster-map"] {
  flex: 1 1 68% !important;
  margin: calc(5.25cqh + var(--print-bleed, 0px)) 6.8cqw 0 !important;
  border: 1px solid color-mix(in srgb, var(--route-color, #31512b) 54%, transparent) !important;
  box-shadow: none !important;
}

.composition-botanical-frame {
  position: absolute;
  z-index: 8;
  inset: calc(4.4cqh + var(--print-bleed, 0px)) calc(5.4cqw + var(--print-bleed, 0px)) calc(3.15cqh + var(--print-bleed, 0px));
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--route-color, #3f5a32) 64%, transparent);
  box-shadow:
    inset 0 0 0 1.08cqw color-mix(in srgb, var(--composition-paper, #eef1e8) 86%, transparent),
    inset 0 0 0 calc(1.08cqw + 2px) color-mix(in srgb, var(--route-color, #3f5a32) 42%, transparent);
}

.botanical-corner {
  position: absolute;
  width: 5.4cqw;
  height: 5.4cqw;
  border-color: color-mix(in srgb, var(--route-color, #3f5a32) 54%, transparent);
  opacity: 0.86;
}

.botanical-corner--tl {
  top: 0.8cqh;
  left: 0.8cqw;
  border-top: 1px solid;
  border-left: 1px solid;
}

.botanical-corner--tr {
  top: 0.8cqh;
  right: 0.8cqw;
  border-top: 1px solid;
  border-right: 1px solid;
}

.botanical-corner--br {
  right: 0.8cqw;
  bottom: 0.8cqh;
  border-right: 1px solid;
  border-bottom: 1px solid;
}

.botanical-corner--bl {
  bottom: 0.8cqh;
  left: 0.8cqw;
  border-bottom: 1px solid;
  border-left: 1px solid;
}

.composition-botanical-caption {
  display: none !important;
}

.botanical-caption-label {
  font-family: "Cormorant Garamond", serif;
  font-size: 1.35cqh;
  font-style: italic;
  letter-spacing: 0.02em;
  text-transform: none;
}

.poster-composition--botanical-plate .poster-header {
  align-items: center !important;
  text-align: center !important;
  flex: 0 0 28.6cqh !important;
  min-height: 28.6cqh !important;
  padding: 4.4cqh calc(9cqw + var(--print-bleed, 0px)) calc(4.4cqh + var(--print-bleed, 0px)) !important;
  background: var(--label-bg-color, #eef1e8) !important;
}

.poster-composition--botanical-plate .composition-kicker,
.poster-composition--botanical-plate .botanical-titleblock-eyebrow {
  color: color-mix(in srgb, var(--label-text-color, #253721) 72%, transparent) !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.38cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.33em !important;
  text-transform: uppercase !important;
  opacity: 1 !important;
  width: 100%;
  text-align: center;
}

.poster-composition--botanical-plate .poster-trail-name,
.poster-composition--botanical-plate .chrome-grid-block--title {
  font-family: "Cormorant Garamond", "Libre Baskerville", serif !important;
  font-size: 6.9cqh !important;
  font-style: italic !important;
  font-weight: 600 !important;
  letter-spacing: 0 !important;
  line-height: 0.9 !important;
  text-transform: none !important;
  text-align: center !important;
  color: var(--label-text-color, #253721) !important;
  text-shadow: none !important;
}

.poster-composition--botanical-plate .poster-location-line,
.poster-composition--botanical-plate .chrome-grid-block--subtitle,
.poster-composition--botanical-plate .chrome-grid-block--occasion {
  color: color-mix(in srgb, var(--label-text-color, #253721) 72%, transparent) !important;
  font-family: "Source Serif 4", Georgia, serif !important;
  font-size: 2cqh !important;
  font-weight: 600 !important;
  letter-spacing: 0.03em !important;
  text-align: center !important;
  text-transform: none !important;
  opacity: 1 !important;
}

.poster-composition--botanical-plate .composition-meta-line,
.poster-composition--botanical-plate .botanical-titleblock-coordinate {
  position: relative;
  margin-top: 3.05cqh;
  color: color-mix(in srgb, var(--label-text-color, #253721) 70%, transparent) !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.75cqh !important;
  font-weight: 400 !important;
  letter-spacing: 0.15em !important;
  opacity: 1 !important;
  text-align: center !important;
}

.poster-composition--botanical-plate .composition-meta-line::before,
.poster-composition--botanical-plate .botanical-titleblock-coordinate::before {
  content: "";
  position: absolute;
  left: 50%;
  top: -1.55cqh;
  width: 7.2cqw;
  height: 1px;
  transform: translateX(-50%);
  background: var(--route-color, #31512b);
  opacity: 0.76;
}

.poster-composition--botanical-plate .poster-footer {
  display: none !important;
}

.poster-composition--botanical-plate .poster-footer.is-chrome-grid-mode > .chrome-grid-band {
  transform: translateY(-0.25cqh);
}

.poster-composition--botanical-plate .poster-stats,
.poster-composition--botanical-plate .poster-mark {
  display: none !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] [data-testid="poster-map"] {
  order: 0 !important;
  flex: 0 0 72% !important;
  height: 72% !important;
  border: 0 !important;
  box-shadow: none !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-header {
  order: 1 !important;
  flex: 1 1 28% !important;
  justify-content: flex-start !important;
  gap: 1.15cqh !important;
  padding: 3.2cqh calc(7.8cqw + var(--print-bleed, 0px)) calc(4.6cqh + var(--print-bleed, 0px)) !important;
  background: var(--label-bg-color, #F8F3EA) !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-rule {
  display: none !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .composition-kicker {
  position: absolute !important;
  top: 3.2cqh !important;
  right: calc(7.8cqw + var(--print-bleed, 0px)) !important;
  width: auto !important;
  color: var(--route-color, #9A3B27) !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.32cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.22em !important;
  opacity: 1 !important;
  text-transform: uppercase !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-trail-name,
.poster-composition--editorial-tall[data-theme="editorial-minimal"] .chrome-grid-block--title {
  font-size: min(var(--trail-title-size, 6.8cqh), 7.2cqh) !important;
  line-height: 0.92 !important;
  max-width: 76cqw !important;
  text-wrap: balance;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-location-line,
.poster-composition--editorial-tall[data-theme="editorial-minimal"] .chrome-grid-block--subtitle,
.poster-composition--editorial-tall[data-theme="editorial-minimal"] .chrome-grid-block--occasion {
  letter-spacing: 0.16em !important;
  opacity: 0.52 !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .composition-meta-line {
  position: absolute !important;
  right: calc(7.8cqw + var(--print-bleed, 0px)) !important;
  bottom: calc(3.8cqh + var(--print-bleed, 0px)) !important;
  width: 34cqw !important;
  margin-top: 0 !important;
  color: color-mix(in srgb, var(--label-text-color, #171410) 58%, transparent) !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.28cqh !important;
  letter-spacing: 0.16em !important;
  line-height: 1.45 !important;
  opacity: 1 !important;
  text-align: right !important;
  white-space: pre-line !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-footer {
  position: absolute !important;
  inset: 0 !important;
  z-index: 22 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  pointer-events: none;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-footer > :not(.poster-occasion) {
  display: none !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-occasion,
.poster-composition--editorial-tall[data-theme="editorial-minimal"] .chrome-grid-block--occasion {
  position: absolute !important;
  left: calc(7.8cqw + var(--print-bleed, 0px)) !important;
  bottom: calc(3.8cqh + var(--print-bleed, 0px)) !important;
  width: auto !important;
  height: auto !important;
  max-width: 42cqw !important;
  color: color-mix(in srgb, var(--label-text-color, #171410) 62%, transparent) !important;
  font-family: "Source Sans 3", "Inter", sans-serif !important;
  font-size: 1.65cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0 !important;
  opacity: 1 !important;
  text-align: left !important;
  text-transform: none !important;
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .chrome-grid-block--stat::first-line {
  color: var(--route-color, currentColor);
}

.poster-composition--editorial-tall[data-theme="editorial-minimal"] .chrome-grid-block--brand {
  opacity: 0.36;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] [data-testid="poster-map"] {
  order: 0 !important;
  flex: 0 0 72% !important;
  height: 72% !important;
  margin: calc(4.6cqh + var(--print-bleed, 0px)) calc(7.8cqw + var(--print-bleed, 0px)) 0 !important;
  background: #EEE6D5 !important;
  border: 0 !important;
  border-bottom: 2px double color-mix(in srgb, var(--label-text-color, #27231d) 22%, transparent) !important;
  box-shadow: none !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-header {
  order: 1 !important;
  flex: 1 1 28% !important;
  justify-content: flex-start !important;
  gap: 1.05cqh !important;
  padding: 2.9cqh calc(7.8cqw + var(--print-bleed, 0px)) calc(3.6cqh + var(--print-bleed, 0px)) !important;
  background: var(--label-bg-color, #ece4d3) !important;
  position: relative !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-rule {
  display: none !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .composition-kicker {
  position: absolute !important;
  top: 2.9cqh !important;
  right: calc(7.8cqw + var(--print-bleed, 0px)) !important;
  width: auto !important;
  color: #C94D2C !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.45cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.22em !important;
  opacity: 1 !important;
  text-transform: uppercase !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-trail-name {
  font-family: "Newsreader", "Libre Baskerville", serif !important;
  font-size: min(var(--trail-title-size, 10.2cqh), 10.4cqh) !important;
  line-height: 0.92 !important;
  max-width: 76cqw !important;
  text-wrap: balance;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-location-line,
.poster-composition--editorial-tall[data-theme="relief-shaded"] .chrome-grid-block--subtitle {
  color: color-mix(in srgb, var(--label-text-color, #27231d) 66%, transparent) !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.45cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.28em !important;
  opacity: 1 !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-occasion,
.poster-composition--editorial-tall[data-theme="relief-shaded"] .chrome-grid-block--occasion {
  position: absolute !important;
  left: calc(7.8cqw + var(--print-bleed, 0px)) !important;
  bottom: calc(3.8cqh + var(--print-bleed, 0px)) !important;
  width: auto !important;
  height: auto !important;
  max-width: 42cqw !important;
  color: color-mix(in srgb, var(--label-text-color, #27231d) 62%, transparent) !important;
  font-family: "Source Sans 3", "Inter", sans-serif !important;
  font-size: 1.85cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0 !important;
  opacity: 1 !important;
  text-align: left !important;
  text-transform: none !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .composition-meta-line {
  position: absolute !important;
  right: calc(7.8cqw + var(--print-bleed, 0px)) !important;
  bottom: calc(3.8cqh + var(--print-bleed, 0px)) !important;
  width: 34cqw !important;
  margin-top: 0 !important;
  color: color-mix(in srgb, var(--label-text-color, #27231d) 58%, transparent) !important;
  font-family: "IBM Plex Mono", "Roboto Mono", monospace !important;
  font-size: 1.45cqh !important;
  letter-spacing: 0.16em !important;
  line-height: 1.45 !important;
  opacity: 1 !important;
  text-align: right !important;
  white-space: pre-line !important;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-footer {
  position: absolute !important;
  inset: 0 !important;
  z-index: 22 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  pointer-events: none;
}

.poster-composition--editorial-tall[data-theme="relief-shaded"] .poster-footer > :not(.poster-occasion) {
  display: none !important;
}

.composition-relief-bands {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  mix-blend-mode: multiply;
  opacity: 0.62;
}

.relief-band {
  stroke: none;
}

.relief-band--low {
  fill: color-mix(in srgb, var(--water-color, #b8c7a3) 32%, transparent);
}

.relief-band--mid {
  fill: color-mix(in srgb, var(--contour-color, #cabfa8) 36%, transparent);
}

.relief-band--high {
  fill: color-mix(in srgb, var(--route-color, #b4502a) 18%, transparent);
}

.composition-relief-legend {
  position: absolute;
  z-index: 9;
  right: 2.2cqw;
  bottom: 2.2cqh;
  display: flex;
  gap: 0.45cqw;
  align-items: center;
  padding: 0.42cqh 0.6cqw;
  pointer-events: none;
  background: color-mix(in srgb, var(--composition-paper, #efe9dd) 76%, transparent);
  border: 1px solid color-mix(in srgb, var(--label-text-color, #2a2620) 16%, transparent);
}

.relief-legend-swatch {
  display: block;
  width: 1.45cqw;
  height: 0.68cqh;
  border: 1px solid color-mix(in srgb, var(--label-text-color, #2a2620) 12%, transparent);
}

.relief-legend-swatch--low {
  background: color-mix(in srgb, var(--water-color, #b8c7a3) 56%, transparent);
}

.relief-legend-swatch--mid {
  background: color-mix(in srgb, var(--contour-color, #cabfa8) 64%, transparent);
}

.relief-legend-swatch--high {
  background: color-mix(in srgb, var(--route-color, #b4502a) 34%, transparent);
}

.composition-relief-stamp {
  position: absolute;
  z-index: 9;
  left: 2.2cqw;
  top: 2.1cqh;
  pointer-events: none;
  color: color-mix(in srgb, var(--label-text-color, #2a2620) 54%, transparent);
  font-family: "Source Sans 3", "Inter", sans-serif;
  font-size: 0.78cqh;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.poster-composition--riso-stack .poster-header::before {
  content: "";
  position: absolute;
  display: none;
}

.poster-composition--riso-stack {
  background: var(--composition-paper, #f4f0e3) !important;
}

.poster-composition--riso-stack .composition-paper-texture {
  opacity: 0.32;
}

.poster-composition--riso-stack [data-testid="poster-map"] {
  position: absolute !important;
  inset: 0 0 auto 0 !important;
  height: 72% !important;
  flex: 0 0 72% !important;
  margin: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  background: var(--composition-paper, #eae6db) !important;
}

.poster-composition--riso-stack .maplibregl-canvas {
  filter: contrast(1.04) saturate(1.08);
}

.poster-composition--riso-stack .poster-header {
  position: absolute !important;
  left: calc(6.7cqw + var(--print-bleed, 0px));
  right: calc(6.7cqw + var(--print-bleed, 0px));
  bottom: calc(13.4cqh + var(--print-bleed, 0px));
  z-index: 18 !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  color: var(--route-color, #ff4f7b) !important;
  align-items: flex-start !important;
  justify-content: flex-end !important;
  gap: 0 !important;
  pointer-events: auto;
  overflow: visible !important;
  outline: none !important;
}

.poster-composition--riso-stack .poster-footer {
  outline: none !important;
}

.poster-composition--riso-stack .composition-kicker,
.poster-composition--riso-stack .poster-location-line,
.poster-composition--riso-stack .composition-meta-line,
.poster-composition--riso-stack .poster-rule,
.poster-composition--riso-stack .composition-footer-note,
.poster-composition--riso-stack .poster-stats,
.poster-composition--riso-stack .poster-occasion,
.poster-composition--riso-stack .poster-mark {
  display: none !important;
}

.poster-composition--riso-stack .poster-header.is-chrome-grid-mode > .chrome-grid-band,
.poster-composition--riso-stack .poster-footer.is-chrome-grid-mode > .chrome-grid-band {
  display: none !important;
}

.poster-composition--riso-stack .poster-header.is-chrome-grid-mode > .poster-trail-name {
  display: block !important;
}

.poster-composition--riso-stack .poster-footer.is-chrome-grid-mode > .composition-riso-caption {
  display: flex !important;
}

.poster-composition--riso-stack .poster-footer.is-chrome-grid-mode > .composition-riso-meta {
  display: flex !important;
}

.poster-composition--riso-stack .poster-trail-name {
  position: relative;
  width: 100% !important;
  max-width: 100% !important;
  color: var(--route-color, #ff4f7b) !important;
  font-size: min(var(--trail-title-size, 12.7cqh), 13.1cqh) !important;
  line-height: 0.94 !important;
  letter-spacing: 0 !important;
  overflow: visible !important;
  white-space: normal !important;
  overflow-wrap: normal !important;
  text-wrap: balance !important;
  hyphens: none !important;
  text-shadow: none !important;
  mix-blend-mode: multiply;
}

.poster-composition--riso-stack .poster-trail-name::before {
  content: attr(data-riso-title);
  position: absolute;
  left: 1.05cqw;
  top: 0.48cqh;
  color: var(--water-color, #2f5fd0);
  opacity: 0.74;
  pointer-events: none;
}

.poster-composition--riso-stack .poster-footer {
  position: absolute !important;
  left: calc(6.8cqw + var(--print-bleed, 0px));
  right: calc(6.8cqw + var(--print-bleed, 0px));
  bottom: calc(4.3cqh + var(--print-bleed, 0px));
  z-index: 18 !important;
  height: 7.2cqh !important;
  min-height: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  color: var(--label-text-color, #16243f) !important;
  display: flex !important;
  align-items: flex-end !important;
  justify-content: space-between !important;
  gap: 4cqw !important;
  border: 0 !important;
}

.poster-composition--riso-stack .poster-footer-rule {
  display: none !important;
}

.poster-composition--riso-stack .composition-riso-caption {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 58%;
  font-family: "Work Sans", sans-serif;
  color: var(--label-text-color, #16243f);
}

.poster-composition--riso-stack .composition-riso-caption strong {
  font-size: 1.98cqh;
  line-height: 1.1;
  font-weight: 780;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.poster-composition--riso-stack .composition-riso-caption span {
  margin-top: 0.56cqh;
  font-size: 1.54cqh;
  line-height: 1.15;
  color: color-mix(in srgb, var(--label-text-color, #16243f) 78%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.poster-composition--riso-stack .composition-riso-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.72cqh;
  min-width: 22cqw;
  font-family: "IBM Plex Mono", monospace;
  font-size: 1.28cqh;
  line-height: 1;
  color: color-mix(in srgb, var(--label-text-color, #16243f) 78%, transparent);
  text-align: right;
  white-space: nowrap;
}

.poster-composition--riso-stack .composition-riso-meta span:first-child {
  font-family: "Work Sans", sans-serif;
  font-size: 1.34cqh;
  letter-spacing: 0.27em;
  text-transform: uppercase;
  color: var(--water-color, #2f5fd0);
}

.poster-composition--riso-stack .absolute.inset-0.w-full.h-full.pointer-events-none {
  mix-blend-mode: multiply !important;
}

.poster-composition--botanical-plate .poster-header::before,
.poster-composition--botanical-plate .poster-header::after {
  content: none;
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

.poster-composition--place-frame [data-testid="poster-map"],
.poster-composition--sea-chart [data-testid="poster-map"],
.poster-composition--art-wash [data-testid="poster-map"],
.poster-composition--transit-diagram [data-testid="poster-map"] {
  flex: 1 1 100% !important;
  margin: 0 !important;
  border: 0 !important;
  min-height: 0 !important;
  box-shadow: none !important;
}

.poster-composition--place-frame .poster-footer,
.poster-composition--sea-chart .poster-footer,
.poster-composition--art-wash .poster-footer {
  display: none !important;
}

.poster-composition--place-frame .poster-header,
.poster-composition--sea-chart .poster-header,
.poster-composition--art-wash .poster-header {
  position: absolute !important;
  z-index: 18 !important;
  color: var(--composition-ink, currentColor) !important;
  max-height: 28cqh;
  overflow: hidden !important;
}

.poster-composition--place-frame .poster-header {
  left: 19cqw;
  right: 19cqw;
  top: 72%;
  bottom: auto;
  align-items: center !important;
  padding: 2.75cqh 4.2cqw 2.95cqh !important;
  background: color-mix(in srgb, var(--composition-paper, white) 92%, #fffdf2 8%) !important;
  border: 2px solid color-mix(in srgb, currentColor 88%, transparent);
  box-shadow: 0 1.4cqh 3.2cqh rgba(15, 18, 26, 0.08);
  transform: translateY(-50%);
  height: 39.2cqh !important;
  min-height: 39.2cqh !important;
  max-height: 39.2cqh !important;
}

.poster-composition--place-frame.poster-has-route .poster-header {
  left: calc(18cqw + var(--print-bleed, 0px));
  right: calc(18cqw + var(--print-bleed, 0px));
  top: auto;
  bottom: calc(7.8cqh + var(--print-bleed, 0px));
  width: auto;
  align-items: center !important;
  text-align: center !important;
  padding: 2.35cqh 3.3cqw 2.55cqh !important;
  border-width: 2px;
  border-style: solid;
  box-shadow: 0 1cqh 2.8cqh rgba(32, 24, 16, 0.12);
  transform: none;
  max-height: 34cqh;
}

.poster-composition--place-frame .poster-header::before,
.poster-composition--place-frame .poster-header::after {
  content: none !important;
}

.poster-composition--place-frame .composition-cartouche-hills {
  position: absolute;
  inset: auto 0 calc(-1.2cqh + var(--print-bleed, 0px));
  height: 30cqh;
  z-index: 17;
  pointer-events: none;
  overflow: hidden;
  mix-blend-mode: multiply;
}

.poster-composition--place-frame .composition-cartouche-hill {
  position: absolute;
  bottom: -5.8cqh;
  display: block;
  background: color-mix(in srgb, var(--label-text-color, #0f121a) 36%, var(--water-color, #9fb7aa) 64%);
  opacity: 0.24;
  filter: blur(0.08cqh);
}

.poster-composition--place-frame .composition-cartouche-hill--left {
  left: -6cqw;
  width: 48cqw;
  height: 22cqh;
  border-radius: 62% 38% 0 0 / 70% 82% 0 0;
  transform: rotate(-5deg);
}

.poster-composition--place-frame .composition-cartouche-hill--right {
  right: -4cqw;
  width: 62cqw;
  height: 28cqh;
  border-radius: 44% 56% 0 0 / 78% 64% 0 0;
  transform: rotate(-7deg);
}

.poster-composition--place-frame .composition-kicker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2cqw;
  color: var(--route-color, currentColor) !important;
  opacity: 1 !important;
}

.poster-composition--place-frame.poster-has-route .composition-kicker {
  justify-content: center;
  gap: 0.9cqw;
  max-width: 100%;
  font-size: 0.8cqh !important;
  font-weight: 700 !important;
  letter-spacing: 0.19em !important;
  white-space: nowrap;
}

.poster-composition--place-frame .composition-kicker::before,
.poster-composition--place-frame .composition-kicker::after {
  content: "";
  width: 3.6cqw;
  height: 1px;
  background: currentColor;
}

.poster-composition--place-frame .poster-trail-name {
  font-size: min(var(--trail-title-size, 6.45cqh), 6.55cqh) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.035em !important;
  line-height: 0.94 !important;
  max-width: 88% !important;
  min-height: 10.6cqh;
  overflow: visible !important;
}

.poster-composition--place-frame .chrome-grid-block--title {
  justify-self: center !important;
  max-width: 88% !important;
}

.poster-composition--place-frame .poster-location-line,
.poster-composition--place-frame .chrome-grid-block--subtitle {
  text-transform: none !important;
}

.poster-composition--place-frame.poster-has-route .poster-trail-name {
  max-width: 100% !important;
  font-size: min(var(--trail-title-size, 4.25cqh), 4.55cqh) !important;
  line-height: 0.92 !important;
  text-align: center !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
  hyphens: none !important;
  text-wrap: balance;
}

.poster-composition--place-frame.poster-has-route .chrome-grid-block--title {
  min-height: 8.4cqh;
  max-height: none !important;
  overflow: visible !important;
}

.poster-composition--place-frame .composition-meta-line {
  margin-top: 0.8cqh;
  padding-top: 0.9cqh;
  border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 0.82cqh !important;
  letter-spacing: 0.12em !important;
  opacity: 0.76 !important;
  color: currentColor !important;
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.poster-composition--place-frame.poster-has-route .composition-meta-line {
  margin-top: 0.85cqh;
  padding-top: 0.85cqh;
  font-size: 0.78cqh !important;
  line-height: 1.25 !important;
  letter-spacing: 0.11em !important;
  text-align: center !important;
  white-space: normal !important;
}

.poster-composition--sea-chart .poster-header {
  left: calc(5.2cqw + var(--print-bleed, 0px));
  right: auto;
  bottom: calc(4.0cqh + var(--print-bleed, 0px));
  width: min(82cqw, 54cqh);
  align-items: flex-start !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  max-height: 22cqh;
}

.poster-composition--sea-chart .poster-header::before,
.poster-composition--sea-chart .poster-header::after {
  display: none !important;
  content: none !important;
}

.poster-composition--sea-chart .poster-rule {
  width: 100% !important;
  height: 1px !important;
  margin: 0 0 0.48cqh !important;
  background: currentColor !important;
  opacity: 0.42 !important;
}

.poster-composition--sea-chart .composition-kicker {
  color: var(--route-color, currentColor) !important;
  opacity: 1 !important;
  letter-spacing: 0.16em !important;
  font-size: 0.86cqh !important;
  font-family: "IBM Plex Mono", monospace !important;
  font-weight: 700 !important;
  padding-right: 24% !important;
  text-transform: uppercase !important;
}

.poster-composition--sea-chart .poster-trail-name {
  margin-top: 0.26cqh !important;
  font-size: min(var(--trail-title-size, 5.05cqh), 5.05cqh) !important;
  line-height: 0.94 !important;
  max-width: 56cqw !important;
}

.poster-composition--sea-chart .poster-location-line {
  margin-top: 0.38cqh !important;
  padding-top: 0 !important;
  border-top: 0 !important;
  letter-spacing: 0.06em !important;
  text-align: left !important;
  opacity: 0.82 !important;
  max-width: 56cqw !important;
}

.poster-composition--sea-chart .composition-meta-line {
  position: absolute;
  right: 0;
  top: auto;
  bottom: 0;
  width: 31cqw !important;
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 0.58cqh !important;
  line-height: 1.42 !important;
  text-align: right !important;
  white-space: normal !important;
  letter-spacing: 0.12em !important;
  opacity: 0.9 !important;
}

.poster-composition--art-wash .poster-header {
  left: 50%;
  right: auto;
  bottom: calc(7cqh + var(--print-bleed, 0px));
  width: min(72cqw, 34cqh);
  transform: translateX(-50%);
  align-items: center !important;
  padding: 1.55cqh 3.5cqw !important;
  background: var(--composition-paper, white) !important;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  box-shadow: 0 1cqh 3.8cqh rgba(0, 0, 0, 0.08);
  max-height: 20cqh;
}

.poster-composition--art-wash[data-theme="contour-wash"] .poster-header {
  bottom: calc(6.9cqh + var(--print-bleed, 0px));
  width: 52cqw;
  padding: 2.05cqh 4.4cqw 2.25cqh !important;
  background: var(--composition-paper, #ebe9e6) !important;
  border: 0 !important;
  box-shadow: 0 1.8cqh 3.8cqh rgba(21, 20, 18, 0.05) !important;
  overflow: visible !important;
}

.poster-composition--art-wash[data-theme="contour-wash"] .poster-header::after {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 0;
  height: 1px;
  background: color-mix(in srgb, var(--label-text-color, #151412) 28%, transparent);
}

.poster-composition--art-wash[data-theme="contour-wash"] .composition-kicker {
  top: -72cqh;
  z-index: 22;
  color: color-mix(in srgb, var(--label-text-color, #151412) 74%, transparent) !important;
  font-family: "Source Sans 3", "Inter", sans-serif !important;
  font-size: 0.88cqh !important;
  font-weight: 700 !important;
  letter-spacing: 0.24em !important;
  opacity: 0.82 !important;
}

.poster-composition--art-wash[data-theme="contour-wash"] [data-testid="poster-map"] {
  background: #ebe9e6 !important;
}

.poster-composition--art-wash[data-theme="contour-wash"] [data-testid="poster-map"]::before {
  content: none !important;
}

.poster-composition--art-wash[data-theme="contour-wash"] [data-testid="poster-map"]::after {
  content: none !important;
}

.poster-composition--art-wash[data-theme="contour-wash"] .maplibregl-canvas {
  filter: none !important;
  opacity: 1;
}

.poster-composition--art-wash[data-theme="contour-wash"] .poster-trail-name {
  font-size: min(var(--trail-title-size, 5.05cqh), 5.05cqh) !important;
  font-weight: 600 !important;
  line-height: 0.96 !important;
}

.poster-composition--art-wash[data-theme="contour-wash"] .poster-location-line {
  margin-top: 1.05cqh !important;
  letter-spacing: 0.18em !important;
  opacity: 0.62 !important;
}

.poster-composition--art-wash[data-theme="plein-air"] .poster-header {
  left: calc(6.9cqw + var(--print-bleed, 0px));
  right: auto;
  bottom: calc(7.4cqh + var(--print-bleed, 0px));
  width: min(55cqw, 33cqh);
  transform: none;
  align-items: flex-start !important;
  text-align: left !important;
  padding: 1.05cqh 2.1cqw 1.1cqh !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none;
}

.poster-composition--art-wash[data-theme="plein-air"] .poster-header::before,
.poster-composition--art-wash[data-theme="plein-air"] .poster-header::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.poster-composition--art-wash[data-theme="plein-air"] .poster-header::before {
  z-index: -1;
  inset: 0.35cqh 8.5cqw 0.1cqh -0.75cqw;
  opacity: 0.68;
  background:
    radial-gradient(ellipse at 22% 45%, color-mix(in srgb, #f8eedb 94%, transparent), transparent 70%),
    radial-gradient(ellipse at 82% 62%, color-mix(in srgb, #d8b77f 22%, transparent), transparent 60%),
    repeating-linear-gradient(101deg, color-mix(in srgb, #946b3b 7%, transparent) 0 0.08cqw, transparent 0.08cqw 0.72cqw);
  filter: blur(0.14cqw);
  clip-path: polygon(0 12%, 18% 2%, 56% 7%, 93% 0, 100% 28%, 92% 87%, 58% 94%, 24% 88%, 2% 100%);
}

.poster-composition--art-wash[data-theme="plein-air"] .poster-header::after {
  left: 1.7cqw;
  right: 5.6cqw;
  bottom: 0.65cqh;
  height: 0.22cqh;
  opacity: 0.62;
  background: linear-gradient(90deg, var(--route-color, #c2683f), color-mix(in srgb, var(--route-color, #c2683f) 8%, transparent));
  filter: blur(0.04cqw);
  transform: rotate(-1.4deg);
}

.poster-composition--art-wash .poster-trail-name {
  font-size: min(var(--trail-title-size, 4cqh), 4cqh) !important;
  line-height: 0.96 !important;
}

.poster-composition--art-wash[data-theme="plein-air"] .poster-trail-name {
  font-family: "Cormorant Garamond", "Newsreader", serif !important;
  font-size: min(var(--trail-title-size, 5.15cqh), 5.45cqh) !important;
  font-style: italic !important;
  font-weight: 700 !important;
  line-height: 0.9 !important;
  letter-spacing: 0 !important;
  text-align: left !important;
  max-width: 100% !important;
  text-shadow:
    0.08cqw 0.06cqh 0 color-mix(in srgb, var(--composition-paper, #f6f1e8) 84%, transparent),
    -0.06cqw 0 0 color-mix(in srgb, var(--composition-paper, #f6f1e8) 70%, transparent);
}

.poster-composition--art-wash[data-theme="plein-air"] .poster-location-line {
  margin-top: 0.7cqh !important;
  max-width: 48cqw !important;
  text-align: left !important;
  letter-spacing: 0.08em !important;
  opacity: 0.66 !important;
}

.poster-composition--art-wash[data-theme="plein-air"] .composition-kicker {
  top: -50.5cqh;
  left: 0.6cqw;
  transform: none;
  color: color-mix(in srgb, currentColor 76%, transparent) !important;
  text-align: left;
  font-family: "Source Sans 3", "Inter", sans-serif !important;
  font-size: 0.72cqh !important;
  font-weight: 800 !important;
  letter-spacing: 0.24em !important;
}

.poster-composition--art-wash .composition-kicker {
  position: absolute;
  top: -55cqh;
  left: 50%;
  width: max-content;
  transform: translateX(-50%);
  font-size: 0.82cqh !important;
  letter-spacing: 0.2em !important;
  opacity: 0.58 !important;
}

.poster-composition--transit-diagram [data-testid="poster-map"] {
  flex: 1 1 auto !important;
  height: 83% !important;
}

.poster-composition--transit-diagram .poster-header {
  flex: 0 0 17% !important;
  position: relative;
  justify-content: flex-start !important;
  align-items: flex-start !important;
  padding-top: 1.25cqh !important;
  padding-bottom: 1.2cqh !important;
  background: var(--composition-paper, #f7f5f0) !important;
}

.poster-composition--transit-diagram .poster-header::before {
  content: "T1";
  position: absolute;
  right: calc(5.6cqw + var(--print-bleed, 0px));
  top: calc(1.4cqh + var(--print-bleed, 0px));
  z-index: 18;
  display: grid;
  place-items: center;
  width: 5.2cqw;
  min-width: 2.7cqh;
  height: 2.7cqh;
  color: var(--composition-paper, #f7f5f0);
  background: var(--route-color, #7a1fa2);
  border-radius: 999px;
  font-family: "IBM Plex Sans", "Inter", sans-serif;
  font-size: 1.05cqh;
  font-weight: 900;
  letter-spacing: 0.02em;
  box-shadow: 0 0 0 0.42cqh var(--composition-paper, #f7f5f0);
}

.poster-composition--transit-diagram .poster-header::after {
  content: "";
  position: absolute;
  left: calc(5.6cqw + var(--print-bleed, 0px));
  right: calc(5.6cqw + var(--print-bleed, 0px));
  bottom: 0;
  z-index: 1;
  height: 0.35cqh;
  background:
    linear-gradient(90deg, var(--route-color, #7a1fa2) 0 68%, var(--contour-major-color, #1f8a5b) 68% 100%);
}

.poster-composition--transit-diagram .poster-footer {
  display: none !important;
}

.poster-composition--transit-diagram .poster-trail-name {
  max-width: calc(100% - 9cqw);
  white-space: normal;
  overflow-wrap: anywhere;
  text-wrap: balance;
  font-size: min(var(--trail-title-size, 3.35cqh), 3.35cqh) !important;
  line-height: 0.9 !important;
  letter-spacing: 0 !important;
}

.poster-composition--transit-diagram .chrome-grid-block--title {
  max-height: none !important;
  max-width: calc(100% - 8cqw) !important;
  overflow: visible !important;
  font-size: min(var(--trail-title-size, 3.15cqh), 3.15cqh) !important;
  line-height: 0.96 !important;
  letter-spacing: 0 !important;
  text-wrap: balance;
}

.poster-composition--transit-diagram .poster-location-line {
  margin-top: 0.5cqh !important;
  opacity: 0.72 !important;
  text-align: left !important;
  letter-spacing: 0.02em !important;
}

.poster-composition--transit-diagram .composition-kicker {
  position: absolute;
  top: calc(2.4cqh + var(--print-bleed, 0px));
  left: calc(6.8cqw + var(--print-bleed, 0px));
  width: auto !important;
  color: color-mix(in srgb, currentColor 62%, transparent) !important;
  opacity: 1 !important;
  z-index: 20;
}

.poster-composition--transit-diagram .composition-meta-line {
  margin-top: 0.85cqh;
  padding-top: 0.75cqh;
  border-top: 2px solid currentColor;
  font-family: "IBM Plex Mono", monospace !important;
  letter-spacing: 0.08em !important;
  opacity: 0.74 !important;
}

.composition-brutalist-baseline-grid,
.composition-brutalist-registration-marks {
  position: absolute;
  inset: calc(2.4cqh + var(--print-bleed, 0px)) calc(3.4cqw + var(--print-bleed, 0px));
  z-index: 4;
  pointer-events: none;
}

.composition-brutalist-baseline-grid {
  opacity: 0.16;
  mix-blend-mode: multiply;
  background-image:
    linear-gradient(color-mix(in srgb, currentColor 55%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, currentColor 45%, transparent) 1px, transparent 1px);
  background-size: 100% 4.8cqh, 8.5cqw 100%;
}

.composition-brutalist-registration-marks {
  opacity: 0.9;
  background:
    linear-gradient(currentColor 0 0) left 0 top 2.1cqh / 4.2cqw 2px no-repeat,
    linear-gradient(currentColor 0 0) left 2.1cqw top 0 / 2px 4.2cqh no-repeat,
    linear-gradient(currentColor 0 0) right 0 top 2.1cqh / 4.2cqw 2px no-repeat,
    linear-gradient(currentColor 0 0) right 2.1cqw top 0 / 2px 4.2cqh no-repeat,
    linear-gradient(currentColor 0 0) left 0 bottom 2.1cqh / 4.2cqw 2px no-repeat,
    linear-gradient(currentColor 0 0) left 2.1cqw bottom 0 / 2px 4.2cqh no-repeat,
    linear-gradient(currentColor 0 0) right 0 bottom 2.1cqh / 4.2cqw 2px no-repeat,
    linear-gradient(currentColor 0 0) right 2.1cqw bottom 0 / 2px 4.2cqh no-repeat;
}

.poster-composition--brutalist-slab .poster-header {
  border-top: 0 !important;
  background: var(--composition-paper, #e4e0d7) !important;
  color: var(--label-text-color, #0a0a0a) !important;
  justify-content: flex-end !important;
  align-items: flex-start !important;
  gap: 0.65cqh !important;
}

.poster-composition--brutalist-slab .poster-header::before,
.poster-composition--brutalist-slab .poster-header::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.poster-composition--brutalist-slab .poster-header::before {
  left: calc(6.7cqw + var(--print-bleed, 0px));
  right: calc(6.7cqw + var(--print-bleed, 0px));
  top: calc(7.9cqh + var(--print-bleed, 0px));
  height: 0.28cqh;
  background: currentColor;
}

.poster-composition--brutalist-slab .composition-kicker,
.poster-composition--brutalist-slab .composition-meta-line,
.poster-composition--brutalist-slab .poster-location-line {
  position: absolute;
  top: calc(5.25cqh + var(--print-bleed, 0px));
  z-index: 1;
  margin: 0 !important;
  color: color-mix(in srgb, var(--label-text-color, #0a0a0a) 68%, transparent) !important;
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 1.25cqh !important;
  font-weight: 500 !important;
  letter-spacing: 0.20em !important;
  line-height: 1 !important;
  opacity: 1 !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
}

.poster-composition--brutalist-slab .composition-kicker {
  left: calc(6.7cqw + var(--print-bleed, 0px));
  width: auto !important;
}

.poster-composition--brutalist-slab .poster-location-line {
  left: 50%;
  width: auto !important;
  max-width: 36cqw !important;
  transform: translateX(-50%);
  text-align: center !important;
}

.poster-composition--brutalist-slab .composition-meta-line {
  right: calc(6.7cqw + var(--print-bleed, 0px));
  width: auto !important;
  text-align: right !important;
}

.poster-composition--brutalist-slab .poster-trail-name {
  margin: 8.2cqh 0 0 !important;
  color: var(--label-text-color, #0a0a0a) !important;
  font-size: clamp(9.5cqh, var(--trail-title-size, 16.4cqh), 16.6cqh) !important;
  line-height: 0.82 !important;
  letter-spacing: 0 !important;
  text-transform: uppercase !important;
  transform: translateY(2.8cqh);
}

.poster-composition--brutalist-slab [data-testid="poster-map"] {
  flex: 0 0 58.5% !important;
  height: 58.5% !important;
  background: var(--land-color, #d7d3ca) !important;
  box-sizing: border-box !important;
}

.poster-composition--brutalist-slab [data-testid="poster-map"]::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 13;
  pointer-events: none;
  background: rgba(230, 227, 221, 0.42);
  mix-blend-mode: multiply;
  opacity: 1;
}

.poster-composition--brutalist-slab .maplibregl-canvas {
  filter: brightness(0.96) contrast(1.28) sepia(0.08) saturate(0.72);
}

.poster-composition--brutalist-slab .poster-footer {
  flex: 0 0 15.5% !important;
  height: 15.5% !important;
  min-height: 15.5% !important;
  background: var(--composition-paper, #e4e0d7) !important;
  color: var(--label-text-color, #0a0a0a) !important;
}

.poster-composition--brutalist-slab .poster-footer-rule {
  opacity: 1 !important;
  height: 0.28cqh !important;
  background: currentColor !important;
}

.poster-composition--brutalist-slab .composition-footer-note {
  left: var(--composition-rule-left);
  right: auto;
  top: 4.05cqh;
  width: 48cqw;
  color: var(--label-text-color, #0a0a0a) !important;
  font-family: "IBM Plex Sans", sans-serif !important;
  font-size: 1.66cqh !important;
  font-weight: 400 !important;
  letter-spacing: 0 !important;
  line-height: 1.45 !important;
  opacity: 1 !important;
  text-align: left !important;
  text-transform: none !important;
  white-space: pre-line !important;
}

.poster-composition--brutalist-slab .poster-footer.is-chrome-grid-mode > .chrome-grid-band,
.poster-composition--brutalist-slab .poster-footer .poster-stats,
.poster-composition--brutalist-slab .poster-footer .poster-mark {
  display: none !important;
}

.composition-brutalist-distance {
  position: absolute;
  right: var(--composition-rule-right);
  bottom: calc(4.05cqh + var(--print-bleed, 0px));
  color: var(--route-color, #ff3b00) !important;
  font-family: "IBM Plex Mono", monospace !important;
  font-size: 2.2cqh !important;
  font-weight: 800 !important;
  letter-spacing: 0.08em !important;
  line-height: 1 !important;
  text-align: right !important;
  white-space: pre-line !important;
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

/* Chrome row/column grid editor */
.poster-header.is-chrome-grid-mode,
.poster-footer.is-chrome-grid-mode {
  display: block !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.poster-header.is-chrome-grid-mode > :not(.chrome-grid-band),
.poster-footer.is-chrome-grid-mode > :not(.chrome-grid-band) {
  display: none !important;
}

.poster-composition--riso-stack .poster-header.is-chrome-grid-mode > .chrome-grid-band,
.poster-composition--riso-stack .poster-footer.is-chrome-grid-mode > .chrome-grid-band {
  display: none !important;
}

.poster-composition--riso-stack .poster-header.is-chrome-grid-mode > .poster-trail-name {
  display: block !important;
}

.poster-composition--riso-stack .poster-footer.is-chrome-grid-mode > .composition-riso-caption {
  display: flex !important;
}

.poster-composition--riso-stack .poster-footer.is-chrome-grid-mode > .composition-riso-meta {
  display: flex !important;
}

.chrome-grid-band {
  position: relative;
  z-index: 8;
}

.chrome-grid-band:not(.is-editable) {
  pointer-events: none;
}

.chrome-grid-band.is-resizing-columns,
.chrome-grid-band.is-resizing-rows {
  cursor: grabbing;
}

.chrome-grid-row {
  position: relative;
  min-height: 0;
  min-width: 0;
  border-radius: 5px;
}

.chrome-grid-row::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -2px;
  height: 1px;
  background: rgba(42, 91, 204, 0.74);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.chrome-grid-row:hover,
.chrome-grid-row.is-selected,
.chrome-grid-row.is-resizing-row {
  z-index: 18;
}

.chrome-grid-row:hover::after,
.chrome-grid-row.is-selected::after,
.chrome-grid-row.is-resizing-row::after {
  opacity: 1;
}

.chrome-grid-cell {
  position: relative;
  min-width: 0;
  min-height: 2.2cqh;
  display: grid;
  box-sizing: border-box;
  overflow: visible;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 0.22cqh 0.32cqw;
}

.chrome-grid-cell:hover {
  border-color: rgba(42, 91, 204, 0.28);
}

.chrome-grid-cell.is-selected {
  z-index: 20;
  border-color: #2A5BCC;
  box-shadow: 0 0 0 1px #2A5BCC;
}

.chrome-grid-cell.is-empty {
  background: rgba(42, 91, 204, 0.035);
}

.chrome-grid-cell.is-empty:not(.is-selected):hover {
  background: rgba(42, 91, 204, 0.026);
}

.chrome-grid-cell.is-spacer {
  background: transparent;
}

.chrome-grid-cell.is-selected.is-empty {
  border-color: rgba(42, 91, 204, 0.38);
  background: transparent;
  box-shadow: none;
}

.chrome-grid-band:not(.is-editable) .chrome-grid-row::after,
.chrome-grid-band:not(.is-editable) .chrome-grid-cell {
  border-color: transparent;
  box-shadow: none;
}

.chrome-grid-band:not(.is-editable) .chrome-grid-cell.is-empty,
.chrome-grid-band:not(.is-editable) .chrome-grid-cell.is-empty:hover,
.chrome-grid-band:not(.is-editable) .chrome-grid-cell.is-selected.is-empty {
  background: transparent;
}

.chrome-grid-block {
  min-width: 0;
  max-width: 100%;
  max-height: 100%;
  box-sizing: border-box;
  display: block;
  white-space: pre-line;
  overflow-wrap: anywhere;
  overflow: hidden;
}

.chrome-grid-block--title {
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  text-wrap: balance;
}

.chrome-grid-block--subtitle,
.chrome-grid-block--occasion,
.chrome-grid-block--eyebrow {
  text-wrap: balance;
}

.chrome-grid-block--stat,
.chrome-grid-block--coords,
.chrome-grid-block--brand {
  font-variant-numeric: tabular-nums lining-nums;
  text-wrap: balance;
}

.chrome-grid-block--stat::first-line {
  font-size: 2.34em;
  font-weight: 850;
  letter-spacing: 0;
  line-height: 0.85;
}

.chrome-grid-block--slot-date::first-line {
  font-size: 1.48em;
  font-weight: 780;
}

.chrome-grid-block--coords {
  opacity: 0.76;
}

.chrome-grid-block--brand {
  opacity: 0.66;
  white-space: nowrap;
}

.poster-composition--editorial-tall .chrome-grid-block--stat::first-line,
.poster-composition--journal-spread .chrome-grid-block--stat::first-line,
.poster-composition--botanical-plate .chrome-grid-block--stat::first-line {
  font-size: 1.9em;
  font-weight: 620;
}

.poster-composition--editorial-tall .chrome-grid-block--stat,
.poster-composition--journal-spread .chrome-grid-block--stat,
.poster-composition--botanical-plate .chrome-grid-block--stat {
  letter-spacing: 0.08em;
}

.poster-composition--editorial-tall .chrome-grid-block--brand,
.poster-composition--journal-spread .chrome-grid-block--brand,
.poster-composition--botanical-plate .chrome-grid-block--brand {
  letter-spacing: 0.18em;
  opacity: 0.46;
}

.poster-composition--travel-banner .chrome-grid-block--stat::first-line,
.poster-composition--darksky-stars .chrome-grid-block--stat::first-line {
  font-size: 2.72em;
  font-weight: 880;
}

.poster-composition--travel-banner .chrome-grid-block--slot-date,
.poster-composition--darksky-stars .chrome-grid-block--slot-date {
  letter-spacing: 0.08em;
}

.poster-composition--travel-banner .chrome-grid-block--brand,
.poster-composition--darksky-stars .chrome-grid-block--brand {
  opacity: 0.5;
}

.poster-composition--blueprint-grid .chrome-grid-block--stat::first-line,
.poster-composition--blueprint-strava .chrome-grid-block--stat::first-line,
.poster-composition--splits-grid .chrome-grid-block--stat::first-line {
  font-size: 2.12em;
  font-weight: 820;
}

.poster-composition--blueprint-grid .chrome-grid-block--stat,
.poster-composition--blueprint-strava .chrome-grid-block--stat,
.poster-composition--splits-grid .chrome-grid-block--stat,
.poster-composition--blueprint-grid .chrome-grid-block--coords,
.poster-composition--blueprint-strava .chrome-grid-block--coords,
.poster-composition--splits-grid .chrome-grid-block--coords {
  letter-spacing: 0.13em;
}

.poster-composition--blueprint-grid .chrome-grid-block--brand,
.poster-composition--blueprint-strava .chrome-grid-block--brand,
.poster-composition--splits-grid .chrome-grid-block--brand {
  letter-spacing: 0.2em;
  opacity: 0.56;
}

.poster-composition--bib-numerals .chrome-grid-block--stat::first-line,
.poster-composition--brutalist-slab .chrome-grid-block--stat::first-line,
.poster-composition--modernist-block .chrome-grid-block--stat::first-line {
  font-size: 2.9em;
  font-weight: 900;
}

.poster-composition--bib-numerals .chrome-grid-block--slot-date::first-line,
.poster-composition--brutalist-slab .chrome-grid-block--slot-date::first-line,
.poster-composition--modernist-block .chrome-grid-block--slot-date::first-line {
  font-size: 1.66em;
}

.poster-composition--bib-numerals .chrome-grid-block--brand,
.poster-composition--brutalist-slab .chrome-grid-block--brand,
.poster-composition--modernist-block .chrome-grid-block--brand {
  opacity: 0.72;
}

.chrome-grid-spacer {
  width: 100%;
  height: 100%;
  min-height: 16px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  color: rgba(42, 91, 204, 0.68);
  background:
    repeating-linear-gradient(
      90deg,
      rgba(42, 91, 204, 0.08) 0 1px,
      transparent 1px 8px
    );
  opacity: 0.24;
  transition: opacity 120ms ease, background-color 120ms ease;
}

.chrome-grid-spacer span {
  padding: 2px 7px;
  border: 1px solid rgba(42, 91, 204, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  opacity: 0;
}

.chrome-grid-band:not(.is-editable) .chrome-grid-spacer {
  background: transparent;
  opacity: 1;
}

.chrome-grid-band:not(.is-editable) .chrome-grid-spacer span {
  display: none;
}

.chrome-grid-cell.is-spacer:hover .chrome-grid-spacer,
.chrome-grid-cell.is-spacer.is-selected .chrome-grid-spacer {
  opacity: 1;
  background-color: rgba(42, 91, 204, 0.035);
}

.chrome-grid-cell.is-spacer:hover .chrome-grid-spacer span,
.chrome-grid-cell.is-spacer.is-selected .chrome-grid-spacer span {
  opacity: 1;
}

.chrome-empty-cell-btn,
.chrome-cell-trash,
.chrome-row-add-row,
.chrome-band-add-row,
.chrome-cell-add-col,
.chrome-cell-resize-col,
.chrome-row-resize-row {
  min-width: 24px;
  min-height: 24px;
  border: 1px solid rgba(42, 91, 204, 0.42);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #2A5BCC;
  font-size: 14px;
  line-height: 1;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(28, 25, 23, 0.12);
  transition: opacity 120ms ease, transform 120ms ease, background-color 120ms ease, border-color 120ms ease;
}

.chrome-row-add-row,
.chrome-band-add-row,
.chrome-cell-add-col,
.chrome-cell-resize-col,
.chrome-row-resize-row {
  opacity: 0;
  pointer-events: none;
}

.chrome-empty-cell-btn:hover,
.chrome-cell-trash:hover,
.chrome-row-add-row:hover,
.chrome-band-add-row:hover,
.chrome-cell-add-col:hover,
.chrome-row-resize-row:hover {
  border-color: #2A5BCC;
  background: #FFFFFF;
}

.chrome-empty-cell-btn {
  justify-self: center;
  align-self: center;
  width: 24px;
  height: 24px;
}

.chrome-cell-trash {
  position: absolute;
  top: 50%;
  left: -42px;
  z-index: 34;
  display: inline-grid;
  place-items: center;
  width: 34px;
  min-width: 34px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  border: 1px solid rgba(214, 211, 209, 0.92);
  border-radius: 8px;
  background: #FFFFFF;
  color: #DC2626;
  box-shadow: 0 8px 18px rgba(28, 25, 23, 0.16);
  transform: translateY(-50%);
}

.chrome-cell-trash:hover {
  border-color: rgba(220, 38, 38, 0.34);
  background: #FFF7F7;
  color: #B91C1C;
  transform: translateY(calc(-50% - 1px));
}

.chrome-cell-trash.is-passive {
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) translateX(5px) scale(0.94);
}

.chrome-grid-cell:hover > .chrome-cell-trash.is-passive,
.chrome-grid-cell.is-selected > .chrome-cell-trash.is-passive {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0) scale(1);
}

.chrome-cell-trash-icon {
  width: 19px;
  height: 19px;
}

.chrome-cell-add-col {
  position: absolute;
  right: -28px;
  top: 50%;
  z-index: 26;
  display: inline-grid;
  place-items: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  transform: translateY(-50%) scale(0.92);
  font-size: 12px;
}

.chrome-cell-add-col--after-resize {
  right: -56px;
}

.chrome-cell-add-col-icon {
  width: 14px;
  height: 14px;
}

.chrome-cell-resize-col {
  position: absolute;
  right: -13px;
  top: 50%;
  z-index: 28;
  width: 26px;
  min-width: 26px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  transform: translate(50%, -50%) scale(0.92);
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: ew-resize;
  box-shadow: none;
  touch-action: none;
}

.chrome-cell-resize-col::before {
  content: "";
  position: absolute;
  inset: 6px 11px;
  border-radius: 999px;
  background: rgba(42, 91, 204, 0.62);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.92);
}

.chrome-cell-resize-col::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 18px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #FFFFFF;
  opacity: 0.9;
}

.chrome-grid-cell:hover > .chrome-cell-add-col,
.chrome-grid-cell.is-selected > .chrome-cell-add-col,
.chrome-grid-cell:hover > .chrome-cell-resize-col,
.chrome-grid-cell.is-selected > .chrome-cell-resize-col,
.chrome-grid-cell.is-resizing-col > .chrome-cell-resize-col {
  opacity: 1;
  pointer-events: auto;
}

.chrome-grid-cell:hover > .chrome-cell-add-col,
.chrome-grid-cell.is-selected > .chrome-cell-add-col {
  transform: translateY(-50%) scale(1);
}

.chrome-grid-cell:hover > .chrome-cell-resize-col,
.chrome-grid-cell.is-selected > .chrome-cell-resize-col,
.chrome-grid-cell.is-resizing-col > .chrome-cell-resize-col {
  transform: translate(50%, -50%) scale(1);
}

.chrome-grid-cell:hover > .chrome-cell-resize-col::before,
.chrome-grid-cell.is-selected > .chrome-cell-resize-col::before,
.chrome-grid-cell.is-resizing-col > .chrome-cell-resize-col::before {
  background: #2A5BCC;
}

.chrome-row-add-row {
  position: absolute;
  left: min(calc(50% + 48px), calc(100% - 18px));
  bottom: 0;
  z-index: 25;
  display: inline-grid;
  place-items: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  transform: translate(-50%, 50%) scale(0.92);
  border: 1px solid rgba(42, 91, 204, 0.5);
  border-radius: 999px;
  background: #FFFFFF;
  box-shadow: 0 3px 10px rgba(28, 25, 23, 0.12);
  color: #2A5BCC;
  font-size: 12px;
  font-weight: 800;
  overflow: visible;
}

.chrome-grid-row:hover > .chrome-row-add-row,
.chrome-grid-row.is-selected > .chrome-row-add-row,
.chrome-grid-row.is-resizing-row > .chrome-row-add-row {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 50%) scale(1);
}

.chrome-row-add-row-icon {
  width: 14px;
  height: 14px;
}

.chrome-row-resize-row {
  position: absolute;
  left: 50%;
  z-index: 27;
  width: 28px;
  min-width: 28px;
  height: 10px;
  min-height: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  cursor: ns-resize;
  touch-action: none;
}

.chrome-row-resize-row--top {
  top: 0;
  transform: translate(-50%, -50%) scale(0.94);
}

.chrome-row-resize-row--bottom {
  bottom: 0;
  transform: translate(-50%, 50%) scale(0.94);
}

.chrome-row-resize-row::before {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: rgba(42, 91, 204, 0.68);
  box-shadow: 0 0 0 2px #FFFFFF, 0 3px 10px rgba(28, 25, 23, 0.12);
}

.chrome-row-resize-row::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 2px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #FFFFFF;
}

.chrome-grid-row:hover > .chrome-row-resize-row,
.chrome-grid-row.is-selected > .chrome-row-resize-row,
.chrome-grid-row.has-selected-cell > .chrome-row-resize-row,
.chrome-grid-row.is-resizing-row > .chrome-row-resize-row {
  opacity: 1;
  pointer-events: auto;
}

.chrome-grid-row:hover > .chrome-row-resize-row--top,
.chrome-grid-row.is-selected > .chrome-row-resize-row--top,
.chrome-grid-row.has-selected-cell > .chrome-row-resize-row--top,
.chrome-grid-row.is-resizing-row > .chrome-row-resize-row--top {
  transform: translate(-50%, -50%) scale(1);
}

.chrome-grid-row:hover > .chrome-row-resize-row--bottom,
.chrome-grid-row.is-selected > .chrome-row-resize-row--bottom,
.chrome-grid-row.has-selected-cell > .chrome-row-resize-row--bottom,
.chrome-grid-row.is-resizing-row > .chrome-row-resize-row--bottom {
  transform: translate(-50%, 50%) scale(1);
}

.chrome-grid-row.is-resizing-row > .chrome-row-resize-row::before {
  background: #2A5BCC;
}

.chrome-band-add-row {
  display: none;
  position: absolute;
  left: 50%;
  bottom: -15px;
  z-index: 22;
  height: 24px;
  padding: 0 10px;
  transform: translateX(-50%) scale(0.94);
  color: #2A5BCC;
  font-size: 10px;
}

.chrome-inline-popover {
  position: fixed;
  z-index: 10030;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(214, 211, 209, 0.92);
  border-radius: 8px;
  background: #FFFFFF;
  box-shadow: 0 10px 24px rgba(28, 25, 23, 0.14), 0 2px 6px rgba(28, 25, 23, 0.06);
}

.chrome-inline-popover button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: #F5F5F4;
  color: #1C1917;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}

/* Chrome direct editing */
.chrome-selection-toolbar {
  position: fixed;
  z-index: 10020;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px;
  border: 1px solid rgba(214, 211, 209, 0.92);
  border-radius: 10px;
  background: #FFFFFF;
  box-shadow: 0 14px 32px rgba(28, 25, 23, 0.16), 0 2px 6px rgba(28, 25, 23, 0.06);
  color: #1C1917;
  font-family: "Space Grotesk", system-ui, sans-serif;
  overflow: visible;
  pointer-events: none;
}

.chrome-toolbar-kind {
  flex: 0 0 auto;
  max-width: 74px;
  padding: 0 7px;
  color: #78716C;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chrome-toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: #E7E5E4;
  flex: 0 0 auto;
}

.chrome-toolbar-btn {
  flex: 0 0 auto;
  height: 28px;
  min-width: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1C1917;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.chrome-toolbar-btn[title="Done"] {
  min-width: 42px;
  padding: 0 9px;
  background: #F5F5F4;
}

.chrome-toolbar-svg {
  width: 15px;
  height: 15px;
}

.chrome-align-icon,
.chrome-valign-icon {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  color: currentColor;
}

.chrome-align-icon::before,
.chrome-align-icon::after,
.chrome-align-icon {
  background-repeat: no-repeat;
}

.chrome-align-icon {
  background-image:
    linear-gradient(currentColor, currentColor),
    linear-gradient(currentColor, currentColor),
    linear-gradient(currentColor, currentColor);
  background-size: 14px 2px, 10px 2px, 12px 2px;
  background-position: 1px 3px, 1px 7px, 1px 11px;
}

.chrome-align-icon--center {
  background-position: 1px 3px, 3px 7px, 2px 11px;
}

.chrome-align-icon--right {
  background-position: 1px 3px, 5px 7px, 3px 11px;
}

.chrome-valign-icon {
  border-radius: 2px;
}

.chrome-valign-icon::before {
  content: "";
  position: absolute;
  left: 2px;
  right: 2px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.65;
}

.chrome-valign-icon::after {
  content: "";
  position: absolute;
  left: 4px;
  right: 4px;
  height: 5px;
  border-radius: 1px;
  background: currentColor;
}

.chrome-valign-icon--top::before {
  top: 2px;
}

.chrome-valign-icon--top::after {
  top: 5px;
}

.chrome-valign-icon--middle::before {
  top: 7px;
}

.chrome-valign-icon--middle::after {
  top: 5px;
}

.chrome-valign-icon--bottom::before {
  bottom: 2px;
}

.chrome-valign-icon--bottom::after {
  bottom: 5px;
}

.chrome-padding-popover {
  position: absolute;
  right: 44px;
  bottom: calc(100% + 8px);
  display: grid;
  grid-template-columns: auto;
  gap: 5px;
  padding: 8px;
  border: 1px solid rgba(214, 211, 209, 0.92);
  border-radius: 9px;
  background: #FFFFFF;
  box-shadow: 0 12px 26px rgba(28, 25, 23, 0.16), 0 2px 6px rgba(28, 25, 23, 0.06);
}

.chrome-padding-title {
  padding: 0 4px;
  color: #78716C;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.chrome-padding-side {
  display: grid;
  grid-template-columns: 48px 28px 24px 28px;
  align-items: center;
  gap: 4px;
}

.chrome-padding-side span {
  padding: 0;
  color: #44403C;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: none;
}

.chrome-padding-popover button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: #F5F5F4;
  color: #1C1917;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}

.chrome-padding-popover output {
  min-width: 18px;
  color: #1C1917;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.chrome-toolbar-btn:hover {
  background: #F5F5F4;
}

.chrome-toolbar-btn.is-active {
  background: #1C1917;
  color: #FFFFFF;
}

.chrome-toolbar-btn--italic {
  font-style: italic;
}

.chrome-toolbar-btn--danger {
  color: #B5251D;
}

.chrome-toolbar-color {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
}

.chrome-toolbar-color:hover {
  background: #F5F5F4;
}

.chrome-toolbar-color input {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid #D6D3D1;
  border-radius: 4px;
  background: transparent;
}

.chrome-toolbar-pointer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-style: solid;
}

.chrome-band-layer {
  position: absolute;
  inset: 4px;
  z-index: 7;
  pointer-events: none;
  border: 1.5px dashed transparent;
  border-radius: 2px;
}

.chrome-band-layer.is-active {
  border-color: rgba(42, 91, 204, 0.5);
}

.chrome-grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.8;
}

.chrome-section-chip {
  position: absolute;
  top: -26px;
  right: 0;
  z-index: 8;
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: #2A5BCC;
  color: white;
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  pointer-events: auto;
}

.chrome-section-chip--footer {
  top: auto;
  bottom: -26px;
}

.chrome-section-chip--rail {
  top: 10px;
  left: 10px;
  right: auto;
}

.chrome-section-settings {
  position: absolute;
  top: 4px;
  left: 52px;
  z-index: 9;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid #E7E5E4;
  border-radius: 6px;
  background: #FFFFFF;
  color: #44403C;
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-size: 9px;
  font-weight: 800;
  pointer-events: auto;
  box-shadow: 0 4px 14px rgba(28, 25, 23, 0.12);
}

.chrome-section-settings--footer {
  top: auto;
  bottom: 4px;
}

.chrome-section-settings button {
  height: 22px;
  min-width: 24px;
  padding: 0 5px;
  border: 0;
  border-radius: 4px;
  background: #F5F5F4;
  color: #44403C;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
}

.chrome-section-settings label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding-left: 4px;
}

.chrome-section-settings input {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
}

.chrome-insert-btn {
  position: absolute;
  left: 18px;
  top: 50%;
  z-index: 9;
  width: 24px;
  height: 24px;
  transform: translateY(-50%);
  border: 1px solid #2A5BCC;
  border-radius: 999px;
  background: #FFFFFF;
  color: #2A5BCC;
  font-size: 17px;
  line-height: 20px;
  font-weight: 800;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 3px 10px rgba(28, 25, 23, 0.16);
}

.chrome-section-reset-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 9;
  height: 26px;
  padding: 0 9px;
  border: 1px solid #D6D3D1;
  border-radius: 4px;
  background: #FFFFFF;
  color: #44403C;
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 3px 10px rgba(28, 25, 23, 0.12);
}

.chrome-section-reset-btn--footer {
  top: 8px;
  bottom: auto;
}

.chrome-band-resize-handle {
  position: absolute;
  left: 50%;
  z-index: 10;
  width: min(120px, 40%);
  height: 44px;
  transform: translateX(-50%);
  cursor: ns-resize;
  pointer-events: auto;
  touch-action: none;
}

.chrome-band-resize-handle::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 64px;
  height: 7px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #2A5BCC;
  box-shadow: 0 0 0 2px #FFFFFF, 0 4px 10px rgba(28, 25, 23, 0.18);
}

.chrome-band-resize-handle--header {
  bottom: -25px;
}

.chrome-band-resize-handle--footer {
  top: -25px;
}

.chrome-custom-block {
  outline-color: rgba(42, 91, 204, 0.48);
}

.chrome-custom-block.is-selected-text {
  outline-color: #2A5BCC;
  background: rgba(42, 91, 204, 0.06);
}

.chrome-mobile-drawer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10030;
  height: min(300px, 48vh);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 12px 12px;
  border-top: 1px solid #E7E5E4;
  border-radius: 14px 14px 0 0;
  background: #FFFFFF;
  box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.18);
  font-family: "Space Grotesk", system-ui, sans-serif;
}

.chrome-mobile-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #D6D2C8;
  align-self: center;
}

.chrome-mobile-head,
.chrome-mobile-actions,
.chrome-mobile-chip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chrome-mobile-head {
  justify-content: space-between;
  color: #78716C;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.chrome-mobile-head button,
.chrome-mobile-chip-row button,
.chrome-mobile-actions button {
  min-height: 34px;
  border: 1px solid #E7E5E4;
  border-radius: 7px;
  background: #FAFAF9;
  color: #1C1917;
  font-size: 12px;
  font-weight: 700;
}

.chrome-mobile-input {
  width: 100%;
  border: 1px solid #E7E5E4;
  border-radius: 7px;
  background: #F7F4EE;
  color: #1C1917;
  padding: 10px 12px;
  font-size: 16px;
  outline: none;
}

.chrome-mobile-chip-row {
  overflow-x: auto;
  padding-bottom: 4px;
}

.chrome-mobile-chip-row button,
.chrome-mobile-chip-row label {
  flex: 0 0 auto;
  padding: 7px 10px;
  border-radius: 999px;
  background: #FAFAF9;
  border: 1px solid #E7E5E4;
  font-size: 12px;
  font-weight: 800;
}

.chrome-mobile-chip-row .active {
  background: #1C1917;
  color: #FFFFFF;
}

.chrome-mobile-actions {
  margin-top: auto;
  flex-wrap: wrap;
}

.chrome-mobile-actions button {
  flex: 1 1 calc(33.333% - 6px);
  padding: 0 8px;
  white-space: nowrap;
}

.chrome-mobile-actions .danger {
  color: #B5251D;
}

.chrome-editor-app-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 10045;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: 52px;
  padding: 0 22px;
  background: rgba(51, 51, 49, 0.98);
  color: #FFFFFF;
  font-family: "Space Grotesk", system-ui, sans-serif;
  box-shadow: 0 8px 26px rgba(28, 25, 23, 0.2);
}

.chrome-editor-app-action,
.chrome-editor-add-button {
  min-height: 36px;
  padding: 0 3px;
  border: 0;
  background: transparent;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
}

.chrome-editor-app-action {
  justify-self: start;
}

.chrome-editor-add-button {
  justify-self: end;
}

.chrome-editor-add-button:hover,
.chrome-editor-add-button.is-active,
.chrome-editor-app-action:hover {
  color: #DCEBE2;
}

.chrome-editor-app-title {
  justify-self: center;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
  font-weight: 750;
}

.chrome-add-block-panel {
  position: fixed;
  top: 66px;
  right: 18px;
  z-index: 10046;
  display: grid;
  gap: 10px;
  width: min(284px, calc(100vw - 36px));
  padding: 10px;
  border: 1px solid rgba(214, 211, 209, 0.88);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.98);
  color: #1C1917;
  font-family: "Space Grotesk", system-ui, sans-serif;
  box-shadow: 0 16px 38px rgba(28, 25, 23, 0.18);
}

.chrome-add-block-section {
  color: #1C1917;
  font-size: 12px;
  font-weight: 900;
}

.chrome-add-block-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.chrome-add-block-card {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #F5F5F4;
  color: #1C1917;
  font-size: 12px;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease, transform 120ms ease;
}

.chrome-add-block-card:hover {
  border-color: rgba(42, 91, 204, 0.34);
  background: #EEF4FF;
  transform: translateY(-1px);
}

.chrome-add-block-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: #1C1917;
}

.chrome-layout-builder {
  position: fixed;
  top: 68px;
  left: 50%;
  z-index: 10044;
  display: flex;
  align-items: center;
  gap: 8px;
  width: auto;
  max-width: min(920px, calc(100vw - 40px));
  min-height: 48px;
  padding: 8px;
  transform: translateX(-50%);
  border: 1px solid rgba(214, 211, 209, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  color: #1C1917;
  font-family: "Space Grotesk", system-ui, sans-serif;
  box-shadow: 0 16px 34px rgba(28, 25, 23, 0.18);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  overflow: visible;
}

.chrome-layout-builder.is-dragging {
  cursor: grabbing;
}

.chrome-context-handle {
  display: grid;
  grid-template-columns: repeat(2, 5px);
  grid-template-rows: repeat(2, 5px);
  gap: 4px;
  place-content: center;
  flex: 0 0 auto;
  width: 26px;
  height: 34px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1C1917;
  cursor: grab;
  touch-action: none;
}

.chrome-context-handle:hover {
  background: #F5F5F4;
  color: #1D4FA3;
}

.chrome-context-handle:active {
  cursor: grabbing;
}

.chrome-context-handle span {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
}

.chrome-layout-builder-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chrome-layout-builder-main--content {
  flex: 1 1 auto;
}

.chrome-layout-divider {
  width: 1px;
  align-self: stretch;
  min-height: 28px;
  background: #E7E5E4;
}

.chrome-layout-mini-divider {
  width: 1px;
  align-self: stretch;
  min-height: 28px;
  margin: 0 2px;
  background: #E7E5E4;
}

.chrome-layout-builder-group,
.chrome-layout-builder-spacing {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chrome-layout-builder-group--primary {
  padding: 0 6px;
  border-right: 1px solid #E7E5E4;
  border-left: 1px solid #E7E5E4;
}

.chrome-layout-builder-group button,
.chrome-layout-builder-primary,
.chrome-layout-stepper button,
.chrome-layout-more summary {
  height: 34px;
  min-width: 32px;
  padding: 0 8px;
  border: 1px solid #D6D3D1;
  border-radius: 6px;
  background: #FFFFFF;
  color: #44403C;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.chrome-layout-builder-group button:hover:not(:disabled),
.chrome-layout-builder-primary:hover,
.chrome-layout-stepper button:hover:not(:disabled),
.chrome-layout-more summary:hover {
  border-color: #2A5BCC;
  color: #1D4FA3;
}

.chrome-layout-builder-group button.active,
.chrome-layout-builder-group button.is-primary {
  border-color: #2A5BCC;
  background: #E7EEF8;
  color: #1D4FA3;
}

.chrome-layout-builder-group button:disabled,
.chrome-layout-stepper button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.chrome-layout-icon {
  width: 17px;
  height: 17px;
}

.chrome-layout-more {
  position: relative;
  flex: 0 0 auto;
}

.chrome-layout-more summary {
  display: inline-grid;
  place-items: center;
  list-style: none;
}

.chrome-layout-more summary::-webkit-details-marker {
  display: none;
}

.chrome-layout-more[open] summary {
  border-color: #2A5BCC;
  background: #1D4FA3;
  color: #FFFFFF;
}

.chrome-layout-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  gap: 8px;
  width: min(420px, calc(100vw - 32px));
  padding: 10px;
  border: 1px solid rgba(214, 211, 209, 0.96);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 14px 34px rgba(28, 25, 23, 0.18);
}

.chrome-layout-builder.is-popover-above .chrome-layout-popover {
  top: auto;
  bottom: calc(100% + 8px);
}

.chrome-layout-builder.is-popover-left .chrome-layout-popover {
  right: auto;
  left: 0;
}

.chrome-layout-popover .chrome-layout-builder-group,
.chrome-layout-popover .chrome-layout-builder-spacing {
  flex-wrap: wrap;
  padding: 0;
  border: 0;
}

.chrome-layout-color {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid #D6D3D1;
  border-radius: 6px;
  background: #FFFFFF;
}

.chrome-layout-color input {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
}

.chrome-layout-builder-spacing {
  align-items: flex-start;
  gap: 6px;
}

.chrome-layout-builder-spacing > span {
  color: #78716C;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.chrome-layout-stepper {
  display: grid;
  grid-template-columns: auto 24px 20px 24px;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 3px 0 7px;
  border: 1px solid #E7E5E4;
  border-radius: 6px;
  background: #FAFAF9;
}

.chrome-layout-stepper label {
  color: #78716C;
  font-size: 10px;
  font-weight: 800;
}

.chrome-layout-stepper output {
  color: #1C1917;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}

.chrome-layout-stepper button {
  width: 24px;
  min-width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 5px;
}

@media (min-width: 1024px) {
  .chrome-add-block-panel {
    right: 356px;
  }

  .chrome-layout-builder {
    left: calc((100vw - 344px) / 2);
    max-width: min(760px, calc(100vw - 390px));
  }
}

/* Text overlay layer */
.overlay-layer,
.asset-layer,
.icon-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 25;
}

.image-asset {
  position: absolute;
}

.icon-overlay {
  position: absolute;
  display: grid;
  place-items: center;
}

.icon-overlay svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.image-asset img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.image-asset.is-editable,
.icon-overlay.is-editable {
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
.image-asset.is-editable:hover,
.icon-overlay.is-editable:hover {
  outline-color: rgba(45, 106, 79, 0.35);
}

.text-overlay.is-editable.is-selected,
.image-asset.is-editable.is-selected,
.icon-overlay.is-editable.is-selected {
  outline-color: rgba(45, 106, 79, 0.65);
}

.text-overlay.is-poster-v2,
.image-asset.is-poster-v2,
.icon-overlay.is-poster-v2 {
  outline-style: solid;
}

.poster-element-moveable {
  --moveable-color: #2A5BCC;
  z-index: 10020;
}

:deep(.poster-element-moveable .moveable-control) {
  width: 14px;
  height: 14px;
  margin-top: -7px;
  margin-left: -7px;
  border: 2px solid #fff;
  background: #2A5BCC;
  box-shadow: 0 2px 8px rgba(28, 25, 23, 0.22);
}

:deep(.poster-element-moveable .moveable-line) {
  background: #2A5BCC;
}

.poster-editor-guides {
  position: absolute;
  inset: 0;
  z-index: 24;
  pointer-events: none;
}

.poster-editor-guide {
  position: absolute;
  display: block;
}

.poster-editor-guide--safe {
  inset: 4%;
  border: 1px solid rgba(42, 91, 204, 0.48);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.38);
}

.poster-editor-guide--center-v,
.poster-editor-guide--third-v {
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed rgba(42, 91, 204, 0.36);
}

.poster-editor-guide--center-h,
.poster-editor-guide--third-h {
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgba(42, 91, 204, 0.36);
}

.poster-editor-guide--center-v {
  left: 50%;
}

.poster-editor-guide--center-h {
  top: 50%;
}

.poster-editor-guide--third-v-1 {
  left: 33.333%;
}

.poster-editor-guide--third-v-2 {
  left: 66.666%;
}

.poster-editor-guide--third-h-1 {
  top: 33.333%;
}

.poster-editor-guide--third-h-2 {
  top: 66.666%;
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
.image-asset.is-editable.is-dragging .overlay-move-handle,
.image-asset.is-editable.is-dragging .overlay-delete-btn,
.image-asset.is-editable.is-dragging .overlay-resize-handle {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto !important;
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

.legend-text {
  display: flex;
  flex-direction: column;
  gap: 0.12cqh;
  min-width: 0;
}

.legend-meta {
  white-space: nowrap;
}

:deep(.maplibregl-canvas.segment-point-dragging) {
  cursor: grabbing !important;
}

:deep(.maplibregl-canvas.segment-point-hover) {
  cursor: grab !important;
}

:deep(.maplibregl-canvas.segment-point-bend-hover) {
  cursor: move !important;
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
