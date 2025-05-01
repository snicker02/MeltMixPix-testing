// js/utils/uiUtils.js (Refactored for stateManager)
// VERSION WITH LOGGING + Refactoring changes

console.log('[uiUtils] Module loading...');

// Effects that might be slow for real-time preview before tiling
const drawingPreEffects = ['fractalZoom', 'pixelSort', 'sierpinski']; // Keep as is

/**
 * Displays a message to the user, optionally styled as an error.
 * (No changes needed)
 */
export function showMessage(message, isError = false, messageBox) {
    // console.log(`[uiUtils.showMessage] Attempting to show message: "${message}", isError: ${isError}`);
    if (!messageBox) {
        console.warn('[uiUtils.showMessage] MessageBox element not provided or found.');
        return;
    }
    messageBox.textContent = message;
    const messageClass = `mt-4 text-center font-medium h-6 ${isError ? 'text-red-600' : 'text-green-600'}`;
    messageBox.className = messageClass; // Use className for simplicity here
    messageBox.classList.remove('hidden');
    // console.log(`[uiUtils.showMessage] Message displayed. Class set to: "${messageClass}"`);

    // Set timeout to hide the message
    setTimeout(() => {
        if (messageBox.textContent === message) {
            // console.log(`[uiUtils.showMessage] Hiding message via timeout: "${message}"`);
            messageBox.classList.add('hidden');
            messageBox.textContent = '';
        } else {
            // console.log(`[uiUtils.showMessage] Timeout expired, but message content changed. Not hiding.`);
        }
    }, 5000);
}

/**
 * Updates the visibility and labels of TILING controls based on the selected tile shape.
 * (No changes needed as it only reads elements)
 */
export function updateTilingControlsVisibility(elements, handleSliderChangeFunc) {
    // console.log('[uiUtils.updateTilingControlsVisibility] Updating tiling controls...');
    const {
        tileShapeOptions, skewControl, staggerControl, tilesXLabel, tilesYLabel,
        scaleLabel, scaleSlider, scaleValueSpan, tilesXYHelpText
    } = elements;

    if (!tileShapeOptions || !skewControl || !staggerControl || !tilesXLabel || !tilesYLabel || !scaleLabel || !scaleSlider || !scaleValueSpan || !tilesXYHelpText) {
        console.warn("[uiUtils.updateTilingControlsVisibility] Missing one or more required tiling control elements for visibility update.");
        return;
    }

    const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
    // console.log(`[uiUtils.updateTilingControlsVisibility] Selected tile shape: ${selectedShape}`);

    skewControl.classList.add('hidden-control');
    staggerControl.classList.add('hidden-control');
    tilesXYHelpText.classList.add('hidden-control');

    let defaultScale = 1.0;
    let scaleLabelText = 'Shape Scale';
    let xLabel = 'Tiles X';
    let yLabel = 'Tiles Y';
    let showHelpText = false;

    switch (selectedShape) {
        case 'grid': case 'brick_wall': scaleLabelText = 'Tile Scale'; break;
        case 'herringbone': case 'basketweave': xLabel = 'Planks X'; yLabel = 'Planks Y'; scaleLabelText = 'Plank Scale'; break;
        case 'skewed': skewControl.classList.remove('hidden-control'); staggerControl.classList.remove('hidden-control'); scaleLabelText = 'Overlap Scale'; defaultScale = 1.05; break; // console.log('[uiUtils.updateTilingControlsVisibility] Showing Skew and Stagger controls.'); break;
        case 'hexagon': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Hexagon Scale'; showHelpText = true; break;
        case 'semi_octagon_square': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'l_shape_square': xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'hexagon_triangle': xLabel = 'Approx Hex X'; yLabel = 'Approx Hex Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'square_triangle': xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'rhombus': xLabel = 'Rhombus Count X'; yLabel = 'Rhombus Count Y'; scaleLabelText = 'Rhombus Scale'; break;
        default: console.warn(`[uiUtils.updateTilingControlsVisibility] Unhandled tile shape: ${selectedShape}`);
    }

    tilesXLabel.textContent = xLabel;
    tilesYLabel.textContent = yLabel;
    scaleLabel.textContent = scaleLabelText;
    // console.log(`[uiUtils.updateTilingControlsVisibility] Labels set: X="${xLabel}", Y="${yLabel}", Scale="${scaleLabelText}"`);

    if (scaleSlider.value !== defaultScale.toString()) {
        // console.log(`[uiUtils.updateTilingControlsVisibility] Resetting scale slider to default: ${defaultScale}`);
        scaleSlider.value = defaultScale;
        if (scaleValueSpan) scaleValueSpan.textContent = defaultScale.toFixed(2);
    } else if (scaleValueSpan) {
        scaleValueSpan.textContent = parseFloat(scaleSlider.value).toFixed(2);
    }

    // const helpTextWasHidden = tilesXYHelpText.classList.contains('hidden-control');
    tilesXYHelpText.classList.toggle('hidden-control', !showHelpText);
    // if (helpTextWasHidden === showHelpText) {
        // console.log(`[uiUtils.updateTilingControlsVisibility] Tiles XY Help text visibility set to: ${showHelpText ? 'visible' : 'hidden'}`);
    // }

    if (typeof handleSliderChangeFunc === 'function') {
        // console.log('[uiUtils.updateTilingControlsVisibility] Calling handleSliderChangeFunc callback.');
        handleSliderChangeFunc(); // Triggers requestFullUpdate
    }
    // console.log('[uiUtils.updateTilingControlsVisibility] Update complete.');
}


