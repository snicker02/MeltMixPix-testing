// js/main.js (Refactored to use stateManager.js - Corrected uiUtils import)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetUIState, // <<< CORRECTED IMPORT NAME
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener, updateUndoRedoButtons
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// historyUtils import removed

// <<< ADD stateManager import >>>
import * as stateManager from './stateManager.js';

// --- Effect Imports --- (Keep these)
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
// state object removed

// Keep references to contexts needed by functions in this file
let sourceEffectCtx = null;


 // --- Effect Function Map --- (Keep this)
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
 * Needs access to state via stateManager and the sourceEffectCtx.
 * @returns {boolean} True if successful, false otherwise.
 */
function redrawSourceCanvasWithEffect() {
    // console.log('[MainApp] redrawSourceCanvasWithEffect (STACKING) - START');
    // Use state manager for checks
    const { width: originalWidth, height: originalHeight } = stateManager.getOriginalDimensions();
    const currentHistoryStateForDimensions = stateManager.getCurrentHistoryState(); // Check current state
    const currentWidth = originalWidth || currentHistoryStateForDimensions?.width;
    const currentHeight = originalHeight || currentHistoryStateForDimensions?.height;
    const currentImage = stateManager.getCurrentImage();
    const historyInfo = stateManager.getHistoryInfo();


    if (!elements.sourceEffectCanvas || !sourceEffectCtx) {
         console.error(" redrawSourceCanvasWithEffect: Missing prerequisites (canvas or context).");
         return false;
    }
    if (!currentWidth || !currentHeight) {
        console.error(` redrawSourceCanvasWithEffect: Cannot determine valid dimensions (Width: ${currentWidth}, Height: ${currentHeight}).`);
        if (!currentImage && historyInfo.length === 0) {
            console.error("  -> No current image loaded and history is empty.");
        }
        return false;
    }

    const canvas = elements.sourceEffectCanvas;
    const ctx = sourceEffectCtx; // Use local variable
    const previousState = stateManager.getCurrentHistoryState(); // Get current state before applying new effect

    if (!previousState && !currentImage) {
         console.error(" redrawSourceCanvasWithEffect: Cannot proceed - no previous history state and no base image.");
         showMessage("Error: Cannot determine base image state.", true, elements.messageBox);
         return false;
    }

    let baseImageData; // Holds data before the *selected* effect is applied

    if (previousState) {
        // console.log(` redrawSourceCanvasWithEffect: Starting redraw from history index: ${historyInfo.index}`);
        if (canvas.width !== previousState.width || canvas.height !== previousState.height) {
            canvas.width = previousState.width;
            canvas.height = previousState.height;
        }
         try {
            ctx.putImageData(previousState, 0, 0);
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) { console.error(" redrawSourceCanvasWithEffect: Error putting previous history state onto canvas:", e); return false; }
    } else {
        // console.log(" redrawSourceCanvasWithEffect: No previous history state found, starting from original panned/zoomed image.");
         if (!currentImage || !originalWidth || !originalHeight) {
              console.error(" redrawSourceCanvasWithEffect: Missing currentImage or original dimensions for initial draw.");
              return false;
         }
         if (canvas.width !== originalWidth || canvas.height !== originalHeight) {
            canvas.width = originalWidth;
            canvas.height = originalHeight;
         }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Use state manager for pan/zoom values
        const zoomLevel = stateManager.getZoomLevel();
        const { currentOffsetX, currentOffsetY } = stateManager.getPanState();
        const sourceRectWidth = originalWidth / zoomLevel;
        const sourceRectHeight = originalHeight / zoomLevel;
        const sourceRectX = -currentOffsetX / zoomLevel;
        const sourceRectY = -currentOffsetY / zoomLevel;
        try {
            if (!currentImage || sourceRectWidth <= 0 || sourceRectHeight <= 0 /*... more checks ...*/) {
                throw new Error(`Invalid source image or rectangle dimensions for drawing.`);
            }
            ctx.drawImage( currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) { console.error(" redrawSourceCanvasWithEffect: Error drawing initial source image:", e); return false; }
    }

    // Apply the *currently selected* effect
    const { effect, params } = getCurrentEffectAndParams(); // This function now only reads UI elements
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        // console.log(` redrawSourceCanvasWithEffect: Applying effect: ${effect} on top of current canvas state.`);
        try {
             const currentImageDataOnCanvas = ctx.getImageData(0, 0, canvas.width, canvas.height);
             // Pass baseImageData (state *before* this effect) as context if needed by the effect
             const effectContext = { sourceImageData: baseImageData };
             effectFunction(currentImageDataOnCanvas, params, effectContext); // Apply effect
             ctx.putImageData(currentImageDataOnCanvas, 0, 0); // Put result back
        } catch (e) { console.error(` redrawSourceCanvasWithEffect: Error applying effect '${effect}':`, e); return false; }
    } else {
        // console.log(" redrawSourceCanvasWithEffect: No effect selected ('none'). Canvas shows previous state.");
    }
    // console.log('[MainApp] redrawSourceCanvasWithEffect (STACKING) - END - Success');
    return true;
}


