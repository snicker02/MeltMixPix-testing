// js/effects/sierpinski.js

/**
 * Creates a Sierpinski carpet pattern by clearing center squares recursively.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Effect parameters.
 * @param {number} [params.intensity=30] - Controls recursion depth (1-100 -> maps to depth 1-6).
 */
export function applySierpinski(imageData, params) {
    const { intensity = 30 } = params || {};
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Map intensity to recursion depth (e.g., 1-6)
    const maxDepth = Math.max(1, Math.min(6, Math.round(intensity / 16)));

    function clearCenter(x, y, w, h) {
        // Ensure dimensions are integers and positive
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const endX = Math.min(width, Math.floor(x + w));
        const endY = Math.min(height, Math.floor(y + h));

        if (startX >= endX || startY >= endY) return; // Skip if dimensions are invalid

        for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
                const index = (py * width + px) * 4;
                // Make center transparent (or set to a specific color like white/black)
                data[index + 3] = 0; // Set alpha to 0 (transparent)
                // Or set to white:
                // data[index] = 255; data[index + 1] = 255; data[index + 2] = 255; data[index + 3] = 255;
            }
        }
    }

    function drawCarpet(level, x, y, w, h) {
        if (level <= 0 || w < 1 || h < 1) return;

        const subW = w / 3;
        const subH = h / 3;
        const centerX = x + subW;
        const centerY = y + subH;

        // Clear the center square
        clearCenter(centerX, centerY, subW, subH);

        // Recurse for the 8 surrounding rectangles
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (row === 1 && col === 1) continue; // Skip center
                drawCarpet(level - 1, x + col * subW, y + row * subH, subW, subH);
            }
        }
    }

    drawCarpet(maxDepth, 0, 0, width, height);
}