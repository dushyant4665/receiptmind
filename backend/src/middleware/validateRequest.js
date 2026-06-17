const {
  ZodError,
} = require('zod');

const {
  errorResponse,
} = require('../utils/response');

/*
  =====================================
  VALIDATION MIDDLEWARE
  =====================================
*/

const validateRequest =
  (schema) => {

    return async (
      req,
      res,
      next
    ) => {

      try {

        /*
          =============================
          VALIDATE BODY
          =============================
        */

        req.validatedData =
          await schema.parseAsync(
            req.body
          );

        next();

      } catch (error) {

        /*
          =============================
          ZOD VALIDATION ERROR
          =============================
        */

        if (
          error instanceof ZodError
        ) {

          return res
            .status(400)
            .json(
              errorResponse({

                message:
                  'Validation failed',

                errors:
                  error.errors.map(
                    (err) => ({
                      field:
                        err.path.join(
                          '.'
                        ),

                      message:
                        err.message,
                    })
                  ),
              })
            );
        }

        /*
          =============================
          UNKNOWN ERROR
          =============================
        */

        return res
          .status(500)
          .json(
            errorResponse(
              error.message
            )
          );
      }
    };
  };

module.exports =
  validateRequest;