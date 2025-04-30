// js/main.js (Includes Stacking + Pan/Zoom Fixes + EXTRA LOGGING for load issue)

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
    'none': null
};

// --- Core Processing Functions ---

/**
 * Redraws the sourceEffectCanvas for applying/previewing effects. (STACKING Version)
 */
function redrawSourceCanvasWithEffect() {
    console.log('[MainApp] redrawSourceCanvasWithEffect (STACKING) - START');
    if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) {
         console.error(" redrawSourceCanvasWithEffect: Missing prerequisites (canvas or context).");
         return false;
    }
    // console.log(` redrawSourceCanvasWithEffect: History index: ${state.historyIndex}, History length: ${state.history.length}`);
    // console.log(` redrawSourceCanvasWithEffect: state.currentImage available? ${!!state.currentImage}`);
    // console.log(` redrawSourceCanvasWithEffect: state.originalWidth/Height: ${state.originalWidth}x${state.originalHeight}`);

    const currentHistoryStateForDimensions = state.history[state.historyIndex];
    const currentWidth = state.originalWidth || currentHistoryStateForDimensions?.width;
    const currentHeight = state.originalHeight || currentHistoryStateForDimensions?.height;

    if (!currentWidth || !currentHeight) {
        console.error(` redrawSourceCanvasWithEffect: Cannot determine valid dimensions (Width: ${currentWidth}, Height: ${currentHeight}).`);
        if (!state.currentImage && state.history.length === 0) {
            console.error("  -> No current image loaded and history is empty.");
        }
        return false;
    }
    // console.log(` redrawSourceCanvasWithEffect: Determined dimensions to use: ${currentWidth}x${currentHeight}`);


    const canvas = elements.sourceEffectCanvas;
    const ctx = state.sourceEffectCtx;
    const previousState = state.history[state.historyIndex];

    if (!previousState && !state.currentImage) {
         console.error(" redrawSourceCanvasWithEffect: Cannot proceed - no previous history state and no base image.");
         showMessage("Error: Cannot determine base image state.", true, elements.messageBox);
         return false;
    }

    let baseImageData;

    if (previousState) {
        // console.log(` redrawSourceCanvasWithEffect: Starting redraw from history index: ${state.historyIndex}`);
        if (canvas.width !== previousState.width || canvas.height !== previousState.height) {
            canvas.width = previousState.width;
            canvas.height = previousState.height;
            // console.log(`  -> Resized sourceEffectCanvas to match history state ${canvas.width}x${canvas.height}`);
        }
         try {
            // console.log("  -> Attempting ctx.putImageData(previousState, 0, 0)");
            ctx.putImageData(previousState, 0, 0);
            // console.log("  -> Attempting ctx.getImageData(...) after putImageData");
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // console.log("  -> Drew previous history state onto canvas and captured baseImageData.");
        } catch (e) {
            console.error(" redrawSourceCanvasWithEffect: Error putting previous history state onto canvas:", e);
            showMessage("Error restoring previous state for stacking.", true, elements.messageBox);
            return false;
        }
    } else {
        // console.log(" redrawSourceCanvasWithEffect: No previous history state found, starting from original panned/zoomed image.");
         if (!state.currentImage) {
             console.error("  -> ERROR: No history and state.currentImage is missing!");
             return false;
         }
         if (!state.originalWidth || !state.originalHeight) {
              console.error(`  -> ERROR: No history and state.originalWidth/Height invalid: ${state.originalWidth}x${state.originalHeight}`);
              return false;
         }
         if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
            canvas.width = state.originalWidth;
            canvas.height = state.originalHeight;
            // console.log(`  -> Resized sourceEffectCanvas to original dimensions ${canvas.width}x${canvas.height}`);
         }
        // console.log("  -> Clearing canvas.");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const sourceRectWidth = state.originalWidth / state.sourceZoomLevel;
        const sourceRectHeight = state.originalHeight / state.sourceZoomLevel;
        const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
        const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;
        // console.log(`  -> Calculated initial source rect: sx=${sourceRectX.toFixed(1)}, sy=${sourceRectY.toFixed(1)}, sw=${sourceRectWidth.toFixed(1)}, sh=${sourceRectHeight.toFixed(1)}`);
        try {
            if (!state.currentImage || sourceRectWidth <= 0 || sourceRectHeight <= 0 || isNaN(sourceRectX) || isNaN(sourceRectY) || isNaN(sourceRectWidth) || isNaN(sourceRectHeight)) {
                console.error("  -> Invalid source image or rectangle dimensions for initial drawing.");
                throw new Error(`Invalid source image or rectangle dimensions for drawing.`);
            }
            // console.log("  -> Attempting ctx.drawImage(state.currentImage, ...)");
            ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
            // console.log("  -> Attempting ctx.getImageData(...) after initial drawImage");
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // console.log("  -> Drew initial panned/zoomed image onto canvas and captured baseImageData.");
        } catch (e) {
            console.error(" redrawSourceCanvasWithEffect: Error drawing initial source image:", e);
            showMessage("Error drawing source region.", true, elements.messageBox);
            return false;
         }
    }

    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        // console.log(` redrawSourceCanvasWithEffect: Applying effect: ${effect} on top of current canvas state.`);
        try {
             const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             const effectContext = { sourceImageData: baseImageData };
            //  console.log("  -> Calling effectFunction(currentImageData, params, effectContext)");
             effectFunction(currentImageData, params, effectContext);
            //  console.log("  -> Attempting ctx.putImageData(currentImageData, 0, 0) after effect applied");
             ctx.putImageData(currentImageData, 0, 0);
            //  console.log(`  -> Effect ${effect} applied (stacked).`);
        } catch (e) {
             console.error(` redrawSourceCanvasWithEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             return false;
        }
    } else {
        // console.log(" redrawSourceCanvasWithEffect: No effect selected ('none'). Canvas shows previous state.");
    }
    // console.log('[MainApp] redrawSourceCanvasWithEffect (STACKING) - END - Success');
    return true;
}


/**
 * Requests a full update of the final preview canvas. (Includes Pan/Zoom Fix)
 */
function requestFullUpdate() {
    // console.log('[MainApp] requestFullUpdate called.');
    if ((!state.currentImage && state.history.length === 0) || !elements.sourceEffectCanvas || !state.sourceEffectCtx) {
        // console.warn(" requestFullUpdate skipped: No image/history or canvas/context not ready.");
        return;
    }
    if (state.isProcessing) {
        // console.warn(" requestFullUpdate skipped: Already processing.");
        return;
    }
    if (state.debounceTimer) {
        // console.log(" requestFullUpdate: Clearing existing debounce timer.");
        clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(async () => {
        // console.log('[MainApp] Debounce timer finished. Initiating full update.');
        if ((!state.currentImage && state.history.length === 0) || state.isProcessing || !elements.sourceEffectCanvas || !state.sourceEffectCtx) {
            // console.warn(" requestFullUpdate: Full update skipped inside timeout: Prerequisites changed or missing.");
            // if(state.isProcessing) console.log("  -> Skipped reason: Now processing.");
            // else console.log("  -> Skipped reason: Image/history or canvas issue.");
            return;
        }
        // console.log(' requestFullUpdate: Prerequisites met for full update processing.');
        state.isProcessing = true;
        // console.log(' requestFullUpdate: Set isProcessing = true');

        const canvas = elements.sourceEffectCanvas;
        const ctx = state.sourceEffectCtx;
        const targetWidth = state.originalWidth;
        const targetHeight = state.originalHeight;

        if (!targetWidth || !targetHeight) {
             console.error(" requestFullUpdate: Invalid target dimensions (originalWidth/Height not set).");
             state.isProcessing = false;
             // console.log(' requestFullUpdate: Reset isProcessing = false due to error.');
             return;
        }
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
           canvas.width = targetWidth;
           canvas.height = targetHeight;
        //    console.log(` requestFullUpdate: Set sourceEffectCanvas size to ${canvas.width}x${canvas.height}`);
        }
        // console.log(' requestFullUpdate: Clearing sourceEffectCanvas.');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const currentStateFromHistory = state.history[state.historyIndex];
        // console.log(` requestFullUpdate: Attempting to use history index ${state.historyIndex}. History length: ${state.history.length}`);

        try {
            let sourceBitmap;
            let sourceDataWidth;
            let sourceDataHeight;

            if (currentStateFromHistory) {
                // console.log(' requestFullUpdate: Using latest history state as source.');
                sourceDataWidth = currentStateFromHistory.width;
                sourceDataHeight = currentStateFromHistory.height;
                // console.log('  -> Attempting createImageBitmap from history state...');
                sourceBitmap = await createImageBitmap(currentStateFromHistory);
                // console.log('  -> createImageBitmap from history state SUCCESS.');
            } else if (state.currentImage) {
                // console.log(' requestFullUpdate: Using original image as source (no history).');
                sourceDataWidth = state.originalWidth;
                sourceDataHeight = state.originalHeight;
                // console.log('  -> Attempting createImageBitmap from state.currentImage...');
                sourceBitmap = await createImageBitmap(state.currentImage);
                // console.log('  -> createImageBitmap from state.currentImage SUCCESS.');
            } else {
                throw new Error("No source data available (no history or currentImage).");
            }

             if (!sourceBitmap) {
                throw new Error("Failed to create ImageBitmap from source data.");
            }
            // console.log(` requestFullUpdate: Source data dimensions for drawing: ${sourceDataWidth}x${sourceDataHeight}`);

            const sourceRectWidth = sourceDataWidth / state.sourceZoomLevel;
            const sourceRectHeight = sourceDataHeight / state.sourceZoomLevel;
            const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
            const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;

            // console.log(` requestFullUpdate: Pan/Zoom State: zoom=${state.sourceZoomLevel.toFixed(2)}, offsetX=${state.currentOffsetX.toFixed(2)}, offsetY=${state.currentOffsetY.toFixed(2)}`);
            // console.log(` requestFullUpdate: Calculated Source Rect: sx=${sourceRectX.toFixed(2)}, sy=${sourceRectY.toFixed(2)}, sw=${sourceRectWidth.toFixed(2)}, sh=${sourceRectHeight.toFixed(2)}`);
            // console.log(` requestFullUpdate: Target Draw Area: dx=0, dy=0, dw=${canvas.width}, dh=${canvas.height}`);

            if (sourceRectWidth > 0 && sourceRectHeight > 0) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                // console.log(' requestFullUpdate: Attempting ctx.drawImage (subsection)...');
                ctx.drawImage(
                    sourceBitmap,
                    sourceRectX, sourceRectY,
                    sourceRectWidth, sourceRectHeight,
                    0, 0,
                    canvas.width, canvas.height
                );
                // console.log(' requestFullUpdate: Drew panned/zoomed subsection onto sourceEffectCanvas.');
            } else {
                 console.warn(' requestFullUpdate: Skipping drawImage - calculated source dimensions are invalid (<= 0).');
                 showMessage("Error: Invalid zoom or source dimensions.", true, elements.messageBox);
            }

            // console.log(' requestFullUpdate: Calling processAndPreviewImage...');
            processAndPreviewImage(
                canvas,
                elements,
                state,
                (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
            );
            // console.log(' requestFullUpdate: processAndPreviewImage call finished.');

        } catch (err) {
             console.error(" requestFullUpdate: Error during image processing:", err);
             showMessage(`Error updating preview: ${err.message}`, true, elements.messageBox);
        } finally {
            state.isProcessing = false; // Reset processing flag IMPORTANT
            // console.log(' requestFullUpdate: Reset isProcessing = false.');
            // console.log('[MainApp] Finished full update processing.');
        }

    }, 150); // Debounce time
}


// --- Event Handlers ---

/**
 * Handles the click event for the "Apply Pre-Effect" button. (STACKING Version)
 */
function handleApplyEffectClick() {
    console.log('[MainApp] handleApplyEffectClick - START');
    if (!state.currentImage && state.history.length === 0) {
        console.warn(' handleApplyEffectClick: Apply skipped: No image loaded or history base.');
        showMessage("Load an image first.", true, elements.messageBox);
        return;
    }
     if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) {
        console.warn(' handleApplyEffectClick: Apply skipped: Canvas or context missing.');
        showMessage("Canvas error. Cannot apply effect.", true, elements.messageBox);
        return;
    }
    if (state.isProcessing) {
        console.warn(' handleApplyEffectClick: Apply skipped: Already processing.');
        showMessage("Please wait, processing previous action.", true, elements.messageBox);
        return;
    }

    const { effect, params } = getCurrentEffectAndParams();
    // console.log(` handleApplyEffectClick: Effect to apply: '${effect}'`);

    console.log(` handleApplyEffectClick: Calling redrawSourceCanvasWithEffect to apply '${effect}' (stacking)...`);
    if (!redrawSourceCanvasWithEffect()) {
         console.error(` handleApplyEffectClick: redrawSourceCanvasWithEffect FAILED for effect '${effect}'.`);
         showMessage("Could not apply effect due to processing error.", true, elements.messageBox);
         return;
    }
    // console.log(` handleApplyEffectClick: redrawSourceCanvasWithEffect SUCCEEDED for effect '${effect}'.`);

    try {
        // console.log(" handleApplyEffectClick: Attempting to get ImageData after applying effect...");
        const imageDataToSave = state.sourceEffectCtx.getImageData(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height);
        // console.log(" handleApplyEffectClick: Got ImageData. Attempting pushHistoryState...");
        pushHistoryState(imageDataToSave, state, updateUndoRedoButtons, elements);
        // console.log(" handleApplyEffectClick: pushHistoryState completed.");
        showMessage(`Effect "${effect || 'None'}" applied (stacked) and saved to history.`, false, elements.messageBox);

        // console.log(" handleApplyEffectClick: Requesting full update after apply.");
        requestFullUpdate();

    } catch (e) {
        console.error(" handleApplyEffectClick: Error getting ImageData after applying effect or pushing history:", e);
        showMessage("Error saving applied effect state.", true, elements.messageBox);
    }
    // console.log('[MainApp] handleApplyEffectClick - END');
}

/**
 * Handles the Undo button click.
 */
function handleUndoClick() {
    console.log('[MainApp] handleUndoClick - START');
    if (!state.ctx) { console.warn(' handleUndoClick: Undo skipped: Main context (ctx) missing.'); return; }
    if (state.historyIndex <= 0) { console.log(' handleUndoClick: Undo skipped: Already at oldest state.'); return; }

    historyUndo(state, updateUndoRedoButtons, elements);

    // console.log(' handleUndoClick: Requesting full update after undo.');
    requestFullUpdate();
    showMessage("Undo successful.", false, elements.messageBox);
    // console.log('[MainApp] handleUndoClick - END');
}

/**
 * Handles the Redo button click.
 */
function handleRedoClick() {
    console.log('[MainApp] handleRedoClick - START');
     if (!state.ctx) { console.warn(' handleRedoClick: Redo skipped: Main context (ctx) missing.'); return; }
     if (state.historyIndex >= state.history.length - 1) { console.log(' handleRedoClick: Redo skipped: Already at newest state.'); return; }

    historyRedo(state, updateUndoRedoButtons, elements);

    // console.log(' handleRedoClick: Requesting full update after redo.');
    requestFullUpdate();
     showMessage("Redo successful.", false, elements.messageBox);
    // console.log('[MainApp] handleRedoClick - END');
}

/**
 * Gets the currently selected effect name and its parameters from the UI controls.
 */
function getCurrentEffectAndParams() {
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
            delete params.intensity;
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
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10);
            break;
        case 'noise':
        case 'channelShift':
        case 'blockDisplace':
        case 'invertBlocks':
        case 'sierpinski':
        case 'fractalZoom':
            break;
    }
    return { effect, params };
}

/**
 * Handles changes for TILING sliders.
 */
function handleSliderChange() {
    // console.log('[MainApp] handleSliderChange called.');
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    // console.log(" handleSliderChange: Requesting full update.");
    requestFullUpdate();
}

/**
 * Handles changes for radio buttons and select dropdowns.
 */
function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    // console.log(`[MainApp] handleOptionChange called. Element ID: ${target.id}, Name: ${target.name}, Value: ${target.value}`);

    let needsFullUpdate = false;
    let needsControlVisibilityUpdate = false;
    let sourceIsTilingShape = false;

    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        if(target.name === 'tileShape') {
            // console.log("  -> Tile shape changed.");
             needsControlVisibilityUpdate = true;
             sourceIsTilingShape = true;
        } else {
            // console.log("  -> Mirror option changed.");
            needsFullUpdate = true;
        }
    }
    else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
         if(target.id === 'preEffectSelector') {
            // console.log("  -> Pre-effect selector changed.");
             needsControlVisibilityUpdate = true;
         } else {
            // console.log("  -> Pre-effect parameter (select/radio) changed.");
         }
         needsFullUpdate = true;
    } else {
        // console.log("  -> Unhandled option change target:", target);
    }

    if (needsControlVisibilityUpdate) {
        // console.log("  -> Updating control visibility...");
        if (sourceIsTilingShape) {
             if(elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange);
        } else if (target.id === 'preEffectSelector') {
             if(elements.preEffectSelector) updatePreEffectControlsVisibility(elements);
        }
    }

    if (needsFullUpdate && !sourceIsTilingShape) {
        // console.log("  -> Requesting full update.");
        requestFullUpdate();
    } else {
        // console.log("  -> Full update skipped (either not needed or triggered by visibility update).");
    }
}


/**
 * Handles the loading of a new image file. (Includes extra logging)
 */
function handleImageLoad(event) {
    // <<< TRY...CATCH ADDED >>>
    console.log("[MainApp] handleImageLoad - START");
    try {
        if (!elements.messageBox || !elements.sourceEffectCanvas || !elements.imageLoader) {
             console.error(" handleImageLoad: Cannot run - prerequisites missing (messageBox, sourceEffectCanvas, or imageLoader).");
             if (elements.messageBox) showMessage("Initialization error. Please refresh.", true, elements.messageBox);
             if(elements.imageLoader) elements.imageLoader.value = '';
             return;
        }
        console.log(" handleImageLoad: Prerequisites met.");

        const resetFunc = () => {
            console.log(" handleImageLoad: Calling resetFunc (which calls resetState).");
            resetState(elements, state,
                () => updateTilingControlsVisibility(elements, handleSliderChange),
                () => updatePreEffectControlsVisibility(elements),
                handleSliderChange,
                () => clearHistory(state, updateUndoRedoButtons, elements)
            );
             if (elements.messageBox) showMessage("Ready to load a new image.", false, elements.messageBox);
             if(elements.imageLoader) elements.imageLoader.value = '';
            console.log(" handleImageLoad: resetFunc finished.");
        };

        const file = event.target.files?.[0];

        if (!file) {
            console.log(" handleImageLoad: No file selected in event.");
            return;
        }
        console.log(` handleImageLoad: File selected: ${file.name}, Type: ${file.type}`);

        if (!file.type.startsWith('image/')) {
            console.warn(" handleImageLoad: Invalid file type selected:", file.type);
            showMessage("Invalid file type. Please select an image (PNG, JPG, GIF).", true, elements.messageBox);
            resetFunc();
            return;
        }

        showMessage("Loading image...", false, elements.messageBox);
        state.originalFileName = file.name;
        console.log(" handleImageLoad: Reading file as DataURL...");

        const reader = new FileReader();

        console.log(" handleImageLoad: Assigning reader.onload...");
        reader.onload = (e) => {
             console.log(" handleImageLoad: reader.onload - START");
             if (!e.target?.result) {
                 console.error(" handleImageLoad: reader.onload - Error: File read result missing.");
                 showMessage("Error reading file data.", true, elements.messageBox);
                 resetFunc();
                 return;
             }
             console.log(" handleImageLoad: reader.onload - Creating Image object...");
            const img = new Image();

            console.log(" handleImageLoad: reader.onload - Assigning img.onload...");
            img.onload = () => {
                 console.log(" handleImageLoad: img.onload - START");
                 console.log(`  -> Image object loaded successfully: ${img.naturalWidth}x${img.naturalHeight}`);
                state.currentImage = img;
                state.originalWidth = img.naturalWidth;
                state.originalHeight = img.naturalHeight;

                if (!state.originalWidth || !state.originalHeight) {
                    console.error(" handleImageLoad: img.onload - Error: Image loaded with zero dimensions.");
                    showMessage("Error: Image has invalid dimensions.", true, elements.messageBox);
                    resetFunc(); return;
                }
                state.originalAspectRatio = state.originalWidth / state.originalHeight;
                // console.log(`  -> Set state: original dimensions ${state.originalWidth}x${state.originalHeight}, aspectRatio ${state.originalAspectRatio.toFixed(2)}`);

                // console.log(" handleImageLoad: img.onload - Updating UI elements...");
                if(elements.outputWidthInput) elements.outputWidthInput.value = state.originalWidth;
                if(elements.outputHeightInput) elements.outputHeightInput.value = state.originalHeight;
                if(elements.sourcePreview) {
                    elements.sourcePreview.src = e.target.result;
                    elements.sourcePreview.classList.remove('hidden');
                }
                if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
                if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';

                state.currentOffsetX = 0; state.currentOffsetY = 0; state.startOffsetX = 0; state.startOffsetY = 0;
                state.sourceZoomLevel = 1.0;
                if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
                if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';
                // console.log("  -> Reset pan/zoom state and UI.");

                // console.log(" handleImageLoad: img.onload - Requesting animation frame...");
                requestAnimationFrame(() => {
                    console.log(" handleImageLoad: requestAnimationFrame - START");
                    if (!state.sourceEffectCtx) {
                        console.error(" handleImageLoad: requestAnimationFrame - Error: sourceEffectCtx is missing.");
                        showMessage("Error: Cannot access drawing canvas context.", true, elements.messageBox);
                        resetFunc(); return;
                    }

                    // console.log(" handleImageLoad: requestAnimationFrame - Updating source preview transform...");
                    const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                    state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                    console.log(" handleImageLoad: requestAnimationFrame - Initializing sourceEffectCanvas size...");
                    elements.sourceEffectCanvas.width = state.originalWidth;
                    elements.sourceEffectCanvas.height = state.originalHeight;
                    // console.log(`  -> Set canvas size to ${elements.sourceEffectCanvas.width}x${elements.sourceEffectCanvas.height}`);

                    console.log(" handleImageLoad: requestAnimationFrame - Calling initial redrawSourceCanvasWithEffect...");
                    if (redrawSourceCanvasWithEffect()) {
                         console.log(" handleImageLoad: requestAnimationFrame - Initial redraw SUCCESS.");
                        try {
                            // console.log("  -> Getting initial ImageData...");
                             state.originalImageData = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
                            // console.log("  -> Clearing history...");
                             clearHistory(state, updateUndoRedoButtons, elements);
                            // console.log("  -> Pushing initial state to history...");
                             pushHistoryState(state.originalImageData, state, updateUndoRedoButtons, elements);
                             console.log("  -> History initialized.");
                        } catch(histError) {
                             console.error(" handleImageLoad: requestAnimationFrame - Error getting initial ImageData or initializing history:", histError);
                             showMessage("Error initializing image state.", true, elements.messageBox);
                             resetFunc(); return;
                         }
                    } else {
                        console.error(" handleImageLoad: requestAnimationFrame - Initial redraw FAILED.");
                         showMessage("Error preparing initial image.", true, elements.messageBox);
                        resetFunc(); return;
                    }

                    console.log(" handleImageLoad: requestAnimationFrame - Enabling UI controls...");
                    if(elements.saveButton) elements.saveButton.disabled = false;
                    if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                    elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                    elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                    elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                    elements.selects?.forEach(s => { if(s) s.disabled = false; });
                    if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                    if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                    if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
                    // console.log("  -> Controls enabled.");

                    console.log(" handleImageLoad: requestAnimationFrame - Updating control visibility...");
                    updateTilingControlsVisibility(elements, handleSliderChange);
                    updatePreEffectControlsVisibility(elements);
                    console.log(" handleImageLoad: requestAnimationFrame - Requesting initial full update...");
                    requestFullUpdate();
                    showMessage('Image loaded. Adjust effect/tiling controls.', false, elements.messageBox);
                    console.log(" handleImageLoad: requestAnimationFrame - END");
                }); // End requestAnimationFrame
                console.log(" handleImageLoad: img.onload - END");
            }; // End img.onload

            console.log(" handleImageLoad: reader.onload - Assigning img.onerror...");
            img.onerror = () => {
                console.error(" handleImageLoad: img.onerror - Error loading image into Image object.");
                showMessage("Error: Could not load the selected image data (invalid format?).", true, elements.messageBox);
                resetFunc();
            };
            console.log(" handleImageLoad: reader.onload - Setting img.src...");
            img.src = e.target.result;
            console.log(" handleImageLoad: reader.onload - END");
        }; // End reader.onload

         console.log(" handleImageLoad: Assigning reader.onerror...");
        reader.onerror = () => {
            console.error(" handleImageLoad: reader.onerror - Error reading file using FileReader.");
            showMessage("Error: Could not read the selected file.", true, elements.messageBox);
            resetFunc();
        };
         console.log(" handleImageLoad: Calling reader.readAsDataURL(file)...");
        reader.readAsDataURL(file);

    } catch (error) { // <<< CATCH BLOCK ADDED >>>
        console.error("[MainApp] UNEXPECTED ERROR in handleImageLoad:", error);
        showMessage("A critical error occurred during image loading. Please check console.", true, elements.messageBox);
         try {
             resetState(elements, state,
                 () => updateTilingControlsVisibility(elements, handleSliderChange),
                 () => updatePreEffectControlsVisibility(elements),
                 handleSliderChange,
                 () => clearHistory(state, updateUndoRedoButtons, elements)
             );
             if(elements.imageLoader) elements.imageLoader.value = '';
         } catch (resetError) {
            console.error("Error during reset after handleImageLoad failure:", resetError);
         }
    }
    console.log("[MainApp] handleImageLoad - END");
}


/**
 * Handles saving the final processed image from the main canvas.
 */
function saveImage() {
    console.log("[MainApp] saveImage called.");
     if (!elements.canvas || (!state.currentImage && state.history.length === 0)) {
        console.warn(" saveImage: Save cancelled: Canvas not ready or no image/history.");
        showMessage("Cannot save: No image processed yet.", true, elements.messageBox);
        return;
    }
     if (state.isProcessing) {
         console.warn(" saveImage: Save cancelled: Application is currently processing.");
         showMessage("Cannot save while processing, please wait.", true, elements.messageBox);
         return;
     }

    try {
        const finalCanvas = elements.canvas;
        const outputWidth = parseInt(elements.outputWidthInput?.value, 10) || finalCanvas.width;
        const outputHeight = parseInt(elements.outputHeightInput?.value, 10) || finalCanvas.height;

        if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
            console.error(` saveImage: Invalid output dimensions for saving: ${outputWidth}x${outputHeight}`);
            showMessage("Invalid output dimensions specified.", true, elements.messageBox);
            return;
        }

        let canvasToSave = finalCanvas;
        if (outputWidth !== finalCanvas.width || outputHeight !== finalCanvas.height) {
            // console.log(` saveImage: Resizing final image for save from ${finalCanvas.width}x${finalCanvas.height} to ${outputWidth}x${outputHeight}`);
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

        const dataURL = canvasToSave.toDataURL('image/png');
        const link = document.createElement('a');
        const baseName = state.originalFileName.replace(/\.[^/.]+$/, "");
        link.download = `${baseName}_MeltMixPix.png`;
        link.href = dataURL;
        link.click();
        // console.log(" saveImage: Image download initiated.");
        showMessage("Image saved successfully!", false, elements.messageBox);

    } catch (error) {
        console.error(" saveImage: Error during image saving:", error);
        showMessage(`Error saving image: ${error.message || 'Unknown error'}.`, true, elements.messageBox);
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners - START");
    if (!elements.imageLoader) {
        console.error(" setupEventListeners: CRITICAL - Cannot setup listeners: 'imageLoader' not found.");
        return;
    }

    // <<< LOGGING ADDED >>>
    console.log(" setupEventListeners: Attaching 'change' listener to elements.imageLoader:", elements.imageLoader);
    elements.imageLoader.addEventListener('change', handleImageLoad);
    console.log(" setupEventListeners: 'change' listener attached to imageLoader.");


    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);

    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));

    const tilingSliders = [
        elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider,
        elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider
    ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });

    elements.preEffectSelector?.addEventListener('change', handleOptionChange);

    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°');
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate);

    const effectSelects = [
        elements.preEffectWaveDirection, elements.preEffectWaveType,
        elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
    ];
    effectSelects.forEach(select => { if(select) select.addEventListener('change', handleOptionChange); });

    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => {
                //  console.log(' setupEventListeners: Zoom slider callback.');
                 handleSourceZoom(elements, state, () => updateSourcePreviewTransform(elements, state));
                 requestFullUpdate();
             },
             val => parseFloat(val).toFixed(1)
         );
    }

    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => {
        if (elements.keepAspectRatioCheckbox?.checked && state.currentImage && elements.outputWidthInput) {
            handleDimensionChange({ target: elements.outputWidthInput }, elements, state);
        }
    });

    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => { startPan(e, elements, state); });
         document.addEventListener('mousemove', (e) => {
             if (state.isDragging) {
                panMove( e, elements, state, () => updateSourcePreviewTransform(elements, state) );
             }
         });
         const endPanHandler = () => {
             if (state.isDragging) {
                //  console.log(' setupEventListeners: Pan ended via endPanHandler.');
                 endPan(elements, state, requestFullUpdate);
             }
         };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler);
     } else {
        console.warn(" setupEventListeners: Could not attach panning listeners: sourcePreviewContainer not found.");
     }
     console.log("[MainApp] setupEventListeners - END");
}


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] initializeApp - START");

     // --- Populate the 'elements' object ---
      elements = {
         imageLoader: document.getElementById('imageLoader'),
         saveButton: document.getElementById('saveButton'),
         messageBox: document.getElementById('messageBox'),
         outputWidthInput: document.getElementById('outputWidth'),
         outputHeightInput: document.getElementById('outputHeight'),
         keepAspectRatioCheckbox: document.getElementById('keepAspectRatio'),
         sourcePreviewContainer: document.getElementById('sourcePreviewContainer'),
         sourcePreview: document.getElementById('sourcePreview'),
         sourcePreviewText: document.getElementById('sourcePreviewText'),
         finalPreviewContainer: document.getElementById('finalPreviewContainer'),
         finalPreview: document.getElementById('finalPreview'),
         finalPreviewText: document.getElementById('finalPreviewText'),
         mirrorCanvas: document.getElementById('mirrorCanvas'),
         preTileCanvas: document.getElementById('preTileCanvas'),
         canvas: document.getElementById('imageCanvas'),
         sourceEffectCanvas: document.getElementById('sourceEffectCanvas'),
         applyEffectButton: document.getElementById('applyEffectButton'),
         undoButton: document.getElementById('undoButton'),
         redoButton: document.getElementById('redoButton'),
         sourceZoomSlider: document.getElementById('sourceZoom'),
         sourceZoomValueSpan: document.getElementById('sourceZoomValue'),
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
         sliders: [],
         selects: []
     };
    //   console.log(" initializeApp: Elements object populated.");

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
    //  console.log(` initializeApp: Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);

     const initialSourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
     if (!initialSourceEffectCtx) {
         console.error(" initializeApp: CRITICAL - Failed to get context for sourceEffectCanvas! Cannot proceed.");
         if (elements.messageBox) showMessage("Initialization Error: Cannot get canvas context. Please refresh.", true, elements.messageBox);
         return;
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
         ctx: initialSourceEffectCtx,
         history: [],
         historyIndex: -1
     };
    //  console.log(" initializeApp: State object initialized.");

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
    //  console.log(" initializeApp: Initial resetState complete.");

     setupEventListeners();

     updateUndoRedoButtons(elements, state);
    //  console.log(" initializeApp: Image Tiler Initialized and ready.");
     showMessage("Load an image to begin.", false, elements.messageBox);
     console.log("[MainApp] initializeApp - END");
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
