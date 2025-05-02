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
        width = 256,
        height = 256,
        feed = 0.055,
        kill = 0.062,
        iterations = 100, // Defaulting to more iterations
        dA = 1.0,
        dB = 0.5
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

    // Initialize grids
    let gridA = new Float32Array(width * height);
    let gridB = new Float32Array(width * height);
    let nextGridA = new Float32Array(width * height);
    let nextGridB = new Float32Array(width * height);

    // --- Initialization ---
    gridA.fill(1.0);
    gridB.fill(0.0);

    // Seed grid B
    const seedSize = Math.max(1, Math.min(Math.floor(width/10), Math.floor(height/10)));
    const startX = Math.floor(width / 2 - seedSize / 2);
    const startY = Math.floor(height / 2 - seedSize / 2);
    console.log(`Seeding B in region: [${startX},${startY}] to [${startX + seedSize},${startY + seedSize}]`);
    for (let y = startY; y < startY + seedSize; y++) {
        for (let x = startX; x < startX + seedSize; x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
                gridB[y * width + x] = 1.0; // Use direct index calculation
            }
        }
    }

    // --- Laplacian Function (REVISED - Careful Indexing) ---
    // Weights: Center=-1, Orthogonal=0.2, Diagonal=0.05
    function laplacian(grid, x, y) {
        let sum = 0.0;
        const w = width; // Shorter alias
        const h = height;

        // Calculate neighbor coordinates with wrap-around
        const x_prev = (x - 1 + w) % w;
        const x_next = (x + 1)     % w;
        const y_prev = (y - 1 + h) % h;
        const y_next = (y + 1)     % h;

        // Calculate indices based on coordinates
        const idx_curr = y * w + x;
        const idx_n  = y_prev * w + x;      // North
        const idx_s  = y_next * w + x;      // South
        const idx_w  = y      * w + x_prev; // West
        const idx_e  = y      * w + x_next; // East
        const idx_nw = y_prev * w + x_prev; // Northwest
        const idx_ne = y_prev * w + x_next; // Northeast
        const idx_sw = y_next * w + x_prev; // Southwest
        const idx_se = y_next * w + x_next; // Southeast

        // Apply weights
        sum += grid[idx_n]  * 0.2;
        sum += grid[idx_s]  * 0.2;
        sum += grid[idx_w]  * 0.2;
        sum += grid[idx_e]  * 0.2;
        sum += grid[idx_nw] * 0.05;
        sum += grid[idx_ne] * 0.05;
        sum += grid[idx_sw] * 0.05;
        sum += grid[idx_se] * 0.05;
        sum -= grid[idx_curr]; // Subtract center value (equivalent to weight -1)

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

                const reaction = a * b * b;

                // Gray-Scott equations (dt=1)
                const deltaA = (dA * laplaceA) - reaction + (feed * (1.0 - a));
                const deltaB = (dB * laplaceB) + reaction - ((kill + feed) * b);

                // Calculate next state and clamp
                let nextA = a + deltaA;
                let nextB = b + deltaB;
                nextGridA[index] = Math.max(0.0, Math.min(1.0, nextA));
                nextGridB[index] = Math.max(0.0, Math.min(1.0, nextB));
            }
        }

        // Swap grids
        let tempA = gridA; gridA = nextGridA; nextGridA = tempA;
        let tempB = gridB; gridB = nextGridB; nextGridB = tempB;
    }
    let endSimTime = performance.now();
    console.log(`RD simulation finished in ${(endSimTime - startSimTime).toFixed(2)} ms.`);

    // --- Render final state (map chemical B to grayscale) ---
    console.log("Rendering final RD state (Visualizing Chemical B)...");
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const pixelIndex = index * 4;
            const bValue = gridB[index];
            const colorVal = Math.floor(bValue * 255);
            data[pixelIndex]     = colorVal; // R
            data[pixelIndex + 1] = colorVal; // G
            data[pixelIndex + 2] = colorVal; // B
            data[pixelIndex + 3] = 255;      // A
        }
    }
    console.log("RD rendering calculation complete.");

    // --- Draw to Canvas ---
    try {
        ctx.putImageData(imageData, 0, 0);
        console.log("Reaction-Diffusion pattern drawn to canvas.");
        return imageData;
    } catch (e) {
        console.error("Error putting generated RD image data on canvas:", e);
        return null;
    }
}
