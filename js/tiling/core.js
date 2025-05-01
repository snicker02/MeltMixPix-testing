// js/tiling/core.js (Refactored for stateManager)
 import {
     drawHexagonPath, drawOctagonPath, drawSquarePath,
     drawLTrominoPath, drawTrianglePath, drawRhombusPath
 } from '../utils/drawingUtils.js';

 /**
  * Core function to process the image: mirror, pre-tile, and apply selected tiling.
  * @param {HTMLCanvasElement} sourceCanvasForTiling - Canvas with the prepared (panned/zoomed/effected) source region.
  * @param {object} elements - UI elements including canvases, previews, sliders.
  * @param {object} stateSnapshot - A snapshot of the current application state (e.g., from stateManager.getState()).
  * @param {Function} showMessageFunc - Function to display messages.
  */
 export function processAndPreviewImage(sourceCanvasForTiling, elements, stateSnapshot, showMessageFunc) {
     console.log(" [tiling/core.js] processAndPreviewImage - START");

     // --- Get necessary elements ---
     const {
         mirrorCanvas, preTileCanvas, canvas, finalPreview, finalPreviewText,
         scaleSlider, preTileXSlider, preTileYSlider, tilesXSlider, tilesYSlider,
         skewSlider, staggerSlider
     } = elements;

     // Check source canvas validity
      if (!sourceCanvasForTiling || sourceCanvasForTiling.width === 0 || sourceCanvasForTiling.height === 0) {
          console.error(" [tiling/core.js] processAndPreviewImage: Invalid sourceCanvasForTiling provided.");
          showMessageFunc("Error: Invalid source image for tiling.", true);
          // Caller (requestFullUpdate) is responsible for resetting isProcessing flag
          return;
      }

     // --- Get Contexts ---
     const mirrorCtx = mirrorCanvas?.getContext('2d');
     const preTileCtx = preTileCanvas?.getContext('2d');
     const ctx = canvas?.getContext('2d'); // Final output canvas (imageCanvas) context

     if (!mirrorCtx || !preTileCtx || !ctx) {
         console.error(" [tiling/core.js] Canvas context missing!");
         showMessageFunc("Error: Canvas context not available.", true);
         return;
     }

     // --- Read Controls (Tiling Parameters) ---
     const scaleFactor = parseFloat(scaleSlider?.value || 1.0);
     const preTileGridX = parseInt(preTileXSlider?.value || 1, 10);
     const preTileGridY = parseInt(preTileYSlider?.value || 1, 10);
     const mirrorType = document.querySelector('input[name="mirrorOption"]:checked')?.value || 'none';
     const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
     const numTilesX = parseInt(tilesXSlider?.value || 1, 10);
     const numTilesY = parseInt(tilesYSlider?.value || 1, 10);
     const skewMagnitude = parseFloat(skewSlider?.value || 0.5);
     const staggerFactor = parseFloat(staggerSlider?.value || 0.5);
    //  console.log(` [tiling/core.js] Parameters: Shape=${selectedShape}, Mirror=${mirrorType}, Tiles=${numTilesX}x${numTilesY}, Scale=${scaleFactor}, PreTile=${preTileGridX}x${preTileGridY}`);


     // --- Step 0: Create Mirrored Image ---
     // Use dimensions from the source canvas passed in (which is already panned/zoomed/effected)
     const sourceWidth = sourceCanvasForTiling.width;
     const sourceHeight = sourceCanvasForTiling.height;
     if (!sourceWidth || !sourceHeight) {
          console.error(" [tiling/core.js] sourceCanvasForTiling has zero dimensions.");
          showMessageFunc("Error: Source image dimensions missing for mirroring.", true);
          return;
      }
     mirrorCanvas.width = sourceWidth;
     mirrorCanvas.height = sourceHeight;
     mirrorCtx.clearRect(0, 0, mirrorCanvas.width, mirrorCanvas.height);
     mirrorCtx.save();

     let scaleMx = 1, scaleMy = 1, transMx = 0, transMy = 0;
     if (mirrorType === 'horizontal' || mirrorType === 'both') { scaleMx = -1; transMx = mirrorCanvas.width; }
     if (mirrorType === 'vertical' || mirrorType === 'both') { scaleMy = -1; transMy = mirrorCanvas.height; }
     if (transMx !== 0 || transMy !== 0) mirrorCtx.translate(transMx, transMy);
     if (scaleMx !== 1 || scaleMy !== 1) mirrorCtx.scale(scaleMx, scaleMy);

     try {
         mirrorCtx.drawImage(
             sourceCanvasForTiling, // Draw the already prepared source
             0, 0, mirrorCanvas.width, mirrorCanvas.height
         );
     } catch (e) { /* ... error handling ... */ mirrorCtx.restore(); return; }
     mirrorCtx.restore();


     // --- Step 1: Create Pre-Tiled Image ---
     preTileCanvas.width = sourceWidth;
     preTileCanvas.height = sourceHeight;
     preTileCtx.clearRect(0, 0, preTileCanvas.width, preTileCanvas.height);
     const safePreTileGridX = Math.max(1, preTileGridX);
     const safePreTileGridY = Math.max(1, preTileGridY);
     const preTileW = preTileCanvas.width / safePreTileGridX;
     const preTileH = preTileCanvas.height / safePreTileGridY;
     for (let py = 0; py < safePreTileGridY; py++) {
         for (let px = 0; px < safePreTileGridX; px++) {
              try { preTileCtx.drawImage(mirrorCanvas, px * preTileW, py * preTileH, preTileW, preTileH); }
              catch (e) { /* ... error handling ... */ return; }
         }
     }

     // --- Step 2: Draw Final Tiled Image onto 'canvas' (elements.canvas) ---
     // Use the stateSnapshot to get original dimensions if needed for aspect ratio,
     // but the actual output canvas size should match the input source size here.
     canvas.width = sourceWidth;
     canvas.height = sourceHeight;
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     const drawSourceWidth = preTileCanvas.width; // Source for tiling is the pre-tiled canvas
     const drawSourceHeight = preTileCanvas.height;
    //  console.log(` [tiling/core.js] Drawing final tiled image (${canvas.width}x${canvas.height}) using preTileCanvas (${drawSourceWidth}x${drawSourceHeight})`);

     try {
         // --- Shape-Specific Drawing Logic ---
         // (This extensive logic remains unchanged)
          if (selectedShape === 'grid') { /* ... */ }
          else if (selectedShape === 'brick_wall') { /* ... */ }
          else if (selectedShape === 'herringbone') { /* ... */ }
          else if (selectedShape === 'skewed') { /* ... */ }
          else if (selectedShape === 'hexagon') { /* ... */ }
          else if (selectedShape === 'semi_octagon_square') { /* ... */ }
          else if (selectedShape === 'l_shape_square') { /* ... */ }
          else if (selectedShape === 'hexagon_triangle') { /* ... */ }
          else if (selectedShape === 'square_triangle') { /* ... */ }
          else if (selectedShape === 'rhombus') { /* ... */ }
          else if (selectedShape === 'basketweave') { /* ... */ }
         // --- End Shape Logic ---
        //  console.log(` [tiling/core.js] Finished drawing shape: ${selectedShape}`);
     } catch (e) {
          console.error(` [tiling/core.js] Error applying tiling shape "${selectedShape}":`, e);
          showMessageFunc(`Error during ${selectedShape} tiling.`, true);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
      }


     // --- Step 3: Update Final Result Preview ---
     console.log(" [tiling/core.js] Updating final result preview image...");
     try {
         const dataURL = canvas.toDataURL('image/png'); // Use elements.canvas
         if (finalPreview) {
             finalPreview.src = dataURL;
             finalPreview.classList.remove('hidden');
            //  console.log("  -> Set finalPreview src and made visible.");
         } else { console.warn(" [tiling/core.js] finalPreview element not found."); }
         if (finalPreviewText) {
             finalPreviewText.classList.add('hidden');
            //  console.log("  -> Hid finalPreviewText.");
         } else { console.warn(" [tiling/core.js] finalPreviewText element not found."); }
     } catch (error) {
         console.error(" [tiling/core.js] Error generating final preview:", error);
         showMessageFunc("Could not generate final preview.", true);
         if (finalPreview) finalPreview.classList.add('hidden');
         if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview Error"; }
     }

     // <<< REMOVED: state.isProcessing = false; >>> Caller (requestFullUpdate) handles this.

     console.log(" [tiling/core.js] processAndPreviewImage - END");
 }
