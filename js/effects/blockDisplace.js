// js/effects/blockDisplace.js

/**
 * Randomly swaps square blocks of pixels within the image.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Effect parameters.
 * @param {number} [params.intensity=30] - Controls block size and number of swaps (1-100).
 */
export function applyBlockDisplace(imageData, params) {
    const { intensity = 30 } = params || {};
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Calculate parameters based on intensity
    const maxBlockSize = Math.max(5, Math.round(Math.min(width, height) * (intensity / 100) * 0.2)); // Max 20% of smaller dimension
    const numBlocks = Math.round(10 + 190 * (intensity / 100)); // More swaps with higher intensity

    for (let i = 0; i < numBlocks; i++) {
        // Determine random block size
        const blockSize = Math.max(3, Math.floor(Math.random() * maxBlockSize)); // Min size 3

        // Determine random top-left corners for two blocks, ensuring they fit
        const x1 = Math.floor(Math.random() * (width - blockSize));
        const y1 = Math.floor(Math.random() * (height - blockSize));
        const x2 = Math.floor(Math.random() * (width - blockSize));
        const y2 = Math.floor(Math.random() * (height - blockSize));

        // Avoid swapping a block with itself (though unlikely with large images)
        if (x1 === x2 && y1 === y2) continue;

        // Swap the blocks pixel by pixel using temporary storage (less efficient but simpler)
        // A more optimized approach would use get/putImageData on sub-regions if performance is critical
        for (let by = 0; by < blockSize; by++) {
            for (let bx = 0; bx < blockSize; bx++) {
                const index1 = ((y1 + by) * width + (x1 + bx)) * 4;
                const index2 = ((y2 + by) * width + (x2 + bx)) * 4;

                // Store pixel from block 1
                const r1 = data[index1];
                const g1 = data[index1 + 1];
                const b1 = data[index1 + 2];
                const a1 = data[index1 + 3];

                // Copy pixel from block 2 to block 1
                data[index1]     = data[index2];
                data[index1 + 1] = data[index2 + 1];
                data[index1 + 2] = data[index2 + 2];
                data[index1 + 3] = data[index2 + 3];

                // Copy stored pixel from block 1 to block 2
                data[index2]     = r1;
                data[index2 + 1] = g1;
                data[index2 + 2] = b1;
                data[index2 + 3] = a1;
            }
        }
    }
}