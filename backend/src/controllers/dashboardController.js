const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const getStats = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT
        COUNT(*) as total_receipts,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as pending_count,
        COUNT(*) FILTER (WHERE status = 'needs_review' OR needs_review = true) as needs_review_count
       FROM receipts
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organizationId]
    );

    const row = rows[0] || {};
    const totalReceipts = parseInt(row.total_receipts, 10) || 0;
    const totalAmount = parseFloat(row.total_amount) || 0;
    const processedCount = parseInt(row.processed_count, 10) || 0;
    const pendingCount = parseInt(row.pending_count, 10) || 0;
    const needsReviewCount = parseInt(row.needs_review_count, 10) || 0;

    const timeSavedMinutes = processedCount * 5;
    const automationRate = totalReceipts > 0 ? Math.max(0, processedCount - needsReviewCount) / totalReceipts : 0;

    const stats = {
      total_receipts: totalReceipts,
      total_amount: totalAmount,
      processed_count: processedCount,
      pending_count: pendingCount,
      needs_review_count: needsReviewCount,
      time_saved_minutes: timeSavedMinutes,
      automation_rate: automationRate,
    };

    return res.status(200).json(successResponse(stats));
  } catch (error) {
    console.error('Dashboard stats error:', error.message);
    return res.status(500).json(errorResponse('Failed to retrieve dashboard stats'));
  }
};

module.exports = {
  getStats,
};
