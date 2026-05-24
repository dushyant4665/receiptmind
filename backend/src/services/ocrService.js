const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const os = require('os');

const extractText = async (imageBuffer) => {
  const tmpPath = path.join(os.tmpdir(), `receiptmind-ocr-${Date.now()}.png`);
  
  try {
    await writeFilePromise(tmpPath, imageBuffer);
    
    // Check if tesseract is installed
    try {
      await execPromise('tesseract --version');
    } catch (error) {
      console.warn('Tesseract not found, skipping OCR');
      return '';
    }

    const { stdout, stderr } = await execPromise(`tesseract "${tmpPath}" stdout -l eng --psm 6`);
    
    if (stderr && !stdout) {
      console.error('Tesseract stderr:', stderr);
    }

    const text = cleanOCRText(stdout);
    return text;
  } catch (error) {
    console.error('OCR Extraction failed:', error);
    return '';
  } finally {
    if (fs.existsSync(tmpPath)) {
      await unlinkPromise(tmpPath);
    }
  }
};

const cleanOCRText = (text) => {
  if (!text) return '';
  
  return text
    .replace(/\x00/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

module.exports = {
  extractText,
};
