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
    sliders: [ document.getElementById('tilesX'), document.getElementById('tilesY'), document.getElementById('skewFactor'), document.getElementById('staggerOffset'), document.getElementById('tileScale'), document.getElementById('preTileX'), document.getElementById('preTileY'), document.getElementById('sourceZoom'), document.getElementById('preEffectIntensitySlider'), document.getElementById('preEffectWaveAmplitudeSlider'), document.getElementById('preEffectWaveFrequencySlider'), document.getElementById('preEffectWavePhaseSlider'), document.getElementById('sliceShiftIntensitySlider'), document.getElementById('pixelSortThresholdSlider') ],
     selects: [ document.getElementById('preEffectSelector'), document.getElementById('preEffectWaveDirection'), document.getElementById('preEffectWaveType'), document.getElementById('sliceShiftDirection'), document.getElementById('pixelSortDirection'), document.getElementById('pixelSortBy') ]
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

// --- Debounced Processing Function ---
// Generates the preview based on the *last committed state* plus the *currently selected effect*
function requestProcessAndPreview() {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        // Need lastAppliedImageData to generate preview, or original if none applied
        const baseImageData = state.lastAppliedImageData || state.originalImageData;

        if (baseImageData && !state.isProcessing && state.sourceEffectCtx) {
            // Apply the *currently selected* effect for PREVIEW purposes only
            const sourceCanvasForPreview = applySourceEffectForPreview(); // Gets canvas with base + preview effect
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
        }
    }, 150); // Debounce delay
}

// --- Apply *Single* Pre-Effect FOR PREVIEW---
// Reads the LATEST COMMITTED state (lastAppliedImageData)
// Applies the CURRENTLY SELECTED effect non-destructively for preview.
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
     if (canvas.width === 0 || canvas.height === 0) return null;

     // 1. Put the base image data onto the effect canvas
     try { ctx.putImageData(baseImageData, 0, 0); }
     catch (e) { console.error("applySourceEffectForPreview: Error putting base image data:", e); return null; }

    // 2. Apply the *selected* effect (if not 'none') to this canvas
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        // console.log(`Previewing effect: ${effect}`);
        try {
            const imageDataToPreview = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const effectContext = { sourceImageData: baseImageData }; // Source for preview is the base state
            effectFunction(imageDataToPreview, params, effectContext); // Apply effect IN PLACE
            ctx.putImageData(imageDataToPreview, 0, 0); // Put modified data back for preview
        } catch (e) {
             console.error(`applySourceEffectForPreview: Error applying effect '${effect}':`, e);
             showMessage(`Preview Error: ${e.message || 'Unknown'}.`, true, elements.messageBox);
             // Return canvas *before* the failed effect
        }
    }
    // Return the canvas (showing base + currently selected preview effect)
    return canvas;
}


// Get Current Effect Parameters (Reads from UI)
function getCurrentEffectAndParams() {
    const effect = elements.preEffectSelector?.value || 'none';
    const params = { intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10) };
    switch (effect) {
        case 'waveDistortion': /*...*/ params.amplitude = parseInt(elements.preEffectWaveAmplitudeSlider?.value || 10, 10); params.frequency = parseInt(elements.preEffectWaveFrequencySlider?.value || 5, 10); params.phase = parseInt(elements.preEffectWavePhaseSlider?.value || 0, 10) * (Math.PI / 180); params.direction = elements.preEffectWaveDirection?.value || 'horizontal'; params.waveType = elements.preEffectWaveType?.value || 'sine'; break;
        case 'sliceShift': params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10); params.direction = elements.sliceShiftDirection?.value || 'horizontal'; break;
        case 'pixelSort': params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10); params.direction = elements.pixelSortDirection?.value || 'horizontal'; params.sortBy = elements.pixelSortBy?.value || 'brightness'; break;
        case 'scanLines': params.intensity = parseInt(elements.scanLinesIntensitySlider?.value || 50, 10); params.direction = elements.scanLinesDirection?.value || 'horizontal'; params.thickness = parseInt(elements.scanLinesThicknessSlider?.value || 2, 10); break;
    }
    return { effect, params };
}


// --- Event Handlers ---

function handleSliderChange() {
    // Update value spans
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    // Effect slider spans updated by setupSliderListener

    requestProcessAndPreview(); // Request processing preview when ANY slider changes
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    // Update relevant UI section visibility
    if (target.name === 'tileShape') { updateTilingControlsVisibility(elements, null); }
    else if (target.id === 'preEffectSelector') { updatePreEffectControlsVisibility(elements); }
    // Always request preview update on option change
    requestProcessAndPreview();
}

