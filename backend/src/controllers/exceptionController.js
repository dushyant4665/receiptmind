const db = require('../config/db');
const exceptionService = require('../services/exceptionService');
const ruleService = require('../services/ruleService');
const { successResponse, errorResponse } = require('../utils/response');

const listExceptions = async (req, res) => {
  const { organizationId } = req.user;
  const { status } = req.query;

  try {
    const exceptions = await exceptionService.getByOrganization(organizationId, status);
    res.json(successResponse(exceptions));
  } catch (error) {
    console.error('List exceptions error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const resolveException = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;
  const { vendor_name, amount, receipt_date, category } = req.body;

  try {
    const { rows } = await db.query(
      'SELECT id, receipt_id, status FROM exceptions WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    const ex = rows[0];
    if (!ex) {
      return res.status(404).json(errorResponse('Exception not found'));
    }

    if (ex.status === 'resolved') {
      return res.status(400).json(errorResponse('Exception already resolved'));
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (vendor_name !== undefined) {
      updates.push(`vendor_name = $${paramIdx++}`);
      params.push(vendor_name);
    }
    if (amount !== undefined) {
      updates.push(`amount = $${paramIdx++}`);
      params.push(amount);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIdx++}`);
      params.push(category);
    }
    if (receipt_date !== undefined) {
      updates.push(`receipt_date = $${paramIdx++}`);
      params.push(receipt_date);
    }

    if (updates.length > 0) {
      params.push(ex.receipt_id);
      const query = `UPDATE receipts SET ${updates.join(', ')} WHERE id = $${paramIdx}`;
      await db.query(query, params);

      if (vendor_name !== undefined && category !== undefined) {
        await ruleService.autoLearnFromEdit(organizationId, vendor_name, category);
      }
    }

    await exceptionService.resolve(id, organizationId);

    res.json(successResponse({ id, status: 'resolved' }));
  } catch (error) {
    console.error('Resolve exception error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  listExceptions,
  resolveException,
};
