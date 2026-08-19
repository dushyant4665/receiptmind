const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const getMe = async (req, res) => {
  const { userId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.name, u.organization_id, u.created_at, o.name as company_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1 AND u.deleted_at IS NULL LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('User not found'));
    }

    return res.status(200).json(successResponse(rows[0]));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to retrieve user profile'));
  }
};

const updateMe = async (req, res) => {
  const { userId } = req.user;
  const { name } = req.body;

  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json(errorResponse('Name must be a string'));
  }

  try {
    await db.query(`UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`, [name?.trim() || '', userId]);
    return getMe(req, res);
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to update profile'));
  }
};

module.exports = {
  getMe,
  updateMe,
};
