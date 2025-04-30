// js/utils/uiUtils.js (Single Effect UI - Includes New Effect Controls)
// VERSION WITH LOGGING ADDED + PAN/ZOOM RENDER FIX

console.log('[uiUtils] Module loading...');

// Effects that might be slow for real-time preview before tiling
const drawingPreEffects = ['fractalZoom', 'pixelSort', 'sierpinski'];

/**
 * Displays a message to the user, optionally styled as an error.
 * @param {string} message - The message text.
 * @param {boolean} [isError=false] - True to style as an error.
 * @param {HTMLElement | null} messageBox - The message box element.
 */
export function showMessage(message, isError = false, messageBox) {
    console.log(`[uiUtils.showMessage] Attempting to show message: "${message}", isError: ${isError}`); //
    if (!messageBox) { //
        console.warn('[uiUtils.showMessage] MessageBox element not provided or found.'); //
        return; //
    }
    messageBox.textContent = message; //
    const messageClass = `mt-4 text-center font-medium h-6 ${isError ? 'text-red-600' : 'text-green-600'}`; //
    messageBox.className = messageClass; // Use className for simplicity here //
    messageBox.classList.remove('hidden'); //
    console.log(`[uiUtils.showMessage] Message displayed. Class set to: "${messageClass}"`); //

    // Set timeout to hide the message
    setTimeout(() => { //
        // Check if the message is still the one we set, to avoid hiding a newer message
        if (messageBox.textContent === message) { //
            console.log(`[uiUtils.showMessage] Hiding message via timeout: "${message}"`); //
            messageBox.classList.add('hidden'); //
            messageBox.textContent = ''; //
        } else {
             console.log(`[uiUtils.showMessage] Timeout expired, but message content changed. Not hiding.`); //
        }
    }, 5000); //
}

/**
 * Updates the visibility and labels of TILING controls based on the selected tile shape.
 * @param {object} elements - Object containing references to UI elements.
 * @param {Function} [handleSliderChangeFunc] - Optional: Function to call after updating visibility.
 */
export function updateTilingControlsVisibility(elements, handleSliderChangeFunc) {
    console.log('[uiUtils.updateTilingControlsVisibility] Updating tiling controls...'); //
    const {
        tileShapeOptions, skewControl, staggerControl, tilesXLabel, tilesYLabel,
        scaleLabel, scaleSlider, scaleValueSpan, tilesXYHelpText
    } = elements; //

    // Original check for missing elements - retained
    if (!tileShapeOptions || !skewControl || !staggerControl || !tilesXLabel || !tilesYLabel || !scaleLabel || !scaleSlider || !scaleValueSpan || !tilesXYHelpText) { //
        console.warn("[uiUtils.updateTilingControlsVisibility] Missing one or more required tiling control elements for visibility update."); //
        return; //
    }

    const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid'; //
    console.log(`[uiUtils.updateTilingControlsVisibility] Selected tile shape: ${selectedShape}`); //

    // Hide potentially visible controls first
    skewControl.classList.add('hidden-control'); //
    staggerControl.classList.add('hidden-control'); //
    tilesXYHelpText.classList.add('hidden-control'); //

    let defaultScale = 1.0; //
    let scaleLabelText = 'Shape Scale'; //
    let xLabel = 'Tiles X'; //
    let yLabel = 'Tiles Y'; //
    let showHelpText = false; //

    switch (selectedShape) { //
        case 'grid': //
        case 'brick_wall': //
            scaleLabelText = 'Tile Scale'; //
            break; //
        case 'herringbone': //
        case 'basketweave': //
            xLabel = 'Planks X'; //
            yLabel = 'Planks Y'; //
            scaleLabelText = 'Plank Scale'; //
            break; //
        case 'skewed': //
            skewControl.classList.remove('hidden-control'); //
            staggerControl.classList.remove('hidden-control'); //
            scaleLabelText = 'Overlap Scale'; //
            defaultScale = 1.05; //
            console.log('[uiUtils.updateTilingControlsVisibility] Showing Skew and Stagger controls.'); //
            break; //
        case 'hexagon': //
            xLabel = 'Approx Tiles X'; //
            yLabel = 'Approx Tiles Y'; //
            scaleLabelText = 'Hexagon Scale'; //
            showHelpText = true; //
            break; //
        case 'semi_octagon_square': //
            xLabel = 'Approx Tiles X'; //
            yLabel = 'Approx Tiles Y'; //
            scaleLabelText = 'Shape Scale'; //
            showHelpText = true; //
            break; //
        case 'l_shape_square': //
            xLabel = 'Approx Units X'; //
            yLabel = 'Approx Units Y'; //
            scaleLabelText = 'Shape Scale'; //
            showHelpText = true; //
            break; //
        case 'hexagon_triangle': //
            xLabel = 'Approx Hex X'; //
            yLabel = 'Approx Hex Y'; //
            scaleLabelText = 'Shape Scale'; //
            showHelpText = true; //
            break; //
        case 'square_triangle': //
            xLabel = 'Approx Units X'; //
            yLabel = 'Approx Units Y'; //
            scaleLabelText = 'Shape Scale'; //
            showHelpText = true; //
            break; //
        case 'rhombus': //
            xLabel = 'Rhombus Count X'; //
            yLabel = 'Rhombus Count Y'; //
            scaleLabelText = 'Rhombus Scale'; //
            break; //
        default:
             console.warn(`[uiUtils.updateTilingControlsVisibility] Unhandled tile shape: ${selectedShape}`);
    }

    tilesXLabel.textContent = xLabel; //
    tilesYLabel.textContent = yLabel; //
    scaleLabel.textContent = scaleLabelText; //
    console.log(`[uiUtils.updateTilingControlsVisibility] Labels set: X="${xLabel}", Y="${yLabel}", Scale="${scaleLabelText}"`); //

    // Update scale slider value and display if needed
    if (scaleSlider.value !== defaultScale.toString()) { //
        console.log(`[uiUtils.updateTilingControlsVisibility] Resetting scale slider to default: ${defaultScale}`); //
        scaleSlider.value = defaultScale; //
        if (scaleValueSpan) scaleValueSpan.textContent = defaultScale.toFixed(2); //
    } else if (scaleValueSpan) { //
        // Ensure display matches current value even if not reset
        scaleValueSpan.textContent = parseFloat(scaleSlider.value).toFixed(2); //
    }

    // Toggle help text visibility
    const helpTextWasHidden = tilesXYHelpText.classList.contains('hidden-control'); //
    tilesXYHelpText.classList.toggle('hidden-control', !showHelpText); //
    if (helpTextWasHidden === showHelpText) { // Log only if visibility changed
         console.log(`[uiUtils.updateTilingControlsVisibility] Tiles XY Help text visibility set to: ${showHelpText ? 'visible' : 'hidden'}`); //
    }


    // Call slider change handler if provided
    if (typeof handleSliderChangeFunc === 'function') { //
        console.log('[uiUtils.updateTilingControlsVisibility] Calling handleSliderChangeFunc callback.'); //
        handleSliderChangeFunc(); //
    }
    console.log('[uiUtils.updateTilingControlsVisibility] Update complete.'); //
}


