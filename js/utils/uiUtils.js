// js/utils/uiUtils.js

console.log('[uiUtils] Module loading...');

// Effects that might be slow for real-time preview before tiling
const drawingPreEffects = ['fractalZoom', 'pixelSort', 'sierpinski']; // Keep as is

/**
 * Displays a message to the user, optionally styled as an error.
 */
export function showMessage(message, isError = false, messageBox) {
    if (!messageBox) {
        console.warn('[uiUtils.showMessage] MessageBox element not provided or found.');
        return;
    }
    messageBox.textContent = message;
    const messageClass = `mt-4 text-center font-medium h-6 ${isError ? 'text-red-600' : 'text-green-600'}`;
    messageBox.className = messageClass;
    messageBox.classList.remove('hidden');

    // Simple clear timer
    if (messageBox._messageTimeout) {
        clearTimeout(messageBox._messageTimeout);
    }
    messageBox._messageTimeout = setTimeout(() => {
        // Check if the message is still the same one we set, avoids clearing newer messages
        if (messageBox.textContent === message) {
            messageBox.classList.add('hidden');
            messageBox.textContent = '';
        }
        messageBox._messageTimeout = null; // Clear the stored timeout ID
    }, 5000);
}


/**
 * Updates the visibility and labels of TILING controls based on the selected tile shape.
 */
export function updateTilingControlsVisibility(elements, handleSliderChangeFunc) {
    const {
        tileShapeOptions, skewControl, staggerControl, tilesXLabel, tilesYLabel,
        scaleLabel, scaleSlider, scaleValueSpan, tilesXYHelpText
    } = elements;

    if (!tileShapeOptions || !skewControl || !staggerControl || !tilesXLabel || !tilesYLabel || !scaleLabel || !scaleSlider || !scaleValueSpan || !tilesXYHelpText ) {
        console.warn("[uiUtils.updateTilingControlsVisibility] Missing one or more required tiling control elements.");
        return;
    }

    const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';

    // Ensure controls are initially hidden or visible based on default ('grid')
    skewControl.classList.add('hidden-control');
    staggerControl.classList.add('hidden-control');
    tilesXYHelpText.classList.add('hidden-control');

    let defaultScale = 1.0;
    let scaleLabelText = 'Shape Scale';
    let xLabel = 'Tiles X';
    let yLabel = 'Tiles Y';
    let showHelpText = false;
    let needsSliderUpdate = false; // Flag if default scale changes

    switch (selectedShape) {
        case 'grid': case 'brick_wall': scaleLabelText = 'Tile Scale'; break;
        case 'herringbone': case 'basketweave': xLabel = 'Planks X'; yLabel = 'Planks Y'; scaleLabelText = 'Plank Scale'; break;
        case 'skewed':
            skewControl.classList.remove('hidden-control');
            staggerControl.classList.remove('hidden-control');
            scaleLabelText = 'Overlap Scale';
            defaultScale = 1.05; // Change default scale
            needsSliderUpdate = true; // Mark that scale slider needs update
            break;
        case 'hexagon': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Hexagon Scale'; showHelpText = true; break;
        case 'semi_octagon_square': xLabel = 'Approx Tiles X'; yLabel = 'Approx Tiles Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'l_shape_square': xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'hexagon_triangle': xLabel = 'Approx Hex X'; yLabel = 'Approx Hex Y'; scaleLabelText = 'Shape Scale'; showHelpText = true; break;
        case 'square_triangle':
            xLabel = 'Approx Units X'; yLabel = 'Approx Units Y'; scaleLabelText = 'Shape Scale'; showHelpText = true;
            break;
        case 'rhombus': xLabel = 'Rhombus Count X'; yLabel = 'Rhombus Count Y'; scaleLabelText = 'Rhombus Scale'; break;
        default: console.warn(`[uiUtils.updateTilingControlsVisibility] Unhandled tile shape: ${selectedShape}`);
    }

    if (tilesXLabel) tilesXLabel.textContent = xLabel;
    if (tilesYLabel) tilesYLabel.textContent = yLabel;
    if (scaleLabel) scaleLabel.textContent = scaleLabelText;

    // Update scale slider value only if it differs from the new default for the selected shape
    if (needsSliderUpdate && scaleSlider && scaleSlider.value !== defaultScale.toString()) {
        scaleSlider.value = String(defaultScale);
    }

    // Always update the scale value display based on the current slider value
    if (scaleSlider && scaleValueSpan) {
        try {
            scaleValueSpan.textContent = parseFloat(scaleSlider.value).toFixed(2);
        } catch (e) { console.error("Error updating scale value span:", e); }
    }


    if (tilesXYHelpText) {
        tilesXYHelpText.classList.toggle('hidden-control', !showHelpText);
    }

    // Call the main slider change handler IF the scale was programmatically changed OR if it's needed generally
    if (needsSliderUpdate && typeof handleSliderChangeFunc === 'function') {
        handleSliderChangeFunc(); // Trigger update if value changed
    }
}


