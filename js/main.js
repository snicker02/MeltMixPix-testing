// js/main.js (Refactored to use stateManager.js)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState as resetUIState, // Renamed resetState to avoid conflict
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// <<< REMOVE historyUtils import >>>
// import { updateUndoRedoButtons, clearHistory, pushHistoryState, undo as historyUndo, redo as historyRedo } from './utils/historyUtils.js';

// <<< ADD stateManager import >>>
import * as stateManager from './stateManager.js';

// --- Effect Imports --- (Keep these)
import { applyNoise } from './effects/noise.js';
// ... other effect imports ...
import { applySierpinski } from './effects/sierpinski.js';


// --- Global Scope ---
let elements = {}; // Holds references to DOM elements
// <<< REMOVE state object definition >>>
// let state = {};

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
    console.log('[MainApp] redrawSourceCanvasWithEffect (STACKING) - START');
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
        } catch (e) { /* ... error handling ... */ return false; }
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
        } catch (e) { /* ... error handling ... */ return false; }
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
        } catch (e) { /* ... error handling ... */ return false; }
    } else {
        // console.log(" redrawSourceCanvasWithEffect: No effect selected ('none'). Canvas shows previous state.");
    }
    // console.log('[MainApp] redrawSourceCanvasWithEffect (STACKING) - END - Success');
    return true;
}


/**
 * Requests a full update of the final preview canvas. (Includes Pan/Zoom Fix)
 * Uses stateManager for checks and data retrieval.
 */
function requestFullUpdate() {
    console.log('[MainApp] requestFullUpdate called.');

    // Use state manager for checks
    const historyInfo = stateManager.getHistoryInfo();
    const check1 = !stateManager.getCurrentImage() && historyInfo.length === 0;
    const check2 = !elements.sourceEffectCanvas;
    const check3 = !sourceEffectCtx; // Use local context variable
    const isProcessing = stateManager.isProcessing();
    console.log(` requestFullUpdate PRE-CHECKS: NoImage&History=${check1}, NoCanvas=${check2}, NoCtx=${check3}, IsProcessing=${isProcessing}`);


    if (check1 || check2 || check3) {
        console.warn(" requestFullUpdate skipped (OUTSIDE setTimeout): Prerequisites failed.");
        return;
    }
    if (isProcessing) {
        console.warn(" requestFullUpdate skipped (OUTSIDE setTimeout): Already processing.");
        return;
    }

    // Use a property on the stateManager? Or keep timer local to main.js? Local is fine.
    let debounceTimer = stateManager.getState().debounceTimer; // Get timer state if stored in stateManager
    if (!debounceTimer) debounceTimer = null; // Ensure it's null if undefined

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
        console.log('[MainApp] Debounce timer finished. Initiating full update.');

        // Re-check prerequisites using state manager inside timeout
        const inHistoryInfo = stateManager.getHistoryInfo();
        const inCheck1 = !stateManager.getCurrentImage() && inHistoryInfo.length === 0;
        const inCheck2 = !elements.sourceEffectCanvas;
        const inCheck3 = !sourceEffectCtx;
        const inIsProcessing = stateManager.isProcessing(); // Re-check processing status
         console.log(` requestFullUpdate INSIDE TIMEOUT PRE-CHECKS: NoImage&History=${inCheck1}, NoCanvas=${inCheck2}, NoCtx=${inCheck3}, IsProcessing=${inIsProcessing}`);


        if (inCheck1 || inIsProcessing || inCheck2 || inCheck3) {
            console.warn(" requestFullUpdate: Full update skipped inside timeout: Prerequisites failed or already processing.");
             /* ... logging reasons ... */
            return;
        }

        console.log(' requestFullUpdate: Prerequisites met for full update processing.');
        stateManager.setProcessing(true); // Set processing flag via manager
        console.log(' requestFullUpdate: Set isProcessing = true');


        const canvas = elements.sourceEffectCanvas;
        const ctx = sourceEffectCtx; // Use local context
        const { width: targetWidth, height: targetHeight } = stateManager.getOriginalDimensions(); // Get dimensions


        if (!targetWidth || !targetHeight) {
             console.error(" requestFullUpdate: Invalid target dimensions (originalWidth/Height not set).");
             stateManager.setProcessing(false); // Reset flag via manager
             console.log(' requestFullUpdate: Reset isProcessing = false due to invalid dimensions.');
             return;
        }

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
           canvas.width = targetWidth;
           canvas.height = targetHeight;
           console.log(` requestFullUpdate: Set sourceEffectCanvas size to ${canvas.width}x${canvas.height}`);
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
            } else {
                 console.warn(' requestFullUpdate: Skipping drawImage - calculated source dimensions are invalid (<= 0).');
                 showMessage("Error: Invalid zoom or source dimensions.", true, elements.messageBox);
            }

            console.log(' requestFullUpdate: >>> Preparing to call processAndPreviewImage <<<');
            // Pass necessary state info to processAndPreviewImage if it needs it
            // For now, assume it only needs the prepared canvas and elements
            processAndPreviewImage(
                canvas,     // The prepared canvas (panned/zoomed subsection with effects)
                elements,
                stateManager.getState(), // Pass snapshot of current state if needed by tiling logic
                (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
            );
             console.log(' requestFullUpdate: <<< processAndPreviewImage call finished >>>');

        } catch (err) {
             console.error(" requestFullUpdate: Error during image processing:", err);
             showMessage(`Error updating preview: ${err.message}`, true, elements.messageBox);
        } finally {
            stateManager.setProcessing(false); // Reset processing flag via manager
            console.log(' requestFullUpdate: Reset isProcessing = false in finally block.');
             console.log('[MainApp] Finished full update processing.');
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
    if (elements.undoButton) elements.undoButton.disabled = historyInfo.index <= 0;
    if (elements.redoButton) elements.redoButton.disabled = historyInfo.index >= historyInfo.length - 1;
}


