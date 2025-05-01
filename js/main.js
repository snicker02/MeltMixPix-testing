// js/main.js

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetUIState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener, updateUndoRedoButtons,
    updateGeneratorControlsVisibility // <<< ADDED Import
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
import * as stateManager from './stateManager.js';

// <<< ADD Generator Import >>>
// Assuming you create perlinNoise.js in js/generators/
import { generatePerlinNoise } from './generators/perlinNoise.js';

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


// --- Global Scope ---
let elements = {}; // Holds references to DOM elements
let sourceEffectCtx = null; // Context for the canvas where effects are applied/patterns generated


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

// --- Generator Function Map (NEW) ---
const generatorFunctions = {
    'perlin': generatePerlinNoise,
    // Add other generator functions here when you create them
    // 'reactionDiffusion': generateReactionDiffusion,
};


// --- Core Processing Functions ---

/**
 * Redraws the sourceEffectCanvas based on the current state (history or original image)
 * and applies the currently selected (but not yet committed) pre-effect for preview.
 * @returns {boolean} True if successful, false otherwise.
 */
function redrawSourceCanvasWithEffect() {
    // console.log('[MainApp] redrawSourceCanvasWithEffect - START');
    const currentState = stateManager.getState(); // Get snapshot
    const currentHistoryState = stateManager.getCurrentHistoryState();
    const currentImage = currentState.currentImage; // Base loaded image (null if generated)
    const sourceWidth = currentState.originalWidth;
    const sourceHeight = currentState.originalHeight;

    if (!elements.sourceEffectCanvas || !sourceEffectCtx) {
         console.error(" redrawSourceCanvasWithEffect: Missing canvas or context.");
         return false;
    }
    // We need *either* a history state *or* a loaded image to draw something
    if (!currentHistoryState && !currentImage) {
        console.warn(" redrawSourceCanvasWithEffect: No history state and no loaded image available to draw.");
        // Clear the canvas to avoid showing stale content
        try {
             sourceEffectCtx.clearRect(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height);
        } catch(e){}
        return false; // Nothing to draw
    }
     if (!sourceWidth || !sourceHeight) {
        console.error(` redrawSourceCanvasWithEffect: Invalid source dimensions (Width: ${sourceWidth}, Height: ${sourceHeight}).`);
        return false;
     }

    const canvas = elements.sourceEffectCanvas;
    const ctx = sourceEffectCtx;

    // Ensure canvas matches source dimensions
    if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        console.log(` redrawSourceCanvasWithEffect: Resized sourceEffectCanvas to ${canvas.width}x${canvas.height}`);
    }

    // Base image data *before* applying the selected effect for preview
    let baseImageData = null;

    // --- Step 1: Draw the base state (from history or panned/zoomed original) ---
    try {
        if (currentHistoryState) {
            // Draw the current history state onto the canvas
             // console.log(` redrawSourceCanvasWithEffect: Drawing base from history index: ${currentState.historyIndex}`);
             if (currentHistoryState.width !== canvas.width || currentHistoryState.height !== canvas.height) {
                 console.warn("History state dimensions differ from canvas, resizing canvas.");
                 canvas.width = currentHistoryState.width;
                 canvas.height = currentHistoryState.height;
             }
            ctx.putImageData(currentHistoryState, 0, 0);
            baseImageData = currentHistoryState; // Use history state directly as base
        } else if (currentImage) {
            // Draw the panned/zoomed original loaded image
            // console.log(" redrawSourceCanvasWithEffect: Drawing base from panned/zoomed original image.");
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear first
            const zoomLevel = currentState.sourceZoomLevel;
            const { currentOffsetX, currentOffsetY } = currentState; // Use clamped offsets from state
            const sourceRectWidth = sourceWidth / zoomLevel;
            const sourceRectHeight = sourceHeight / zoomLevel;
            const sourceRectX = -currentOffsetX / zoomLevel;
            const sourceRectY = -currentOffsetY / zoomLevel;

            if (sourceRectWidth <= 0 || sourceRectHeight <= 0 || isNaN(sourceRectX) || isNaN(sourceRectY)) {
                 throw new Error(`Invalid source rectangle dimensions for drawing: ${sourceRectWidth}x${sourceRectHeight} at ${sourceRectX},${sourceRectY}`);
            }
            ctx.imageSmoothingEnabled = true; // Enable smoothing for pan/zoom draw
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage( currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
            // Get the ImageData AFTER drawing the panned/zoomed image
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else {
            // Should not happen due to checks above, but handle defensively
             console.error(" redrawSourceCanvasWithEffect: Cannot draw base state - no history and no image.");
             return false;
        }
    } catch (e) {
         console.error(" redrawSourceCanvasWithEffect: Error drawing base state:", e);
         return false;
    }

    // --- Step 2: Apply the *currently selected* effect for preview (if any) ---
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction && baseImageData) {
         // console.log(` redrawSourceCanvasWithEffect: Previewing effect: ${effect}`);
         try {
             // Create a copy of the base image data to apply the effect to
             const imageDataForEffect = new ImageData(
                 new Uint8ClampedArray(baseImageData.data),
                 baseImageData.width,
                 baseImageData.height
             );
             // Pass the original baseImageData as context if needed by the effect (e.g., for sampling)
             const effectContext = { sourceImageData: baseImageData };
             effectFunction(imageDataForEffect, params, effectContext); // Apply effect to the copy
             ctx.putImageData(imageDataForEffect, 0, 0); // Put result onto canvas for preview
         } catch (e) {
              console.error(` redrawSourceCanvasWithEffect: Error previewing effect '${effect}':`, e);
              // Optional: redraw the base state if effect preview fails? ctx.putImageData(baseImageData, 0, 0);
              return false;
         }
    } else {
        // console.log(" redrawSourceCanvasWithEffect: No effect selected ('none') or no base image data.");
        // Canvas already shows the base state from Step 1.
    }
    // console.log('[MainApp] redrawSourceCanvasWithEffect - END - Success');
    return true;
}


/**
 * Requests a full update of the final tiling preview canvas.
 * This involves redrawing the source canvas (with effects preview) and then running the tiling process.
 */