/**
 * Updates visibility of PRE-EFFECT controls based on the selected effect.
 * (No changes needed as it only reads elements)
 */
export function updatePreEffectControlsVisibility(elements) {
    // console.log('[uiUtils.updatePreEffectControlsVisibility] Updating pre-effect controls...');
    const {
        preEffectSelector, preEffectOptionsContainer, preEffectIntensityControl,
        preEffectIntensitySlider, preEffectIntensityValue, preEffectWaveDistortionOptions,
        preEffectRealtimeWarning,
        sliceShiftOptions, pixelSortOptions
    } = elements;

    if (!preEffectSelector || !preEffectOptionsContainer || !preEffectIntensityControl || !preEffectWaveDistortionOptions || !preEffectRealtimeWarning || !sliceShiftOptions || !pixelSortOptions) {
        console.warn("[uiUtils.updatePreEffectControlsVisibility] Missing one or more required pre-effect control elements for visibility update.");
        return;
    }

    const selectedEffect = preEffectSelector.value;
    // console.log(`[uiUtils.updatePreEffectControlsVisibility] Selected pre-effect: ${selectedEffect}`);

    preEffectOptionsContainer.querySelectorAll('.effect-option-group').forEach(el => el.classList.add('hidden'));
    preEffectRealtimeWarning.classList.add('hidden');
    // console.log('[uiUtils.updatePreEffectControlsVisibility] Hid all specific effect option groups and realtime warning.');

    let specificControlsShown = false;
    if (selectedEffect === 'none') {
        // console.log('[uiUtils.updatePreEffectControlsVisibility] No effect selected, hiding all controls.');
        preEffectIntensityControl.classList.add('hidden');
        specificControlsShown = true;
    } else if (selectedEffect === 'waveDistortion') {
        preEffectWaveDistortionOptions.classList.remove('hidden');
        preEffectIntensityControl.classList.add('hidden');
        // console.log('[uiUtils.updatePreEffectControlsVisibility] Showing Wave Distortion options.');
        specificControlsShown = true;
    } else if (selectedEffect === 'sliceShift') {
        sliceShiftOptions.classList.remove('hidden');
        preEffectIntensityControl.classList.add('hidden');
        // console.log('[uiUtils.updatePreEffectControlsVisibility] Showing Slice Shift options.');
        specificControlsShown = true;
    } else if (selectedEffect === 'pixelSort') {
        pixelSortOptions.classList.remove('hidden');
        preEffectIntensityControl.classList.add('hidden');
        // console.log('[uiUtils.updatePreEffectControlsVisibility] Showing Pixel Sort options.');
        specificControlsShown = true;
    }

    if (!specificControlsShown) {
        const usesGenericIntensity = ['channelShift', 'blockDisplace', 'noise', 'invertBlocks', 'sierpinski', 'fractalZoom', 'scanLines'];
        const showIntensity = usesGenericIntensity.includes(selectedEffect);
        preEffectIntensityControl.classList.toggle('hidden', !showIntensity);

        if (showIntensity) {
            // console.log(`[uiUtils.updatePreEffectControlsVisibility] Showing generic intensity slider for effect: ${selectedEffect}`);
            if (preEffectIntensitySlider) {
                const intensityLabel = preEffectIntensityControl.querySelector('label');
                if (intensityLabel) {
                    let labelText = 'Intensity:'; let maxVal = 100; let minVal = 1;
                    if (selectedEffect === 'fractalZoom' || selectedEffect === 'sierpinski') { labelText = 'Intensity/Depth:'; maxVal = 100; minVal = 1; }
                    else if (selectedEffect === 'scanLines') { labelText = 'Darkness:'; maxVal = 100; minVal = 0; }
                    intensityLabel.textContent = labelText;
                    preEffectIntensitySlider.max = maxVal;
                    preEffectIntensitySlider.min = minVal;
                    // console.log(`[uiUtils.updatePreEffectControlsVisibility] Intensity slider label: "${labelText}", Min: ${minVal}, Max: ${maxVal}`);
                }
                const currentValue = parseFloat(preEffectIntensitySlider.value);
                const clampedValue = Math.max(parseFloat(preEffectIntensitySlider.min), Math.min(parseFloat(preEffectIntensitySlider.max), currentValue));
                 if (currentValue !== clampedValue) {
                    //  console.log(`[uiUtils.updatePreEffectControlsVisibility] Clamping intensity slider value from ${currentValue} to ${clampedValue}`);
                     preEffectIntensitySlider.value = clampedValue;
                 }
                if (preEffectIntensityValue) preEffectIntensityValue.textContent = preEffectIntensitySlider.value;
            } else { console.warn('[uiUtils.updatePreEffectControlsVisibility] Intensity control is visible but slider element is missing.'); }
        } else {
            //  console.log(`[uiUtils.updatePreEffectControlsVisibility] Effect "${selectedEffect}" does not use generic intensity slider or has specific controls.`);
             preEffectIntensityControl.classList.add('hidden');
        }
    }

    if (drawingPreEffects.includes(selectedEffect)) {
        preEffectRealtimeWarning.classList.remove('hidden');
        // console.log(`[uiUtils.updatePreEffectControlsVisibility] Showing real-time performance warning for effect: ${selectedEffect}`);
    }
    //  console.log('[uiUtils.updatePreEffectControlsVisibility] Update complete.');
}

