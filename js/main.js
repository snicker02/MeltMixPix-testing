// js/main.js (Sequential Pre-Effect Logic with History)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
// --- History Utils Import ---
import {
    updateUndoRedoButtons, clearHistory, pushHistoryState, undo as historyUndo, redo as historyRedo
} from './utils/historyUtils.js'; // << ADDED

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
// (Add new buttons)
const elements = {
    imageLoader: document.getElementById('imageLoader'),
    sourcePreviewContainer: document.getElementById('sourcePreviewContainer'),
    sourcePreview: document.getElementById('sourcePreview'),
    sourcePreviewText: document.getElementById('sourcePreviewText'),
    finalPreviewContainer: document.getElementById('finalPreviewContainer'),
    finalPreview: document.getElementById('finalPreview'),
    finalPreviewText: document.getElementById('finalPreviewText'),
    mirrorCanvas: document.getElementById('mirrorCanvas'),
    preTileCanvas: document.getElementById('preTileCanvas'),
    canvas: document.getElementById('imageCanvas'),         // Final Tiled Output Canvas
    sourceEffectCanvas: document.getElementById('sourceEffectCanvas'), // Canvas holding the *applied* source state
    saveButton: document.getElementById('saveButton'),
    applyEffectButton: document.getElementById('applyEffectButton'), // << ADDED
    undoButton: document.getElementById('undoButton'),       // << ADDED
    redoButton: document.getElementById('redoButton'),       // << ADDED
    messageBox: document.getElementById('messageBox'),
    tileShapeOptions: document.querySelectorAll('input[name="tileShape"]'),
    mirrorOptions: document.querySelectorAll('input[name="mirrorOption"]'),
    tilesXSlider: document.getElementById('tilesX'),
    tilesYSlider: document.getElementById('tilesY'),
    skewSlider: document.getElementById('skewFactor'),
    staggerSlider: document.getElementById('staggerOffset'),
    scaleSlider: document.getElementById('tileScale'),
    preTileXSlider: document.getElementById('preTileX'),
    preTileYSlider: document.getElementById('preTileY'),
    sourceZoomSlider: document.getElementById('sourceZoom'),
    outputWidthInput: document.getElementById('outputWidth'),
    outputHeightInput: document.getElementById('outputHeight'),
    keepAspectRatioCheckbox: document.getElementById('keepAspectRatio'),
    tilesXValueSpan: document.getElementById('tilesXValue'),
    tilesYValueSpan: document.getElementById('tilesYValue'),
    skewValueSpan: document.getElementById('skewValue'),
    staggerValueSpan: document.getElementById('staggerValue'),
    scaleValueSpan: document.getElementById('scaleValue'),
    preTileXValueSpan: document.getElementById('preTileXValue'),
    preTileYValueSpan: document.getElementById('preTileYValue'),
    sourceZoomValueSpan: document.getElementById('sourceZoomValue'),
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
    preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'),
    preEffectWaveAmplitudeSlider: document.getElementById('preEffectWaveAmplitudeSlider'),
    preEffectWaveAmplitudeValue: document.getElementById('preEffectWaveAmplitudeValue'),
    preEffectWaveFrequencySlider: document.getElementById('preEffectWaveFrequencySlider'),
    preEffectWaveFrequencyValue: document.getElementById('preEffectWaveFrequencyValue'),
    preEffectWavePhaseSlider: document.getElementById('preEffectWavePhaseSlider'),
    preEffectWavePhaseValue: document.getElementById('preEffectWavePhaseValue'),
    preEffectWaveDirection: document.getElementById('preEffectWaveDirection'),
    preEffectWaveType: document.getElementById('preEffectWaveType'),
    preEffectRealtimeWarning: document.getElementById('preEffectRealtimeWarning'),
    sliceShiftOptions: document.getElementById('sliceShiftOptions'),
    sliceShiftDirection: document.getElementById('sliceShiftDirection'),
    sliceShiftIntensitySlider: document.getElementById('sliceShiftIntensitySlider'),
    sliceShiftIntensityValue: document.getElementById('sliceShiftIntensityValue'),
    pixelSortOptions: document.getElementById('pixelSortOptions'),
    pixelSortThresholdSlider: document.getElementById('pixelSortThresholdSlider'),
    pixelSortThresholdValue: document.getElementById('pixelSortThresholdValue'),
    pixelSortDirection: document.getElementById('pixelSortDirection'),
    pixelSortBy: document.getElementById('pixelSortBy'),
    sliders: [ /* ... (existing sliders) ... */ ],
    selects: [ /* ... (existing selects) ... */ ]
};
// Add new sliders/selects to the grouped lists if needed for resetState
elements.sliders.push(elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider);
elements.selects.push(elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy);


