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
    const messageClass = `mt-4 text-center font-medium h-6 ${isError ? 'text-red-600' : 'text-green-600'}`; // Line 20
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
 * ADDED: Hides/shows squareTriangleControls.
 */
export function updateTilingControlsVisibility(elements, handleSliderChangeFunc) {
    const {
        tileShapeOptions, skewControl, staggerControl, tilesXLabel, tilesYLabel,
        scaleLabel, scaleSlider, scaleValueSpan, tilesXYHelpText,
        squareTriangleControls // <<< ADDED Reference
    } = elements;

    if (!tileShapeOptions || !skewControl || !staggerControl || !tilesXLabel || !tilesYLabel || !scaleLabel || !scaleSlider || !scaleValueSpan || !tilesXYHelpText || !squareTriangleControls) { // <<< ADDED Check
        console.warn("[uiUtils.updateTilingControlsVisibility] Missing one or more required tiling control elements.");
        return;
    }

    const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';

    // Hide all optional controls initially
    skewControl?.classList.add('hidden-control'); // Added null checks
    staggerControl?.classList.add('hidden-control');
    tilesXYHelpText?.classList.add('hidden-control');
    squareTriangleControls?.classList.add('hidden-control'); // Added null check

    let defaultScale = 1.0;
    let scaleLabelText = 'Shape Scale';
    let xLabel = 'Tiles X';
    let yLabel = 'Tiles Y';
    let showHelpText = false;

    switch (selectedShape) {
        case 'grid': case 'brick_wall': scaleLabelText = 'Tile Scale'; break;
        case 'herringbone': case 'basketweave': xLabel = 'Planks X'; yLabel = 'Planks Y'; scaleLabelText = 'Plank Scale'; break;
        case 'skewed': skewControl?.classList.remove('hidden-control'); staggerControl?.classList.remove('hidden-control'); scaleLabelText = 'Overlap Scale'; defaultScale = 1.05; break;
        case 'hexagon': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Hexagon Scale'; showHelpText = true; break;
        case 'semi_octagon_square': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'l_shape_square': xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'hexagon_triangle': xLabel = 'Approx Hex X'; yLabel = 'Approx Hex Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'square_triangle':
            xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true;
            squareTriangleControls?.classList.remove('hidden-control'); // Show pattern-specific controls
            // console.log('[uiUtils.updateTilingControlsVisibility] Showing Square/Triangle debug controls container.');
            break;
        case 'rhombus': xLabel = 'Rhombus Count X'; yLabel = 'Rhombus Count Y'; scaleLabelText = 'Rhombus Scale'; break;
        default: console.warn(`[uiUtils.updateTilingControlsVisibility] Unhandled tile shape: ${selectedShape}`);
    }

    if (tilesXLabel) tilesXLabel.textContent = xLabel;
    if (tilesYLabel) tilesYLabel.textContent = yLabel;
    if (scaleLabel) scaleLabel.textContent = scaleLabelText;

    if (scaleSlider && scaleSlider.value !== defaultScale.toString()) {
        scaleSlider.value = defaultScale;
        if (scaleValueSpan) scaleValueSpan.textContent = defaultScale.toFixed(2);
    } else if (scaleSlider && scaleValueSpan) {
        scaleValueSpan.textContent = parseFloat(scaleSlider.value).toFixed(2);
    }

    if (tilesXYHelpText) tilesXYHelpText.classList.toggle('hidden-control', !showHelpText);

    if (typeof handleSliderChangeFunc === 'function') {
        handleSliderChangeFunc(); // Triggers requestFullUpdate
    }
}


/**
 * Updates visibility of PRE-EFFECT controls based on the selected effect.
 * (No changes needed as it only reads elements)
 */