function requestFullUpdate() {
    // Use a debounce timer stored potentially on the state object to prevent rapid updates
    let debounceTimer = stateManager.getState().debounceTimer; // Check if timer ID exists in state
    if (!debounceTimer) debounceTimer = null;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
         // Clear the stored timer ID in state if it exists
         if (stateManager.getState().debounceTimer === debounceTimer) stateManager.getState().debounceTimer = null;
    }

    // Store the new timer ID (example using stateManager state)
    const newTimerId = setTimeout(async () => { // Make async if using await inside
        // console.log('[MainApp] Debounce timer finished. Initiating full update.');

        const currentState = stateManager.getState(); // Get fresh state inside timeout

        // Check prerequisites: Need dimensions and canvas context. Processing flag prevents overlap.
        if (!currentState.originalWidth || !currentState.originalHeight || !elements.sourceEffectCanvas || !sourceEffectCtx || currentState.isProcessing) {
            if (currentState.isProcessing) console.warn(" requestFullUpdate skipped: Already processing.");
            else console.warn(" requestFullUpdate skipped: Prerequisites failed (dimensions, canvas, or context missing).");
            // Clear the timer ID reference if this timeout run is skipped
             if (stateManager.getState().debounceTimer === newTimerId) stateManager.getState().debounceTimer = null;
            return;
        }

        // console.log(' requestFullUpdate: Prerequisites met for full update processing.');
        stateManager.setProcessing(true);
        showMessage("Updating preview...", false, elements.messageBox); // Indicate processing

        try {
            // 1. Redraw the source canvas with the current effect selection previewed
            // console.log(' requestFullUpdate: >>> Calling redrawSourceCanvasWithEffect <<<');
            const redrawSuccess = redrawSourceCanvasWithEffect();
            // console.log(` requestFullUpdate: <<< redrawSourceCanvasWithEffect returned: ${redrawSuccess} >>>`);

            if (!redrawSuccess) {
                 throw new Error("Failed to prepare source canvas for tiling.");
            }

             // Log canvas content AFTER redraw, BEFORE tiling (optional debug)
             // try { console.log(' requestFullUpdate: sourceEffectCanvas content BEFORE tiling:', elements.sourceEffectCanvas.toDataURL().substring(0, 100) + '...'); } catch (e) {}


            // 2. Process the redrawn source canvas for tiling
            // console.log(' requestFullUpdate: >>> Calling processAndPreviewImage <<<');
            // Use await here if processAndPreviewImage becomes async in the future
            processAndPreviewImage(
                elements.sourceEffectCanvas, // Pass the canvas containing the base + previewed effect
                elements,
                currentState, // Pass snapshot of current state
                (msg, isErr) => showMessage(msg, isErr, elements.messageBox) // Pass message function
            );
            // console.log(' requestFullUpdate: <<< processAndPreviewImage call finished >>>');

             // Clear "Updating..." message on success (or let it timeout)
             // showMessage("Preview updated.", false, elements.messageBox); // Optional immediate feedback

        } catch (err) {
             console.error(" requestFullUpdate: Error during image processing:", err);
             showMessage(`Error updating preview: ${err.message || 'Unknown error'}`, true, elements.messageBox);
        } finally {
            stateManager.setProcessing(false);
            // Clear the timer ID reference after execution completes
             if (stateManager.getState().debounceTimer === newTimerId) stateManager.getState().debounceTimer = null;
            // console.log('[MainApp] Finished full update processing.');
        }

    }, 150); // Debounce time (milliseconds)

    // Store the timer ID (example: attach to stateManager state if needed globally)
    stateManager.getState().debounceTimer = newTimerId;
}



// --- Event Handlers ---

/**
 * Updates undo/redo button states based on history info from stateManager.
 */
function updateHistoryButtonsUI() {
    const historyInfo = stateManager.getHistoryInfo();
    updateUndoRedoButtons(elements, historyInfo); // Use the imported utility function
}


/**
 * Handles the click event for the "Apply Pre-Effect" button.
 * Commits the currently selected effect to the history.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] handleApplyEffectClick - START');
    const currentState = stateManager.getState();
    const historyInfo = stateManager.getHistoryInfo();

    // Need a base state (either loaded image or generated pattern) to apply effects to
    // Check if history has been initialized
    if (!currentState.originalWidth || historyInfo.length === 0 || historyInfo.index < 0) {
        showMessage("Load an image or generate a pattern first.", true, elements.messageBox); return;
    }
     if (!elements.sourceEffectCanvas || !sourceEffectCtx) {
         console.error("Apply Effect: Missing canvas or context."); return;
    }
    if (stateManager.isProcessing()) {
         showMessage("Cannot apply effect while processing.", true, elements.messageBox); return;
    }

    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (!effectFunction) {
        showMessage(`No effect selected or "${effect}" is not applicable.`, false, elements.messageBox);
        return; // No actual effect to apply
    }

    console.log(` handleApplyEffectClick: Applying effect: '${effect}'`);
    stateManager.setProcessing(true); // Prevent other actions during apply

    try {
        // 1. Get the *current* base state from history (before applying the new effect)
        const baseStateImageData = stateManager.getCurrentHistoryState();
        if (!baseStateImageData) {
            throw new Error("Cannot apply effect: No valid base state found in history.");
        }

         // Ensure canvas matches state dimensions
         if (elements.sourceEffectCanvas.width !== baseStateImageData.width || elements.sourceEffectCanvas.height !== baseStateImageData.height) {
             console.warn("Canvas dimensions mismatch history state, resizing canvas.");
             elements.sourceEffectCanvas.width = baseStateImageData.width;
             elements.sourceEffectCanvas.height = baseStateImageData.height;
         }


        // 2. Create a copy to apply the effect to (don't modify the history state directly)
        const imageDataToApplyEffect = new ImageData(
            new Uint8ClampedArray(baseStateImageData.data),
            baseStateImageData.width,
            baseStateImageData.height
        );

        // 3. Apply the effect
        const effectContext = { sourceImageData: baseStateImageData }; // Pass original as context if needed
        effectFunction(imageDataToApplyEffect, params, effectContext);

        // 4. Push the *new* state (with the effect applied) to history
        stateManager.pushHistoryState(imageDataToApplyEffect);

        // 5. Update UI
        updateHistoryButtonsUI();
        // No need to call redrawSourceCanvasWithEffect here, as the effect is now *in* history.
        // We just need to update the final preview based on the new history state.
        requestFullUpdate();
        showMessage(`Effect "${effect}" applied successfully.`, false, elements.messageBox);

    } catch (e) {
         console.error(" handleApplyEffectClick: Error applying effect or updating history:", e);
         showMessage(`Error applying effect: ${e.message || 'Unknown error'}`, true, elements.messageBox);
    } finally {
        stateManager.setProcessing(false);
    }
    console.log('[MainApp] handleApplyEffectClick - END');
}

/**
 * Handles the Undo button click. Uses stateManager.
 */
