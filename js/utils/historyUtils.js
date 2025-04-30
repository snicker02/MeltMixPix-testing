const MAX_HISTORY = 10; // Max number of undo steps

/**
 * Updates the enabled/disabled state of undo/redo buttons.
 * @param {object} elements - Object containing references to undoButton and redoButton.
 * @param {object} state - Object containing history array and historyIndex.
 */
export function updateUndoRedoButtons(elements, state) {
    const { undoButton, redoButton } = elements;
    if (undoButton) undoButton.disabled = state.historyIndex <= 0;
    if (redoButton) redoButton.disabled = state.historyIndex >= state.history.length - 1;
}

/**
 * Clears the history array and resets the index.
 * @param {object} state - Object containing history array and historyIndex.
 * @param {Function} updateButtonsFunc - Function to update button states (updateUndoRedoButtons).
 * @param {object} elements - DOM elements needed by updateButtonsFunc.
 */
export function clearHistory(state, updateButtonsFunc, elements) {
    state.history = [];
    state.historyIndex = -1;
    updateButtonsFunc(elements, state);
}

/**
 * Pushes a new state (ImageData) onto the history stack.
 * Handles history truncation if max size is reached or if undoing then making a change.
 * @param {ImageData} imageData - The ImageData object to save.
 * @param {object} state - Object containing history array and historyIndex.
 * @param {Function} updateButtonsFunc - Function to update button states (updateUndoRedoButtons).
 * @param {object} elements - DOM elements needed by updateButtonsFunc.
 */
export function pushHistoryState(imageData, state, updateButtonsFunc, elements) {
    if (!imageData) return;

    // If we undid and then made a change, truncate the future history
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Create a true copy of the ImageData
    const historyImageData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );

    // Add the new state
    state.history.push(historyImageData);

    // Remove the oldest state if history exceeds max size
    if (state.history.length > MAX_HISTORY) {
        state.history.shift();
    }

    // Update the index to point to the latest state
    state.historyIndex = state.history.length - 1;

    console.log(`History push: size=${state.history.length}, index=${state.historyIndex}`);
    updateButtonsFunc(elements, state);
}

/**
 * Reverts the canvas to the previous state in history.
 * @param {object} state - Object containing history, historyIndex, ctx, lastAppliedImageData.
 * @param {Function} updateButtonsFunc - Function to update button states (updateUndoRedoButtons).
 * @param {object} elements - DOM elements needed by updateButtonsFunc.
 */
export function undo(state, updateButtonsFunc, elements) {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const previousState = state.history[state.historyIndex];
        if (state.ctx && previousState) {
            state.ctx.putImageData(previousState, 0, 0);
            // Update lastAppliedImageData to reflect the undone state
            state.lastAppliedImageData = new ImageData(
                 new Uint8ClampedArray(previousState.data),
                 previousState.width,
                 previousState.height
             );
            console.log(`Undo: index=${state.historyIndex}`);
            updateButtonsFunc(elements, state);
        }
    }
}

/**
 * Re-applies the next state in history (after an undo).
 * @param {object} state - Object containing history, historyIndex, ctx, lastAppliedImageData.
 * @param {Function} updateButtonsFunc - Function to update button states (updateUndoRedoButtons).
 * @param {object} elements - DOM elements needed by updateButtonsFunc.
 */
export function redo(state, updateButtonsFunc, elements) {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const nextState = state.history[state.historyIndex];
         if (state.ctx && nextState) {
            state.ctx.putImageData(nextState, 0, 0);
             // Update lastAppliedImageData to reflect the redone state
            state.lastAppliedImageData = new ImageData(
                 new Uint8ClampedArray(nextState.data),
                 nextState.width,
                 nextState.height
             );
            console.log(`Redo: index=${state.historyIndex}`);
            updateButtonsFunc(elements, state);
        }
    }
}