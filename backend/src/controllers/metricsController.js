const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const getProcessingTimes = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const query = `
      SELECT 
        EXTRACT(EPOCH FROM (processing_finished_at - processing_started_at)) as duration
      FROM receipts 
      WHERE organization_id = $1 
        AND status = 'processed' 
        AND processing_started_at IS NOT NULL 
        AND processing_finished_at IS NOT NULL
      ORDER BY processing_finished_at DESC
      LIMIT 30
    `;

    const { rows } = await db.query(query, [organizationId]);

    let totalDuration = 0;
    let minDuration = -1;
    let maxDuration = 0;
    const count = rows.length;

    for (const row of rows) {
      const duration = parseFloat(row.duration);
      totalDuration += duration;
      if (minDuration === -1 || duration < minDuration) {
        minDuration = duration;
      }
      if (duration > maxDuration) {
        maxDuration = duration;
      }
    }

    if (count === 0) {
      return res.json(successResponse({
        average_seconds: 0,
        min_seconds: 0,
        max_seconds: 0,
        count: 0,
      }));
    }

    const avg = totalDuration / count;

    res.json(successResponse({
      average_seconds: avg,
      min_seconds: minDuration,
      max_seconds: maxDuration,
      count: count,
    }));
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const getSummary = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows: statusRows } = await db.query(
      `SELECT status, COUNT(*) as count FROM receipts WHERE organization_id = $1 GROUP BY status`,
      [organizationId]
    );

    const { rows: exceptionRows } = await db.query(
      `SELECT status, COUNT(*) as count FROM exceptions WHERE organization_id = $1 GROUP BY status`,
      [organizationId]
    );

    const summary = {
      receipts: statusRows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      exceptions: exceptionRows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
    };

    res.json(successResponse(summary));
  } catch (error) {
    console.error('Get metrics summary error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  getProcessingTimes,
  getSummary,
};