/**
 * Updates visibility of PRE-EFFECT controls based on the selected effect.
 * @param {object} elements - Object containing references to pre-effect UI elements.
 */
export function updatePreEffectControlsVisibility(elements) {
    console.log('[uiUtils.updatePreEffectControlsVisibility] Updating pre-effect controls...'); //
    const {
        preEffectSelector, preEffectOptionsContainer, preEffectIntensityControl,
        preEffectIntensitySlider, preEffectIntensityValue, preEffectWaveDistortionOptions,
        preEffectRealtimeWarning,
        // Add new option group elements
        sliceShiftOptions, pixelSortOptions
    } = elements; //

    // Original check retained
    if (!preEffectSelector || !preEffectOptionsContainer || !preEffectIntensityControl || !preEffectWaveDistortionOptions || !preEffectRealtimeWarning || !sliceShiftOptions || !pixelSortOptions) { //
        console.warn("[uiUtils.updatePreEffectControlsVisibility] Missing one or more required pre-effect control elements for visibility update."); //
        return; //
    }

    const selectedEffect = preEffectSelector.value; //
    console.log(`[uiUtils.updatePreEffectControlsVisibility] Selected pre-effect: ${selectedEffect}`); //

    // Hide all specific option groups first
    preEffectOptionsContainer.querySelectorAll('.effect-option-group').forEach(el => el.classList.add('hidden')); //
    preEffectRealtimeWarning.classList.add('hidden'); // Hide warning initially //
    console.log('[uiUtils.updatePreEffectControlsVisibility] Hid all specific effect option groups and realtime warning.'); //

    // Determine which controls to show
    let specificControlsShown = false; //
    if (selectedEffect === 'none') { //
        console.log('[uiUtils.updatePreEffectControlsVisibility] No effect selected, hiding all controls.'); //
        preEffectIntensityControl.classList.add('hidden'); // Ensure intensity is hidden too //
        specificControlsShown = true; // Treat 'none' as having handled controls //
    } else if (selectedEffect === 'waveDistortion') { //
        preEffectWaveDistortionOptions.classList.remove('hidden'); //
        preEffectIntensityControl.classList.add('hidden'); //
        console.log('[uiUtils.updatePreEffectControlsVisibility] Showing Wave Distortion options.'); //
        specificControlsShown = true; //
    } else if (selectedEffect === 'sliceShift') { //
        sliceShiftOptions.classList.remove('hidden'); //
        preEffectIntensityControl.classList.add('hidden'); //
        console.log('[uiUtils.updatePreEffectControlsVisibility] Showing Slice Shift options.'); //
        specificControlsShown = true; //
    } else if (selectedEffect === 'pixelSort') { //
        pixelSortOptions.classList.remove('hidden'); //
        preEffectIntensityControl.classList.add('hidden'); //
        console.log('[uiUtils.updatePreEffectControlsVisibility] Showing Pixel Sort options.'); //
        specificControlsShown = true; //
    }
    // Add else if blocks here for other effects with specific controls

    // Handle generic intensity slider for effects that don't have specific controls
    if (!specificControlsShown) { //
        const usesGenericIntensity = ['channelShift', 'blockDisplace', 'noise', 'invertBlocks', 'sierpinski', 'fractalZoom', 'scanLines']; //
        const showIntensity = usesGenericIntensity.includes(selectedEffect); //
        preEffectIntensityControl.classList.toggle('hidden', !showIntensity); //

        if (showIntensity) { //
            console.log(`[uiUtils.updatePreEffectControlsVisibility] Showing generic intensity slider for effect: ${selectedEffect}`); //
            if (preEffectIntensitySlider) { //
                const intensityLabel = preEffectIntensityControl.querySelector('label'); //
                if (intensityLabel) { //
                    let labelText = 'Intensity:'; //
                    let maxVal = 100; //
                    let minVal = 1; //
                    if (selectedEffect === 'fractalZoom' || selectedEffect === 'sierpinski') { labelText = 'Intensity/Depth:'; maxVal = 100; minVal = 1; } // Max depth can be adjusted //
                    else if (selectedEffect === 'scanLines') { labelText = 'Darkness:'; maxVal = 100; minVal = 0; } // Darkness 0-100% //
                    intensityLabel.textContent = labelText; //
                    preEffectIntensitySlider.max = maxVal; //
                    preEffectIntensitySlider.min = minVal; //
                    console.log(`[uiUtils.updatePreEffectControlsVisibility] Intensity slider label: "${labelText}", Min: ${minVal}, Max: ${maxVal}`); //
                }
                // Ensure current value is within new bounds and update display
                const currentValue = parseFloat(preEffectIntensitySlider.value); //
                const clampedValue = Math.max(parseFloat(preEffectIntensitySlider.min), Math.min(parseFloat(preEffectIntensitySlider.max), currentValue)); //
                 if (currentValue !== clampedValue) { //
                     console.log(`[uiUtils.updatePreEffectControlsVisibility] Clamping intensity slider value from ${currentValue} to ${clampedValue}`); //
                     preEffectIntensitySlider.value = clampedValue; //
                 }
                if (preEffectIntensityValue) preEffectIntensityValue.textContent = preEffectIntensitySlider.value; //
            } else {
                console.warn('[uiUtils.updatePreEffectControlsVisibility] Intensity control is visible but slider element is missing.'); //
            }
        } else {
             console.log(`[uiUtils.updatePreEffectControlsVisibility] Effect "${selectedEffect}" does not use generic intensity slider or has specific controls.`); //
             preEffectIntensityControl.classList.add('hidden'); // Ensure it's hidden if not used //
        }
    }

    // Show warning for potentially slow effects
    if (drawingPreEffects.includes(selectedEffect)) { //
        preEffectRealtimeWarning.classList.remove('hidden'); //
        console.log(`[uiUtils.updatePreEffectControlsVisibility] Showing real-time performance warning for effect: ${selectedEffect}`); //
    }

     console.log('[uiUtils.updatePreEffectControlsVisibility] Update complete.'); //
}

