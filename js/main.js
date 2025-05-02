// js/main.js

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetUIState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener, updateUndoRedoButtons,
    updateGeneratorControlsVisibility // <<< Ensure this is imported
 } from './utils/uiUtils.js';
import { processAndPreviewImage } from './tiling/core.js';
import * as stateManager from './stateManager.js';

// <<< Generator Imports >>>
// Ensure you have created these files (e.g., js/generators/...)
import { generatePerlinNoise } from './generators/perlinNoise.js';
import { generateReactionDiffusion } from './generators/reactionDiffusion.js'; // <<< ADDED Import

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

// --- Generator Function Map (Updated) ---
const generatorFunctions = {
    'perlin': generatePerlinNoise,
    'reactionDiffusion': generateReactionDiffusion // <<< ADDED
};


// --- Core Processing Functions ---

/**
 * Redraws the sourceEffectCanvas based on the current state (history or original image)
 * and applies the currently selected (but not yet committed) pre-effect for preview.
 * @returns {boolean} True if successful, false otherwise.
 */
function redrawSourceCanvasWithEffect() {
    const currentState = stateManager.getState();
    const currentHistoryState = stateManager.getCurrentHistoryState();
    const currentImage = currentState.currentImage;
    const sourceWidth = currentState.originalWidth;
    const sourceHeight = currentState.originalHeight;

    if (!elements.sourceEffectCanvas || !sourceEffectCtx) {
         console.error("redrawSourceCanvasWithEffect: Missing canvas or context.");
         return false;
    }
    if (!currentHistoryState && !currentImage) {
        if (elements.sourceEffectCanvas.width > 0 || elements.sourceEffectCanvas.height > 0) {
             try { sourceEffectCtx.clearRect(0, 0, elements.sourceEffectCanvas.width, elements.sourceEffectCanvas.height); } catch(e){}
        }
        return false;
    }
     if (!sourceWidth || !sourceHeight) {
        console.error(`redrawSourceCanvasWithEffect: Invalid source dimensions (Width: ${sourceWidth}, Height: ${sourceHeight}).`);
        return false;
     }

    const canvas = elements.sourceEffectCanvas;
    const ctx = sourceEffectCtx;

    if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
    }

    let baseImageData = null;

    try {
        if (currentHistoryState) {
             if (currentHistoryState.width !== canvas.width || currentHistoryState.height !== canvas.height) {
                 canvas.width = currentHistoryState.width; canvas.height = currentHistoryState.height;
             }
            ctx.putImageData(currentHistoryState, 0, 0);
            baseImageData = currentHistoryState;
        } else if (currentImage) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const { sourceZoomLevel, currentOffsetX, currentOffsetY } = currentState;
            const sourceRectWidth = sourceWidth / sourceZoomLevel;
            const sourceRectHeight = sourceHeight / sourceZoomLevel;
            const sourceRectX = -currentOffsetX / sourceZoomLevel;
            const sourceRectY = -currentOffsetY / sourceZoomLevel;
            if (sourceRectWidth <= 0 || sourceRectHeight <= 0 || isNaN(sourceRectX) || isNaN(sourceRectY)) throw new Error('Invalid source rect');
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage( currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else { throw new Error("No base state."); }
    } catch (e) { console.error("redrawSourceCanvasWithEffect: Error drawing base:", e); return false; }

    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction && baseImageData) {
         try {
             const imageDataForEffect = new ImageData( new Uint8ClampedArray(baseImageData.data), baseImageData.width, baseImageData.height );
             const effectContext = { sourceImageData: baseImageData };
             effectFunction(imageDataForEffect, params, effectContext);
             ctx.putImageData(imageDataForEffect, 0, 0);
         } catch (e) { console.error(`redrawSourceCanvasWithEffect: Error previewing '${effect}':`, e); return false; }
    }
    return true;
}


/**
 * Requests a full update of the final tiling preview canvas. Debounced.
 */
