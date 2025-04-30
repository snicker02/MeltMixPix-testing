// js/main.js (Sequential Pre-Effect Logic with History - Revised Render Flow + Init Fix + Diagnostics)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// --- History Utils Import (Adapting usage) ---
import {
    updateUndoRedoButtons, clearHistory as clearHistoryState,
    // pushHistoryState, // Using direct logic below
    // undo as historyUndo, // Using direct logic below
    // redo as historyRedo // Using direct logic below
} from './utils/historyUtils.js';

// --- Effect Imports ---
import { applyNoise } from './effects/noise.js';
import { applyScanLines } from './effects/scanLines.js';
import { applyWaveDistortion } from './effects/waveDistortion.js';
import { applyFractalZoom } from './effects/fractalZoom.js';
import { applySliceShift } from './effects/sliceShift.js';
import { applyPixelSort } from './effects/pixelSort.js';
import { applyChannelShift } from './effects/channelShift.js';
import { applyBlockDisplace } from './effects/blockDisplace.js';
import { applyInvertBlocks } from './effects/invertBlocks.js';
import { applySierpinski } from './effects/sierpinski.js';


// --- Global Scope: Define elements and state placeholders ---
let elements = {};
let state = {};

 // --- Effect Function Map ---
 const effectFunctions = {
    'noise': applyNoise,
    'scanLines': applyScanLines,
    'waveDistortion': applyWaveDistortion,
    'fractalZoom': applyFractalZoom,
    'sliceShift': applySliceShift,
    'pixelSort': applyPixelSort,
    'channelShift': applyChannelShift,
    'blockDisplace': applyBlockDisplace,
    'invertBlocks': applyInvertBlocks,
    'sierpinski': applySierpinski,
    'none': null
};

// --- Core Processing Functions ---

/**
 * Renders the full sequence of applied effects from history,
 * plus the currently selected effect for preview, onto the source canvas,
 * and then updates the final tiled preview.
 */
