const crypto = require('crypto');
const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const listRules = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT * FROM rules WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return res.status(200).json(successResponse(rows));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to list rules'));
  }
};

const createRule = async (req, res) => {
  const { organizationId } = req.user;
  const { condition_type, condition_value, action_type, action_value } = req.body;

  if (!condition_type || !condition_value || !action_type || !action_value) {
    return res.status(400).json(errorResponse('All fields required: condition_type, condition_value, action_type, action_value'));
  }

  try {
    const id = crypto.randomUUID();
    const { rows } = await db.query(
      `INSERT INTO rules (id, organization_id, condition_type, condition_value, action_type, action_value, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING *`,
      [id, organizationId, condition_type, condition_value, action_type, action_value]
    );

    return res.status(201).json(successResponse(rows[0]));
  } catch (error) {
    console.error('Create rule error:', error.message);
    return res.status(500).json(errorResponse('Failed to create rule'));
  }
};

module.exports = {
  listRules,
  createRule,
};
