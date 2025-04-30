// js/utils/uiUtils.js (Single Effect UI - Includes New Effect Controls)

// Effects that might be slow for real-time preview before tiling
const drawingPreEffects = ['fractalZoom', 'pixelSort', 'sierpinski'];

/**
 * Displays a message to the user, optionally styled as an error.
 * @param {string} message - The message text.
 * @param {boolean} [isError=false] - True to style as an error.
 * @param {HTMLElement | null} messageBox - The message box element.
 */
export function showMessage(message, isError = false, messageBox) {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `mt-4 text-center font-medium h-6 ${isError ? 'text-red-600' : 'text-green-600'}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        if (messageBox.textContent === message) {
            messageBox.classList.add('hidden');
            messageBox.textContent = '';
        }
    }, 5000);
}

/**
 * Updates the visibility and labels of TILING controls based on the selected tile shape.
 * @param {object} elements - Object containing references to UI elements.
 * @param {Function} [handleSliderChangeFunc] - Optional: Function to call after updating visibility.
 */
export function updateTilingControlsVisibility(elements, handleSliderChangeFunc) {
    const {
        tileShapeOptions, skewControl, staggerControl, tilesXLabel, tilesYLabel,
        scaleLabel, scaleSlider, scaleValueSpan, tilesXYHelpText
    } = elements;
    if (!tileShapeOptions || !skewControl || !staggerControl || !tilesXLabel || !tilesYLabel || !scaleLabel || !scaleSlider || !scaleValueSpan || !tilesXYHelpText) { console.warn("Missing tiling control elements for visibility update."); return; }
    const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
    skewControl.classList.add('hidden-control'); staggerControl.classList.add('hidden-control'); tilesXYHelpText.classList.add('hidden-control');
    let defaultScale = 1.0; let scaleLabelText = 'Shape Scale'; let xLabel = 'Tiles X'; let yLabel = 'Tiles Y'; let showHelpText = false;
    switch (selectedShape) {
        case 'grid': case 'brick_wall': scaleLabelText = 'Tile Scale'; break;
        case 'herringbone': case 'basketweave': xLabel = 'Planks X'; yLabel = 'Planks Y'; scaleLabelText = 'Plank Scale'; break;
        case 'skewed': skewControl.classList.remove('hidden-control'); staggerControl.classList.remove('hidden-control'); scaleLabelText = 'Overlap Scale'; defaultScale = 1.05; break;
        case 'hexagon': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Hexagon Scale'; showHelpText = true; break;
        case 'semi_octagon_square': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'l_shape_square': xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'hexagon_triangle': xLabel = 'Approx Hex X'; yLabel = 'Approx Hex Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'square_triangle': xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'rhombus': xLabel = 'Rhombus Count X'; yLabel = 'Rhombus Count Y'; scaleLabelText = 'Rhombus Scale'; break;
    }
    tilesXLabel.textContent = xLabel; tilesYLabel.textContent = yLabel; scaleLabel.textContent = scaleLabelText;
    if (scaleSlider.value !== defaultScale.toString()) { scaleSlider.value = defaultScale; if(scaleValueSpan) scaleValueSpan.textContent = defaultScale.toFixed(2); }
    else if (scaleValueSpan) { scaleValueSpan.textContent = parseFloat(scaleSlider.value).toFixed(2); }
    tilesXYHelpText.classList.toggle('hidden-control', !showHelpText);
    if (typeof handleSliderChangeFunc === 'function') { handleSliderChangeFunc(); }
}


/**
 * Updates visibility of PRE-EFFECT controls based on the selected effect.
 * @param {object} elements - Object containing references to pre-effect UI elements.
 */
export function updatePreEffectControlsVisibility(elements) {
    const {
        preEffectSelector, preEffectOptionsContainer, preEffectIntensityControl,
        preEffectIntensitySlider, preEffectIntensityValue, preEffectWaveDistortionOptions,
        preEffectRealtimeWarning,
        // Add new option group elements
        sliceShiftOptions, pixelSortOptions
    } = elements;
    // Check required elements exist
    if (!preEffectSelector || !preEffectOptionsContainer || !preEffectIntensityControl || !preEffectWaveDistortionOptions || !preEffectRealtimeWarning || !sliceShiftOptions || !pixelSortOptions) {
         console.warn("Missing pre-effect control elements for visibility update.");
         return;
    }

    const selectedEffect = preEffectSelector.value;

    // Hide all specific option groups first
    preEffectOptionsContainer.querySelectorAll('.effect-option-group').forEach(el => el.classList.add('hidden'));
    preEffectRealtimeWarning.classList.add('hidden');

    if (selectedEffect === 'none') { /* No controls */ }
    else if (selectedEffect === 'waveDistortion') {
        preEffectWaveDistortionOptions.classList.remove('hidden');
        preEffectIntensityControl.classList.add('hidden');
    } else if (selectedEffect === 'sliceShift') {
        sliceShiftOptions.classList.remove('hidden');
        preEffectIntensityControl.classList.add('hidden');
    } else if (selectedEffect === 'pixelSort') {
        pixelSortOptions.classList.remove('hidden');
        preEffectIntensityControl.classList.add('hidden');
    }
    // Add else if blocks here for other effects with specific controls
    else {
        // Show generic intensity slider for effects that use it
        const usesGenericIntensity = ['channelShift', 'blockDisplace', 'noise', 'invertBlocks', 'sierpinski', 'fractalZoom', 'scanLines'];
        const showIntensity = usesGenericIntensity.includes(selectedEffect);
        preEffectIntensityControl.classList.toggle('hidden', !showIntensity);

        if (showIntensity && preEffectIntensitySlider) {
            const intensityLabel = preEffectIntensityControl.querySelector('label');
            if (intensityLabel) {
                 if (selectedEffect === 'fractalZoom' || selectedEffect === 'sierpinski') { intensityLabel.textContent = 'Intensity/Depth:'; preEffectIntensitySlider.max = 100; preEffectIntensitySlider.min=1;}
                 else if (selectedEffect === 'scanLines') { intensityLabel.textContent = 'Darkness:'; preEffectIntensitySlider.max = 100; preEffectIntensitySlider.min=0;}
                 else { intensityLabel.textContent = 'Intensity:'; preEffectIntensitySlider.max = 100; preEffectIntensitySlider.min=1;}
            }
             preEffectIntensitySlider.value = Math.max(parseFloat(preEffectIntensitySlider.min), Math.min(parseFloat(preEffectIntensitySlider.max), parseFloat(preEffectIntensitySlider.value)));
            if(preEffectIntensityValue) preEffectIntensityValue.textContent = preEffectIntensitySlider.value;
        }
    }

    // Show warning for potentially slow effects
    if (drawingPreEffects.includes(selectedEffect)) {
        preEffectRealtimeWarning.classList.remove('hidden');
    }
}

/**
 * Updates the transform (pan/zoom) of the source preview image.
 * @param {object} elements - UI elements including sourcePreview, sourcePreviewContainer.
 * @param {object} state - Application state including sourceZoomLevel, currentOffsetX, currentOffsetY.
 * @returns {{ clampedX: number, clampedY: number }} The clamped offset values.
 */
export function updateSourcePreviewTransform(elements, state) {
    const { sourcePreview, sourcePreviewContainer } = elements;
    let { sourceZoomLevel, currentOffsetX, currentOffsetY } = state;
    if (!sourcePreview || !sourcePreviewContainer || !sourcePreview.naturalWidth || !sourcePreview.naturalHeight) { if (sourcePreview) sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; return { clampedX: 0, clampedY: 0 }; }
    const previewWidth = sourcePreview.naturalWidth; const previewHeight = sourcePreview.naturalHeight;
    const containerWidth = sourcePreviewContainer.clientWidth; const containerHeight = sourcePreviewContainer.clientHeight;
    const scaledWidth = previewWidth * sourceZoomLevel; const scaledHeight = previewHeight * sourceZoomLevel;
    const maxOffsetX = Math.max(0, (containerWidth - scaledWidth) / 2); const maxOffsetY = Math.max(0, (containerHeight - scaledHeight) / 2);
    const minOffsetX = containerWidth - scaledWidth - maxOffsetX; const minOffsetY = containerHeight - scaledHeight - maxOffsetY;
    const safeMinOffsetX = isFinite(minOffsetX) ? minOffsetX : 0; const safeMinOffsetY = isFinite(minOffsetY) ? minOffsetY : 0;
    const clampedX = Math.max(safeMinOffsetX, Math.min(maxOffsetX, currentOffsetX));
    const clampedY = Math.max(safeMinOffsetY, Math.min(maxOffsetY, currentOffsetY));
    sourcePreview.style.transform = `translate(${clampedX}px, ${clampedY}px) scale(${sourceZoomLevel})`;
    return { clampedX, clampedY };
}


/**
 * Handles changes in the output dimension inputs to maintain aspect ratio.
 * @param {Event} event - The input event.
 * @param {object} elements - UI elements including outputWidthInput, outputHeightInput, keepAspectRatioCheckbox.
 * @param {object} state - Application state including originalAspectRatio, currentImage.
 */
export function handleDimensionChange(event, elements, state) {
    const { outputWidthInput, outputHeightInput, keepAspectRatioCheckbox } = elements;
    const { currentImage, originalAspectRatio } = state;
    if (!currentImage || !keepAspectRatioCheckbox?.checked || !originalAspectRatio) return;
    const changedInput = event.target; if (!changedInput) return;
    const newValue = parseInt(changedInput.value, 10); if (isNaN(newValue) || newValue <= 0) return;
    if (changedInput === outputWidthInput && outputHeightInput) { outputHeightInput.value = Math.round(newValue / originalAspectRatio); }
    else if (changedInput === outputHeightInput && outputWidthInput) { outputWidthInput.value = Math.round(newValue * originalAspectRatio); }
}

/**
 * Resets the application state and UI elements to their initial (unloaded) state.
 * @param {object} elements - All relevant UI elements.
 * @param {object} state - The application state object to reset.
 * @param {Function} updateTilingControlsVisibilityFunc - Callback to update tiling controls visibility.
 * @param {Function} updatePreEffectControlsVisibilityFunc - Callback to update pre-effect controls visibility.
 * @param {Function} handleSliderChangeFunc - Callback to handle slider changes (to reset values).
 */
export function resetState(elements, state, updateTilingControlsVisibilityFunc, updatePreEffectControlsVisibilityFunc, handleSliderChangeFunc) {
    const {
        // Destructure all needed elements, including new ones
        imageLoader, sourcePreview, sourcePreviewText, finalPreview, finalPreviewText,
        saveButton, tileShapeOptions, mirrorOptions, sliders, selects,
        outputWidthInput, outputHeightInput, keepAspectRatioCheckbox, sourceZoomValueSpan,
        canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas, sourcePreviewContainer,
        // Pre-effect controls
        preEffectSelector, preEffectIntensitySlider, preEffectWaveAmplitudeSlider,
        preEffectWaveFrequencySlider, preEffectWavePhaseSlider, preEffectWaveDirection,
        preEffectWaveType,
        // New effect controls
        sliceShiftDirection, sliceShiftIntensitySlider,
        pixelSortThresholdSlider, pixelSortDirection, pixelSortBy
    } = elements;

    // --- Reset UI Elements ---
    if (imageLoader) imageLoader.value = '';
    if (sourcePreview) { sourcePreview.classList.add('hidden'); sourcePreview.src = '#'; sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; }
    if (sourcePreviewText) { sourcePreviewText.classList.remove('hidden'); sourcePreviewText.textContent = "Load image to pan/zoom source"; }
    if (finalPreview) { finalPreview.classList.add('hidden'); finalPreview.src = '#'; }
    if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview will appear here"; }
    if(sourcePreviewContainer) sourcePreviewContainer.style.cursor = 'default';
    if (saveButton) saveButton.disabled = true;

    // Disable/Reset Tiling Controls
    tileShapeOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'grid') opt.checked = true; });
    mirrorOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'none') opt.checked = true; });
    if (outputWidthInput) { outputWidthInput.disabled = true; outputWidthInput.value = ''; }
    if (outputHeightInput) { outputHeightInput.disabled = true; outputHeightInput.value = ''; }
    if (keepAspectRatioCheckbox) { keepAspectRatioCheckbox.disabled = true; keepAspectRatioCheckbox.checked = true; }
    // Reset Tiling Slider Values to 1x1 defaults
    if (elements.tilesXSlider) elements.tilesXSlider.value = 1;
    if (elements.tilesYSlider) elements.tilesYSlider.value = 1;
    if (elements.skewSlider) elements.skewSlider.value = 0.5;
    if (elements.staggerSlider) elements.staggerSlider.value = 0.5;
    if (elements.scaleSlider) elements.scaleSlider.value = 1.0;
    if (elements.preTileXSlider) elements.preTileXSlider.value = 1;
    if (elements.preTileYSlider) elements.preTileYSlider.value = 1;
    if (elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
    if (sourceZoomValueSpan) sourceZoomValueSpan.textContent = '1.0';

    // --- Disable/Reset Pre-Effect Controls ---
    if (preEffectSelector) { preEffectSelector.disabled = true; preEffectSelector.value = 'none'; }
    // Disable all sliders and selects
    sliders?.forEach(el => { if(el) el.disabled = true; });
    selects?.forEach(el => { if(el) el.disabled = true; });
    // Reset pre-effect slider values to defaults
    if (elements.preEffectIntensitySlider) elements.preEffectIntensitySlider.value = 30; // Default 30
    if (elements.preEffectWaveAmplitudeSlider) elements.preEffectWaveAmplitudeSlider.value = 10;
    if (elements.preEffectWaveFrequencySlider) elements.preEffectWaveFrequencySlider.value = 5;
    if (elements.preEffectWavePhaseSlider) elements.preEffectWavePhaseSlider.value = 0;
    if (elements.preEffectWaveDirection) elements.preEffectWaveDirection.value = 'horizontal';
    if (elements.preEffectWaveType) elements.preEffectWaveType.value = 'sine';
    // Reset NEW effect controls
    if (sliceShiftDirection) sliceShiftDirection.value = 'horizontal';
    if (sliceShiftIntensitySlider) sliceShiftIntensitySlider.value = 30;
    if (pixelSortThresholdSlider) pixelSortThresholdSlider.value = 100;
    if (pixelSortDirection) pixelSortDirection.value = 'horizontal';
    if (pixelSortBy) pixelSortBy.value = 'brightness';


    // Clear Canvases
    [canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas].forEach(c => {
        if (c && c.width > 0) { try { const ctx = c.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c.width, c.height); } catch(e) {} }
    });

    // --- Reset State Variables ---
    state.currentImage = null;
    state.originalWidth = 0; state.originalHeight = 0; state.originalAspectRatio = 1;
    state.originalFileName = 'downloaded-image.png';
    state.isProcessing = false; state.isDragging = false;
    state.currentOffsetX = 0; state.currentOffsetY = 0;
    state.startOffsetX = 0; state.startOffsetY = 0;
    state.sourceZoomLevel = 1.0;
    if(state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
    // No effect stack to clear

    // Update UI based on reset state
    if (typeof updateTilingControlsVisibilityFunc === 'function') updateTilingControlsVisibilityFunc();
    if (typeof updatePreEffectControlsVisibilityFunc === 'function') updatePreEffectControlsVisibilityFunc();
    if (typeof handleSliderChangeFunc === 'function') handleSliderChangeFunc();
}


// --- Panning Logic ---
export function startPan(event, elements, state) {
    if (!state.currentImage || event.button !== 0) return;
    if (event.target === elements.sourcePreview) { event.preventDefault(); }
    state.isDragging = true;
    state.dragStartX = event.pageX; state.dragStartY = event.pageY;
    state.startOffsetX = state.currentOffsetX; state.startOffsetY = state.currentOffsetY;
    if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grabbing';
}

export function panMove(event, elements, state, updateSourcePreviewTransformFunc, handleSliderChangeFunc) {
    if (!state || !state.isDragging) return; // Added check for state
    const dx = event.pageX - state.dragStartX;
    const dy = event.pageY - state.dragStartY;
    state.currentOffsetX = state.startOffsetX + dx;
    state.currentOffsetY = state.startOffsetY + dy;
    // Ensure update functions are valid before calling
    if (typeof updateSourcePreviewTransformFunc === 'function'){
        const { clampedX, clampedY } = updateSourcePreviewTransformFunc();
        state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;
    }
    if (typeof handleSliderChangeFunc === 'function') handleSliderChangeFunc();
}

export function endPan(elements, state) {
   if (!state || !state.isDragging) return; // Added check for state
   state.isDragging = false;
   if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
}

export function handleSourceZoom(elements, state, updateSourcePreviewTransformFunc, handleSliderChangeFunc) {
    if (!state || !state.currentImage || !elements.sourceZoomSlider) return; // Added check for state
    state.sourceZoomLevel = parseFloat(elements.sourceZoomSlider.value);
    if (elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = state.sourceZoomLevel.toFixed(1);
    if (typeof updateSourcePreviewTransformFunc === 'function') {
        const { clampedX, clampedY } = updateSourcePreviewTransformFunc();
        state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;
    }
    if (typeof handleSliderChangeFunc === 'function') handleSliderChangeFunc();
}

/**
* Sets up an event listener for a slider to update its display value and optionally trigger a callback.
* @param {HTMLInputElement | null} slider - The slider input element.
* @param {HTMLElement | null} valueDisplay - The element to display the slider's value.
* @param {Function} [callback] - Optional function to call when the slider value changes.
* @param {Function} [formatter=val => val] - Optional function to format the displayed value.
*/
export function setupSliderListener(slider, valueDisplay, callback, formatter = val => val) {
    if (!slider || !valueDisplay) { return; }
    const update = () => {
        // Check element exists inside closure too, just in case
        if (valueDisplay) valueDisplay.textContent = formatter(slider.value);
        if (typeof callback === 'function') { callback(); }
    };
    slider.addEventListener('input', update);
    update(); // Initial call
}