/**
 * Updates the transform (pan/zoom) of the source preview image.
 * @param {object} elements - UI elements including sourcePreview, sourcePreviewContainer.
 * @param {object} currentState - A snapshot of the current application state from stateManager.getState().
 * @returns {{ clampedX: number, clampedY: number }} The clamped offset values.
 */
export function updateSourcePreviewTransform(elements, currentState) { // Accepts state snapshot
    const { sourcePreview, sourcePreviewContainer } = elements;
    // Get state from the passed object
    let { sourceZoomLevel = 1.0, currentOffsetX = 0, currentOffsetY = 0 } = currentState;

    // console.log(`[uiUtils.updateSourcePreviewTransform] Updating transform. Zoom: ${sourceZoomLevel}, OffsetX: ${currentOffsetX}, OffsetY: ${currentOffsetY}`);

    if (!sourcePreview || !sourcePreviewContainer) {
         console.warn('[uiUtils.updateSourcePreviewTransform] Missing sourcePreview or sourcePreviewContainer element.');
         if(sourcePreview) sourcePreview.style.transform = 'translate(0px, 0px) scale(1)';
         return { clampedX: 0, clampedY: 0 };
    }
     if (!sourcePreview.naturalWidth || !sourcePreview.naturalHeight) {
        console.warn('[uiUtils.updateSourcePreviewTransform] Source preview image has zero natural dimensions (likely not loaded). Resetting transform.');
        sourcePreview.style.transform = 'translate(0px, 0px) scale(1)';
        return { clampedX: 0, clampedY: 0 };
    }

    const previewWidth = sourcePreview.naturalWidth;
    const previewHeight = sourcePreview.naturalHeight;
    const containerWidth = sourcePreviewContainer.clientWidth;
    const containerHeight = sourcePreviewContainer.clientHeight;
    const scaledWidth = previewWidth * sourceZoomLevel;
    const scaledHeight = previewHeight * sourceZoomLevel;

    // Clamping Logic
    const minOffsetX = Math.min(0, containerWidth - scaledWidth);
    const maxOffsetX = 0;
    const minOffsetY = Math.min(0, containerHeight - scaledHeight);
    const maxOffsetY = 0;

    let clampedX = currentOffsetX;
    let clampedY = currentOffsetY;

    if (scaledWidth <= containerWidth) {
        clampedX = (containerWidth - scaledWidth) / 2;
        // console.log(`[uiUtils.updateSourcePreviewTransform] Image narrower than container, centering X to ${clampedX.toFixed(2)}px`);
    } else {
        clampedX = Math.max(minOffsetX, Math.min(maxOffsetX, currentOffsetX));
        // if (clampedX !== currentOffsetX) console.log(`[uiUtils.updateSourcePreviewTransform] Clamped X offset from ${currentOffsetX.toFixed(2)} to ${clampedX.toFixed(2)} (Bounds: ${minOffsetX.toFixed(2)} to ${maxOffsetX.toFixed(2)})`);
    }

    if (scaledHeight <= containerHeight) {
        clampedY = (containerHeight - scaledHeight) / 2;
        // console.log(`[uiUtils.updateSourcePreviewTransform] Image shorter than container, centering Y to ${clampedY.toFixed(2)}px`);
    } else {
        clampedY = Math.max(minOffsetY, Math.min(maxOffsetY, currentOffsetY));
        // if (clampedY !== currentOffsetY) console.log(`[uiUtils.updateSourcePreviewTransform] Clamped Y offset from ${currentOffsetY.toFixed(2)} to ${clampedY.toFixed(2)} (Bounds: ${minOffsetY.toFixed(2)} to ${maxOffsetY.toFixed(2)})`);
    }

    const transformString = `translate(${clampedX.toFixed(2)}px, ${clampedY.toFixed(2)}px) scale(${sourceZoomLevel})`;
    sourcePreview.style.transform = transformString;
    // console.log(`[uiUtils.updateSourcePreviewTransform] Applied transform: ${transformString}`);

    // Return the clamped values so the caller (main.js) can update the stateManager
    return { clampedX, clampedY };
}


