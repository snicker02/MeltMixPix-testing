// js/generators/perlinNoise.js

/**
 * Simple Perlin Noise implementation helper (Linear Congruential Generator for randomness).
 * You might want to replace this with a more robust library like 'simplex-noise' later.
 */
const Perlin = {
    rand_seed: 1,
    rand: function() {
        // LCG
        this.rand_seed = (1103515245 * this.rand_seed + 12345) % 0x80000000;
        return this.rand_seed / 0x80000000;
    },
    noise: function(x, y, z = 0) {
        // Simple placeholder noise function - replace with actual Perlin/Simplex noise logic
        // This basic version just returns pseudo-random value based on integer coordinates
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        this.rand_seed = (ix * 19) ^ (iy * 137) ^ (iz * 271); // Seed based on coords
        return this.rand(); // Return value between 0 and 1
    },
    // --- Add actual Perlin/Simplex noise implementation functions here ---
    // For this example, we'll use a simplified noise function.
    // A real implementation involves gradients, dot products, interpolation (fade function), etc.
};

/**
 * Parses a hex color string (#RRGGBB) into an [r, g, b] array.
 * @param {string} hex - The hex color string.
 * @returns {Array<number>} [r, g, b] array (0-255).
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0]; // Default to black if parse fails
}

/**
 * Generates a Perlin noise pattern onto the canvas.
 * @param {HTMLCanvasElement} canvas - The target canvas.
 * @param {CanvasRenderingContext2D} ctx - The target canvas context.
 * @param {object} params - Parameters for generation.
 * @param {number} params.width - Desired width.
 * @param {number} params.height - Desired height.
 * @param {number} params.scale - Noise scale (lower = more zoomed in).
 * @param {string} params.color1 - Start color (hex string).
 * @param {string} params.color2 - End color (hex string).
 * @returns {ImageData | null} The generated ImageData or null on error.
 */
export function generatePerlinNoise(canvas, ctx, params) {
    const {
        width = 512,
        height = 512,
        scale = 50, // Affects zoom level of noise pattern
        color1 = '#000000',
        color2 = '#ffffff'
    } = params;

    if (!canvas || !ctx) {
        console.error("Perlin Noise: Canvas or Context not provided.");
        return null;
    }

    console.log(`Generating Perlin Noise (${width}x${height}), scale: ${scale}`);

    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);

    // --- IMPORTANT: Replace Perlin.noise with a real noise function ---
    // This loop demonstrates the structure, but uses the placeholder noise
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Get noise value for this coordinate, scaled
            // A real implementation would use x/scale, y/scale
            const noiseVal = Perlin.noise(x / scale, y / scale); // Value 0 to 1

            // Simple linear interpolation between color1 and color2 based on noise
            const r = Math.round(r1 + (r2 - r1) * noiseVal);
            const g = Math.round(g1 + (g2 - g1) * noiseVal);
            const b = Math.round(b1 + (b2 - b1) * noiseVal);

            const index = (y * width + x) * 4;
            data[index] = r;     // Red
            data[index + 1] = g; // Green
            data[index + 2] = b; // Blue
            data[index + 3] = 255; // Alpha (fully opaque)
        }
    }
    // --------------------------------------------------------------------

    try {
        ctx.putImageData(imageData, 0, 0);
        console.log("Perlin Noise generation complete.");
        return imageData; // Return the generated data
    } catch (e) {
        console.error("Error putting generated image data on canvas:", e);
        return null;
    }
}

// --- TODO: Add actual Perlin/Simplex noise functions below or import a library ---
// Example structure if implementing noise directly:
// function perlinNoise2D(x, y) { ... complex math ... return noiseValue; }
// function octaveNoise(x, y, octaves, persistence) { ... loop calling perlinNoise2D ... return totalNoise; }