function renderHistoryAndPreview() {
    console.log(`[MainApp] renderHistoryAndPreview called. History index: ${state.historyIndex}`);
    if (!state.currentImage || !elements.sourceEffectCanvas || !state.sourceEffectCtx || state.isProcessing) {
         console.warn("renderHistoryAndPreview: Missing prerequisites.");
         return;
    }

    state.isProcessing = true; // Prevent re-entry
    const canvas = elements.sourceEffectCanvas;
    const ctx = state.sourceEffectCtx;

    if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
        canvas.width = state.originalWidth;
        canvas.height = state.originalHeight;
    }
    if (canvas.width === 0 || canvas.height === 0) {
        console.error("renderHistoryAndPreview: Canvas dimensions are zero.");
        state.isProcessing = false;
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw the panned/zoomed ORIGINAL image as the base
    const sourceRectWidth = state.originalWidth / state.sourceZoomLevel;
    const sourceRectHeight = state.originalHeight / state.sourceZoomLevel;
    const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
    const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;

    console.log(`  Drawing Base: Zoom=${state.sourceZoomLevel.toFixed(2)}, Offset=(${state.currentOffsetX.toFixed(2)}, ${state.currentOffsetY.toFixed(2)})`);
    console.log(`  SourceRect: x=${sourceRectX.toFixed(2)}, y=${sourceRectY.toFixed(2)}, w=${sourceRectWidth.toFixed(2)}, h=${sourceRectHeight.toFixed(2)}`);

    try {
        if (sourceRectWidth <= 0 || sourceRectHeight <= 0 || isNaN(sourceRectX) || isNaN(sourceRectY) || isNaN(sourceRectWidth) || isNaN(sourceRectHeight)) {
            throw new Error(`Invalid source rectangle dimensions for drawing.`);
        }
        ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
    } catch (e) {
        console.error("renderHistoryAndPreview: Error drawing source image:", e);
        showMessage("Error drawing source region.", true, elements.messageBox);
        state.isProcessing = false;
        return;
     }

     // Store the initial panned/zoomed state in case effects need it as source
     let baseImageDataForEffects = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 2. Apply effects from history sequentially
    console.log(`  Applying ${state.historyIndex + 1} effects from history...`);
    for (let i = 0; i <= state.historyIndex; i++) {
        const historyEntry = state.history[i];
        const effectFunction = effectFunctions[historyEntry.effect];
        if (effectFunction) {
            console.log(`    Applying history[${i}]: ${historyEntry.effect}`);
            try {
                const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const sourceForThisEffect = new ImageData(new Uint8ClampedArray(currentImageData.data), canvas.width, canvas.height);
                const effectContext = { sourceImageData: sourceForThisEffect };

                effectFunction(currentImageData, historyEntry.params, effectContext);
                ctx.putImageData(currentImageData, 0, 0);
            } catch (e) {
                 console.error(`renderHistoryAndPreview: Error applying history effect '${historyEntry.effect}':`, e);
                 showMessage(`Error applying history effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
                 state.isProcessing = false;
                 return;
            }
        }
    }
     console.log("  Finished applying history effects.");

    // 3. Apply the *currently selected* effect for LIVE PREVIEW (if not 'none')
    const { effect: currentEffect, params: currentParams } = getCurrentEffectAndParams();
    const currentEffectFunction = effectFunctions[currentEffect];

    if (currentEffectFunction) {
        console.log(`  Applying live preview effect: ${currentEffect}`);
        try {
            const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const sourceForThisEffect = new ImageData(new Uint8ClampedArray(currentImageData.data), canvas.width, canvas.height);
            const effectContext = { sourceImageData: sourceForThisEffect };

            currentEffectFunction(currentImageData, currentParams, effectContext);
            ctx.putImageData(currentImageData, 0, 0);
            console.log(`  Live preview effect ${currentEffect} applied.`);
        } catch (e) {
             console.error(`renderHistoryAndPreview: Error applying live preview effect '${currentEffect}':`, e);
             showMessage(`Error applying live preview: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
        }
    } else {
         console.log("  No live preview effect selected ('none').");
    }

    // 4. Update the final tiled preview using the source canvas
    console.log("  Calling processAndPreviewImage for final tiling.");
    processAndPreviewImage(
        elements.sourceEffectCanvas, elements, state,
        (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
    );

    state.isProcessing = false;
    console.log("renderHistoryAndPreview finished.");
}


/**
 * Debounced wrapper for renderHistoryAndPreview.
 */
function requestRenderHistoryAndPreview() {
    console.log('[MainApp] requestRenderHistoryAndPreview called.');
     // Add checks for elements/state readiness
    if (!elements.sourceEffectCanvas || !state.currentImage) {
        console.warn("[MainApp] requestRenderHistoryAndPreview skipped: elements or state not ready.");
        return;
    }
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
         console.log('[MainApp] Debounce timer finished. Calling renderHistoryAndPreview.');
         renderHistoryAndPreview();
    }, 150); // Adjust debounce delay as needed
}


// --- Event Handlers ---

/**
 * Handles clicks on the "Apply Pre-Effect" button.
 * Commits the currently selected effect to the history stack.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] Apply Pre-Effect button clicked.');
    if (state.isProcessing || !state.currentImage) {
        console.warn('[MainApp] Apply skipped: Prerequisites not met.');
        showMessage("Cannot apply effect now (no image or processing).", true, elements.messageBox);
        return;
    }

    const { effect, params } = getCurrentEffectAndParams();
    if (effect === 'none') {
        showMessage("Select an effect first before applying.", true, elements.messageBox);
        return;
    }

    // Truncate history if we undid previously
     if (state.historyIndex < state.history.length - 1) {
        console.log(`Truncating history from index ${state.historyIndex + 1}`);
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Add the new effect settings object to history
    const historyEntry = { effect, params };
    state.history.push(historyEntry);
    state.historyIndex++;

    console.log(`Pushed to history[${state.historyIndex}]:`, historyEntry);

    // Limit history size
    const MAX_HISTORY = 10;
    if (state.history.length > MAX_HISTORY) {
        state.history.shift();
        state.historyIndex--;
         console.log("History limit reached, removed oldest entry.");
    }

    updateUndoRedoButtons(elements, state);

    // Re-render to show the committed state
    renderHistoryAndPreview();

    showMessage(`Effect "${effect}" applied.`, false, elements.messageBox);
}

/**
 * Handles clicks on the Undo button.
 */
function handleUndoClick() {
    console.log('[MainApp] Undo button clicked.');
    if (state.historyIndex >= 0) {
        state.historyIndex--;
        console.log(`Undo: History index now ${state.historyIndex}`);
        updateUndoRedoButtons(elements, state);
        renderHistoryAndPreview(); // Re-render state up to the new index
    } else { console.log("Undo: Already at oldest state."); }
}

/**
 * Handles clicks on the Redo button.
 */
function handleRedoClick() {
    console.log('[MainApp] Redo button clicked.');
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        console.log(`Redo: History index now ${state.historyIndex}`);
        updateUndoRedoButtons(elements, state);
        renderHistoryAndPreview(); // Re-render state up to the new index
    } else { console.log("Redo: Already at newest state."); }
}


