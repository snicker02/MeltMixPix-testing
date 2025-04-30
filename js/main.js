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

function redrawSourceCanvasWithEffect() {
    console.log('[MainApp] redrawSourceCanvasWithEffect called.');
    // Add checks for elements/state existence since they are populated later
    if (!state.currentImage || !elements.sourceEffectCanvas || !state.sourceEffectCtx || !state.originalWidth || !state.originalHeight) {
         console.error("redrawSourceCanvasWithEffect: Missing prerequisites.");
         return false;
    }
    // ... (rest of function remains the same) ...
    const canvas = elements.sourceEffectCanvas;
    const ctx = state.sourceEffectCtx;
    if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
        canvas.width = state.originalWidth;
        canvas.height = state.originalHeight;
    }
     if (canvas.width === 0 || canvas.height === 0) {
        console.error("redrawSourceCanvasWithEffect: Canvas dimensions are zero.");
        return false;
    }
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
        ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
    } catch (e) {
        console.error("redrawSourceCanvasWithEffect: Error drawing source image:", e);
        showMessage("Error drawing source region.", true, elements.messageBox);
        return false;
     }
     const baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];
    if (effectFunction) {
        console.log(`  Applying effect: ${effect} with params:`, params);
        try {
            const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const effectContext = { sourceImageData: baseImageData };
            effectFunction(currentImageData, params, effectContext);
            ctx.putImageData(currentImageData, 0, 0);
            console.log(`  Effect ${effect} applied.`);
        } catch (e) {
             console.error(`redrawSourceCanvasWithEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             return false;
        }
    } else { console.log("  No effect selected ('none'). Canvas shows panned/zoomed original."); }
    return true;
}

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
        if (state.currentImage && !state.isProcessing && elements.sourceEffectCanvas) {
             console.log('[MainApp] Prerequisites met.');
             if (redrawSourceCanvasWithEffect()) {
                 console.log('[MainApp] Source canvas redrawn, calling processAndPreviewImage.');
                 processAndPreviewImage(
                     elements.sourceEffectCanvas, elements, state,
                     (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
                 );
             } else { console.error("[MainApp] Full update failed: Could not redraw source canvas."); }
        } else {
             console.warn("[MainApp] Full update skipped: Missing prerequisites.");
             if(!state.currentImage) console.log(" Skipped reason: No current image.");
             else if(state.isProcessing) console.log(" Skipped reason: Already processing.");
             else console.log(" Skipped reason: Canvas issue?");
        }
    }, 150);
}

// --- Event Handlers ---

function handleApplyEffectClick() {
    console.log('[MainApp] Apply Pre-Effect button clicked.');
     // Add checks
    if (!state.currentImage || !state.sourceEffectCtx || !state.ctx || state.isProcessing) {
        console.warn('[MainApp] Apply skipped: Prerequisites not met.');
        showMessage("Cannot apply effect now (no image or processing).", true, elements.messageBox);
        return;
    }
    const { effect } = getCurrentEffectAndParams();
    // if (effect === 'none') { // Allow applying 'none' to reset? Maybe not useful yet.
    //     showMessage("Select an effect first before applying.", true, elements.messageBox);
    //     return;
    // }
    if (!redrawSourceCanvasWithEffect()) {
         showMessage("Could not apply effect due to processing error.", true, elements.messageBox);
         return;
    }
     const imageDataToSave = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
    pushHistoryState(imageDataToSave, state, updateUndoRedoButtons, elements);
    showMessage(`Effect "${effect || 'None'}" applied to history.`, false, elements.messageBox);
}

function handleUndoClick() {
    console.log('[MainApp] Undo button clicked.');
    if (!state.ctx) return; // Add check
    historyUndo(state, updateUndoRedoButtons, elements);
    if (!elements.sourceEffectCanvas) return; // Add check
    processAndPreviewImage(elements.sourceEffectCanvas, elements, state, (msg, isErr) => showMessage(msg, isErr, elements.messageBox));
}

function handleRedoClick() {
    console.log('[MainApp] Redo button clicked.');
     if (!state.ctx) return; // Add check
    historyRedo(state, updateUndoRedoButtons, elements);
    if (!elements.sourceEffectCanvas) return; // Add check
    processAndPreviewImage(elements.sourceEffectCanvas, elements, state, (msg, isErr) => showMessage(msg, isErr, elements.messageBox));
}

function getCurrentEffectAndParams() {
    // Add checks for elements
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
    // Update value spans (unchanged)
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    requestFullUpdate();
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    console.log(`[MainApp] Option change detected on element ID: ${target.id}, Name: ${target.name}`);
    if (target.name === 'tileShape' || target.name === 'mirrorOption') {
        if(target.name === 'tileShape' && elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange); // Check elements exist
        requestFullUpdate();
    } else if (target.id === 'preEffectSelector' || target.closest('#preEffectOptionsContainer')) {
         if(target.id === 'preEffectSelector' && elements.preEffectSelector) updatePreEffectControlsVisibility(elements); // Check elements exist
        requestFullUpdate();
    } else { console.log("[MainApp] Unhandled option change target:", target); }
}

function handleImageLoad(event) {
    console.log("handleImageLoad: Function triggered.");
    // Check if elements object is populated before defining resetFunc that uses it
    if (!elements.messageBox) { // Check a key element
         console.error("handleImageLoad cannot run before elements are defined.");
         return;
    }
    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        () => clearHistory(state, updateUndoRedoButtons, elements)
    );
    const file = event.target.files?.[0];
    if (!file) { /*...*/ resetFunc(); return; }
    if (!file.type.startsWith('image/')) { /*...*/ resetFunc(); return; }
    state.originalFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img;
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            if (!state.originalWidth || !state.originalHeight) { /*...*/ resetFunc(); return; }
            // Update UI elements (check existence)
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
                if (!elements.sourceEffectCanvas || !state.sourceEffectCtx) {
                    console.error("Cannot initialize state - sourceEffectCanvas context missing.");
                    showMessage("Error: Cannot access drawing canvas.", true, elements.messageBox);
                    resetFunc(); return;
                }
                 // Update visual transform
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state);
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;

                // Initialize sourceEffectCanvas and History
                elements.sourceEffectCanvas.width = state.originalWidth;
                elements.sourceEffectCanvas.height = state.originalHeight;
                if (redrawSourceCanvasWithEffect()) {
                    try {
                         state.originalImageData = state.sourceEffectCtx.getImageData(0, 0, state.originalWidth, state.originalHeight);
                         clearHistory(state, updateUndoRedoButtons, elements);
                         pushHistoryState(state.originalImageData, state, updateUndoRedoButtons, elements);
                    } catch(histError) { /* ... error handling ... */ resetFunc(); return; }
                } else { /* ... error handling ... */ resetFunc(); return; }

                // Enable controls (check existence)
                if(elements.saveButton) elements.saveButton.disabled = false;
                if(elements.applyEffectButton) elements.applyEffectButton.disabled = false;
                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                elements.selects?.forEach(s => { if(s) s.disabled = false; }); // Enables effect selector here
                if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
                console.log("handleImageLoad: Controls enabled.");
                if (elements.preEffectSelector) console.log(` Effect selector disabled state: ${elements.preEffectSelector.disabled}`);

                updateTilingControlsVisibility(elements, handleSliderChange);
                updatePreEffectControlsVisibility(elements);
                requestFullUpdate();
                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox);
            });
        };
        img.onerror = () => { /* ... */ resetFunc(); };
        img.src = e.target.result;
    };
    reader.onerror = () => { /* ... */ resetFunc(); };
    reader.readAsDataURL(file);
}

function saveImage() { /* ... remains the same ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("setupEventListeners: Attaching listeners..."); // Add log
    // Check elements exist before adding listeners
    elements.imageLoader?.addEventListener('change', handleImageLoad);
    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });
    elements.preEffectSelector?.addEventListener('change', (event) => { console.log(`[MainApp] Effect selector changed to: ${event.target.value}`); handleOptionChange(event); });
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°');
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange);
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate);
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate);
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);

    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider, elements.sourceZoomValueSpan,
             () => {
                 console.log('[MainApp] Zoom slider input. Updating transform and requesting full update.');
                 handleSourceZoom(elements, state, () => updateSourcePreviewTransform(elements, state));
                 requestFullUpdate();
             },
             val => parseFloat(val).toFixed(1)
         );
    }
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { if (elements.keepAspectRatioCheckbox?.checked && state.currentImage) { handleDimensionChange({ target: elements.outputWidthInput }, elements, state); } });

    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => { startPan(e, elements, state); });
         document.addEventListener('mousemove', (e) => { if (state.isDragging) { panMove( e, elements, state, () => updateSourcePreviewTransform(elements, state) ); } });
         const endPanHandler = () => { if (state.isDragging) { console.log('[MainApp] Pan ended. Requesting full update.'); endPan(elements, state, requestFullUpdate); } };
         document.addEventListener('mouseup', endPanHandler);
         document.addEventListener('mouseleave', endPanHandler);
     }
     console.log("setupEventListeners: Finished attaching listeners.");
}


// --- Initial Application State ---
function initializeApp() {
     console.log("[MainApp] Initializing application...");

     // --- Move elements object population here ---
      elements = {
         imageLoader: document.getElementById('imageLoader'),
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
         saveButton: document.getElementById('saveButton'),
         applyEffectButton: document.getElementById('applyEffectButton'),
         undoButton: document.getElementById('undoButton'),
         redoButton: document.getElementById('redoButton'),
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
         // Group sliders/selects
         sliders: [], // Will be populated below
         selects: []  // Will be populated below
     };
      // Populate grouped sliders/selects
     elements.sliders = [
         elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider,
         elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider,
         elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider,
         elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider,
         elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider
     ].filter(el => el !== null); // Filter out nulls if elements not found

     elements.selects = [
        elements.preEffectSelector, elements.preEffectWaveDirection, elements.preEffectWaveType,
        elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
     ].filter(el => el !== null); // Filter out nulls

     // --- Initialize State Object ---
     // Must happen AFTER elements are defined
     state = {
         currentImage: null,
         originalImageData: null,
         originalFileName: 'downloaded-image.png',
         originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
         isProcessing: false, debounceTimer: null, isDragging: false,
         dragStartX: 0, dragStartY: 0,
         currentOffsetX: 0, currentOffsetY: 0,
         startOffsetX: 0, startOffsetY: 0,
         sourceZoomLevel: 1.0,
         sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }),
         history: [],
         historyIndex: -1,
         ctx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true })
     };


     // --- Now call reset and setup ---
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
     if (!state.ctx) {
          console.error("initializeApp: Failed to get sourceEffectCtx/ctx!");
          showMessage("Initialization Error: Cannot get canvas context.", true, elements.messageBox); // Check if messageBox was found
     } else {
          console.log("[MainApp] Canvas context acquired successfully.");
     }

     setupEventListeners();
     updateUndoRedoButtons(elements, state); // Initial button state
     console.log("Image Tiler Initialized with Sequential Effects & History");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
