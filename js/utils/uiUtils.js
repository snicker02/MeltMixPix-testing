// js/utils/uiUtils.js (Added reset for advanced toggle)

console.log('[uiUtils] Module loading...');

const drawingPreEffects = ['fractalZoom', 'pixelSort', 'sierpinski'];

export function showMessage(message, isError = false, messageBox) { /* ... remains the same ... */ }

/**
 * Updates the visibility and labels of TILING controls based on the selected tile shape.
 * Includes showing/hiding squareTriangleControls container.
 */
export function updateTilingControlsVisibility(elements, handleSliderChangeFunc) {
    const {
        // ... (previous elements) ...
        squareTriangleControls, // Container for sq/tri sliders
        // <<< NO NEED to reference advancedTilingOptions here >>>
    } = elements;

    if (!elements.tileShapeOptions || /* ... other checks ... */ || !squareTriangleControls) {
        console.warn("[uiUtils.updateTilingControlsVisibility] Missing one or more required tiling control elements.");
        return;
    }

    const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';

    // Hide optional controls initially
    elements.skewControl?.classList.add('hidden-control');
    elements.staggerControl?.classList.add('hidden-control');
    elements.tilesXYHelpText?.classList.add('hidden-control');
    squareTriangleControls.classList.add('hidden-control'); // Hide pattern-specific controls

    let defaultScale = 1.0; /* ... */
    let scaleLabelText = 'Shape Scale'; /* ... */
    let xLabel = 'Tiles X'; /* ... */
    let yLabel = 'Tiles Y'; /* ... */
    let showHelpText = false; /* ... */

    switch (selectedShape) {
        // ... (cases for other shapes remain the same) ...
        case 'square_triangle':
            xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true;
            squareTriangleControls.classList.remove('hidden-control'); // Show pattern-specific controls
            console.log('[uiUtils.updateTilingControlsVisibility] Showing Square/Triangle debug controls container.');
            break;
        // ... (default case) ...
    }

    // ... (rest of the function remains the same) ...

    if (typeof handleSliderChangeFunc === 'function') {
        handleSliderChangeFunc();
    }
}


export function updatePreEffectControlsVisibility(elements) { /* ... remains the same ... */ }
export function updateSourcePreviewTransform(elements, currentState) { /* ... remains the same ... */ }
export function handleDimensionChange(event, elements, aspectRatio) { /* ... remains the same ... */ }

/**
 * Resets UI elements to their initial (unloaded) state.
 * ADDED: Resets advanced toggle state.
 */
export function resetUIState(
    elements,
    updateTilingControlsVisibilityFunc, updatePreEffectControlsVisibilityFunc, handleSliderChangeFunc,
    updateHistoryButtonsFunc
) {
    console.log('[uiUtils.resetUIState] Resetting UI elements...');
    const {
        // ... (all previous element assignments) ...
        sqTriYStartMultSlider, sqTriYEndMultSlider, sqTriStartColSlider, /* ...etc */
        sqTriYStartMultValue, sqTriYEndMultValue, sqTriStartColValue, /* ...etc */

        // <<< ADDED Advanced Toggle Elements >>>
        showAdvancedTilingToggle,
        advancedTilingOptions

    } = elements;

    // --- Reset UI Elements Values/Visibility/Disabled State ---
    // ... (reset imageLoader, previews, buttons, standard sliders, effect controls) ...

    // Reset Debug Sliders to Default Values
    if (sqTriYStartMultSlider) sqTriYStartMultSlider.value = 1.5;
    if (sqTriYEndMultSlider) sqTriYEndMultSlider.value = 2.0;
    if (sqTriStartColSlider) sqTriStartColSlider.value = -2;
    if (sqTriColBufferSlider) sqTriColBufferSlider.value = 4;
    if (sqTriStaggerRatioSlider) sqTriStaggerRatioSlider.value = 0.5;
    if (sqTriCenterRatioSlider) sqTriCenterRatioSlider.value = 0.5;
    // Reset corresponding value displays
    if (sqTriYStartMultValue) sqTriYStartMultValue.textContent = '1.5';
    if (sqTriYEndMultValue) sqTriYEndMultValue.textContent = '2.0';
    if (sqTriStartColValue) sqTriStartColValue.textContent = '-2';
    if (sqTriColBufferValue) sqTriColBufferValue.textContent = '4';
    if (sqTriStaggerRatioValue) sqTriStaggerRatioValue.textContent = '0.50';
    if (sqTriCenterRatioValue) sqTriCenterRatioValue.textContent = '0.50';

    // <<< ADDED: Reset Advanced Toggle State >>>
    if (showAdvancedTilingToggle) showAdvancedTilingToggle.checked = false;
    if (advancedTilingOptions) advancedTilingOptions.classList.add('hidden');
    // <<< END Reset >>>


    // Clear Canvases
    // ... (canvas clearing logic) ...

    // Update Button States
    if (typeof updateHistoryButtonsFunc === 'function') { updateHistoryButtonsFunc(); }

    // Update UI Visibility (these will hide the specific controls like squareTriangleControls initially)
    if (typeof updateTilingControlsVisibilityFunc === 'function') { updateTilingControlsVisibilityFunc(); }
    if (typeof updatePreEffectControlsVisibilityFunc === 'function') { updatePreEffectControlsVisibilityFunc(); }
    // Call slider handler to ensure displayed values match reset slider values
    if (typeof handleSliderChangeFunc === 'function') { handleSliderChangeFunc(); }

    console.log('[uiUtils.resetUIState] UI Reset complete.');
}


// --- Panning Logic --- (Simplified helpers)
export function startPan(event, elements) { /* ... remains the same ... */ }
export function panMove(event, startDragX, startDragY, startOffsetX, startOffsetY) { /* ... remains the same ... */ }
export function endPan(elements) { /* ... remains the same ... */ }

// --- Source Zoom Logic --- (Simplified helper)
export function handleSourceZoom(elements, currentStateSnapshot, stateUpdateFunc) { /* ... remains the same ... */ }

// --- Slider Listener Setup --- (No changes needed)
export function setupSliderListener(slider, valueDisplay, callback, formatter = val => val) { /* ... remains the same ... */ }

/**
 * Updates the enabled/disabled state of undo/redo buttons based on history info.
 * @param {object} elements - Object containing references to undoButton and redoButton.
 * @param {object} historyInfo - Object like { index: number, length: number }.
 */
export function updateUndoRedoButtons(elements, historyInfo) { // Accepts historyInfo
    if (elements.undoButton) elements.undoButton.disabled = historyInfo.index <= 0;
    if (elements.redoButton) elements.redoButton.disabled = historyInfo.index >= historyInfo.length - 1;
}


console.log('[uiUtils] Module loaded successfully.');