// Get Current Effect Parameters (Reads from UI)
function getCurrentEffectAndParams() {
    // Add checks for elements
    const effect = elements.preEffectSelector?.value || 'none';
    const params = {
        intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10)
    };
    switch (effect) {
        case 'waveDistortion':
            params.amplitude = parseInt(elements.preEffectWaveAmplitudeSlider?.value || 10, 10);
            params.frequency = parseInt(elements.preEffectWaveFrequencySlider?.value || 5, 10);
            params.phase = parseInt(elements.preEffectWavePhaseSlider?.value || 0, 10) * (Math.PI / 180);
            params.direction = elements.preEffectWaveDirection?.value || 'horizontal';
            params.waveType = elements.preEffectWaveType?.value || 'sine';
            break;
        case 'sliceShift':
            params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10);
            params.direction = elements.sliceShiftDirection?.value || 'horizontal';
            break;
        case 'pixelSort':
            params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10);
            params.direction = elements.pixelSortDirection?.value || 'horizontal';
            params.sortBy = elements.pixelSortBy?.value || 'brightness';
            break;
        case 'scanLines':
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10);
            break;
    }
    return { effect, params };
}

// Modified Event Handlers to call requestRenderHistoryAndPreview

function handleSliderChange() {
    console.log('[MainApp] handleSliderChange called (likely Tiling slider).');
    // Update value spans (unchanged)
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;

    requestRenderHistoryAndPreview(); // << Use the new unified update function
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    console.log(`[MainApp] Option change detected on element ID: ${target.id}, Name: ${target.name}`);

    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        if(target.name === 'tileShape' && elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange);
        requestRenderHistoryAndPreview(); // << Use the new unified update function
    } else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
         if(target.id === 'preEffectSelector' && elements.preEffectSelector) updatePreEffectControlsVisibility(elements);
        requestRenderHistoryAndPreview(); // << Use the new unified update function
    } else { console.log("[MainApp] Unhandled option change target:", target); }
}

// Modified handleImageLoad
function handleImageLoad(event) {
    console.log("handleImageLoad: Function triggered.");
    if (!elements.messageBox) {
         console.error("handleImageLoad cannot run before elements are defined.");
         alert("Error: UI elements not ready."); // Fallback alert
         return;
    }
    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => { state.history = []; state.historyIndex = -1; updateUndoRedoButtons(elements, state); }
    );

    const file = event.target.files?.[0];
    if (!file) { console.log("handleImageLoad: No file selected."); /* resetFunc(); Don't reset if just cancelled */ return; }
    if (!file.type.startsWith('image/')) { console.log("handleImageLoad: Invalid file type selected."); resetFunc(); showMessage('Please select a valid image file.', true, elements.messageBox); return; }

    state.originalFileName = file.name;
    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img;
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            if (!state.originalWidth || !state.originalHeight) { resetFunc(); showMessage('Error: Image loaded with invalid dimensions.', true, elements.messageBox); return; }

            // Update UI
            if(elements.outputWidthInput) elements.outputWidthInput.value = state.originalWidth;
            if(elements.outputHeightInput) elements.outputHeightInput.value = state.originalHeight;
            if(elements.sourcePreview) { elements.sourcePreview.src = e.target.result; elements.sourcePreview.classList.remove('hidden'); }
            if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
            if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
            state.currentOffsetX = 0; state.currentOffsetY = 0; state.startOffsetX = 0; state.startOffsetY = 0;
            state.sourceZoomLevel = 1.0;
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
            if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

            requestAnimationFrame(() => {
                if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) { resetFunc(); showMessage("Error: Cannot access drawing canvas.", true, elements.messageBox); return; }
                // Update visual transform
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                // --- Initialize History ---
                state.history = []; // Clear history array
                state.historyIndex = -1; // Reset index
                console.log("History cleared on image load.");
                updateUndoRedoButtons(elements, state);

                // Enable controls
                if(elements.saveButton) elements.saveButton.disabled = false;
                if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                elements.selects?.forEach(s => { if(s) s.disabled = false; });
                if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
                console.log("handleImageLoad: Controls enabled.");
                if (elements.preEffectSelector) console.log(` Effect selector disabled state: ${elements.preEffectSelector.disabled}`);

                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);

                // Trigger initial render
                renderHistoryAndPreview(); // Use the new render function

                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox);
            });
        };
        img.onerror = () => { resetFunc(); showMessage('Error loading image data.', true, elements.messageBox); };
        img.src = e.target.result;
    };
    reader.onerror = () => { resetFunc(); showMessage('Error reading file.', true, elements.messageBox); };
    reader.readAsDataURL(file);
}