// --- State Variables ---
// (Add history-related state)
const state = {
    currentImage: null,         // The original loaded Image object
    originalImageData: null,    // ImageData of the original panned/zoomed image
    lastAppliedImageData: null, // ImageData after the last *committed* effect apply
    originalFileName: 'downloaded-image.png',
    originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
    isProcessing: false, debounceTimer: null, isDragging: false,
    dragStartX: 0, dragStartY: 0,
    currentOffsetX: 0, currentOffsetY: 0,
    startOffsetX: 0, startOffsetY: 0,
    sourceZoomLevel: 1.0,
    sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }),
    // History State
    history: [],             // Array of ImageData objects
    historyIndex: -1,        // Index of the current state in the history array
    ctx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }) // Context needed by historyUtils
};

// --- Effect Function Map ---
// (Remains the same)
const effectFunctions = { /* ... */ };

// --- Core Processing Functions ---

/**
 * Update the final tiled preview based on the current state of sourceEffectCanvas.
 */
function updateFinalPreview() {
    console.log('[MainApp] updateFinalPreview called.');
    if (state.currentImage && !state.isProcessing && elements.sourceEffectCanvas) {
        // Directly use the sourceEffectCanvas which holds the applied state
         processAndPreviewImage(
            elements.sourceEffectCanvas, elements, state,
            (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
        );
    } else {
         console.warn('[MainApp] updateFinalPreview skipped (no image, processing, or canvas)');
    }
}

/**
 * Applies the currently *selected* effect settings to a *source* ImageData
 * and returns the *modified* ImageData. Does not modify the canvas directly.
 * @param {ImageData} sourceImageData The base image data to apply the effect to.
 * @returns {ImageData | null} The modified ImageData or null on error.
 */
function getEffectResultData(sourceImageData) {
    if (!sourceImageData) {
        console.error("getEffectResultData: Missing source image data.");
        return null;
    }
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (!effectFunction) { // 'none' selected
        console.log("[getEffectResultData] No effect selected ('none').");
        return sourceImageData; // Return the original data if no effect
    }

    console.log(`[getEffectResultData] Applying effect: ${effect} with params:`, params);
    try {
        // Create a *copy* of the source ImageData to modify
        const workingImageData = new ImageData(
            new Uint8ClampedArray(sourceImageData.data),
            sourceImageData.width,
            sourceImageData.height
        );
        const effectContext = {
            // Effects like wave/fractal need the *original* state for sampling
            sourceImageData: sourceImageData // Pass the unmodified source here
        };
        effectFunction(workingImageData, params, effectContext); // Apply effect IN PLACE on the copy
        return workingImageData; // Return the modified copy
    } catch (e) {
        console.error(`[getEffectResultData] Error applying effect '${effect}':`, e);
        showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
        return null;
    }
}

/**
 * Updates the sourceEffectCanvas and the final tiled preview
 * to show a live preview of the currently selected effect,
 * applied *on top of* the last committed state. (Debounced)
 */
function updateLivePreview() {
    console.log('[MainApp] updateLivePreview called.'); // Added log
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        console.log('[MainApp] Debounce timer (LivePreview) finished.'); // Added log
        if (!state.lastAppliedImageData || !state.sourceEffectCtx) {
            console.warn("[MainApp] updateLivePreview skipped: No last applied data or context.");
            return;
        }

        // Apply the currently selected effect settings to the last *committed* state
        const previewImageData = getEffectResultData(state.lastAppliedImageData);

        if (previewImageData) {
            // Put the *preview* data onto the sourceEffectCanvas temporarily
            state.sourceEffectCtx.putImageData(previewImageData, 0, 0);
            // Update the final tiled preview based on this temporary state
            updateFinalPreview();
        }
    }, 150); // Debounce live preview updates
}