/**
 * Updates visibility of PRE-EFFECT controls based on the selected effect.
 */
export function updatePreEffectControlsVisibility(elements) {
    const {
        preEffectSelector, preEffectOptionsContainer, preEffectIntensityControl,
        preEffectIntensitySlider, preEffectIntensityValue, preEffectWaveDistortionOptions,
        preEffectRealtimeWarning,
        sliceShiftOptions, pixelSortOptions
    } = elements;

    if (!preEffectSelector || !preEffectOptionsContainer || !preEffectIntensityControl || !preEffectWaveDistortionOptions || !preEffectRealtimeWarning || !sliceShiftOptions || !pixelSortOptions) {
        console.warn("[uiUtils.updatePreEffectControlsVisibility] Missing one or more required pre-effect control elements.");
        return;
    }
    const selectedEffect = preEffectSelector.value;

    // Hide all specific option groups first
    preEffectOptionsContainer?.querySelectorAll('.effect-option-group').forEach(el => el.classList.add('hidden'));
    preEffectRealtimeWarning?.classList.add('hidden');
    preEffectIntensityControl?.classList.add('hidden'); // Hide generic intensity initially


    let specificControlsShown = false;
    if (selectedEffect === 'none') {
        specificControlsShown = true;
    } else if (selectedEffect === 'waveDistortion') {
        preEffectWaveDistortionOptions?.classList.remove('hidden');
        specificControlsShown = true;
    } else if (selectedEffect === 'sliceShift') {
        sliceShiftOptions?.classList.remove('hidden');
        specificControlsShown = true;
    } else if (selectedEffect === 'pixelSort') {
        pixelSortOptions?.classList.remove('hidden');
        specificControlsShown = true;
    }

    // If no specific controls were shown, check if the effect uses generic intensity
    if (!specificControlsShown) {
        const usesGenericIntensity = ['channelShift', 'blockDisplace', 'noise', 'invertBlocks', 'sierpinski', 'fractalZoom', 'scanLines'];
        const showIntensity = usesGenericIntensity.includes(selectedEffect);

        if (showIntensity) {
            preEffectIntensityControl?.classList.remove('hidden'); // Show the generic control group
            if (preEffectIntensitySlider) {
                const intensityLabel = preEffectIntensityControl?.querySelector('label[for="preEffectIntensitySlider"]');
                if (intensityLabel) {
                    let labelText = 'Intensity:'; let maxVal = 100; let minVal = 1;
                    if (selectedEffect === 'fractalZoom' || selectedEffect === 'sierpinski') { labelText = 'Intensity/Depth:'; }
                    else if (selectedEffect === 'scanLines') { labelText = 'Darkness:'; minVal = 0; }
                    intensityLabel.textContent = labelText;
                    preEffectIntensitySlider.max = String(maxVal);
                    preEffectIntensitySlider.min = String(minVal);
                }
                const currentValue = parseFloat(preEffectIntensitySlider.value);
                const clampedValue = Math.max(parseFloat(preEffectIntensitySlider.min), Math.min(parseFloat(preEffectIntensitySlider.max), currentValue));
                if (currentValue !== clampedValue) {
                    preEffectIntensitySlider.value = String(clampedValue);
                }
                if (preEffectIntensityValue) {
                     preEffectIntensityValue.textContent = preEffectIntensitySlider.value;
                }
            }
        }
    }

    // Show warning for potentially slow effects
    if (preEffectRealtimeWarning) {
         preEffectRealtimeWarning.classList.toggle('hidden', !drawingPreEffects.includes(selectedEffect));
    }
}

/**
 * Updates visibility of GENERATOR controls based on the selected algorithm.
 * (MODIFIED to handle reactionDiffusionOptions)
 */
