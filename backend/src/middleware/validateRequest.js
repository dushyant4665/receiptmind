const { ZodError } = require('zod');
const { errorResponse } = require('../utils/response');

// Middleware to validate req.body against a Zod schema
const validateRequest = (schema) => async (req, res, next) => {
  try {
    req.validatedData = await schema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json(errorResponse(messages || 'Validation failed'));
    }
    return res.status(400).json(errorResponse(error.message || 'Validation failed'));
  }
};

module.exports = validateRequest;