function handleUndoClick() {
    console.log('[MainApp] handleUndoClick - START');
     if (!sourceEffectCtx) { console.error("Undo: Missing context."); return; }
     if (stateManager.isProcessing()) { return; } // Prevent undo during processing
    const historyInfo = stateManager.getHistoryInfo();
    if (historyInfo.index <= 0) { return; } // Already at oldest state

    const previousImageData = stateManager.undoState(); // Move history index back

    if (previousImageData) {
         try {
            // Update the source canvas preview to show the undone state
             if (elements.sourceEffectCanvas.width !== previousImageData.width || elements.sourceEffectCanvas.height !== previousImageData.height) {
                 elements.sourceEffectCanvas.width = previousImageData.width;
                 elements.sourceEffectCanvas.height = previousImageData.height;
                 console.log("Undo: Resized source canvas.");
             }
             sourceEffectCtx.putImageData(previousImageData, 0, 0);

             // Update buttons and trigger full preview update
             updateHistoryButtonsUI();
             requestFullUpdate();
             showMessage("Undo successful.", false, elements.messageBox);
         } catch(e) {
              console.error(" handleUndoClick: Error putting undone state on canvas:", e);
              showMessage("Error during Undo.", true, elements.messageBox);
         }
    } else {
         console.warn("Undo: stateManager.undoState() returned null.");
    }
    console.log('[MainApp] handleUndoClick - END');
}

/**
 * Handles the Redo button click. Uses stateManager.
 */
function handleRedoClick() {
    console.log('[MainApp] handleRedoClick - START');
     if (!sourceEffectCtx) { console.error("Redo: Missing context."); return; }
     if (stateManager.isProcessing()) { return; } // Prevent redo during processing
      const historyInfo = stateManager.getHistoryInfo();
     if (historyInfo.index >= historyInfo.length - 1) { return; } // Already at newest state

    const nextImageData = stateManager.redoState(); // Move history index forward

     if (nextImageData) {
         try {
             // Update the source canvas preview to show the redone state
             if (elements.sourceEffectCanvas.width !== nextImageData.width || elements.sourceEffectCanvas.height !== nextImageData.height) {
                 elements.sourceEffectCanvas.width = nextImageData.width;
                 elements.sourceEffectCanvas.height = nextImageData.height;
                  console.log("Redo: Resized source canvas.");
             }
             sourceEffectCtx.putImageData(nextImageData, 0, 0);

             // Update buttons and trigger full preview update
             updateHistoryButtonsUI();
             requestFullUpdate();
             showMessage("Redo successful.", false, elements.messageBox);
        } catch(e) {
             console.error(" handleRedoClick: Error putting redone state on canvas:", e);
             showMessage("Error during Redo.", true, elements.messageBox);
        }
     } else {
          console.warn("Redo: stateManager.redoState() returned null.");
     }
    console.log('[MainApp] handleRedoClick - END');
}

/**
 * Gets the currently selected effect name and its parameters from the UI controls.
 */
function getCurrentEffectAndParams() {
     const effect = elements.preEffectSelector?.value || 'none';
    const params = {
        // Read generic intensity value regardless, specific cases below will delete/overwrite if necessary
        intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10)
    };

    switch (effect) {
        case 'waveDistortion':
            params.amplitude = parseInt(elements.preEffectWaveAmplitudeSlider?.value || 10, 10);
            params.frequency = parseInt(elements.preEffectWaveFrequencySlider?.value || 5, 10);
            params.phase = parseInt(elements.preEffectWavePhaseSlider?.value || 0, 10) * (Math.PI / 180); // Convert degrees to radians
            params.direction = elements.preEffectWaveDirection?.value || 'horizontal';
            params.waveType = elements.preEffectWaveType?.value || 'sine';
            delete params.intensity; // Remove generic intensity as specific params exist
            break;
        case 'sliceShift':
            params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10); // Uses its own intensity slider
            params.direction = elements.sliceShiftDirection?.value || 'horizontal';
            // Keep intensity as it's the primary control here, read from sliceShift slider
            break;
        case 'pixelSort':
            params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10);
            params.direction = elements.pixelSortDirection?.value || 'horizontal';
            params.sortBy = elements.pixelSortBy?.value || 'brightness';
            delete params.intensity; // Uses specific controls, not generic intensity
            break;
        case 'scanLines':
             // Uses the generic intensity slider, labeled as "Darkness"
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10);
            break;
        // Effects using the *generic* intensity slider:
        case 'noise':
        case 'channelShift':
        case 'blockDisplace':
        case 'invertBlocks':
        case 'sierpinski':
        case 'fractalZoom':
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 30, 10);
             break;
        case 'none':
        default:
            // For 'none' or unknown effects, remove the intensity param
            delete params.intensity;
            break;
    }
    // console.log(`Effect: ${effect}, Params:`, params);
    return { effect, params };
}


/**
 * Handles changes for TILING sliders. Calls requestFullUpdate.
 * Also updates the displayed value spans.
 */