export function updatePreEffectControlsVisibility(elements) {
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

    preEffectOptionsContainer?.querySelectorAll('.effect-option-group').forEach(el => el.classList.add('hidden'));
    preEffectRealtimeWarning?.classList.add('hidden');

    let specificControlsShown = false;
    if (selectedEffect === 'none') {
        preEffectIntensityControl?.classList.add('hidden');
        specificControlsShown = true;
    } else if (selectedEffect === 'waveDistortion') {
        preEffectWaveDistortionOptions?.classList.remove('hidden');
        preEffectIntensityControl?.classList.add('hidden');
        specificControlsShown = true;
    } else if (selectedEffect === 'sliceShift') {
        sliceShiftOptions?.classList.remove('hidden');
        preEffectIntensityControl?.classList.add('hidden');
        specificControlsShown = true;
    } else if (selectedEffect === 'pixelSort') {
        pixelSortOptions?.classList.remove('hidden');
        preEffectIntensityControl?.classList.add('hidden');
        specificControlsShown = true;
    }

    if (!specificControlsShown) {
        const usesGenericIntensity = ['channelShift', 'blockDisplace', 'noise', 'invertBlocks', 'sierpinski', 'fractalZoom', 'scanLines'];
        const showIntensity = usesGenericIntensity.includes(selectedEffect);
        preEffectIntensityControl?.classList.toggle('hidden', !showIntensity);

        if (showIntensity) {
            if (preEffectIntensitySlider) {
                const intensityLabel = preEffectIntensityControl?.querySelector('label');
                if (intensityLabel) {
                    let labelText = 'Intensity:'; let maxVal = 100; let minVal = 1;
                    if (selectedEffect === 'fractalZoom' || selectedEffect === 'sierpinski') { labelText = 'Intensity/Depth:'; maxVal = 100; minVal = 1; }
                    else if (selectedEffect === 'scanLines') { labelText = 'Darkness:'; maxVal = 100; minVal = 0; }
                    intensityLabel.textContent = labelText;
                    preEffectIntensitySlider.max = String(maxVal); // Ensure string assignment
                    preEffectIntensitySlider.min = String(minVal);
                }
                const currentValue = parseFloat(preEffectIntensitySlider.value);
                const clampedValue = Math.max(parseFloat(preEffectIntensitySlider.min), Math.min(parseFloat(preEffectIntensitySlider.max), currentValue));
                 if (currentValue !== clampedValue) {
                     preEffectIntensitySlider.value = String(clampedValue);
                 }
                if (preEffectIntensityValue) preEffectIntensityValue.textContent = preEffectIntensitySlider.value;
            }
        } else {
             preEffectIntensityControl?.classList.add('hidden');
        }
    }

    if (drawingPreEffects.includes(selectedEffect)) {
        preEffectRealtimeWarning?.classList.remove('hidden');
    }
}

/**
 * Updates the transform (pan/zoom) of the source preview image.
 * @param {object} elements - UI elements including sourcePreview, sourcePreviewContainer.
 * @param {object} currentState - A snapshot of the current application state from stateManager.getState().
 * @returns {{ clampedX: number, clampedY: number }} The clamped offset values.
 */
export function updateSourcePreviewTransform(elements, currentState) { // Accepts state snapshot
    const { sourcePreview, sourcePreviewContainer } = elements;
    let { sourceZoomLevel = 1.0, currentOffsetX = 0, currentOffsetY = 0 } = currentState;

    if (!sourcePreview || !sourcePreviewContainer) {
         console.warn('[uiUtils.updateSourcePreviewTransform] Missing sourcePreview or sourcePreviewContainer element.');
         if(sourcePreview) sourcePreview.style.transform = 'translate(0px, 0px) scale(1)';
         return { clampedX: 0, clampedY: 0 };
    }
     if (!sourcePreview.naturalWidth || !sourcePreview.naturalHeight) {
        // console.warn('[uiUtils.updateSourcePreviewTransform] Source preview image has zero natural dimensions (likely not loaded). Resetting transform.');
        sourcePreview.style.transform = 'translate(0px, 0px) scale(1)';
        return { clampedX: 0, clampedY: 0 };
    }

    const previewWidth = sourcePreview.naturalWidth;
    const previewHeight = sourcePreview.naturalHeight;
    const containerWidth = sourcePreviewContainer.clientWidth;
    const containerHeight = sourcePreviewContainer.clientHeight;
    const scaledWidth = previewWidth * sourceZoomLevel;
    const scaledHeight = previewHeight * sourceZoomLevel;

    const minOffsetX = Math.min(0, containerWidth - scaledWidth);
    const maxOffsetX = 0;
    const minOffsetY = Math.min(0, containerHeight - scaledHeight);
    const maxOffsetY = 0;

    let clampedX = currentOffsetX;
    let clampedY = currentOffsetY;

    if (scaledWidth <= containerWidth) {
        clampedX = (containerWidth - scaledWidth) / 2;
    } else {
        clampedX = Math.max(minOffsetX, Math.min(maxOffsetX, currentOffsetX));
    }

    if (scaledHeight <= containerHeight) {
        clampedY = (containerHeight - scaledHeight) / 2;
    } else {
        clampedY = Math.max(minOffsetY, Math.min(maxOffsetY, currentOffsetY));
    }

    const transformString = `translate(${clampedX.toFixed(2)}px, <span class="math-inline">\{clampedY\.toFixed\(2\)\}px\) scale\(</span>{sourceZoomLevel})`;
    sourcePreview.style.transform = transformString;

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
    const changedInput = event.target;

    if (!keepAspectRatioCheckbox?.checked) { return; }
    if (aspectRatio === null || aspectRatio <= 0) { console.warn('[uiUtils.handleDimensionChange] Aspect ratio unavailable or invalid.'); return; }
    if (!changedInput) { console.warn('[uiUtils.handleDimensionChange] Event target is null.'); return; }

    const newValue = parseInt(changedInput.value, 10);
    if (isNaN(newValue) || newValue <= 0) { return; }

    if (changedInput === outputWidthInput && outputHeightInput) {
        const calculatedHeight = Math.round(newValue / aspectRatio);
        outputHeightInput.value = String(calculatedHeight);
    } else if (changedInput === outputHeightInput && outputWidthInput) {
        const calculatedWidth = Math.round(newValue * aspectRatio);
        outputWidthInput.value = String(calculatedWidth);
    }
}