function requestFullUpdate() {
    let debounceTimer = stateManager.getState().debounceTimer;
    if (debounceTimer) {
        clearTimeout(debounceTimer);
         if (stateManager.getState().debounceTimer === debounceTimer) stateManager.getState().debounceTimer = null;
    }
    const newTimerId = setTimeout(async () => {
        const currentState = stateManager.getState();
        if (!currentState.originalWidth || !currentState.originalHeight || !elements.sourceEffectCanvas || !sourceEffectCtx || currentState.isProcessing) {
            if (!currentState.isProcessing) console.warn("requestFullUpdate skipped: Prerequisites failed or processing.");
            if (stateManager.getState().debounceTimer === newTimerId) stateManager.getState().debounceTimer = null;
            return;
        }
        stateManager.setProcessing(true);
        showMessage("Updating preview...", false, elements.messageBox);
        try {
            if (!redrawSourceCanvasWithEffect()) throw new Error("Source redraw failed.");
            processAndPreviewImage( elements.sourceEffectCanvas, elements, currentState, (msg, isErr) => showMessage(msg, isErr, elements.messageBox) );
        } catch (err) {
             console.error("requestFullUpdate Error:", err);
             showMessage(`Preview Error: ${err.message || 'Unknown'}`, true, elements.messageBox);
        } finally {
            stateManager.setProcessing(false);
             if (stateManager.getState().debounceTimer === newTimerId) stateManager.getState().debounceTimer = null;
        }
    }, 150);
    stateManager.getState().debounceTimer = newTimerId;
}



// --- Event Handlers ---

function updateHistoryButtonsUI() { updateUndoRedoButtons(elements, stateManager.getHistoryInfo()); }

function handleApplyEffectClick() {
    const currentState = stateManager.getState();
    const historyInfo = stateManager.getHistoryInfo();
    if (!currentState.originalWidth || historyInfo.length === 0 || historyInfo.index < 0) { showMessage("Load/generate first.", true, elements.messageBox); return; }
    if (!elements.sourceEffectCanvas || !sourceEffectCtx) { console.error("Apply Effect: Missing canvas."); return; }
    if (stateManager.isProcessing()) { showMessage("Processing...", true, elements.messageBox); return; }
    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];
    if (!effectFunction) { showMessage("No effect selected.", false, elements.messageBox); return; }
    console.log(`Applying effect: '${effect}'`);
    stateManager.setProcessing(true);
    try {
        const baseStateImageData = stateManager.getCurrentHistoryState();
        if (!baseStateImageData) throw new Error("No base state.");
         if (elements.sourceEffectCanvas.width !== baseStateImageData.width || elements.sourceEffectCanvas.height !== baseStateImageData.height) {
             elements.sourceEffectCanvas.width = baseStateImageData.width; elements.sourceEffectCanvas.height = baseStateImageData.height;
         }
        const imageDataToApplyEffect = new ImageData( new Uint8ClampedArray(baseStateImageData.data), baseStateImageData.width, baseStateImageData.height );
        effectFunction(imageDataToApplyEffect, params, { sourceImageData: baseStateImageData });
        stateManager.pushHistoryState(imageDataToApplyEffect);
        updateHistoryButtonsUI();
        requestFullUpdate();
        showMessage(`Effect "${effect}" applied.`, false, elements.messageBox);
    } catch (e) { console.error("Apply effect error:", e); showMessage(`Apply Error: ${e.message || 'Unknown'}`, true, elements.messageBox); }
    finally { stateManager.setProcessing(false); }
}

function handleUndoClick() {
     if (!sourceEffectCtx || stateManager.isProcessing()) return;
    if (stateManager.getHistoryInfo().index <= 0) return;
    const previousImageData = stateManager.undoState();
    if (previousImageData) {
         try {
             if (elements.sourceEffectCanvas.width !== previousImageData.width || elements.sourceEffectCanvas.height !== previousImageData.height) {
                 elements.sourceEffectCanvas.width = previousImageData.width; elements.sourceEffectCanvas.height = previousImageData.height;
             }
             sourceEffectCtx.putImageData(previousImageData, 0, 0);
             updateHistoryButtonsUI(); requestFullUpdate();
             showMessage("Undo successful.", false, elements.messageBox);
         } catch(e) { console.error("Undo error:", e); showMessage("Undo Error.", true, elements.messageBox); }
    }
}

function handleRedoClick() {
     if (!sourceEffectCtx || stateManager.isProcessing()) return;
     if (stateManager.getHistoryInfo().index >= stateManager.getHistoryInfo().length - 1) return;
    const nextImageData = stateManager.redoState();
     if (nextImageData) {
         try {
             if (elements.sourceEffectCanvas.width !== nextImageData.width || elements.sourceEffectCanvas.height !== nextImageData.height) {
                 elements.sourceEffectCanvas.width = nextImageData.width; elements.sourceEffectCanvas.height = nextImageData.height;
             }
             sourceEffectCtx.putImageData(nextImageData, 0, 0);
             updateHistoryButtonsUI(); requestFullUpdate();
             showMessage("Redo successful.", false, elements.messageBox);
        } catch(e) { console.error("Redo error:", e); showMessage("Redo Error.", true, elements.messageBox); }
    }
}