function handleSliderChange() {
    // Update value spans immediately on input
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;

    // Update generator value spans (add others as needed)
    if(elements.perlinScaleValue && elements.perlinScale) elements.perlinScaleValue.textContent = elements.perlinScale.value;

    // Debounce the full preview update
    requestFullUpdate();
}

/**
 * Handles changes for radio buttons and select dropdowns (tiling, mirroring, effects, generator type).
 * Calls relevant UI updates and requests a full preview update if necessary.
 */
function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;

    // console.log(`Option change detected: ${target.id || target.name}`);

    let needsFullUpdate = false;
    let needsTilingControlUpdate = false;
    let needsEffectControlUpdate = false;
    let needsGeneratorControlUpdate = false;


    if (target.name === 'tileShape') {
         needsTilingControlUpdate = true; // Update tiling controls (like skew/stagger visibility)
         needsFullUpdate = true; // Shape change requires redraw
    } else if (target.name === 'mirrorOption') {
         needsFullUpdate = true; // Mirror change requires redraw
    } else if (target.id === 'preEffectSelector') {
        needsEffectControlUpdate = true; // Update visibility of effect parameters
        needsFullUpdate = true; // Effect selection change requires redraw (to preview it)
    } else if (target.closest('#preEffectOptionsContainer')) {
         needsFullUpdate = true; // Change within effect options requires redraw
    } else if (target.id === 'generatorType') {
         needsGeneratorControlUpdate = true; // Update visibility of generator parameters
         // No full update needed here, only when 'Generate' is clicked
    }
    // Add checks for other option types if necessary

    // Perform UI visibility updates synchronously
    if (needsTilingControlUpdate) {
         // Pass handleSliderChange in case default scale needs updating
         if(elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange);
    }
    if (needsEffectControlUpdate) {
         if(elements.preEffectSelector) updatePreEffectControlsVisibility(elements);
    }
     if (needsGeneratorControlUpdate) {
          if(elements.generatorType) updateGeneratorControlsVisibility(elements);
     }


    // Trigger the potentially debounced full update if needed
    if (needsFullUpdate) {
        requestFullUpdate();
    }
}


/**
 * Handles the loading of a new image file. Uses stateManager.
 * Resets state, updates UI, loads image, sets initial history.
 */
function handleImageLoad(event) {
    console.log("[MainApp] handleImageLoad - START");
    try {
        if (!elements.messageBox || !elements.sourceEffectCanvas || !elements.imageLoader || !sourceEffectCtx) {
             console.error(" handleImageLoad: Cannot run - prerequisites missing.");
             if(elements.imageLoader) elements.imageLoader.value = ''; // Clear input if failed early
             return;
        }

        // Helper function to reset the entire app state (UI and data)
        const resetAppForLoad = () => {
            console.log(" handleImageLoad: Calling resetApp (UI reset + state reset).");
             // Reset UI (including enabling generator controls, disabling others)
            resetUIState(elements,
                () => updateTilingControlsVisibility(elements, handleSliderChange),
                () => updatePreEffectControlsVisibility(elements),
                handleSliderChange,
                updateHistoryButtonsUI,
                () => updateGeneratorControlsVisibility(elements) // Pass generator update func
            );
            stateManager.resetStateData(); // Reset core state data
             if (elements.messageBox) showMessage("Ready to load a new image or generate pattern.", false, elements.messageBox);
             if(elements.imageLoader) elements.imageLoader.value = ''; // Clear input after reset
        };

        const file = event.target.files?.[0];
        if (!file) { return; } // No file selected
        if (!file.type.startsWith('image/')) {
            showMessage("Invalid file type. Please select an image.", true, elements.messageBox);
             resetAppForLoad(); // Reset on invalid file type
            return;
        }

        showMessage("Loading image...", false, elements.messageBox);
        stateManager.setProcessing(true); // Prevent actions during load
        const originalFileName = file.name;
        const reader = new FileReader();

        reader.onload = (e) => {
             if (!e.target?.result) {
                 showMessage("Failed to read file.", true, elements.messageBox);
                 resetAppForLoad();
                 stateManager.setProcessing(false);
                 return;
            }
            const img = new Image();
            img.onload = () => {
                 if (!img.naturalWidth || !img.naturalHeight) {
                     showMessage("Could not decode image.", true, elements.messageBox);
                     resetAppForLoad();
                     stateManager.setProcessing(false);
                     return;
                 }

                 // --- State Reset and Setup ---
                 stateManager.clearHistoryState(); // Clear previous history FIRST
                 stateManager.setImageData(img, originalFileName); // Set new image and dimensions in state
                 // State reset within setImageData handles zoom/pan reset

                 // --- Update UI Controls ---
                 // Set output dimensions to match loaded image
                 if(elements.outputWidthInput) elements.outputWidthInput.value = String(img.naturalWidth);
                 if(elements.outputHeightInput) elements.outputHeightInput.value = String(img.naturalHeight);

                 // Update source preview display
                 if(elements.sourcePreview) {
                     elements.sourcePreview.src = e.target.result;
                     elements.sourcePreview.classList.remove('hidden');
                     // Reset transform explicitly after setting src
                     elements.sourcePreview.style.transform = 'translate(0px, 0px) scale(1)';
                 }
                 if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
                 if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
                 if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = '1.0';
                 if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

                 // <<< Disable Generator Controls >>>
                  elements.generatorType?.setAttribute('disabled', 'true');
                  elements.generatorWidth?.setAttribute('disabled', 'true');
                  elements.generatorHeight?.setAttribute('disabled', 'true');
                  elements.perlinScale?.setAttribute('disabled', 'true'); // Disable specific generator controls
                  elements.perlinColor1?.setAttribute('disabled', 'true');
                  elements.perlinColor2?.setAttribute('disabled', 'true');
                  elements.generatePatternButton?.setAttribute('disabled', 'true');
                 // ---

                 // Defer canvas drawing and enabling controls until next frame
                 requestAnimationFrame(() => {
                    if (!sourceEffectCtx) { resetAppForLoad(); stateManager.setProcessing(false); return; }

                    // Update visual pan/zoom transform (should be 0,0,1 initially)
                    const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
                    // Ensure state reflects the initial 0,0 offsets after load
                    stateManager.setCurrentOffsets(clampedX, clampedY);

                    // Resize source canvas
                    const {width: initialWidth, height: initialHeight} = stateManager.getOriginalDimensions();
                     if (!initialWidth || !initialHeight) {
                          console.error("Image Load: Invalid dimensions obtained from state manager.");
                          resetAppForLoad();
                          stateManager.setProcessing(false);
                          return;
                     }
                    elements.sourceEffectCanvas.width = initialWidth;
                    elements.sourceEffectCanvas.height = initialHeight;

                    // Draw initial state (panned/zoomed image) onto source canvas
                    if (redrawSourceCanvasWithEffect()) { // Draws the base image (no effect selected yet)
                        try {
                             // Get ImageData and push as initial history state
                             const initialImageData = sourceEffectCtx.getImageData(0, 0, initialWidth, initialHeight);
                             stateManager.pushHistoryState(initialImageData);
                             updateHistoryButtonsUI(); // Update button state after history push
                        } catch(histError) {
                             console.error(" Image Load: History init error:", histError);
                             showMessage("Error initializing image state.", true, elements.messageBox);
                             resetAppForLoad();
                             stateManager.setProcessing(false);
                             return;
                        }
                    } else {
                         console.error(" Image Load: Initial redraw FAILED.");
                         showMessage("Error drawing initial image.", true, elements.messageBox);
                         resetAppForLoad();
                         stateManager.setProcessing(false);
                         return;
                    }

                    // --- Enable Downstream UI Controls ---
                    if(elements.saveButton) elements.saveButton.disabled = false;
                    if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                    if(elements.sourceZoomSlider) elements.sourceZoomSlider.disabled = false; // Enable zoom
                    elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                    elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                    // Enable sliders/selects EXCEPT generator ones
                    elements.sliders?.forEach(s => {
                        // Check if element exists and is NOT a generator control before enabling
                        if(s && s !== elements.perlinScale /* && s !== elements.otherGenSlider... */) {
                            s.disabled = false;
                        }
                    });
                    elements.selects?.forEach(s => {
                         if(s && s !== elements.generatorType) {
                             s.disabled = false;
                         }
                    });
                    if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                    if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                    if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
                    if(elements.preEffectSelector) elements.preEffectSelector.disabled = false; // Enable effect dropdown


                    // Update visibility based on defaults
                    updateTilingControlsVisibility(elements, handleSliderChange);
                    updatePreEffectControlsVisibility(elements);
                    updateGeneratorControlsVisibility(elements); // Ensure generator options remain hidden/disabled

                    requestFullUpdate(); // Trigger initial preview
                    stateManager.setProcessing(false); // Loading complete
                    showMessage('Image loaded. Adjust effect/tiling controls.', false, elements.messageBox);
                });
            };
            img.onerror = () => {
                 showMessage("Failed to load image data. The file might be corrupt or unsupported.", true, elements.messageBox);
                 resetAppForLoad();
                 stateManager.setProcessing(false);
            };
            img.src = e.target.result; // Start loading image data
        };
        reader.onerror = () => {
             showMessage("Error reading file.", true, elements.messageBox);
             resetAppForLoad();
             stateManager.setProcessing(false);
        };
        reader.readAsDataURL(file); // Start reading file

    } catch (error) {
        console.error("[MainApp] UNEXPECTED ERROR in handleImageLoad:", error);
        showMessage("A critical error occurred during image loading.", true, elements.messageBox);
         try { resetAppForLoad(); } catch (resetError) { /* ignore */ }
         stateManager.setProcessing(false); // Ensure flag is reset on error
    }
}


