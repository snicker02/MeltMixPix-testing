// js/generators/reactionDiffusion.js

/**
 * Generates a Reaction-Diffusion (Gray-Scott) pattern.
 * REVISED: Includes explicit dt and simplified Laplacian weights.
 */
export function generateReactionDiffusion(canvas, ctx, params) {
    const {
        width = 256,
        height = 256,
        feed = 0.055, // Parameter F
        kill = 0.062, // Parameter k
        iterations = 100,
        dA = 1.0,   // Diffusion rate A
        dB = 0.5,   // Diffusion rate B
        dt = 1.0    // Time step (often 1, but can be adjusted)
    } = params;

    console.log(`Generating Reaction-Diffusion (${width}x${height}), F=${feed.toFixed(3)}, k=${kill.toFixed(3)}, iter=${iterations}, dt=${dt}`);

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
                gridB[y * width + x] = 1.0;
            }
        }
    }

    // --- Laplacian Function (Simplified Weights) ---
    // Weights: Center=-1, Orthogonal=0.25, Diagonal=0
    function laplacian(grid, x, y) {
        let sum = 0.0;
        const w = width;
        const h = height;

        const idx_curr = y * w + x;
        const idx_n  = ((y - 1 + h) % h) * w + x;
        const idx_s  = ((y + 1    ) % h) * w + x;
        const idx_w  = y * w + ((x - 1 + w) % w);
        const idx_e  = y * w + ((x + 1    ) % w);

        // Apply weights (simplified kernel)
        sum += grid[idx_n] * 0.25;
        sum += grid[idx_s] * 0.25;
        sum += grid[idx_w] * 0.25;
        sum += grid[idx_e] * 0.25;
        sum -= grid[idx_curr]; // Subtract center value

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

                // Gray-Scott equations
                const deltaA = (dA * laplaceA) - reaction + (feed * (1.0 - a));
                const deltaB = (dB * laplaceB) + reaction - ((kill + feed) * b);

                // Calculate next state using dt and clamp
                // <<< Use dt in the update step >>>
                let nextA = a + deltaA * dt;
                let nextB = b + deltaB * dt;
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
            const bValue = gridB[index]; // Render B
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
