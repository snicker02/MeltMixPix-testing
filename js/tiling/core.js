// js/tiling/core.js (Refactored - Revised square_triangle SIZING logic)
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
     // console.log(" [tiling/core.js] processAndPreviewImage - START");

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
          return;
      }

     // --- Get Contexts ---
     const mirrorCtx = mirrorCanvas?.getContext('2d');
     const preTileCtx = preTileCanvas?.getContext('2d');
     const outputCanvas = elements.canvas;
     const outputCtx = outputCanvas.getContext('2d');

     if (!mirrorCtx || !preTileCtx || !outputCtx) {
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

     // --- Step 0: Create Mirrored Image ---
     const sourceWidth = sourceCanvasForTiling.width;
     const sourceHeight = sourceCanvasForTiling.height;
     if (!sourceWidth || !sourceHeight) { /* error handling */ return; }
     mirrorCanvas.width = sourceWidth;
     mirrorCanvas.height = sourceHeight;
     mirrorCtx.clearRect(0, 0, mirrorCanvas.width, mirrorCanvas.height);
     mirrorCtx.save();
     let scaleMx = 1, scaleMy = 1, transMx = 0, transMy = 0;
     if (mirrorType === 'horizontal' || mirrorType === 'both') { scaleMx = -1; transMx = mirrorCanvas.width; }
     if (mirrorType === 'vertical' || mirrorType === 'both') { scaleMy = -1; transMy = mirrorCanvas.height; }
     if (transMx !== 0 || transMy !== 0) mirrorCtx.translate(transMx, transMy);
     if (scaleMx !== 1 || scaleMy !== 1) mirrorCtx.scale(scaleMx, scaleMy);
     try { mirrorCtx.drawImage(sourceCanvasForTiling, 0, 0, mirrorCanvas.width, mirrorCanvas.height); }
     catch (e) { console.error(" [tiling/core.js] Error drawing mirrored image:", e); mirrorCtx.restore(); return; }
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
              catch (e) { console.error(" [tiling/core.js] Error drawing pre-tile section:", e); return; }
         }
     }

     // --- Step 2: Draw Final Tiled Image onto 'outputCanvas' (elements.canvas) ---
     outputCanvas.width = sourceWidth;
     outputCanvas.height = sourceHeight;
     outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
     const drawSourceWidth = preTileCanvas.width;
     const drawSourceHeight = preTileCanvas.height;

     try {
         // --- Shape-Specific Drawing Logic (Draws onto outputCtx) ---
          if (selectedShape === 'grid') { /* ... */ }
          else if (selectedShape === 'brick_wall') { /* ... */ }
          else if (selectedShape === 'herringbone') { /* ... */ }
          else if (selectedShape === 'skewed') { /* ... */ }
          else if (selectedShape === 'hexagon') { /* ... */ }
          else if (selectedShape === 'semi_octagon_square') { /* ... */ }
          else if (selectedShape === 'l_shape_square') { /* ... */ }
          else if (selectedShape === 'hexagon_triangle') { /* ... */ }

          // <<< MODIFIED square_triangle block - SIZING LOGIC >>>
          else if (selectedShape === 'square_triangle') {
              const SQRT3_OVER_2 = Math.sqrt(3) / 2; // ~0.866

              // Calculate the *scaled* side length needed to fit numTilesY pairs vertically
              // Height of one pair = square height + triangle height = s + s * SQRT3_OVER_2 = s * (1 + SQRT3_OVER_2)
              const totalVerticalUnits = numTilesY > 0 ? numTilesY : 1; // Avoid division by zero
              const scaledSideLength = (outputCanvas.height / totalVerticalUnits) / (1 + SQRT3_OVER_2);

              // Calculate the actual side length before scaling (used for layout)
              const sideLength = scaledSideLength / scaleFactor;

              // Actual heights based on the calculated scaled side length
              const actualSquareHeight = scaledSideLength;
              const actualTriHeight = scaledSideLength * SQRT3_OVER_2;

              // Loop bounds (keep generous buffers from previous attempt)
              const numCols = Math.ceil(outputCanvas.width / sideLength) + 6;
              let currentY = -Math.max(actualSquareHeight, actualTriHeight) * 2.0;
              let rowCount = 0;

              while (currentY < outputCanvas.height + Math.max(actualSquareHeight, actualTriHeight) * 3) {
                  const isSquareRow = (rowCount % 2 === 0);
                  const currentRowHeight = isSquareRow ? actualSquareHeight : actualTriHeight;
                  const isStaggered = (rowCount % 2 !== 0);

                  for (let c = -3; c < numCols; c++) {
                      const cellBaseX = c * sideLength + (isStaggered ? sideLength / 2 : 0);

                      if (isSquareRow) {
                          const sqCenterX = cellBaseX + sideLength / 2;
                          // Center vertically within the allocated square row height
                          const sqCenterY = currentY + actualSquareHeight / 2;
                          outputCtx.save();
                          // Use scaledSideLength for drawing the actual shape
                          drawSquarePath(outputCtx, sqCenterX, sqCenterY, scaledSideLength);
                          outputCtx.clip();
                          outputCtx.drawImage(preTileCanvas, sqCenterX - drawSourceWidth / 2, sqCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();
                      } else { // Triangle row
                          // Center vertically within the allocated triangle row height
                          const triCenterY = currentY + actualTriHeight / 2;

                          // Centers for the two triangles within the 'sideLength' wide cell
                          const tri1CenterX = cellBaseX + sideLength * 0.25;
                          const tri2CenterX = cellBaseX + sideLength * 0.75;

                          // Use scaledSideLength for drawing the actual shape
                          const tri1PointsUp = true;
                          const tri2PointsUp = false;

                          // Draw left triangle
                          outputCtx.save();
                          drawTrianglePath(outputCtx, tri1CenterX, triCenterY, scaledSideLength, tri1PointsUp);
                          outputCtx.clip();
                          outputCtx.drawImage(preTileCanvas, tri1CenterX - drawSourceWidth / 2, triCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();

                          // Draw right triangle
                          outputCtx.save();
                          drawTrianglePath(outputCtx, tri2CenterX, triCenterY, scaledSideLength, tri2PointsUp);
                          outputCtx.clip();
                          outputCtx.drawImage(preTileCanvas, tri2CenterX - drawSourceWidth / 2, triCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();
                      }
                  }
                  currentY += currentRowHeight; // Advance Y by the height of the row just drawn
                  rowCount++;
              }
          }
          // <<< END MODIFIED block >>>

          else if (selectedShape === 'rhombus') { /* ... */ }
          else if (selectedShape === 'basketweave') { /* ... */ }
         // --- End Shape Logic ---
     } catch (e) {
          console.error(` [tiling/core.js] Error applying tiling shape "${selectedShape}":`, e);
          showMessageFunc(`Error during ${selectedShape} tiling.`, true);
          outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
          return;
      }


     // --- Step 3: Update Final Result Preview ---
    //  console.log(" [tiling/core.js] Updating final result preview image...");
     try {
          // Log output canvas content BEFORE generating DataURL
        //   try {
        //      console.log(` [tiling/core.js] Output canvas content BEFORE toDataURL (${outputCanvas.width}x${outputCanvas.height}) (Data URL potentially long):`, outputCanvas.toDataURL().substring(0, 100) + '...');
        //   } catch (e) {
        //       console.error(" [tiling/core.js] Error getting dataURL from output canvas:", e);
        //   }

         const dataURL = outputCanvas.toDataURL('image/png'); // Use elements.canvas

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

     console.log(" [tiling/core.js] processAndPreviewImage - END");
 }
