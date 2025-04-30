// js/main.js (Apply Button Workflow)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// --- NEW: History Imports ---
import { updateUndoRedoButtons, clearHistory, pushHistoryState, undo, redo } from './utils/historyUtils.js';


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


// --- DOM Element References ---
const elements = {
    // Tiler Elements...
    imageLoader: document.getElementById('imageLoader'),
    sourcePreviewContainer: document.getElementById('sourcePreviewContainer'),
    sourcePreview: document.getElementById('sourcePreview'),
    sourcePreviewText: document.getElementById('sourcePreviewText'),
    finalPreviewContainer: document.getElementById('finalPreviewContainer'),
    finalPreview: document.getElementById('finalPreview'),
    finalPreviewText: document.getElementById('finalPreviewText'),
    mirrorCanvas: document.getElementById('mirrorCanvas'),
    preTileCanvas: document.getElementById('preTileCanvas'),
    canvas: document.getElementById('imageCanvas'), // Final tiling output canvas
    sourceEffectCanvas: document.getElementById('sourceEffectCanvas'), // Canvas for applying single *preview* effect
    saveButton: document.getElementById('saveButton'),
    messageBox: document.getElementById('messageBox'),
    tileShapeOptions: document.querySelectorAll('input[name="tileShape"]'),
    mirrorOptions: document.querySelectorAll('input[name="mirrorOption"]'),
    tilesXSlider: document.getElementById('tilesX'), tilesYSlider: document.getElementById('tilesY'),
    skewSlider: document.getElementById('skewFactor'), staggerSlider: document.getElementById('staggerOffset'),
    scaleSlider: document.getElementById('tileScale'), preTileXSlider: document.getElementById('preTileX'),
    preTileYSlider: document.getElementById('preTileY'), sourceZoomSlider: document.getElementById('sourceZoom'),
    outputWidthInput: document.getElementById('outputWidth'), outputHeightInput: document.getElementById('outputHeight'),
    keepAspectRatioCheckbox: document.getElementById('keepAspectRatio'),
    tilesXValueSpan: document.getElementById('tilesXValue'), tilesYValueSpan: document.getElementById('tilesYValue'),
    skewValueSpan: document.getElementById('skewValue'), staggerValueSpan: document.getElementById('staggerValue'),
    scaleValueSpan: document.getElementById('scaleValue'), preTileXValueSpan: document.getElementById('preTileXValue'),
    preTileYValueSpan: document.getElementById('preTileYValue'), sourceZoomValueSpan: document.getElementById('sourceZoomValue'),
    skewControl: document.getElementById('skewControl'), staggerControl: document.getElementById('staggerControl'),
    tilesXLabel: document.getElementById('tilesXLabel'), tilesYLabel: document.getElementById('tilesYLabel'),
    scaleLabel: document.getElementById('scaleLabel'), tilesXYHelpText: document.getElementById('tilesXYHelpText'),

    // --- Pre-Effect Elements ---
    preEffectSelector: document.getElementById('preEffectSelector'),
    preEffectOptionsContainer: document.getElementById('preEffectOptionsContainer'),
    preEffectIntensityControl: document.getElementById('preEffectIntensityControl'),
    preEffectIntensitySlider: document.getElementById('preEffectIntensitySlider'),
    preEffectIntensityValue: document.getElementById('preEffectIntensityValue'),
    preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'),
    preEffectWaveAmplitudeSlider: document.getElementById('preEffectWaveAmplitudeSlider'), preEffectWaveAmplitudeValue: document.getElementById('preEffectWaveAmplitudeValue'),
    preEffectWaveFrequencySlider: document.getElementById('preEffectWaveFrequencySlider'), preEffectWaveFrequencyValue: document.getElementById('preEffectWaveFrequencyValue'),
    preEffectWavePhaseSlider: document.getElementById('preEffectWavePhaseSlider'), preEffectWavePhaseValue: document.getElementById('preEffectWavePhaseValue'),
    preEffectWaveDirection: document.getElementById('preEffectWaveDirection'), preEffectWaveType: document.getElementById('preEffectWaveType'),
    preEffectRealtimeWarning: document.getElementById('preEffectRealtimeWarning'),
    sliceShiftOptions: document.getElementById('sliceShiftOptions'), sliceShiftDirection: document.getElementById('sliceShiftDirection'),
    sliceShiftIntensitySlider: document.getElementById('sliceShiftIntensitySlider'), sliceShiftIntensityValue: document.getElementById('sliceShiftIntensityValue'),
    pixelSortOptions: document.getElementById('pixelSortOptions'), pixelSortThresholdSlider: document.getElementById('pixelSortThresholdSlider'),
    pixelSortThresholdValue: document.getElementById('pixelSortThresholdValue'), pixelSortDirection: document.getElementById('pixelSortDirection'),
    pixelSortBy: document.getElementById('pixelSortBy'),

    // --- NEW/UPDATED Buttons ---
    applyEffectButton: document.getElementById('applyEffectButton'), // Button to commit effect
    undoButton: document.getElementById('undoButton'), // For history
    redoButton: document.getElementById('redoButton'), // For history

    // Group sliders/selects for enabling/disabling
    sliders: [ document.getElementById('tilesX'), /* ... */ document.getElementById('pixelSortThresholdSlider') ], // Keep as before
     selects: [ document.getElementById('preEffectSelector'), /* ... */ document.getElementById('pixelSortBy') ] // Keep as before
};