/**
 * Updates the transform (pan/zoom) of the source preview image.
 * @param {object} elements - UI elements including sourcePreview, sourcePreviewContainer.
 * @param {object} state - Application state including sourceZoomLevel, currentOffsetX, currentOffsetY.
 * @returns {{ clampedX: number, clampedY: number }} The clamped offset values.
 */
export function updateSourcePreviewTransform(elements, state) {
    const { sourcePreview, sourcePreviewContainer } = elements; //
    let { sourceZoomLevel = 1.0, currentOffsetX = 0, currentOffsetY = 0 } = state; // Provide defaults for logging robustness //

    console.log(`[uiUtils.updateSourcePreviewTransform] Updating transform. Zoom: ${sourceZoomLevel}, OffsetX: ${currentOffsetX}, OffsetY: ${currentOffsetY}`); //

    if (!sourcePreview || !sourcePreviewContainer) { //
         console.warn('[uiUtils.updateSourcePreviewTransform] Missing sourcePreview or sourcePreviewContainer element.'); //
         if(sourcePreview) sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; // Attempt reset if preview exists //
         return { clampedX: 0, clampedY: 0 }; //
    }
     if (!sourcePreview.naturalWidth || !sourcePreview.naturalHeight) { //
        console.warn('[uiUtils.updateSourcePreviewTransform] Source preview image has zero natural dimensions (likely not loaded). Resetting transform.'); //
        sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; //
        return { clampedX: 0, clampedY: 0 }; //
    }


    const previewWidth = sourcePreview.naturalWidth; //
    const previewHeight = sourcePreview.naturalHeight; //
    const containerWidth = sourcePreviewContainer.clientWidth; //
    const containerHeight = sourcePreviewContainer.clientHeight; //

    const scaledWidth = previewWidth * sourceZoomLevel; //
    const scaledHeight = previewHeight * sourceZoomLevel; //

    // --- Modified Clamping Logic ---
    // Allow the image edges to reach the container edges.
    const minOffsetX = Math.min(0, containerWidth - scaledWidth); // Usually negative or zero //
    const maxOffsetX = Math.max(0, containerWidth - scaledWidth); // Usually zero or positive //
    const minOffsetY = Math.min(0, containerHeight - scaledHeight); // Usually negative or zero //
    const maxOffsetY = Math.max(0, containerHeight - scaledHeight); // Usually zero or positive //


    // Clamp the current offsets
    let clampedX = currentOffsetX; //
    let clampedY = currentOffsetY; //

    // Check if image is smaller than container after scaling
    if (scaledWidth < containerWidth) {
        // Center horizontally if smaller
        clampedX = (containerWidth - scaledWidth) / 2; //
        console.log(`[uiUtils.updateSourcePreviewTransform] Image narrower than container, centering X to ${clampedX.toFixed(2)}px`); //
    } else {
        // Clamp within bounds if larger
        clampedX = Math.max(minOffsetX, Math.min(0, currentOffsetX)); // Allow panning up to edge (0) //
         if (clampedX !== currentOffsetX) console.log(`[uiUtils.updateSourcePreviewTransform] Clamped X offset from ${currentOffsetX.toFixed(2)} to ${clampedX.toFixed(2)} (Bounds: ${minOffsetX.toFixed(2)} to 0)`); //
    }

    if (scaledHeight < containerHeight) {
        // Center vertically if smaller
        clampedY = (containerHeight - scaledHeight) / 2; //
        console.log(`[uiUtils.updateSourcePreviewTransform] Image shorter than container, centering Y to ${clampedY.toFixed(2)}px`); //
    } else {
        // Clamp within bounds if larger
        clampedY = Math.max(minOffsetY, Math.min(0, currentOffsetY)); // Allow panning up to edge (0) //
         if (clampedY !== currentOffsetY) console.log(`[uiUtils.updateSourcePreviewTransform] Clamped Y offset from ${currentOffsetY.toFixed(2)} to ${clampedY.toFixed(2)} (Bounds: ${minOffsetY.toFixed(2)} to 0)`); //
    }
     // --- End Modified Clamping ---


    // Apply the clamped transform
    const transformString = `translate(${clampedX.toFixed(2)}px, ${clampedY.toFixed(2)}px) scale(${sourceZoomLevel})`; //
    sourcePreview.style.transform = transformString; //
    console.log(`[uiUtils.updateSourcePreviewTransform] Applied transform: ${transformString}`); //

    return { clampedX, clampedY }; //
}