/**
 * Handles changes in the output dimension inputs to maintain aspect ratio.
 * @param {Event} event - The input event.
 * @param {object} elements - UI elements including outputWidthInput, outputHeightInput, keepAspectRatioCheckbox.
 * @param {number | null} aspectRatio - The original aspect ratio (width / height) from stateManager.
 */
export function handleDimensionChange(event, elements, aspectRatio) { // Accepts aspectRatio
    const { outputWidthInput, outputHeightInput, keepAspectRatioCheckbox } = elements;
    // No longer needs currentImage or full state object
    const changedInput = event.target;

    // console.log(`[uiUtils.handleDimensionChange] Input change detected on element:`, changedInput);

    if (!keepAspectRatioCheckbox?.checked) { /* console.log('[uiUtils.handleDimensionChange] Keep aspect ratio unchecked.'); */ return; }
    if (aspectRatio === null || aspectRatio <= 0) { console.warn('[uiUtils.handleDimensionChange] Aspect ratio unavailable or invalid.'); return; }
    if (!changedInput) { console.warn('[uiUtils.handleDimensionChange] Event target is null.'); return; }

    const newValue = parseInt(changedInput.value, 10);
    if (isNaN(newValue) || newValue <= 0) { /* console.warn(`[uiUtils.handleDimensionChange] Invalid input value: ${changedInput.value}`); */ return; }

    // console.log(`[uiUtils.handleDimensionChange] Changed value: ${newValue}, Aspect ratio: ${aspectRatio}`);

    if (changedInput === outputWidthInput && outputHeightInput) {
        const calculatedHeight = Math.round(newValue / aspectRatio);
        // console.log(`[uiUtils.handleDimensionChange] Calculating height: ${calculatedHeight}`);
        outputHeightInput.value = calculatedHeight;
    } else if (changedInput === outputHeightInput && outputWidthInput) {
        const calculatedWidth = Math.round(newValue * aspectRatio);
        // console.log(`[uiUtils.handleDimensionChange] Calculating width: ${calculatedWidth}`);
        outputWidthInput.value = calculatedWidth;
    } // else { console.warn('[uiUtils.handleDimensionChange] Changed input was neither width nor height.'); }
    // console.log('[uiUtils.handleDimensionChange] Dimension update complete.');
}