function getCurrentEffectAndParams() {
    const effect = elements.preEffectSelector?.value || 'none';
    const params = { intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10) };
    switch (effect) {
        case 'waveDistortion':
            params.amplitude = parseInt(elements.preEffectWaveAmplitudeSlider?.value || 10, 10);
            params.frequency = parseInt(elements.preEffectWaveFrequencySlider?.value || 5, 10);
            params.phase = parseInt(elements.preEffectWavePhaseSlider?.value || 0, 10) * (Math.PI / 180);
            params.direction = elements.preEffectWaveDirection?.value || 'horizontal';
            params.waveType = elements.preEffectWaveType?.value || 'sine';
            delete params.intensity; break;
        case 'sliceShift':
            params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10);
            params.direction = elements.sliceShiftDirection?.value || 'horizontal'; break;
        case 'pixelSort':
            params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10);
            params.direction = elements.pixelSortDirection?.value || 'horizontal';
            params.sortBy = elements.pixelSortBy?.value || 'brightness';
            delete params.intensity; break;
        case 'scanLines': params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10); break;
        case 'noise': case 'channelShift': case 'blockDisplace': case 'invertBlocks': case 'sierpinski': case 'fractalZoom':
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 30, 10); break;
        case 'none': default: delete params.intensity; break;
    }
    return { effect, params };
}

function handleSliderChange() {
    // Update value spans
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    if(elements.perlinScaleValue && elements.perlinScale) elements.perlinScaleValue.textContent = elements.perlinScale.value;
    // <<< ADDED RD Spans >>>
    if(elements.rdFeedValue && elements.rdFeedSlider) elements.rdFeedValue.textContent = parseFloat(elements.rdFeedSlider.value).toFixed(3);
    if(elements.rdKillValue && elements.rdKillSlider) elements.rdKillValue.textContent = parseFloat(elements.rdKillSlider.value).toFixed(3);
    if(elements.rdIterationsValue && elements.rdIterationsSlider) elements.rdIterationsValue.textContent = elements.rdIterationsSlider.value;

    requestFullUpdate(); // Debounce the preview update
}

function handleOptionChange(event) {
    const target = event.target; if (!target) return;
    let needsFullUpdate = false, needsTilingControlUpdate = false, needsEffectControlUpdate = false, needsGeneratorControlUpdate = false;
    if (target.name === 'tileShape') { needsTilingControlUpdate = true; needsFullUpdate = true; }
    else if (target.name === 'mirrorOption') { needsFullUpdate = true; }
    else if (target.id === 'preEffectSelector') { needsEffectControlUpdate = true; needsFullUpdate = true; }
    else if (target.closest('#preEffectOptionsContainer')) { needsFullUpdate = true; }
    else if (target.id === 'generatorType') { needsGeneratorControlUpdate = true; }
    if (needsTilingControlUpdate && elements.tilesXSlider) updateTilingControlsVisibility(elements, handleSliderChange);
    if (needsEffectControlUpdate && elements.preEffectSelector) updatePreEffectControlsVisibility(elements);
    if (needsGeneratorControlUpdate && elements.generatorType) updateGeneratorControlsVisibility(elements);
    if (needsFullUpdate) requestFullUpdate();
}

