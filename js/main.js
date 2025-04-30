// js/main.js (Moved elements initialization inside initializeApp)

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
 * Redraws the sourceEffectCanvas.
 * 1. Clears the canvas.
 * 2. Draws the panned/zoomed portion of the original state.currentImage.
 * 3. Applies the *currently selected* pre-effect (from UI controls) on top.
 * This is used for live preview updates and *before* saving to history on Apply.
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

    // Ensure canvas dimensions match original image dimensions
    if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
        canvas.width = state.originalWidth;
        canvas.height = state.originalHeight;
         console.log(`[MainApp] Resized sourceEffectCanvas to ${canvas.width}x${canvas.height}`);
    }
     if (canvas.width === 0 || canvas.height === 0) {
        console.error("redrawSourceCanvasWithEffect: Canvas dimensions are zero.");
        return false;
    }

    // Clear and draw the base (panned/zoomed) image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        // Draw the portion of the *original* image defined by pan/zoom
        ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
    } catch (e) {
        console.error("redrawSourceCanvasWithEffect: Error drawing source image:", e);
        showMessage("Error drawing source region.", true, elements.messageBox);
        return false;
     }

    // Get the ImageData *after* drawing the base panned/zoomed image
    const baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Get the currently selected effect and its parameters
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    // Apply the selected effect *on top* of the base image data
    if (effectFunction) {
        console.log(`  Applying effect: ${effect} with params:`, params);
        try {
            // Get the current data (which is the panned/zoomed image)
            const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Some effects need the *original* base image data to sample from (e.g., wave distortion)
            const effectContext = { sourceImageData: baseImageData };
            // Apply the effect to the currentImageData
            effectFunction(currentImageData, params, effectContext);
            // Put the modified data back onto the canvas
            ctx.putImageData(currentImageData, 0, 0);
            console.log(`  Effect ${effect} applied for preview/apply.`);
        } catch (e) {
             console.error(`redrawSourceCanvasWithEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             return false; // Indicate failure
        }
    } else {
        console.log("  No effect selected ('none'). Canvas shows panned/zoomed original.");
    }
    return true; // Indicate success
}

/**
 * Requests a full update of the final preview canvas.
 * Debounced to prevent excessive updates.
 * Ensures the sourceEffectCanvas reflects the LAST APPLIED state from history
 * before generating the final tiled preview.
 */
function requestFullUpdate() {
    console.log('[MainApp] requestFullUpdate called.');
    // Add checks for elements/state
    if (!elements.sourceEffectCanvas || !state.currentImage) {
        console.warn("[MainApp] requestFullUpdate skipped: elements or state not ready.");
        return;
    }
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        console.log('[MainApp] Debounce timer finished. Initiating full update.');
        // Ensure prerequisites are met
        if (state.currentImage && !state.isProcessing && elements.sourceEffectCanvas && state.sourceEffectCtx) {
             console.log('[MainApp] Prerequisites met for full update.');

             // --- FIX Integration ---
             // Always restore the last applied state from history onto the sourceEffectCanvas
             // before generating the final tiled preview. This ensures changing the effect selector
             // doesn't clear the *applied* effect from the final preview.
             const currentStateFromHistory = state.history[state.historyIndex];
             if (currentStateFromHistory) {
                 try {
                     console.log('[MainApp] Restoring history state to sourceEffectCanvas before tiling.');
                     // Make sure canvas size matches history state size
                     if (elements.sourceEffectCanvas.width !== currentStateFromHistory.width || elements.sourceEffectCanvas.height !== currentStateFromHistory.height) {
                         elements.sourceEffectCanvas.width = currentStateFromHistory.width;
                         elements.sourceEffectCanvas.height = currentStateFromHistory.height;
                         console.log(`[MainApp] Resized sourceEffectCanvas to match history state ${currentStateFromHistory.width}x${currentStateFromHistory.height}`);
                     }
                     state.sourceEffectCtx.putImageData(currentStateFromHistory, 0, 0);
                 } catch (e) {
                     console.error("[MainApp] Error putting history ImageData onto sourceEffectCanvas:", e);
                     showMessage("Error restoring effect state for preview.", true, elements.messageBox);
                     // state.isProcessing should be false here, but ensure it is
                     state.isProcessing = false;
                     return; // Stop if we cannot restore the state
                 }
             } else {
                 // This case should ideally only happen right after image load, before the first apply.
                 // In this situation, the canvas *should* already contain the initial panned/zoomed
                 // state from handleImageLoad calling redrawSourceCanvasWithEffect.
                 // If history is empty AFTER an apply/undo, something is wrong.
                 console.log('[MainApp] No history state found (or index invalid). Using current canvas state for tiling.');
                 // We might need an explicit redraw here if the canvas could be blank/invalid.
                 // Let's try without first. If issues arise on first load/undo to start, add:
                 // if (!redrawSourceCanvasWithEffect()) { /* error handling */ return; }
             }

             // *** IMPORTANT: DO NOT call redrawSourceCanvasWithEffect() here. ***
             // That function applies the *currently selected* effect, which would overwrite
             // the historical state we just restored.

             // Process the image for tiling using the sourceEffectCanvas,
             // which now correctly holds the last *applied* state.
             console.log('[MainApp] Calling processAndPreviewImage with restored/current canvas state.');
             processAndPreviewImage(
                 elements.sourceEffectCanvas, // This canvas now has the intended state
                 elements,
                 state,
                 (msg, isErr) => showMessage(msg, isErr, elements.messageBox) // Pass message function
             );
             // --- End FIX Integration ---

        } else {
             // Log why the update was skipped more clearly
             console.warn("[MainApp] Full update skipped inside timeout: Missing prerequisites.");
             if(!state.currentImage) console.log(" Skipped reason: No current image.");
             else if(state.isProcessing) console.log(" Skipped reason: Already processing.");
             else if(!elements.sourceEffectCanvas) console.log(" Skipped reason: sourceEffectCanvas missing.");
             else if(!state.sourceEffectCtx) console.log(" Skipped reason: sourceEffectCtx missing.");
             else console.log(" Skipped reason: Unknown state issue.");
        }
    }, 150); // Debounce time
}


// --- Event Handlers ---

/**
 * Handles the click event for the "Apply Pre-Effect" button.
 * Redraws the source canvas with the currently selected effect and parameters,
 * then pushes the resulting ImageData onto the history stack.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] Apply Pre-Effect button clicked.');
     // Add checks for necessary state and elements
    if (!state.currentImage || !elements.sourceEffectCanvas || !state.sourceEffectCtx || state.isProcessing) {
        console.warn('[MainApp] Apply skipped: Prerequisites not met.');
        showMessage("Cannot apply effect now (no image, canvas issue, or already processing).", true, elements.messageBox);
        return;
    }
    const { effect, params } = getCurrentEffectAndParams(); // Get selected effect

    // *** CRITICAL Step 1: Redraw the canvas WITH the selected effect applied ***
    // This prepares the canvas visually with the effect we want to save.
    console.log(`[MainApp] Applying effect '${effect}' to canvas before saving to history.`);
    if (!redrawSourceCanvasWithEffect()) {
         // redrawSourceCanvasWithEffect handles showing error messages internally
         showMessage("Could not prepare effect for saving due to processing error.", true, elements.messageBox);
         return; // Stop if redrawing failed
    }

    // *** Step 2: Save the RESULTING state of the canvas to history ***
    try {
        // Get the ImageData from the canvas *after* the effect was drawn onto it
        const imageDataToSave = state.sourceEffectCtx.getImageData(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height);
        // Push this state onto the history stack
        pushHistoryState(imageDataToSave, state, updateUndoRedoButtons, elements);
        showMessage(`Effect "${effect || 'None'}" applied and saved to history.`, false, elements.messageBox);

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
    // requestFullUpdate will use the state just placed on the canvas by historyUndo.
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
    console.log(`[MainApp] getCurrentEffectAndParams - Effect: ${effect}, Params:`, params);
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

    // Check if it's a tiling or mirroring option
    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        // Update tiling control visibility if shape changed
        if(target.name === 'tileShape' && elements.tilesXSlider) { // Check elements exist
            updateTilingControlsVisibility(elements, handleSliderChange); // handleSliderChange also calls requestFullUpdate
        } else {
            needsFullUpdate = true; // Mirroring change just needs update
        }
    }
    // Check if it's the main effect selector or any control within the effect options container
    else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
         // If the main selector changed, update the visibility of specific effect options
         if(target.id === 'preEffectSelector' && elements.preEffectSelector) { // Check element exists
            updatePreEffectControlsVisibility(elements);
         }
         // Changing any effect parameter (select dropdowns like direction, type) should trigger update
         needsFullUpdate = true;
    } else {
        console.log("[MainApp] Unhandled option change target:", target);
    }

    // If an update is needed (and wasn't already triggered by updateTilingControlsVisibility->handleSliderChange)
    if (needsFullUpdate) {
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
         // Attempt to show message if messageBox exists
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
         // Ensure message box is available after reset (if it exists)
         if (elements.messageBox) showMessage("Ready to load a new image.", false, elements.messageBox);
    };

    const file = event.target.files?.[0];

    // Reset state if no file selected or invalid file type
    if (!file) { console.log("[MainApp] No file selected."); resetFunc(); return; }
    if (!file.type.startsWith('image/')) {
        console.warn("[MainApp] Invalid file type selected:", file.type);
        showMessage("Invalid file type. Please select an image (PNG, JPG, GIF).", true, elements.messageBox);
        resetFunc(); // Reset UI even on error
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

                // Draw the initial panned/zoomed state onto the sourceEffectCanvas (no effect initially)
                if (redrawSourceCanvasWithEffect()) { // This draws the base image (effect='none' initially)
                    try {
                         // Get the initial image data (just panned/zoomed original)
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
     if (!elements.canvas || !state.currentImage) {
        console.warn("[MainApp] Save cancelled: Canvas or image not ready.");
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
        const outputWidth = parseInt(elements.outputWidthInput?.value || finalCanvas.width, 10);
        const outputHeight = parseInt(elements.outputHeightInput?.value || finalCanvas.height, 10);

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
        link.download = state.originalFileName.replace(/(\.[\w\d_-]+)$/i, '_tiled$1') || 'tiled-image.png'; // Add suffix
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
                // Optionally trigger preview update during drag (can be slow)
                // requestFullUpdate();
             }
         });
         const endPanHandler = () => {
             if (state.isDragging) {
                 console.log('[MainApp] Pan ended.');
                 // Call endPan which sets isDragging = false
                 // Pass requestFullUpdate as the callback to update the final preview after panning stops
                 endPan(elements, state, requestFullUpdate);
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
         mirrorCanvas: document.getElementById('mirrorCanvas'),         // Used in tiling/core
         preTileCanvas: document.getElementById('preTileCanvas'),       // Used in tiling/core
         canvas: document.getElementById('imageCanvas'),             // Final output canvas (used for saving, updated by tiling/core)
         sourceEffectCanvas: document.getElementById('sourceEffectCanvas'), // Main working canvas for effects & history

         // History Buttons
         applyEffectButton: document.getElementById('applyEffectButton'),
         undoButton: document.getElementById('undoButton'),
         redoButton: document.getElementById('redoButton'),

         // Source Zoom
         sourceZoomSlider: document.getElementById('sourceZoom'),
         sourceZoomValueSpan: document.getElementById('sourceZoomValue'), // Corrected ID based on common pattern

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
          // Attempt to show message if messageBox was found during population
         if (elements.messageBox) showMessage("Initialization Error: Cannot get canvas context. Please refresh.", true, elements.messageBox);
         return; // Stop initialization
     }

     state = {
         currentImage: null,          // Holds the original loaded Image object
         originalImageData: null,     // Holds the initial ImageData after load (base for history)
         originalFileName: 'downloaded-image.png',
         originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,

         // Status flags
         isProcessing: false,         // Flag to prevent concurrent processing
         isDragging: false,           // Flag for panning state

         // Timers
         debounceTimer: null,         // Timer for debouncing updates

         // Panning state
         dragStartX: 0, dragStartY: 0,
         currentOffsetX: 0, currentOffsetY: 0, // Current translation of the source preview
         startOffsetX: 0, startOffsetY: 0,   // Offset at the start of a drag

         // Zoom state
         sourceZoomLevel: 1.0,        // Zoom level of the source preview

         // Canvas contexts
         sourceEffectCtx: initialSourceEffectCtx, // Primary context for applying effects and history ( MANDATORY )
         // The 'ctx' property used by historyUtils needs to point to the canvas where history states are applied/restored
         ctx: initialSourceEffectCtx, // Make state.ctx explicitly point to the main working context

         // History
         history: [],                 // Array to store ImageData states
         historyIndex: -1             // Index of the current state in the history array
     };
     console.log("[MainApp] State object initialized.");


     // --- Call resetState to set initial UI state (disabled controls, default values) ---
     // Define the callbacks needed by resetState
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange, // Ensures slider display values match defaults
         clearHistory: () => clearHistory(state, updateUndoRedoButtons, elements) // Pass the history clearing function
     };
     // Perform the initial reset
     resetState(
         elements, state,
         resetCallbacks.updateTiling, resetCallbacks.updateEffects,
         resetCallbacks.updateSliders, resetCallbacks.clearHistory
     );
     console.log("[MainApp] Initial resetState complete.");


     // --- Setup Event Listeners ---
     setupEventListeners();

     // --- Final Initial UI State ---
     updateUndoRedoButtons(elements, state); // Ensure undo/redo are initially disabled
     console.log("[MainApp] Image Tiler Initialized and ready.");
     showMessage("Load an image to begin.", false, elements.messageBox);
}

// --- Start the application ---
// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', initializeApp);
