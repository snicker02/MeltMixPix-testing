// js/generators/reactionDiffusion.js

/**
 * Generates a Reaction-Diffusion (Gray-Scott) pattern.
 * Based on the equations:
 * dA/dt = (dA * Laplacian(A)) - (A * B^2) + (feed * (1 - A))
 * dB/dt = (dB * Laplacian(B)) + (A * B^2) - ((kill + feed) * B)
 * Assumes dt = 1 for simplicity in updates.
 *
 * @param {HTMLCanvasElement} canvas - The target canvas.
 * @param {CanvasRenderingContext2D} ctx - The target canvas context.
 * @param {object} params - Parameters for generation.
 * @param {number} params.width - Desired width.
 * @param {number} params.height - Desired height.
 * @param {number} params.feed - Feed rate (F).
 * @param {number} params.kill - Kill rate (k).
 * @param {number} params.iterations - Number of simulation steps.
 * @param {number} [params.dA=1.0] - Diffusion rate for chemical A.
 * @param {number} [params.dB=0.5] - Diffusion rate for chemical B.
 * @returns {ImageData | null} The generated ImageData or null on error.
 */
export function generateReactionDiffusion(canvas, ctx, params) {
    const {
        width = 256, // Keep default size reasonable for performance
        height = 256,
        feed = 0.055, // Parameter F
        kill = 0.062, // Parameter k
        iterations = 50,
        dA = 1.0,   // Diffusion rate A
        dB = 0.5    // Diffusion rate B
    } = params;

    console.log(`Generating Reaction-Diffusion (${width}x${height}), F=${feed.toFixed(3)}, k=${kill.toFixed(3)}, iter=${iterations}`);

    if (!canvas || !ctx) {
        console.error("ReactionDiffusion Error: Canvas or Context not provided.");
        return null;
    }

    canvas.width = width;
    canvas.height = height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Initialize grids using flat arrays for potential performance gain
    let gridA = new Float32Array(width * height);
    let gridB = new Float32Array(width * height);
    let nextGridA = new Float32Array(width * height);
    let nextGridB = new Float32Array(width * height);

    // --- Initialization ---
    gridA.fill(1.0); // Fill grid A with 1
    gridB.fill(0.0); // Fill grid B with 0

    // Seed grid B (e.g., a small square in the center)
    const seedSize = Math.max(1, Math.min(Math.floor(width/10), Math.floor(height/10))); // Seed size relative to canvas, min 1
    const startX = Math.floor(width / 2 - seedSize / 2);
    const startY = Math.floor(height / 2 - seedSize / 2);

    console.log(`Seeding B in region: [${startX},${startY}] to [${startX + seedSize},${startY + seedSize}]`);
    for (let y = startY; y < startY + seedSize; y++) {
        for (let x = startX; x < startX + seedSize; x++) {
            // Ensure seeding stays within bounds
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const index = y * width + x;
                gridB[index] = 1.0;
            }
        }
    }

    // --- Laplacian Function (handles wrap-around boundaries) ---
    // Weights for 3x3 kernel: Center=-1, Orthogonal=0.2, Diagonal=0.05
    function laplacian(grid, x, y) {
        let sum = 0.0;
        const idx_top = ((y - 1 + height) % height) * width;
        const idx_mid = y * width;
        const idx_bot = ((y + 1) % height) * width;
        const idx_lft = (x - 1 + width) % width;
        const idx_rgt = (x + 1) % width;

        // Orthogonal neighbors (weight 0.2)
        sum += grid[idx_top + x]     * 0.2; // Top
        sum += grid[idx_bot + x]     * 0.2; // Bottom
        sum += grid[idx_mid + idx_lft] * 0.2; // Left
        sum += grid[idx_mid + idx_rgt] * 0.2; // Right
        // Diagonal neighbors (weight 0.05)
        sum += grid[idx_top + idx_lft] * 0.05; // Top-Left
        sum += grid[idx_top + idx_rgt] * 0.05; // Top-Right
        sum += grid[idx_bot + idx_lft] * 0.05; // Bottom-Left
        sum += grid[idx_bot + idx_rgt] * 0.05; // Bottom-Right
        // Center (weight -1)
        sum += grid[idx_mid + x] * -1.0;
        return sum;
    }

    // --- Simulation Loop ---
    console.log("Starting RD simulation...");
    let startSimTime = performance.now();
    for (let i = 0; i < iterations; i++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const a = gridA[index];
                const b = gridB[index];

                const laplaceA = laplacian(gridA, x, y);
                const laplaceB = laplacian(gridB, x, y);

                const reaction = a * b * b; // The reaction term A*B^2

                // Calculate change using Gray-Scott equations (dt=1 assumed for simplicity)
                const deltaA = (dA * laplaceA) - reaction + (feed * (1.0 - a));
                const deltaB = (dB * laplaceB) + reaction - ((kill + feed) * b);

                // Calculate next state and clamp between 0 and 1
                let nextA = a + deltaA;
                let nextB = b + deltaB;
                nextA = Math.max(0.0, Math.min(1.0, nextA));
                nextB = Math.max(0.0, Math.min(1.0, nextB));

                // Store in the 'next' grid
                nextGridA[index] = nextA;
                nextGridB[index] = nextB;
            }
        }

        // Swap grids for the next iteration (efficiently swap references)
        let tempA = gridA;
        gridA = nextGridA;
        nextGridA = tempA;

        let tempB = gridB;
        gridB = nextGridB;
        nextGridB = tempB;

        // Optional: Log progress every few iterations
        // if ((i + 1) % 10 === 0) console.log(` RD Iteration: ${i + 1}/${iterations}`);
    }
    let endSimTime = performance.now();
    console.log(`RD simulation finished in ${(endSimTime - startSimTime).toFixed(2)} ms.`);

    // --- Render final state (map chemical B to grayscale) ---
    console.log("Rendering final RD state...");
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const pixelIndex = index * 4; // Index in the imageData array (R, G, B, A)

            // Map concentration of B (0 to 1) to grayscale (0 to 255)
            // You can experiment with different mappings here!
            // For example, map A to Red, B to Green? colorVal = A*255; data[pix+1]=B*255?
            const bValue = gridB[index]; // Use the final state of gridB
            const colorVal = Math.floor(bValue * 255);

            data[pixelIndex]     = colorVal; // Red
            data[pixelIndex + 1] = colorVal; // Green
            data[pixelIndex + 2] = colorVal; // Blue
            data[pixelIndex + 3] = 255;      // Alpha (fully opaque)
        }
    }
    console.log("RD rendering calculation complete.");

    // --- Draw to Canvas ---
    try {
        ctx.putImageData(imageData, 0, 0);
        console.log("Reaction-Diffusion pattern drawn to canvas.");
        return imageData; // Return the generated data
    } catch (e) {
        console.error("Error putting generated RD image data on canvas:", e);
        return null;
    }
}