/**
 * Handles changes in the output dimension inputs to maintain aspect ratio.
 * @param {Event} event - The input event.
 * @param {object} elements - UI elements including outputWidthInput, outputHeightInput, keepAspectRatioCheckbox.
 * @param {object} state - Application state including originalAspectRatio, currentImage.
 */
export function handleDimensionChange(event, elements, state) {
    const { outputWidthInput, outputHeightInput, keepAspectRatioCheckbox } = elements; //
    const { currentImage, originalAspectRatio } = state; //
    const changedInput = event.target; //

    console.log(`[uiUtils.handleDimensionChange] Input change detected on element:`, changedInput); //

    if (!currentImage) { //
        console.warn('[uiUtils.handleDimensionChange] No current image loaded, cannot maintain aspect ratio.'); //
        return; //
    }
    if (!keepAspectRatioCheckbox?.checked) { //
        console.log('[uiUtils.handleDimensionChange] Keep aspect ratio is unchecked, no calculation needed.'); //
        return; //
    }
    if (!originalAspectRatio) { //
        console.warn('[uiUtils.handleDimensionChange] Original aspect ratio is not available.'); //
        return; //
    }
     if (!changedInput) { //
        console.warn('[uiUtils.handleDimensionChange] Event target is null.'); //
        return; //
     }

    const newValue = parseInt(changedInput.value, 10); //
    if (isNaN(newValue) || newValue <= 0) { //
        console.warn(`[uiUtils.handleDimensionChange] Invalid input value "${changedInput.value}". Must be a positive number.`); //
        // Optionally reset the other field or show an error message
        return; //
    }

    console.log(`[uiUtils.handleDimensionChange] Changed value: ${newValue}, Aspect ratio: ${originalAspectRatio}`); //

    if (changedInput === outputWidthInput && outputHeightInput) { //
        const calculatedHeight = Math.round(newValue / originalAspectRatio); //
        console.log(`[uiUtils.handleDimensionChange] Calculating height: ${newValue} / ${originalAspectRatio} = ${calculatedHeight}`); //
        outputHeightInput.value = calculatedHeight; //
    } else if (changedInput === outputHeightInput && outputWidthInput) { //
        const calculatedWidth = Math.round(newValue * originalAspectRatio); //
        console.log(`[uiUtils.handleDimensionChange] Calculating width: ${newValue} * ${originalAspectRatio} = ${calculatedWidth}`); //
        outputWidthInput.value = calculatedWidth; //
    } else {
         console.warn('[uiUtils.handleDimensionChange] Changed input was neither width nor height input.'); //
    }
     console.log('[uiUtils.handleDimensionChange] Dimension update complete.'); //
}

