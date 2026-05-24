const db = require('../config/db');
const crypto = require('crypto');
const { successResponse, errorResponse } = require('../utils/response');

const createRule = async (req, res) => {
  const { organizationId } = req.user;
  const { condition_type, condition_value, action_type, action_value } = req.body;

  if (!condition_type || !condition_value || !action_type || !action_value) {
    return res.status(400).json(errorResponse('All fields are required: condition_type, condition_value, action_type, action_value'));
  }

  const validConditionTypes = ['vendor', 'category', 'amount_range'];
  if (!validConditionTypes.includes(condition_type)) {
    return res.status(400).json(errorResponse('Invalid condition_type. allowed: vendor, category, amount_range'));
  }

  const validActionTypes = ['set_category', 'ignore', 'recurring'];
  if (!validActionTypes.includes(action_type)) {
    return res.status(400).json(errorResponse('Invalid action_type. allowed: set_category, ignore, recurring'));
  }

  try {
    const id = crypto.randomUUID();
    const { rows } = await db.query(
      `INSERT INTO rules (id, organization_id, condition_type, condition_value, action_type, action_value, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [id, organizationId, condition_type, condition_value, action_type, action_value, true]
    );

    res.status(201).json(successResponse(rows[0]));
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const listRules = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      'SELECT * FROM rules WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );

    res.json(successResponse(rows));
  } catch (error) {
    console.error('List rules error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  createRule,
  listRules,
};
