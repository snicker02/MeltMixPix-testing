// js/main.js (Single Pre-Effect Logic with New Effects)
// VERSION WITH CORRECTED FUNCTION CALLS in Listeners

// --- Utility Imports ---
import {
    showMessage, updateTilingControlsVisibility, updatePreEffectControlsVisibility,
    updateSourcePreviewTransform, handleDimensionChange, resetState,
    startPan, panMove, endPan, handleSourceZoom, setupSliderListener // Correct named imports
 } from './utils/uiUtils.js'; //
import { processAndPreviewImage } from './tiling/core.js'; //

// --- Effect Imports ---
import { applyNoise } from './effects/noise.js'; //
import { applyScanLines } from './effects/scanLines.js'; //
import { applyWaveDistortion } from './effects/waveDistortion.js'; //
import { applyFractalZoom } from './effects/fractalZoom.js'; //
// NEW Effect Imports
import { applySliceShift } from './effects/sliceShift.js'; //
import { applyPixelSort } from './effects/pixelSort.js'; //
import { applyChannelShift } from './effects/channelShift.js'; //
import { applyBlockDisplace } from './effects/blockDisplace.js'; //
import { applyInvertBlocks } from './effects/invertBlocks.js'; //
import { applySierpinski } from './effects/sierpinski.js'; //


// --- DOM Element References ---
// (This section remains unchanged)
const elements = {
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
    messageBox: document.getElementById('messageBox'),
    tileShapeOptions: document.querySelectorAll('input[name="tileShape"]'),
    mirrorOptions: document.querySelectorAll('input[name="mirrorOption"]'),
    tilesXSlider: document.getElementById('tilesX'),
    tilesYSlider: document.getElementById('tilesY'),
    skewSlider: document.getElementById('skewFactor'),
    staggerSlider: document.getElementById('staggerOffset'),
    scaleSlider: document.getElementById('tileScale'),
    preTileXSlider: document.getElementById('preTileX'),
    preTileYSlider: document.getElementById('preTileY'),
    sourceZoomSlider: document.getElementById('sourceZoom'),
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
    skewControl: document.getElementById('skewControl'),
    staggerControl: document.getElementById('staggerControl'),
    tilesXLabel: document.getElementById('tilesXLabel'),
    tilesYLabel: document.getElementById('tilesYLabel'),
    scaleLabel: document.getElementById('scaleLabel'),
    tilesXYHelpText: document.getElementById('tilesXYHelpText'),
    preEffectSelector: document.getElementById('preEffectSelector'),
    preEffectOptionsContainer: document.getElementById('preEffectOptionsContainer'),
    preEffectIntensityControl: document.getElementById('preEffectIntensityControl'),
    preEffectIntensitySlider: document.getElementById('preEffectIntensitySlider'),
    preEffectIntensityValue: document.getElementById('preEffectIntensityValue'),
    preEffectWaveDistortionOptions: document.getElementById('preEffectWaveDistortionOptions'),
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
    sliders: [
        document.getElementById('tilesX'), document.getElementById('tilesY'),
        document.getElementById('skewFactor'), document.getElementById('staggerOffset'),
        document.getElementById('tileScale'), document.getElementById('preTileX'),
        document.getElementById('preTileY'), document.getElementById('sourceZoom'),
        document.getElementById('preEffectIntensitySlider'), document.getElementById('preEffectWaveAmplitudeSlider'),
        document.getElementById('preEffectWaveFrequencySlider'), document.getElementById('preEffectWavePhaseSlider'),
        document.getElementById('sliceShiftIntensitySlider'), document.getElementById('pixelSortThresholdSlider')
    ],
     selects: [
        document.getElementById('preEffectSelector'),
        document.getElementById('preEffectWaveDirection'), document.getElementById('preEffectWaveType'),
        document.getElementById('sliceShiftDirection'), document.getElementById('pixelSortDirection'), document.getElementById('pixelSortBy')
     ]
};

// --- State Variables ---
// (This section remains unchanged)
const state = {
    currentImage: null,
    originalFileName: 'downloaded-image.png',
    originalWidth: 0, originalHeight: 0, originalAspectRatio: 1,
    isProcessing: false, debounceTimer: null, isDragging: false,
    dragStartX: 0, dragStartY: 0,
    currentOffsetX: 0, currentOffsetY: 0,
    startOffsetX: 0, startOffsetY: 0,
    sourceZoomLevel: 1.0,
    sourceEffectCtx: elements.sourceEffectCanvas?.getContext('2d', { willReadFrequently: true }),
};

 // --- Effect Function Map ---
 // (This section remains unchanged)
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