/**
 * Resets UI elements to their initial (unloaded) state.
 * Does NOT reset state variables anymore (handled by stateManager).
 * ADDED: Resets advanced toggle state.
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
        tilesXSlider, tilesYSlider, skewSlider, staggerSlider, scaleSlider, preTileXSlider, preTileYSlider, sourceZoomSlider,
        // <<< ADDED Debug Slider Elements >>>
        sqTriYStartMultSlider, sqTriYEndMultSlider, sqTriStartColSlider,
        sqTriColBufferSlider, sqTriStaggerRatioSlider, sqTriCenterRatioSlider,
        sqTriYStartMultValue, sqTriYEndMultValue, sqTriStartColValue,
        sqTriColBufferValue, sqTriStaggerRatioValue, sqTriCenterRatioValue,
         // <<< ADDED Advanced Toggle Elements >>>
        showAdvancedTilingToggle,
        advancedTilingOptions
    } = elements;

    // --- Reset UI Elements Values/Visibility/Disabled State ---
    if (imageLoader) imageLoader.value = '';
    if (sourcePreview) { sourcePreview.classList.add('hidden'); sourcePreview.src = '#'; sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; }
    if (sourcePreviewText) { sourcePreviewText.classList.remove('hidden'); sourcePreviewText.textContent = "Load image to pan/zoom source"; }
    if (finalPreview) { finalPreview.classList.add('hidden'); finalPreview.src = '#'; }
    if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview will appear here"; }
    if(sourcePreviewContainer) sourcePreviewContainer.style.cursor = 'default';
    if (saveButton) saveButton.disabled = true;
    if (applyEffectButton) applyEffectButton.disabled = true;
    if (undoButton) undoButton.disabled = true;
    if (redoButton) redoButton.disabled = true;
    tileShapeOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'grid') opt.checked = true; });
    mirrorOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'none') opt.checked = true; });
    if (outputWidthInput) { outputWidthInput.disabled = true; outputWidthInput.value = ''; }
    if (outputHeightInput) { outputHeightInput.disabled = true; outputHeightInput.value = ''; }
    if (keepAspectRatioCheckbox) { keepAspectRatioCheckbox.disabled = true; keepAspectRatioCheckbox.checked = true; }
    if (tilesXSlider) tilesXSlider.value = '1';
    if (tilesYSlider) tilesYSlider.value = '1';
    if (skewSlider) skewSlider.value = '0.5';
    if (staggerSlider) staggerSlider.value = '0.5';
    if (scaleSlider) scaleSlider.value = '1.0';
    if (preTileXSlider) preTileXSlider.value = '1';
    if (preTileYSlider) preTileYSlider.value = '1';
    if (sourceZoomSlider) sourceZoomSlider.value = '1.0';
    if (sourceZoomValueSpan) sourceZoomValueSpan.textContent = '1.0';
    if (preEffectSelector) { preEffectSelector.disabled = true; preEffectSelector.value = 'none'; }
    sliders?.forEach(el => { if (el) el.disabled = true; });
    selects?.forEach(el => { if (el) el.disabled = true; });
    if (preEffectIntensitySlider) preEffectIntensitySlider.value = '30';
    if (preEffectWaveAmplitudeSlider) preEffectWaveAmplitudeSlider.value = '10';
    if (preEffectWaveFrequencySlider) preEffectWaveFrequencySlider.value = '5';
    if (preEffectWavePhaseSlider) preEffectWavePhaseSlider.value = '0';
    if (preEffectWaveDirection) preEffectWaveDirection.value = 'horizontal';
    if (preEffectWaveType) preEffectWaveType.value = 'sine';
    if (sliceShiftDirection) sliceShiftDirection.value = 'horizontal';
    if (sliceShiftIntensitySlider) sliceShiftIntensitySlider.value = '30';
    if (pixelSortThresholdSlider) pixelSortThresholdSlider.value = '100';
    if (pixelSortDirection) pixelSortDirection.value = 'horizontal';
    if (pixelSortBy) pixelSortBy.value = 'brightness';
    // Reset Debug Sliders
    if (sqTriYStartMultSlider) sqTriYStartMultSlider.value = '1.5';
    if (sqTriYEndMultSlider) sqTriYEndMultSlider.value = '2.0';
    if (sqTriStartColSlider) sqTriStartColSlider.value = '-2';
    if (sqTriColBufferSlider) sqTriColBufferSlider.value = '4';
    if (sqTriStaggerRatioSlider) sqTriStaggerRatioSlider.value = '0.5';
    if (sqTriCenterRatioSlider) sqTriCenterRatioSlider.value = '0.5';
    if (sqTriYStartMultValue) sqTriYStartMultValue.textContent = '1.5';
    if (sqTriYEndMultValue) sqTriYEndMultValue.textContent = '2.0';
    if (sqTriStartColValue) sqTriStartColValue.textContent = '-2';
    if (sqTriColBufferValue) sqTriColBufferValue.textContent = '4';
    if (sqTriStaggerRatioValue) sqTriStaggerRatioValue.textContent = '0.50';
    if (sqTriCenterRatioValue) sqTriCenterRatioValue.textContent = '0.50';
    // Reset Advanced Toggle State
    if (showAdvancedTilingToggle) showAdvancedTilingToggle.checked = false;
    if (advancedTilingOptions) advancedTilingOptions.classList.add('hidden');

    // Clear Canvases
    [canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas].forEach((c) => {
        if (c?.width > 0 && c.height > 0) {
            try { c.getContext('2d')?.clearRect(0, 0, c.width, c.height); }
            catch (e) { console.error(" Error clearing canvas:", e); }
        }
    });

    // Update Button States via callback
    if (typeof updateHistoryButtonsFunc === 'function') { updateHistoryButtonsFunc(); }
    // Update UI Visibility via callbacks
    if (typeof updateTilingControlsVisibilityFunc === 'function') { updateTilingControlsVisibilityFunc(); }
    if (typeof updatePreEffectControlsVisibilityFunc === 'function') { updatePreEffectControlsVisibilityFunc(); }
    // Call slider handler to sync displays with reset values
    if (typeof handleSliderChangeFunc === 'function') { handleSliderChangeFunc(); }

    console.log('[uiUtils.resetUIState] UI Reset complete.');
}


// --- Panning Logic --- (Simplified helpers)
export function startPan(event, elements) {
    if (event.button !== 0) { return false; }
    if (event.target === elements?.sourcePreview) { event.preventDefault(); }
    if (elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grabbing'; }
    return true;
}
export function panMove(event, startDragX, startDragY, startOffsetX, startOffsetY) {
    const dx = event.pageX - startDragX;
    const dy = event.pageY - startDragY;
    const newOffsetX = startOffsetX + dx;
    const newOffsetY = startOffsetY + dy;
    return { newOffsetX, newOffsetY };
}
export function endPan(elements) {
   if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grab'; }
}

// --- Source Zoom Logic --- (Simplified helper)
export function handleSourceZoom(elements, currentStateSnapshot, stateUpdateFunc) {
    if (!currentStateSnapshot?.currentImage || !elements?.sourceZoomSlider) { return; }
    const newZoomLevel = parseFloat(elements.sourceZoomSlider.value);
    if (elements.sourceZoomValueSpan) { elements.sourceZoomValueSpan.textContent = newZoomLevel.toFixed(1); }
    if (typeof stateUpdateFunc === 'function') { stateUpdateFunc(newZoomLevel); }
}

// --- Slider Listener Setup ---
export function setupSliderListener(slider, valueDisplay, callback, formatter = val => val) {
    if (!slider) { return; }
    const update = () => {
        const currentValue = slider.value;
        if (valueDisplay) { try { valueDisplay.textContent = formatter(currentValue); } catch (e) { /* ignore */ } }
        if (typeof callback === 'function') { try { callback(); } catch (e) { /* ignore */ } }
    };
    slider.addEventListener('input', update);
    update(); // Initial update
}

/**
 * Updates the enabled/disabled state of undo/redo buttons based on history info.
 * @param {object} elements - Object containing references to undoButton and redoButton.
 * @param {object} historyInfo - Object like { index: number, length: number }.
 */
export function updateUndoRedoButtons(elements, historyInfo) {
    if (elements.undoButton) elements.undoButton.disabled = historyInfo.index <= 0;
    if (elements.redoButton) elements.redoButton.disabled = historyInfo.index >= historyInfo.length - 1;
}


console.log('[uiUtils] Module loaded successfully.');