export function updateGeneratorControlsVisibility(elements) {
    if (!elements.generatorType) {
         console.warn("[uiUtils.updateGeneratorControlsVisibility] Generator type dropdown not found.");
         return;
    }
    const selectedGenerator = elements.generatorType.value;

    // Hide all generator-specific option groups first using a common class
    document.querySelectorAll('.generator-options').forEach(el => el.classList.add('hidden'));

    // Show the relevant options container based on the selected value
    if (selectedGenerator === 'perlin') {
        elements.perlinOptions?.classList.remove('hidden');
    } else if (selectedGenerator === 'reactionDiffusion') { // <<< ADDED
        elements.reactionDiffusionOptions?.classList.remove('hidden');
    }
    // else if (selectedGenerator === '...') { elements.someOtherOptionsContainer?.classList.remove('hidden'); }

    // console.log(`[uiUtils] Updated generator controls visibility for: ${selectedGenerator}`);
}


/**
 * Updates the transform (pan/zoom) of the source preview image.
 */
export function updateSourcePreviewTransform(elements, currentState) {
    const { sourcePreview, sourcePreviewContainer } = elements;
    let { sourceZoomLevel = 1.0, currentOffsetX = 0, currentOffsetY = 0 } = currentState || {};

    if (!sourcePreview || !sourcePreviewContainer) { return { clampedX: 0, clampedY: 0 }; }

    const previewWidth = sourcePreview.naturalWidth || currentState?.originalWidth || 0;
    const previewHeight = sourcePreview.naturalHeight || currentState?.originalHeight || 0;

    if (!previewWidth || !previewHeight) {
        sourcePreview.style.transform = 'translate(0px, 0px) scale(1)';
        return { clampedX: 0, clampedY: 0 };
    }

    const containerWidth = sourcePreviewContainer.clientWidth;
    const containerHeight = sourcePreviewContainer.clientHeight;
    const scaledWidth = previewWidth * sourceZoomLevel;
    const scaledHeight = previewHeight * sourceZoomLevel;

    const minOffsetX = Math.min(0, containerWidth - scaledWidth);
    const maxOffsetX = 0;
    const minOffsetY = Math.min(0, containerHeight - scaledHeight);
    const maxOffsetY = 0;

    let clampedX = scaledWidth <= containerWidth ? (containerWidth - scaledWidth) / 2 : Math.max(minOffsetX, Math.min(maxOffsetX, currentOffsetX));
    let clampedY = scaledHeight <= containerHeight ? (containerHeight - scaledHeight) / 2 : Math.max(minOffsetY, Math.min(maxOffsetY, currentOffsetY));

    sourcePreview.style.transform = `translate(${clampedX.toFixed(2)}px, ${clampedY.toFixed(2)}px) scale(${sourceZoomLevel})`;
    return { clampedX, clampedY };
}


/**
 * Handles changes in the output dimension inputs to maintain aspect ratio.
 */
export function handleDimensionChange(event, elements, aspectRatio) {
    const { outputWidthInput, outputHeightInput, keepAspectRatioCheckbox } = elements;
    const changedInput = event.target;
    if (!keepAspectRatioCheckbox?.checked || aspectRatio === null || aspectRatio <= 0 || !changedInput) { return; }
    const newValue = parseInt(changedInput.value, 10);
    if (isNaN(newValue) || newValue <= 0) { return; }

    if (changedInput === outputWidthInput && outputHeightInput) {
         outputHeightInput.value = String(Math.round(newValue / aspectRatio));
    } else if (changedInput === outputHeightInput && outputWidthInput) {
         outputWidthInput.value = String(Math.round(newValue * aspectRatio));
    }
}

/**
 * Resets UI elements to their initial (unloaded/startup) state.
 * (MODIFIED to include Reaction-Diffusion controls)
 */