/**
 * Resets the application state and UI elements to their initial (unloaded) state.
 * @param {object} elements - All relevant UI elements.
 * @param {object} state - The application state object to reset.
 * @param {Function} updateTilingControlsVisibilityFunc - Callback to update tiling controls visibility.
 * @param {Function} updatePreEffectControlsVisibilityFunc - Callback to update pre-effect controls visibility.
 * @param {Function} handleSliderChangeFunc - Callback to handle slider changes (to reset values).
 * @param {Function} [clearHistoryFunc] - Optional callback to clear the undo/redo history.
 */
export function resetState(
    elements, state,
    updateTilingControlsVisibilityFunc, updatePreEffectControlsVisibilityFunc, handleSliderChangeFunc,
    clearHistoryFunc // Optional parameter
) {
    console.log('[uiUtils.resetState] Resetting application state and UI...'); //
    const {
        // Destructure only elements needed for direct manipulation here
        imageLoader, sourcePreview, sourcePreviewText, finalPreview, finalPreviewText,
        saveButton, // Removed applyEffectButton, undoButton, redoButton as they are not in HTML
        tileShapeOptions, mirrorOptions, sliders, selects,
        outputWidthInput, outputHeightInput, keepAspectRatioCheckbox, sourceZoomValueSpan,
        canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas, sourcePreviewContainer,
        // Pre-effect controls (only those needing direct value reset)
         preEffectSelector, preEffectIntensitySlider, preEffectWaveAmplitudeSlider,
         preEffectWaveFrequencySlider, preEffectWavePhaseSlider, preEffectWaveDirection,
         preEffectWaveType,
        // New effect controls (only those needing direct value reset)
         sliceShiftDirection, sliceShiftIntensitySlider,
         pixelSortThresholdSlider, pixelSortDirection, pixelSortBy,
         // Tiling Sliders needing reset
         tilesXSlider, tilesYSlider, skewSlider, staggerSlider, scaleSlider, preTileXSlider, preTileYSlider, sourceZoomSlider

    } = elements; // Keep destructuring for easier access //

    // --- Reset UI Elements ---
    console.log('[uiUtils.resetState] Resetting UI elements visibility and values...'); //
    if (imageLoader) imageLoader.value = ''; //
    if (sourcePreview) { sourcePreview.classList.add('hidden'); sourcePreview.src = '#'; sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; } //
    if (sourcePreviewText) { sourcePreviewText.classList.remove('hidden'); sourcePreviewText.textContent = "Load image to pan/zoom source"; } //
    if (finalPreview) { finalPreview.classList.add('hidden'); finalPreview.src = '#'; } //
    if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview will appear here"; } //
    if (sourcePreviewContainer) sourcePreviewContainer.style.cursor = 'default'; //
    if (saveButton) saveButton.disabled = true; //
    // History buttons removed as they aren't in the HTML

    // Disable/Reset Tiling Controls
    tileShapeOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'grid') opt.checked = true; }); //
    mirrorOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'none') opt.checked = true; }); //
    if (outputWidthInput) { outputWidthInput.disabled = true; outputWidthInput.value = ''; } //
    if (outputHeightInput) { outputHeightInput.disabled = true; outputHeightInput.value = ''; } //
    if (keepAspectRatioCheckbox) { keepAspectRatioCheckbox.disabled = true; keepAspectRatioCheckbox.checked = true; } //
    // Reset Tiling Slider Values
    if (tilesXSlider) tilesXSlider.value = 1; //
    if (tilesYSlider) tilesYSlider.value = 1; //
    if (skewSlider) skewSlider.value = 0.5; //
    if (staggerSlider) staggerSlider.value = 0.5; //
    if (scaleSlider) scaleSlider.value = 1.0; //
    if (preTileXSlider) preTileXSlider.value = 1; //
    if (preTileYSlider) preTileYSlider.value = 1; //
    if (sourceZoomSlider) sourceZoomSlider.value = 1.0; //
    if (sourceZoomValueSpan) sourceZoomValueSpan.textContent = '1.0'; //

    // --- Disable/Reset Pre-Effect Controls ---
    if (preEffectSelector) { preEffectSelector.disabled = true; preEffectSelector.value = 'none'; } //
    // Disable all sliders and selects (generic approach)
    sliders?.forEach(el => { if (el) el.disabled = true; }); //
    selects?.forEach(el => { if (el) el.disabled = true; }); //
    // Reset specific pre-effect slider/select values to defaults
    if (preEffectIntensitySlider) preEffectIntensitySlider.value = 30; //
    if (preEffectWaveAmplitudeSlider) preEffectWaveAmplitudeSlider.value = 10; //
    if (preEffectWaveFrequencySlider) preEffectWaveFrequencySlider.value = 5; //
    if (preEffectWavePhaseSlider) preEffectWavePhaseSlider.value = 0; //
    if (preEffectWaveDirection) preEffectWaveDirection.value = 'horizontal'; //
    if (preEffectWaveType) preEffectWaveType.value = 'sine'; //
    // Reset NEW effect controls
    if (sliceShiftDirection) sliceShiftDirection.value = 'horizontal'; //
    if (sliceShiftIntensitySlider) sliceShiftIntensitySlider.value = 30; //
    if (pixelSortThresholdSlider) pixelSortThresholdSlider.value = 100; //
    if (pixelSortDirection) pixelSortDirection.value = 'horizontal'; //
    if (pixelSortBy) pixelSortBy.value = 'brightness'; //
    console.log('[uiUtils.resetState] Reset specific effect control values.'); //


    // Clear Canvases
    console.log('[uiUtils.resetState] Clearing canvases...'); //
    [canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas].forEach((c, index) => { //
        if (c) { //
             // Use optional chaining and nullish coalescing for safer access
             const name = ['main', 'preTile', 'mirror', 'sourceEffect'][index] ?? 'unknown'; //
            if (c.width > 0 && c.height > 0) { //
                try {
                    const ctx = c.getContext('2d'); //
                    if (ctx) { //
                        ctx.clearRect(0, 0, c.width, c.height); //
                         console.log(`[uiUtils.resetState] Cleared ${name} canvas (${c.width}x${c.height})`); //
                    } else {
                         console.warn(`[uiUtils.resetState] Could not get 2D context for ${name} canvas.`); //
                    }
                } catch (e) {
                    console.error(`[uiUtils.resetState] Error clearing ${name} canvas:`, e); //
                }
            } else {
                 console.log(`[uiUtils.resetState] Skipping clear for ${name} canvas (zero dimensions or not initialized).`); //
            }
        } else {
             // console.log(`[uiUtils.resetState] Canvas at index ${index} not found.`); // Optional: log missing canvases
        }
    });

    // --- Reset State Variables ---
    console.log('[uiUtils.resetState] Resetting state variables...'); //
    state.currentImage = null; //
    state.originalImageData = null; // Add this //
    state.lastAppliedImageData = null; // Add this //
    state.originalWidth = 0; //
    state.originalHeight = 0; //
    state.originalAspectRatio = 1; //
    state.originalFileName = 'downloaded-image.png'; //
    state.isProcessing = false; //
    state.isDragging = false; //
    state.currentOffsetX = 0; //
    state.currentOffsetY = 0; //
    state.startOffsetX = 0; //
    state.startOffsetY = 0; //
    state.dragStartX = 0; // Also reset drag start coords //
    state.dragStartY = 0; //
    state.sourceZoomLevel = 1.0; //
    if (state.debounceTimer) { //
        clearTimeout(state.debounceTimer); //
        console.log('[uiUtils.resetState] Cleared existing debounce timer.'); //
    }
    state.debounceTimer = null; //

    // --- Clear effect history --- // ADDED Logging
    if (typeof clearHistoryFunc === 'function') { //
        console.log('[uiUtils.resetState] Calling clearHistoryFunc callback...'); //
        clearHistoryFunc(); // Call the passed history clearing function //
    } else {
         console.log('[uiUtils.resetState] clearHistoryFunc not provided or not a function.'); //
    }


    // --- Update UI based on reset state ---
    console.log('[uiUtils.resetState] Calling UI update callbacks...'); //
    if (typeof updateTilingControlsVisibilityFunc === 'function') { //
         console.log('[uiUtils.resetState] Calling updateTilingControlsVisibilityFunc...'); //
         updateTilingControlsVisibilityFunc(); // Call with no args as it reads from elements //
    } else {
        console.warn('[uiUtils.resetState] updateTilingControlsVisibilityFunc not provided or not a function.'); //
    }

    if (typeof updatePreEffectControlsVisibilityFunc === 'function') { //
        console.log('[uiUtils.resetState] Calling updatePreEffectControlsVisibilityFunc...'); //
        updatePreEffectControlsVisibilityFunc(); // Call with no args //
    } else {
        console.warn('[uiUtils.resetState] updatePreEffectControlsVisibilityFunc not provided or not a function.'); //
    }

    if (typeof handleSliderChangeFunc === 'function') { //
        console.log('[uiUtils.resetState] Calling handleSliderChangeFunc to ensure displays match reset slider values...'); //
        handleSliderChangeFunc(); // Call with no args //
    } else {
        console.warn('[uiUtils.resetState] handleSliderChangeFunc not provided or not a function.'); //
    }

    console.log('[uiUtils.resetState] Reset complete.'); //
}