/**
 * Requests a full update of the final preview canvas. (Includes Pan/Zoom Fix)
 * Uses stateManager for checks and data retrieval. Adds canvas logging.
 */
function requestFullUpdate() {
    // console.log('[MainApp] requestFullUpdate called.'); // LOG POINT 1

    // Use state manager for checks
    const historyInfo = stateManager.getHistoryInfo();
    const check1 = !stateManager.getCurrentImage() && historyInfo.length === 0;
    const check2 = !elements.sourceEffectCanvas;
    const check3 = !sourceEffectCtx; // Use local context variable
    const isProcessing = stateManager.isProcessing();
    // console.log(` requestFullUpdate PRE-CHECKS: NoImage&History=${check1}, NoCanvas=${check2}, NoCtx=${check3}, IsProcessing=${isProcessing}`);


    if (check1 || check2 || check3) {
        // console.warn(" requestFullUpdate skipped (OUTSIDE setTimeout): Prerequisites failed.");
        return; // Exit if basic elements/state aren't ready
    }
    if (isProcessing) {
        // console.warn(" requestFullUpdate skipped (OUTSIDE setTimeout): Already processing.");
        return;
    }

    // Use a property on the stateManager? Or keep timer local to main.js? Local is fine.
    let debounceTimer = stateManager.getState().debounceTimer; // Get timer state if stored in stateManager
    if (!debounceTimer) debounceTimer = null; // Ensure it's null if undefined

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
        // console.log('[MainApp] Debounce timer finished. Initiating full update.'); // LOG POINT 2

        // Re-check prerequisites using state manager inside timeout
        const inHistoryInfo = stateManager.getHistoryInfo();
        const inCheck1 = !stateManager.getCurrentImage() && inHistoryInfo.length === 0;
        const inCheck2 = !elements.sourceEffectCanvas;
        const inCheck3 = !sourceEffectCtx;
        const inIsProcessing = stateManager.isProcessing(); // Re-check processing status
        // console.log(` requestFullUpdate INSIDE TIMEOUT PRE-CHECKS: NoImage&History=${inCheck1}, NoCanvas=${inCheck2}, NoCtx=${inCheck3}, IsProcessing=${inIsProcessing}`);


        if (inCheck1 || inIsProcessing || inCheck2 || inCheck3) {
            // console.warn(" requestFullUpdate: Full update skipped inside timeout: Prerequisites failed or already processing.");
            /* ... logging reasons ... */
            return; // Exit if prerequisites fail *inside* the timeout
        }

        // console.log(' requestFullUpdate: Prerequisites met for full update processing.');
        stateManager.setProcessing(true); // Set processing flag via manager
        // console.log(' requestFullUpdate: Set isProcessing = true');


        const canvas = elements.sourceEffectCanvas;
        const ctx = sourceEffectCtx; // Use local context
        const { width: targetWidth, height: targetHeight } = stateManager.getOriginalDimensions(); // Get dimensions


        if (!targetWidth || !targetHeight) {
             console.error(" requestFullUpdate: Invalid target dimensions (originalWidth/Height not set).");
             stateManager.setProcessing(false); // Reset flag via manager
             // console.log(' requestFullUpdate: Reset isProcessing = false due to invalid dimensions.');
             return;
        }

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
           canvas.width = targetWidth;
           canvas.height = targetHeight;
        //    console.log(` requestFullUpdate: Set sourceEffectCanvas size to ${canvas.width}x${canvas.height}`);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);


        const currentStateFromHistory = stateManager.getCurrentHistoryState(); // Get state via manager
        const currentImage = stateManager.getCurrentImage(); // Get base image via manager

        try {
            let sourceBitmap;
            let sourceDataWidth;
            let sourceDataHeight;

            if (currentStateFromHistory) {
                sourceDataWidth = currentStateFromHistory.width;
                sourceDataHeight = currentStateFromHistory.height;
                sourceBitmap = await createImageBitmap(currentStateFromHistory);
            } else if (currentImage) {
                const { width, height } = stateManager.getOriginalDimensions(); // Use manager
                sourceDataWidth = width;
                sourceDataHeight = height;
                sourceBitmap = await createImageBitmap(currentImage);
            } else {
                throw new Error("No source data available (no history or currentImage).");
            }

             if (!sourceBitmap) {
                throw new Error("Failed to create ImageBitmap from source data.");
            }

            // Use state manager for pan/zoom values
            const zoomLevel = stateManager.getZoomLevel();
            const { currentOffsetX, currentOffsetY } = stateManager.getPanState();
            const sourceRectWidth = sourceDataWidth / zoomLevel;
            const sourceRectHeight = sourceDataHeight / zoomLevel;
            const sourceRectX = -currentOffsetX / zoomLevel;
            const sourceRectY = -currentOffsetY / zoomLevel;

            if (sourceRectWidth > 0 && sourceRectHeight > 0) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(
                    sourceBitmap,
                    sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight,
                    0, 0, canvas.width, canvas.height
                );
                 // Log canvas content BEFORE tiling (optional)
                // try { console.log(' requestFullUpdate: sourceEffectCanvas content BEFORE tiling:', canvas.toDataURL().substring(0, 100) + '...'); } catch (e) {}

            } else {
                 console.warn(' requestFullUpdate: Skipping drawImage - calculated source dimensions are invalid (<= 0).');
                 showMessage("Error: Invalid zoom or source dimensions.", true, elements.messageBox);
            }

            // console.log(' requestFullUpdate: >>> Preparing to call processAndPreviewImage <<<');
            // Pass necessary state info to processAndPreviewImage if it needs it
            processAndPreviewImage(
                canvas,     // The prepared canvas (panned/zoomed subsection with effects)
                elements,
                stateManager.getState(), // Pass snapshot of current state if needed by tiling logic
                (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
            );
            // console.log(' requestFullUpdate: <<< processAndPreviewImage call finished >>>');

        } catch (err) {
             console.error(" requestFullUpdate: Error during image processing:", err);
             showMessage(`Error updating preview: ${err.message}`, true, elements.messageBox);
        } finally {
            stateManager.setProcessing(false); // Reset processing flag via manager
            // console.log(' requestFullUpdate: Reset isProcessing = false in finally block.');
            // console.log('[MainApp] Finished full update processing.');
        }

    }, 150); // Debounce time
     // Store timer ID if needed (e.g., stateManager.setDebounceTimer(debounceTimer))
}