/**
 * Resets UI elements to their initial (unloaded) state.
 * Does NOT reset state variables anymore (handled by stateManager).
 * @param {object} elements - All relevant UI elements.
 * @param {Function} updateTilingControlsVisibilityFunc - Callback to update tiling controls visibility.
 * @param {Function} updatePreEffectControlsVisibilityFunc - Callback to update pre-effect controls visibility.
 * @param {Function} handleSliderChangeFunc - Callback to handle slider changes (to update values).
 * @param {Function} updateHistoryButtonsFunc - Callback to update undo/redo buttons (which gets state from stateManager).
 */
export function resetUIState( // Renamed from resetState
    elements, // Removed state parameter
    updateTilingControlsVisibilityFunc, updatePreEffectControlsVisibilityFunc, handleSliderChangeFunc,
    updateHistoryButtonsFunc // Renamed history clear func -> button update func
) {
    console.log('[uiUtils.resetUIState] Resetting UI elements...');
    const {
        imageLoader, sourcePreview, sourcePreviewText, finalPreview, finalPreviewText,
        saveButton, applyEffectButton, undoButton, redoButton,
        tileShapeOptions, mirrorOptions, sliders, selects,
        outputWidthInput, outputHeightInput, keepAspectRatioCheckbox, sourceZoomValueSpan,
        canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas, sourcePreviewContainer,
        preEffectSelector, preEffectIntensitySlider, preEffectWaveAmplitudeSlider,
        preEffectWaveFrequencySlider, preEffectWavePhaseSlider, preEffectWaveDirection,
        preEffectWaveType, sliceShiftDirection, sliceShiftIntensitySlider,
        pixelSortThresholdSlider, pixelSortDirection, pixelSortBy,
        tilesXSlider, tilesYSlider, skewSlider, staggerSlider, scaleSlider, preTileXSlider, preTileYSlider, sourceZoomSlider
    } = elements;

    // --- Reset UI Elements Values/Visibility/Disabled State ---
    // console.log('[uiUtils.resetUIState] Resetting UI elements visibility and values...');
    if (imageLoader) imageLoader.value = ''; // Clear file input
    if (sourcePreview) { sourcePreview.classList.add('hidden'); sourcePreview.src = '#'; sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; }
    if (sourcePreviewText) { sourcePreviewText.classList.remove('hidden'); sourcePreviewText.textContent = "Load image to pan/zoom source"; }
    if (finalPreview) { finalPreview.classList.add('hidden'); finalPreview.src = '#'; }
    if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview will appear here"; }
    if(sourcePreviewContainer) sourcePreviewContainer.style.cursor = 'default';
    // Buttons
    if (saveButton) saveButton.disabled = true;
    if (applyEffectButton) applyEffectButton.disabled = true;
    if (undoButton) undoButton.disabled = true; // Will be updated by updateHistoryButtonsFunc if needed
    if (redoButton) redoButton.disabled = true; // Will be updated by updateHistoryButtonsFunc if needed

    // Tiling Controls
    tileShapeOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'grid') opt.checked = true; });
    mirrorOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'none') opt.checked = true; });
    if (outputWidthInput) { outputWidthInput.disabled = true; outputWidthInput.value = ''; }
    if (outputHeightInput) { outputHeightInput.disabled = true; outputHeightInput.value = ''; }
    if (keepAspectRatioCheckbox) { keepAspectRatioCheckbox.disabled = true; keepAspectRatioCheckbox.checked = true; }
    // Reset Tiling Slider Values to defaults
    if (tilesXSlider) tilesXSlider.value = 1;
    if (tilesYSlider) tilesYSlider.value = 1;
    if (skewSlider) skewSlider.value = 0.5;
    if (staggerSlider) staggerSlider.value = 0.5;
    if (scaleSlider) scaleSlider.value = 1.0;
    if (preTileXSlider) preTileXSlider.value = 1;
    if (preTileYSlider) preTileYSlider.value = 1;
    if (sourceZoomSlider) sourceZoomSlider.value = 1.0;
    if (sourceZoomValueSpan) sourceZoomValueSpan.textContent = '1.0'; // Ensure display matches

    // Pre-Effect Controls
    if (preEffectSelector) { preEffectSelector.disabled = true; preEffectSelector.value = 'none'; }
    sliders?.forEach(el => { if (el) el.disabled = true; }); // Disable all sliders found
    selects?.forEach(el => { if (el) el.disabled = true; }); // Disable all selects found
    // Reset specific pre-effect slider/select values to defaults
    if (preEffectIntensitySlider) preEffectIntensitySlider.value = 30;
    if (preEffectWaveAmplitudeSlider) preEffectWaveAmplitudeSlider.value = 10;
    if (preEffectWaveFrequencySlider) preEffectWaveFrequencySlider.value = 5;
    if (preEffectWavePhaseSlider) preEffectWavePhaseSlider.value = 0;
    if (preEffectWaveDirection) preEffectWaveDirection.value = 'horizontal';
    if (preEffectWaveType) preEffectWaveType.value = 'sine';
    if (sliceShiftDirection) sliceShiftDirection.value = 'horizontal';
    if (sliceShiftIntensitySlider) sliceShiftIntensitySlider.value = 30;
    if (pixelSortThresholdSlider) pixelSortThresholdSlider.value = 100;
    if (pixelSortDirection) pixelSortDirection.value = 'horizontal';
    if (pixelSortBy) pixelSortBy.value = 'brightness';
    // console.log('[uiUtils.resetUIState] Reset specific effect control values.');


    // Clear Canvases
    // console.log('[uiUtils.resetUIState] Clearing canvases...');
    [canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas].forEach((c, index) => {
        if (c) {
             const name = ['mainOutput', 'preTile', 'mirror', 'sourceEffect'][index] ?? 'unknown';
            if (c.width > 0 && c.height > 0) {
                try {
                    const ctx = c.getContext('2d');
                    if (ctx) { ctx.clearRect(0, 0, c.width, c.height); /* console.log(` Cleared ${name} canvas (${c.width}x${c.height})`); */ }
                     else { console.warn(` Could not get 2D context for ${name} canvas.`); }
                } catch (e) { console.error(` Error clearing ${name} canvas:`, e); }
            } else { /* console.log(` Skipping clear for ${name} canvas (zero dimensions or not initialized).`); */ }
        }
    });

    // --- State Variables Reset - REMOVED (Handled by stateManager.resetStateData()) ---

    // --- Update Button States based on (now cleared) history ---
    if (typeof updateHistoryButtonsFunc === 'function') {
        // console.log('[uiUtils.resetUIState] Calling updateHistoryButtonsFunc callback...');
        updateHistoryButtonsFunc(); // Call the passed history button update function
    } else {
         console.warn('[uiUtils.resetUIState] updateHistoryButtonsFunc not provided or not a function.');
    }


    // --- Update UI Visibility based on reset state ---
    // console.log('[uiUtils.resetUIState] Calling UI update callbacks...');
    if (typeof updateTilingControlsVisibilityFunc === 'function') {
        //  console.log('[uiUtils.resetUIState] Calling updateTilingControlsVisibilityFunc...');
         updateTilingControlsVisibilityFunc();
    } else { console.warn('[uiUtils.resetUIState] updateTilingControlsVisibilityFunc not provided.'); }

    if (typeof updatePreEffectControlsVisibilityFunc === 'function') {
        // console.log('[uiUtils.resetUIState] Calling updatePreEffectControlsVisibilityFunc...');
        updatePreEffectControlsVisibilityFunc();
    } else { console.warn('[uiUtils.resetUIState] updatePreEffectControlsVisibilityFunc not provided.'); }

    // Call slider handler to ensure displayed values match reset slider values
    if (typeof handleSliderChangeFunc === 'function') {
        // console.log('[uiUtils.resetUIState] Calling handleSliderChangeFunc to ensure displays match reset slider values...');
        handleSliderChangeFunc(); // This will also trigger requestFullUpdate, which is fine (it will skip as no image loaded)
    } else { console.warn('[uiUtils.resetUIState] handleSliderChangeFunc not provided.'); }

    console.log('[uiUtils.resetUIState] UI Reset complete.');
}