// saveImage function remains the same
function saveImage() {
    if (!state.currentImage || state.isProcessing) { showMessage('Cannot save now.', true, elements.messageBox); return; }
    if (!elements.canvas || !elements.outputWidthInput || !elements.outputHeightInput) { showMessage('Required elements missing for save.', true, elements.messageBox); return; }
    try {
        const targetWidth = parseInt(elements.outputWidthInput.value, 10);
        const targetHeight = parseInt(elements.outputHeightInput.value, 10);
        if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) { showMessage('Invalid output dimensions specified.', true, elements.messageBox); return; }
        const outputCanvas = document.createElement('canvas'); outputCanvas.width = targetWidth; outputCanvas.height = targetHeight;
        const outputCtx = outputCanvas.getContext('2d'); if (!outputCtx) throw new Error("Could not create output canvas context.");
        outputCtx.imageSmoothingQuality = "high";
        // Save the FINAL tiled image from 'canvas', NOT the sourceEffectCanvas
        outputCtx.drawImage(elements.canvas, 0, 0, elements.canvas.width, elements.canvas.height, 0, 0, targetWidth, targetHeight);
        const dataURL = outputCanvas.toDataURL('image/png');
        const link = document.createElement('a'); link.href = dataURL;

        // --- Generate descriptive filename ---
        const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
        const mirrorType = document.querySelector('input[name="mirrorOption"]:checked')?.value || 'none';
        // Get effect string from history (more representative)
        let effectsStr = state.history.slice(0, state.historyIndex + 1).map(h => h.effect).filter(e => e && e !== 'none').join('-');
        if (effectsStr) effectsStr = `_fx-${effectsStr}`;

        const shapeMap = { grid:'grid',brick_wall:'brick',herringbone:'herring',hexagon:'hex',skewed:'skw',semi_octagon_square:'octsq',l_shape_square:'lsq',hexagon_triangle:'hextri',square_triangle:'sqtri',rhombus:'rho',basketweave:'bask'};
        const shapeStr = shapeMap[selectedShape] || 'unk';
        const mirrorStr = mirrorType !== 'none' ? `_m${mirrorType.substring(0,1)}` : '';
        const tileStr = `_t${elements.tilesXSlider?.value}x${elements.tilesYSlider?.value}`;
        const preTileStr = `_p${elements.preTileXSlider?.value}x${elements.preTileYSlider?.value}`;
        const scaleStr = `_sc${elements.scaleSlider?.value}`;
        let shapeParams = ''; if (selectedShape === 'skewed') { shapeParams = `_sk${elements.skewSlider?.value}_st${elements.staggerSlider?.value}`; }
        const baseName = state.originalFileName.substring(0, state.originalFileName.lastIndexOf('.')) || state.originalFileName;
        const extension = state.originalFileName.substring(state.originalFileName.lastIndexOf('.')) || '.png';

        link.download = `${baseName}${effectsStr}_${shapeStr}${mirrorStr}${tileStr}${preTileStr}${shapeParams}${scaleStr}_${targetWidth}x${targetHeight}${extension}`
            .replace(/_fx-/g,'_fx-') // Keep first fx-
            .replace(/_none/g,'').replace(/_fx-none/g,'')
            .replace(/__/g,'_').replace(/^_|_$/g, '');

        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showMessage('Image saved successfully!', false, elements.messageBox);
     } catch (error) { console.error('Error saving image:', error); showMessage(`Could not save the image: ${error.message}`, true, elements.messageBox); }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("setupEventListeners: Attaching listeners...");
    // Check elements exist before adding listeners
    elements.imageLoader?.addEventListener('change', handleImageLoad);
    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);

    // Tiling controls - Trigger requestRenderHistoryAndPreview
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); }); // Calls requestRenderHistoryAndPreview

    // Pre-Effect controls - Trigger requestRenderHistoryAndPreview
    elements.preEffectSelector?.addEventListener('change', (event) => { console.log(`[MainApp] Effect selector changed to: ${event.target.value}`); handleOptionChange(event); });
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestRenderHistoryAndPreview);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestRenderHistoryAndPreview);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestRenderHistoryAndPreview);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestRenderHistoryAndPreview, val => val + '°');
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange);
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestRenderHistoryAndPreview);
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestRenderHistoryAndPreview);
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);

    // Source Zoom Listener - Triggers requestRenderHistoryAndPreview
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => {
                 console.log('[MainApp] Zoom slider input. Updating transform and requesting full update.');
                 handleSourceZoom(elements, state, () => updateSourcePreviewTransform(elements, state));
                 requestRenderHistoryAndPreview(); // << Use new request func
             },
             val => parseFloat(val).toFixed(1)
         );
    }

    // Output Dimensions Listeners remain unchanged
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { /* ... */ });

    // Panning listeners - Trigger requestRenderHistoryAndPreview on endPan
     if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => { startPan(e, elements, state); });
         document.addEventListener('mousemove', (e) => { if (state.isDragging) { panMove( e, elements, state, () => updateSourcePreviewTransform(elements, state) ); } });
         const endPanHandler = () => { if (state.isDragging) { console.log('[MainApp] Pan ended. Requesting full update.'); endPan(elements, state, requestRenderHistoryAndPreview); } }; // << Use new request func
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler);
     }
     console.log("setupEventListeners: Finished attaching listeners.");
}