// --- Panning Logic ---
export function startPan(event, elements, state) {
    console.log(`[uiUtils.startPan] Pan start requested. Button: ${event.button}`); //
    if (!state?.currentImage) { //
         console.log('[uiUtils.startPan] No current image, ignoring pan start.'); //
         return; //
     }
    if (event.button !== 0) { // Check for primary button (usually left) //
        console.log('[uiUtils.startPan] Not primary button, ignoring pan start.'); //
        return; //
    }

    // Prevent default only if dragging the preview itself
    if (event.target === elements?.sourcePreview) { //
        console.log('[uiUtils.startPan] Preventing default drag behavior on source preview.'); //
        event.preventDefault(); //
    }

    state.isDragging = true; //
    state.dragStartX = event.pageX; //
    state.dragStartY = event.pageY; //
    state.startOffsetX = state.currentOffsetX; //
    state.startOffsetY = state.currentOffsetY; //
    console.log(`[uiUtils.startPan] Dragging started. Start coords: (${state.dragStartX}, ${state.dragStartY}), Start offsets: (${state.startOffsetX.toFixed(2)}, ${state.startOffsetY.toFixed(2)})`); //

    if (elements?.sourcePreviewContainer) { //
        elements.sourcePreviewContainer.style.cursor = 'grabbing'; //
        console.log('[uiUtils.startPan] Set cursor to grabbing.'); //
    }
}