/**
 * Handles the click event for the "Apply Pre-Effect" button. (STACKING Version)
 * Uses stateManager for history operations.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] handleApplyEffectClick - START');
    // Use state manager for checks
    const historyInfo = stateManager.getHistoryInfo();
    if (!stateManager.getCurrentImage() && historyInfo.length === 0) {
        console.warn(' handleApplyEffectClick: Apply skipped: No image loaded or history base.');
        showMessage("Load an image first.", true, elements.messageBox);
        return;
    }
     if (!elements.sourceEffectCanvas || !sourceEffectCtx) { /* ... error handling ... */ return; }
    if (stateManager.isProcessing()) { /* ... error handling ... */ return; }

    const { effect, params } = getCurrentEffectAndParams();
    console.log(` handleApplyEffectClick: Effect to apply: '${effect}'`);

    console.log(` handleApplyEffectClick: Calling redrawSourceCanvasWithEffect to apply '${effect}' (stacking)...`);
    if (!redrawSourceCanvasWithEffect()) {
         console.error(` handleApplyEffectClick: redrawSourceCanvasWithEffect FAILED for effect '${effect}'.`);
         showMessage("Could not apply effect due to processing error.", true, elements.messageBox);
         return;
    }

    try {
        console.log(" handleApplyEffectClick: Attempting to get ImageData after applying effect...");
        const imageDataToSave = sourceEffectCtx.getImageData(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height);
        console.log(" handleApplyEffectClick: Got ImageData. Attempting stateManager.pushHistoryState...");
        stateManager.pushHistoryState(imageDataToSave); // Use state manager
        updateHistoryButtonsUI(); // Update buttons after history changes
        console.log(" handleApplyEffectClick: pushHistoryState completed.");
        showMessage(`Effect "${effect || 'None'}" applied (stacked) and saved to history.`, false, elements.messageBox);

        console.log(" handleApplyEffectClick: Requesting full update after apply.");
        requestFullUpdate();

    } catch (e) { /* ... error handling ... */ }
    console.log('[MainApp] handleApplyEffectClick - END');
}

/**
 * Handles the Undo button click. Uses stateManager.
 */
