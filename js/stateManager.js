// js/stateManager.js

const MAX_HISTORY = 10; // Max number of undo steps

// Define the initial structure of the application state
let state = {
    currentImage: null,          // Holds the original loaded Image object (null if source is generated)
    originalImageData: null,     // Holds the initial ImageData after load (less relevant now with history[0])
    originalFileName: 'downloaded-image.png', // Default/fallback filename
    originalWidth: 0,            // Width of the source (loaded image OR generated pattern)
    originalHeight: 0,           // Height of the source
    originalAspectRatio: 1,      // Aspect ratio of the source

    isProcessing: false,         // Flag to prevent concurrent processing
    isDragging: false,           // Flag for panning state

    // Panning state
    dragStartX: 0, dragStartY: 0,
    currentOffsetX: 0, currentOffsetY: 0,
    startOffsetX: 0, startOffsetY: 0,

    // Zoom state
    sourceZoomLevel: 1.0,

    // History
    history: [],                 // Array to store ImageData states
    historyIndex: -1             // Index of the current state in the history array
};

// --- State Getters ---

export function getState() {
    // Use cautiously - prefer specific getters if possible
    return { ...state };
}

export function getCurrentImage() {
    // Returns the Image object if loaded, null otherwise
    return state.currentImage;
}

export function getOriginalDimensions() {
    return { width: state.originalWidth, height: state.originalHeight };
}

export function getOriginalAspectRatio() {
    return state.originalAspectRatio;
}

export function getOriginalFileName() {
    return state.originalFileName;
}

export function isProcessing() {
    return state.isProcessing;
}

export function isDragging() {
    return state.isDragging;
}

export function getPanState() {
    return {
        dragStartX: state.dragStartX,
        dragStartY: state.dragStartY,
        currentOffsetX: state.currentOffsetX,
        currentOffsetY: state.currentOffsetY,
        startOffsetX: state.startOffsetX,
        startOffsetY: state.startOffsetY,
    };
}

export function getZoomLevel() {
    return state.sourceZoomLevel;
}

// --- State Setters / Mutators ---

export function setProcessing(processingStatus) {
    if (typeof processingStatus === 'boolean') {
        state.isProcessing = processingStatus;
    }
}

export function setDragging(draggingStatus, eventPageX = null, eventPageY = null) {
    if (typeof draggingStatus === 'boolean') {
        state.isDragging = draggingStatus;
        if (draggingStatus && eventPageX !== null && eventPageY !== null) {
            // Store start drag info if starting drag
            state.dragStartX = eventPageX;
            state.dragStartY = eventPageY;
            state.startOffsetX = state.currentOffsetX;
            state.startOffsetY = state.currentOffsetY;
        }
    }
}

export function updatePanOffsets(newOffsetX, newOffsetY) {
     // Clamping happens in updateSourcePreviewTransform in uiUtils
     state.currentOffsetX = newOffsetX;
     state.currentOffsetY = newOffsetY;
}
export function setCurrentOffsets(x, y) {
    // Specifically set clamped offsets after UI update
    state.currentOffsetX = x;
    state.currentOffsetY = y;
}


export function setZoomLevel(level) {
    if (typeof level === 'number' && level > 0) {
        state.sourceZoomLevel = level;
    }
}

/**
 * Sets the base image state, handling both loaded images and generated sources.
 * @param {Image | null} img - The loaded Image object, or null if the source was generated.
 * @param {string} fileName - The original filename or a generated name.
 */
export function setImageData(img, fileName) {
    state.currentImage = null; // Reset image object first

    if (img instanceof Image && img.naturalWidth > 0 && img.naturalHeight > 0) {
        state.currentImage = img;
        state.originalWidth = img.naturalWidth;
        state.originalHeight = img.naturalHeight;
        console.log("[stateManager] Image object set.");
    } else if (img === null) {
         console.log("[stateManager] Image object set to null (likely generated source). Dimensions must be set separately.");
         // Dimensions will be set via setGeneratedDimensions for generated patterns
    } else {
         console.error("[stateManager] setImageData: Invalid image provided. Must be an Image object or null.");
         return; // Don't proceed if invalid
    }

    // Always set filename and calculate aspect ratio if dimensions are valid
    if (fileName) {
        state.originalFileName = fileName;
    }
    if (state.originalWidth > 0 && state.originalHeight > 0) {
         state.originalAspectRatio = state.originalWidth / state.originalHeight;
    } else {
         state.originalAspectRatio = 1; // Default aspect ratio if dimensions aren't set yet
    }

    // Reset related state whenever the source changes (loaded OR generated)
    state.currentOffsetX = 0;
    state.currentOffsetY = 0;
    state.startOffsetX = 0;
    state.startOffsetY = 0;
    state.sourceZoomLevel = 1.0;
    state.isDragging = false;
    state.isProcessing = false; // Ensure processing stops
    console.log(`[stateManager] Source set (Image: ${state.currentImage ? 'Yes' : 'No'}, File: ${state.originalFileName}). State reset.`);
    // History is cleared separately by calling clearHistoryState() before setting new source
}

