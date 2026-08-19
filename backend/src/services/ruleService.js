const crypto = require('crypto');
const db = require('../config/db');

// Cleans vendor strings for matching
const normalizeVendor = (vendor) => {
  if (!vendor) return '';
  let normalized = vendor.toLowerCase().trim();

  const aliases = {
    'amazon web services': 'aws',
    'amzn aws': 'aws',
    'uber bv': 'uber',
    'uber trips': 'uber',
  };

  if (aliases[normalized]) {
    normalized = aliases[normalized];
  }

  return normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

// Applies organization rules & aliases to extracted data
const applyRules = async (organizationId, extraction) => {
  try {
    const norm = normalizeVendor(extraction.vendor_name);

    // 1. Check vendor aliases
    if (norm) {
      const { rows: aliasRows } = await db.query(
        `SELECT canonical_vendor FROM vendor_aliases
         WHERE organization_id = $1 AND normalized_alias = $2 AND deleted_at IS NULL
         ORDER BY confidence DESC LIMIT 1`,
        [organizationId, norm]
      );
      if (aliasRows.length > 0 && aliasRows[0].canonical_vendor) {
        extraction.vendor_name = aliasRows[0].canonical_vendor;
      }
    }

    // 2. Fetch active rules
    const { rows: rules } = await db.query(
      `SELECT condition_type, condition_value, action_type, action_value
       FROM rules WHERE organization_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [organizationId]
    );

    const result = { ...extraction };

    for (const rule of rules) {
      let matched = false;

      if (rule.condition_type === 'vendor') {
        matched = normalizeVendor(result.vendor_name) === normalizeVendor(rule.condition_value);
      } else if (rule.condition_type === 'category') {
        matched = result.category?.toLowerCase() === rule.condition_value?.toLowerCase();
      }

      if (!matched) continue;

      if (rule.action_type === 'set_category') {
        result.category = rule.action_value;
      }
    }

    return result;
  } catch (error) {
    console.error('Error applying rules:', error.message);
    return extraction;
  }
};

// Auto-learns rule if a vendor is manually edited to same category 3+ times
const autoLearnFromEdit = async (organizationId, vendorName, newCategory) => {
  if (!vendorName || !newCategory) return;

  try {
    // 1. Record edit event
    await db.query(
      `INSERT INTO rule_learning_events (id, organization_id, vendor, chosen_category)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), organizationId, vendorName, newCategory]
    );

    // 2. Count edits for this vendor & category combo
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM rule_learning_events
       WHERE organization_id = $1 AND vendor = $2 AND chosen_category = $3`,
      [organizationId, vendorName, newCategory]
    );

    const count = parseInt(rows[0].count, 10);

    // If edited 3 times, auto-create permanent rule
    if (count >= 3) {
      const normalized = normalizeVendor(vendorName);
      if (normalized) {
        await db.query(
          `INSERT INTO vendor_aliases (id, organization_id, canonical_vendor, alias, normalized_alias, confidence)
           VALUES ($1, $2, $3, $4, $5, 0.95)
           ON CONFLICT (organization_id, normalized_alias)
           DO UPDATE SET canonical_vendor = EXCLUDED.canonical_vendor, updated_at = NOW()`,
          [crypto.randomUUID(), organizationId, vendorName, vendorName, normalized]
        );
      }

      const { rows: existing } = await db.query(
        `SELECT id FROM rules
         WHERE organization_id = $1 AND condition_type = 'vendor' AND condition_value = $2 AND action_type = 'set_category'`,
        [organizationId, vendorName]
      );

      if (existing.length > 0) {
        await db.query(`UPDATE rules SET action_value = $1 WHERE id = $2`, [newCategory, existing[0].id]);
      } else {
        await db.query(
          `INSERT INTO rules (id, organization_id, condition_type, condition_value, action_type, action_value, is_active)
           VALUES ($1, $2, 'vendor', $3, 'set_category', $4, true)`,
          [crypto.randomUUID(), organizationId, vendorName, newCategory]
        );
      }
      console.log(`Auto-learned rule created: "${vendorName}" -> "${newCategory}"`);
    }
  } catch (error) {
    console.error('Error in auto-learning:', error.message);
  }
};

module.exports = {
  applyRules,
  autoLearnFromEdit,
  normalizeVendor,
};
