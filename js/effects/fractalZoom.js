import { getInterpolatedPixel } from '../utils/canvasUtils.js'; // Import the helper

/**
 * Applies an iterative inverse map fractal zoom effect.
 * @param {ImageData} imageData - The ImageData object to modify (destination).
 * @param {object} params - Effect parameters.
 * @param {number} params.intensity - Controls zoom factor and depth (1-100).
 * @param {object} context - Additional context.
 * @param {ImageData} context.sourceImageData - The *original* image data to sample from.
 */
export function applyFractalZoom(imageData, params, context) {
    const { intensity = 50 } = params;
    const { sourceImageData } = context;

     if (!sourceImageData) {
        console.error("Source image data not available for fractal zoom.");
        return; // Need source data to sample from
    }

    const data = imageData.data; // Target data array to modify
    const width = imageData.width;
    const height = imageData.height;
    const sourceData = sourceImageData.data; // Source data to read pixels from

    // --- Parameters derived from intensity ---
    // Max iterations (depth of the fractal subdivision)
    const maxDepth = Math.max(1, Math.min(5, Math.round(intensity / 20)));
    // Zoom factor: intensity 50 = 0 zoom, 1 = max pinch (-0.8), 100 = max bulge (+0.8)
    const zoomFactor = ((intensity - 1) / 99.0) * 1.6 - 0.8; // Range ~ -0.8 to +0.8

    // Create a temporary buffer for destination pixels
    const destinationData = new Uint8ClampedArray(data.length);

    for (let py = 0; py < height; py++) { // Iterate through destination pixels (py, px)
        for (let px = 0; px < width; px++) {

            let sx = px; // Start source lookup at the destination coordinates
            let sy = py;

            // --- Iterative Inverse Mapping ---
            // For each level of depth, calculate where the source pixel *would have been* before the zoom at that level
            for (let depth = 1; depth <= maxDepth; depth++) {
                // Determine the scale factor for this level (smaller scale for deeper levels)
                const levelFactor = 2 ** (depth - 1); // 1, 2, 4, 8...

                // Find the size of the image segment (quadrant/sub-quadrant) at this depth
                const segmentSizeW = width / levelFactor;
                const segmentSizeH = height / levelFactor;

                // Find the top-left corner (qx, qy) of the segment containing the current source point (sx, sy)
                const qx = Math.floor(sx / segmentSizeW) * segmentSizeW;
                const qy = Math.floor(sy / segmentSizeH) * segmentSizeH;

                // Find the center of this segment
                const centerX = qx + segmentSizeW / 2;
                const centerY = qy + segmentSizeH / 2;

                // Calculate the vector from the center to the current source point
                const dx = sx - centerX;
                const dy = sy - centerY;

                // Determine the scaling factor for this depth level's zoom/pinch
                // We divide the zoomFactor by depth so deeper levels have less influence
                const scale = 1.0 + zoomFactor / depth;

                // Avoid division by zero if scale somehow becomes 0
                if (scale !== 0) {
                    // Apply the inverse scale: find where the point *was* before scaling
                    // If scale > 1 (zoom out/bulge), the source point was closer to the center (division > 1)
                    // If scale < 1 (zoom in/pinch), the source point was further from the center (division < 1)
                    sx = centerX + dx / scale;
                    sy = centerY + dy / scale;
                }
            }
            // --- End Iterative Inverse Mapping ---

            // After all iterations, (sx, sy) holds the final calculated source coordinates
            // Get the interpolated pixel color from this source location
            const [r, g, b, a] = getInterpolatedPixel(sx, sy, sourceData, width, height);

            // Write the sampled pixel color to the destination buffer
            const targetIndex = (py * width + px) * 4;
            destinationData[targetIndex] = r;
            destinationData[targetIndex + 1] = g;
            destinationData[targetIndex + 2] = b;
            destinationData[targetIndex + 3] = a;
        }
    }
    // Copy the modified pixels from the destination buffer back to the original imageData
    data.set(destinationData);
}