// --- MODIFIED: Removed handleSliderChangeFunc parameter ---
export function panMove(event, elements, state, updateSourcePreviewTransformFunc) {
    // Log less verbosely here, maybe only every N events if needed, or just entry/exit
    // console.log('[uiUtils.panMove] Pan move detected.'); // Can be too noisy

    if (!state?.isDragging) { //
        // console.log('[uiUtils.panMove] Not dragging, ignoring move.'); // Also potentially noisy
        return; // Ignore if not dragging //
    }

    const dx = event.pageX - state.dragStartX; //
    const dy = event.pageY - state.dragStartY; //
    state.currentOffsetX = state.startOffsetX + dx; //
    state.currentOffsetY = state.startOffsetY + dy; //
    // console.log(`[uiUtils.panMove] Delta: (${dx}, ${dy}), New offset before clamp: (${state.currentOffsetX.toFixed(2)}, ${state.currentOffsetY.toFixed(2)})`); // Very verbose

    // Ensure update functions are valid before calling
    if (typeof updateSourcePreviewTransformFunc === 'function') { //
        // console.log('[uiUtils.panMove] Calling updateSourcePreviewTransformFunc...'); // Verbose
        const { clampedX, clampedY } = updateSourcePreviewTransformFunc(); // This function logs the clamping //
        // Update state with the clamped values returned by the transform function
        if (state.currentOffsetX !== clampedX || state.currentOffsetY !== clampedY) { //
             // Log only if clamping actually occurred within updateSourcePreviewTransform
            state.currentOffsetX = clampedX; //
            state.currentOffsetY = clampedY; //
             console.log(`[uiUtils.panMove] Updated state offsets after clamping: (${clampedX.toFixed(2)}, ${clampedY.toFixed(2)})`); // Added log //
        }

    } else {
         console.warn('[uiUtils.panMove] updateSourcePreviewTransformFunc not provided or not a function.'); // Added log //
    }

    // --- REMOVED THE CALL TO handleSliderChangeFunc FROM HERE ---
}