// --- State Variables ---
const state = {
    currentImage: null, // The original loaded HTMLImageElement
    originalImageData: null, // ImageData of the originally loaded (and potentially resized) image
    lastAppliedImageData: null, // ImageData *after* the last "Apply Pre-Effect" click
    originalFileName: 'downloaded-image.png',
    originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
    isProcessing: false, debounceTimer: null, isDragging: false,
    dragStartX: 0, dragStartY: 0,
    currentOffsetX: 0, currentOffsetY: 0,
    startOffsetX: 0, startOffsetY: 0,
    sourceZoomLevel: 1.0,
    sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }),
    // --- NEW: History State ---
    history: [],
    historyIndex: -1,
    // Add final output context to state if needed by history utils (check historyUtils)
    ctx: elements.canvas?.getContext('2d', { willReadFrequently: true }) // Context of the final tiling canvas
};

 // --- Effect Function Map ---
 const effectFunctions = { /* ... same as before ... */ };

// --- Debounced Processing Function ---
// This function now ONLY generates the preview based on the *last committed state* plus the *currently selected effect*
function requestProcessAndPreview() {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        // Need lastAppliedImageData to generate preview
        if (state.lastAppliedImageData && !state.isProcessing && state.sourceEffectCtx) {
            // Apply the *currently selected* effect for PREVIEW purposes only
            const sourceCanvasForPreview = applySourceEffectForPreview();
            if (sourceCanvasForPreview) {
                 // Pass the preview canvas to the tiling core
                 processAndPreviewImage(
                     sourceCanvasForPreview, elements, state,
                     (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
                 );
            } else {
                 console.error("requestProcessAndPreview: Failed to get source canvas for previewing.");
                 showMessage("Error preparing preview image.", true, elements.messageBox);
            }
        } else if (!state.lastAppliedImageData && state.currentImage) {
            // If no effects applied yet, preview original image + tiling
             const sourceCanvasForPreview = applySourceEffectForPreview(); // Will just draw original if 'none' selected
             if (sourceCanvasForPreview) {
                processAndPreviewImage(sourceCanvasForPreview, elements, state, (msg, isErr) => showMessage(msg, isErr, elements.messageBox));
             }
        }
    }, 150);
}

// --- Apply *Single* Pre-Effect FOR PREVIEW---
// This function reads the LATEST COMMITTED state (lastAppliedImageData)
// and applies the CURRENTLY SELECTED effect non-destructively for preview.
function applySourceEffectForPreview() {
    // Use lastAppliedImageData as the base, or originalImageData if nothing applied yet
    const baseImageData = state.lastAppliedImageData || state.originalImageData;

    if (!baseImageData || !elements.sourceEffectCanvas || !state.sourceEffectCtx) {
         console.error("applySourceEffectForPreview: Missing prerequisites.");
         return null;
    }
    // Ensure sourceEffectCanvas matches dimensions of the base data
     const canvas = elements.sourceEffectCanvas;
     const ctx = state.sourceEffectCtx;
     if (canvas.width !== baseImageData.width || canvas.height !== baseImageData.height){
        canvas.width = baseImageData.width;
        canvas.height = baseImageData.height;
     }
     if (canvas.width === 0 || canvas.height === 0) return null; // Check zero dimensions

     // 1. Put the base image data onto the effect canvas
     try {
        ctx.putImageData(baseImageData, 0, 0);
     } catch (e) {
        console.error("applySourceEffectForPreview: Error putting base image data:", e);
        return null;
     }


    // 2. Apply the *selected* effect (if not 'none') to this canvas
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        // console.log(`Previewing effect: ${effect}`); // Optional log
        try {
            const imageDataToPreview = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const effectContext = { // Provide a copy of the current canvas as source
                sourceImageData: new ImageData( new Uint8ClampedArray(imageDataToPreview.data), imageDataToPreview.width, imageDataToPreview.height )
            };
            effectFunction(imageDataToPreview, params, effectContext); // Apply effect IN PLACE
            ctx.putImageData(imageDataToPreview, 0, 0); // Put modified data back for preview
        } catch (e) {
             console.error(`applySourceEffectForPreview: Error applying effect '${effect}':`, e);
             showMessage(`Preview Error: ${e.message || 'Unknown'}.`, true, elements.messageBox);
             // Don't return null, return canvas *before* the failed effect
        }
    }
    // Return the canvas (showing base + currently selected preview effect)
    return canvas;
}