// --- Event Handlers ---

/**
 * Handles clicks on the "Apply Pre-Effect" button.
 */
function handleApplyEffectClick() {
    console.log('[MainApp] Apply Pre-Effect button clicked.');
    if (!state.lastAppliedImageData || !state.sourceEffectCtx || state.isProcessing) {
        console.warn('[MainApp] Apply skipped: Prerequisites not met.');
        showMessage("Cannot apply effect now (no image or processing).", true, elements.messageBox);
        return;
    }

    const { effect } = getCurrentEffectAndParams();
    if (effect === 'none') {
        showMessage("Select an effect first before applying.", true, elements.messageBox);
        return;
    }

    // Apply the currently selected effect to the last committed state
    const newImageData = getEffectResultData(state.lastAppliedImageData);

    if (newImageData) {
        // Commit the change: update lastAppliedImageData
        state.lastAppliedImageData = newImageData;
        // Draw the newly committed state onto the sourceEffectCanvas
        state.sourceEffectCtx.putImageData(newImageData, 0, 0);
        // Push this committed state to history
        pushHistoryState(newImageData, state, updateUndoRedoButtons, elements);
        // Update the final tiled preview based on the committed state
        updateFinalPreview();
        showMessage(`Effect "${effect}" applied.`, false, elements.messageBox);
    } else {
        // Error message shown within getEffectResultData
    }
}

/**
 * Handles clicks on the Undo button.
 */
function handleUndoClick() {
    console.log('[MainApp] Undo button clicked.');
    historyUndo(state, updateUndoRedoButtons, elements); // Uses state.ctx implicitly
    // Update the preview after undoing
    updateFinalPreview();
}

/**
 * Handles clicks on the Redo button.
 */
function handleRedoClick() {
    console.log('[MainApp] Redo button clicked.');
    historyRedo(state, updateUndoRedoButtons, elements); // Uses state.ctx implicitly
    // Update the preview after redoing
    updateFinalPreview();
}


// (getCurrentEffectAndParams, handleImageLoad, saveImage remain largely the same,
// but handleImageLoad needs to initialize history)
// Get Current Effect Parameters (Reads from UI) - UPDATED for new effects
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
            break;
        case 'sliceShift':
            params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10);
            params.direction = elements.sliceShiftDirection?.value || 'horizontal';
            break;
        case 'pixelSort':
            params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10);
            params.direction = elements.pixelSortDirection?.value || 'horizontal';
            params.sortBy = elements.pixelSortBy?.value || 'brightness';
            break;
        case 'scanLines':
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10);
            break;
    }
    return { effect, params };
}


function handleSliderChange() {
    console.log('[MainApp] handleSliderChange called (likely Tiling slider).');
    // Update tiling value spans
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    // Effect slider values are handled separately by setupSliderListener triggering updateLivePreview

    updateFinalPreview(); // Tiling changes affect the final preview directly
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    console.log(`[MainApp] Option change detected on element ID: ${target.id}, Name: ${target.name}`);

    if (target.name === 'tileShape') {
        updateTilingControlsVisibility(elements, handleSliderChange);
        updateFinalPreview(); // Tiling shape changes final preview
    } else if (target.name === 'mirrorOption') {
        updateFinalPreview(); // Mirroring changes final preview
    } else if (target.id === 'preEffectSelector') {
         updatePreEffectControlsVisibility(elements);
         updateLivePreview(); // Effect selector change updates live preview
    } else if (target.closest('#preEffectOptionsContainer')) {
        updateLivePreview(); // Changes within effect options update live preview
    }
}

