// Validates extracted fields and calculates confidence score
const validateExtraction = (data) => {
  let confidence = Number(data.confidence) || 0.85;

  // Penalty for missing critical fields
  if (!data.vendor_name) confidence -= 0.15;
  if (!data.amount || data.amount <= 0) confidence -= 0.20;
  if (!data.receipt_date) confidence -= 0.10;

  // Total arithmetic check (subtotal + tax ~= amount)
  if (data.subtotal > 0 && data.tax_amount >= 0 && data.amount > 0) {
    const expected = data.subtotal + data.tax_amount;
    const diff = Math.abs(expected - data.amount);
    if (diff > 20) {
      confidence -= 0.10;
    }
  }

  // Fallbacks
  if (!data.category) data.category = 'General';
  if (!data.currency) data.currency = 'USD';

  // Clamp between 0 and 1
  confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));

  // Flag for manual review if confidence is low or mandatory fields missing
  const needsReview = confidence < 0.65 || !data.vendor_name || !data.amount;

  return {
    ...data,
    confidence,
    needs_review: needsReview,
  };
};

module.exports = {
  validateExtraction,
};