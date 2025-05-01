// js/tiling/core.js (Refactored - Revised square_triangle drawing logic)
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
     // console.log(" [tiling/core.js] processAndPreviewImage - START"); // Keep logs if needed

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
          if (selectedShape === 'grid') { const tileWidth=outputCanvas.width/numTilesX;const tileHeight=outputCanvas.height/numTilesY;const scaledTileWidth=tileWidth*scaleFactor;const scaledTileHeight=tileHeight*scaleFactor;for(let y=0;y<numTilesY;y++){for(let x=0;x<numTilesX;x++){const tileX=x*tileWidth;const tileY=y*tileHeight;const offsetX=(tileWidth-scaledTileWidth)/2;const offsetY=(tileHeight-scaledTileHeight)/2;outputCtx.drawImage(preTileCanvas,tileX+offsetX,tileY+offsetY,scaledTileWidth,scaledTileHeight);}} }
          else if (selectedShape === 'brick_wall') { const tileWidth=outputCanvas.width/numTilesX;const tileHeight=outputCanvas.height/numTilesY;const scaledTileWidth=tileWidth*scaleFactor;const scaledTileHeight=tileHeight*scaleFactor;const startY=-1;const endY=numTilesY+1;const startX=-2;const endX=numTilesX+2;for(let y=startY;y<endY;y++){let xOffset=(y%2!==0)?tileWidth/2:0;for(let x=startX;x<endX;x++){const tileX=(x*tileWidth)-xOffset;const tileY=y*tileHeight;const drawOffsetX=(tileWidth-scaledTileWidth)/2;const drawOffsetY=(tileHeight-scaledTileHeight)/2;outputCtx.drawImage(preTileCanvas,tileX+drawOffsetX,tileY+drawOffsetY,scaledTileWidth,scaledTileHeight);}} }
          else if (selectedShape === 'herringbone') { const plankWidth=outputCanvas.width/numTilesX;const plankHeight=outputCanvas.height/numTilesY;const scaledPlankWidth=plankWidth*scaleFactor;const scaledPlankHeight=plankHeight*scaleFactor;const step=Math.min(scaledPlankWidth,scaledPlankHeight)/Math.sqrt(2);const numCols=Math.ceil(outputCanvas.width/step)+4;const numRows=Math.ceil(outputCanvas.height/step)+4;for(let r=-2;r<numRows;r++){for(let c=-2;c<numCols;c++){outputCtx.save();const centerX=c*step+step/2;const centerY=r*step+step/2;const angle=((r+c)%2===0)?Math.PI/4:-Math.PI/4;outputCtx.translate(centerX,centerY);outputCtx.rotate(angle);const drawX=-scaledPlankWidth/2;const drawY=-scaledPlankHeight/2;outputCtx.beginPath();outputCtx.rect(drawX,drawY,scaledPlankWidth,scaledPlankHeight);outputCtx.clip();outputCtx.rotate(-angle);outputCtx.translate(-centerX,-centerY);outputCtx.drawImage(preTileCanvas,centerX-drawSourceWidth/2,centerY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();}} }
          else if (selectedShape === 'skewed') { const finalTileWidth=outputCanvas.width/numTilesX;const finalTileHeight=outputCanvas.height/numTilesY;const startY=-2;const endY=numTilesY+2;const startX=-3;const endX=Math.ceil(outputCanvas.width/finalTileWidth)+3;for(let y=startY;y<endY;y++){let xOffset=(y%2!==0)?(finalTileWidth*staggerFactor):0;for(let x=startX;x<endX;x++){const destX=(x*finalTileWidth)-xOffset;const destY=y*finalTileHeight;const currentSkew=(Math.abs(x%2)===0)?skewMagnitude:-skewMagnitude;outputCtx.save();outputCtx.translate(destX,destY);outputCtx.transform(1,0,currentSkew,1,0,0);const scaledWidth=finalTileWidth*scaleFactor;const scaledHeight=finalTileHeight*scaleFactor;const drawOffsetX=(finalTileWidth-scaledWidth)/2;const drawOffsetY=(finalTileHeight-scaledHeight)/2;outputCtx.drawImage(preTileCanvas,drawOffsetX,drawOffsetY,scaledWidth,scaledHeight);outputCtx.restore();}} }
          else if (selectedShape === 'hexagon') { const hexRadiusW=outputCanvas.width/(numTilesX*1.5+0.5);const hexRadiusH=outputCanvas.height/(numTilesY*Math.sqrt(3)+0.5*Math.sqrt(3));const hexRadius=Math.min(hexRadiusW,hexRadiusH);const scaledHexRadius=hexRadius*scaleFactor;const hexWidth=Math.sqrt(3)*hexRadius;const hexHeight=2*hexRadius;const vertDist=hexHeight*3/4;const numCols=Math.ceil(outputCanvas.width/hexWidth)+2;const numRows=Math.ceil(outputCanvas.height/vertDist)+2;for(let row=-1;row<numRows;row++){for(let col=-1;col<numCols;col++){const cx=col*hexWidth+((row%2)!==0?hexWidth/2:0);const cy=row*vertDist;outputCtx.save();drawHexagonPath(outputCtx,cx,cy,scaledHexRadius);outputCtx.clip();outputCtx.drawImage(preTileCanvas,cx-drawSourceWidth/2,cy-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();}} }
          else if (selectedShape === 'semi_octagon_square') { const sW=outputCanvas.width/(numTilesX*(1+Math.sqrt(2)/2));const sH=outputCanvas.height/(numTilesY*(1+Math.sqrt(2)/2));const sideLength=Math.min(sW,sH);const octRadius=sideLength/(2*Math.sin(Math.PI/8));const squareSide=sideLength;const scaledOctRadius=octRadius*scaleFactor;const scaledSquareSide=squareSide*scaleFactor;const distBetweenCenters=scaledOctRadius*Math.cos(Math.PI/8)+scaledSquareSide/2;const numUnitsX=Math.ceil(outputCanvas.width/distBetweenCenters)+4;const numUnitsY=Math.ceil(outputCanvas.height/distBetweenCenters)+4;for(let r=-2;r<numUnitsY;r++){for(let c=-2;c<numUnitsX;c++){const centerX=c*distBetweenCenters;const centerY=r*distBetweenCenters;const isOctagon=(Math.abs(r%2)===Math.abs(c%2));outputCtx.save();if(isOctagon){drawOctagonPath(outputCtx,centerX,centerY,scaledOctRadius);}else{drawSquarePath(outputCtx,centerX,centerY,scaledSquareSide);} outputCtx.clip();outputCtx.drawImage(preTileCanvas,centerX-drawSourceWidth/2,centerY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();}} }
          else if (selectedShape === 'l_shape_square') { const unitSizeX=outputCanvas.width/(numTilesX*2);const unitSizeY=outputCanvas.height/(numTilesY*2);const unitSize=Math.min(unitSizeX,unitSizeY);const scaledUnitSize=unitSize*scaleFactor;const scaledSquareSide=scaledUnitSize;const cellWidth=2*unitSize;const cellHeight=2*unitSize;const numCols=Math.ceil(outputCanvas.width/cellWidth)+2;const numRows=Math.ceil(outputCanvas.height/cellHeight)+2;for(let r=-1;r<numRows;r++){for(let c=-1;c<numCols;c++){const cellX=c*cellWidth;const cellY=r*cellHeight;const drawCenterX=cellX+unitSize;const drawCenterY=cellY+unitSize;outputCtx.save();outputCtx.translate(cellX,cellY+2*scaledUnitSize);outputCtx.rotate(-Math.PI/2);drawLTrominoPath(outputCtx,0,0,scaledUnitSize);outputCtx.clip();outputCtx.rotate(Math.PI/2);outputCtx.translate(-cellX,-(cellY+2*scaledUnitSize));outputCtx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();outputCtx.save();outputCtx.translate(cellX+scaledUnitSize,cellY);drawLTrominoPath(outputCtx,0,0,scaledUnitSize);outputCtx.clip();outputCtx.translate(-(cellX+scaledUnitSize),-cellY);outputCtx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();outputCtx.save();outputCtx.translate(cellX+scaledUnitSize,cellY+2*scaledUnitSize);outputCtx.rotate(Math.PI);drawLTrominoPath(outputCtx,0,0,scaledUnitSize);outputCtx.clip();outputCtx.rotate(-Math.PI);outputCtx.translate(-(cellX+scaledUnitSize),-(cellY+2*scaledUnitSize));outputCtx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();outputCtx.save();outputCtx.translate(cellX+2*scaledUnitSize,cellY+scaledUnitSize);outputCtx.rotate(Math.PI/2);drawLTrominoPath(outputCtx,0,0,scaledUnitSize);outputCtx.clip();outputCtx.rotate(-Math.PI/2);outputCtx.translate(-(cellX+2*scaledUnitSize),-(cellY+scaledUnitSize));outputCtx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();outputCtx.save();const sqCenterX=cellX+unitSize;const sqCenterY=cellY+unitSize;drawSquarePath(outputCtx,sqCenterX,sqCenterY,scaledSquareSide);outputCtx.clip();outputCtx.drawImage(preTileCanvas,sqCenterX-drawSourceWidth/2,sqCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();}} }
          else if (selectedShape === 'hexagon_triangle') { const hexRadiusW=outputCanvas.width/(numTilesX*1.5+0.5);const hexRadiusH=outputCanvas.height/(numTilesY*Math.sqrt(3)+0.5*Math.sqrt(3));const hexRadius=Math.min(hexRadiusW,hexRadiusH);const sideLength=hexRadius;const scaledHexRadius=hexRadius*scaleFactor;const scaledSideLength=sideLength*scaleFactor;const hexWidth=Math.sqrt(3)*hexRadius;const hexHeight=2*hexRadius;const vertDist=hexHeight*3/4;const numCols=Math.ceil(outputCanvas.width/hexWidth)+2;const numRows=Math.ceil(outputCanvas.height/vertDist)+2;const triVertDist=scaledHexRadius*Math.sqrt(3)/2+scaledSideLength*Math.sqrt(3)/6;for(let row=-1;row<numRows;row++){for(let col=-1;col<numCols;col++){const cx=col*hexWidth+((row%2)!==0?hexWidth/2:0);const cy=row*vertDist;outputCtx.save();drawHexagonPath(outputCtx,cx,cy,scaledHexRadius);outputCtx.clip();outputCtx.drawImage(preTileCanvas,cx-drawSourceWidth/2,cy-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();for(let i=0;i<6;i++){const angle=Math.PI/3*i;const triCenterX=cx+triVertDist*Math.cos(angle);const triCenterY=cy+triVertDist*Math.sin(angle);const pointUp=(i%2===0);outputCtx.save();drawTrianglePath(outputCtx,triCenterX,triCenterY,scaledSideLength,pointUp);outputCtx.clip();outputCtx.drawImage(preTileCanvas,triCenterX-drawSourceWidth/2,triCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();}}} }

          // <<< MODIFIED square_triangle block >>>
          else if (selectedShape === 'square_triangle') {
              const triHeightRel = Math.sqrt(3) / 2;
              // Determine side length based on fitting tiles across width and rows down height
              // A full repeating unit vertically is one square + one triangle row
              const unitHeightFactor = 1 + triHeightRel; // Relative height of square(1) + triangle(sqrt(3)/2)
              const sideLengthX = outputCanvas.width / numTilesX;
              const sideLengthY = outputCanvas.height / (numTilesY * unitHeightFactor);
              const sideLength = Math.min(sideLengthX, sideLengthY); // Base size for square/triangle sides

              const scaledSideLength = sideLength * scaleFactor; // Apply user scale
              const scaledSquareSide = scaledSideLength;
              const scaledTriangleSide = scaledSideLength; // Equilateral triangles
              const actualTriHeight = scaledTriangleSide * triHeightRel;
              const actualSquareHeight = scaledSquareSide;

              // Loop bounds (keep generous buffers)
              const numCols = Math.ceil(outputCanvas.width / sideLength) + 6;
              let currentY = -Math.max(actualSquareHeight, actualTriHeight) * 2.0;
              let rowCount = 0;

              while (currentY < outputCanvas.height + Math.max(actualSquareHeight, actualTriHeight) * 3) {
                  const isSquareRow = (rowCount % 2 === 0);
                  const currentRowHeight = isSquareRow ? actualSquareHeight : actualTriHeight;
                  // Stagger alternate rows (both square and triangle rows get staggered relative to the one before)
                  const isStaggered = (rowCount % 2 !== 0);

                  for (let c = -3; c < numCols; c++) {
                      // Base X for the start of the column cell (width = sideLength)
                      const cellBaseX = c * sideLength + (isStaggered ? sideLength / 2 : 0);

                      if (isSquareRow) {
                          const sqCenterX = cellBaseX + sideLength / 2;
                          const sqCenterY = currentY + actualSquareHeight / 2;
                          outputCtx.save();
                          drawSquarePath(outputCtx, sqCenterX, sqCenterY, scaledSquareSide);
                          outputCtx.clip();
                          // Draw image centered within the square
                          outputCtx.drawImage(preTileCanvas, sqCenterX - drawSourceWidth / 2, sqCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();
                      } else { // Triangle row
                          // Center Y for triangles in this row
                          const triCenterY = currentY + actualTriHeight / 2;

                          // Calculate centers for the two triangles needed to fill the horizontal space
                          const tri1CenterX = cellBaseX + sideLength * 0.25; // Center of the left triangle slot
                          const tri2CenterX = cellBaseX + sideLength * 0.75; // Center of the right triangle slot

                          // Determine orientation - they should alternate to fill the rectangle space
                          const tri1PointsUp = true; // Or determine based on row/col if needed for pattern
                          const tri2PointsUp = false;

                          // Draw left triangle
                          outputCtx.save();
                          drawTrianglePath(outputCtx, tri1CenterX, triCenterY, scaledTriangleSide, tri1PointsUp);
                          outputCtx.clip();
                          // Center the source image draw on the triangle's center
                          outputCtx.drawImage(preTileCanvas, tri1CenterX - drawSourceWidth / 2, triCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();

                          // Draw right triangle
                          outputCtx.save();
                          drawTrianglePath(outputCtx, tri2CenterX, triCenterY, scaledTriangleSide, tri2PointsUp);
                          outputCtx.clip();
                          // Center the source image draw on the triangle's center
                          outputCtx.drawImage(preTileCanvas, tri2CenterX - drawSourceWidth / 2, triCenterY - drawSourceHeight / 2, drawSourceWidth, drawSourceHeight);
                          outputCtx.restore();
                      }
                  }
                  currentY += currentRowHeight; // Advance Y by the height of the row just drawn
                  rowCount++;
              }
          }
          // <<< END MODIFIED block >>>

          else if (selectedShape === 'rhombus') { const rhombWidth=outputCanvas.width/numTilesX;const rhombHeight=outputCanvas.height/numTilesY;const scaledRhombWidth=rhombWidth*scaleFactor;const scaledRhombHeight=rhombHeight*scaleFactor;const startY=-1;const endY=numTilesY+2;const startX=-2;const endX=numTilesX+2;for(let y=startY;y<endY;y++){let xOffset=(y%2!==0)?rhombWidth/2:0;for(let x=startX;x<endX;x++){const centerX=x*rhombWidth+xOffset;const centerY=y*rhombHeight+rhombHeight/2;outputCtx.save();drawRhombusPath(outputCtx,centerX,centerY,scaledRhombWidth,scaledRhombHeight);outputCtx.clip();outputCtx.drawImage(preTileCanvas,centerX-drawSourceWidth/2,centerY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);outputCtx.restore();}} }
          else if (selectedShape === 'basketweave') { const plankWidth=outputCanvas.width/numTilesX;const plankHeight=outputCanvas.height/numTilesY;const numCols=numTilesX+2;const numRows=numTilesY+2;for(let r=-1;r<numRows;r++){for(let c=-1;c<numCols;c++){const x=c*plankWidth;const y=r*plankHeight;const isHorizontal=((Math.floor(r/2)+Math.floor(c/2))%2===0);outputCtx.save();outputCtx.beginPath();outputCtx.rect(x,y,plankWidth,plankHeight);outputCtx.clip();if(!isHorizontal){outputCtx.translate(x+plankWidth/2,y+plankHeight/2);outputCtx.rotate(Math.PI/2);outputCtx.translate(-(x+plankWidth/2),-(y+plankHeight/2));outputCtx.drawImage(preTileCanvas,x+plankWidth/2-drawSourceHeight/2,y+plankHeight/2-drawSourceWidth/2,drawSourceHeight,drawSourceWidth);}else{outputCtx.drawImage(preTileCanvas,x+plankWidth/2-drawSourceWidth/2,y+plankHeight/2-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);} outputCtx.restore();}} }
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