function handleImageLoad(event) {
    console.log("[MainApp] handleImageLoad - START");
    try {
        if (!elements.messageBox || !elements.sourceEffectCanvas || !elements.imageLoader || !sourceEffectCtx) {
            console.error("handleImageLoad: Prerequisites missing."); if(elements.imageLoader) elements.imageLoader.value = ''; return;
        }
        const resetAppForLoad = () => {
            resetUIState(elements, () => updateTilingControlsVisibility(elements, handleSliderChange), () => updatePreEffectControlsVisibility(elements), handleSliderChange, updateHistoryButtonsUI, () => updateGeneratorControlsVisibility(elements) );
            stateManager.resetStateData(); if (elements.messageBox) showMessage("Ready.", false, elements.messageBox); if(elements.imageLoader) elements.imageLoader.value = '';
        };
        const file = event.target.files?.[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { showMessage("Invalid file type.", true, elements.messageBox); resetAppForLoad(); return; }
        showMessage("Loading image...", false, elements.messageBox); stateManager.setProcessing(true);
        const originalFileName = file.name; const reader = new FileReader();
        reader.onload = (e) => {
             if (!e.target?.result) { showMessage("Failed to read file.", true, elements.messageBox); resetAppForLoad(); stateManager.setProcessing(false); return; }
            const img = new Image();
            img.onload = () => {
                 if (!img.naturalWidth || !img.naturalHeight) { showMessage("Could not decode image.", true, elements.messageBox); resetAppForLoad(); stateManager.setProcessing(false); return; }
                 stateManager.clearHistoryState(); stateManager.setImageData(img, originalFileName);
                 if(elements.outputWidthInput) elements.outputWidthInput.value = String(img.naturalWidth); if(elements.outputHeightInput) elements.outputHeightInput.value = String(img.naturalHeight);
                 if(elements.sourcePreview) { elements.sourcePreview.src = e.target.result; elements.sourcePreview.classList.remove('hidden'); elements.sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; }
                 if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden'); if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
                 if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = '1.0'; if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';
                 elements.generatorType?.setAttribute('disabled', 'true'); elements.generatorWidth?.setAttribute('disabled', 'true'); elements.generatorHeight?.setAttribute('disabled', 'true');
                 elements.perlinScale?.setAttribute('disabled', 'true'); elements.perlinColor1?.setAttribute('disabled', 'true'); elements.perlinColor2?.setAttribute('disabled', 'true');
                 elements.rdFeedSlider?.setAttribute('disabled', 'true'); elements.rdKillSlider?.setAttribute('disabled', 'true'); elements.rdIterationsSlider?.setAttribute('disabled', 'true'); // Disable new sliders too
                 elements.generatePatternButton?.setAttribute('disabled', 'true');
                 requestAnimationFrame(() => {
                    if (!sourceEffectCtx) { resetAppForLoad(); stateManager.setProcessing(false); return; }
                    const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState()); stateManager.setCurrentOffsets(clampedX, clampedY);
                    const {width: initialWidth, height: initialHeight} = stateManager.getOriginalDimensions(); if (!initialWidth || !initialHeight) { resetAppForLoad(); stateManager.setProcessing(false); return; }
                    elements.sourceEffectCanvas.width = initialWidth; elements.sourceEffectCanvas.height = initialHeight;
                    if (redrawSourceCanvasWithEffect()) {
                        try { const initialImageData = sourceEffectCtx.getImageData(0, 0, initialWidth, initialHeight); stateManager.pushHistoryState(initialImageData); updateHistoryButtonsUI(); }
                        catch(histError) { console.error("History init error:", histError); showMessage("Error init state.", true, elements.messageBox); resetAppForLoad(); stateManager.setProcessing(false); return; }
                    } else { console.error("Initial redraw FAILED."); showMessage("Error drawing image.", true, elements.messageBox); resetAppForLoad(); stateManager.setProcessing(false); return; }
                    if(elements.saveButton) elements.saveButton.disabled = false; if(elements.applyEffectButton) elements.applyEffectButton.disabled = false; if(elements.sourceZoomSlider) elements.sourceZoomSlider.disabled = false;
                    elements.tileShapeOptions?.forEach(opt => opt.disabled = false); elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                    elements.sliders?.forEach(s => { if(s && !s.closest('.generator-options')) s.disabled = false; }); // Enable non-gen sliders
                    elements.selects?.forEach(s => { if(s && s.id !== 'generatorType') s.disabled = false; }); // Enable non-gen selects
                    if(elements.outputWidthInput) elements.outputWidthInput.disabled = false; if(elements.outputHeightInput) elements.outputHeightInput.disabled = false; if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false; if(elements.preEffectSelector) elements.preEffectSelector.disabled = false;
                    updateTilingControlsVisibility(elements, handleSliderChange); updatePreEffectControlsVisibility(elements); updateGeneratorControlsVisibility(elements);
                    requestFullUpdate(); stateManager.setProcessing(false); showMessage('Image loaded.', false, elements.messageBox);
                });
            };
            img.onerror = () => { showMessage("Failed to load image.", true, elements.messageBox); resetAppForLoad(); stateManager.setProcessing(false); };
            img.src = e.target.result;
        };
        reader.onerror = () => { showMessage("Error reading file.", true, elements.messageBox); resetAppForLoad(); stateManager.setProcessing(false); };
        reader.readAsDataURL(file);
    } catch (error) { console.error("Unexpected error in handleImageLoad:", error); showMessage("Critical error.", true, elements.messageBox); try { resetAppForLoad(); } catch (resetError) {} stateManager.setProcessing(false); }
}

/**
 * Handler for Generate Pattern Button Click.
 * (MODIFIED to handle reactionDiffusion params)
 */
