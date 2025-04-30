// js/main.js (Includes Stacking Effects in redrawSourceCanvasWithEffect AND Pan/Zoom logic in requestFullUpdate)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
import {
    updateUndoRedoButtons, clearHistory, pushHistoryState, undo as historyUndo, redo as historyRedo
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
let elements = {}; // Initialize as empty object
let state = {};    // Initialize as empty object

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
    'none': null // Important for handling 'None' selection
};

// --- Core Processing Functions ---

/**
 * Redraws the sourceEffectCanvas for applying/previewing effects.
 * MODIFIED FOR STACKING:
 * 1. Starts with the state from the current history index.
 * 2. Applies the *currently selected* pre-effect (from UI controls) on top of that state.
 * This is used for live preview updates and *before* saving the stacked result to history on Apply.
 * @returns {boolean} True if successful, false otherwise.
 */
function redrawSourceCanvasWithEffect() {
    console.log('[MainApp] redrawSourceCanvasWithEffect called (STACKING version).');
    if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) {
         console.error("redrawSourceCanvasWithEffect: Missing prerequisites (canvas or context).");
         return false;
    }
     // Check if we have dimensions either from original image or history
    const currentWidth = state.originalWidth || state.history[state.historyIndex]?.width;
    const currentHeight = state.originalHeight || state.history[state.historyIndex]?.height;
    if (!currentWidth || !currentHeight) {
        console.error("redrawSourceCanvasWithEffect: Cannot determine valid dimensions.");
        // Cannot proceed without a base image or history state with dimensions
        if (!state.currentImage && state.history.length === 0) {
            console.error(" redrawSourceCanvasWithEffect: No current image loaded and history is empty.");
            return false;
         }
        if (!state.history[state.historyIndex] && !state.currentImage){
             console.error(" redrawSourceCanvasWithEffect: No history and no image");
             return false;
        }
    }


    const canvas = elements.sourceEffectCanvas;
    const ctx = state.sourceEffectCtx;

    // --- START STACKING MODIFICATION ---
    // Get the ImageData from the *current* position in history
    const previousState = state.history[state.historyIndex];

    if (!previousState && !state.currentImage) {
         console.error("redrawSourceCanvasWithEffect: Cannot proceed - no previous history state and no base image.");
         showMessage("Error: Cannot determine base image state.", true, elements.messageBox);
         return false;
    }

    let baseImageData; // This will hold the data we apply the *new* effect onto

    if (previousState) {
        console.log(`[MainApp] Starting redraw from history index: ${state.historyIndex}`);
        // Ensure canvas dimensions match the history state we are about to draw
        if (canvas.width !== previousState.width || canvas.height !== previousState.height) {
            canvas.width = previousState.width;
            canvas.height = previousState.height;
            console.log(`[MainApp] Resized sourceEffectCanvas to match history state ${canvas.width}x${canvas.height}`);
        }
         try {
            // Draw the previous state onto the canvas first
            ctx.putImageData(previousState, 0, 0);
            // Get this drawn state as the base for applying the new effect
            // We get it *after* drawing, before applying the next effect
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            console.log("[MainApp] Drew previous history state onto canvas.");
        } catch (e) {
            console.error("[MainApp] Error putting previous history state onto canvas:", e);
            showMessage("Error restoring previous state for stacking.", true, elements.messageBox);
            return false;
        }
    } else {
        // This should only happen if history is empty (i.e., first effect application after load)
        // In this case, start from the original panned/zoomed image.
        console.log("[MainApp] No previous history state found, starting from original panned/zoomed image.");
         // Ensure canvas is sized correctly for the original image
         if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
            canvas.width = state.originalWidth;
            canvas.height = state.originalHeight;
             console.log(`[MainApp] Resized sourceEffectCanvas to original dimensions ${canvas.width}x${canvas.height}`);
         }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const sourceRectWidth = state.originalWidth / state.sourceZoomLevel;
        const sourceRectHeight = state.originalHeight / state.sourceZoomLevel;
        const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
        const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;
        try {
            if (!state.currentImage || sourceRectWidth <= 0 || sourceRectHeight <= 0 || isNaN(sourceRectX) || isNaN(sourceRectY) || isNaN(sourceRectWidth) || isNaN(sourceRectHeight)) {
                throw new Error(`Invalid source image or rectangle dimensions for drawing.`);
            }
            ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Get the data after drawing
            console.log("[MainApp] Drew initial panned/zoomed image onto canvas.");
        } catch (e) {
            console.error("redrawSourceCanvasWithEffect: Error drawing initial source image:", e);
            showMessage("Error drawing source region.", true, elements.messageBox);
            return false;
         }
    }
    // --- END STACKING MODIFICATION ---

    // --- Apply the *currently selected* effect ---
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        console.log(`  Applying effect: ${effect} on top of current canvas state with params:`, params);
        try {
            // Get the current pixel data from the canvas (which holds the previous state)
             const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Pass the state *before* this effect as the sourceImageData context.
            // `baseImageData` holds the pixels from *before* this current effect is applied.
            const effectContext = { sourceImageData: baseImageData };

            // Apply the selected effect function to the current pixel data
            effectFunction(currentImageData, params, effectContext);

            // Put the modified data (with the new effect stacked) back onto the canvas
            ctx.putImageData(currentImageData, 0, 0);
            console.log(`  Effect ${effect} applied (stacked).`);
        } catch (e) {
             console.error(`redrawSourceCanvasWithEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             return false; // Indicate failure
        }
    } else {
        console.log("  No effect selected ('none'). Canvas shows previous state.");
        // If 'none' is selected, the canvas already holds the previous state because
        // we drew it using putImageData earlier in the function. No further action needed.
    }
    return true; // Indicate success
}


/**
 * Requests a full update of the final preview canvas.
 * Debounced to prevent excessive updates.
 * MODIFIED: Ensures the sourceEffectCanvas reflects the LAST APPLIED state from history,
 * *AND* extracts the currently panned/zoomed subsection onto it
 * before generating the final tiled preview.
 */
function requestFullUpdate() {
    console.log('[MainApp] requestFullUpdate called.');
    // Add checks for elements/state
    // Need currentImage OR history to proceed
    if ((!state.currentImage && state.history.length === 0) || !elements.sourceEffectCanvas || !state.sourceEffectCtx) {
        console.warn("[MainApp] requestFullUpdate skipped: No image/history or canvas/context not ready.");
        return;
    }
    if (state.isProcessing) { // Added check for isProcessing
        console.warn("[MainApp] requestFullUpdate skipped: Already processing.");
        return;
    }

    if (state.debounceTimer) clearTimeout(state.debounceTimer);

    // Make the debounced function async to allow await for createImageBitmap
    state.debounceTimer = setTimeout(async () => {
        console.log('[MainApp] Debounce timer finished. Initiating full update.');

        // Ensure prerequisites are still met inside the timeout
        if ((!state.currentImage && state.history.length === 0) || state.isProcessing || !elements.sourceEffectCanvas || !state.sourceEffectCtx) {
            console.warn("[MainApp] Full update skipped inside timeout: Prerequisites changed or missing.");
             if(state.isProcessing) console.log(" Skipped reason: Now processing.");
             else console.log(" Skipped reason: Image/history or canvas issue.");
            return;
        }

        console.log('[MainApp] Prerequisites met for full update processing.');
        state.isProcessing = true; // Set processing flag

        const canvas = elements.sourceEffectCanvas;
        const ctx = state.sourceEffectCtx;
        // Target dimensions for the canvas that processAndPreviewImage uses as input
        // Should generally match the original aspect ratio base
        const targetWidth = state.originalWidth;
        const targetHeight = state.originalHeight;

        if (!targetWidth || !targetHeight) {
             console.error("requestFullUpdate: Invalid target dimensions (originalWidth/Height not set).");
             state.isProcessing = false; // Reset flag
             return;
        }

        // Ensure canvas is the correct size for the target output base
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
           canvas.width = targetWidth;
           canvas.height = targetHeight;
           console.log(`[MainApp] Set sourceEffectCanvas size to ${canvas.width}x${canvas.height}`);
        }
        // Clear the target canvas before drawing the subsection
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('[MainApp] Cleared sourceEffectCanvas.');


        // Get the latest state from history (full frame with effects)
        const currentStateFromHistory = state.history[state.historyIndex];

        try {
            let sourceBitmap;
            let sourceDataWidth;
            let sourceDataHeight;

            // Determine the source data (either latest history or original image)
            if (currentStateFromHistory) {
                console.log('[MainApp] Using latest history state as source.');
                sourceDataWidth = currentStateFromHistory.width;
                sourceDataHeight = currentStateFromHistory.height;
                 // Use createImageBitmap for potentially better performance drawing subsections
                sourceBitmap = await createImageBitmap(currentStateFromHistory);
            } else if (state.currentImage) {
                // Fallback for initial load before first effect apply
                console.log('[MainApp] Using original image as source (no history).');
                sourceDataWidth = state.originalWidth;
                sourceDataHeight = state.originalHeight;
                sourceBitmap = await createImageBitmap(state.currentImage);
            } else {
                // Should not happen if initial checks pass, but handle defensively
                throw new Error("No source data available (no history or currentImage).");
            }

             if (!sourceBitmap) {
                throw new Error("Failed to create ImageBitmap from source data.");
            }
             console.log(`[MainApp] Source data dimensions: ${sourceDataWidth}x${sourceDataHeight}`);


            // --- Calculate the source rectangle based on current pan/zoom state ---
            // sw/sh: Size of the rectangle *in the source data* to be sampled
            const sourceRectWidth = sourceDataWidth / state.sourceZoomLevel;
            const sourceRectHeight = sourceDataHeight / state.sourceZoomLevel;
            // sx/sy: Top-left corner of the rectangle *in the source data* to be sampled
            const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
            const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;

            // Log calculated values
            console.log(`  Pan/Zoom State: zoom=${state.sourceZoomLevel.toFixed(2)}, offsetX=${state.currentOffsetX.toFixed(2)}, offsetY=${state.currentOffsetY.toFixed(2)}`);
            console.log(`  Calculated Source Rect: sx=${sourceRectX.toFixed(2)}, sy=${sourceRectY.toFixed(2)}, sw=${sourceRectWidth.toFixed(2)}, sh=${sourceRectHeight.toFixed(2)}`);
            console.log(`  Target Draw Area: dx=0, dy=0, dw=${canvas.width}, dh=${canvas.height}`);

            // --- Draw the calculated subsection onto the sourceEffectCanvas ---
            if (sourceRectWidth > 0 && sourceRectHeight > 0) {
                ctx.imageSmoothingEnabled = true; // Enable smoothing for zoom quality
                ctx.imageSmoothingQuality = 'medium'; // Or 'high', balances performance/quality
                ctx.drawImage(
                    sourceBitmap,           // The source image data (full frame with effects)
                    sourceRectX, sourceRectY,       // Source rect top-left (sx, sy)
                    sourceRectWidth, sourceRectHeight, // Source rect dimensions (sw, sh)
                    0, 0,                           // Destination top-left (dx, dy)
                    canvas.width, canvas.height     // Destination dimensions (dw, dh) - fill the canvas
                );
                console.log('[MainApp] Drew panned/zoomed subsection onto sourceEffectCanvas.');
            } else {
                 console.warn('[MainApp] Skipping drawImage - calculated source dimensions are invalid (<= 0).');
                 // Canvas will remain clear - perhaps show an error?
                 showMessage("Error: Invalid zoom or source dimensions.", true, elements.messageBox);
            }

            // --- Generate the final tiled preview ---
            // Now sourceEffectCanvas holds the correct panned/zoomed view of the image with stacked effects.
            console.log('[MainApp] Calling processAndPreviewImage with panned/zoomed canvas state.');
            processAndPreviewImage(
                canvas, // This canvas now has the intended panned/zoomed + effected state
                elements,
                state,
                (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
            );

        } catch (err) {
             console.error("Error during requestFullUpdate image processing:", err);
             showMessage(`Error updating preview: ${err.message}`, true, elements.messageBox);
        } finally {
            state.isProcessing = false; // Reset processing flag IMPORTANT
            console.log('[MainApp] Finished full update processing.');
        }

    }, 150); // Debounce time
}


// --- Event Handlers ---

/**
 * Handles the click event for the "Apply Pre-Effect" button.
 * Redraws the source canvas by applying the currently selected effect on top
 * of the previous state (stacking), then pushes the resulting ImageData onto
 * the history stack.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] Apply Pre-Effect button clicked.');
     // Add checks for necessary state and elements
    if (!state.currentImage && state.history.length === 0) { // Need either base image or history
        console.warn('[MainApp] Apply skipped: No image loaded or history base.');
        showMessage("Load an image first.", true, elements.messageBox);
        return;
    }
     if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) {
        console.warn('[MainApp] Apply skipped: Canvas or context missing.');
        showMessage("Canvas error. Cannot apply effect.", true, elements.messageBox);
        return;
    }
    if (state.isProcessing) {
        console.warn('[MainApp] Apply skipped: Already processing.');
        showMessage("Please wait, processing previous action.", true, elements.messageBox);
        return;
    }

    const { effect, params } = getCurrentEffectAndParams(); // Get selected effect

    // *** Step 1: Redraw the canvas WITH the selected effect stacked on the previous state ***
    // The modified redrawSourceCanvasWithEffect now handles the stacking internally.
    console.log(`[MainApp] Applying effect '${effect}' (stacking) before saving to history.`);
    if (!redrawSourceCanvasWithEffect()) {
         // redrawSourceCanvasWithEffect handles showing error messages internally if it fails
         showMessage("Could not apply effect due to processing error.", true, elements.messageBox);
         return; // Stop if redrawing failed
    }

    // *** Step 2: Save the RESULTING (stacked) state of the canvas to history ***
    try {
        // Get the ImageData from the canvas *after* the effect was drawn onto it
        const imageDataToSave = state.sourceEffectCtx.getImageData(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height);
        // Push this state onto the history stack
        pushHistoryState(imageDataToSave, state, updateUndoRedoButtons, elements);
        showMessage(`Effect "${effect || 'None'}" applied (stacked) and saved to history.`, false, elements.messageBox);

        // Optional: Trigger a final preview update immediately after applying.
        // This ensures the tiling preview reflects the state just saved.
         requestFullUpdate();

    } catch (e) {
        console.error("[MainApp] Error getting ImageData after applying effect or pushing history:", e);
        showMessage("Error saving applied effect state.", true, elements.messageBox);
    }
}

/**
 * Handles the Undo button click. Reverts to the previous state in history.
 */
function handleUndoClick() {
    console.log('[MainApp] Undo button clicked.');
    if (!state.ctx) { console.warn('[MainApp] Undo skipped: Main context (ctx) missing.'); return; }
    if (state.historyIndex <= 0) { console.log('[MainApp] Undo skipped: Already at oldest state.'); return; }

    historyUndo(state, updateUndoRedoButtons, elements); // Update history index and put previous image data onto canvas

    // After undoing, request a full update so the final tiling preview reflects the undone state.
    requestFullUpdate();
    showMessage("Undo successful.", false, elements.messageBox);
}

/**
 * Handles the Redo button click. Moves to the next state in history.
 */
function handleRedoClick() {
    console.log('[MainApp] Redo button clicked.');
     if (!state.ctx) { console.warn('[MainApp] Redo skipped: Main context (ctx) missing.'); return; }
     if (state.historyIndex >= state.history.length - 1) { console.log('[MainApp] Redo skipped: Already at newest state.'); return; }

    historyRedo(state, updateUndoRedoButtons, elements); // Update history index and put next image data onto canvas

    // After redoing, request a full update so the final tiling preview reflects the redone state.
    requestFullUpdate();
     showMessage("Redo successful.", false, elements.messageBox);
}

/**
 * Gets the currently selected effect name and its parameters from the UI controls.
 * @returns {{effect: string, params: object}}
 */
function getCurrentEffectAndParams() {
    // Add safety checks for elements existence
    const effect = elements.preEffectSelector?.value || 'none';
    const params = {
        // Generic intensity is default, specific effects override
        intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10)
    };

    // Populate parameters based on the selected effect
    switch (effect) {
        case 'waveDistortion':
            params.amplitude = parseInt(elements.preEffectWaveAmplitudeSlider?.value || 10, 10);
            params.frequency = parseInt(elements.preEffectWaveFrequencySlider?.value || 5, 10);
            params.phase = parseInt(elements.preEffectWavePhaseSlider?.value || 0, 10) * (Math.PI / 180); // Convert degrees to radians
            params.direction = elements.preEffectWaveDirection?.value || 'horizontal';
            params.waveType = elements.preEffectWaveType?.value || 'sine';
            delete params.intensity; // Remove generic intensity if specific params exist
            break;
        case 'sliceShift':
            params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10);
            params.direction = elements.sliceShiftDirection?.value || 'horizontal';
            break;
        case 'pixelSort':
            params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10);
            params.direction = elements.pixelSortDirection?.value || 'horizontal';
            params.sortBy = elements.pixelSortBy?.value || 'brightness';
            delete params.intensity;
            break;
        case 'scanLines':
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10); // Scanlines uses intensity for darkness
            break;
        // Add cases for other effects if they have specific parameters not covered by generic intensity
        case 'noise':
        case 'channelShift':
        case 'blockDisplace':
        case 'invertBlocks':
        case 'sierpinski':
        case 'fractalZoom':
             // These use the generic intensity slider value already assigned
            break;
    }
    // console.log(`[MainApp] getCurrentEffectAndParams - Effect: ${effect}, Params:`, JSON.stringify(params)); // Use stringify for cleaner logs if needed
    return { effect, params };
}

/**
 * Handles changes for TILING sliders (Tiles X/Y, Skew, Stagger, Scale, Pre-Tile X/Y).
 * Updates the value display spans and requests a full preview update.
 */
function handleSliderChange() {
    console.log('[MainApp] handleSliderChange called (likely Tiling or shared slider).');
    // Update value spans for TILING sliders
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    // Note: Effect slider spans are updated via setupSliderListener

    // Any slider change potentially affects the final output
    requestFullUpdate();
}

/**
 * Handles changes for radio buttons (Tile Shape, Mirroring) and select dropdowns (Effects, Directions, etc.).
 * Updates UI visibility if needed and requests a full preview update.
 */
function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    console.log(`[MainApp] Option change detected on element ID: ${target.id}, Name: ${target.name}, Value: ${target.value}`);

    let needsFullUpdate = false;
    let needsControlVisibilityUpdate = false;

    // Check if it's a tiling or mirroring option
    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        // Update tiling control visibility if shape changed
        if(target.name === 'tileShape') {
             needsControlVisibilityUpdate = true; // Need to update tiling controls
             // updateTilingControlsVisibility calls handleSliderChange which calls requestFullUpdate
        } else {
            needsFullUpdate = true; // Mirroring change just needs visual update
        }
    }
    // Check if it's the main effect selector or any control within the effect options container
    else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
         // If the main selector changed, update the visibility of specific effect options
         if(target.id === 'preEffectSelector') {
             needsControlVisibilityUpdate = true; // Need to update effect controls
         }
         // Changing any effect parameter (select dropdowns like direction, type) should trigger update
         needsFullUpdate = true;
    } else {
        console.log("[MainApp] Unhandled option change target:", target);
    }

    // Perform UI updates if needed
    if (needsControlVisibilityUpdate) {
        if (target.name === 'tileShape') {
             if(elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange);
        } else if (target.id === 'preEffectSelector') {
             if(elements.preEffectSelector) updatePreEffectControlsVisibility(elements);
        }
    }

    // Request a visual update if needed (and not already triggered by handleSliderChange)
    if (needsFullUpdate && !(needsControlVisibilityUpdate && target.name === 'tileShape')) {
        requestFullUpdate();
    }
}


/**
 * Handles the loading of a new image file.
 * Resets state, loads the image, initializes canvases and history, enables controls.
 */
function handleImageLoad(event) {
    console.log("[MainApp] handleImageLoad: Function triggered.");
    // Ensure elements are defined before proceeding
    if (!elements.messageBox || !elements.sourceEffectCanvas) {
         console.error("handleImageLoad cannot run before elements are defined or sourceEffectCanvas is missing.");
         if (elements.messageBox) showMessage("Initialization error. Please refresh.", true, elements.messageBox);
         return;
    }

    // Define the reset function using the populated elements object
    const resetFunc = () => {
        console.log("[MainApp] handleImageLoad: Calling resetState.");
        resetState(elements, state,
            () => updateTilingControlsVisibility(elements, handleSliderChange), // Pass callbacks
            () => updatePreEffectControlsVisibility(elements),
            handleSliderChange,
            () => clearHistory(state, updateUndoRedoButtons, elements) // Pass history clear callback
        );
         if (elements.messageBox) showMessage("Ready to load a new image.", false, elements.messageBox);
    };

    const file = event.target.files?.[0];

    // Reset state if no file selected or invalid file type
    if (!file) { console.log("[MainApp] No file selected."); resetFunc(); return; }
    if (!file.type.startsWith('image/')) {
        console.warn("[MainApp] Invalid file type selected:", file.type);
        showMessage("Invalid file type. Please select an image (PNG, JPG, GIF).", true, elements.messageBox);
        resetFunc();
        return;
    }

    // Start processing the valid image file
    showMessage("Loading image...", false, elements.messageBox);
    state.originalFileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            console.log(`[MainApp] Image object loaded: ${img.naturalWidth}x${img.naturalHeight}`);
            state.currentImage = img; // Store the original Image object
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;

            // Check for valid dimensions
            if (!state.originalWidth || !state.originalHeight) {
                console.error("[MainApp] Image loaded with zero dimensions.");
                showMessage("Error: Image has invalid dimensions.", true, elements.messageBox);
                resetFunc(); return;
            }
            state.originalAspectRatio = state.originalWidth / state.originalHeight;

            // --- Update UI Elements (with checks) ---
            if(elements.outputWidthInput) elements.outputWidthInput.value = state.originalWidth;
            if(elements.outputHeightInput) elements.outputHeightInput.value = state.originalHeight;
            if(elements.sourcePreview) {
                elements.sourcePreview.src = e.target.result; // Use data URL for preview img src
                elements.sourcePreview.classList.remove('hidden');
            }
            if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
            if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';

            // Reset pan/zoom state
            state.currentOffsetX = 0; state.currentOffsetY = 0; state.startOffsetX = 0; state.startOffsetY = 0;
            state.sourceZoomLevel = 1.0;
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
            if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

            // Use requestAnimationFrame to ensure layout is stable before measurements/drawing
            requestAnimationFrame(() => {
                console.log("[MainApp] requestAnimationFrame callback executing after image load.");
                // Double-check canvas context
                if (!state.sourceEffectCtx) {
                    console.error("[MainApp] Cannot initialize state - sourceEffectCtx is missing.");
                    showMessage("Error: Cannot access drawing canvas context.", true, elements.messageBox);
                    resetFunc(); return;
                }

                 // Update visual transform for the source preview image
                 console.log("[MainApp] Updating source preview transform.");
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY; // Store clamped offsets

                // --- Initialize sourceEffectCanvas and History ---
                console.log("[MainApp] Initializing sourceEffectCanvas and history.");
                 // Ensure canvas dimensions are set correctly *before* drawing
                elements.sourceEffectCanvas.width = state.originalWidth;
                elements.sourceEffectCanvas.height = state.originalHeight;

                // Draw the initial panned/zoomed state onto the sourceEffectCanvas
                // The STACKING version of redrawSourceCanvasWithEffect handles the initial case correctly.
                if (redrawSourceCanvasWithEffect()) {
                    try {
                         // Get the initial image data (just panned/zoomed original)
                         // Note: originalImageData might not be strictly needed anymore if we always rely on history[0]
                         state.originalImageData = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
                         // Clear any previous history and add this initial state as the first entry
                         clearHistory(state, updateUndoRedoButtons, elements);
                         pushHistoryState(state.originalImageData, state, updateUndoRedoButtons, elements);
                         console.log("[MainApp] History initialized with the base image state.");
                    } catch(histError) {
                         console.error("[MainApp] Error getting initial ImageData or initializing history:", histError);
                         showMessage("Error initializing image state.", true, elements.messageBox);
                         resetFunc(); return;
                     }
                } else {
                    console.error("[MainApp] Failed to draw initial image state onto sourceEffectCanvas.");
                     showMessage("Error preparing initial image.", true, elements.messageBox);
                    resetFunc(); return;
                }

                // --- Enable Controls (with checks) ---
                console.log("[MainApp] Enabling UI controls.");
                if(elements.saveButton) elements.saveButton.disabled = false;
                if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                // Undo/Redo buttons are handled by updateUndoRedoButtons called by history functions

                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                elements.sliders?.forEach(s => { if(s) s.disabled = false; }); // Includes tiling & effect sliders
                elements.selects?.forEach(s => { if(s) s.disabled = false; }); // Includes effect selector & parameter selects
                if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
                console.log("[MainApp] Controls enabled.");
                if (elements.preEffectSelector) console.log(`  Effect selector disabled state: ${elements.preEffectSelector.disabled}`);

                // --- Final Setup and Initial Preview ---
                // Update control visibility based on default selections
                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);
                // Trigger the first full preview generation
                requestFullUpdate();
                showMessage('Image loaded. Adjust effect/tiling controls.', false, elements.messageBox);
                console.log("[MainApp] handleImageLoad complete.");
            });
        };
        img.onerror = () => {
            console.error("[MainApp] Error loading image into Image object (e.g., invalid data URL).");
            showMessage("Error: Could not load the selected image data.", true, elements.messageBox);
            resetFunc();
        };
        // Start loading the image data into the Image object
        img.src = e.target.result; // e.target.result contains the data URL from FileReader
    };
    reader.onerror = () => {
        console.error("[MainApp] Error reading file using FileReader.");
        showMessage("Error: Could not read the selected file.", true, elements.messageBox);
        resetFunc();
    };
    // Start reading the file as a Data URL
    reader.readAsDataURL(file);
}

/**
 * Handles saving the final processed image from the main canvas.
 */
function saveImage() {
    console.log("[MainApp] saveImage called.");
     if (!elements.canvas || (!state.currentImage && state.history.length === 0)) { // Check image or history
        console.warn("[MainApp] Save cancelled: Canvas not ready or no image/history.");
        showMessage("Cannot save: No image processed yet.", true, elements.messageBox);
        return;
    }
     if (state.isProcessing) {
         console.warn("[MainApp] Save cancelled: Application is currently processing.");
         showMessage("Cannot save while processing, please wait.", true, elements.messageBox);
         return;
     }

    try {
        const finalCanvas = elements.canvas; // This is the canvas updated by processAndPreviewImage
        // Use state dimensions if inputs are invalid/disabled
        const outputWidth = parseInt(elements.outputWidthInput?.value, 10) || finalCanvas.width;
        const outputHeight = parseInt(elements.outputHeightInput?.value, 10) || finalCanvas.height;

        if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
            console.error(`[MainApp] Invalid output dimensions for saving: ${outputWidth}x${outputHeight}`);
            showMessage("Invalid output dimensions specified.", true, elements.messageBox);
            return;
        }

        // Create a temporary canvas for resizing if necessary
        let canvasToSave = finalCanvas;
        if (outputWidth !== finalCanvas.width || outputHeight !== finalCanvas.height) {
            console.log(`[MainApp] Resizing final image for save from ${finalCanvas.width}x${finalCanvas.height} to ${outputWidth}x${outputHeight}`);
            const tempSaveCanvas = document.createElement('canvas');
            tempSaveCanvas.width = outputWidth;
            tempSaveCanvas.height = outputHeight;
            const tempCtx = tempSaveCanvas.getContext('2d');
            if (!tempCtx) throw new Error("Could not create temporary context for saving.");
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            tempCtx.drawImage(finalCanvas, 0, 0, finalCanvas.width, finalCanvas.height, 0, 0, outputWidth, outputHeight);
            canvasToSave = tempSaveCanvas;
        }

        // Generate data URL and trigger download
        const dataURL = canvasToSave.toDataURL('image/png'); // Or 'image/jpeg'
        const link = document.createElement('a');
        const baseName = state.originalFileName.replace(/\.[^/.]+$/, ""); // Remove extension
        link.download = `${baseName}_MeltMixPix.png`; // Consistent naming
        link.href = dataURL;
        link.click(); // Simulate click to trigger download
        console.log("[MainApp] Image download initiated.");
        showMessage("Image saved successfully!", false, elements.messageBox);

    } catch (error) {
        console.error("[MainApp] Error during image saving:", error);
        showMessage(`Error saving image: ${error.message || 'Unknown error'}.`, true, elements.messageBox);
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners: Attaching listeners...");
    // Ensure elements are available before adding listeners
    if (!elements.imageLoader) {
        console.error("[MainApp] Cannot setup listeners: Critical element 'imageLoader' not found.");
        return;
    }

    elements.imageLoader.addEventListener('change', handleImageLoad);
    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);

    // Tiling Options
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));

    // Tiling Sliders (use the generic handler)
    const tilingSliders = [
        elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider,
        elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider
    ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });

    // Pre-Effect Controls
    elements.preEffectSelector?.addEventListener('change', handleOptionChange); // Effect selector itself

    // Effect Parameter Sliders (use specific setup for value display + generic update request)
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°'); // Formatter for degrees
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate);

    // Effect Parameter Selects (use the generic option handler)
    const effectSelects = [
        elements.preEffectWaveDirection, elements.preEffectWaveType,
        elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
    ];
    effectSelects.forEach(select => { if(select) select.addEventListener('change', handleOptionChange); });

    // Source Zoom Slider
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => { // Callback function
                 console.log('[MainApp] Zoom slider input.');
                 // Update the visual transform of the source preview
                 handleSourceZoom(elements, state, () => updateSourcePreviewTransform(elements, state));
                 // Request a full update of the final tiled preview
                 // This will now use the updated requestFullUpdate logic
                 requestFullUpdate();
             },
             val => parseFloat(val).toFixed(1) // Formatter for display
         );
    }

    // Output Dimensions
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => {
        // If checked and image loaded, trigger recalculation based on width
        if (elements.keepAspectRatioCheckbox?.checked && state.currentImage && elements.outputWidthInput) {
            handleDimensionChange({ target: elements.outputWidthInput }, elements, state);
        }
    });

    // Panning Listeners
    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => { startPan(e, elements, state); });
         // Attach move/end listeners to the document to handle dragging outside the container
         document.addEventListener('mousemove', (e) => {
             if (state.isDragging) {
                panMove( e, elements, state, () => updateSourcePreviewTransform(elements, state) );
                // Avoid triggering full (potentially slow) updates during drag
             }
         });
         const endPanHandler = () => {
             if (state.isDragging) {
                 console.log('[MainApp] Pan ended.');
                 // Call endPan which sets isDragging = false
                 // Pass requestFullUpdate as the callback to update the final preview after panning stops
                 endPan(elements, state, requestFullUpdate); // This will use the updated requestFullUpdate
             }
         };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler); // Handle mouse leaving the window during drag
     } else {
        console.warn("[MainApp] Could not attach panning listeners: sourcePreviewContainer not found.");
     }
     console.log("[MainApp] setupEventListeners: Finished attaching listeners.");
}


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] Initializing application...");

     // --- Populate the 'elements' object ---
      elements = {
         // Input/Output
         imageLoader: document.getElementById('imageLoader'),
         saveButton: document.getElementById('saveButton'),
         messageBox: document.getElementById('messageBox'),
         outputWidthInput: document.getElementById('outputWidth'),
         outputHeightInput: document.getElementById('outputHeight'),
         keepAspectRatioCheckbox: document.getElementById('keepAspectRatio'),

         // Previews
         sourcePreviewContainer: document.getElementById('sourcePreviewContainer'),
         sourcePreview: document.getElementById('sourcePreview'),
         sourcePreviewText: document.getElementById('sourcePreviewText'),
         finalPreviewContainer: document.getElementById('finalPreviewContainer'),
         finalPreview: document.getElementById('finalPreview'),
         finalPreviewText: document.getElementById('finalPreviewText'),

         // Canvases (ensure IDs match HTML)
         mirrorCanvas: document.getElementById('mirrorCanvas'),
         preTileCanvas: document.getElementById('preTileCanvas'),
         canvas: document.getElementById('imageCanvas'),
         sourceEffectCanvas: document.getElementById('sourceEffectCanvas'),

         // History Buttons
         applyEffectButton: document.getElementById('applyEffectButton'),
         undoButton: document.getElementById('undoButton'),
         redoButton: document.getElementById('redoButton'),

         // Source Zoom
         sourceZoomSlider: document.getElementById('sourceZoom'),
         sourceZoomValueSpan: document.getElementById('sourceZoomValue'),

         // Tiling Controls
         tileShapeOptions: document.querySelectorAll('input[name="tileShape"]'),
         mirrorOptions: document.querySelectorAll('input[name="mirrorOption"]'),
         tilesXSlider: document.getElementById('tilesX'),
         tilesYSlider: document.getElementById('tilesY'),
         skewSlider: document.getElementById('skewFactor'),
         staggerSlider: document.getElementById('staggerOffset'),
         scaleSlider: document.getElementById('tileScale'),
         preTileXSlider: document.getElementById('preTileX'),
         preTileYSlider: document.getElementById('preTileY'),
         tilesXValueSpan: document.getElementById('tilesXValue'),
         tilesYValueSpan: document.getElementById('tilesYValue'),
         skewValueSpan: document.getElementById('skewValue'),
         staggerValueSpan: document.getElementById('staggerValue'),
         scaleValueSpan: document.getElementById('scaleValue'),
         preTileXValueSpan: document.getElementById('preTileXValue'),
         preTileYValueSpan: document.getElementById('preTileYValue'),
         skewControl: document.getElementById('skewControl'),
         staggerControl: document.getElementById('staggerControl'),
         tilesXLabel: document.getElementById('tilesXLabel'),
         tilesYLabel: document.getElementById('tilesYLabel'),
         scaleLabel: document.getElementById('scaleLabel'),
         tilesXYHelpText: document.getElementById('tilesXYHelpText'),

         // Pre-Effect Controls (Main)
         preEffectSelector: document.getElementById('preEffectSelector'),
         preEffectOptionsContainer: document.getElementById('preEffectOptionsContainer'),
         preEffectIntensityControl: document.getElementById('preEffectIntensityControl'),
         preEffectIntensitySlider: document.getElementById('preEffectIntensitySlider'),
         preEffectIntensityValue: document.getElementById('preEffectIntensityValue'),
         preEffectRealtimeWarning: document.getElementById('preEffectRealtimeWarning'),

         // Pre-Effect Specific Controls (Wave Distortion)
         preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'),
         preEffectWaveAmplitudeSlider: document.getElementById('preEffectWaveAmplitudeSlider'),
         preEffectWaveAmplitudeValue: document.getElementById('preEffectWaveAmplitudeValue'),
         preEffectWaveFrequencySlider: document.getElementById('preEffectWaveFrequencySlider'),
         preEffectWaveFrequencyValue: document.getElementById('preEffectWaveFrequencyValue'),
         preEffectWavePhaseSlider: document.getElementById('preEffectWavePhaseSlider'),
         preEffectWavePhaseValue: document.getElementById('preEffectWavePhaseValue'),
         preEffectWaveDirection: document.getElementById('preEffectWaveDirection'),
         preEffectWaveType: document.getElementById('preEffectWaveType'),

         // Pre-Effect Specific Controls (Slice Shift)
         sliceShiftOptions: document.getElementById('sliceShiftOptions'),
         sliceShiftDirection: document.getElementById('sliceShiftDirection'),
         sliceShiftIntensitySlider: document.getElementById('sliceShiftIntensitySlider'),
         sliceShiftIntensityValue: document.getElementById('sliceShiftIntensityValue'),

          // Pre-Effect Specific Controls (Pixel Sort)
         pixelSortOptions: document.getElementById('pixelSortOptions'),
         pixelSortThresholdSlider: document.getElementById('pixelSortThresholdSlider'),
         pixelSortThresholdValue: document.getElementById('pixelSortThresholdValue'),
         pixelSortDirection: document.getElementById('pixelSortDirection'),
         pixelSortBy: document.getElementById('pixelSortBy'),

         // Group sliders/selects for easier enabling/disabling
         sliders: [], // Populated below
         selects: []  // Populated below
     };
      console.log("[MainApp] Elements object populated.");

      // Populate grouped sliders/selects arrays (filtering out nulls if elements weren't found)
     elements.sliders = [
         elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider,
         elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider,
         elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider,
         elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider,
         elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider
     ].filter(el => el !== null);

     elements.selects = [
        elements.preEffectSelector, elements.preEffectWaveDirection, elements.preEffectWaveType,
        elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
     ].filter(el => el !== null);
     console.log(`[MainApp] Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);


     // --- Initialize State Object (MUST happen AFTER elements are defined) ---
     const initialSourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
     if (!initialSourceEffectCtx) {
         console.error("initializeApp: CRITICAL - Failed to get context for sourceEffectCanvas! Cannot proceed.");
         if (elements.messageBox) showMessage("Initialization Error: Cannot get canvas context. Please refresh.", true, elements.messageBox);
         return; // Stop initialization
     }

     state = {
         currentImage: null,
         originalImageData: null,
         originalFileName: 'downloaded-image.png',
         originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
         isProcessing: false,
         isDragging: false,
         debounceTimer: null,
         dragStartX: 0, dragStartY: 0,
         currentOffsetX: 0, currentOffsetY: 0,
         startOffsetX: 0, startOffsetY: 0,
         sourceZoomLevel: 1.0,
         sourceEffectCtx: initialSourceEffectCtx,
         ctx: initialSourceEffectCtx, // Point state.ctx to the same context for history utils
         history: [],
         historyIndex: -1
     };
     console.log("[MainApp] State object initialized.");


     // --- Call resetState to set initial UI state (disabled controls, default values) ---
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange,
         clearHistory: () => clearHistory(state, updateUndoRedoButtons, elements)
     };
     resetState(
         elements, state,
         resetCallbacks.updateTiling, resetCallbacks.updateEffects,
         resetCallbacks.updateSliders, resetCallbacks.clearHistory
     );
     console.log("[MainApp] Initial resetState complete.");


     // --- Setup Event Listeners ---
     setupEventListeners();

     // --- Final Initial UI State ---
     updateUndoRedoButtons(elements, state);
     console.log("[MainApp] Image Tiler Initialized and ready.");
     showMessage("Load an image to begin.", false, elements.messageBox);
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
