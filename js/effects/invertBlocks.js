// js/effects/invertBlocks.js

/**
 * Inverts the colors within randomly placed square or circular blocks.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Effect parameters.
 * @param {number} [params.intensity=30] - Controls block size and number of blocks (1-100).
 */
export function applyInvertBlocks(imageData, params) {
    const { intensity = 30 } = params || {};
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Calculate parameters based on intensity
    const maxBlockSize = Math.max(5, Math.round(Math.min(width, height) * (intensity / 100) * 0.25));
    const numBlocks = Math.round(5 + 100 * (intensity / 100)); // Fewer blocks than displacement

    for (let i = 0; i < numBlocks; i++) {
        const blockSize = Math.max(3, Math.floor(Math.random() * maxBlockSize));
        const x1 = Math.floor(Math.random() * (width - blockSize));
        const y1 = Math.floor(Math.random() * (height - blockSize));
        const shape = Math.random() < 0.5 ? 'square' : 'circle'; // Randomly choose shape

        if (shape === 'square') {
            for (let by = 0; by < blockSize; by++) {
                for (let bx = 0; bx < blockSize; bx++) {
                    const index = ((y1 + by) * width + (x1 + bx)) * 4;
                    data[index]     = 255 - data[index];     // Invert Red
                    data[index + 1] = 255 - data[index + 1]; // Invert Green
                    data[index + 2] = 255 - data[index + 2]; // Invert Blue
                    // Alpha remains unchanged
                }
            }
        } else { // Circle
            const cx = x1 + blockSize / 2;
            const cy = y1 + blockSize / 2;
            const radiusSq = (blockSize / 2) * (blockSize / 2);

            for (let by = 0; by < blockSize; by++) {
                for (let bx = 0; bx < blockSize; bx++) {
                    const px = x1 + bx;
                    const py = y1 + by;
                    // Check if pixel center is within the circle's radius
                    const distSq = (px + 0.5 - cx)**2 + (py + 0.5 - cy)**2;
                    if (distSq < radiusSq) {
                        const index = (py * width + px) * 4;
                        data[index]     = 255 - data[index];
                        data[index + 1] = 255 - data[index + 1];
                        data[index + 2] = 255 - data[index + 2];
                    }
                }
            }
        }
    }
}