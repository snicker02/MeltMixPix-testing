// js/main.js (Sequential Pre-Effect Logic with History - Revised Render Flow)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// --- History Utils Import (We'll adapt its usage) ---
import {
    updateUndoRedoButtons, clearHistory as clearHistoryState, // Renamed import
    // pushHistoryState, undo as historyUndo, redo as historyRedo // We'll handle history logic directly for now
} from './utils/historyUtils.js';

// --- Effect Imports ---
// (Remain the same)
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


// --- DOM Element References ---
// (This object should be populated inside initializeApp as fixed before)
let elements = {};

// --- State Variables ---
// (History now stores {effect, params} objects)
let state = {
    currentImage: null,
    originalFileName: 'downloaded-image.png',
    originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
    isProcessing: false, debounceTimer: null, isDragging: false,
    dragStartX: 0, dragStartY: 0,
    currentOffsetX: 0, currentOffsetY: 0,
    startOffsetX: 0, startOffsetY: 0,
    sourceZoomLevel: 1.0,
    sourceEffectCtx: null, // Will be set in initializeApp
    // History State (Stores effect settings)
    history: [],             // Array of { effect: string, params: object }
    historyIndex: -1,        // Index of the last *applied* effect in the history array
    ctx: null // Context alias for history utils (if needed later)
};

 // --- Effect Function Map ---
 const effectFunctions = { /* ... (remain the same) ... */ };

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

    // Ensure canvas is correct size
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
                // Get current canvas data (result of previous step)
                const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 // Store the state *before* this effect as the source for sampling within the effect
                 const sourceForThisEffect = new ImageData(new Uint8ClampedArray(currentImageData.data), canvas.width, canvas.height);
                const effectContext = { sourceImageData: sourceForThisEffect };

                // Apply effect IN PLACE on currentImageData
                effectFunction(currentImageData, historyEntry.params, effectContext);
                // Put modified data back
                ctx.putImageData(currentImageData, 0, 0);
            } catch (e) {
                 console.error(`renderHistoryAndPreview: Error applying history effect '${historyEntry.effect}':`, e);
                 showMessage(`Error applying history effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
                 // Stop processing this sequence? Or continue? Let's stop.
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
             // Get current canvas data (result of history stack)
            const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Store the state *before* this preview effect as the source for sampling
            const sourceForThisEffect = new ImageData(new Uint8ClampedArray(currentImageData.data), canvas.width, canvas.height);
            const effectContext = { sourceImageData: sourceForThisEffect };

            // Apply effect IN PLACE on currentImageData
            currentEffectFunction(currentImageData, currentParams, effectContext);
            // Put modified data back for the preview
            ctx.putImageData(currentImageData, 0, 0);
            console.log(`  Live preview effect ${currentEffect} applied.`);
        } catch (e) {
             console.error(`renderHistoryAndPreview: Error applying live preview effect '${currentEffect}':`, e);
             showMessage(`Error applying live preview: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             // Don't return, just skip the preview effect
        }
    } else {
         console.log("  No live preview effect selected ('none').");
    }

    // 4. Update the final tiled preview using the source canvas (now showing history + live preview)
    console.log("  Calling processAndPreviewImage for final tiling.");
    processAndPreviewImage(
        elements.sourceEffectCanvas, elements, state,
        (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
    );

    state.isProcessing = false; // Mark processing complete
    console.log("renderHistoryAndPreview finished.");
}


/**
 * Debounced wrapper for renderHistoryAndPreview.
 */
function requestRenderHistoryAndPreview() {
    console.log('[MainApp] requestRenderHistoryAndPreview called.');
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
    state.historyIndex++; // Move index to the newly applied state

    console.log(`Pushed to history[${state.historyIndex}]:`, historyEntry);

    // Limit history size (optional, could be done in historyUtils)
    const MAX_HISTORY = 10;
    if (state.history.length > MAX_HISTORY) {
        state.history.shift();
        state.historyIndex--; // Adjust index since we removed the first element
         console.log("History limit reached, removed oldest entry.");
    }

    updateUndoRedoButtons(elements, state); // Update button states

    // Re-render to show the committed state (might be visually the same as preview)
    renderHistoryAndPreview();

    showMessage(`Effect "${effect}" applied.`, false, elements.messageBox);
}

/**
 * Handles clicks on the Undo button.
 */
