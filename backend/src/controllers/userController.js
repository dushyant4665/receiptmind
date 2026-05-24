const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

const getMe = async (req, res) => {
  const { userId } = req.user;

  try {
    const { rows } = await db.query(
      'SELECT id, email, name, organization_id, created_at FROM users WHERE id = $1',
      [userId]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    res.json(successResponse(user));
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const updateMe = async (req, res) => {
  const { userId } = req.user;
  const { name } = req.body;

  try {
    await db.query('UPDATE users SET name = $1 WHERE id = $2', [name, userId]);
    return getMe(req, res);
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  getMe,
  updateMe,
};