// --- Event Handlers ---

/**
 * Updates undo/redo button states based on history info from stateManager.
 */
function updateHistoryButtonsUI() {
    const historyInfo = stateManager.getHistoryInfo();
    // Use the imported utility function
    updateUndoRedoButtons(elements, historyInfo); // Pass elements and historyInfo
}


/**
 * Handles the click event for the "Apply Pre-Effect" button. (STACKING Version)
 * Uses stateManager for history operations.
 */
function handleApplyEffectClick() {
    // console.log('[MainApp] handleApplyEffectClick - START');
    const historyInfo = stateManager.getHistoryInfo();
    if (!stateManager.getCurrentImage() && historyInfo.length === 0) {
        showMessage("Load an image first.", true, elements.messageBox); return;
    }
     if (!elements.sourceEffectCanvas || !sourceEffectCtx) { return; }
    if (stateManager.isProcessing()) { return; }

    const { effect, params } = getCurrentEffectAndParams();
    // console.log(` handleApplyEffectClick: Effect to apply: '${effect}'`);

    // console.log(` handleApplyEffectClick: Calling redrawSourceCanvasWithEffect to apply '${effect}' (stacking)...`);
    if (!redrawSourceCanvasWithEffect()) {
         showMessage("Could not apply effect due to processing error.", true, elements.messageBox); return;
    }

    try {
        const imageDataToSave = sourceEffectCtx.getImageData(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height);
        stateManager.pushHistoryState(imageDataToSave);
        updateHistoryButtonsUI();
        showMessage(`Effect "${effect || 'None'}" applied (stacked) and saved to history.`, false, elements.messageBox);
        requestFullUpdate();
    } catch (e) { console.error(" handleApplyEffectClick: Error getting ImageData after applying effect or pushing history:", e); }
    // console.log('[MainApp] handleApplyEffectClick - END');
}