// Get Current Effect Parameters (Reads from UI)
function getCurrentEffectAndParams() {
    // ... (Keep existing getCurrentEffectAndParams function) ...
    const effect = elements.preEffectSelector?.value || 'none';
    const params = { intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10) };
    switch (effect) { /* ... cases from before ... */ } return { effect, params };
}


// --- Event Handlers ---

function handleSliderChange() {
    // Update value spans
    // ... (update spans as before) ...

    // Request processing preview when ANY slider changes
    requestProcessAndPreview();
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;

    // Update relevant UI section visibility
    if (target.name === 'tileShape') {
        updateTilingControlsVisibility(elements, null); // Don't trigger processing from here
    } else if (target.id === 'preEffectSelector') {
         updatePreEffectControlsVisibility(elements);
    }

    // Always request preview update on option change
    requestProcessAndPreview();
}

// Handles loading a new image file - UPDATED for history
function handleImageLoad(event) {
    console.log("handleImageLoad: Triggered.");

    // Define reset function locally, including clearHistory callback
    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => clearHistory(state, updateUndoRedoButtonsWrapper, elements) // Pass history clear
    );

    const file = event.target.files?.[0];
    if (!file) { resetFunc(); showMessage('No file selected.', true, elements.messageBox); return; }
    if (!file.type.startsWith('image/')) { resetFunc(); showMessage('Please select a valid image file.', true, elements.messageBox); return; }

    state.originalFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img; // Keep original HTMLImageElement ref if needed
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            if (!state.originalWidth || !state.originalHeight) { /* ... error handling ... */ return; }

            // Create initial ImageData using a temporary canvas
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = state.originalWidth;
            tempCanvas.height = state.originalHeight;
            if (!tempCtx) {
                 resetFunc(); showMessage('Failed to create temp canvas context.', true, elements.messageBox); return;
            }
            try {
                 tempCtx.drawImage(img, 0, 0, state.originalWidth, state.originalHeight);
                 state.originalImageData = tempCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
                 // Initial "applied" state is same as original
                 state.lastAppliedImageData = new ImageData(
                     new Uint8ClampedArray(state.originalImageData.data),
                     state.originalImageData.width,
                     state.originalImageData.height
                 );
            } catch (error) {
                 console.error("handleImageLoad: Error getting initial ImageData:", error);
                 resetFunc(); showMessage('Could not process initial image data.', true, elements.messageBox); return;
            }

            // --- Setup UI and History ---
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
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                // Enable controls
                if(elements.saveButton) elements.saveButton.disabled = false;
                if(elements.applyEffectButton) elements.applyEffectButton.disabled = false; // Enable apply button
                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                elements.selects?.forEach(s => { if(s) s.disabled = false; });
                if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;

                // Initialize History
                clearHistory(state, updateUndoRedoButtonsWrapper, elements);
                pushHistoryState(state.originalImageData, state, updateUndoRedoButtonsWrapper, elements);

                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);
                handleSliderChange();
                requestProcessAndPreview(); // Trigger initial preview (should show original + tiling)
                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox);
            });
        };
        img.onerror = () => { resetFunc(); showMessage('Error loading image data.', true, elements.messageBox); };
        img.src = e.target.result;
    };
    reader.onerror = () => { resetFunc(); showMessage('Error reading file.', true, elements.messageBox); };
    reader.readAsDataURL(file);
    event.target.value = null;
}