function handleGeneratePatternClick() {
    console.log("[MainApp] handleGeneratePatternClick - START");
     if (!elements.sourceEffectCanvas || !sourceEffectCtx) { showMessage("Canvas not ready.", true, elements.messageBox); return; }
     if (stateManager.isProcessing()) { showMessage("Processing...", true, elements.messageBox); return; }
    stateManager.setProcessing(true); showMessage("Generating pattern...", false, elements.messageBox);
    const generatorType = elements.generatorType?.value || 'perlin';
    const generatorFunc = generatorFunctions[generatorType];
    if (!generatorFunc) { showMessage(`Generator "${generatorType}" not found.`, true, elements.messageBox); stateManager.setProcessing(false); return; }
    const params = { width: parseInt(elements.generatorWidth?.value || 512, 10), height: parseInt(elements.generatorHeight?.value || 512, 10) };
    if (isNaN(params.width) || params.width <= 0 || isNaN(params.height) || params.height <= 0) { showMessage(`Invalid dimensions: ${params.width}x${params.height}`, true, elements.messageBox); stateManager.setProcessing(false); return; }

    // Add params specific to the selected generator
    if (generatorType === 'perlin') {
        params.scale = parseFloat(elements.perlinScale?.value || 50);
        params.color1 = elements.perlinColor1?.value || '#000000';
        params.color2 = elements.perlinColor2?.value || '#ffffff';
    } else if (generatorType === 'reactionDiffusion') { // <<< ADDED
        params.feed = parseFloat(elements.rdFeedSlider?.value || 0.055);
        params.kill = parseFloat(elements.rdKillSlider?.value || 0.062);
        params.iterations = parseInt(elements.rdIterationsSlider?.value || 50, 10);
        // Add default diffusion rates if not adding sliders yet
        params.dA = 1.0;
        params.dB = 0.5;
    }
    // Add params for other generator types here...

    setTimeout(() => {
        try {
            const generatedImageData = generatorFunc(elements.sourceEffectCanvas, sourceEffectCtx, params);
            if (!generatedImageData || !(generatedImageData instanceof ImageData)) throw new Error("Generation failed.");
            stateManager.clearHistoryState(); stateManager.setImageData(null, `generated_${generatorType}.png`); stateManager.setGeneratedDimensions(params.width, params.height);
            if(elements.outputWidthInput) elements.outputWidthInput.value = String(params.width); if(elements.outputHeightInput) elements.outputHeightInput.value = String(params.height);
            if(elements.sourcePreview) { try { elements.sourcePreview.src = elements.sourceEffectCanvas.toDataURL(); elements.sourcePreview.classList.remove('hidden'); elements.sourcePreview.style.transform = 'translate(0px, 0px) scale(1)'; } catch(e) { console.error("Error getting data URL:", e); } }
            if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden'); if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = '1.0'; if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';
            if(elements.imageLoader) elements.imageLoader.disabled = false; // Re-enable image load
            stateManager.pushHistoryState(generatedImageData);
            if(elements.saveButton) elements.saveButton.disabled = false; if(elements.applyEffectButton) elements.applyEffectButton.disabled = false; if(elements.sourceZoomSlider) elements.sourceZoomSlider.disabled = false;
            elements.tileShapeOptions?.forEach(opt => opt.disabled = false); elements.mirrorOptions?.forEach(opt => opt.disabled = false);
            elements.sliders?.forEach(s => { if(s) s.disabled = false; }); // Enable ALL sliders
            elements.selects?.forEach(s => { if(s) s.disabled = false; }); // Enable ALL selects
            if(elements.outputWidthInput) elements.outputWidthInput.disabled = false; if(elements.outputHeightInput) elements.outputHeightInput.disabled = false; if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false; if(elements.preEffectSelector) elements.preEffectSelector.disabled = false;
            updateHistoryButtonsUI(); updateTilingControlsVisibility(elements, handleSliderChange); updatePreEffectControlsVisibility(elements); updateGeneratorControlsVisibility(elements);
            requestFullUpdate(); showMessage(`Generated ${generatorType} pattern.`, false, elements.messageBox);
        } catch (error) { console.error("Generate error:", error); showMessage(`Generation Error: ${error.message || 'Unknown'}`, true, elements.messageBox); }
        finally { stateManager.setProcessing(false); }
    }, 10);
}

