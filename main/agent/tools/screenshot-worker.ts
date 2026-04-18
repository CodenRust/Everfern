import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
const screenshot = require('screenshot-desktop');
let sharp: any = null;
try { sharp = require('sharp'); } catch {}

/**
 * Worker to perform screenshot capture and image processing (resize/encode)
 * off the main thread to prevent UI freezing.
 */
async function run() {
  const { outPath, monitorIndex, imageQuality, imageMaxPixels, imageMinPixels, imageScaleFactor } = workerData;

  try {
    // 1. Capture
    const displays = await screenshot.listDisplays();
    const display = displays[monitorIndex - 1] || displays[0];
    await screenshot({ filename: outPath, screen: display.id });

    // 2. Read
    const imgBuffer = fs.readFileSync(outPath);
    
    // Get dimensions
    let width = 1920, height = 1080;
    if (imgBuffer.length > 24 && imgBuffer.toString("ascii", 1, 4) === "PNG") {
       width = imgBuffer.readUInt32BE(16);
       height = imgBuffer.readUInt32BE(20);
    }

    // 3. Resize & Encode
    const area = width * height;
    const clampedArea = Math.min(Math.max(area, imageMinPixels), imageMaxPixels);
    const scale = Math.sqrt(clampedArea / area);
    
    const roundSize = (v: number): number =>
      Math.max(imageScaleFactor, Math.floor(Math.max(1, v) / imageScaleFactor) * imageScaleFactor);

    let newW = roundSize(width * scale);
    let newH = roundSize(height * scale);

    let encoded = "";
    if (sharp) {
      const jpegBuffer = await sharp(imgBuffer)
        .resize(newW, newH, { fit: 'fill' })
        .jpeg({ quality: imageQuality })
        .toBuffer();
      encoded = jpegBuffer.toString("base64");
    } else {
      encoded = imgBuffer.toString("base64");
      newW = width;
      newH = height;
    }

    parentPort?.postMessage({
      success: true,
      data: {
        encoded,
        width,
        height,
        newW,
        newH
      }
    });
  } catch (err) {
    parentPort?.postMessage({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

run();