// Modified handleImageLoad to initialize history
function handleImageLoad(event) {
    console.log("handleImageLoad: Function triggered.");

    // Define reset function locally, passing history clear function
    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => clearHistory(state, updateUndoRedoButtons, elements) // Pass history clear
    );

    const file = event.target.files?.[0];
    if (!file) { console.log("handleImageLoad: No file selected."); resetFunc(); showMessage('No file selected.', true, elements.messageBox); return; }
    if (!file.type.startsWith('image/')) { console.log("handleImageLoad: Invalid file type selected."); resetFunc(); showMessage('Please select a valid image file.', true, elements.messageBox); return; }

    state.originalFileName = file.name;
    console.log(`handleImageLoad: File selected - ${state.originalFileName}`);
    const reader = new FileReader();

    reader.onload = (e) => {
        console.log("handleImageLoad: FileReader onload triggered.");
        const img = new Image();

        img.onload = () => {
            console.log("handleImageLoad: Image object onload triggered.");
            state.currentImage = img;
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            console.log(`handleImageLoad: Image dimensions set - ${state.originalWidth}x${state.originalHeight}`);

            if (!state.originalWidth || !state.originalHeight) {
                 console.error("handleImageLoad: Image loaded but dimensions are invalid (0).");
                 resetFunc();
                 showMessage('Error: Image loaded with invalid dimensions.', true, elements.messageBox);
                 return;
            }

            if(elements.outputWidthInput) elements.outputWidthInput.value = state.originalWidth;
            if(elements.outputHeightInput) elements.outputHeightInput.value = state.originalHeight;

            if(elements.sourcePreview) {
                 elements.sourcePreview.src = e.target.result;
                 elements.sourcePreview.classList.remove('hidden');
            }
            if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
            if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';

            // Reset pan/zoom state
            state.currentOffsetX = 0; state.currentOffsetY = 0; state.startOffsetX = 0; state.startOffsetY = 0;
            state.sourceZoomLevel = 1.0;
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
            if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';

            // Draw initial panned/zoomed image to sourceEffectCanvas and get ImageData
            requestAnimationFrame(() => {
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                if (elements.sourceEffectCanvas && state.sourceEffectCtx) {
                     elements.sourceEffectCanvas.width = state.originalWidth;
                     elements.sourceEffectCanvas.height = state.originalHeight;
                     state.sourceEffectCtx.clearRect(0, 0, state.originalWidth, state.originalHeight);
                    try {
                        // Draw initial view (no effects yet)
                         const sourceRectWidth = state.originalWidth / state.sourceZoomLevel;
                         const sourceRectHeight = state.originalHeight / state.sourceZoomLevel;
                         const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
                         const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;
                        state.sourceEffectCtx.drawImage(state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, state.originalWidth, state.originalHeight);
                        state.originalImageData = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
                        state.lastAppliedImageData = state.originalImageData; // Start with original

                        // Initialize History
                        clearHistory(state, updateUndoRedoButtons, elements);
                        pushHistoryState(state.originalImageData, state, updateUndoRedoButtons, elements); // Push initial state

                    } catch(drawError) {
                        console.error("Error drawing initial image to source canvas:", drawError);
                        showMessage("Error preparing initial image.", true, elements.messageBox);
                        resetFunc();
                        return;
                    }
                } else {
                     console.error("Cannot get sourceEffectCanvas context for initial state.");
                      showMessage("Initialization Error: Canvas context missing.", true, elements.messageBox);
                     resetFunc();
                     return;
                }

                // Enable controls
                if(elements.saveButton) elements.saveButton.disabled = false;
                if(elements.applyEffectButton) elements.applyEffectButton.disabled = false; // << ENABLE APPLY BUTTON
                // Undo/Redo initially disabled by historyUtils
                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                elements.selects?.forEach(s => { if(s) s.disabled = false; });
                if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;

                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);
                handleSliderChange(); // Update slider displays (calls updateFinalPreview)

                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox);
            });
        };
        img.onerror = () => { /* ... (error handling) ... */ };
        img.src = e.target.result;
    };
    reader.onerror = () => { /* ... (error handling) ... */ };
    reader.readAsDataURL(file);
}