/**
 * Handles the Undo button click. Uses stateManager.
 */
function handleUndoClick() {
    // console.log('[MainApp] handleUndoClick - START');
    if (!sourceEffectCtx) { return; }
    const historyInfo = stateManager.getHistoryInfo();
    if (historyInfo.index <= 0) { return; }

    const previousImageData = stateManager.undoState();

    if (previousImageData) {
         try {
             if (elements.sourceEffectCanvas.width !== previousImageData.width || elements.sourceEffectCanvas.height !== previousImageData.height) {
                 elements.sourceEffectCanvas.width = previousImageData.width;
                 elements.sourceEffectCanvas.height = previousImageData.height;
             }
             sourceEffectCtx.putImageData(previousImageData, 0, 0);
             updateHistoryButtonsUI();
             requestFullUpdate();
             showMessage("Undo successful.", false, elements.messageBox);
         } catch(e) { console.error(" handleUndoClick: Error putting undone state on canvas:", e); }
    }
    // console.log('[MainApp] handleUndoClick - END');
}

/**
 * Handles the Redo button click. Uses stateManager.
 */
function handleRedoClick() {
    // console.log('[MainApp] handleRedoClick - START');
     if (!sourceEffectCtx) { return; }
      const historyInfo = stateManager.getHistoryInfo();
     if (historyInfo.index >= historyInfo.length - 1) { return; }

    const nextImageData = stateManager.redoState();

     if (nextImageData) {
         try {
             if (elements.sourceEffectCanvas.width !== nextImageData.width || elements.sourceEffectCanvas.height !== nextImageData.height) {
                 elements.sourceEffectCanvas.width = nextImageData.width;
                 elements.sourceEffectCanvas.height = nextImageData.height;
             }
             sourceEffectCtx.putImageData(nextImageData, 0, 0);
             updateHistoryButtonsUI();
             requestFullUpdate();
             showMessage("Redo successful.", false, elements.messageBox);
        } catch(e) { console.error(" handleRedoClick: Error putting redone state on canvas:", e); }
    }
    // console.log('[MainApp] handleRedoClick - END');
}

/**
 * Gets the currently selected effect name and its parameters from the UI controls.
 * (No changes needed here as it only reads UI elements)
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
        // Effects using generic intensity:
        case 'noise': case 'channelShift': case 'blockDisplace': case 'invertBlocks': case 'sierpinski': case 'fractalZoom': break;
    }
    return { effect, params };
}

/**
 * Handles changes for TILING sliders. Calls requestFullUpdate.
 * (No changes needed here)
 */
function handleSliderChange() {
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    // No need to manually update debug slider spans here, setupSliderListener handles them
    requestFullUpdate();
}

/**
 * Handles changes for radio buttons and select dropdowns. Calls relevant UI updates and requestFullUpdate.
 * (No changes needed here)
 */