/**
 * NEW: Handler for Generate Pattern Button Click.
 * Generates pattern, resets state, updates UI, sets initial history.
 */
function handleGeneratePatternClick() {
    console.log("[MainApp] handleGeneratePatternClick - START");
     if (!elements.sourceEffectCanvas || !sourceEffectCtx) {
         showMessage("Canvas not ready for generation.", true, elements.messageBox); return;
     }
     if (stateManager.isProcessing()) {
         showMessage("Cannot generate while processing.", true, elements.messageBox); return;
     }

    stateManager.setProcessing(true); // Prevent concurrent operations
    showMessage("Generating pattern...", false, elements.messageBox);

    // --- Get Parameters ---
    const generatorType = elements.generatorType?.value || 'perlin';
    const generatorFunc = generatorFunctions[generatorType];

    if (!generatorFunc) {
        showMessage(`Generator type "${generatorType}" not implemented.`, true, elements.messageBox);
        stateManager.setProcessing(false);
        return;
    }

    const params = { // Default values just in case inputs are missing
        width: parseInt(elements.generatorWidth?.value || 512, 10),
        height: parseInt(elements.generatorHeight?.value || 512, 10),
    };

    // Validate dimensions
    if (isNaN(params.width) || params.width <= 0 || isNaN(params.height) || params.height <= 0) {
        showMessage(`Invalid dimensions for generation: ${params.width}x${params.height}`, true, elements.messageBox);
        stateManager.setProcessing(false);
        return;
    }


    // Add specific params based on type
    if (generatorType === 'perlin') {
        params.scale = parseFloat(elements.perlinScale?.value || 50);
        params.color1 = elements.perlinColor1?.value || '#000000';
        params.color2 = elements.perlinColor2?.value || '#ffffff';
        // Add octaves, persistence later if UI is added
    }
    // Add params for other generator types here...

    // --- Generate (Use setTimeout for UI responsiveness) ---
    setTimeout(() => {
        try {
            console.log(`Calling generator: ${generatorType} with params:`, params);
            const generatedImageData = generatorFunc(elements.sourceEffectCanvas, sourceEffectCtx, params);

            if (!generatedImageData || !(generatedImageData instanceof ImageData)) {
                 throw new Error("Pattern generation function failed or returned invalid data.");
            }
             console.log(`Generated ImageData: ${generatedImageData.width}x${generatedImageData.height}`);

            // --- Reset State for Generated Source ---
            stateManager.clearHistoryState(); // Clear previous history FIRST
            stateManager.setImageData(null, `generated_${generatorType}.png`); // Set source type (no Image obj), filename
            stateManager.setGeneratedDimensions(params.width, params.height); // Set dimensions in state
            // Zoom/pan reset happens within setImageData

            // --- Update UI Controls ---
            // Update Output Dimension UI to match generated size
             if(elements.outputWidthInput) elements.outputWidthInput.value = String(params.width);
             if(elements.outputHeightInput) elements.outputHeightInput.value = String(params.height);

            // Update Source Preview (use Data URL from the canvas AFTER generation)
             if(elements.sourcePreview) {
                 try {
                    elements.sourcePreview.src = elements.sourceEffectCanvas.toDataURL(); // Get URL from canvas content
                    elements.sourcePreview.classList.remove('hidden');
                    elements.sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; // Reset transform visually
                 } catch(e) {
                      console.error("Error getting data URL for source preview:", e);
                      showMessage("Error updating source preview.", true, elements.messageBox);
                 }
             }
             if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
             if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab'; // Enable panning visually
             if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = '1.0';
             if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

             // <<< Enable Image Loader after generating (Allow override) >>>
              if(elements.imageLoader) elements.imageLoader.disabled = false;
              // Keep generator controls enabled as well
               elements.generatorType?.removeAttribute('disabled');
               elements.generatorWidth?.removeAttribute('disabled');
               elements.generatorHeight?.removeAttribute('disabled');
               elements.perlinScale?.removeAttribute('disabled'); // Enable specific controls
               elements.perlinColor1?.removeAttribute('disabled');
               elements.perlinColor2?.removeAttribute('disabled');
               elements.generatePatternButton?.removeAttribute('disabled');


             // --- Push History & Enable Downstream ---
            stateManager.pushHistoryState(generatedImageData); // Push the generated pattern as the first state

            // Enable relevant controls
            if(elements.saveButton) elements.saveButton.disabled = false;
            if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.disabled = false; // Enable zoom
            elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
            elements.mirrorOptions?.forEach(opt => opt.disabled = false);
             // Enable sliders/selects EXCEPT generator ones (they should remain enabled)
            elements.sliders?.forEach(s => {
                if(s && s !== elements.perlinScale /* && s !== elements.otherGenSlider... */) {
                     s.disabled = false;
                }
            });
            elements.selects?.forEach(s => {
                 if(s && s !== elements.generatorType) {
                     s.disabled = false;
                 }
            });
            if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
            if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
            if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
             if(elements.preEffectSelector) elements.preEffectSelector.disabled = false;


            // --- Final UI Updates ---
            updateHistoryButtonsUI(); // Update undo state
            updateTilingControlsVisibility(elements, handleSliderChange);
            updatePreEffectControlsVisibility(elements);
            updateGeneratorControlsVisibility(elements); // Ensure correct generator options still shown

            requestFullUpdate(); // Trigger tiling preview
            showMessage(`Generated ${generatorType} pattern successfully.`, false, elements.messageBox);

        } catch (error) {
            console.error("Error during pattern generation or state update:", error);
            showMessage(`Error generating pattern: ${error.message || 'Unknown error'}`, true, elements.messageBox);
             // Consider resetting generator button state?
             // if (elements.generatePatternButton) elements.generatePatternButton.disabled = false;
        } finally {
            stateManager.setProcessing(false); // Generation attempt finished
             console.log("[MainApp] handleGeneratePatternClick - END");
        }
    }, 10); // Short timeout to allow "Generating..." message to show
}


