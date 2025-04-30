// js/tiling/core.js
 import {
     drawHexagonPath, drawOctagonPath, drawSquarePath,
     drawLTrominoPath, drawTrianglePath, drawRhombusPath
 } from '../utils/drawingUtils.js';
 
 /**
  * Core function to process the image: mirror, pre-tile, and apply selected tiling.
  * @param {HTMLCanvasElement} sourceCanvasForMirroring - The canvas containing the source image (potentially after pre-effects).
  * @param {object} elements - UI elements including canvases, previews, sliders.
  * @param {object} state - Application state including original dimensions etc.
  * @param {Function} showMessageFunc - Function to display messages.
  */
 export function processAndPreviewImage(sourceCanvasForMirroring, elements, state, showMessageFunc) {
     // --- Get necessary elements and state ---
     const {
         mirrorCanvas, preTileCanvas, canvas, finalPreview, finalPreviewText,
         scaleSlider, preTileXSlider, preTileYSlider, tilesXSlider, tilesYSlider,
         skewSlider, staggerSlider
     } = elements;
     // No longer need currentImage, sourceZoomLevel, currentOffsetX, currentOffsetY directly here
     // as the sourceCanvasForMirroring already reflects the selected source region + effects.
 
     if (!sourceCanvasForMirroring || state.isProcessing) return;
     state.isProcessing = true;
 
     // --- Get Contexts ---
     const mirrorCtx = mirrorCanvas?.getContext('2d');
     const preTileCtx = preTileCanvas?.getContext('2d');
     const ctx = canvas?.getContext('2d'); // Final output canvas context
 
     if (!mirrorCtx || !preTileCtx || !ctx) {
         console.error("Canvas context missing!");
         showMessageFunc("Error: Canvas context not available.", true);
         state.isProcessing = false;
         return;
     }
 
     // --- Read Controls (Tiling Parameters) ---
     const scaleFactor = parseFloat(scaleSlider?.value || 1.0);
     const preTileGridX = parseInt(preTileXSlider?.value || 3, 10);
     const preTileGridY = parseInt(preTileYSlider?.value || 3, 10);
     const mirrorType = document.querySelector('input[name="mirrorOption"]:checked')?.value || 'none';
     const selectedShape = document.querySelector('input[name="tileShape"]:checked')?.value || 'grid';
     const numTilesX = parseInt(tilesXSlider?.value || 3, 10);
     const numTilesY = parseInt(tilesYSlider?.value || 3, 10);
     const skewMagnitude = parseFloat(skewSlider?.value || 0.5);
     const staggerFactor = parseFloat(staggerSlider?.value || 0.5);
 
 
     // --- Step 0: Create Mirrored Image ---
     // Input is now sourceCanvasForMirroring which has the correct size (originalWidth x originalHeight)
     // and content (zoomed/panned region + pre-effect applied)
     if (!state.originalWidth || !state.originalHeight) {
          console.error("Original image dimensions not set in state.");
          showMessageFunc("Error: Image dimensions missing.", true);
          state.isProcessing = false;
          return;
      }
     mirrorCanvas.width = state.originalWidth;
     mirrorCanvas.height = state.originalHeight;
     mirrorCtx.clearRect(0, 0, mirrorCanvas.width, mirrorCanvas.height);
     mirrorCtx.save();
 
     // Mirroring transform
     let scaleMx = 1, scaleMy = 1, transMx = 0, transMy = 0;
     if (mirrorType === 'horizontal' || mirrorType === 'both') { scaleMx = -1; transMx = mirrorCanvas.width; }
     if (mirrorType === 'vertical' || mirrorType === 'both') { scaleMy = -1; transMy = mirrorCanvas.height; }
     if (transMx !== 0 || transMy !== 0) mirrorCtx.translate(transMx, transMy);
     if (scaleMx !== 1 || scaleMy !== 1) mirrorCtx.scale(scaleMx, scaleMy);
 
     try {
         // Draw the sourceCanvasForMirroring directly (it's already the correct region/effect)
         mirrorCtx.drawImage(
             sourceCanvasForMirroring,
             0, 0, mirrorCanvas.width, mirrorCanvas.height
         );
     } catch (e) {
          console.error("Error drawing mirrored image:", e);
          showMessageFunc("Error applying mirroring.", true);
          mirrorCtx.restore();
          state.isProcessing = false;
          return;
     }
     mirrorCtx.restore();
 
 
     // --- Step 1: Create Pre-Tiled Image ---
     // (No changes needed here, still uses mirrorCanvas as input)
     preTileCanvas.width = state.originalWidth;
     preTileCanvas.height = state.originalHeight;
     preTileCtx.clearRect(0, 0, preTileCanvas.width, preTileCanvas.height);
     const safePreTileGridX = Math.max(1, preTileGridX);
     const safePreTileGridY = Math.max(1, preTileGridY);
     const preTileW = preTileCanvas.width / safePreTileGridX;
     const preTileH = preTileCanvas.height / safePreTileGridY;
     for (let py = 0; py < safePreTileGridY; py++) {
         for (let px = 0; px < safePreTileGridX; px++) {
              try { preTileCtx.drawImage(mirrorCanvas, px * preTileW, py * preTileH, preTileW, preTileH); }
              catch (e) { console.error("Error drawing pre-tile section:", e); showMessageFunc("Error creating pre-tile pattern.", true); state.isProcessing = false; return; }
         }
     }
 
     // --- Step 2: Draw Final Tiled Image onto 'canvas' ---
     // (No changes needed in the tiling algorithm logic itself)
     canvas.width = state.originalWidth;
     canvas.height = state.originalHeight;
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     const drawSourceWidth = preTileCanvas.width;
     const drawSourceHeight = preTileCanvas.height;
 
     try {
         // --- Shape-Specific Drawing Logic (using preTileCanvas as source) ---
          if (selectedShape === 'grid') {
             // ... Grid logic ...
             const tileWidth=canvas.width/numTilesX;const tileHeight=canvas.height/numTilesY;const scaledTileWidth=tileWidth*scaleFactor;const scaledTileHeight=tileHeight*scaleFactor;for(let y=0;y<numTilesY;y++){for(let x=0;x<numTilesX;x++){const tileX=x*tileWidth;const tileY=y*tileHeight;const offsetX=(tileWidth-scaledTileWidth)/2;const offsetY=(tileHeight-scaledTileHeight)/2;ctx.drawImage(preTileCanvas,tileX+offsetX,tileY+offsetY,scaledTileWidth,scaledTileHeight);}}
          }
          else if (selectedShape === 'brick_wall') {
             // ... Brick Wall Logic ...
             const tileWidth=canvas.width/numTilesX;const tileHeight=canvas.height/numTilesY;const scaledTileWidth=tileWidth*scaleFactor;const scaledTileHeight=tileHeight*scaleFactor;const startY=-1;const endY=numTilesY+1;const startX=-2;const endX=numTilesX+2;for(let y=startY;y<endY;y++){let xOffset=(y%2!==0)?tileWidth/2:0;for(let x=startX;x<endX;x++){const tileX=(x*tileWidth)-xOffset;const tileY=y*tileHeight;const drawOffsetX=(tileWidth-scaledTileWidth)/2;const drawOffsetY=(tileHeight-scaledTileHeight)/2;ctx.drawImage(preTileCanvas,tileX+drawOffsetX,tileY+drawOffsetY,scaledTileWidth,scaledTileHeight);}}
          }
          else if (selectedShape === 'herringbone') {
              // ... Herringbone Logic ...
              const plankWidth=canvas.width/numTilesX;const plankHeight=canvas.height/numTilesY;const scaledPlankWidth=plankWidth*scaleFactor;const scaledPlankHeight=plankHeight*scaleFactor;const step=Math.min(scaledPlankWidth,scaledPlankHeight)/Math.sqrt(2);const numCols=Math.ceil(canvas.width/step)+4;const numRows=Math.ceil(canvas.height/step)+4;for(let r=-2;r<numRows;r++){for(let c=-2;c<numCols;c++){ctx.save();const centerX=c*step+step/2;const centerY=r*step+step/2;const angle=((r+c)%2===0)?Math.PI/4:-Math.PI/4;ctx.translate(centerX,centerY);ctx.rotate(angle);const drawX=-scaledPlankWidth/2;const drawY=-scaledPlankHeight/2;ctx.beginPath();ctx.rect(drawX,drawY,scaledPlankWidth,scaledPlankHeight);ctx.clip();ctx.rotate(-angle);ctx.translate(-centerX,-centerY);ctx.drawImage(preTileCanvas,centerX-drawSourceWidth/2,centerY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}
          }
          else if (selectedShape === 'skewed') {
             // ... Skewed logic ...
             const finalTileWidth=canvas.width/numTilesX;const finalTileHeight=canvas.height/numTilesY;const startY=-2;const endY=numTilesY+2;const startX=-3;const endX=Math.ceil(canvas.width/finalTileWidth)+3;for(let y=startY;y<endY;y++){let xOffset=(y%2!==0)?(finalTileWidth*staggerFactor):0;for(let x=startX;x<endX;x++){const destX=(x*finalTileWidth)-xOffset;const destY=y*finalTileHeight;const currentSkew=(Math.abs(x%2)===0)?skewMagnitude:-skewMagnitude;ctx.save();ctx.translate(destX,destY);ctx.transform(1,0,currentSkew,1,0,0);const scaledWidth=finalTileWidth*scaleFactor;const scaledHeight=finalTileHeight*scaleFactor;const drawOffsetX=(finalTileWidth-scaledWidth)/2;const drawOffsetY=(finalTileHeight-scaledHeight)/2;ctx.drawImage(preTileCanvas,drawOffsetX,drawOffsetY,scaledWidth,scaledHeight);ctx.restore();}}
          }
          else if (selectedShape === 'hexagon') {
             // ... Hexagon logic ...
             const hexRadiusW=canvas.width/(numTilesX*1.5+0.5);const hexRadiusH=canvas.height/(numTilesY*Math.sqrt(3)+0.5*Math.sqrt(3));const hexRadius=Math.min(hexRadiusW,hexRadiusH);const scaledHexRadius=hexRadius*scaleFactor;const hexWidth=Math.sqrt(3)*hexRadius;const hexHeight=2*hexRadius;const vertDist=hexHeight*3/4;const numCols=Math.ceil(canvas.width/hexWidth)+2;const numRows=Math.ceil(canvas.height/vertDist)+2;for(let row=-1;row<numRows;row++){for(let col=-1;col<numCols;col++){const cx=col*hexWidth+((row%2)!==0?hexWidth/2:0);const cy=row*vertDist;ctx.save();drawHexagonPath(ctx,cx,cy,scaledHexRadius);ctx.clip();ctx.drawImage(preTileCanvas,cx-drawSourceWidth/2,cy-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}
          }
          else if (selectedShape === 'semi_octagon_square') {
             // ... Octagon/Square logic ...
             const sW=canvas.width/(numTilesX*(1+Math.sqrt(2)/2));const sH=canvas.height/(numTilesY*(1+Math.sqrt(2)/2));const sideLength=Math.min(sW,sH);const octRadius=sideLength/(2*Math.sin(Math.PI/8));const squareSide=sideLength;const scaledOctRadius=octRadius*scaleFactor;const scaledSquareSide=squareSide*scaleFactor;const distBetweenCenters=scaledOctRadius*Math.cos(Math.PI/8)+scaledSquareSide/2;const numUnitsX=Math.ceil(canvas.width/distBetweenCenters)+4;const numUnitsY=Math.ceil(canvas.height/distBetweenCenters)+4;for(let r=-2;r<numUnitsY;r++){for(let c=-2;c<numUnitsX;c++){const centerX=c*distBetweenCenters;const centerY=r*distBetweenCenters;const isOctagon=(Math.abs(r%2)===Math.abs(c%2));ctx.save();if(isOctagon){drawOctagonPath(ctx,centerX,centerY,scaledOctRadius);}else{drawSquarePath(ctx,centerX,centerY,scaledSquareSide);} ctx.clip();ctx.drawImage(preTileCanvas,centerX-drawSourceWidth/2,centerY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}
          }
          else if (selectedShape === 'l_shape_square') {
             // ... L-Shape/Square logic ...
             const unitSizeX=canvas.width/(numTilesX*2);const unitSizeY=canvas.height/(numTilesY*2);const unitSize=Math.min(unitSizeX,unitSizeY);const scaledUnitSize=unitSize*scaleFactor;const scaledSquareSide=scaledUnitSize;const cellWidth=2*unitSize;const cellHeight=2*unitSize;const numCols=Math.ceil(canvas.width/cellWidth)+2;const numRows=Math.ceil(canvas.height/cellHeight)+2;for(let r=-1;r<numRows;r++){for(let c=-1;c<numCols;c++){const cellX=c*cellWidth;const cellY=r*cellHeight;const drawCenterX=cellX+unitSize;const drawCenterY=cellY+unitSize;ctx.save();ctx.translate(cellX,cellY+2*scaledUnitSize);ctx.rotate(-Math.PI/2);drawLTrominoPath(ctx,0,0,scaledUnitSize);ctx.clip();ctx.rotate(Math.PI/2);ctx.translate(-cellX,-(cellY+2*scaledUnitSize));ctx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();ctx.save();ctx.translate(cellX+scaledUnitSize,cellY);drawLTrominoPath(ctx,0,0,scaledUnitSize);ctx.clip();ctx.translate(-(cellX+scaledUnitSize),-cellY);ctx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();ctx.save();ctx.translate(cellX+scaledUnitSize,cellY+2*scaledUnitSize);ctx.rotate(Math.PI);drawLTrominoPath(ctx,0,0,scaledUnitSize);ctx.clip();ctx.rotate(-Math.PI);ctx.translate(-(cellX+scaledUnitSize),-(cellY+2*scaledUnitSize));ctx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();ctx.save();ctx.translate(cellX+2*scaledUnitSize,cellY+scaledUnitSize);ctx.rotate(Math.PI/2);drawLTrominoPath(ctx,0,0,scaledUnitSize);ctx.clip();ctx.rotate(-Math.PI/2);ctx.translate(-(cellX+2*scaledUnitSize),-(cellY+scaledUnitSize));ctx.drawImage(preTileCanvas,drawCenterX-drawSourceWidth/2,drawCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();ctx.save();const sqCenterX=cellX+unitSize;const sqCenterY=cellY+unitSize;drawSquarePath(ctx,sqCenterX,sqCenterY,scaledSquareSide);ctx.clip();ctx.drawImage(preTileCanvas,sqCenterX-drawSourceWidth/2,sqCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}
          }
          else if (selectedShape === 'hexagon_triangle') {
              // ... Hexagon/Triangle logic (potentially needs refinement) ...
             const hexRadiusW=canvas.width/(numTilesX*1.5+0.5);const hexRadiusH=canvas.height/(numTilesY*Math.sqrt(3)+0.5*Math.sqrt(3));const hexRadius=Math.min(hexRadiusW,hexRadiusH);const sideLength=hexRadius;const scaledHexRadius=hexRadius*scaleFactor;const scaledSideLength=sideLength*scaleFactor;const hexWidth=Math.sqrt(3)*hexRadius;const hexHeight=2*hexRadius;const vertDist=hexHeight*3/4;const numCols=Math.ceil(canvas.width/hexWidth)+2;const numRows=Math.ceil(canvas.height/vertDist)+2;const triVertDist=scaledHexRadius*Math.sqrt(3)/2+scaledSideLength*Math.sqrt(3)/6;for(let row=-1;row<numRows;row++){for(let col=-1;col<numCols;col++){const cx=col*hexWidth+((row%2)!==0?hexWidth/2:0);const cy=row*vertDist;ctx.save();drawHexagonPath(ctx,cx,cy,scaledHexRadius);ctx.clip();ctx.drawImage(preTileCanvas,cx-drawSourceWidth/2,cy-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();for(let i=0;i<6;i++){const angle=Math.PI/3*i;const triCenterX=cx+triVertDist*Math.cos(angle);const triCenterY=cy+triVertDist*Math.sin(angle);const pointUp=(i%2===0);ctx.save();drawTrianglePath(ctx,triCenterX,triCenterY,scaledSideLength,pointUp);ctx.clip();ctx.drawImage(preTileCanvas,triCenterX-drawSourceWidth/2,triCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}}
          }
          else if (selectedShape === 'square_triangle') {
              // ... Square/Triangle logic (potentially needs refinement) ...
             const triHeightRel=Math.sqrt(3)/2;const avgRowHeight=(1+triHeightRel)/2;const sideLengthX=canvas.width/numTilesX;const sideLengthY=canvas.height/(numTilesY*avgRowHeight);const sideLength=Math.min(sideLengthX,sideLengthY);const squareSide=sideLength;const triangleSide=sideLength;const scaledSquareSide=squareSide*scaleFactor;const scaledTriangleSide=triangleSide*scaleFactor;const actualTriHeight=scaledTriangleSide*Math.sqrt(3)/2;const actualSquareHeight=scaledSquareSide;const numCols=Math.ceil(canvas.width/sideLength)+4;let currentY=-Math.max(actualSquareHeight,actualTriHeight)*1.5;let rowCount=0;while(currentY<canvas.height+Math.max(actualSquareHeight,actualTriHeight)*2){const isSquareRow=(rowCount%2===0);const currentRowHeight=isSquareRow?actualSquareHeight:actualTriHeight;for(let c=-2;c<numCols;c++){const cellBaseX=c*sideLength+(rowCount%2!==0?sideLength/2:0);if(isSquareRow){const sqCenterX=cellBaseX+sideLength/2;const sqCenterY=currentY+actualSquareHeight/2;ctx.save();drawSquarePath(ctx,sqCenterX,sqCenterY,scaledSquareSide);ctx.clip();ctx.drawImage(preTileCanvas,sqCenterX-drawSourceWidth/2,sqCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}else{const triCenterY=currentY+actualTriHeight/2;const tri1CenterX=cellBaseX+sideLength/2;ctx.save();drawTrianglePath(ctx,tri1CenterX,triCenterY,scaledTriangleSide,(c%2===0));ctx.clip();ctx.drawImage(preTileCanvas,tri1CenterX-drawSourceWidth/2,triCenterY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}currentY+=currentRowHeight;rowCount++;}
          }
          else if (selectedShape === 'rhombus') {
              // ... Rhombus logic ...
             const rhombWidth=canvas.width/numTilesX;const rhombHeight=canvas.height/numTilesY;const scaledRhombWidth=rhombWidth*scaleFactor;const scaledRhombHeight=rhombHeight*scaleFactor;const startY=-1;const endY=numTilesY+2;const startX=-2;const endX=numTilesX+2;for(let y=startY;y<endY;y++){let xOffset=(y%2!==0)?rhombWidth/2:0;for(let x=startX;x<endX;x++){const centerX=x*rhombWidth+xOffset;const centerY=y*rhombHeight+rhombHeight/2;ctx.save();drawRhombusPath(ctx,centerX,centerY,scaledRhombWidth,scaledRhombHeight);ctx.clip();ctx.drawImage(preTileCanvas,centerX-drawSourceWidth/2,centerY-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);ctx.restore();}}
          }
          else if (selectedShape === 'basketweave') {
              // ... Basketweave logic ...
              const plankWidth=canvas.width/numTilesX;const plankHeight=canvas.height/numTilesY;const numCols=numTilesX+2;const numRows=numTilesY+2;for(let r=-1;r<numRows;r++){for(let c=-1;c<numCols;c++){const x=c*plankWidth;const y=r*plankHeight;const isHorizontal=((Math.floor(r/2)+Math.floor(c/2))%2===0);ctx.save();ctx.beginPath();ctx.rect(x,y,plankWidth,plankHeight);ctx.clip();if(!isHorizontal){ctx.translate(x+plankWidth/2,y+plankHeight/2);ctx.rotate(Math.PI/2);ctx.translate(-(x+plankWidth/2),-(y+plankHeight/2));ctx.drawImage(preTileCanvas,x+plankWidth/2-drawSourceHeight/2,y+plankHeight/2-drawSourceWidth/2,drawSourceHeight,drawSourceWidth);}else{ctx.drawImage(preTileCanvas,x+plankWidth/2-drawSourceWidth/2,y+plankHeight/2-drawSourceHeight/2,drawSourceWidth,drawSourceHeight);} ctx.restore();}}
          }
          // --- End Shape Logic ---
     } catch (e) {
          console.error(`Error applying tiling shape "${selectedShape}":`, e);
          showMessageFunc(`Error during ${selectedShape} tiling.`, true);
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear on error
          state.isProcessing = false;
          return; // Stop processing
      }
 
 
     // --- Step 3: Update Final Result Preview ---
     try {
         // Use the main 'canvas' as the source for the final preview
         const dataURL = canvas.toDataURL('image/png');
         if (finalPreview) {
             finalPreview.src = dataURL;
             finalPreview.classList.remove('hidden');
         }
         if (finalPreviewText) finalPreviewText.classList.add('hidden');
     } catch (error) {
         console.error("Error generating final preview:", error);
         showMessageFunc("Could not generate final preview.", true);
         if (finalPreview) finalPreview.classList.add('hidden');
         if (finalPreviewText) { finalPreviewText.classList.remove('hidden'); finalPreviewText.textContent = "Preview Error"; }
     }
 
     state.isProcessing = false; // Mark processing as complete
 }
