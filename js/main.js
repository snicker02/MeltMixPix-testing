// js/main.js (Simplified Update Flow)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// --- History Utils Import --- (Keep for future, but simplify usage for now)
import {
    updateUndoRedoButtons, clearHistory, pushHistoryState, undo as historyUndo, redo as historyRedo
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
// (Remain the same, including new buttons)
const elements = { /* ... */ };

// --- State Variables ---
// (Simplify slightly - remove lastAppliedImageData for now)
const state = {
    currentImage: null,         // The original loaded Image object
    originalImageData: null,    // ImageData of the original *unmodified* loaded image (for resets/effects)
    originalFileName: 'downloaded-image.png',
    originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
    isProcessing: false, debounceTimer: null, isDragging: false,
    dragStartX: 0, dragStartY: 0,
    currentOffsetX: 0, currentOffsetY: 0,
    startOffsetX: 0, startOffsetY: 0,
    sourceZoomLevel: 1.0,
    sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }),
    // History State (ImageData based)
    history: [],
    historyIndex: -1,
    ctx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }) // Context needed by historyUtils
};

 // --- Effect Function Map ---
 // (Remain the same)
 const effectFunctions = { /* ... */ };

// --- Core Processing Functions ---

/**
 * Draws the panned/zoomed original image onto the sourceEffectCanvas,
 * then applies the currently selected effect (if any) directly to that canvas.
 * @returns {boolean} True if successful, false otherwise.
 */
