const Tesseract = require('tesseract.js');

let ocrDisabled = false;

const extractText = async (fileBuffer, mimeType = 'image/jpeg') => {
  if (!fileBuffer || mimeType === 'application/pdf' || ocrDisabled) {
    return '';
  }

  try {
    const { data } = await Tesseract.recognize(fileBuffer, 'eng');
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