function saveImage() {
    const currentState = stateManager.getState();
    if (!elements.canvas || !currentState.originalWidth || currentState.originalWidth <= 0) { showMessage("Nothing to save.", true, elements.messageBox); return; }
    if (currentState.isProcessing) { showMessage("Processing...", true, elements.messageBox); return; }
    try {
        const finalCanvas = elements.canvas;
        const outputWidth = parseInt(elements.outputWidthInput?.value, 10) || finalCanvas.width;
        const outputHeight = parseInt(elements.outputHeightInput?.value, 10) || finalCanvas.height;
        if (isNaN(outputWidth) || outputWidth <= 0 || isNaN(outputHeight) || outputHeight <= 0) throw new Error(`Invalid output dimensions.`);
        let canvasToSave = finalCanvas;
        if (outputWidth !== finalCanvas.width || outputHeight !== finalCanvas.height) {
             const tempSaveCanvas = document.createElement('canvas'); tempSaveCanvas.width = outputWidth; tempSaveCanvas.height = outputHeight;
             const tempCtx = tempSaveCanvas.getContext('2d'); if (!tempCtx) throw new Error("Failed save context.");
             tempCtx.imageSmoothingEnabled = true; tempCtx.imageSmoothingQuality = 'high';
             tempCtx.drawImage(finalCanvas, 0, 0, finalCanvas.width, finalCanvas.height, 0, 0, outputWidth, outputHeight);
             canvasToSave = tempSaveCanvas;
        }
        const dataURL = canvasToSave.toDataURL('image/png'); const link = document.createElement('a');
        const baseName = stateManager.getOriginalFileName().replace(/\.[^/.]+$/, ""); link.download = `${baseName}_MeltMixPix.png`;
        link.href = dataURL; link.click(); showMessage("Image saved.", false, elements.messageBox);
    } catch (error) { console.error("Save error:", error); showMessage(`Save Error: ${error.message || 'Unknown'}.`, true, elements.messageBox); }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
     console.log("[MainApp] setupEventListeners - START");
    if (!elements.imageLoader) { console.error("Cannot setup listeners."); return; }
    elements.imageLoader.addEventListener('change', handleImageLoad);
    elements.generatePatternButton?.addEventListener('click', handleGeneratePatternClick);
    elements.generatorType?.addEventListener('change', () => updateGeneratorControlsVisibility(elements));
    elements.saveButton?.addEventListener('click', saveImage);
    elements.applyEffectButton?.addEventListener('click', handleApplyEffectClick);
    elements.undoButton?.addEventListener('click', handleUndoClick);
    elements.redoButton?.addEventListener('click', handleRedoClick);
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange)); // Corrected line
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);
    const effectOptionSelects = [ elements.preEffectWaveDirection, elements.preEffectWaveType, elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy ];
    effectOptionSelects.forEach(select => { if(select) select.addEventListener('change', handleOptionChange); });
    setupSliderListener(elements.tilesXSlider, elements.tilesXValueSpan, handleSliderChange);
    setupSliderListener(elements.tilesYSlider, elements.tilesYValueSpan, handleSliderChange);
    setupSliderListener(elements.skewSlider, elements.skewValueSpan, handleSliderChange, val => parseFloat(val).toFixed(1));
    setupSliderListener(elements.staggerSlider, elements.staggerValueSpan, handleSliderChange, val => parseFloat(val).toFixed(2));
    setupSliderListener(elements.scaleSlider, elements.scaleValueSpan, handleSliderChange, val => parseFloat(val).toFixed(2));
    setupSliderListener(elements.preTileXSlider, elements.preTileXValueSpan, handleSliderChange);
    setupSliderListener(elements.preTileYSlider, elements.preTileYValueSpan, handleSliderChange);
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestFullUpdate);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestFullUpdate, val => val + '°');
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestFullUpdate);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestFullUpdate);
    setupSliderListener(elements.perlinScale, elements.perlinScaleValue, handleSliderChange);
    // <<< ADDED RD Listeners >>>
    setupSliderListener(elements.rdFeedSlider, elements.rdFeedValue, handleSliderChange, val => parseFloat(val).toFixed(3));
    setupSliderListener(elements.rdKillSlider, elements.rdKillValue, handleSliderChange, val => parseFloat(val).toFixed(3));
    setupSliderListener(elements.rdIterationsSlider, elements.rdIterationsValue, handleSliderChange);
    // Colors don't need slider listener, 'change' is fine
    elements.perlinColor1?.addEventListener('change', requestFullUpdate);
    elements.perlinColor2?.addEventListener('change', requestFullUpdate);
    if (elements.sourceZoomSlider) { setupSliderListener( elements.sourceZoomSlider, elements.sourceZoomValueSpan, () => { stateManager.setZoomLevel(parseFloat(elements.sourceZoomSlider.value)); const { clampedX, clampedY } = updateSourcePreviewTransform(elements, stateManager.getState()); stateManager.setCurrentOffsets(clampedX, clampedY); requestFullUpdate(); }, val => parseFloat(val).toFixed(1) ); }
    const dimensionChangeHandler = (e) => { handleDimensionChange(e, elements, stateManager.getOriginalAspectRatio()); };
    elements.outputWidthInput?.addEventListener('input', dimensionChangeHandler); elements.outputHeightInput?.addEventListener('input', dimensionChangeHandler);
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => { if (elements.keepAspectRatioCheckbox?.checked && stateManager.getOriginalDimensions().width > 0 && elements.outputWidthInput) { dimensionChangeHandler({ target: elements.outputWidthInput }); } });
    if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => { if (startPan(e, elements)) { stateManager.setDragging(true, e.pageX, e.pageY); } });
         document.addEventListener('mousemove', (e) => { if (!stateManager.isDragging()) return; const ps = stateManager.getPanState(); const { nOX, nOY } = panMove(e, ps.dragStartX, ps.dragStartY, ps.startOffsetX, ps.startOffsetY); stateManager.updatePanOffsets(nOX, nOY); const { cX, cY } = updateSourcePreviewTransform(elements, stateManager.getState()); stateManager.setCurrentOffsets(cX, cY); }); // Simplified var names
         const endPanHandler = () => { if (stateManager.isDragging()) { stateManager.setDragging(false); endPan(elements); requestFullUpdate(); } };
         document.addEventListener('mouseup', endPanHandler); document.addEventListener('mouseleave', endPanHandler);
     }
     console.log("[MainApp] setupEventListeners - END");
}