function handleUndoClick() {
    console.log('[MainApp] handleUndoClick - START');
    if (!sourceEffectCtx) { /* ... error handling ... */ return; }
    const historyInfo = stateManager.getHistoryInfo(); // Check state before attempting
    if (historyInfo.index <= 0) { console.log(' handleUndoClick: Undo skipped: Already at oldest state.'); return; }

    const previousImageData = stateManager.undoState(); // Use state manager

    if (previousImageData) {
         // Put the undone state onto the canvas
         try {
             if (elements.sourceEffectCanvas.width !== previousImageData.width || elements.sourceEffectCanvas.height !== previousImageData.height) {
                 elements.sourceEffectCanvas.width = previousImageData.width;
                 elements.sourceEffectCanvas.height = previousImageData.height;
             }
             sourceEffectCtx.putImageData(previousImageData, 0, 0);
             updateHistoryButtonsUI(); // Update buttons
             console.log(' handleUndoClick: Requesting full update after undo.');
             requestFullUpdate(); // Update preview to reflect undone state
             showMessage("Undo successful.", false, elements.messageBox);
         } catch(e) {
            console.error(" handleUndoClick: Error putting undone state on canvas:", e);
            showMessage("Error applying undo.", true, elements.messageBox);
            // Consider how to handle state if putImageData fails
         }
    }
    console.log('[MainApp] handleUndoClick - END');
}

/**
 * Handles the Redo button click. Uses stateManager.
 */
function handleRedoClick() {
    console.log('[MainApp] handleRedoClick - START');
     if (!sourceEffectCtx) { /* ... error handling ... */ return; }
      const historyInfo = stateManager.getHistoryInfo(); // Check state before attempting
     if (historyInfo.index >= historyInfo.length - 1) { console.log(' handleRedoClick: Redo skipped: Already at newest state.'); return; }

    const nextImageData = stateManager.redoState(); // Use state manager

     if (nextImageData) {
         // Put the redone state onto the canvas
         try {
             if (elements.sourceEffectCanvas.width !== nextImageData.width || elements.sourceEffectCanvas.height !== nextImageData.height) {
                 elements.sourceEffectCanvas.width = nextImageData.width;
                 elements.sourceEffectCanvas.height = nextImageData.height;
             }
             sourceEffectCtx.putImageData(nextImageData, 0, 0);
             updateHistoryButtonsUI(); // Update buttons
             console.log(' handleRedoClick: Requesting full update after redo.');
             requestFullUpdate(); // Update preview to reflect redone state
             showMessage("Redo successful.", false, elements.messageBox);
        } catch(e) {
            console.error(" handleRedoClick: Error putting redone state on canvas:", e);
            showMessage("Error applying redo.", true, elements.messageBox);
        }
    }
    console.log('[MainApp] handleRedoClick - END');
}

/**
 * Gets the currently selected effect name and its parameters from the UI controls.
 * (No changes needed here as it only reads UI elements)
 */
function getCurrentEffectAndParams() { /* ... same as before ... */ }

/**
 * Handles changes for TILING sliders. Calls requestFullUpdate.
 * (No changes needed here)
 */
function handleSliderChange() { /* ... same as before, calls requestFullUpdate ... */ }

/**
 * Handles changes for radio buttons and select dropdowns. Calls relevant UI updates and requestFullUpdate.
 * (No changes needed here)
 */
function handleOptionChange(event) { /* ... same as before ... */ }


/**
 * Handles the loading of a new image file. Uses stateManager.
 */