export function resetUIState(
    elements,
    updateTilingControlsVisibilityFunc,
    updatePreEffectControlsVisibilityFunc,
    handleSliderChangeFunc,
    updateHistoryButtonsFunc,
    updateGeneratorControlsVisibilityFunc // Parameter for generator visibility update
) {
    console.log('[uiUtils.resetUIState] Resetting UI elements...');
    const {
        // Keep existing element references...
        imageLoader, sourcePreview, sourcePreviewText, finalPreview, finalPreviewText,
        saveButton, applyEffectButton, undoButton, redoButton,
        tileShapeOptions, mirrorOptions, sliders, selects,
        outputWidthInput, outputHeightInput, keepAspectRatioCheckbox, sourceZoomValueSpan, sourceZoomSlider,
        canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas, sourcePreviewContainer,
        preEffectSelector, preEffectIntensitySlider, preEffectWaveAmplitudeSlider,
        preEffectWaveFrequencySlider, preEffectWavePhaseSlider, preEffectWaveDirection,
        preEffectWaveType, sliceShiftDirection, sliceShiftIntensitySlider,
        pixelSortThresholdSlider, pixelSortDirection, pixelSortBy,
        tilesXSlider, tilesYSlider, skewSlider, staggerSlider, scaleSlider, preTileXSlider, preTileYSlider,
        // Generator Element References
        generatorType, generatorWidth, generatorHeight, generatePatternButton,
        perlinScale, perlinColor1, perlinColor2,
        // <<< ADDED Reaction-Diffusion References >>>
        rdFeedSlider, rdKillSlider, rdIterationsSlider
    } = elements;

    // --- Reset UI Elements ---
    if (imageLoader) imageLoader.value = '';
    if (sourcePreview) { sourcePreview.classList.add('hidden'); sourcePreview.src = '#'; sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; }
    if (sourcePreviewText) { sourcePreviewText.classList.remove('hidden'); sourcePreviewText.textContent = "Load image or generate pattern"; }
    if (finalPreview) { finalPreview.classList.add('hidden'); finalPreview.src = '#'; }
    if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview will appear here"; }
    if(sourcePreviewContainer) sourcePreviewContainer.style.cursor = 'default';

    // Buttons
    if (saveButton) saveButton.disabled = true;
    if (applyEffectButton) applyEffectButton.disabled = true;
    if (undoButton) undoButton.disabled = true;
    if (redoButton) redoButton.disabled = true;

    // Options
    tileShapeOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'grid') opt.checked = true; });
    mirrorOptions?.forEach(opt => { opt.disabled = true; if (opt.value === 'none') opt.checked = true; });

    // Output dimensions
    if (outputWidthInput) { outputWidthInput.disabled = true; outputWidthInput.value = ''; }
    if (outputHeightInput) { outputHeightInput.disabled = true; outputHeightInput.value = ''; }
    if (keepAspectRatioCheckbox) { keepAspectRatioCheckbox.disabled = true; keepAspectRatioCheckbox.checked = true; }

    // Tiling sliders
    if (tilesXSlider) tilesXSlider.value = '1';
    if (tilesYSlider) tilesYSlider.value = '1';
    if (skewSlider) skewSlider.value = '0.5';
    if (staggerSlider) staggerSlider.value = '0.5';
    if (scaleSlider) scaleSlider.value = '1.0';
    if (preTileXSlider) preTileXSlider.value = '1';
    if (preTileYSlider) preTileYSlider.value = '1';

    // Source zoom
    if (sourceZoomSlider) { sourceZoomSlider.disabled = true; sourceZoomSlider.value = '1.0'; }
    if (sourceZoomValueSpan) sourceZoomValueSpan.textContent = '1.0';

    // Effect controls
    if (preEffectSelector) { preEffectSelector.disabled = true; preEffectSelector.value = 'none'; }
    if (preEffectIntensitySlider) preEffectIntensitySlider.value = '30';
    if (preEffectWaveAmplitudeSlider) preEffectWaveAmplitudeSlider.value = '10';
    // ... reset other effect controls ...
    if (sliceShiftIntensitySlider) sliceShiftIntensitySlider.value = '30';
    if (pixelSortThresholdSlider) pixelSortThresholdSlider.value = '100';


    // --- RESET Generator Controls (Enable them for initial state) ---
    if (generatorType) { generatorType.disabled = false; generatorType.value = 'perlin'; } // Default to perlin/simple noise
    if (generatorWidth) { generatorWidth.disabled = false; generatorWidth.value = '512'; }
    if (generatorHeight) { generatorHeight.disabled = false; generatorHeight.value = '512'; }
    if (generatePatternButton) generatePatternButton.disabled = false;
    // Perlin controls
    if (perlinScale) { perlinScale.disabled = false; perlinScale.value = '50'; }
    if (perlinColor1) { perlinColor1.disabled = false; perlinColor1.value = '#000000'; }
    if (perlinColor2) { perlinColor2.disabled = false; perlinColor2.value = '#ffffff'; }
    // <<< ADDED Reaction-Diffusion Resets >>>
    if (rdFeedSlider) { rdFeedSlider.disabled = false; rdFeedSlider.value = '0.055'; } // Default F value
    if (rdKillSlider) { rdKillSlider.disabled = false; rdKillSlider.value = '0.062'; } // Default k value
    if (rdIterationsSlider) { rdIterationsSlider.disabled = false; rdIterationsSlider.value = '50'; } // Default iterations

    // Disable all grouped sliders/selects initially (individual controls enabled above/below)
    sliders?.forEach(el => { if(el) el.disabled = true; });
    selects?.forEach(el => { if(el) el.disabled = true; });

    // Re-enable specific controls needed at start
    if (generatorType) generatorType.disabled = false;
    if (generatorWidth) generatorWidth.disabled = false;
    if (generatorHeight) generatorHeight.disabled = false;
    if (generatePatternButton) generatePatternButton.disabled = false;
    if (perlinScale) perlinScale.disabled = false; // Re-enable controls for default generator
    if (perlinColor1) perlinColor1.disabled = false;
    if (perlinColor2) perlinColor2.disabled = false;
    if (rdFeedSlider) rdFeedSlider.disabled = false; // Enable RD sliders too initially
    if (rdKillSlider) rdKillSlider.disabled = false;
    if (rdIterationsSlider) rdIterationsSlider.disabled = false;


    // --- Clear Canvases ---
    [canvas, preTileCanvas, mirrorCanvas, sourceEffectCanvas].forEach((c) => {
        if (c && c.width > 0 && c.height > 0) {
            try {
                const ctx = c.getContext('2d');
                if (ctx) { ctx.clearRect(0, 0, c.width, c.height); }
            } catch (e) { console.error(" Error clearing canvas:", e); }
        } else if (c) {
             c.width = 0; c.height = 0; // Reset dimensions if invalid
        }
    });

    // --- Update Button States via callback ---
    if (typeof updateHistoryButtonsFunc === 'function') { updateHistoryButtonsFunc(); }

    // --- Update UI Visibility via callbacks ---
    if (typeof updateTilingControlsVisibilityFunc === 'function') { updateTilingControlsVisibilityFunc(); }
    if (typeof updatePreEffectControlsVisibilityFunc === 'function') { updatePreEffectControlsVisibilityFunc(); }
    if (typeof updateGeneratorControlsVisibilityFunc === 'function') { updateGeneratorControlsVisibilityFunc(); }

    // --- Call slider handler to sync displays with reset values ---
    if (typeof handleSliderChangeFunc === 'function') { handleSliderChangeFunc(); }

    console.log('[uiUtils.resetUIState] UI Reset complete.');
}