// --- Panning Logic ---
// These are now less critical as main.js handles the core logic using stateManager.
// Keep them as simple state-less helpers if needed, or remove if fully unused.
export function startPan(event, elements) { // Removed state param
    // console.log(`[uiUtils.startPan] Pan start requested. Button: ${event.button}`);
    // Logic requiring state (like currentImage check) should happen in the caller (main.js)
    if (event.button !== 0) { /* console.log('[uiUtils.startPan] Ignoring pan start (not left button).'); */ return false; }
    if (event.target === elements?.sourcePreview) { event.preventDefault(); }
    // console.log(`[uiUtils.startPan] Pan initiated visually.`);
    if (elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grabbing'; }
    return true; // Indicate pan can start
}

export function panMove(event, startDragX, startDragY, startOffsetX, startOffsetY) { // Removed state, accepts start values
    // Calculates new offsets based on drag delta, returns them
    const dx = event.pageX - startDragX;
    const dy = event.pageY - startDragY;
    const newOffsetX = startOffsetX + dx;
    const newOffsetY = startOffsetY + dy;
    return { newOffsetX, newOffsetY };
    // Clamping and state update should happen in the caller (main.js) after calling updateSourcePreviewTransform
}

export function endPan(elements) { // Removed state param and callbackFunc
//    console.log('[uiUtils.endPan] Pan end requested.');
   // The caller (main.js) now handles setting dragging state to false and triggering updates.
   if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grab'; }
   // console.log('[uiUtils.endPan] Visual cleanup done.');
}

// --- Source Zoom Logic ---
// Simplified - main.js reads slider, calls stateManager, calls updateSourcePreviewTransform
export function handleSourceZoom(elements, currentStateSnapshot, stateUpdateFunc) { // Now accepts snapshot and update callback
    // console.log('[uiUtils.handleSourceZoom] Zoom handling triggered.');
    if (!currentStateSnapshot?.currentImage) { /* console.warn('[uiUtils.handleSourceZoom] No current image.'); */ return; }
    if (!elements?.sourceZoomSlider) { console.warn('[uiUtils.handleSourceZoom] Source zoom slider element not found.'); return; }

    const newZoomLevel = parseFloat(elements.sourceZoomSlider.value);
    // console.log(`[uiUtils.handleSourceZoom] New zoom level from slider: ${newZoomLevel.toFixed(2)}`);

    // Update the display immediately
    if (elements.sourceZoomValueSpan) { elements.sourceZoomValueSpan.textContent = newZoomLevel.toFixed(1); }

    // Call the state update function provided by main.js
    if (typeof stateUpdateFunc === 'function') {
        stateUpdateFunc(newZoomLevel); // Pass the new zoom level to main.js handler
    } else {
         console.warn('[uiUtils.handleSourceZoom] stateUpdateFunc not provided.');
    }
     // console.log('[uiUtils.handleSourceZoom] Zoom handling complete.');
}

/**
 * Sets up an event listener for a slider. (No changes needed)
 */
export function setupSliderListener(slider, valueDisplay, callback, formatter = val => val) {
    if (!slider) { console.warn('[uiUtils.setupSliderListener] Slider element not provided.'); return; }
    if (!valueDisplay) { console.warn(`[uiUtils.setupSliderListener] Value display element not provided for slider:`, slider); }
    // console.log(`[uiUtils.setupSliderListener] Setting up listener for slider:`, slider);
    const update = () => {
        const currentValue = slider.value;
        if (valueDisplay) { try { valueDisplay.textContent = formatter(currentValue); } catch (e) { console.error(`[uiUtils.setupSliderListener] Error in formatter for slider:`, slider, e); valueDisplay.textContent = currentValue; } }
        if (typeof callback === 'function') { try { callback(); } catch (e) { console.error(`[uiUtils.setupSliderListener] Error in callback for slider:`, slider, e); } }
    };
    slider.addEventListener('input', update);
    // console.log(`[uiUtils.setupSliderListener] Initial update call for slider:`, slider);
    update(); // Initial update
}

console.log('[uiUtils] Module loaded successfully.');