// --- Initial Application State Setup ---
function initializeApp() {
     console.log("[MainApp] initializeApp - START");
      try {
            elements = {
                imageLoader: document.getElementById('imageLoader'), saveButton: document.getElementById('saveButton'), messageBox: document.getElementById('messageBox'), outputWidthInput: document.getElementById('outputWidth'), outputHeightInput: document.getElementById('outputHeight'), keepAspectRatioCheckbox: document.getElementById('keepAspectRatio'),
                sourcePreviewContainer: document.getElementById('sourcePreviewContainer'), sourcePreview: document.getElementById('sourcePreview'), sourcePreviewText: document.getElementById('sourcePreviewText'), finalPreviewContainer: document.getElementById('finalPreviewContainer'), finalPreview: document.getElementById('finalPreview'), finalPreviewText: document.getElementById('finalPreviewText'),
                mirrorCanvas: document.getElementById('mirrorCanvas'), preTileCanvas: document.getElementById('preTileCanvas'), canvas: document.getElementById('imageCanvas'), sourceEffectCanvas: document.getElementById('sourceEffectCanvas'),
                applyEffectButton: document.getElementById('applyEffectButton'), undoButton: document.getElementById('undoButton'), redoButton: document.getElementById('redoButton'), generatePatternButton: document.getElementById('generatePatternButton'),
                sourceZoomSlider: document.getElementById('sourceZoom'), sourceZoomValueSpan: document.getElementById('sourceZoomValue'),
                tileShapeOptions: document.querySelectorAll('input[name="tileShape"]'), mirrorOptions: document.querySelectorAll('input[name="mirrorOption"]'),
                tilesXSlider: document.getElementById('tilesX'), tilesYSlider: document.getElementById('tilesY'), skewSlider: document.getElementById('skewFactor'), staggerSlider: document.getElementById('staggerOffset'), scaleSlider: document.getElementById('tileScale'), preTileXSlider: document.getElementById('preTileX'), preTileYSlider: document.getElementById('preTileY'),
                tilesXValueSpan: document.getElementById('tilesXValue'), tilesYValueSpan: document.getElementById('tilesYValue'), skewValueSpan: document.getElementById('skewValue'), staggerValueSpan: document.getElementById('staggerValue'), scaleValueSpan: document.getElementById('scaleValue'), preTileXValueSpan: document.getElementById('preTileXValue'), preTileYValueSpan: document.getElementById('preTileYValue'),
                skewControl: document.getElementById('skewControl'), staggerControl: document.getElementById('staggerControl'), tilesXLabel: document.getElementById('tilesXLabel'), tilesYLabel: document.getElementById('tilesYLabel'), scaleLabel: document.getElementById('scaleLabel'), tilesXYHelpText: document.getElementById('tilesXYHelpText'),
                preEffectSelector: document.getElementById('preEffectSelector'), preEffectOptionsContainer: document.getElementById('preEffectOptionsContainer'), preEffectIntensityControl: document.getElementById('preEffectIntensityControl'), preEffectIntensitySlider: document.getElementById('preEffectIntensitySlider'), preEffectIntensityValue: document.getElementById('preEffectIntensityValue'), preEffectRealtimeWarning: document.getElementById('preEffectRealtimeWarning'),
                preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'), preEffectWaveAmplitudeSlider: document.getElementById('preEffectWaveAmplitudeSlider'), preEffectWaveAmplitudeValue: document.getElementById('preEffectWaveAmplitudeValue'), preEffectWaveFrequencySlider: document.getElementById('preEffectWaveFrequencySlider'), preEffectWaveFrequencyValue: document.getElementById('preEffectWaveFrequencyValue'), preEffectWavePhaseSlider: document.getElementById('preEffectWavePhaseSlider'), preEffectWavePhaseValue: document.getElementById('preEffectWavePhaseValue'), preEffectWaveDirection: document.getElementById('preEffectWaveDirection'), preEffectWaveType: document.getElementById('preEffectWaveType'),
                sliceShiftOptions: document.getElementById('sliceShiftOptions'), sliceShiftDirection: document.getElementById('sliceShiftDirection'), sliceShiftIntensitySlider: document.getElementById('sliceShiftIntensitySlider'), sliceShiftIntensityValue: document.getElementById('sliceShiftIntensityValue'),
                pixelSortOptions: document.getElementById('pixelSortOptions'), pixelSortThresholdSlider: document.getElementById('pixelSortThresholdSlider'), pixelSortThresholdValue: document.getElementById('pixelSortThresholdValue'), pixelSortDirection: document.getElementById('pixelSortDirection'), pixelSortBy: document.getElementById('pixelSortBy'),
                generatorType: document.getElementById('generatorType'), generatorWidth: document.getElementById('generatorWidth'), generatorHeight: document.getElementById('generatorHeight'),
                perlinOptions: document.getElementById('perlinOptions'), perlinScale: document.getElementById('perlinScale'), perlinScaleValue: document.getElementById('perlinScaleValue'), perlinColor1: document.getElementById('perlinColor1'), perlinColor2: document.getElementById('perlinColor2'),
                // <<< ADDED RD Elements >>>
                reactionDiffusionOptions: document.getElementById('reactionDiffusionOptions'), rdFeedSlider: document.getElementById('rdFeedSlider'), rdFeedValue: document.getElementById('rdFeedValue'), rdKillSlider: document.getElementById('rdKillSlider'), rdKillValue: document.getElementById('rdKillValue'), rdIterationsSlider: document.getElementById('rdIterationsSlider'), rdIterationsValue: document.getElementById('rdIterationsValue')
            };
            console.log("initializeApp: Elements populated.");
            elements.sliders = [ elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider, elements.sourceZoomSlider, elements.preEffectIntensitySlider, elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveFrequencySlider, elements.preEffectWavePhaseSlider, elements.sliceShiftIntensitySlider, elements.pixelSortThresholdSlider, elements.perlinScale, elements.rdFeedSlider, elements.rdKillSlider, elements.rdIterationsSlider ].filter(el => el !== null); // Added RD sliders
            elements.selects = [ elements.preEffectSelector, elements.preEffectWaveDirection, elements.preEffectWaveType, elements.sliceShiftDirection, elements.pixelSortDirection, elements.pixelSortBy, elements.generatorType ].filter(el => el !== null);
            console.log(`initializeApp: Grouped ${elements.sliders.length} sliders and ${elements.selects.length} selects.`);
            sourceEffectCtx = elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }); if (!sourceEffectCtx) throw new Error("Canvas context failed!");
            stateManager.resetStateData();
            resetUIState(elements, () => updateTilingControlsVisibility(elements, handleSliderChange), () => updatePreEffectControlsVisibility(elements), handleSliderChange, updateHistoryButtonsUI, () => updateGeneratorControlsVisibility(elements) );
            setupEventListeners();
            updateHistoryButtonsUI(); showMessage("Load image OR generate pattern.", false, elements.messageBox);
            updateTilingControlsVisibility(elements, handleSliderChange); updatePreEffectControlsVisibility(elements); updateGeneratorControlsVisibility(elements);
            console.log("[MainApp] initializeApp - END - Ready.");
        } catch (error) {
             console.error("***** CRITICAL ERROR DURING INITIALIZEAPP *****", error);
             const msgBox = document.getElementById('messageBox'); const errorMsg = `Init Error: ${error.message}. Check console.`;
             if (msgBox) showMessage(errorMsg, true, msgBox); else alert(errorMsg);
             document.querySelectorAll('INPUT, BUTTON, SELECT, TEXTAREA').forEach(el => { try { if (el && typeof el.disabled === 'boolean') el.disabled = true; } catch(e){} });
        } // End catch
} // End initializeApp

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
