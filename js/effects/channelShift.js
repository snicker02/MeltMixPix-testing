// js/effects/channelShift.js

/**
 * Shifts the RGB channels horizontally by different random amounts.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Effect parameters.
 * @param {number} [params.intensity=30] - Controls the maximum shift amount (1-100).
 */
export function applyChannelShift(imageData, params) {
    const { intensity = 30 } = params || {};
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const sourceData = new Uint8ClampedArray(data); // Work on a copy

    // Calculate max shift based on intensity (e.g., 10% of width at max intensity)
    const maxShift = Math.round(width * (intensity / 100) * 0.1);

    // Determine random shifts for each channel
    const shiftR = Math.floor((Math.random() - 0.5) * 2 * maxShift);
    const shiftG = Math.floor((Math.random() - 0.5) * 2 * maxShift);
    // Optional: make blue shift less for a more subtle effect
    const shiftB = Math.floor((Math.random() - 0.5) * 2 * maxShift * 0.5);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;

            // Calculate source coordinates with wrap-around for each channel
            const xR = (x + shiftR + width) % width;
            const xG = (x + shiftG + width) % width;
            const xB = (x + shiftB + width) % width;

            // Get source indices for each channel
            const indexR = (y * width + xR) * 4;
            const indexG = (y * width + xG) * 4;
            const indexB = (y * width + xB) * 4;

            // Assign shifted channel values to the target pixel
            data[index]     = sourceData[indexR];     // Red from shifted R source
            data[index + 1] = sourceData[indexG + 1]; // Green from shifted G source
            data[index + 2] = sourceData[indexB + 2]; // Blue from shifted B source
            data[index + 3] = sourceData[index + 3];  // Keep original alpha
        }
    }
}