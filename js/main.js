// js/main.js (TEMPORARY TEST: Commented out slider/select grouping)

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetUIState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener, updateUndoRedoButtons
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
import * as stateManager from './stateManager.js';

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


// --- Global Scope ---
let elements = {};
let sourceEffectCtx = null;

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
function redrawSourceCanvasWithEffect() { /* ... remains the same (STACKING version) ... */ }
function requestFullUpdate() { /* ... remains the same (Pan/Zoom Fix version + canvas logs) ... */ }

// --- Event Handlers ---
function updateHistoryButtonsUI() { /* ... remains the same ... */ }
function handleApplyEffectClick() { /* ... remains the same ... */ }
function handleUndoClick() { /* ... remains the same ... */ }
function handleRedoClick() { /* ... remains the same ... */ }
function getCurrentEffectAndParams() { /* ... remains the same ... */ }
function handleSliderChange() { /* ... remains the same ... */ }
function handleOptionChange(event) { /* ... remains the same ... */ }
function handleImageLoad(event) { /* ... remains the same ... */ }
function saveImage() { /* ... remains the same ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() { /* ... remains the same ... */ }


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] initializeApp - START"); // Log 1

     // --- Populate the 'elements' object ---
      try {
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
                mirrorCanvas: document.getElementById('mirrorCanvas'),
                preTileCanvas: document.getElementById('preTileCanvas'),
                canvas: document.getElementById('imageCanvas'),
                sourceEffectCanvas: document.getElementById('sourceEffectCanvas'),

                // History Buttons
                applyEffectButton: document.getElementById('applyEffectButton'),
                undoButton: document.getElementById('undoButton'),
                redoButton: document.getElementById('redoButton'),

                // Source Zoom
                sourceZoomSlider: document.getElementById('sourceZoom'),
                sourceZoomValueSpan: document.getElementById('sourceZoomValue'),

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

                // Debug Slider Elements
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

                // Advanced Toggle Elements
                showAdvancedTilingToggle: document.getElementById('showAdvancedTilingToggle'),
                advancedTilingOptions: document.getElementById('advancedTilingOptions'),

                // Groups (initialized below)
                sliders: [],
                selects: []
            };
            console.log(" initializeApp: Elements object populated."); // Log 2

            // --- Populate grouped sliders/selects arrays ---
            console.log(" initializeApp: Grouping sliders..."); // Log 3

            // <<< TEMPORARILY COMMENT OUT slider grouping >>>
            /*
            elements.sliders = [
                elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider,
                elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider,
                elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider,
                elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider,
                elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider,
                // Add the new ones
                elements.sqTriYStartMultSlider, elements.sqTriYEndMultSlider, elements.sqTriStartColSlider, // Comma is here
                elements.sqTriColBufferSlider, elements.sqTriStaggerRatioSlider, elements.sqTriCenterRatioSlider
            ].filter(el => el !== null);
            */
            // <<< END TEMPORARY COMMENT OUT >>>

            console.log(" initializeApp: Sliders grouping SKIPPED (temporary test)."); // Temp Log 4

            console.log(" initializeApp: Grouping selects..."); // Log 5

            // <<< TEMPORARILY COMMENT OUT select grouping >>>
            /*
            elements.selects = [
                elements.preEffectSelector, elements.preEffectWaveDirection, elements.preEffectWaveType,
                elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy
            ].filter(el => el !== null);
            */
           // <<< END TEMPORARY COMMENT OUT >>>

            console.log(" initializeApp: Selects grouping SKIPPED (temporary test)."); // Temp Log 6

            // Use optional chaining ?.length for safety if arrays are commented out
            console.log(` initializeApp: Grouped ${elements.sliders?.length || 0} sliders and ${elements.selects?.length || 0} selects.`); // Log 7


            // --- Get initial context ---
            console.log(" initializeApp: Getting sourceEffectCtx..."); // Log 8
            sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true });
            if (!sourceEffectCtx) {
                console.error(" initializeApp: CRITICAL - Failed to get context for sourceEffectCanvas! Cannot proceed.");
                if (elements.messageBox) showMessage("Initialization Error: Cannot get canvas context. Please refresh.", true, elements.messageBox);
                return; // Stop initialization
            }
            console.log(" initializeApp: sourceEffectCtx obtained."); // Log 9

            // --- Reset State and UI ---
            console.log(" initializeApp: Resetting stateManager data..."); // Log 10
            stateManager.resetStateData();
            console.log(" initializeApp: stateManager data reset."); // Log 11

            console.log(" initializeApp: Resetting UI..."); // Log 12
            // Note: resetUIState uses elements.sliders/selects internally, if they are null/empty due to commenting out,
            // it might log warnings but shouldn't crash if it uses null checks (?.forEach).
            resetUIState(elements,
                () => updateTilingControlsVisibility(elements, handleSliderChange),
                () => updatePreEffectControlsVisibility(elements),
                handleSliderChange,
                updateHistoryButtonsUI // Pass button update function directly
            );
            console.log(" initializeApp: UI reset complete."); // Log 13

            // --- Setup Event Listeners ---
            console.log(" initializeApp: Setting up event listeners..."); // Log 14
            // Note: setupEventListeners uses elements.sliders/selects, if they are null/empty,
            // the .forEach loops will simply do nothing.
            setupEventListeners();
            console.log(" initializeApp: Event listeners setup complete.");// Log 15


            // --- Final Initial UI State ---
            updateHistoryButtonsUI();
            showMessage("Load an image to begin.", false, elements.messageBox);
            console.log("[MainApp] initializeApp - END"); // Log 16

        } catch (error) {
             console.error("***** CRITICAL ERROR DURING INITIALIZEAPP *****", error);
             showMessage("Initialization failed critically. Check console.", true, elements.messageBox || null);
        }
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
