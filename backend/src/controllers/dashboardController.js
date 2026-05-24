const db = require('../config/db');
const { client: redis } = require('../config/redis');
const { successResponse, errorResponse } = require('../utils/response');

const getStats = async (req, res) => {
  const { organizationId } = req.user;
  const cacheKey = `dashboard:${organizationId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(successResponse(JSON.parse(cached)));
    }

    const { rows: totalRows } = await db.query(
      'SELECT COUNT(*) FROM receipts WHERE organization_id = $1',
      [organizationId]
    );
    const totalReceipts = parseInt(totalRows[0].count);

    const { rows: amountRows } = await db.query(
      "SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE organization_id = $1 AND status = 'processed'",
      [organizationId]
    );
    const totalAmount = parseFloat(amountRows[0].sum);

    const { rows: processedRows } = await db.query(
      "SELECT COUNT(*) FROM receipts WHERE organization_id = $1 AND status = 'processed'",
      [organizationId]
    );
    const processedCount = parseInt(processedRows[0].count);

    const { rows: pendingRows } = await db.query(
      "SELECT COUNT(*) FROM receipts WHERE organization_id = $1 AND status IN ('pending', 'processing')",
      [organizationId]
    );
    const pendingCount = parseInt(pendingRows[0].count);

    const { rows: exceptionRows } = await db.query(
      "SELECT COUNT(*) FROM exceptions WHERE organization_id = $1 AND status = 'open'",
      [organizationId]
    );
    const needsReviewCount = parseInt(exceptionRows[0].count);

    const timeSavedMinutes = processedCount * 5;
    let automationRate = 0;
    if (totalReceipts > 0) {
      const autoDone = processedCount - needsReviewCount;
      automationRate = Math.max(0, autoDone) / totalReceipts;
    }

    const stats = {
      total_receipts: totalReceipts,
      total_amount: totalAmount,
      processed_count: processedCount,
      pending_count: pendingCount,
      needs_review_count: needsReviewCount,
      time_saved_minutes: timeSavedMinutes,
      automation_rate: automationRate,
    };

    await redis.setEx(cacheKey, 30, JSON.stringify(stats));

    res.json(successResponse(stats));
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  getStats,
};
