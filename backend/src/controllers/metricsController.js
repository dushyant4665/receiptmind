const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const getProcessingTimes = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT EXTRACT(EPOCH FROM (processing_finished_at - processing_started_at)) as duration
       FROM receipts
       WHERE organization_id = $1 AND status = 'processed'
         AND processing_started_at IS NOT NULL AND processing_finished_at IS NOT NULL
       ORDER BY processing_finished_at DESC
       LIMIT 30`,
      [organizationId]
    );

    const count = rows.length;
    if (count === 0) {
      return res.status(200).json(
        successResponse({
          average_seconds: 0,
          min_seconds: 0,
          max_seconds: 0,
          count: 0,
        })
      );
    }

    let totalDuration = 0;
    let minDuration = Infinity;
    let maxDuration = 0;

    for (const row of rows) {
      const d = parseFloat(row.duration) || 0;
      totalDuration += d;
      if (d < minDuration) minDuration = d;
      if (d > maxDuration) maxDuration = d;
    }

    return res.status(200).json(
      successResponse({
        average_seconds: Math.round((totalDuration / count) * 10) / 10,
        min_seconds: Math.round(minDuration * 10) / 10,
        max_seconds: Math.round(maxDuration * 10) / 10,
        count,
      })
    );
  } catch (error) {
    console.error('Metrics processing times error:', error.message);
    return res.status(500).json(errorResponse('Failed to calculate metrics'));
  }
};

const getSummary = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows: receiptRows } = await db.query(
      `SELECT status, COUNT(*) as count FROM receipts WHERE organization_id = $1 GROUP BY status`,
      [organizationId]
    );

    const { rows: exRows } = await db.query(
      `SELECT status, COUNT(*) as count FROM exceptions WHERE organization_id = $1 GROUP BY status`,
      [organizationId]
    );

    const summary = {
      receipts: receiptRows.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.count, 10) }), {}),
      exceptions: exRows.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.count, 10) }), {}),
    };

    return res.status(200).json(successResponse(summary));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to calculate summary'));
  }
};

module.exports = {
  getProcessingTimes,
  getSummary,
};
