const sharp = require('sharp');

let ocrDisabled = false;

// Preprocesses image for better OCR quality
const preprocessImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .rotate()
      .grayscale()
      .normalize()
      .sharpen()
      .resize({ width: 1800, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return buffer;
  }
};

// Extracts text using Tesseract with error resilience
const extractText = async (fileBuffer, mimeType = 'image/jpeg') => {
  if (!fileBuffer || mimeType === 'application/pdf' || ocrDisabled) {
    return '';
  }

  try {
    const Tesseract = require('tesseract.js');
    const processedBuffer = await preprocessImage(fileBuffer);
    const { data } = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: () => {},
    });
    return (data?.text || '').trim();
  } catch (error) {
    console.warn('OCR fallback used (Tesseract not available or failed):', error.message);
    ocrDisabled = true;
    return '';
  }
};

module.exports = {
  extractText,
};