// --- Debounced Processing Function ---
// (This section remains unchanged)
function requestProcessAndPreview() {
    console.log('[MainApp] requestProcessAndPreview called.'); // Added log
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        console.log('[MainApp] Debounce timer finished. Initiating processing.'); // Added log
        if (state.currentImage && !state.isProcessing && state.originalWidth > 0 && state.originalHeight > 0 && state.sourceEffectCtx) {
            console.log('[MainApp] Prerequisites met, calling applySourceEffect.'); // Added log
            const sourceCanvasForMirroring = applySourceEffect();
            if (sourceCanvasForMirroring) {
                 console.log('[MainApp] Got source canvas, calling processAndPreviewImage.'); // Added log
                 processAndPreviewImage(
                     sourceCanvasForMirroring, elements, state,
                     (msg, isErr) => showMessage(msg, isErr, elements.messageBox)
                 );
            } else {
                 console.error("[MainApp] requestProcessAndPreview: Failed to get source canvas for mirroring."); // Added log
                 showMessage("Error preparing source image for tiling.", true, elements.messageBox);
            }
        } else {
             console.warn("[MainApp] requestProcessAndPreview: Skipped processing due to missing prerequisites."); // Added log
             if(!state.currentImage) console.log(" Skipped reason: No current image.");
             else if(state.isProcessing) console.log(" Skipped reason: Already processing.");
             else if(!state.sourceEffectCtx) console.log(" Skipped reason: No source effect context.");
             else console.log(" Skipped reason: Invalid dimensions?");
        }
    }, 150);
}

// --- Apply *Single* Pre-Effect ---
// (This section remains unchanged)
function applySourceEffect() {
    if (!state.currentImage || !elements.sourceEffectCanvas || !state.sourceEffectCtx || !state.originalWidth || !state.originalHeight) {
         console.error("applySourceEffect: Missing prerequisites.");
         return null;
    }

    const canvas = elements.sourceEffectCanvas;
    const ctx = state.sourceEffectCtx;
    if (canvas.width !== state.originalWidth || canvas.height !== state.originalHeight) {
        canvas.width = state.originalWidth;
        canvas.height = state.originalHeight;
    }
    if (canvas.width === 0 || canvas.height === 0) {
        console.error("applySourceEffect: Canvas dimensions are zero.");
        return null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sourceRectWidth = canvas.width / state.sourceZoomLevel;
    const sourceRectHeight = canvas.height / state.sourceZoomLevel;
    const sourceRectX = -state.currentOffsetX / state.sourceZoomLevel;
    const sourceRectY = -state.currentOffsetY / state.sourceZoomLevel;

    console.log(`[applySourceEffect] Drawing source: Image[${state.currentImage.naturalWidth}x${state.currentImage.naturalHeight}] -> Canvas[${canvas.width}x${canvas.height}]`);
    console.log(`  Zoom=${state.sourceZoomLevel.toFixed(2)}, Offset=(${state.currentOffsetX.toFixed(2)}, ${state.currentOffsetY.toFixed(2)})`);
    console.log(`  SourceRect: x=${sourceRectX.toFixed(2)}, y=${sourceRectY.toFixed(2)}, w=${sourceRectWidth.toFixed(2)}, h=${sourceRectHeight.toFixed(2)}`);

    try {
        if (sourceRectWidth <= 0 || sourceRectHeight <= 0 || isNaN(sourceRectX) || isNaN(sourceRectY) || isNaN(sourceRectWidth) || isNaN(sourceRectHeight)) {
            throw new Error(`Invalid source rectangle dimensions for drawing: ${sourceRectWidth}x${sourceRectHeight} at ${sourceRectX},${sourceRectY}`);
        }
         if (sourceRectX < 0 || sourceRectY < 0 || sourceRectX + sourceRectWidth > state.currentImage.naturalWidth + 0.1 || sourceRectY + sourceRectHeight > state.currentImage.naturalHeight + 0.1 ) {
             console.warn(`[applySourceEffect] Calculated source rectangle slightly exceeds image bounds. Clamping draw area.`);
         }
        ctx.drawImage( state.currentImage, sourceRectX, sourceRectY, sourceRectWidth, sourceRectHeight, 0, 0, canvas.width, canvas.height );
    } catch (e) {
        console.error("applySourceEffect: Error drawing source image:", e);
        showMessage("Error drawing source region.", true, elements.messageBox);
        return null;
     }

    const { effect, params } = getCurrentEffectAndParams();
    const effectFunction = effectFunctions[effect];

    if (effectFunction) {
        console.log(`Applying effect: ${effect} with params:`, params);
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             const effectContext = {
                sourceImageData: new ImageData( new Uint8ClampedArray(imageData.data), imageData.width, imageData.height )
             };
            effectFunction(imageData, params, effectContext);
            ctx.putImageData(imageData, 0, 0);
        } catch (e) {
             console.error(`applySourceEffect: Error applying effect '${effect}':`, e);
             showMessage(`Error applying effect: ${e.message || 'Unknown error'}.`, true, elements.messageBox);
             return null;
        }
    }
    return canvas;
}