// --- Panning Logic --- (No change needed)
export function startPan(event, elements) {
    if (event.button !== 0 || elements.sourcePreview?.classList.contains('hidden')) { return false; }
    if (event.target === elements?.sourcePreview) { event.preventDefault(); }
    if (elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grabbing'; }
    return true;
}
export function panMove(event, startDragX, startDragY, startOffsetX, startOffsetY) {
    const dx = event.pageX - startDragX; const dy = event.pageY - startDragY;
    return { newOffsetX: startOffsetX + dx, newOffsetY: startOffsetY + dy };
}
export function endPan(elements) {
   if(elements?.sourcePreviewContainer) { elements.sourcePreviewContainer.style.cursor = 'grab'; }
}

// --- Source Zoom Logic --- (No change needed)
export function handleSourceZoom(elements, currentStateSnapshot, stateUpdateFunc) {
    if (!currentStateSnapshot?.originalWidth || !elements?.sourceZoomSlider) { return; }
    const newZoomLevel = parseFloat(elements.sourceZoomSlider.value);
    if (elements.sourceZoomValueSpan) { elements.sourceZoomValueSpan.textContent = newZoomLevel.toFixed(1); }
    if (typeof stateUpdateFunc === 'function') { stateUpdateFunc(newZoomLevel); }
}

// --- Slider Listener Setup ---
export function setupSliderListener(slider, valueDisplay, callback, formatter = val => val) {
    if (!slider) { return; }
    const update = () => {
        if (slider.disabled) return;
        const currentValue = slider.value;
        if (valueDisplay) { try { valueDisplay.textContent = formatter(currentValue); } catch (e) { console.warn("Error updating slider display:", e); } }
        if (typeof callback === 'function') { try { callback(); } catch (e) { console.warn("Error in slider callback:", e); } }
    };
    slider.addEventListener('input', update);
    slider.addEventListener('change', update);
    // Call update initially to set display (ensure callback handles potential null state)
    // Deferring this initial call slightly might be safer if state isn't ready
    // requestAnimationFrame(update); // Or call explicitly after initializeApp
}

/**
 * Updates the enabled/disabled state of undo/redo buttons based on history info.
 */
export function updateUndoRedoButtons(elements, historyInfo) {
    if (elements.undoButton) elements.undoButton.disabled = !historyInfo || historyInfo.index <= 0;
    if (elements.redoButton) elements.redoButton.disabled = !historyInfo || historyInfo.index >= historyInfo.length - 1;
}

console.log('[uiUtils] Module loaded successfully.');
