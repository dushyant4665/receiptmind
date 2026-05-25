const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const Tesseract = require('tesseract.js');
const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const os = require('os');

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
};

const extractText = async (fileBuffer, mimeType = 'image/png') => {
  const extension = MIME_EXTENSION_MAP[mimeType] || '.bin';
  const tmpPath = path.join(os.tmpdir(), `receiptmind-ocr-${Date.now()}${extension}`);
  
  try {
    await writeFilePromise(tmpPath, fileBuffer);
    
    if (mimeType === 'application/pdf') {
      return '';
    }

    try {
      await execPromise('tesseract --version');
      const { stdout, stderr } = await execPromise(`tesseract "${tmpPath}" stdout -l eng --psm 6`);
      
      if (stderr && !stdout) {
        console.error('Tesseract stderr:', stderr);
      }

      return cleanOCRText(stdout);
    } catch (error) {
      console.warn('Tesseract binary not found, falling back to tesseract.js OCR');
    }

    const result = await Tesseract.recognize(tmpPath, 'eng', {
      logger: () => {},
    });

    return cleanOCRText(result?.data?.text || '');
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
