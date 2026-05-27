const Tesseract = require('tesseract.js');
const sharp = require('sharp');

let ocrDisabled = false;

const preprocessImage = async (fileBuffer) => {
  try {
    return await sharp(fileBuffer)
      .rotate()
      .grayscale()
      .normalize()
      .sharpen()
      .resize({ width: 1800, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (error) {
    console.warn('OCR image preprocessing failed, using original buffer:', error.message || error);
    return fileBuffer;
  }
};

const extractText = async (fileBuffer, mimeType = 'image/jpeg') => {
  if (!fileBuffer || mimeType === 'application/pdf' || ocrDisabled) {
    return '';
  }

  try {
    const processedBuffer = await preprocessImage(fileBuffer);
    const { data } = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: () => {},
    });
    return (data?.text || '').trim();
  } catch (error) {
    console.error('Tesseract OCR fallback failed:', error.message || error);
    ocrDisabled = true;
    return '';
  }
};

module.exports = {
  extractText,
};
