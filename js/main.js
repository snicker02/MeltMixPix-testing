// js/main.js (Added advanced toggle logic)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetUIState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener, updateUndoRedoButtons
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
import * as stateManager from './stateManager.js';

// --- Effect Imports ---
// ... (effect imports remain the same) ...
import { applySierpinski } from './effects/sierpinski.js';


// --- Global Scope ---
let elements = {};
let sourceEffectCtx = null;

 // --- Effect Function Map ---
 const effectFunctions = { /* ... remains the same ... */ };

// --- Core Processing Functions ---
function redrawSourceCanvasWithEffect() { /* ... remains the same (STACKING version) ... */ }
function requestFullUpdate() { /* ... remains the same (Pan/Zoom Fix version + canvas logs) ... */ }

// --- Event Handlers ---
function updateHistoryButtonsUI() { /* ... remains the same ... */ }
function handleApplyEffectClick() { /* ... remains the same ... */ }
function handleUndoClick() { /* ... remains the same ... */ }
function handleRedoClick() { /* ... remains the same ... */ }
function getCurrentEffectAndParams() { /* ... remains the same ... */ }
function handleSliderChange() { /* ... remains the same (updates spans including debug ones) ... */ }
function handleOptionChange(event) { /* ... remains the same ... */ }
function handleImageLoad(event) { /* ... remains the same ... */ }
function saveImage() { /* ... remains the same ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners - START");
    if (!elements.imageLoader) { return; }

    // console.log(" setupEventListeners: Attaching 'change' listener to elements.imageLoader:", elements.imageLoader);
    elements.imageLoader.addEventListener('change', handleImageLoad);
    // console.log(" setupEventListeners: 'change' listener attached to imageLoader.");


    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);

    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));

    // Main Tiling Sliders
    const tilingSliders = [ /* ... */ ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });

    // Pre-Effect Controls
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);
    // ... (setupSliderListener for pre-effect sliders) ...
    const effectSelects = [ /* ... */ ];
    effectSelects.forEach(select => { if(select) select.addEventListener('change', handleOptionChange); });


    // Debug Sliders (Square/Triangle)
    setupSliderListener(elements.sqTriYStartMultSlider, elements.sqTriYStartMultValue, requestFullUpdate, val => parseFloat(val).toFixed(1));
    setupSliderListener(elements.sqTriYEndMultSlider, elements.sqTriYEndMultValue, requestFullUpdate, val => parseFloat(val).toFixed(1));
    setupSliderListener(elements.sqTriStartColSlider, elements.sqTriStartColValue, requestFullUpdate);
    setupSliderListener(elements.sqTriColBufferSlider, elements.sqTriColBufferValue, requestFullUpdate);
    setupSliderListener(elements.sqTriStaggerRatioSlider, elements.sqTriStaggerRatioValue, requestFullUpdate, val => parseFloat(val).toFixed(2));
    setupSliderListener(elements.sqTriCenterRatioSlider, elements.sqTriCenterRatioValue, requestFullUpdate, val => parseFloat(val).toFixed(2));

    // <<< ADDED: Listener for Advanced Settings Toggle >>>
    elements.showAdvancedTilingToggle?.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        console.log(`[MainApp] Advanced tiling toggle changed: ${isChecked}`);
        elements.advancedTilingOptions?.classList.toggle('hidden', !isChecked);
        // We don't necessarily need to trigger a redraw here unless
        // showing/hiding affects layout significantly or default values change.
        // Toggling visibility is usually sufficient.
    });


    // Source Zoom - uses stateManager
    if (elements.sourceZoomSlider) { /* ... remains the same ... */ }

    // Output Dimensions - uses stateManager
    const dimensionChangeHandler = (e) => { /* ... remains the same ... */ };
    elements.outputWidthInput?.addEventListener('input', dimensionChangeHandler);
    elements.outputHeightInput?.addEventListener('input', dimensionChangeHandler);
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { /* ... remains the same ... */ });

    // Panning Listeners - uses stateManager
    if (elements.sourcePreviewContainer) { /* ... remains the same ... */ }
     console.log("[MainApp] setupEventListeners - END");
}


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] initializeApp - START");

     // --- Populate the 'elements' object ---
      elements = {
         // ... (all previous element assignments remain the same) ...
         squareTriangleControls: document.getElementById('squareTriangleControls'),
         sqTriYStartMultSlider: document.getElementById('sqTriYStartMult'),
         sqTriYStartMultValue: document.getElementById('sqTriYStartMultValue'),
         sqTriYEndMultSlider: document.getElementById('sqTriYEndMult'),
         sqTriYEndMultValue: document.getElementById('sqTriYEndMultValue'),
         sqTriStartColSlider: document.getElementById('sqTriStartCol'),
         sqTriStartColValue: document.getElementById('sqTriStartColValue'),
         sqTriColBufferSlider: document.getElementById('sqTriColBuffer'),
         sqTriColBufferValue: document.getElementById('sqTriColBufferValue'),
         sqTriStaggerRatioSlider: document.getElementById('sqTriStaggerRatio'),
         sqTriStaggerRatioValue: document.getElementById('sqTriStaggerRatioValue'),
         sqTriCenterRatioSlider: document.getElementById('sqTriCenterRatio'),
         sqTriCenterRatioValue: document.getElementById('sqTriCenterRatioValue'),

         // <<< ADDED Advanced Toggle Elements >>>
         showAdvancedTilingToggle: document.getElementById('showAdvancedTilingToggle'),
         advancedTilingOptions: document.getElementById('advancedTilingOptions'),

         // sliders: [], // Defined below
         // selects: []  // Defined below
     };
      console.log(" initializeApp: Elements object populated.");

      // Add new sliders to elements.sliders array
      elements.sliders = [
         elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider,
         elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider,
         elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider,
         elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider,
         elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider,
         elements.sqTriYStartMultSlider, elements.sqTriYEndMultSlider, elements.sqTriStartColSlider,
         elements.sqTriColBufferSlider, elements.sqTriStaggerRatioSlider, elements.sqTriCenterRatioSlider
     ].filter(el => el !== null);

     elements.selects = [ /* ... remains the same ... */ ].filter(el => el !== null);
    //  console.log(` initializeApp: Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);

     // --- Get initial context ---
     sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
     if (!sourceEffectCtx) { /* ... error handling ... */ return; }
    //  console.log(" initializeApp: sourceEffectCtx obtained.");

     // --- Reset State and UI ---
     stateManager.resetStateData();
    //  console.log(" initializeApp: stateManager data reset.");
     resetUIState(elements, // Pass the populated elements object
         () => updateTilingControlsVisibility(elements, handleSliderChange),
         () => updatePreEffectControlsVisibility(elements),
         handleSliderChange,
         updateHistoryButtonsUI // Pass button update function directly
     );
    //  console.log(" initializeApp: UI reset complete.");

     // --- Setup Event Listeners ---
     setupEventListeners(); // Uses stateManager internally now

     // --- Final Initial UI State ---
     updateHistoryButtonsUI();
    //  console.log(" initializeApp: Image Tiler Initialized and ready.");
     showMessage("Load an image to begin.", false, elements.messageBox);
     console.log("[MainApp] initializeApp - END");
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