// --- MODIFIED: Added callbackFunc parameter and call ---
export function endPan(elements, state, callbackFunc) { // Added callbackFunc parameter
   if (!state || !state.isDragging) { //
       console.log('[uiUtils.endPan] Was not dragging, doing nothing.'); // Added log //
       return; // Added check for state //
    }
   console.log('[uiUtils.endPan] Pan end requested.'); // Moved log after check //
   state.isDragging = false; //
   console.log(`[uiUtils.endPan] Dragging stopped. Final offset: (${state.currentOffsetX.toFixed(2)}, ${state.currentOffsetY.toFixed(2)})`); // Added log //

   if(elements?.sourcePreviewContainer) { // Added optional chaining //
        elements.sourcePreviewContainer.style.cursor = 'grab'; //
        console.log('[uiUtils.endPan] Set cursor to grab.'); // Added log //
   }

   // Call the callback function if provided
   if (typeof callbackFunc === 'function') { //
        console.log('[uiUtils.endPan] Calling callback function.'); // Added log //
        callbackFunc(); // <<<< ADDED THIS CALL
   } else {
       console.log('[uiUtils.endPan] No callback function provided.'); // Added log //
   }
}


// --- MODIFIED: Removed handleSliderChangeFunc parameter from signature and call ---
export function handleSourceZoom(elements, state, updateSourcePreviewTransformFunc /* REMOVED handleSliderChangeFunc */) {
    console.log('[uiUtils.handleSourceZoom] Zoom slider change detected.'); //
     if (!state?.currentImage) { //
        console.warn('[uiUtils.handleSourceZoom] No current image, cannot handle zoom.'); //
        return; //
    }
    if (!elements?.sourceZoomSlider) { //
        console.warn('[uiUtils.handleSourceZoom] Source zoom slider element not found.'); //
        return; //
    }


    state.sourceZoomLevel = parseFloat(elements.sourceZoomSlider.value); //
    console.log(`[uiUtils.handleSourceZoom] New zoom level: ${state.sourceZoomLevel.toFixed(2)}`); //

    if (elements.sourceZoomValueSpan) { //
        elements.sourceZoomValueSpan.textContent = state.sourceZoomLevel.toFixed(1); //
    }

    // Update transform and clamp offsets based on new zoom level
    if (typeof updateSourcePreviewTransformFunc === 'function') { //
        console.log('[uiUtils.handleSourceZoom] Calling updateSourcePreviewTransformFunc...'); //
        const { clampedX, clampedY } = updateSourcePreviewTransformFunc(); //
        // Update state with clamped offsets
        state.currentOffsetX = clampedX; //
        state.currentOffsetY = clampedY; //
        console.log(`[uiUtils.handleSourceZoom] Updated state offsets after zoom clamping: (${clampedX.toFixed(2)}, ${clampedY.toFixed(2)})`); //
    } else {
        console.warn('[uiUtils.handleSourceZoom] updateSourcePreviewTransformFunc not provided or not a function.'); //
    }

    // --- REMOVED CALL TO handleSliderChangeFunc ---
    // if (typeof handleSliderChangeFunc === 'function') {
    //     console.log('[uiUtils.handleSourceZoom] Calling handleSliderChangeFunc...');
    //     handleSliderChangeFunc();
    // }
     console.log('[uiUtils.handleSourceZoom] Zoom handling complete.'); //
}

/**
 * Sets up an event listener for a slider to update its display value and optionally trigger a callback.
 * @param {HTMLInputElement | null} slider - The slider input element.
 * @param {HTMLElement | null} valueDisplay - The element to display the slider's value.
 * @param {Function} [callback] - Optional function to call when the slider value changes.
 * @param {Function} [formatter=val => val] - Optional function to format the displayed value.
 */
export function setupSliderListener(slider, valueDisplay, callback, formatter = val => val) {
    if (!slider) { //
        console.warn('[uiUtils.setupSliderListener] Slider element not provided.'); //
        return; //
    }
     if (!valueDisplay) { //
        console.warn(`[uiUtils.setupSliderListener] Value display element not provided for slider:`, slider); //
        // Allow setup without display, but log it.
     }
    console.log(`[uiUtils.setupSliderListener] Setting up listener for slider:`, slider); //


    const update = () => { //
        // console.log(`[uiUtils.setupSliderListener] Slider input detected on:`, slider); // Can be verbose
        const currentValue = slider.value; //
        if (valueDisplay) { // Check again inside closure //
             try {
                valueDisplay.textContent = formatter(currentValue); //
             } catch (e) {
                 console.error(`[uiUtils.setupSliderListener] Error in formatter function for slider:`, slider, e); //
                 valueDisplay.textContent = currentValue; // Fallback to raw value //
             }

        }
        if (typeof callback === 'function') { //
            // console.log(`[uiUtils.setupSliderListener] Calling callback for slider:`, slider); // Verbose
            try {
                callback(); //
            } catch (e) {
                 console.error(`[uiUtils.setupSliderListener] Error in callback function for slider:`, slider, e); //
            }

        }
    };

    slider.addEventListener('input', update); //
    console.log(`[uiUtils.setupSliderListener] Initial update call for slider:`, slider); //
    update(); // Initial call to set display value correctly //
}

console.log('[uiUtils] Module loaded successfully.'); // Added log
