// js/stateManager.js

const MAX_HISTORY = 10; // Max number of undo steps

// Define the initial structure of the application state
let state = {
    currentImage: null,          // Holds the original loaded Image object
    originalImageData: null,     // Holds the initial ImageData after load (used?) Maybe remove if history[0] suffices. Let's keep for now.
    originalFileName: 'downloaded-image.png',
    originalWidth: 0,
    originalHeight: 0,
    originalAspectRatio: 1,

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
     // Add validation/clamping logic if needed, or keep it in UI layer?
     // For now, just update state. Clamping happens in updateSourcePreviewTransform.
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

export function setImageData(img, fileName) {
    if (img instanceof Image && img.naturalWidth > 0 && img.naturalHeight > 0) {
        state.currentImage = img;
        state.originalWidth = img.naturalWidth;
        state.originalHeight = img.naturalHeight;
        state.originalAspectRatio = state.originalWidth / state.originalHeight;
        if (fileName) {
            state.originalFileName = fileName;
        }
        // Reset related state on new image
        state.currentOffsetX = 0;
        state.currentOffsetY = 0;
        state.startOffsetX = 0;
        state.startOffsetY = 0;
        state.sourceZoomLevel = 1.0;
        state.isDragging = false;
        state.isProcessing = false; // Ensure processing stops on new image load
        console.log("[stateManager] New image set, state reset.");
        // History is cleared separately by calling clearHistoryState()
    } else {
        console.error("[stateManager] setImageData: Invalid image provided.");
    }
}

export function resetStateData() {
    console.log("[stateManager] Resetting state data to initial values.");
    state = {
        currentImage: null,
        originalImageData: null,
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

    console.log(`[stateManager] Pushing history state. Current index: ${state.historyIndex}, Length: ${state.history.length}`);
    // If we undid and then made a change, truncate the future history
    if (state.historyIndex < state.history.length - 1) {
        console.log(`  -> Truncating future history from index ${state.historyIndex + 1}`);
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Create a true copy of the ImageData
    // IMPORTANT: ImageData constructor might not be directly available in all contexts,
    // but copying the buffer is standard.
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
