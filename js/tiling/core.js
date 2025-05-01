// js/tiling/core.js (Reads debug sliders for square_triangle)
 import {
     drawHexagonPath, drawOctagonPath, drawSquarePath,
     drawLTrominoPath, drawTrianglePath, drawRhombusPath
 } from '../utils/drawingUtils.js';

 /**
  * Core function to process the image: mirror, pre-tile, and apply selected tiling.
  * @param {HTMLCanvasElement} sourceCanvasForTiling - Canvas with the prepared (panned/zoomed/effected) source region.
  * @param {object} elements - UI elements including canvases, previews, sliders (INCLUDING DEBUG SLIDERS).
  * @param {object} stateSnapshot - A snapshot of the current application state (e.g., from stateManager.getState()).
  * @param {Function} showMessageFunc - Function to display messages.
  */
 export function processAndPreviewImage(sourceCanvasForTiling, elements, stateSnapshot, showMessageFunc) {
     // console.log(" [tiling/core.js] processAndPreviewImage - START");

     // --- Get necessary elements ---
     const {
         mirrorCanvas, preTileCanvas, canvas, finalPreview, finalPreviewText,
         scaleSlider, preTileXSlider, preTileYSlider, tilesXSlider, tilesYSlider,
         skewSlider, staggerSlider,
         // <<< ADDED Debug Slider Elements >>>
         sqTriYStartMultSlider, sqTriYEndMultSlider, sqTriStartColSlider,
         sqTriColBufferSlider, sqTriStaggerRatioSlider, sqTriCenterRatioSlider
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
     const outputCanvas = elements.canvas; // Use a distinct variable name for clarity
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

          else if (selectedShape === 'square_triangle') {
              console.log("   [DEBUG] Running square_triangle drawing logic");

              // --- Read Values from Debug Sliders ---
              // Provide default values matching the slider defaults in case elements are missing
              const yStartMultiplier = parseFloat(sqTriYStartMultSlider?.value || 1.5);
              const yEndMultiplier = parseFloat(sqTriYEndMultSlider?.value || 2.0);
              const startCol = parseInt(sqTriStartColSlider?.value || -2, 10);
              const colBuffer = parseInt(sqTriColBufferSlider?.value || 4, 10);
              const staggerRatio = parseFloat(sqTriStaggerRatioSlider?.value || 0.5);
              const centerOffsetRatio = parseFloat(sqTriCenterRatioSlider?.value || 0.5);
              console.log(`   [DEBUG] Debug Params: yStart=${yStartMultiplier}, yEnd=${yEndMultiplier}, sCol=${startCol}, colBuf=${colBuffer}, stagRat=${staggerRatio}, centerRat=${centerOffsetRatio}`);
              // --- End Reading Debug Values ---


              // Geometric constant
              const SQRT3_OVER_2 = Math.sqrt(3) / 2;

              // Original sizing logic (using read values)
              const triHeightRel = SQRT3_OVER_2;
              const avgRowHeight = (1 + triHeightRel) / 2;
              const safeNumTilesY = numTilesY > 0 ? numTilesY : 1;
              const sideLengthX = outputCanvas.width / (numTilesX > 0 ? numTilesX : 1);
              const sideLengthY = outputCanvas.height / (safeNumTilesY * avgRowHeight);
              const sideLength = Math.min(sideLengthX, sideLengthY);

              // Calculated dimensions based on sideLength and scaleFactor
              const scaledSideLength = sideLength * scaleFactor;
              const scaledSquareSide = scaledSideLength;
              const scaledTriangleSide = scaledSideLength; // Assuming equilateral
              const actualTriHeight = scaledTriangleSide * SQRT3_OVER_2;
              const actualSquareHeight = scaledSquareSide;
              const maxTileHeight = Math.max(actualSquareHeight, actualTriHeight);

              // Loop bounds using adjustable parameters read from sliders
              const numCols = Math.ceil(outputCanvas.width / sideLength) + colBuffer; // Use read colBuffer
              let currentY = -maxTileHeight * yStartMultiplier; // Use read yStartMultiplier
              const yEndLimit = outputCanvas.height + maxTileHeight * yEndMultiplier; // Use read yEndMultiplier
              let rowCount = 0;

              // console.log(`   [DEBUG] sideLength: ${sideLength.toFixed(2)}, scaledSide: ${scaledSideLength.toFixed(2)}`);
              // console.log(`   [DEBUG] sqHeight: ${actualSquareHeight.toFixed(2)}, triHeight: ${actualTriHeight.toFixed(2)}`);
              // console.log(`   [DEBUG] numCols: ${numCols}, startCol: ${startCol}`);
              // console.log(`   [DEBUG] currentY start: ${currentY.toFixed(2)}, yEndLimit: ${yEndLimit.toFixed(2)}`);

              while (currentY < yEndLimit) {
                  const isSquareRow = (rowCount % 2 === 0);
                  const currentRowHeight = isSquareRow ? actualSquareHeight : actualTriHeight;
                  const isStaggeredRow = (rowCount % 2 !== 0);
                  const currentStaggerOffset = isStaggeredRow ? sideLength * staggerRatio : 0; // Use read staggerRatio

                  for (let c = startCol; c < numCols; c++) { // Use read startCol
                      const cellBaseX = c * sideLength + currentStaggerOffset;

                      if (isSquareRow) {
                          const sqCenterX = cellBaseX + sideLength * centerOffsetRatio; // Use read centerOffsetRatio
                          const sqCenterY = currentY + actualSquareHeight * centerOffsetRatio; // Use read centerOffsetRatio
                          outputCtx.save();
                          drawSquarePath(outputCtx, sqCenterX, sqCenterY, scaledSquareSide);
                          outputCtx.clip();
                          outputCtx.drawImage(preTileCanvas, sqCenterX - drawSourceWidth / 2, sqCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();
                      } else { // Triangle row (Original Buggy Logic - draws one triangle)
                          const triCenterY = currentY + actualTriHeight * centerOffsetRatio; // Use read centerOffsetRatio
                          const triCenterX = cellBaseX + sideLength * centerOffsetRatio; // Use read centerOffsetRatio
                          const pointUp = (c % 2 === 0);

                          outputCtx.save();
                          drawTrianglePath(outputCtx, triCenterX, triCenterY, scaledTriangleSide, pointUp);
                          outputCtx.clip();
                          outputCtx.drawImage(preTileCanvas, triCenterX - drawSourceWidth / 2, triCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();
                      }
                  }
                  currentY += currentRowHeight;
                  rowCount++;
              }
              // console.log(`   [DEBUG] Finished square_triangle loop. Final currentY: ${currentY.toFixed(2)}`);
          }

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
        //   try {
        //      console.log(` [tiling/core.js] Output canvas content BEFORE toDataURL (${outputCanvas.width}x${outputCanvas.height}) (Data URL potentially long):`, outputCanvas.toDataURL().substring(0, 100) + '...');
        //   } catch (e) {
        //       console.error(" [tiling/core.js] Error getting dataURL from output canvas:", e);
        //   }

         const dataURL = outputCanvas.toDataURL('image/png'); // Use elements.canvas

         if (finalPreview) {
             finalPreview.src = dataURL;
             finalPreview.classList.remove('hidden');
         } else { console.warn(" [tiling/core.js] finalPreview element not found."); }
         if (finalPreviewText) {
             finalPreviewText.classList.add('hidden');
         } else { console.warn(" [tiling/core.js] finalPreviewText element not found."); }
     } catch (error) {
         console.error(" [tiling/core.js] Error generating final preview:", error);
         showMessageFunc("Could not generate final preview.", true);
         if (finalPreview) finalPreview.classList.add('hidden');
         if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview Error"; }
     }

     console.log(" [tiling/core.js] processAndPreviewImage - END");
 }