// Get Current Effect Parameters (Reads from UI)
// (This section remains unchanged)
function getCurrentEffectAndParams() {
    const effect = elements.preEffectSelector?.value || 'none';
    const params = {
        intensity: parseInt(elements.preEffectIntensitySlider?.value || 30, 10)
    };
    switch (effect) {
        case 'waveDistortion':
            params.amplitude = parseInt(elements.preEffectWaveAmplitudeSlider?.value || 10, 10);
            params.frequency = parseInt(elements.preEffectWaveFrequencySlider?.value || 5, 10);
            params.phase = parseInt(elements.preEffectWavePhaseSlider?.value || 0, 10) * (Math.PI / 180);
            params.direction = elements.preEffectWaveDirection?.value || 'horizontal';
            params.waveType = elements.preEffectWaveType?.value || 'sine';
            break;
        case 'sliceShift':
            params.intensity = parseInt(elements.sliceShiftIntensitySlider?.value || 30, 10);
            params.direction = elements.sliceShiftDirection?.value || 'horizontal';
            break;
        case 'pixelSort':
            params.threshold = parseInt(elements.pixelSortThresholdSlider?.value || 100, 10);
            params.direction = elements.pixelSortDirection?.value || 'horizontal';
            params.sortBy = elements.pixelSortBy?.value || 'brightness';
            break;
        case 'scanLines':
             params.intensity = parseInt(elements.preEffectIntensitySlider?.value || 50, 10);
            break;
    }
    return { effect, params };
}


// --- Event Handlers ---
// (handleSliderChange, handleOptionChange, handleImageLoad, saveImage remain unchanged)
function handleSliderChange() {
    console.log('[MainApp] handleSliderChange called.'); // Added log
    // Update tiling value spans
    if(elements.tilesXValueSpan && elements.tilesXSlider) elements.tilesXValueSpan.textContent = elements.tilesXSlider.value;
    if(elements.tilesYValueSpan && elements.tilesYSlider) elements.tilesYValueSpan.textContent = elements.tilesYSlider.value;
    if(elements.skewValueSpan && elements.skewSlider) elements.skewValueSpan.textContent = parseFloat(elements.skewSlider.value).toFixed(1);
    if(elements.staggerValueSpan && elements.staggerSlider) elements.staggerValueSpan.textContent = parseFloat(elements.staggerSlider.value).toFixed(2);
    if(elements.scaleValueSpan && elements.scaleSlider) elements.scaleValueSpan.textContent = parseFloat(elements.scaleSlider.value).toFixed(2);
    if(elements.preTileXValueSpan && elements.preTileXSlider) elements.preTileXValueSpan.textContent = elements.preTileXSlider.value;
    if(elements.preTileYValueSpan && elements.preTileYSlider) elements.preTileYValueSpan.textContent = elements.preTileYSlider.value;
    requestProcessAndPreview();
}

function handleOptionChange(event) {
    const target = event.target;
    if (!target) return;
    console.log(`[MainApp] Option change detected on element ID: ${target.id}, Name: ${target.name}`);
    if (target.name === 'tileShape') {
        updateTilingControlsVisibility(elements, handleSliderChange);
        requestProcessAndPreview();
    } else if (target.name === 'mirrorOption') {
        requestProcessAndPreview();
    } else if (target.id === 'preEffectSelector') {
         updatePreEffectControlsVisibility(elements);
         requestProcessAndPreview();
    } else if (target.closest('#preEffectOptionsContainer')) {
        requestProcessAndPreview();
    }
}

