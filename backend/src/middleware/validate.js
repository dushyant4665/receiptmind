const validate =
  (schema) =>
    async (
      req,
      res,
      next
    ) => {

      try {

        const validated =
          await schema.parseAsync(
            req.body
          );

        req.validatedBody =
          validated;

        next();

      } catch (error) {

        return res.status(400)
          .json({

            success: false,

            error:
              'Validation failed',

            details:
              error.errors,
          });
      }
    };

module.exports = validate;