// Handles loading a new image file - UPDATED for history
function handleImageLoad(event) {
    console.log("handleImageLoad: Triggered.");
    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => clearHistory(state, updateUndoRedoButtonsWrapper, elements) // Pass history clear
    );
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) { resetFunc(); showMessage(file ? 'Invalid file type.' : 'No file selected.', true, elements.messageBox); return; }
    state.originalFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img; // Keep original HTMLImageElement ref
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            if (!state.originalWidth || !state.originalHeight) { resetFunc(); showMessage('Error: Image loaded with invalid dimensions.', true, elements.messageBox); return; }

            // Create initial ImageData
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = state.originalWidth; tempCanvas.height = state.originalHeight;
            if (!tempCtx) { resetFunc(); showMessage('Failed to create temp context.', true, elements.messageBox); return; }
            try {
                 tempCtx.drawImage(img, 0, 0, state.originalWidth, state.originalHeight);
                 state.originalImageData = tempCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
                 // Initial "applied" state is same as original
                 state.lastAppliedImageData = new ImageData( new Uint8ClampedArray(state.originalImageData.data), state.originalImageData.width, state.originalImageData.height );
            } catch (error) { resetFunc(); showMessage('Could not process initial image data.', true, elements.messageBox); return; }

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

            requestAnimationFrame(() => { // Ensure DOM updates before transform
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
                pushHistoryState(state.originalImageData, state, updateUndoRedoButtonsWrapper, elements); // Push BASE state

                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);
                handleSliderChange(); // Update slider displays
                requestProcessAndPreview(); // Trigger initial preview
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

// --- Event Handler for Apply Button ---
function handleApplyEffect() {
    // Use last committed state as base
    const baseImageData = state.lastAppliedImageData;
    if (!baseImageData || state.isProcessing) {
        showMessage("Cannot apply effect now (no base image or processing).", true, elements.messageBox);
        return;
    }
    const { effect, params } = getCurrentEffectAndParams();
    if (effect === 'none') {
         showMessage("Select an effect to apply first.", false, elements.messageBox);
         return;
    }
    console.log(`Applying effect permanently: ${effect}`);
    state.isProcessing = true; // Prevent concurrent processing

    // Create a truly independent copy to modify
    let imageDataToCommit = new ImageData(
        new Uint8ClampedArray(baseImageData.data),
        baseImageData.width,
        baseImageData.height
    );
    const effectFunction = effectFunctions[effect];
    let effectAppliedSuccessfully = false;
    if (effectFunction) {
         try {
            const effectContext = { sourceImageData: baseImageData }; // Source is the last committed state
            effectFunction(imageDataToCommit, params, effectContext);
            effectAppliedSuccessfully = true;
         } catch (e) { /* ... error handling ... */ }
    }
    state.isProcessing = false; // Allow processing again

    if(effectAppliedSuccessfully){
        state.lastAppliedImageData = imageDataToCommit; // Update the base state
        pushHistoryState(state.lastAppliedImageData, state, updateUndoRedoButtonsWrapper, elements); // Push NEW state
        requestProcessAndPreview(); // Update the preview to show the newly committed state
        showMessage(`Effect '${effect}' applied.`, false, elements.messageBox);
    }
}


// --- Event Handlers for Undo/Redo ---
function handleUndo() {
    // Pass state.ctx for putImageData, and callback to update lastAppliedImageData
    undo(state, updateUndoRedoButtonsWrapper, elements, (imageData) => {
        state.lastAppliedImageData = imageData; // Update state on successful undo
        requestProcessAndPreview(); // Refresh preview
    });
}

function handleRedo() {
    // Pass state.ctx for putImageData, and callback to update lastAppliedImageData
    redo(state, updateUndoRedoButtonsWrapper, elements, (imageData) => {
         state.lastAppliedImageData = imageData; // Update state on successful redo
         requestProcessAndPreview(); // Refresh preview
    });
}

// Wrapper for history utils button updates
function updateUndoRedoButtonsWrapper() {
    updateUndoRedoButtons(elements, state);
}


// Handles saving the final image
function saveImage() {
    const baseImageDataForSave = state.lastAppliedImageData || state.originalImageData;
    if (!baseImageDataForSave || state.isProcessing) { /* ... */ return; }
    if (!elements.canvas || !elements.outputWidthInput || !elements.outputHeightInput || !elements.sourceEffectCanvas || !state.sourceEffectCtx ) { /* ... */ return; }

    // Run tiling on the last COMMITTED data
    const saveSourceCanvas = elements.sourceEffectCanvas;
    const saveSourceCtx = state.sourceEffectCtx;
    saveSourceCanvas.width = baseImageDataForSave.width; saveSourceCanvas.height = baseImageDataForSave.height;
    saveSourceCtx.putImageData(baseImageDataForSave, 0, 0);
    processAndPreviewImage(saveSourceCanvas, elements, state, (msg, isErr)=>console.log(msg)); // Run tiling

    // Now save the final tiled result from elements.canvas
    try {
        const targetWidth = parseInt(elements.outputWidthInput.value, 10);
        const targetHeight = parseInt(elements.outputHeightInput.value, 10);
        if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) { /* ... */ return; }
        const outputCanvas = document.createElement('canvas'); /* ... */
        const outputCtx = outputCanvas.getContext('2d'); /* ... */
        outputCtx.drawImage(elements.canvas, 0, 0, elements.canvas.width, elements.canvas.height, 0, 0, targetWidth, targetHeight);
        const dataURL = outputCanvas.toDataURL('image/png');
        const link = document.createElement('a'); link.href = dataURL;

        // Generate filename
        const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
        const mirrorType = document.querySelector('input[name="mirrorOption"]:checked')?.value || 'none';
        const effectApplied = state.historyIndex > 0; // Check if any effects were committed
        const shapeMap = { /* ... */ }; const shapeStr = shapeMap[selectedShape] || 'unk';
        const mirrorStr = mirrorType !== 'none' ? `_m${mirrorType.substring(0,1)}` : '';
        const preEffectStr = effectApplied ? `_fx-applied` : '';
        const tileStr = `_t${elements.tilesXSlider?.value}x${elements.tilesYSlider?.value}`;
        const preTileStr = `_p${elements.preTileXSlider?.value}x${elements.preTileYSlider?.value}`;
        const scaleStr = `_sc${elements.scaleSlider?.value}`;
        let shapeParams = ''; if (selectedShape === 'skewed') { /* ... */ }
        const baseName = state.originalFileName.substring(0, state.originalFileName.lastIndexOf('.')) || state.originalFileName;
        const extension = state.originalFileName.substring(state.originalFileName.lastIndexOf('.')) || '.png';
        link.download = `${baseName}${preEffectStr}_${shapeStr}${mirrorStr}${tileStr}${preTileStr}${shapeParams}${scaleStr}_${targetWidth}x${targetHeight}${extension}`
            .replace(/_none/g,'').replace(/_fx-applied_fx-none/g,'_fx-applied')
            .replace(/__/g,'_').replace(/^_|_$/g, '');

        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showMessage('Image saved successfully!', false, elements.messageBox);
     } catch (error) { console.error('Error saving image:', error); showMessage(`Could not save the image: ${error.message}`, true, elements.messageBox); }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    if (elements.imageLoader) { elements.imageLoader.addEventListener('change', handleImageLoad); }
    else { console.error("setupEventListeners: imageLoader element not found!"); }

    elements.applyEffectButton?.addEventListener('click', handleApplyEffect); // Apply button
    elements.undoButton?.addEventListener('click', handleUndo); // Undo button
    elements.redoButton?.addEventListener('click', handleRedo); // Redo button
    elements.saveButton?.addEventListener('click', saveImage);

    // Tiling controls
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ /* ... */ ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });

    // Pre-Effect controls trigger preview
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestProcessAndPreview);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestProcessAndPreview);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestProcessAndPreview);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestProcessAndPreview, val => val + '°');
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange);
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestProcessAndPreview);
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestProcessAndPreview);
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);

    // Source Zoom, Output Dimensions, Panning listeners
    elements.sourceZoomSlider?.addEventListener('input', () => handleSourceZoom( elements, state, () => updateSourcePreviewTransform(elements, state), handleSliderChange ));
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { /* ... */ });
    elements.sourcePreviewContainer?.addEventListener('mousedown', (e) => startPan(e, elements, state));
    document.addEventListener('mousemove', (e) => { if (!state || !state.currentImage) { return; } panMove( e, elements, state, () => updateSourcePreviewTransform(elements, state), handleSliderChange ); });
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
         () => clearHistory(state, updateUndoRedoButtonsWrapper, elements) // Pass clearHistory
     );
     if (!state.sourceEffectCtx && elements.sourceEffectCanvas) { state.sourceEffectCtx = elements.sourceEffectCanvas.getContext('2d', { willReadFrequently: true }); }
     if (!state.ctx && elements.canvas) { state.ctx = elements.canvas.getContext('2d', { willReadFrequently: true }); }
     if (!state.sourceEffectCtx || !state.ctx) { console.error("initializeApp: Failed to get required canvas contexts!"); }

     setupEventListeners();
     updateUndoRedoButtonsWrapper(); // Initial history button state
     console.log("Image Tiler Initialized with Apply Button Workflow");
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