function handleUndoClick() {
    console.log('[MainApp] Undo button clicked.');
    if (state.historyIndex >= 0) { // Can only undo if not at the beginning
        state.historyIndex--;
        console.log(`Undo: History index now ${state.historyIndex}`);
        updateUndoRedoButtons(elements, state);
        renderHistoryAndPreview(); // Re-render state up to the new index
    } else {
         console.log("Undo: Already at oldest state.");
    }
}

/**
 * Handles clicks on the Redo button.
 */
function handleRedoClick() {
    console.log('[MainApp] Redo button clicked.');
    if (state.historyIndex < state.history.length - 1) { // Can only redo if not at the latest state
        state.historyIndex++;
        console.log(`Redo: History index now ${state.historyIndex}`);
        updateUndoRedoButtons(elements, state);
        renderHistoryAndPreview(); // Re-render state up to the new index
    } else {
         console.log("Redo: Already at newest state.");
    }
}


// Get Current Effect Parameters (Reads from UI) - (No changes needed)
function getCurrentEffectAndParams() { /* ... same as before ... */ }

// Modified Event Handlers to call requestRenderHistoryAndPreview

function handleSliderChange() {
    console.log('[MainApp] handleSliderChange called (likely Tiling slider).');
    // Update value spans (unchanged)
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    // ... etc ...
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);

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

// Modified handleImageLoad to clear new history structure
function handleImageLoad(event) {
    console.log("handleImageLoad: Function triggered.");

    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => { // Pass the correct clear logic
            state.history = []; state.historyIndex = -1; updateUndoRedoButtons(elements, state);
        }
    );

    const file = event.target.files?.[0];
    if (!file) { /*...*/ resetFunc(); return; }
    if (!file.type.startsWith('image/')) { /*...*/ resetFunc(); return; }

    state.originalFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img;
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            if (!state.originalWidth || !state.originalHeight) { /*...*/ resetFunc(); return; }

            // Update UI elements (unchanged)
             if(elements.outputWidthInput) elements.outputWidthInput.value = state.originalWidth;
            // ... etc ...
            if(elements.sourcePreview) { elements.sourcePreview.src = e.target.result; elements.sourcePreview.classList.remove('hidden'); }
            if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
            if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';

            // Reset pan/zoom state (unchanged)
            state.currentOffsetX = 0; state.currentOffsetY = 0; state.startOffsetX = 0; state.startOffsetY = 0;
            state.sourceZoomLevel = 1.0;
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
            if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

            requestAnimationFrame(() => {
                if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) { /* ... error handling ... */ resetFunc(); return; }
                 // Apply initial transform
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                // --- Initialize History ---
                state.history = []; // Clear history array
                state.historyIndex = -1; // Reset index
                console.log("History cleared on image load.");
                updateUndoRedoButtons(elements, state); // Update buttons

                // Enable controls (unchanged)
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

                // Update UI visibility
                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);

                // Trigger initial render
                renderHistoryAndPreview(); // Use the new render function

                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox);
            });
        };
        img.onerror = () => { /* ... */ resetFunc(); };
        img.src = e.target.result;
    };
    reader.onerror = () => { /* ... */ resetFunc(); };
    reader.readAsDataURL(file);
}

// saveImage function remains unchanged
function saveImage() { /* ... */ }

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
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); }); // Calls new request func

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

     // Populate elements object AFTER DOM is ready
      elements = { /* ... (same definition as previous step, ensuring all IDs are correct) ... */ };
      // Repopulate grouped sliders/selects based on found elements
      elements.sliders = [ /* ... */ ].filter(el => el !== null);
      elements.selects = [ /* ... */ ].filter(el => el !== null);

     // Initialize State Object AFTER elements are defined
     state = {
         currentImage: null, originalFileName: 'downloaded-image.png',
         originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
         isProcessing: false, debounceTimer: null, isDragging: false,
         dragStartX: 0, dragStartY: 0, currentOffsetX: 0, currentOffsetY: 0,
         startOffsetX: 0, startOffsetY: 0, sourceZoomLevel: 1.0,
         sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }),
         history: [], historyIndex: -1,
         ctx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true })
     };

     // Define reset callbacks AFTER state and elements are defined
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange,
         clearHistory: () => { // Define clear logic correctly here
             state.history = []; state.historyIndex = -1; updateUndoRedoButtons(elements, state);
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
          showMessage("Initialization Error: Cannot get canvas context.", true, elements.messageBox);
     } else {
          console.log("[MainApp] Canvas context acquired successfully.");
     }

     setupEventListeners(); // Setup listeners AFTER elements/state are ready
     updateUndoRedoButtons(elements, state); // Initial button state
     console.log("Image Tiler Initialized with Sequential Effects & History");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
