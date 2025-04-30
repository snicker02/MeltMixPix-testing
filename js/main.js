// js/main.js (Added Diagnostic Logs in initializeApp)

// --- Utility Imports ---
// ... (imports remain the same) ...
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
import {
    updateUndoRedoButtons, clearHistory as clearHistoryState,
} from './utils/historyUtils.js'; // Keep history imports if needed

// --- Effect Imports ---
// ... (imports remain the same) ...
import { applyNoise } from './effects/noise.js';
// ... etc ...
import { applySierpinski } from './effects/sierpinski.js';


// --- Global Scope: Define elements and state placeholders ---
let elements = {};
let state = {};

 // --- Effect Function Map ---
 const effectFunctions = { /* ... */ };

// --- Core Processing Functions ---
// ... (redrawSourceCanvasWithEffect, requestFullUpdate - remain the same from previous step) ...
function redrawSourceCanvasWithEffect() { /* ... */ }
function requestFullUpdate() { /* ... */ }

// --- Event Handlers ---
// ... (handleApplyEffectClick, handleUndoClick, handleRedoClick - remain the same) ...
function handleApplyEffectClick() { /* ... */ }
function handleUndoClick() { /* ... */ }
function handleRedoClick() { /* ... */ }
// ... (getCurrentEffectAndParams, handleSliderChange, handleOptionChange - remain the same) ...
function getCurrentEffectAndParams() { /* ... */ }
function handleSliderChange() { /* ... */ }
function handleOptionChange(event) { /* ... */ }
// ... (handleImageLoad, saveImage - remain the same) ...
function handleImageLoad(event) { /* ... */ }
function saveImage() { /* ... */ }

// --- Event Listeners Setup ---
// ... (remains the same from previous step) ...
function setupEventListeners() { /* ... */ }


// --- Initial Application State ---
function initializeApp() {
     console.log("[MainApp] Initializing application...");

     // --- Populate elements object ---
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
         messageBox: document.getElementById('messageBox'), // <<< Critical check
         tileShapeOptions: document.querySelectorAll('input[name="tileShape"]'),
         mirrorOptions: document.querySelectorAll('input[name="mirrorOption"]'),
         tilesXSlider: document.getElementById('tilesX'), // <<< Check
         tilesYSlider: document.getElementById('tilesY'),
         skewSlider: document.getElementById('skewFactor'),
         staggerSlider: document.getElementById('staggerOffset'),
         scaleSlider: document.getElementById('tileScale'),
         preTileXSlider: document.getElementById('preTileX'),
         preTileYSlider: document.getElementById('preTileY'),
         sourceZoomSlider: document.getElementById('sourceZoom'), // <<< Check
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
         skewControl: document.getElementById('skewControl'), // <<< Check
         staggerControl: document.getElementById('staggerControl'),
         tilesXLabel: document.getElementById('tilesXLabel'), // <<< Check
         tilesYLabel: document.getElementById('tilesYLabel'),
         scaleLabel: document.getElementById('scaleLabel'),
         tilesXYHelpText: document.getElementById('tilesXYHelpText'),
         preEffectSelector: document.getElementById('preEffectSelector'), // <<< Check
         preEffectOptionsContainer: document.getElementById('preEffectOptionsContainer'),
         preEffectIntensityControl: document.getElementById('preEffectIntensityControl'), // <<< Check
         preEffectIntensitySlider: document.getElementById('preEffectIntensitySlider'), // <<< Check
         preEffectIntensityValue: document.getElementById('preEffectIntensityValue'),
         preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'), // <<< Check
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
         sliders: [],
         selects: []
     };

     // +++ DIAGNOSTIC LOGS START +++
     console.log("[Init Check] Checking critical elements:");
     console.log(`  messageBox found: ${elements.messageBox !== null}`);
     console.log(`  sourceEffectCanvas found: ${elements.sourceEffectCanvas !== null}`);
     console.log(`  tilesXSlider found: ${elements.tilesXSlider !== null}`);
     console.log(`  sourceZoomSlider found: ${elements.sourceZoomSlider !== null}`);
     console.log(`  skewControl found: ${elements.skewControl !== null}`);
     console.log(`  tilesXLabel found: ${elements.tilesXLabel !== null}`);
     console.log(`  preEffectSelector found: ${elements.preEffectSelector !== null}`);
     console.log(`  preEffectIntensityControl found: ${elements.preEffectIntensityControl !== null}`);
     console.log(`  preEffectIntensitySlider found: ${elements.preEffectIntensitySlider !== null}`);
     console.log(`  preEffectWaveDistortionOptions found: ${elements.preEffectWaveDistortionOptions !== null}`);
     // +++ DIAGNOSTIC LOGS END +++


      // Populate grouped sliders/selects based on potentially null values above
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

     // Initialize State Object AFTER elements are defined
     state = {
         // ... (state properties) ...
         sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }), // Try getting context here
         history: [], historyIndex: -1,
         ctx: null // Will be set below if sourceEffectCtx is valid
     };
     // Assign ctx alias only if sourceEffectCtx was successful
      if (state.sourceEffectCtx) {
           state.ctx = state.sourceEffectCtx;
           console.log("[MainApp] Canvas context acquired successfully via state init.");
      } else {
          console.error("initializeApp: Failed to get sourceEffectCtx during state init!");
           // Try getting context again directly JUST IN CASE elements object was the issue
          const canvasEl = document.getElementById('sourceEffectCanvas');
          if (canvasEl) {
              state.ctx = canvasEl.getContext('2d', { willReadFrequently: true });
              if (state.ctx) {
                  state.sourceEffectCtx = state.ctx;
                   console.log("[MainApp] Canvas context acquired successfully via direct getElementById.");
              } else {
                  console.error("initializeApp: Failed to get context via direct getElementById too!");
              }
          } else {
               console.error("initializeApp: sourceEffectCanvas element truly not found.");
          }
      }

     // Define reset callbacks AFTER state and elements are potentially defined
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange,
         clearHistory: () => { state.history = []; state.historyIndex = -1; if(elements.undoButton) updateUndoRedoButtons(elements, state); } // Add element check
     };

     // Call resetState AFTER callbacks are defined
     resetState(
         elements, state,
         resetCallbacks.updateTiling, resetCallbacks.updateEffects,
         resetCallbacks.updateSliders, resetCallbacks.clearHistory
     );

     // Final check before setup
     if (!state.ctx) {
          // Show message only if messageBox exists
          if (elements.messageBox) {
               showMessage("Initialization Error: Cannot get canvas context. Cannot proceed.", true, elements.messageBox);
          } else {
               alert("CRITICAL ERROR: Cannot get canvas context AND cannot find message box.");
          }
          return; // Prevent setup if context failed
     }

     setupEventListeners(); // Setup listeners AFTER elements/state are ready
     updateUndoRedoButtons(elements, state); // Initial button state
     console.log("Image Tiler Initialized with Sequential Effects & History");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