// --- NEW Event Handler for Apply Button ---
function handleApplyEffect() {
    if (!state.lastAppliedImageData || state.isProcessing) {
        showMessage("Cannot apply effect now.", true, elements.messageBox);
        return;
    }

    const { effect, params } = getCurrentEffectAndParams();
    if (effect === 'none') {
         showMessage("Select an effect to apply first.", false, elements.messageBox);
         return; // Don't do anything if 'none' is selected
    }

    console.log(`Applying effect permanently: ${effect}`);
    state.isProcessing = true; // Prevent concurrent processing

    // Create a truly independent copy to modify
    let imageDataToCommit = new ImageData(
        new Uint8ClampedArray(state.lastAppliedImageData.data),
        state.lastAppliedImageData.width,
        state.lastAppliedImageData.height
    );

    const effectFunction = effectFunctions[effect];
    let effectAppliedSuccessfully = false;
    if (effectFunction) {
         try {
            const effectContext = { sourceImageData: state.lastAppliedImageData }; // Source is the last committed state
            effectFunction(imageDataToCommit, params, effectContext);
            effectAppliedSuccessfully = true;
         } catch (e) {
             console.error(`handleApplyEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             // Do not proceed if effect failed
         }
    }

    state.isProcessing = false; // Allow processing again

    if(effectAppliedSuccessfully){
        // Update the base image state
        state.lastAppliedImageData = imageDataToCommit;
        // Push the new state to history
        pushHistoryState(state.lastAppliedImageData, state, updateUndoRedoButtonsWrapper, elements);
        // Update the preview immediately to reflect the committed state
        requestProcessAndPreview();
        showMessage(`Effect '${effect}' applied.`, false, elements.messageBox);
    }
}


// --- NEW Event Handlers for Undo/Redo ---
function handleUndo() {
    undo(state, updateUndoRedoButtonsWrapper, elements); // Call imported undo
    // Update preview after undoing
    requestProcessAndPreview();
}

function handleRedo() {
    redo(state, updateUndoRedoButtonsWrapper, elements); // Call imported redo
    // Update preview after redoing
    requestProcessAndPreview();
}

// Wrapper for history utils callbacks
function updateUndoRedoButtonsWrapper() {
    updateUndoRedoButtons(elements, state);
}


// Handles saving the final image (Filename needs slight adjustment)
function saveImage() {
    // Use state.lastAppliedImageData as the basis for the final tiled image if available
    const baseImageDataForSave = state.lastAppliedImageData || state.originalImageData;
    if (!baseImageDataForSave || state.isProcessing) { showMessage('Image data not ready or processing.', true, elements.messageBox); return; }
    if (!elements.canvas || !elements.outputWidthInput || !elements.outputHeightInput) { /* ... */ return; }

    // We need to run the *tiling* process one last time on the *committed* data
    // Put committed data onto the sourceEffectCanvas (as if 'none' effect selected for preview)
    if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) return;
    const saveSourceCanvas = elements.sourceEffectCanvas;
    const saveSourceCtx = state.sourceEffectCtx;
    saveSourceCanvas.width = baseImageDataForSave.width;
    saveSourceCanvas.height = baseImageDataForSave.height;
    saveSourceCtx.putImageData(baseImageDataForSave, 0, 0);

    // Run tiling using this canvas
    processAndPreviewImage(saveSourceCanvas, elements, state, (msg, isErr)=>console.log(msg)); // Run tiling, ignore UI message


    // Now save the final tiled result from elements.canvas
    try {
        const targetWidth = parseInt(elements.outputWidthInput.value, 10);
        const targetHeight = parseInt(elements.outputHeightInput.value, 10);
        if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) { /* ... */ return; }
        const outputCanvas = document.createElement('canvas'); outputCanvas.width = targetWidth; outputCanvas.height = targetHeight;
        const outputCtx = outputCanvas.getContext('2d'); if (!outputCtx) throw new Error("Could not create output canvas context.");
        outputCtx.imageSmoothingQuality = "high";
        outputCtx.drawImage(elements.canvas, 0, 0, elements.canvas.width, elements.canvas.height, 0, 0, targetWidth, targetHeight);
        const dataURL = outputCanvas.toDataURL('image/png');
        const link = document.createElement('a'); link.href = dataURL;

        // --- Generate descriptive filename (use last applied effect if relevant) ---
        const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
        const mirrorType = document.querySelector('input[name="mirrorOption"]:checked')?.value || 'none';
        // Determine if effects were applied based on history
        const effectApplied = state.historyIndex > 0; // Simple check if history exists beyond original
        const shapeMap = { /* ... */ }; const shapeStr = shapeMap[selectedShape] || 'unk';
        const mirrorStr = mirrorType !== 'none' ? `_m${mirrorType.substring(0,1)}` : '';
        const preEffectStr = effectApplied ? `_fx-applied` : ''; // Indicate effects were applied
        const tileStr = `_t${elements.tilesXSlider?.value}x${elements.tilesYSlider?.value}`;
        const preTileStr = `_p${elements.preTileXSlider?.value}x${elements.preTileYSlider?.value}`;
        const scaleStr = `_sc${elements.scaleSlider?.value}`;
        let shapeParams = ''; if (selectedShape === 'skewed') { shapeParams = `_sk${elements.skewSlider?.value}_st${elements.staggerSlider?.value}`; }
        const baseName = state.originalFileName.substring(0, state.originalFileName.lastIndexOf('.')) || state.originalFileName;
        const extension = state.originalFileName.substring(state.originalFileName.lastIndexOf('.')) || '.png';
        link.download = `${baseName}${preEffectStr}_${shapeStr}${mirrorStr}${tileStr}${preTileStr}${shapeParams}${scaleStr}_${targetWidth}x${targetHeight}${extension}`
            .replace(/_none/g,'').replace(/_fx-applied_fx-none/g,'_fx-applied') // Clean up
            .replace(/__/g,'_').replace(/^_|_$/g, '');

        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showMessage('Image saved successfully!', false, elements.messageBox);
     } catch (error) { console.error('Error saving image:', error); showMessage(`Could not save the image: ${error.message}`, true, elements.messageBox); }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    if (elements.imageLoader) { elements.imageLoader.addEventListener('change', handleImageLoad); }
    else { console.error("setupEventListeners: imageLoader element not found!"); }

    // --- NEW: Apply Button Listener ---
    elements.applyEffectButton?.addEventListener('click', handleApplyEffect);

    // --- NEW: Undo/Redo Listeners ---
    elements.undoButton?.addEventListener('click', handleUndo);
    elements.redoButton?.addEventListener('click', handleRedo);


    elements.saveButton?.addEventListener('click', saveImage);
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ /* ... */ ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });

    // Pre-Effect controls - listeners trigger preview, not commit
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestProcessAndPreview);
    // ... setup listeners for all other effect sliders/selects, calling requestProcessAndPreview ...
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, /* ... */);
    setupSliderListener(elements.preEffectWaveFrequencySlider, /* ... */);
    setupSliderListener(elements.preEffectWavePhaseSlider, /* ... */);
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange);
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.sliceShiftIntensitySlider, /* ... */);
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, /* ... */);
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);

    // Source Zoom, Output Dimensions, Panning listeners remain the same...
    elements.sourceZoomSlider?.addEventListener('input', () => handleSourceZoom( /* ... */ ));
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { /* ... */ });
    elements.sourcePreviewContainer?.addEventListener('mousedown', (e) => startPan(e, elements, state));
    document.addEventListener('mousemove', (e) => { /* ... panMove ... */ });
    document.addEventListener('mouseup', () => endPan(elements, state));
    elements.sourcePreviewContainer?.addEventListener('mouseleave', () => endPan(elements, state));

     console.log("setupEventListeners: Finished attaching listeners.");
}


// --- Initial Application State ---
function initializeApp() {
     resetState(
         elements, state,
         () => updateTilingControlsVisibility(elements, handleSliderChange),
         () => updatePreEffectControlsVisibility(elements),
         handleSliderChange,
         () => clearHistory(state, updateUndoRedoButtonsWrapper, elements) // Pass clearHistory callback
     );
     if (!state.sourceEffectCtx && elements.sourceEffectCanvas) { state.sourceEffectCtx = elements.sourceEffectCanvas.getContext('2d', { willReadFrequently: true }); }
     if (!state.ctx && elements.canvas) { state.ctx = elements.canvas.getContext('2d', { willReadFrequently: true }); } // Ensure final canvas ctx is in state for historyUtils if needed
     if (!state.sourceEffectCtx || !state.ctx) { console.error("initializeApp: Failed to get required canvas contexts!"); }

     setupEventListeners();
     updateUndoRedoButtonsWrapper(); // Initial button state
     console.log("Image Tiler Initialized with Apply Button Workflow");
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
