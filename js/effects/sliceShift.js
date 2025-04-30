// js/effects/sliceShift.js

/**
 * Shifts horizontal or vertical slices of the image randomly.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Effect parameters.
 * @param {number} params.intensity - Controls max shift amount and slice size variation (1-100).
 * @param {string} [params.direction='horizontal'] - 'horizontal' or 'vertical'.
 */
export function applySliceShift(imageData, params) {
    const { intensity = 30, direction = 'horizontal' } = params || {};
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const sourceData = new Uint8ClampedArray(data); // Work on a copy

    // Calculate parameters based on intensity
    const maxShift = Math.round((direction === 'horizontal' ? width : height) * (intensity / 100) * 0.3);
    const sliceSizeFactor = 1 + Math.round(10 * (intensity / 100)); // Max slice size increases with intensity
    const shiftProbability = 0.3 + (0.6 * (intensity / 100)); // Likelihood of a shift increases

    if (direction === 'horizontal') {
        for (let y = 0; y < height; y++) {
            if (Math.random() < shiftProbability) {
                const shiftAmount = Math.floor((Math.random() - 0.5) * 2 * maxShift); // Random shift +/-
                const sliceHeight = Math.max(1, Math.floor(Math.random() * sliceSizeFactor)); // Random slice height >= 1
                const sliceEndY = Math.min(y + sliceHeight, height);

                for (let sliceY = y; sliceY < sliceEndY; sliceY++) {
                    for (let x = 0; x < width; x++) {
                        const targetIndex = (sliceY * width + x) * 4;
                        // Calculate source pixel index with wrap-around
                        const sourceX = (x - shiftAmount + width) % width; // Wrap horizontally
                        const sourceIndex = (sliceY * width + sourceX) * 4;

                        data[targetIndex]     = sourceData[sourceIndex];
                        data[targetIndex + 1] = sourceData[sourceIndex + 1];
                        data[targetIndex + 2] = sourceData[sourceIndex + 2];
                        data[targetIndex + 3] = sourceData[sourceIndex + 3];
                    }
                }
                y = sliceEndY - 1; // Move main loop counter past the processed slice
            }
        }
    } else { // Vertical
        for (let x = 0; x < width; x++) {
            if (Math.random() < shiftProbability) {
                const shiftAmount = Math.floor((Math.random() - 0.5) * 2 * maxShift);
                const sliceWidth = Math.max(1, Math.floor(Math.random() * sliceSizeFactor));
                const sliceEndX = Math.min(x + sliceWidth, width);

                for (let sliceX = x; sliceX < sliceEndX; sliceX++) {
                    for (let y = 0; y < height; y++) {
                        const targetIndex = (y * width + sliceX) * 4;
                        const sourceY = (y - shiftAmount + height) % height; // Wrap vertically
                        const sourceIndex = (sourceY * width + sliceX) * 4;

                        data[targetIndex]     = sourceData[sourceIndex];
                        data[targetIndex + 1] = sourceData[sourceIndex + 1];
                        data[targetIndex + 2] = sourceData[sourceIndex + 2];
                        data[targetIndex + 3] = sourceData[sourceIndex + 3];
                    }
                }
                x = sliceEndX - 1; // Move main loop counter past the processed slice
            }
        }
    }
}