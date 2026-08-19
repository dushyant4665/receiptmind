const { z } = require('zod');

const editReceiptSchema = z.object({
  vendor_name: z.string().min(1).max(200).optional(),
  amount: z.number({ invalid_type_error: 'Amount must be number' }).min(0).optional(),
  subtotal: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional(),
  receipt_date: z.string().optional(),
  currency: z.string().min(1).max(10).optional(),
  category: z.string().max(100).optional(),
  invoice_number: z.string().max(100).optional(),
  payment_method: z.string().max(100).optional(),
  is_billable: z.boolean().optional(),
  is_reimbursable: z.boolean().optional(),
});

const bulkDeleteSchema = z.object({
  receipt_ids: z.array(z.string().uuid('Invalid receipt ID')).min(1, 'At least one receipt ID required'),
});

const bulkExportSchema = z.object({
  receipt_ids: z.array(z.string().uuid('Invalid receipt ID')).min(1, 'At least one receipt ID required'),
  format: z.enum(['csv']).default('csv'),
});

module.exports = {
  editReceiptSchema,
  bulkDeleteSchema,
  bulkExportSchema,
};
