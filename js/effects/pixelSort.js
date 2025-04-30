// js/effects/pixelSort.js

/**
 * Sorts runs of pixels below a certain threshold based on a chosen metric.
 * @param {ImageData} imageData - The ImageData object to modify.
 * @param {object} params - Effect parameters.
 * @param {number} [params.threshold=100] - Brightness threshold (0-255). Pixels darker than this are sorted.
 * @param {string} [params.direction='horizontal'] - 'horizontal' or 'vertical'.
 * @param {string} [params.sortBy='brightness'] - Metric to sort by ('brightness', 'hue', 'saturation', 'red', 'green', 'blue').
 */
export function applyPixelSort(imageData, params) {
    const { threshold = 100, direction = 'horizontal', sortBy = 'brightness' } = params || {};
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Helper to convert RGB to HSL (needed for hue/saturation sorting)
    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    }

    // Helper to get the value used for sorting
    function getSortValue(r, g, b) {
        switch(sortBy) {
            case 'hue': return rgbToHsl(r, g, b)[0];
            case 'saturation': return rgbToHsl(r, g, b)[1];
            case 'red': return r;
            case 'green': return g;
            case 'blue': return b;
            case 'brightness':
            default: return 0.299 * r + 0.587 * g + 0.114 * b; // Luminance approx.
        }
    }

    // Process rows or columns
    if (direction === 'horizontal') {
        for (let y = 0; y < height; y++) {
            let currentRun = [];
            let startXOfRun = -1;
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const r = data[index], g = data[index+1], b = data[index+2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b; // Use luminance for threshold check

                if (brightness < threshold) { // Pixel is below threshold, part of a potential run
                    if (currentRun.length === 0) startXOfRun = x; // Mark start of new run
                    currentRun.push({ r, g, b, a: data[index+3], sortValue: getSortValue(r, g, b) });
                } else { // Pixel is above threshold, end the current run (if any)
                    if (currentRun.length > 1) { // Only sort runs longer than 1 pixel
                        currentRun.sort((a, b) => a.sortValue - b.sortValue); // Sort the run
                        // Write sorted pixels back
                        for(let i=0; i<currentRun.length; i++) {
                            const pixel = currentRun[i];
                            const targetIndex = (y * width + startXOfRun + i) * 4;
                            data[targetIndex]   = pixel.r;
                            data[targetIndex+1] = pixel.g;
                            data[targetIndex+2] = pixel.b;
                            data[targetIndex+3] = pixel.a;
                        }
                    }
                    currentRun = []; // Reset run
                    startXOfRun = -1;
                }
            }
            // Process any run remaining at the end of the row
            if (currentRun.length > 1) {
                currentRun.sort((a, b) => a.sortValue - b.sortValue);
                for(let i=0; i<currentRun.length; i++) {
                    const pixel = currentRun[i];
                    const targetIndex = (y * width + startXOfRun + i) * 4;
                    data[targetIndex]   = pixel.r; data[targetIndex+1] = pixel.g;
                    data[targetIndex+2] = pixel.b; data[targetIndex+3] = pixel.a;
                }
            }
        }
    } else { // Vertical
        for (let x = 0; x < width; x++) {
            let currentRun = [];
            let startYOfRun = -1;
            for (let y = 0; y < height; y++) {
                const index = (y * width + x) * 4;
                const r = data[index], g = data[index+1], b = data[index+2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

                if (brightness < threshold) {
                    if (currentRun.length === 0) startYOfRun = y;
                    currentRun.push({ r, g, b, a: data[index+3], sortValue: getSortValue(r, g, b) });
                } else {
                    if (currentRun.length > 1) {
                        currentRun.sort((a, b) => a.sortValue - b.sortValue);
                        for(let i=0; i<currentRun.length; i++) {
                            const pixel = currentRun[i];
                            const targetIndex = ((startYOfRun + i) * width + x) * 4;
                            data[targetIndex]   = pixel.r; data[targetIndex+1] = pixel.g;
                            data[targetIndex+2] = pixel.b; data[targetIndex+3] = pixel.a;
                        }
                    }
                    currentRun = [];
                    startYOfRun = -1;
                }
            }
             // Process any run remaining at the end of the column
            if (currentRun.length > 1) {
                currentRun.sort((a, b) => a.sortValue - b.sortValue);
                for(let i=0; i<currentRun.length; i++) {
                    const pixel = currentRun[i];
                    const targetIndex = ((startYOfRun + i) * width + x) * 4;
                    data[targetIndex]   = pixel.r; data[targetIndex+1] = pixel.g;
                    data[targetIndex+2] = pixel.b; data[targetIndex+3] = pixel.a;
                }
            }
        }
    }
}