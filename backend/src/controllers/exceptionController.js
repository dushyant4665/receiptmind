const db = require('../config/db');
const exceptionService = require('../services/exceptionService');
const ruleService = require('../services/ruleService');
const { successResponse, errorResponse } = require('../utils/response');

const listExceptions = async (req, res) => {
  const { organizationId } = req.user;
  const { status } = req.query;

  try {
    const exceptions = await exceptionService.getByOrganization(organizationId, status);
    return res.status(200).json(successResponse(exceptions));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to list exceptions'));
  }
};

const resolveException = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;
  const { vendor_name, amount, receipt_date, category } = req.body || {};

  try {
    const { rows } = await db.query(
      'SELECT id, receipt_id, status FROM exceptions WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('Exception not found'));
    }

    const ex = rows[0];

    // If corrections provided, apply them to receipt
    const updates = [];
    const params = [];
    let idx = 1;

    if (vendor_name !== undefined) {
      updates.push(`vendor_name = $${idx++}`);
      params.push(vendor_name);
    }
    if (amount !== undefined) {
      updates.push(`amount = $${idx++}`);
      params.push(amount);
    }
    if (category !== undefined) {
      updates.push(`category = $${idx++}`);
      params.push(category);
    }
    if (receipt_date !== undefined) {
      updates.push(`receipt_date = $${idx++}`);
      params.push(receipt_date);
    }

    if (updates.length > 0) {
      updates.push(`status = 'processed'`, `needs_review = false`, `updated_at = NOW()`);
      params.push(ex.receipt_id);
      await db.query(`UPDATE receipts SET ${updates.join(', ')} WHERE id = $${idx}`, params);

      if (vendor_name && category) {
        ruleService.autoLearnFromEdit(organizationId, vendor_name, category).catch(() => {});
      }
    }

    await exceptionService.resolve(id, organizationId);
    return res.status(200).json(successResponse({ id, status: 'resolved' }));
  } catch (error) {
    console.error('Resolve exception error:', error.message);
    return res.status(500).json(errorResponse('Failed to resolve exception'));
  }
};

module.exports = {
  listExceptions,
  resolveException,
};
