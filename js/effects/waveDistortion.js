import { getInterpolatedPixel } from '../utils/canvasUtils.js'; // Import the helper

/**
 * Applies wave distortion to the image based on source data.
 * @param {ImageData} imageData - The ImageData object to modify (destination).
 * @param {object} params - Effect parameters.
 * @param {number} params.amplitude - Wave amplitude (pixels).
 * @param {number} params.frequency - Wave frequency (cycles across image).
 * @param {number} params.phase - Wave phase shift (radians).
 * @param {string} params.direction - 'horizontal', 'vertical', or 'both'.
 * @param {string} params.waveType - 'sine' or 'cosine'.
 * @param {object} context - Additional context.
 * @param {ImageData} context.sourceImageData - The *original* image data to sample from.
 */
export function applyWaveDistortion(imageData, params, context) {
    const { amplitude = 10, frequency = 5, phase = 0, direction = 'horizontal', waveType = 'sine' } = params;
    const { sourceImageData } = context;

    if (!sourceImageData) {
        console.error("Source image data not available for wave distortion.");
        return; // Need source data to sample from
    }

    const data = imageData.data; // Target data array to modify
    const width = imageData.width;
    const height = imageData.height;
    const sourceData = sourceImageData.data; // Source data to read pixels from

    // Create a temporary buffer for destination pixels to avoid read/write conflicts on the same array
    const destinationData = new Uint8ClampedArray(data.length);

    // Adjust frequency calculation for more intuitive control (e.g., 5 means 5 full cycles)
    const freqScale = (Math.PI * 2) * frequency;
    const waveFunc = (waveType === 'cosine') ? Math.cos : Math.sin;

    for (let py = 0; py < height; py++) { // Iterate through destination pixels
        for (let px = 0; px < width; px++) {

            let sx = px; // Source x coordinate starts at destination x
            let sy = py; // Source y coordinate starts at destination y

            // Calculate offsets based on wave parameters
            let xOffset = 0;
            let yOffset = 0;

            if (direction === 'horizontal' || direction === 'both') {
                // Horizontal wave offsets source X based on destination Y position
                xOffset = amplitude * waveFunc((py / height) * freqScale + phase);
                sx = px + xOffset;
            }
            if (direction === 'vertical' || direction === 'both') {
                // Vertical wave offsets source Y based on destination X position
                yOffset = amplitude * waveFunc((px / width) * freqScale + phase);
                sy = py + yOffset;
            }

            // Get the interpolated pixel color from the calculated source coordinates (sx, sy)
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