function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;

    let needsFullUpdate = false;
    let needsControlVisibilityUpdate = false;
    let sourceIsTilingShape = false;

    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        if(target.name === 'tileShape') {
             needsControlVisibilityUpdate = true;
             sourceIsTilingShape = true;
        } else {
            needsFullUpdate = true;
        }
    }
    else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
         if(target.id === 'preEffectSelector') {
             needsControlVisibilityUpdate = true;
         }
         needsFullUpdate = true;
    }

    if (needsControlVisibilityUpdate) {
        if (sourceIsTilingShape) {
             if(elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange);
        } else if (target.id === 'preEffectSelector') {
             if(elements.preEffectSelector) updatePreEffectControlsVisibility(elements);
        }
    }
    if (needsFullUpdate && !sourceIsTilingShape) {
        requestFullUpdate();
    }
}


/**
 * Handles the loading of a new image file. Uses stateManager.
 */
function handleImageLoad(event) {
    // console.log("[MainApp] handleImageLoad - START");
    try {
        if (!elements.messageBox || !elements.sourceEffectCanvas || !elements.imageLoader || !sourceEffectCtx) {
             console.error(" handleImageLoad: Cannot run - prerequisites missing.");
             if(elements.imageLoader) elements.imageLoader.value = '';
             return;
        }

        const resetApp = () => {
            // console.log(" handleImageLoad: Calling resetApp (UI reset + state reset).");
            resetUIState(elements, // Use renamed UI reset function
                () => updateTilingControlsVisibility(elements, handleSliderChange),
                () => updatePreEffectControlsVisibility(elements),
                handleSliderChange,
                updateHistoryButtonsUI // Pass the specific button update function
            );
            stateManager.resetStateData(); // Reset state data via stateManager
             if (elements.messageBox) showMessage("Ready to load a new image.", false, elements.messageBox);
             if(elements.imageLoader) elements.imageLoader.value = '';
        };

        const file = event.target.files?.[0];
        if (!file) { return; }
        if (!file.type.startsWith('image/')) {
            showMessage("Invalid file type.", true, elements.messageBox); resetApp(); return;
        }

        showMessage("Loading image...", false, elements.messageBox);
        const originalFileName = file.name;
        const reader = new FileReader();

        reader.onload = (e) => {
             if (!e.target?.result) { resetApp(); return; }
            const img = new Image();
            img.onload = () => {
                 if (!img.naturalWidth || !img.naturalHeight) { resetApp(); return; }

                 stateManager.setImageData(img, originalFileName);
                 stateManager.clearHistoryState();

                 if(elements.outputWidthInput) elements.outputWidthInput.value = String(img.naturalWidth); // Ensure string
                 if(elements.outputHeightInput) elements.outputHeightInput.value = String(img.naturalHeight); // Ensure string
                 if(elements.sourcePreview) {
                     elements.sourcePreview.src = e.target.result;
                     elements.sourcePreview.classList.remove('hidden');
                 }
                 if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
                 if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
                 if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = '1.0';
                 if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

                 requestAnimationFrame(() => {
                    if (!sourceEffectCtx) { resetApp(); return; }

                    const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
                    stateManager.setCurrentOffsets(clampedX, clampedY);

                    const {width: initialWidth, height: initialHeight} = stateManager.getOriginalDimensions();
                    elements.sourceEffectCanvas.width = initialWidth;
                    elements.sourceEffectCanvas.height = initialHeight;

                    if (redrawSourceCanvasWithEffect()) {
                        try {
                             const initialImageData = sourceEffectCtx.getImageData(0, 0, initialWidth, initialHeight);
                             stateManager.pushHistoryState(initialImageData);
                             updateHistoryButtonsUI();
                        } catch(histError) { console.error(" History init error:", histError); resetApp(); return; }
                    } else { console.error(" Initial redraw FAILED."); resetApp(); return; }

                    if(elements.saveButton) elements.saveButton.disabled = false;
                    if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                    elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                    elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                    elements.sliders?.forEach(s => { if(s) s.disabled = false; }); // Includes debug sliders
                    elements.selects?.forEach(s => { if(s) s.disabled = false; });
                    if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                    if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                    if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;

                    updateTilingControlsVisibility(elements, handleSliderChange);
                    updatePreEffectControlsVisibility(elements);
                    requestFullUpdate();
                    showMessage('Image loaded. Adjust effect/tiling controls.', false, elements.messageBox);
                });
            };
            img.onerror = () => { resetApp(); };
            img.src = e.target.result;
        };
        reader.onerror = () => { resetApp(); };
        reader.readAsDataURL(file);

    } catch (error) {
        console.error("[MainApp] UNEXPECTED ERROR in handleImageLoad:", error);
        showMessage("A critical error occurred during image loading. Please check console.", true, elements.messageBox);
         try { resetApp(); } catch (resetError) { /* ignore */ }
    }
    // console.log("[MainApp] handleImageLoad - END");
}