function redrawSourceCanvasWithEffect() {
    console.log('[MainApp] redrawSourceCanvasWithEffect called.');
    if (!state.currentImage || !elements.sourceEffectCanvas || !state.sourceEffectCtx || !state.originalWidth || !state.originalHeight) {
         console.error("redrawSourceCanvasWithEffect: Missing prerequisites.");
         return false;
    }

    const canvas = elements.sourceEffectCanvas;
    const ctx = state.sourceEffectCtx;

    // Ensure canvas is correct size
     if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
        canvas.width = state.originalWidth;
        canvas.height = state.originalHeight;
    }
     if (canvas.width === 0 || canvas.height === 0) {
        console.error("redrawSourceCanvasWithEffect: Canvas dimensions are zero.");
        return false;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw the panned/zoomed ORIGINAL image
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
        // Draw from the original Image object
        ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
    } catch (e) {
        console.error("redrawSourceCanvasWithEffect: Error drawing source image:", e);
        showMessage("Error drawing source region.", true, elements.messageBox);
        return false;
     }

     // Store this panned/zoomed base state in case the effect needs it as 'original'
     const baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 2. Apply the *selected* effect (if not 'none') directly to the canvas
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        console.log(`  Applying effect: ${effect} with params:`, params);
        try {
            // Get current canvas data (which is the panned/zoomed original)
            const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const effectContext = {
                // Pass the panned/zoomed base state as the source for sampling
                sourceImageData: baseImageData
            };
            // Apply effect IN PLACE on currentImageData
            effectFunction(currentImageData, params, effectContext);
            // Put modified data back
            ctx.putImageData(currentImageData, 0, 0);
            console.log(`  Effect ${effect} applied.`);
        } catch (e) {
             console.error(`redrawSourceCanvasWithEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             // Optionally clear the canvas or leave the base image drawn?
             // Let's leave the base image drawn for now.
             // ctx.clearRect(0, 0, canvas.width, canvas.height);
             return false; // Indicate failure
        }
    } else {
         console.log("  No effect selected ('none'). Canvas shows panned/zoomed original.");
    }
    return true; // Success
}


/**
 * Main update function: Redraws the source canvas with pan/zoom/effect,
 * then updates the final tiled preview. (Debounced)
 */
function requestFullUpdate() {
    console.log('[MainApp] requestFullUpdate called.');
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        console.log('[MainApp] Debounce timer finished. Initiating full update.');
        if (state.currentImage && !state.isProcessing && elements.sourceEffectCanvas) {
             console.log('[MainApp] Prerequisites met.');
             if (redrawSourceCanvasWithEffect()) { // Redraw source canvas first
                 console.log('[MainApp] Source canvas redrawn, calling processAndPreviewImage.');
                 // Then update the final tiled preview using the updated source canvas
                 processAndPreviewImage(
                     elements.sourceEffectCanvas, elements, state,
                     (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
                 );
             } else {
                  console.error("[MainApp] Full update failed: Could not redraw source canvas.");
             }
        } else {
             console.warn("[MainApp] Full update skipped: Missing prerequisites.");
              if(!state.currentImage) console.log(" Skipped reason: No current image.");
             else if(state.isProcessing) console.log(" Skipped reason: Already processing.");
             else console.log(" Skipped reason: Canvas issue?");
        }
    }, 150); // Adjust debounce delay as needed
}


// --- Event Handlers ---

/**
 * Handles clicks on the "Apply Pre-Effect" button.
 * This now commits the current state (including pan/zoom/effect) to history.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] Apply Pre-Effect button clicked.');
    if (!state.currentImage || !state.sourceEffectCtx || state.isProcessing) {
        console.warn('[MainApp] Apply skipped: Prerequisites not met.');
        showMessage("Cannot apply effect now (no image or processing).", true, elements.messageBox);
        return;
    }

    // 1. Ensure the source canvas reflects the current settings *before* saving to history
    if (!redrawSourceCanvasWithEffect()) {
         showMessage("Could not apply effect due to processing error.", true, elements.messageBox);
         return; // Stop if redraw failed
    }

    // 2. Get the resulting ImageData from the canvas
     const imageDataToSave = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);

    // 3. Push this state to history
    pushHistoryState(imageDataToSave, state, updateUndoRedoButtons, elements);

    // 4. Update the final preview (might be redundant if redrawSourceCanvas includes it, but good practice)
    // processAndPreviewImage(elements.sourceEffectCanvas, elements, state, (msg, isErr) => showMessage(msg, isErr, elements.messageBox));
    // No, requestFullUpdate already triggers processAndPreviewImage after redrawSourceCanvasWithEffect

    const { effect } = getCurrentEffectAndParams();
    showMessage(`Effect "${effect || 'None'}" applied to history.`, false, elements.messageBox);
}

/**
 * Handles clicks on the Undo button.
 */
function handleUndoClick() {
    console.log('[MainApp] Undo button clicked.');
    // historyUndo modifies state.historyIndex and puts ImageData on state.ctx (sourceEffectCanvas)
    historyUndo(state, updateUndoRedoButtons, elements);
    // Update the final preview based on the restored state on sourceEffectCanvas
    processAndPreviewImage(elements.sourceEffectCanvas, elements, state, (msg, isErr) => showMessage(msg, isErr, elements.messageBox));
}

/**
 * Handles clicks on the Redo button.
 */
function handleRedoClick() {
    console.log('[MainApp] Redo button clicked.');
    // historyRedo modifies state.historyIndex and puts ImageData on state.ctx (sourceEffectCanvas)
    historyRedo(state, updateUndoRedoButtons, elements);
     // Update the final preview based on the restored state on sourceEffectCanvas
    processAndPreviewImage(elements.sourceEffectCanvas, elements, state, (msg, isErr) => showMessage(msg, isErr, elements.messageBox));
}


// Get Current Effect Parameters (Reads from UI)
// (This section remains unchanged)
function getCurrentEffectAndParams() { /* ... */ }

// --- Modified Event Handlers ---

// Sliders/options related to TILING call requestFullUpdate
function handleSliderChange() {
    console.log('[MainApp] handleSliderChange called (likely Tiling slider).');
    // Update value spans (unchanged)
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    // ... etc for other tiling sliders ...
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);

    requestFullUpdate(); // << Use the unified update function
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    console.log(`[MainApp] Option change detected on element ID: ${target.id}, Name: ${target.name}`);

    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        // Tiling changes trigger full update
        if(target.name === 'tileShape') updateTilingControlsVisibility(elements, handleSliderChange); // Update UI first if needed
        requestFullUpdate(); // << Use the unified update function
    } else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
        // Effect changes also trigger full update (no separate live preview for now)
         if(target.id === 'preEffectSelector') updatePreEffectControlsVisibility(elements); // Update UI first if needed
        requestFullUpdate(); // << Use the unified update function
    } else {
         console.log("[MainApp] Unhandled option change target:", target);
    }
}

// Modified handleImageLoad
function handleImageLoad(event) {
    console.log("handleImageLoad: Function triggered.");

    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => clearHistory(state, updateUndoRedoButtons, elements)
    );

    const file = event.target.files?.[0];
    // ... (file checks remain the same) ...

    state.originalFileName = file.name;
    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img;
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;

            if (!state.originalWidth || !state.originalHeight) { /* ... error handling ... */ return; }

            // Update output dimensions, source preview src etc. (unchanged)
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
                // Apply initial transform (unchanged)
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                // --- Initialize sourceEffectCanvas and History ---
                if (elements.sourceEffectCanvas && state.sourceEffectCtx) {
                     elements.sourceEffectCanvas.width = state.originalWidth;
                     elements.sourceEffectCanvas.height = state.originalHeight;
                    // Draw initial panned/zoomed state and store it
                    if (redrawSourceCanvasWithEffect()) { // This draws base + 'none' effect
                        try {
                             // Store the initial drawn state as originalImageData for history
                             state.originalImageData = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);

                             // Initialize History
                             clearHistory(state, updateUndoRedoButtons, elements);
                             pushHistoryState(state.originalImageData, state, updateUndoRedoButtons, elements); // Push initial state
                        } catch(histError) {
                             console.error("Error storing initial state for history:", histError);
                             showMessage("Error initializing history.", true, elements.messageBox);
                             resetFunc(); return;
                        }

                    } else {
                        console.error("Error drawing initial image.");
                        showMessage("Error preparing initial image.", true, elements.messageBox);
                        resetFunc(); return;
                    }
                } else { /* ... context error handling ... */ resetFunc(); return; }
                // --- End Init ---


                // Enable controls (unchanged)
                if(elements.saveButton) elements.saveButton.disabled = false;
                if(elements.applyEffectButton) elements.applyEffectButton.disabled = false; // Enable Apply button
                // Undo/Redo buttons are handled by updateUndoRedoButtons
                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                // ... enable other controls ...
                 elements.selects?.forEach(s => { if(s) s.disabled = false; }); // Ensure selects (like effect dropdown) are enabled
                 console.log("handleImageLoad: Enabling effect selector:", elements.preEffectSelector); // Add specific log
                 if (elements.preEffectSelector) elements.preEffectSelector.disabled = false; // Explicitly enable

                // Update UI visibility and trigger initial full render (unchanged)
                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);
                requestFullUpdate(); // Use the unified update

                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox);
            });
        };
        img.onerror = () => { /* ... */ };
        img.src = e.target.result;
    };
    reader.onerror = () => { /* ... */ };
    reader.readAsDataURL(file);
}

// saveImage function remains unchanged
function saveImage() { /* ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() {
    elements.imageLoader?.addEventListener('change', handleImageLoad);
    elements.saveButton?.addEventListener('click', saveImage);

    // --- Button Listeners ---
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);

    // Tiling controls - Trigger requestFullUpdate
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); }); // Calls requestFullUpdate via handleSliderChange

    // Pre-Effect controls - Trigger requestFullUpdate
    elements.preEffectSelector?.addEventListener('change', (event) => { // Added specific log
         console.log(`[MainApp] Effect selector changed to: ${event.target.value}`);
         handleOptionChange(event);
    });
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate); // << Use requestFullUpdate
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate); // << Use requestFullUpdate
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate); // << Use requestFullUpdate
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°'); // << Use requestFullUpdate
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange);
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate); // << Use requestFullUpdate
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate); // << Use requestFullUpdate
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);


    // Source Zoom Listener - Triggers requestFullUpdate after visual update
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider,
             elements.sourceZoomValueSpan,
             () => {
                 console.log('[MainApp] Zoom slider input. Updating transform and requesting full update.');
                 handleSourceZoom( // Updates state and visual transform
                     elements, state,
                     () => updateSourcePreviewTransform(elements, state)
                 );
                 requestFullUpdate(); // << Use the unified update function
             },
             val => parseFloat(val).toFixed(1)
         );
    } else { /* ... warning ... */ }

    // Output Dimensions Listeners remain unchanged
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { /* ... */ });

    // Panning listeners - Trigger requestFullUpdate on endPan
     if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => { startPan(e, elements, state); });
         document.addEventListener('mousemove', (e) => {
             if (!state.isDragging) return;
             panMove( e, elements, state, () => updateSourcePreviewTransform(elements, state) );
         });
         const endPanHandler = () => {
            if (!state.isDragging) return;
             console.log('[MainApp] Pan ended. Requesting full update.');
             endPan(elements, state, requestFullUpdate); // << Use the unified update function
         };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler);
     } else { /* ... warning ... */ }


     console.log("setupEventListeners: Finished attaching listeners.");
}


// --- Initial Application State ---
function initializeApp() {
     console.log("[MainApp] Initializing application...");
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange,
         clearHistory: () => clearHistory(state, updateUndoRedoButtons, elements) // Pass actual clear function
     };
     resetState(
         elements, state,
         resetCallbacks.updateTiling, resetCallbacks.updateEffects,
         resetCallbacks.updateSliders, resetCallbacks.clearHistory
     );
     if (!state.ctx && elements.sourceEffectCanvas) {
         state.ctx = elements.sourceEffectCanvas.getContext('2d', { willReadFrequently: true });
         if (!state.sourceEffectCtx) state.sourceEffectCtx = state.ctx;
     }
     if (!state.ctx) { console.error("initializeApp: Failed to get sourceEffectCtx/ctx!"); showMessage("Initialization Error: Cannot get canvas context.", true, elements.messageBox); }
     setupEventListeners();
     updateUndoRedoButtons(elements, state); // Initial button state
     console.log("Image Tiler Initialized with Sequential Effects & History");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