/**
 * Sets the original dimensions and aspect ratio, typically for generated sources.
 * @param {number} width
 * @param {number} height
 */
export function setGeneratedDimensions(width, height) {
    if (typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0) {
        state.originalWidth = width;
        state.originalHeight = height;
        state.originalAspectRatio = width / height;
        console.log(`[stateManager] Dimensions set to ${width}x${height}.`);
    } else {
        console.error("[stateManager] setGeneratedDimensions: Invalid width or height provided.");
    }
}


export function resetStateData() {
    console.log("[stateManager] Resetting state data to initial values.");
    state = {
        currentImage: null,
        originalImageData: null, // Can probably remove this field eventually
        originalFileName: 'downloaded-image.png',
        originalWidth: 0,
        originalHeight: 0,
        originalAspectRatio: 1,
        isProcessing: false,
        isDragging: false,
        dragStartX: 0, dragStartY: 0,
        currentOffsetX: 0, currentOffsetY: 0,
        startOffsetX: 0, startOffsetY: 0,
        sourceZoomLevel: 1.0,
        history: [],
        historyIndex: -1
    };
    // Note: Canvas contexts are NOT part of this state module.
}


// --- History Management ---

export function clearHistoryState() {
    console.log("[stateManager] Clearing history.");
    state.history = [];
    state.historyIndex = -1;
}

export function pushHistoryState(imageData) {
    if (!imageData || !(imageData instanceof ImageData)) {
        console.error("[stateManager] pushHistoryState: Invalid ImageData provided.");
        return;
    }
    if (imageData.width !== state.originalWidth || imageData.height !== state.originalHeight) {
        console.warn(`[stateManager] Pushing history state with dimensions (${imageData.width}x${imageData.height}) that differ from original state (${state.originalWidth}x${state.originalHeight}). This might cause issues if not intended.`);
        // Consider updating originalWidth/Height here if this is expected behavior for some effects
    }


    console.log(`[stateManager] Pushing history state. Current index: ${state.historyIndex}, Length: ${state.history.length}`);
    // If we undid and then made a change, truncate the future history
    if (state.historyIndex < state.history.length - 1) {
        console.log(`  -> Truncating future history from index ${state.historyIndex + 1}`);
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Create a true copy of the ImageData
    try {
        const historyImageData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );

        // Add the new state
        state.history.push(historyImageData);
        console.log(`  -> Pushed state with dimensions ${historyImageData.width}x${historyImageData.height}`);


        // Remove the oldest state if history exceeds max size
        if (state.history.length > MAX_HISTORY) {
            state.history.shift();
             console.log(`  -> History limit exceeded, removed oldest state.`);
        }

        // Update the index to point to the latest state
        state.historyIndex = state.history.length - 1;

        console.log(`  -> History push complete. New index: ${state.historyIndex}, New length: ${state.history.length}`);

    } catch (error) {
         console.error("[stateManager] Error creating or pushing ImageData copy:", error);
    }

}

export function undoState() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        console.log(`[stateManager] Undo successful. New history index: ${state.historyIndex}`);
        return state.history[state.historyIndex]; // Return the previous state's ImageData
    } else {
        console.log("[stateManager] Undo failed: Already at the oldest state.");
        return null; // Cannot undo further
    }
}

export function redoState() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        console.log(`[stateManager] Redo successful. New history index: ${state.historyIndex}`);
        return state.history[state.historyIndex]; // Return the next state's ImageData
    } else {
        console.log("[stateManager] Redo failed: Already at the newest state.");
        return null; // Cannot redo further
    }
}

export function getCurrentHistoryState() {
    if (state.historyIndex >= 0 && state.historyIndex < state.history.length) {
        return state.history[state.historyIndex];
    }
    // console.log("[stateManager] getCurrentHistoryState: No current history state available.");
    return null; // No history or index out of bounds
}

export function getHistoryInfo() {
    return {
        index: state.historyIndex,
        length: state.history.length,
        maxSize: MAX_HISTORY
    };
}
