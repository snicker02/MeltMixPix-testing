// js/utils/drawingUtils.js

// Constants for geometry calculations
const SQRT2 = Math.sqrt(2);
const SQRT3 = Math.sqrt(3);
const DEG60 = Math.PI / 3;
const DEG30 = Math.PI / 6;
const DEG45 = Math.PI / 4;

// ... (keep drawHexagonPath, drawOctagonPath, drawSquarePath, etc. from previous step) ...
/**
 * Draws a hexagon path centered at (x, y).
 * @param {CanvasRenderingContext2D} targetCtx - The context to draw on.
 * @param {number} x - Center x-coordinate.
 * @param {number} y - Center y-coordinate.
 * @param {number} radius - Distance from center to vertex.
 */
export function drawHexagonPath(targetCtx, x, y, radius) {
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius * Math.cos(Math.PI / 2), y + radius * Math.sin(Math.PI / 2));
    for (let i = 1; i <= 6; i++) {
        targetCtx.lineTo(x + radius * Math.cos(Math.PI / 3 * i + Math.PI / 2), y + radius * Math.sin(Math.PI / 3 * i + Math.PI / 2));
    }
}

/**
 * Draws an octagon path centered at (x, y).
 * @param {CanvasRenderingContext2D} targetCtx - The context to draw on.
 * @param {number} x - Center x-coordinate.
 * @param {number} y - Center y-coordinate.
 * @param {number} radius - Distance from center to vertex.
 */
export function drawOctagonPath(targetCtx, x, y, radius) {
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius * Math.cos(Math.PI / 8), y + radius * Math.sin(Math.PI / 8));
    for (let i = 1; i <= 8; i++) {
        targetCtx.lineTo(x + radius * Math.cos(Math.PI / 4 * i + Math.PI / 8), y + radius * Math.sin(Math.PI / 4 * i + Math.PI / 8));
    }
}

/**
 * Draws a square path centered at (x, y).
 * @param {CanvasRenderingContext2D} targetCtx - The context to draw on.
 * @param {number} x - Center x-coordinate.
 * @param {number} y - Center y-coordinate.
 * @param {number} sideLength - Length of the square's side.
 */
export function drawSquarePath(targetCtx, x, y, sideLength) {
    const halfSide = sideLength / 2;
    targetCtx.beginPath();
    targetCtx.rect(x - halfSide, y - halfSide, sideLength, sideLength);
}

/**
 * Draws an L-shaped tromino path starting at top-left corner (x, y).
 * @param {CanvasRenderingContext2D} targetCtx - The context to draw on.
 * @param {number} x - Top-left x-coordinate of the bounding 2x2 box.
 * @param {number} y - Top-left y-coordinate of the bounding 2x2 box.
 * @param {number} unitSize - The size of one square unit within the L shape.
 */
export function drawLTrominoPath(targetCtx, x, y, unitSize) {
    targetCtx.beginPath();
    targetCtx.moveTo(x, y);
    targetCtx.lineTo(x + 2 * unitSize, y);
    targetCtx.lineTo(x + 2 * unitSize, y + unitSize);
    targetCtx.lineTo(x + unitSize, y + unitSize);
    targetCtx.lineTo(x + unitSize, y + 2 * unitSize);
    targetCtx.lineTo(x, y + 2 * unitSize);
    targetCtx.closePath();
}

/**
 * Draws an equilateral triangle path centered at (x, y).
 * @param {CanvasRenderingContext2D} targetCtx - The context to draw on.
 * @param {number} x - Center x-coordinate.
 * @param {number} y - Center y-coordinate.
 * @param {number} sideLength - Length of the triangle's side.
 * @param {boolean} pointUp - If true, triangle points up; otherwise, points down.
 */
export function drawTrianglePath(targetCtx, x, y, sideLength, pointUp) {
    const height = sideLength * SQRT3 / 2;
    const halfSide = sideLength / 2;
    const vertOffset1 = height * (2/3);
    const vertOffset2 = height * (1/3);
    targetCtx.beginPath();
    if (pointUp) {
        targetCtx.moveTo(x, y - vertOffset1);
        targetCtx.lineTo(x + halfSide, y + vertOffset2);
        targetCtx.lineTo(x - halfSide, y + vertOffset2);
    } else {
        targetCtx.moveTo(x, y + vertOffset1);
        targetCtx.lineTo(x - halfSide, y - vertOffset2);
        targetCtx.lineTo(x + halfSide, y - vertOffset2);
    }
    targetCtx.closePath();
}

/**
 * Draws a rhombus path centered at (x, y).
 * @param {CanvasRenderingContext2D} targetCtx - The context to draw on.
 * @param {number} x - Center x-coordinate.
 * @param {number} y - Center y-coordinate.
 * @param {number} width - Full width of the rhombus.
 * @param {number} height - Full height of the rhombus.
 */
export function drawRhombusPath(targetCtx, x, y, width, height) {
    const halfW = width / 2;
    const halfH = height / 2;
    targetCtx.beginPath();
    targetCtx.moveTo(x, y - halfH);
    targetCtx.lineTo(x + halfW, y);
    targetCtx.lineTo(x, y + halfH);
    targetCtx.lineTo(x - halfW, y);
    targetCtx.closePath();
}


// --- ADD THIS FUNCTION ---
/**
 * Helper function for bilinear interpolation to get pixel data from source coordinates.
 * Used by effects like Wave Distortion and Fractal Zoom.
 * @param {number} x - The source x-coordinate (can be fractional).
 * @param {number} y - The source y-coordinate (can be fractional).
 * @param {Uint8ClampedArray} sourceData - The source image pixel data array.
 * @param {number} width - The width of the source image data.
 * @param {number} height - The height of the source image data.
 * @returns {Array<number>} An array representing the [r, g, b, a] pixel values.
 */
export function getInterpolatedPixel(x, y, sourceData, width, height) {
    const x_floor = Math.floor(x);
    const y_floor = Math.floor(y);
    const x_frac = x - x_floor;
    const y_frac = y - y_floor;

    // Indices of the four surrounding pixels
    const index1 = (y_floor * width + x_floor) * 4;
    const index2 = index1 + 4; // Pixel to the right
    const index3 = index1 + width * 4; // Pixel below
    const index4 = index3 + 4; // Pixel diagonally down-right

    const pixel = [0, 0, 0, 255]; // Default to opaque black

    // Check bounds for safety
    const x_plus_1_in_bounds = (x_floor + 1) < width;
    const y_plus_1_in_bounds = (y_floor + 1) < height;
    const valid1 = x_floor >= 0 && y_floor >= 0 && index1 >= 0 && index1 < sourceData.length;
    const valid2 = valid1 && x_plus_1_in_bounds;
    const valid3 = valid1 && y_plus_1_in_bounds;
    const valid4 = valid2 && valid3;

    for (let i = 0; i < 4; i++) { // Loop through r, g, b, a
        const p1 = valid1 ? sourceData[index1 + i] : 0;
        const p2 = valid2 ? sourceData[index2 + i] : p1;
        const p3 = valid3 ? sourceData[index3 + i] : p1;
        const p4 = valid4 ? sourceData[index4 + i] : (valid3 ? p3 : (valid2 ? p2 : p1)); // Fallback logic

        // Bilinear interpolation
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