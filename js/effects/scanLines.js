/**
 * Applies horizontal or vertical scan lines to the image data.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Object containing effect parameters.
 * @param {number} params.intensity - The darkness factor (0-100). Higher means darker lines.
 * @param {string} [params.direction='horizontal'] - 'horizontal' or 'vertical'. (Currently only uses intensity).
 * @param {number} [params.thickness=2] - Thickness of the darkened line. (Currently uses fixed thickness logic).
 */
export function applyScanLines(imageData, params) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const intensity = params.intensity || 50; // Default intensity
    const darknessFactor = intensity / 100; // Convert 0-100 intensity to 0-1 factor
    const lineThickness = 2; // Fixed thickness logic from original code

    // Currently only horizontal scanlines implemented based on original code structure
    // Modify here to add vertical/direction logic if needed, using params.direction

    for (let y = 0; y < height; y += (lineThickness * 2)) { // Process every other set of lines
        // Darken the lines within the current thickness band
        for (let lineY = y; lineY < Math.min(y + lineThickness, height); lineY++) {
            for (let x = 0; x < width; x++) {
                const index = (lineY * width + x) * 4;
                // Reduce brightness based on darknessFactor
                data[index] = Math.max(0, data[index] * (1 - darknessFactor));       // Red
                data[index + 1] = Math.max(0, data[index + 1] * (1 - darknessFactor)); // Green
                data[index + 2] = Math.max(0, data[index + 2] * (1 - darknessFactor)); // Blue
                // Alpha remains unchanged
            }
        }
    }
}