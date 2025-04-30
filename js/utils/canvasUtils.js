/**
 * Gets the canvas element and its 2D rendering context.
 * @param {string} canvasId - The ID of the canvas element.
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D} | null} Canvas and context, or null if not found.
 */
export function getCanvasAndContext(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with ID "${canvasId}" not found.`);
        return null;
    }
    // Get context with willReadFrequently for performance optimization
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        console.error("Failed to get 2D context.");
        return null;
    }
    return { canvas, ctx };
}

/**
 * Loads an image file onto the canvas, resizing if necessary.
 * @param {File} file - The image file to load.
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on.
 * @param {CanvasRenderingContext2D} ctx - The rendering context.
 * @param {number} [maxWidth=800] - Maximum width for resizing.
 * @param {number} [maxHeight=800] - Maximum height for resizing.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded Image object.
 */
export function loadImageOntoCanvas(file, canvas, ctx, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                    console.log(`Resized image to ${width}x${height} for performance.`);
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(img); // Resolve with the loaded Image object
            };
            img.onerror = () => {
                console.error("Error loading the image into Image object.");
                reject(new Error("Could not load the selected image file."));
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error("Error reading the file.");
            reject(new Error("Could not read the selected file."));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Gets image data from the canvas. Includes basic error handling.
 * @param {CanvasRenderingContext2D} ctx - The rendering context.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @returns {ImageData | null} The ImageData object or null on error.
 */
export function getCanvasImageData(ctx, canvas) {
    try {
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error("Error getting canvas image data:", error);
        // Potentially a cross-origin issue if the image source wasn't handled correctly
        alert("Could not process canvas data. Ensure the image is from a valid source or try a different image.");
        return null;
    }
}

/**
 * Helper function for bilinear interpolation to get pixel data from source coordinates.
 * Used by effects like Wave Distortion and Fractal Zoom.
 * @param {number} x - The source x-coordinate (can be fractional).
 * @param {number} y - The source y-coordinate (can be fractional).
 * @param {Uint8ClampedArray} sourceData - The source image pixel data array.
 * @param {number} width - The width of the source image data.
 * @param {number} height - The height of the source image data. // Added height parameter
 * @returns {Array<number>} An array representing the [r, g, b, a] pixel values.
 */
export function getInterpolatedPixel(x, y, sourceData, width, height) {
    const x_floor = Math.floor(x);
    const y_floor = Math.floor(y);
    const x_frac = x - x_floor;
    const y_frac = y - y_floor;

    const index1 = (y_floor * width + x_floor) * 4;
    const index2 = (y_floor * width + (x_floor + 1)) * 4;
    const index3 = ((y_floor + 1) * width + x_floor) * 4;
    const index4 = ((y_floor + 1) * width + (x_floor + 1)) * 4;

    const pixel = [0, 0, 0, 255]; // Default to opaque black

    // Check if indices are within bounds
    const valid1 = index1 >= 0 && index1 < sourceData.length;
    const valid2 = index2 >= 0 && index2 < sourceData.length && (x_floor + 1) < width; // Ensure x+1 is in bounds
    const valid3 = index3 >= 0 && index3 < sourceData.length && (y_floor + 1) < height; // Ensure y+1 is in bounds
    const valid4 = index4 >= 0 && index4 < sourceData.length && (x_floor + 1) < width && (y_floor + 1) < height;

    for (let i = 0; i < 4; i++) { // Loop through r, g, b, a
        const p1 = valid1 ? sourceData[index1 + i] : 0;
        const p2 = valid2 ? sourceData[index2 + i] : p1; // Use p1 if p2 is out of bounds
        const p3 = valid3 ? sourceData[index3 + i] : p1; // Use p1 if p3 is out of bounds
        const p4 = valid4 ? sourceData[index4 + i] : (valid3 ? p3 : (valid2 ? p2 : p1)); // Use best available neighbor

        const topInterpolation = p1 * (1 - x_frac) + p2 * x_frac;
        const bottomInterpolation = p3 * (1 - x_frac) + p4 * x_frac;
        pixel[i] = Math.round(topInterpolation * (1 - y_frac) + bottomInterpolation * y_frac);
    }
    // Clamp values just in case interpolation gives slightly out-of-range numbers
    pixel[0] = Math.max(0, Math.min(255, pixel[0]));
    pixel[1] = Math.max(0, Math.min(255, pixel[1]));
    pixel[2] = Math.max(0, Math.min(255, pixel[2]));
    pixel[3] = Math.max(0, Math.min(255, pixel[3]));

    return pixel;
}

/**
 * Creates a temporary canvas to resize/draw the final image for saving.
 * @param {HTMLCanvasElement} sourceCanvas - The canvas with the image to save.
 * @param {number} saveWidth - The desired width for the saved image.
 * @param {number} saveHeight - The desired height for the saved image.
 * @returns {HTMLCanvasElement | null} A new canvas with the drawn image, or null on error.
 */
export function createSaveCanvas(sourceCanvas, saveWidth, saveHeight) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = saveWidth;
    tempCanvas.height = saveHeight;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
        console.error("Could not create temporary canvas context for saving.");
        return null;
    }

    // Enable anti-aliasing for resizing
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Draw the source canvas onto the temporary canvas, resizing it
    tempCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, saveWidth, saveHeight);

    return tempCanvas;
}