function handleImageLoad(event) {
    console.log("[MainApp] handleImageLoad - START");
    try {
        if (!elements.messageBox || !elements.sourceEffectCanvas || !elements.imageLoader || !sourceEffectCtx) { // Added sourceEffectCtx check
             console.error(" handleImageLoad: Cannot run - prerequisites missing.");
             if(elements.imageLoader) elements.imageLoader.value = '';
             return;
        }
        console.log(" handleImageLoad: Prerequisites met.");

        // Modified reset function to use stateManager.clearHistoryState
        const resetApp = () => {
            console.log(" handleImageLoad: Calling resetApp (UI reset + state reset).");
            // Reset UI via uiUtils function
            resetUIState(elements, {}, // Pass empty object for state to resetUIState, it doesn't use it directly anymore
                () => updateTilingControlsVisibility(elements, handleSliderChange),
                () => updatePreEffectControlsVisibility(elements),
                handleSliderChange,
                () => { // Pass the history clearing part separately
                    stateManager.clearHistoryState();
                    updateHistoryButtonsUI(); // Update buttons after clearing
                }
            );
            // Reset state data via stateManager
            stateManager.resetStateData();
             if (elements.messageBox) showMessage("Ready to load a new image.", false, elements.messageBox);
             if(elements.imageLoader) elements.imageLoader.value = '';
            console.log(" handleImageLoad: resetApp finished.");
        };

        const file = event.target.files?.[0];
        if (!file) { console.log(" handleImageLoad: No file selected."); return; }
        console.log(` handleImageLoad: File selected: ${file.name}, Type: ${file.type}`);
        if (!file.type.startsWith('image/')) {
            console.warn(" handleImageLoad: Invalid file type selected:", file.type);
            showMessage("Invalid file type. Please select an image (PNG, JPG, GIF).", true, elements.messageBox);
            resetApp(); // Use combined reset function
            return;
        }

        showMessage("Loading image...", false, elements.messageBox);
        // Keep originalFileName locally or pass it to setImageData? Pass it.
        const originalFileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
             if (!e.target?.result) { /* ... error handling ... */ resetApp(); return; }
            const img = new Image();
            img.onload = () => {
                 console.log(" handleImageLoad: img.onload - START");
                 if (!img.naturalWidth || !img.naturalHeight) { /* ... error handling ... */ resetApp(); return; }

                 // --- Update State using stateManager ---
                 stateManager.setImageData(img, originalFileName); // This sets image, dimensions, resets pan/zoom etc.
                 stateManager.clearHistoryState(); // Explicitly clear history for new image

                 // --- Update UI Elements ---
                 if(elements.outputWidthInput) elements.outputWidthInput.value = img.naturalWidth; // Use dimensions directly
                 if(elements.outputHeightInput) elements.outputHeightInput.value = img.naturalHeight;
                 if(elements.sourcePreview) {
                     elements.sourcePreview.src = e.target.result; // Use data URL for preview
                     elements.sourcePreview.classList.remove('hidden');
                 }
                 if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
                 if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
                 if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
                 if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

                 requestAnimationFrame(() => {
                    console.log(" handleImageLoad: requestAnimationFrame - START");
                    if (!sourceEffectCtx) { /* ... error handling ... */ resetApp(); return; }

                    // Update visual transform for the source preview image using new state
                    const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState()); // Pass state snapshot
                    stateManager.setCurrentOffsets(clampedX, clampedY); // Update state with clamped values

                    // Initialize sourceEffectCanvas size using stateManager
                    const {width: initialWidth, height: initialHeight} = stateManager.getOriginalDimensions();
                    elements.sourceEffectCanvas.width = initialWidth;
                    elements.sourceEffectCanvas.height = initialHeight;

                    console.log(" handleImageLoad: requestAnimationFrame - Calling initial redrawSourceCanvasWithEffect...");
                    if (redrawSourceCanvasWithEffect()) { // Uses stateManager internally
                        console.log(" handleImageLoad: requestAnimationFrame - Initial redraw SUCCESS.");
                        try {
                             // Push the initial state (drawn by redrawSourceCanvasWithEffect) to history
                             const initialImageData = sourceEffectCtx.getImageData(0, 0, initialWidth, initialHeight);
                             stateManager.pushHistoryState(initialImageData); // Add base state to history
                             updateHistoryButtonsUI(); // Update buttons
                             console.log("  -> History initialized with base state.");
                        } catch(histError) { /* ... error handling ... */ resetApp(); return; }
                    } else { /* ... error handling ... */ resetApp(); return; }

                    console.log(" handleImageLoad: requestAnimationFrame - Enabling UI controls...");
                    // Enable controls (UI part)
                    if(elements.saveButton) elements.saveButton.disabled = false;
                    if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                    elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                    elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                    elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                    elements.selects?.forEach(s => { if(s) s.disabled = false; });
                    if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                    if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                    if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;

                    console.log(" handleImageLoad: requestAnimationFrame - Updating control visibility...");
                    updateTilingControlsVisibility(elements, handleSliderChange);
                    updatePreEffectControlsVisibility(elements);
                    console.log(" handleImageLoad: requestAnimationFrame - Requesting initial full update...");
                    requestFullUpdate();
                    showMessage('Image loaded. Adjust effect/tiling controls.', false, elements.messageBox);
                    console.log(" handleImageLoad: requestAnimationFrame - END");
                });
                console.log(" handleImageLoad: img.onload - END");
            };
            img.onerror = () => { /* ... error handling ... */ resetApp(); };
            img.src = e.target.result;
        };
        reader.onerror = () => { /* ... error handling ... */ resetApp(); };
        reader.readAsDataURL(file);

    } catch (error) { /* ... error handling ... */ }
    console.log("[MainApp] handleImageLoad - END");
}


