const validateExtraction = (data) => {

  let confidence =
    Number(data.confidence) || 0.85;

  /*
    =================================
    REQUIRED FIELD CHECKS
    =================================
  */

  if (!data.vendor_name) {
    confidence -= 0.10;
  }

  if (!data.amount || data.amount <= 0) {
    confidence -= 0.15;
  }

  if (!data.receipt_date) {
    confidence -= 0.10;
  }

  /*
    =================================
    TOTAL VALIDATION
    subtotal + tax ~= amount
    =================================
  */

  if (
    data.subtotal > 0 &&
    data.tax_amount >= 0 &&
    data.amount > 0
  ) {

    const expected =
      data.subtotal + data.tax_amount;

    const difference =
      Math.abs(
        expected - data.amount
      );

    /*
      ONLY penalize if
      huge mismatch
    */

    if (difference > 20) {
      confidence -= 0.08;
    }
  }

  /*
    =================================
    BAD AMOUNT DETECTION
    =================================
  */

  if (
    data.amount > 10000000
  ) {
    confidence -= 0.10;
  }

  /*
    =================================
    FALLBACKS
    =================================
  */

  if (!data.category) {
    data.category = 'General';
  }

  if (!data.currency) {
    data.currency = 'INR';
  }

  /*
    =================================
    FINAL CLAMP
    =================================
  */

  confidence =
    Math.max(
      0,
      Math.min(1, confidence)
    );

  /*
    =================================
    REVIEW THRESHOLD
    =================================
  */

  const needsReview =
    confidence < 0.55;

  return {

    ...data,

    confidence,

    needs_review:
      needsReview,
  };
};

module.exports = {
  validateExtraction,
};