/**
 * Handles saving the final processed image. Uses stateManager.
 */
function saveImage() {
    console.log("[MainApp] saveImage called.");
     const currentState = stateManager.getState(); // Get current state
     // Check if there's a source (indicated by originalWidth being set)
     if (!elements.canvas || !currentState.originalWidth || currentState.originalWidth <= 0) {
        showMessage("Cannot save: No image loaded or pattern generated.", true, elements.messageBox); return;
    }
     if (currentState.isProcessing) {
          showMessage("Cannot save while processing.", true, elements.messageBox); return;
     }

    try {
        const finalCanvas = elements.canvas; // This is the <canvas id="imageCanvas"> where tiling result is drawn

        // Get desired output dimensions from UI, fallback to current canvas size
        const outputWidth = parseInt(elements.outputWidthInput?.value, 10) || finalCanvas.width;
        const outputHeight = parseInt(elements.outputHeightInput?.value, 10) || finalCanvas.height;

        if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
             throw new Error(`Invalid output dimensions specified: ${outputWidth}x${outputHeight}`);
        }

        let canvasToSave = finalCanvas;

        // If requested dimensions differ from the final tiling canvas, resize using a temporary canvas
        if (outputWidth !== finalCanvas.width || outputHeight !== finalCanvas.height) {
             console.log(`Resizing final image from ${finalCanvas.width}x${finalCanvas.height} to ${outputWidth}x${outputHeight} for saving.`);
             const tempSaveCanvas = document.createElement('canvas');
             tempSaveCanvas.width = outputWidth;
             tempSaveCanvas.height = outputHeight;
             const tempCtx = tempSaveCanvas.getContext('2d');
             if (!tempCtx) throw new Error("Could not create temporary canvas context for saving.");

             tempCtx.imageSmoothingEnabled = true;
             tempCtx.imageSmoothingQuality = 'high'; // Use high quality for resizing
             tempCtx.drawImage(finalCanvas, 0, 0, finalCanvas.width, finalCanvas.height, 0, 0, outputWidth, outputHeight);
             canvasToSave = tempSaveCanvas; // Use the resized canvas for getting data URL
        }

        // Generate Data URL and trigger download
        const dataURL = canvasToSave.toDataURL('image/png');
        const link = document.createElement('a');
        // Use the stored original filename (or generated name) as base
        const baseName = stateManager.getOriginalFileName().replace(/\.[^/.]+$/, "");
        link.download = `${baseName}_MeltMixPix.png`; // Construct filename
        link.href = dataURL;
        link.click(); // Trigger download
        showMessage("Image saved successfully!", false, elements.messageBox);

    } catch (error) {
         console.error("Error saving image:", error);
         showMessage(`Error saving image: ${error.message || 'Unknown error'}.`, true, elements.messageBox);
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners - START");
    if (!elements.imageLoader) {
         console.error("Cannot setup listeners - imageLoader element not found.");
         return;
    }

    // --- Source Inputs ---
    elements.imageLoader.addEventListener('change', handleImageLoad);
    elements.generatePatternButton?.addEventListener('click', handleGeneratePatternClick);
    // <<< ADD Listener for Generator Type Change >>>
    elements.generatorType?.addEventListener('change', () => updateGeneratorControlsVisibility(elements));

    // --- Action Buttons ---
    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);

    // --- Option Radios/Selects ---
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange);
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);
    // Add listeners for selects within effect options
    const effectOptionSelects = [
        elements.preEffectWaveDirection, elements.preEffectWaveType,
        elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
    ];
    effectOptionSelects.forEach(select => { if(select) select.addEventListener('change', handleOptionChange); });


    // --- Sliders (using setupSliderListener for value display + update call) ---
    // Tiling Sliders (call handleSliderChange -> requestFullUpdate)
    setupSliderListener(elements.tilesXSlider, elements.tilesXValueSpan, handleSliderChange);
    setupSliderListener(elements.tilesYSlider, elements.tilesYValueSpan, handleSliderChange);
    setupSliderListener(elements.skewSlider, elements.skewValueSpan, handleSliderChange, val => parseFloat(val).toFixed(1));
    setupSliderListener(elements.staggerSlider, elements.staggerValueSpan, handleSliderChange, val => parseFloat(val).toFixed(2));
    setupSliderListener(elements.scaleSlider, elements.scaleValueSpan, handleSliderChange, val => parseFloat(val).toFixed(2));
    setupSliderListener(elements.preTileXSlider, elements.preTileXValueSpan, handleSliderChange);
    setupSliderListener(elements.preTileYSlider, elements.preTileYValueSpan, handleSliderChange);

    // Effect Sliders (call requestFullUpdate directly for preview)
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°');
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate);

    // Generator Sliders (currently just update display, no immediate preview update needed)
     setupSliderListener(elements.perlinScale, elements.perlinScaleValue, handleSliderChange); // Call handleSliderChange to update span
     // Add setupSliderListener for other generator params here... e.g., colors
     elements.perlinColor1?.addEventListener('change', () => {/* maybe live preview later */});
     elements.perlinColor2?.addEventListener('change', () => {/* maybe live preview later */});


    // Source Zoom Slider (updates state, transform, and requests full update)
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => {
                 // Update state first
                 stateManager.setZoomLevel(parseFloat(elements.sourceZoomSlider.value));
                 // Update the visual transform based on new zoom level
                 const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
                 // Store the clamped offsets back into state
                 stateManager.setCurrentOffsets(clampedX, clampedY);
                 // Request full update which will use the new zoom/offset state
                 requestFullUpdate();
             },
             val => parseFloat(val).toFixed(1) // Formatter for display
         );
    }

    // --- Output Dimensions ---
    const dimensionChangeHandler = (e) => {
        const aspectRatio = stateManager.getOriginalAspectRatio(); // Get current ratio from state
        handleDimensionChange(e, elements, aspectRatio); // Use utility function
    };
    elements.outputWidthInput?.addEventListener('input', dimensionChangeHandler);
    elements.outputHeightInput?.addEventListener('input', dimensionChangeHandler);
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => {
        // When checked, immediately apply aspect ratio based on width input
        if (elements.keepAspectRatioCheckbox?.checked && stateManager.getOriginalDimensions().width > 0 && elements.outputWidthInput) {
             dimensionChangeHandler({ target: elements.outputWidthInput });
        }
    });

    // --- Panning Listeners ---
    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => {
             // Use utility function to check if pan should start
             if (!startPan(e, elements)) return;
             // Get starting state from stateManager
             stateManager.setDragging(true, e.pageX, e.pageY); // Store start drag position in state
         });

         document.addEventListener('mousemove', (e) => {
             if (!stateManager.isDragging()) return; // Check dragging state via manager
             const panState = stateManager.getPanState(); // Get drag start info from state
             // Calculate new offsets using utility function
             const { newOffsetX, newOffsetY } = panMove(e, panState.dragStartX, panState.dragStartY, panState.startOffsetX, panState.startOffsetY);
             // Update state manager (it just stores the raw offset)
             stateManager.updatePanOffsets(newOffsetX, newOffsetY);
             // Update the visual transform (this clamps the offsets)
             const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
             // Store the *actual applied* (clamped) offsets back into state
             // This ensures the state reflects what's visually represented
             stateManager.setCurrentOffsets(clampedX, clampedY);
              // Note: requestFullUpdate is NOT called here for performance during drag. It's called on mouseup.
         });

         const endPanHandler = (e) => { // Added 'e' parameter although not used in this handler
             if (stateManager.isDragging()) {
                 stateManager.setDragging(false); // Update dragging state
                 endPan(elements); // Update cursor via utility
                 requestFullUpdate(); // Trigger final preview update *after* panning stops
             }
         };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler); // Handle case where mouse leaves window while dragging
     }
     console.log("[MainApp] setupEventListeners - END");
}


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] initializeApp - START");

      try {
            // --- Populate the 'elements' object ---
            // Assign all elements first
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
                 // Hidden Canvases
                mirrorCanvas: document.getElementById('mirrorCanvas'),
                preTileCanvas: document.getElementById('preTileCanvas'),
                canvas: document.getElementById('imageCanvas'), // Final output canvas
                sourceEffectCanvas: document.getElementById('sourceEffectCanvas'), // Effects/Generation canvas
                 // Buttons
                applyEffectButton: document.getElementById('applyEffectButton'),
                undoButton: document.getElementById('undoButton'),
                redoButton: document.getElementById('redoButton'),
                generatePatternButton: document.getElementById('generatePatternButton'),
                // Source Zoom
                sourceZoomSlider: document.getElementById('sourceZoom'),
                sourceZoomValueSpan: document.getElementById('sourceZoomValue'),
                 // Tiling Options
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
                 // Pre-Effect Options
                preEffectSelector: document.getElementById('preEffectSelector'),
                preEffectOptionsContainer: document.getElementById('preEffectOptionsContainer'),
                preEffectIntensityControl: document.getElementById('preEffectIntensityControl'),
                preEffectIntensitySlider: document.getElementById('preEffectIntensitySlider'),
                preEffectIntensityValue: document.getElementById('preEffectIntensityValue'),
                preEffectRealtimeWarning: document.getElementById('preEffectRealtimeWarning'),
                preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'),
                preEffectWaveAmplitudeSlider: document.getElementById('preEffectWaveAmplitudeSlider'),
                preEffectWaveAmplitudeValue: document.getElementById('preEffectWaveAmplitudeValue'),
                preEffectWaveFrequencySlider: document.getElementById('preEffectWaveFrequencySlider'),
                preEffectWaveFrequencyValue: document.getElementById('preEffectWaveFrequencyValue'),
                preEffectWavePhaseSlider: document.getElementById('preEffectWavePhaseSlider'),
                preEffectWavePhaseValue: document.getElementById('preEffectWavePhaseValue'),
                preEffectWaveDirection: document.getElementById('preEffectWaveDirection'),
                preEffectWaveType: document.getElementById('preEffectWaveType'),
                sliceShiftOptions: document.getElementById('sliceShiftOptions'),
                sliceShiftDirection: document.getElementById('sliceShiftDirection'),
                sliceShiftIntensitySlider: document.getElementById('sliceShiftIntensitySlider'),
                sliceShiftIntensityValue: document.getElementById('sliceShiftIntensityValue'),
                pixelSortOptions: document.getElementById('pixelSortOptions'),
                pixelSortThresholdSlider: document.getElementById('pixelSortThresholdSlider'),
                pixelSortThresholdValue: document.getElementById('pixelSortThresholdValue'),
                pixelSortDirection: document.getElementById('pixelSortDirection'),
                pixelSortBy: document.getElementById('pixelSortBy'),
                // Generator Elements
                generatorType: document.getElementById('generatorType'),
                generatorWidth: document.getElementById('generatorWidth'),
                generatorHeight: document.getElementById('generatorHeight'),
                perlinOptions: document.getElementById('perlinOptions'), // Container div for Perlin options
                perlinScale: document.getElementById('perlinScale'),
                perlinScaleValue: document.getElementById('perlinScaleValue'),
                perlinColor1: document.getElementById('perlinColor1'),
                perlinColor2: document.getElementById('perlinColor2')
                // sliders/selects arrays will be populated after this block
            };
            console.log(" initializeApp: Elements object populated.");

            // --- Populate grouped sliders/selects arrays (Done *after* elements obj is defined) ---
            elements.sliders = [
                elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider,
                elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider,
                elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider,
                elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider,
                elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider,
                elements.perlinScale // <<< ADD Generator Sliders
            ].filter(el => el !== null); // Filter out any missing elements

            elements.selects = [
                elements.preEffectSelector, elements.preEffectWaveDirection, elements.preEffectWaveType,
                elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy,
                 elements.generatorType // <<< ADD Generator Selects
            ].filter(el => el !== null);
            console.log(` initializeApp: Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);

            // --- Get initial context ---
            console.log(" initializeApp: Getting sourceEffectCtx...");
            sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
            if (!sourceEffectCtx) {
                throw new Error("CRITICAL - Failed to get context for sourceEffectCanvas!"); // Throw error to be caught below
            }
            console.log(" initializeApp: sourceEffectCtx obtained.");

            // --- Reset State and UI ---
            console.log(" initializeApp: Resetting stateManager data...");
            stateManager.resetStateData(); // Reset data state first
            console.log(" initializeApp: Resetting UI...");
             // Call UI reset function, passing all necessary update callbacks
            resetUIState(elements,
                () => updateTilingControlsVisibility(elements, handleSliderChange), // Tiling controls update func
                () => updatePreEffectControlsVisibility(elements),  // Effect controls update func
                handleSliderChange, // Main slider handler (for updating spans initially)
                updateHistoryButtonsUI, // History button update func
                () => updateGeneratorControlsVisibility(elements) // <<< Generator controls update func
            );
            console.log(" initializeApp: UI reset complete (generator controls initially enabled).");

            // --- Setup Event Listeners ---
            console.log(" initializeApp: Setting up event listeners...");
            setupEventListeners(); // Includes listeners for generator controls now
            console.log(" initializeApp: Event listeners setup complete.");

            // --- Final Initial UI State ---
            updateHistoryButtonsUI(); // Ensure undo/redo are initially disabled
            showMessage("Load an image OR generate a pattern to begin.", false, elements.messageBox);
            // Call initial visibility updates one last time after listeners are attached and state is reset
            updateTilingControlsVisibility(elements, handleSliderChange);
            updatePreEffectControlsVisibility(elements);
            updateGeneratorControlsVisibility(elements); // Ensure correct generator options show initially

            console.log("[MainApp] initializeApp - END - Ready.");

        } catch (error) { // Catch errors during initialization
             console.error("***** CRITICAL ERROR DURING INITIALIZEAPP *****", error);
             // Try to display error message even if elements.messageBox failed
             const msgBox = document.getElementById('messageBox'); // Try to get it again
             const errorMsg = `Initialization failed critically: ${error.message}. Check console.`;
             if (msgBox) showMessage(errorMsg, true, msgBox);
             else alert(errorMsg); // Fallback to alert

             // Attempt to disable all interactive elements found to prevent further errors
             const interactiveTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'];
             document.querySelectorAll(interactiveTags.join(',')).forEach(el => {
                 try {
                     el.disabled = true;
                 } catch(e) {}
             });
             console.log("Attempted to disable all form controls due to initialization error.");
        }
}

// --- Start the application ---
// Ensures the DOM is fully loaded before trying to access elements
document.addEventListener('DOMContentLoaded', initializeApp);