// --- Initial Application State ---
function initializeApp() {
     console.log("[MainApp] Initializing application...");

     // --- Populate elements object ---
      elements = { /* ... Same definition as before ... */ };
      elements.sliders = [ /* ... */ ].filter(el => el !== null);
      elements.selects = [ /* ... */ ].filter(el => el !== null);

     // --- Initialize State Object ---
     state = { /* ... Same definition as before ... */ };
     // Get context after elements defined
     state.sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
     state.ctx = state.sourceEffectCtx; // Alias

     // Define reset callbacks AFTER state and elements are defined
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange,
         clearHistory: () => { // Define clear logic correctly here
             state.history = []; state.historyIndex = -1;
             if(elements.undoButton && elements.redoButton) updateUndoRedoButtons(elements, state); // Check elements exist
         }
     };

     // Call resetState AFTER callbacks are defined
     resetState(
         elements, state,
         resetCallbacks.updateTiling, resetCallbacks.updateEffects,
         resetCallbacks.updateSliders, resetCallbacks.clearHistory
     );

     // Check context AFTER trying to get it in state init
     if (!state.ctx) {
          console.error("initializeApp: Failed to get sourceEffectCtx/ctx!");
          if (elements.messageBox) showMessage("Initialization Error: Cannot get canvas context. Cannot proceed.", true, elements.messageBox);
          else alert("CRITICAL ERROR: Cannot get canvas context AND cannot find message box.");
          return; // Prevent setup if context failed
     } else { console.log("[MainApp] Canvas context acquired successfully."); }

     setupEventListeners(); // Setup listeners AFTER elements/state are ready
     updateUndoRedoButtons(elements, state); // Initial button state
     console.log("Image Tiler Initialized with Sequential Effects & History");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