function handleImageLoad(event) {
    console.log("handleImageLoad: Function triggered.");
    const resetFunc = () => resetState(elements, state,
        () => updateTilingControlsVisibility(elements, handleSliderChange),
        () => updatePreEffectControlsVisibility(elements),
        handleSliderChange,
        null
    );
    const file = event.target.files?.[0];
    if (!file) { console.log("handleImageLoad: No file selected."); resetFunc(); showMessage('No file selected.', true, elements.messageBox); return; }
    if (!file.type.startsWith('image/')) { console.log("handleImageLoad: Invalid file type selected."); resetFunc(); showMessage('Please select a valid image file.', true, elements.messageBox); return; }
    state.originalFileName = file.name;
    console.log(`handleImageLoad: File selected - ${state.originalFileName}`);
    const reader = new FileReader();
    reader.onload = (e) => {
        console.log("handleImageLoad: FileReader onload triggered.");
        const img = new Image();
        img.onload = () => {
            console.log("handleImageLoad: Image object onload triggered.");
            state.currentImage = img;
            state.originalWidth = img.naturalWidth;
            state.originalHeight = img.naturalHeight;
            state.originalAspectRatio = state.originalWidth / state.originalHeight;
            console.log(`handleImageLoad: Image dimensions set - ${state.originalWidth}x${state.originalHeight}`);
            console.log("handleImageLoad: state.currentImage is now:", state.currentImage);
            if (!state.originalWidth || !state.originalHeight || state.originalWidth === 0 || state.originalHeight === 0) {
                 console.error("handleImageLoad: Image loaded but dimensions are invalid (0).");
                 resetFunc();
                 showMessage('Error: Image loaded with invalid dimensions.', true, elements.messageBox);
                 return;
            }
            if(elements.outputWidthInput) elements.outputWidthInput.value = state.originalWidth;
            if(elements.outputHeightInput) elements.outputHeightInput.value = state.originalHeight;
            if(elements.sourcePreview) {
                 elements.sourcePreview.src = e.target.result;
                 elements.sourcePreview.classList.remove('hidden');
                 console.log("handleImageLoad: Source preview updated.");
            }
            if(elements.sourcePreviewText) elements.sourcePreviewText.classList.add('hidden');
            if(elements.sourcePreviewContainer) elements.sourcePreviewContainer.style.cursor = 'grab';
            state.currentOffsetX = 0; state.currentOffsetY = 0; state.startOffsetX = 0; state.startOffsetY = 0;
            state.sourceZoomLevel = 1.0;
            if(elements.sourceZoomSlider) elements.sourceZoomSlider.value = 1.0;
            if(elements.sourceZoomValueSpan) elements.sourceZoomValueSpan.textContent = '1.0';
            console.log("handleImageLoad: Pan/Zoom reset.");
            requestAnimationFrame(() => {
                const { clampedX, clampedY } = updateSourcePreviewTransform(elements, state); // Use direct name
                state.currentOffsetX = clampedX; state.currentOffsetY = clampedY;
                console.log("handleImageLoad: Initial source transform applied.");
                if(elements.saveButton) elements.saveButton.disabled = false;
                elements.tileShapeOptions?.forEach(opt => opt.disabled = false);
                elements.mirrorOptions?.forEach(opt => opt.disabled = false);
                elements.sliders?.forEach(s => { if(s) s.disabled = false; });
                elements.selects?.forEach(s => { if(s) s.disabled = false; });
                if(elements.outputWidthInput) elements.outputWidthInput.disabled = false;
                if(elements.outputHeightInput) elements.outputHeightInput.disabled = false;
                if(elements.keepAspectRatioCheckbox) elements.keepAspectRatioCheckbox.disabled = false;
                console.log("handleImageLoad: Controls enabled.");
                updateTilingControlsVisibility(elements, handleSliderChange); // Use direct name
                updatePreEffectControlsVisibility(elements); // Use direct name
                handleSliderChange();
                requestProcessAndPreview();
                console.log("handleImageLoad: Initial process/preview requested.");
                showMessage('Image loaded. Adjust effect/tiling.', false, elements.messageBox); // Use direct name
            });
        };
        img.onerror = () => {
             console.error("handleImageLoad: Image object onerror triggered.");
             resetFunc();
             showMessage('Error loading image data. Check image file format/integrity.', true, elements.messageBox); // Use direct name
        };
        console.log("handleImageLoad: Setting Image src.");
        img.src = e.target.result;
    };
    reader.onerror = () => {
         console.error("handleImageLoad: FileReader onerror triggered.");
         resetFunc();
         showMessage('Error reading file.', true, elements.messageBox); // Use direct name
    };
    console.log("handleImageLoad: Reading file as DataURL.");
    reader.readAsDataURL(file);
}