/**
 * Handles saving the final processed image. Uses stateManager.
 */
function saveImage() {
    console.log("[MainApp] saveImage called.");
    // Use state manager for checks
     if (!elements.canvas || (!stateManager.getCurrentImage() && stateManager.getHistoryInfo().length === 0)) {
        console.warn(" saveImage: Save cancelled: Canvas not ready or no image/history.");
        showMessage("Cannot save: No image processed yet.", true, elements.messageBox);
        return;
    }
     if (stateManager.isProcessing()) { /* ... error handling ... */ return; }

    try {
        const finalCanvas = elements.canvas;
        const outputWidth = parseInt(elements.outputWidthInput?.value, 10) || finalCanvas.width;
        const outputHeight = parseInt(elements.outputHeightInput?.value, 10) || finalCanvas.height;

        if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) { /* ... error handling ... */ return; }

        let canvasToSave = finalCanvas;
        if (outputWidth !== finalCanvas.width || outputHeight !== finalCanvas.height) {
            // ... (resizing logic remains the same) ...
        }

        const dataURL = canvasToSave.toDataURL('image/png');
        const link = document.createElement('a');
        // Use state manager for filename
        const baseName = stateManager.getOriginalFileName().replace(/\.[^/.]+$/, "");
        link.download = `${baseName}_MeltMixPix.png`;
        link.href = dataURL;
        link.click();
        showMessage("Image saved successfully!", false, elements.messageBox);

    } catch (error) { /* ... error handling ... */ }
}