/**
 * Handles saving the final processed image. Uses stateManager.
 */
function saveImage() {
    // console.log("[MainApp] saveImage called.");
     if (!elements.canvas || (!stateManager.getCurrentImage() && stateManager.getHistoryInfo().length === 0)) {
        showMessage("Cannot save: No image processed yet.", true, elements.messageBox); return;
    }
     if (stateManager.isProcessing()) { showMessage("Cannot save while processing.", true, elements.messageBox); return; }

    try {
        const finalCanvas = elements.canvas;
        const outputWidth = parseInt(elements.outputWidthInput?.value, 10) || finalCanvas.width;
        const outputHeight = parseInt(elements.outputHeightInput?.value, 10) || finalCanvas.height;

        if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) { throw new Error("Invalid output dimensions."); }

        let canvasToSave = finalCanvas;
        if (outputWidth !== finalCanvas.width || outputHeight !== finalCanvas.height) {
            const tempSaveCanvas = document.createElement('canvas'); tempSaveCanvas.width = outputWidth; tempSaveCanvas.height = outputHeight;
            const tempCtx = tempSaveCanvas.getContext('2d');
            if (!tempCtx) throw new Error("Could not create temporary context for saving.");
            tempCtx.imageSmoothingEnabled = true; tempCtx.imageSmoothingQuality = 'high';
            tempCtx.drawImage(finalCanvas, 0, 0, finalCanvas.width, finalCanvas.height, 0, 0, outputWidth, outputHeight);
            canvasToSave = tempSaveCanvas;
        }

        const dataURL = canvasToSave.toDataURL('image/png');
        const link = document.createElement('a');
        const baseName = stateManager.getOriginalFileName().replace(/\.[^/.]+$/, "");
        link.download = `${baseName}_MeltMixPix.png`;
        link.href = dataURL; link.click();
        showMessage("Image saved successfully!", false, elements.messageBox);

    } catch (error) { showMessage(`Error saving image: ${error.message || 'Unknown error'}.`, true, elements.messageBox); }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners - START");
    if (!elements.imageLoader) { return; }

    // *** Ensure imageLoader listener is setup ***
    // console.log(" setupEventListeners: Attaching 'change' listener to elements.imageLoader:", elements.imageLoader);
    elements.imageLoader.addEventListener('change', handleImageLoad);
    // console.log(" setupEventListeners: 'change' listener attached to imageLoader.");


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
    // Use handleSliderChange which calls requestFullUpdate
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });

    elements.preEffectSelector?.addEventListener('change', handleOptionChange);

    // Use setupSliderListener which calls requestFullUpdate
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

    // Source Zoom - uses stateManager
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => {
                 stateManager.setZoomLevel(parseFloat(elements.sourceZoomSlider.value));
                 const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
                 stateManager.setCurrentOffsets(clampedX, clampedY);
                 requestFullUpdate();
             },
             val => parseFloat(val).toFixed(1)
         );
    }

    // Output Dimensions - uses stateManager
    const dimensionChangeHandler = (e) => {
        const changedInput = e.target;
        if (!stateManager.getCurrentImage() || !elements.keepAspectRatioCheckbox?.checked) return;
        const newValue = parseInt(changedInput.value, 10);
        if (isNaN(newValue) || newValue <= 0) return;
        const aspectRatio = stateManager.getOriginalAspectRatio();
        if (!aspectRatio) return;
        if (changedInput === elements.outputWidthInput && elements.outputHeightInput) {
            elements.outputHeightInput.value = String(Math.round(newValue / aspectRatio));
        } else if (changedInput === elements.outputHeightInput && elements.outputWidthInput) {
            elements.outputWidthInput.value = String(Math.round(newValue * aspectRatio));
        }
    };
    elements.outputWidthInput?.addEventListener('input', dimensionChangeHandler);
    elements.outputHeightInput?.addEventListener('input', dimensionChangeHandler);
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => {
        if (elements.keepAspectRatioCheckbox?.checked && stateManager.getCurrentImage() && elements.outputWidthInput) {
             dimensionChangeHandler({ target: elements.outputWidthInput });
        }
    });

    // Panning Listeners - uses stateManager
    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => {
             if (!stateManager.getCurrentImage() || e.button !== 0) return;
             if (e.target === elements?.sourcePreview) { e.preventDefault(); }
             stateManager.setDragging(true, e.pageX, e.pageY);
             if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grabbing'; }
         });
         document.addEventListener('mousemove', (e) => {
             if (!stateManager.isDragging()) return;
             const panState = stateManager.getPanState();
             const dx = e.pageX - panState.dragStartX;
             const dy = e.pageY - panState.dragStartY;
             const newOffsetX = panState.startOffsetX + dx;
             const newOffsetY = panState.startOffsetY + dy;
             stateManager.updatePanOffsets(newOffsetX, newOffsetY);
             const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
             if (newOffsetX !== clampedX || newOffsetY !== clampedY) {
                 stateManager.setCurrentOffsets(clampedX, clampedY);
             }
         });
         const endPanHandler = () => {
             if (stateManager.isDragging()) {
                 stateManager.setDragging(false);
                 if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grab'; }
                 requestFullUpdate();
             }
         };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler);
     }
     // console.log("[MainApp] setupEventListeners - END");
}


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] initializeApp - START");

     // --- Populate the 'elements' object ---
      try {
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
                // Debug Slider Elements - REMOVED FROM THIS REVERTED VERSION
                // Advanced Toggle Elements - REMOVED FROM THIS REVERTED VERSION
                sliders: [],
                selects: []
            };
            console.log(" initializeApp: Elements object populated.");

            // --- Populate grouped sliders/selects arrays ---
            console.log(" initializeApp: Grouping sliders...");
             // Revert to version WITHOUT debug sliders
            elements.sliders = [
                elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider,
                elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider,
                elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider,
                elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider,
                elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider
                // Debug sliders removed from this list
            ].filter(el => el !== null);
            console.log(" initializeApp: Sliders grouped successfully.");

            console.log(" initializeApp: Grouping selects...");
            elements.selects = [
                elements.preEffectSelector, elements.preEffectWaveDirection, elements.preEffectWaveType,
                elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
            ].filter(el => el !== null);
            console.log(" initializeApp: Selects grouped successfully.");

            console.log(` initializeApp: Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);

            // --- Get initial context ---
            console.log(" initializeApp: Getting sourceEffectCtx...");
            sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
            if (!sourceEffectCtx) {
                console.error(" initializeApp: CRITICAL - Failed to get context!");
                if (elements.messageBox) showMessage("Initialization Error: Canvas context.", true, elements.messageBox);
                return;
            }
            console.log(" initializeApp: sourceEffectCtx obtained.");

            // --- Reset State and UI ---
            console.log(" initializeApp: Resetting stateManager data...");
            stateManager.resetStateData();
            console.log(" initializeApp: stateManager data reset.");

            console.log(" initializeApp: Resetting UI...");
            resetUIState(elements,
                () => updateTilingControlsVisibility(elements, handleSliderChange),
                () => updatePreEffectControlsVisibility(elements),
                handleSliderChange,
                updateHistoryButtonsUI
            );
            console.log(" initializeApp: UI reset complete.");

            // --- Setup Event Listeners ---
            console.log(" initializeApp: Setting up event listeners...");
            setupEventListeners();
            console.log(" initializeApp: Event listeners setup complete.");

            // --- Final Initial UI State ---
            updateHistoryButtonsUI();
            showMessage("Load an image to begin.", false, elements.messageBox);
            console.log("[MainApp] initializeApp - END");

        } catch (error) {
             console.error("***** CRITICAL ERROR DURING INITIALIZEAPP *****", error);
             showMessage("Initialization failed critically. Check console.", true, elements.messageBox || null);
        }
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
