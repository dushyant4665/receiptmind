const db = require('../config/db');
const crypto = require('crypto');

const normalizeVendor = (vendor) => {
  if (!vendor) return '';
  let normalized = vendor.toLowerCase().trim();
  
  const replacements = {
    'amazon web services': 'aws',
    'amzn aws': 'aws',
    'amazon aws': 'aws',
  };
  
  if (replacements[normalized]) {
    normalized = replacements[normalized];
  }
  
  // Remove non-alphanumeric characters but keep spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

const applyRules = async (organizationId, extraction) => {
  try {
    const normalizedVendor = normalizeVendor(extraction.vendor_name);
    
    // Check for canonical vendor in aliases
    if (normalizedVendor) {
      const { rows: aliases } = await db.query(
        `SELECT canonical_vendor FROM vendor_aliases 
         WHERE organization_id = $1 AND normalized_alias = $2 AND deleted_at IS NULL 
         ORDER BY confidence DESC LIMIT 1`,
        [organizationId, normalizedVendor]
      );
      
      if (aliases.length > 0 && aliases[0].canonical_vendor) {
        extraction.vendor_name = aliases[0].canonical_vendor;
      }
    }

    // Fetch active rules
    const { rows: rules } = await db.query(
      'SELECT id, condition_type, condition_value, action_type, action_value FROM rules WHERE organization_id = $1 AND is_active = true ORDER BY created_at DESC',
      [organizationId]
    );

    const result = { ...extraction };

    for (const rule of rules) {
      let matched = false;

      if (rule.condition_type === 'vendor') {
        matched = normalizeVendor(result.vendor_name) === normalizeVendor(rule.condition_value);
      } else if (rule.condition_type === 'category') {
        matched = result.category === rule.condition_value;
      }

      if (!matched) continue;

      if (rule.action_type === 'set_category') {
        result.category = rule.action_value;
        console.log(`Rule applied: category override for ${result.vendor_name} to ${rule.action_value}`);
      } else if (rule.action_type === 'ignore') {
        console.log(`Rule applied: ignore for ${result.vendor_name}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error applying rules:', error);
    return extraction;
  }
};

const autoLearnFromEdit = async (organizationId, vendorName, newCategory) => {
  if (!vendorName || !newCategory) return;

  try {
    // Record learning event
    await db.query(
      'INSERT INTO rule_learning_events (id, organization_id, vendor, chosen_category) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), organizationId, vendorName, newCategory]
    );

    // Check count for this vendor+category combo
    const { rows: counts } = await db.query(
      'SELECT COUNT(*) FROM rule_learning_events WHERE organization_id = $1 AND vendor = $2 AND chosen_category = $3',
      [organizationId, vendorName, newCategory]
    );

    const eventCount = parseInt(counts[0].count);

    if (eventCount >= 3) {
      const normalized = normalizeVendor(vendorName);
      if (normalized) {
        // Create/Update vendor alias
        await db.query(
          `INSERT INTO vendor_aliases (id, organization_id, canonical_vendor, alias, normalized_alias, confidence)
           VALUES ($1, $2, $3, $4, $5, 0.92)
           ON CONFLICT (organization_id, normalized_alias)
           DO UPDATE SET canonical_vendor = EXCLUDED.canonical_vendor, confidence = GREATEST(vendor_aliases.confidence, EXCLUDED.confidence), updated_at = NOW()`,
          [crypto.randomUUID(), organizationId, vendorName, vendorName, normalized]
        );
      }

      // Check if rule already exists
      const { rows: existingRules } = await db.query(
        `SELECT id FROM rules 
         WHERE organization_id = $1 AND condition_type = 'vendor' AND condition_value = $2 AND action_type = 'set_category'`,
        [organizationId, vendorName]
      );

      if (existingRules.length > 0) {
        // Update existing rule
        await db.query(
          'UPDATE rules SET action_value = $1 WHERE id = $2',
          [newCategory, existingRules[0].id]
        );
        console.log(`Auto-learned rule updated for ${vendorName} -> ${newCategory}`);
      } else {
        // Create new rule
        await db.query(
          `INSERT INTO rules (id, organization_id, condition_type, condition_value, action_type, action_value, is_active)
           VALUES ($1, $2, 'vendor', $3, 'set_category', $4, true)`,
          [crypto.randomUUID(), organizationId, vendorName, newCategory]
        );
        console.log(`Auto-learned rule created for ${vendorName} -> ${newCategory} (Events: ${eventCount})`);
      }
    }
  } catch (error) {
    console.error('Error in autoLearnFromEdit:', error);
  }
};

module.exports = {
  applyRules,
  autoLearnFromEdit,
  normalizeVendor,
};
