/**
 * Applies random noise to the image data.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Object containing effect parameters.
 * @param {number} params.intensity - The intensity of the noise (1-100).
 */
export function applyNoise(imageData, params) {
    const data = imageData.data;
    const intensity = params.intensity || 50; // Default intensity if not provided
    // Scale intensity: 0 intensity = 0 noise, 100 intensity = +/- 127 noise range
    const noiseAmount = Math.round(127 * (intensity / 100));

    for (let i = 0; i < data.length; i += 4) {
        // Generate noise between -noiseAmount and +noiseAmount
        const noise = Math.round((Math.random() - 0.5) * 2 * noiseAmount);

        // Apply noise to R, G, B channels and clamp between 0 and 255
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // Red
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // Green
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // Blue
        // Alpha channel (data[i + 3]) is usually left unchanged
    }
}