function saveImage() {
    if (!state.currentImage || state.isProcessing) { showMessage('Cannot save now.', true, elements.messageBox); return; } // Use direct name
    if (!elements.canvas || !elements.outputWidthInput || !elements.outputHeightInput) { showMessage('Required elements missing for save.', true, elements.messageBox); return; } // Use direct name
    try {
        const targetWidth = parseInt(elements.outputWidthInput.value, 10);
        const targetHeight = parseInt(elements.outputHeightInput.value, 10);
        if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) { showMessage('Invalid output dimensions specified.', true, elements.messageBox); return; } // Use direct name
        const outputCanvas = document.createElement('canvas'); outputCanvas.width = targetWidth; outputCanvas.height = targetHeight;
        const outputCtx = outputCanvas.getContext('2d'); if (!outputCtx) throw new Error("Could not create output canvas context.");
        outputCtx.imageSmoothingQuality = "high";
        outputCtx.drawImage(elements.canvas, 0, 0, elements.canvas.width, elements.canvas.height, 0, 0, targetWidth, targetHeight);
        const dataURL = outputCanvas.toDataURL('image/png');
        const link = document.createElement('a'); link.href = dataURL;
        const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
        const mirrorType = document.querySelector('input[name="mirrorOption"]:checked')?.value || 'none';
        const preEffect = elements.preEffectSelector?.value || 'none';
        const shapeMap = { grid:'grid',brick_wall:'brick',herringbone:'herring',hexagon:'hex',skewed:'skw',semi_octagon_square:'octsq',l_shape_square:'lsq',hexagon_triangle:'hextri',square_triangle:'sqtri',rhombus:'rho',basketweave:'bask'};
        const shapeStr = shapeMap[selectedShape] || 'unk';
        const mirrorStr = mirrorType !== 'none' ? `_m${mirrorType.substring(0,1)}` : '';
        const preEffectStr = preEffect !== 'none' ? `_fx-${preEffect}` : '';
        const tileStr = `_t${elements.tilesXSlider?.value}x${elements.tilesYSlider?.value}`;
        const preTileStr = `_p${elements.preTileXSlider?.value}x${elements.preTileYSlider?.value}`;
        const scaleStr = `_sc${elements.scaleSlider?.value}`;
        let shapeParams = ''; if (selectedShape === 'skewed') { shapeParams = `_sk${elements.skewSlider?.value}_st${elements.staggerSlider?.value}`; }
        const baseName = state.originalFileName.substring(0, state.originalFileName.lastIndexOf('.')) || state.originalFileName;
        const extension = state.originalFileName.substring(state.originalFileName.lastIndexOf('.')) || '.png';
        link.download = `${baseName}${preEffectStr}_${shapeStr}${mirrorStr}${tileStr}${preTileStr}${shapeParams}${scaleStr}_${targetWidth}x${targetHeight}${extension}`
            .replace(/_none/g,'').replace(/_fx-none/g,'')
            .replace(/__/g,'_').replace(/^_|_$/g, '');
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showMessage('Image saved successfully!', false, elements.messageBox); // Use direct name
     } catch (error) { console.error('Error saving image:', error); showMessage(`Could not save the image: ${error.message}`, true, elements.messageBox); } // Use direct name
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // (imageLoader, saveButton, tiling controls, pre-effect controls listeners remain unchanged)
    if (elements.imageLoader) {
        elements.imageLoader.addEventListener('change', handleImageLoad);
    } else {
        console.error("setupEventListeners: imageLoader element not found!");
    }
    elements.saveButton?.addEventListener('click', saveImage);
    elements.tileShapeOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    elements.mirrorOptions?.forEach(opt => opt.addEventListener('change', handleOptionChange));
    const tilingSliders = [ elements.tilesXSlider, elements.tilesYSlider, elements.skewSlider, elements.staggerSlider, elements.scaleSlider, elements.preTileXSlider, elements.preTileYSlider ];
    tilingSliders.forEach(slider => { if(slider) slider.addEventListener('input', handleSliderChange); });
    elements.preEffectSelector?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.preEffectIntensitySlider, elements.preEffectIntensityValue, requestProcessAndPreview);
    setupSliderListener(elements.preEffectWaveAmplitudeSlider, elements.preEffectWaveAmplitudeValue, requestProcessAndPreview);
    setupSliderListener(elements.preEffectWaveFrequencySlider, elements.preEffectWaveFrequencyValue, requestProcessAndPreview);
    setupSliderListener(elements.preEffectWavePhaseSlider, elements.preEffectWavePhaseValue, requestProcessAndPreview, val => val + '°');
    elements.preEffectWaveDirection?.addEventListener('change', handleOptionChange);
    elements.preEffectWaveType?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.sliceShiftIntensitySlider, elements.sliceShiftIntensityValue, requestProcessAndPreview);
    elements.sliceShiftDirection?.addEventListener('change', handleOptionChange);
    setupSliderListener(elements.pixelSortThresholdSlider, elements.pixelSortThresholdValue, requestProcessAndPreview);
    elements.pixelSortDirection?.addEventListener('change', handleOptionChange);
    elements.pixelSortBy?.addEventListener('change', handleOptionChange);


    // --- CORRECTED Source Zoom Listener ---
    if (elements.sourceZoomSlider) {
         setupSliderListener(
             elements.sourceZoomSlider,
             elements.sourceZoomValueSpan,
             () => { // Callback for zoom slider
                 console.log('[MainApp] Zoom slider input. Updating transform and requesting preview.');
                 // Call functions directly by their imported names
                 handleSourceZoom( // Use direct name
                     elements, state,
                     () => updateSourcePreviewTransform(elements, state) // Use direct name
                 );
                 requestProcessAndPreview();
             },
             val => parseFloat(val).toFixed(1)
         );
    } else {
         console.warn("setupEventListeners: sourceZoomSlider not found.");
    }


    // Output Dimensions listeners remain unchanged
    elements.outputWidthInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.outputHeightInput?.addEventListener('input', (e) => handleDimensionChange(e, elements, state));
    elements.keepAspectRatioCheckbox?.addEventListener('change', () => {
        if (elements.keepAspectRatioCheckbox?.checked && state.currentImage) {
             handleDimensionChange({ target: elements.outputWidthInput }, elements, state);
        }
     });

    // --- CORRECTED Panning listeners ---
     if (elements.sourcePreviewContainer) {
         elements.sourcePreviewContainer.addEventListener('mousedown', (e) => {
             console.log('[MainApp] Mousedown on preview container.');
             startPan(e, elements, state); // Use direct name
         });

         document.addEventListener('mousemove', (e) => {
             if (!state.isDragging) return;
             // Use direct name for panMove
             panMove(
                 e, elements, state,
                 () => updateSourcePreviewTransform(elements, state) // Use direct name
             );
         });

         document.addEventListener('mouseup', (e) => {
             if (!state.isDragging) return;
             console.log('[MainApp] Mouseup detected. Ending pan and requesting preview.');
             // Use direct name for endPan
             endPan(elements, state, requestProcessAndPreview);
         });

         document.addEventListener('mouseleave', (e) => {
            if (!state.isDragging) return;
             console.log('[MainApp] Mouseleave detected during drag. Ending pan and requesting preview.');
             // Use direct name for endPan
             endPan(elements, state, requestProcessAndPreview);
         });
          console.log('[MainApp] Panning listeners attached.');
     } else {
         console.warn("setupEventListeners: sourcePreviewContainer not found.");
     }


     console.log("setupEventListeners: Finished attaching listeners.");
}


// --- Initial Application State ---
// (This section remains unchanged)
function initializeApp() {
     console.log("[MainApp] Initializing application...");
     const resetCallbacks = {
         updateTiling: () => updateTilingControlsVisibility(elements, handleSliderChange),
         updateEffects: () => updatePreEffectControlsVisibility(elements),
         updateSliders: handleSliderChange,
     };
     resetState(
         elements, state,
         resetCallbacks.updateTiling,
         resetCallbacks.updateEffects,
         resetCallbacks.updateSliders
     );
     if (!state.sourceEffectCtx && elements.sourceEffectCanvas) {
         state.sourceEffectCtx = elements.sourceEffectCanvas.getContext('2d', { willReadFrequently: true });
     }
     if (!state.sourceEffectCtx) {
          console.error("initializeApp: Failed to get sourceEffectCtx!");
          showMessage("Initialization Error: Cannot get canvas context.", true, elements.messageBox);
     }
     setupEventListeners();
     console.log("Image Tiler Initialized with Single Effect");
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
