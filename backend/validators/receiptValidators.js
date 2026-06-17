const {
  z,
} = require('zod');

/*
  =====================================
  RECEIPT EDIT VALIDATION
  =====================================
*/

const editReceiptSchema =
  z.object({

    vendor_name:
      z.string()
      .min(
        1,
        'Vendor name required'
      )
      .max(
        200,
        'Vendor name too long'
      )
      .optional(),

    amount:
      z.number({

        invalid_type_error:
          'Amount must be number',
      })
      .positive(
        'Amount must be positive'
      )
      .optional(),

    subtotal:
      z.number({

        invalid_type_error:
          'Subtotal must be number',
      })
      .min(
        0,
        'Subtotal invalid'
      )
      .optional(),

    tax_amount:
      z.number({

        invalid_type_error:
          'Tax amount must be number',
      })
      .min(
        0,
        'Tax amount invalid'
      )
      .optional(),

    receipt_date:
      z.string()
      .regex(

        /^\d{4}-\d{2}-\d{2}$/,

        'Date must be YYYY-MM-DD'
      )
      .optional(),

    currency:
      z.string()
      .min(
        3,
        'Currency invalid'
      )
      .max(
        10,
        'Currency invalid'
      )
      .optional(),

    category:
      z.string()
      .max(
        100,
        'Category too long'
      )
      .optional(),

    invoice_number:
      z.string()
      .max(
        100,
        'Invoice number too long'
      )
      .optional(),

    payment_method:
      z.string()
      .max(
        100,
        'Payment method too long'
      )
      .optional(),
  });

/*
  =====================================
  BULK DELETE VALIDATION
  =====================================
*/

const bulkDeleteSchema =
  z.object({

    receipt_ids:
      z.array(

        z.string().uuid(
          'Invalid receipt ID'
        )
      )
      .min(
        1,
        'At least one receipt required'
      ),
  });

/*
  =====================================
  BULK EXPORT VALIDATION
  =====================================
*/

const bulkExportSchema =
  z.object({

    receipt_ids:
      z.array(

        z.string().uuid(
          'Invalid receipt ID'
        )
      )
      .min(
        1,
        'At least one receipt required'
      ),

    format:
      z.enum([
        'csv',
      ])
      .default('csv'),
  });

module.exports = {

  editReceiptSchema,

  bulkDeleteSchema,

  bulkExportSchema,
};