// --- Event Listeners Setup ---
// Needs modification to pass stateManager or use its functions in handlers like startPan, panMove, handleDimensionChange, handleSourceZoom
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners - START");
    if (!elements.imageLoader) { /* ... error handling ... */ return; }

    // Image Load / Save / History
    elements.imageLoader.addEventListener('change', handleImageLoad); // Handler uses stateManager internally now
    elements.saveButton?.addEventListener('click', saveImage); // Handler uses stateManager internally now
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick); // Handler uses stateManager internally now
    elements.undoButton?.addEventListener('click', handleUndoClick); // Handler uses stateManager internally now
    elements.redoButton?.addEventListener('click', handleRedoClick); // Handler uses stateManager internally now

    // Options change
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const effectSelects = [ /* ... */ ]; // As before
    effectSelects.forEach(select => { if(select) select.addEventListener('change', handleOptionChange); });
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);

    // Sliders
    const tilingSliders = [ /* ... */ ]; // As before
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); }); // handleSliderChange calls requestFullUpdate which uses stateManager
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°');
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate);


    // Source Zoom - Modify callback to use stateManager
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => { // Callback function
                 console.log(' setupEventListeners: Zoom slider callback.');
                 // Update state via stateManager
                 stateManager.setZoomLevel(parseFloat(elements.sourceZoomSlider.value));
                 // Update UI preview transform (needs state)
                 const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
                 stateManager.setCurrentOffsets(clampedX, clampedY); // Update state with clamped values
                 // Request final preview update
                 requestFullUpdate();
             },
             val => parseFloat(val).toFixed(1) // Formatter for display
         );
    }

    // Output Dimensions - Modify handler to use stateManager if needed
    // handleDimensionChange needs stateManager.getOriginalAspectRatio()
    const dimensionChangeHandler = (e) => {
        const changedInput = e.target;
        if (!stateManager.getCurrentImage() || !elements.keepAspectRatioCheckbox?.checked) return;

        const newValue = parseInt(changedInput.value, 10);
        if (isNaN(newValue) || newValue <= 0) return;

        const aspectRatio = stateManager.getOriginalAspectRatio();
        if (!aspectRatio) return;

        if (changedInput === elements.outputWidthInput && elements.outputHeightInput) {
            elements.outputHeightInput.value = Math.round(newValue / aspectRatio);
        } else if (changedInput === elements.outputHeightInput && elements.outputWidthInput) {
            elements.outputWidthInput.value = Math.round(newValue * aspectRatio);
        }
    };
    elements.outputWidthInput?.addEventListener('input', dimensionChangeHandler);
    elements.outputHeightInput?.addEventListener('input', dimensionChangeHandler);
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => {
        if (elements.keepAspectRatioCheckbox?.checked && stateManager.getCurrentImage() && elements.outputWidthInput) {
             dimensionChangeHandler({ target: elements.outputWidthInput });
        }
    });


    // Panning Listeners - Modify handlers to use stateManager
    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => {
             if (!stateManager.getCurrentImage() || e.button !== 0) return;
             if (e.target === elements?.sourcePreview) { e.preventDefault(); }
             stateManager.setDragging(true, e.pageX, e.pageY); // Use manager to set start state
             if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grabbing'; }
         });

         document.addEventListener('mousemove', (e) => {
             if (!stateManager.isDragging()) return; // Use manager to check dragging state
             const panState = stateManager.getPanState();
             const dx = e.pageX - panState.dragStartX;
             const dy = e.pageY - panState.dragStartY;
             const newOffsetX = panState.startOffsetX + dx;
             const newOffsetY = panState.startOffsetY + dy;
             stateManager.updatePanOffsets(newOffsetX, newOffsetY); // Update state via manager

             // Update UI preview transform (needs current state)
             const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState());
             // Update state again with clamped values IF they differ
             if (newOffsetX !== clampedX || newOffsetY !== clampedY) {
                 stateManager.setCurrentOffsets(clampedX, clampedY);
             }
         });

         const endPanHandler = () => {
             if (stateManager.isDragging()) { // Use manager
                 console.log(' setupEventListeners: Pan ended via endPanHandler.');
                 stateManager.setDragging(false); // Use manager to stop dragging
                 if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grab'; }
                 requestFullUpdate(); // Trigger final update
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
     // (Same as before)
      elements = { /* ... all element assignments ... */ };
      console.log(" initializeApp: Elements object populated.");

      // Populate grouped sliders/selects arrays
     elements.sliders = [ /* ... */ ].filter(el => el !== null);
     elements.selects = [ /* ... */ ].filter(el => el !== null);
    //  console.log(` initializeApp: Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);


     // --- Get initial context (needed before state reset potentially) ---
     // Store context locally in main.js, not in stateManager
     sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
     if (!sourceEffectCtx) {
         console.error(" initializeApp: CRITICAL - Failed to get context for sourceEffectCanvas! Cannot proceed.");
         if (elements.messageBox) showMessage("Initialization Error: Cannot get canvas context. Please refresh.", true, elements.messageBox);
         return;
     }
     console.log(" initializeApp: sourceEffectCtx obtained.");


     // --- Call resetStateData and resetUIState ---
     stateManager.resetStateData(); // Reset the managed state
     console.log(" initializeApp: stateManager data reset.");

     // Reset the UI elements (passing necessary callbacks)
      resetUIState(elements, {}, // Pass empty object for state, no longer directly needed by resetUIState
         () => updateTilingControlsVisibility(elements, handleSliderChange),
         () => updatePreEffectControlsVisibility(elements),
         handleSliderChange,
         () => {
             // History clearing is handled by stateManager.resetStateData, but update buttons here
             updateHistoryButtonsUI();
         }
     );
     console.log(" initializeApp: UI reset complete.");


     // --- Setup Event Listeners ---
     setupEventListeners(); // Uses stateManager internally now

     // --- Final Initial UI State ---
     updateHistoryButtonsUI(); // Ensure buttons reflect initial empty history
     console.log(" initializeApp: Image Tiler Initialized and ready.");
     showMessage("Load an image to begin.", false, elements.messageBox);
     console.log("[MainApp] initializeApp - END");
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