function saveImage() { /* ... (saveImage logic remains the same) ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() {
    elements.imageLoader?.addEventListener('change', handleImageLoad);
    elements.saveButton?.addEventListener('click', saveImage);

    // --- New Button Listeners ---
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick); // << ADDED
    elements.undoButton?.addEventListener('click', handleUndoClick);           // << ADDED
    elements.redoButton?.addEventListener('click', handleRedoClick);           // << ADDED

    // Tiling controls - Trigger updateFinalPreview directly or via handleSliderChange
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); }); // Calls updateFinalPreview

    // Pre-Effect controls - Trigger updateLivePreview
    elements.preEffectSelector?.addEventListener('change', handleOptionChange); // Calls updateLivePreview
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, updateLivePreview); // Calls updateLivePreview
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, updateLivePreview);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, updateLivePreview);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, updateLivePreview, val => val + '°');
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange); // Calls updateLivePreview
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange); // Calls updateLivePreview
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, updateLivePreview);
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, updateLivePreview);
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);


    // Source Zoom Listener - Triggers updateLivePreview after visual update
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider,
             elements.sourceZoomValueSpan,
             () => { // Callback for zoom slider
                 console.log('[MainApp] Zoom slider input. Updating transform and requesting live preview.');
                 handleSourceZoom( // Updates state and visual transform
                     elements, state,
                     () => updateSourcePreviewTransform(elements, state)
                 );
                 // Pan/zoom changes the *base* image for effects/tiling,
                 // so we need to update the live effect preview based on the new view
                 updateLivePreview(); // << Update live preview based on new zoom/pan
             },
             val => parseFloat(val).toFixed(1)
         );
    } else { /* ... warning ... */ }


    // Output Dimensions Listeners remain the same
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { /* ... */ });

    // Panning listeners - Trigger updateLivePreview on endPan
     if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => {
             startPan(e, elements, state);
         });
         document.addEventListener('mousemove', (e) => {
             if (!state.isDragging) return;
             panMove( // Only updates visual preview
                 e, elements, state,
                 () => updateSourcePreviewTransform(elements, state)
             );
         });
         const endPanHandler = () => {
            if (!state.isDragging) return;
             console.log('[MainApp] Pan ended. Requesting live preview update.');
             endPan(elements, state, updateLivePreview); // << Call updateLivePreview on end
         };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler); // Handle leaving window
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

     // Pass the clearHistory callback to resetState
     resetState(
         elements, state,
         resetCallbacks.updateTiling,
         resetCallbacks.updateEffects,
         resetCallbacks.updateSliders,
         resetCallbacks.clearHistory // << Pass the function
     );

     // Ensure contexts are valid
     if (!state.ctx && elements.sourceEffectCanvas) {
         state.ctx = elements.sourceEffectCanvas.getContext('2d', { willReadFrequently: true });
         if (!state.sourceEffectCtx) state.sourceEffectCtx = state.ctx; // Keep alias if needed
     }
     if (!state.ctx) {
          console.error("initializeApp: Failed to get sourceEffectCtx/ctx!");
          showMessage("Initialization Error: Cannot get canvas context.", true, elements.messageBox);
     }

     setupEventListeners();
     updateUndoRedoButtons(elements, state); // Initial button state
     console.log("Image Tiler Initialized with Sequential Effects & History");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
