const { Pool } = require('pg');
const {
  calculateSrPercentage,
  parseCompactNumber,
  calculateBaseMpm,
  compactifyNumber,
} = require('./utils');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : true
});

pool.on('error', (error) => {
  console.error('Unexpected pool error:', error);
});

async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('Connected to database successfully.');
    client.release();
  } catch (error) {
    throw new Error(`Failed to connect to database: ${error.message}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      knight_level INTEGER NOT NULL,
      total_medals TEXT NOT NULL,
      sr_mpm TEXT NOT NULL,
      estimated_sr_pct NUMERIC NOT NULL,
      estimated_double_sr_pct NUMERIC NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      rebirth_medal_bonus NUMERIC,
      base_sr_mpm TEXT,
      base_estimated_sr_pct NUMERIC,
      base_estimated_double_sr_pct NUMERIC
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS progress_user_idx ON progress (user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS progress_entry_type_idx ON progress (entry_type);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS progress_knight_level_idx ON progress (knight_level);
  `);
  await pool.query(`
    ALTER TABLE progress
    ADD COLUMN IF NOT EXISTS rebirth_medal_bonus NUMERIC,
    ADD COLUMN IF NOT EXISTS base_sr_mpm TEXT,
    ADD COLUMN IF NOT EXISTS base_estimated_sr_pct NUMERIC,
    ADD COLUMN IF NOT EXISTS base_estimated_double_sr_pct NUMERIC;
  `);
}

function normalizeEntryType(type) {
  if (!type) return 'sr';
  const normalized = String(type).trim().toLowerCase();
  if (normalized === 'sr') {
    return 'sr';
  }
  throw new Error('Unknown entry type');
}

async function insertProgress(entry) {
  const {
    userId,
    type = 'sr',
    knightLevel,
    totalMedals,
    srMpm,
    estimatedSrPct,
    estimatedDoubleSrPct,
    notes,
    rebirthMedalBonus,
    baseSRMpm,
    baseEstimatedSrPct,
    baseEstimatedDoubleSrPct,
  } = entry;

  const result = await pool.query(
    `INSERT INTO progress (user_id, entry_type, knight_level, total_medals, sr_mpm, estimated_sr_pct, estimated_double_sr_pct, notes, rebirth_medal_bonus, base_sr_mpm, base_estimated_sr_pct, base_estimated_double_sr_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *;`,
    [userId, normalizeEntryType(type), knightLevel, totalMedals, srMpm, estimatedSrPct, estimatedDoubleSrPct, notes || null, rebirthMedalBonus || null, baseSRMpm || null, baseEstimatedSrPct || null, baseEstimatedDoubleSrPct || null]
  );

  return hydrateProgress(result.rows[0]);
}

async function getLatestEntry(userId, type = 'sr') {
  const result = await pool.query(
    `SELECT * FROM progress WHERE user_id = $1 AND entry_type = $2 ORDER BY created_at DESC LIMIT 1;`,
    [userId, normalizeEntryType(type)]
  );
  return hydrateProgress(result.rows[0]) || null;
}

async function getEntryByIdWithNeighbors(userId, type = 'sr', id) {
  let latestRecordId;
  // If id is not defined, grab the latest id for this userId and type
  if (id === undefined || id === null) {
    latestRecordId = await pool.query(
      `SELECT id FROM progress WHERE user_id = $1 AND entry_type = $2 ORDER BY created_at DESC LIMIT 1;`,
      [userId, normalizeEntryType(type)]
    );
  }

  const recordId = id ?? latestRecordId.rows[0]?.id;

  // Grab the entry by ID and also the ID of the previous and next entries for navigation purposes
  const result = await pool.query(
    `SELECT 
      p.*,
      (SELECT id FROM progress WHERE user_id = $1 AND entry_type = $2 AND created_at < p.created_at ORDER BY created_at DESC LIMIT 1) AS prev_id,
      (SELECT id FROM progress WHERE user_id = $1 AND entry_type = $2 AND created_at > p.created_at ORDER BY created_at ASC LIMIT 1) AS next_id
     FROM progress p
     WHERE p.user_id = $1 AND p.entry_type = $2 AND p.id = $3;`,
    [userId, normalizeEntryType(type), recordId]
  );
  const progress = hydrateProgress(result.rows[0]);

  if (!progress) return null;

  progress.prev_id = result.rows[0].prev_id;
  progress.next_id = result.rows[0].next_id;
  return progress;
}

function hydrateProgress(progress) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    return null;
  }

  const {
    id,
    user_id: userId,
    entry_type: entryType,
    knight_level: knightLevel,
    total_medals: totalMedals,
    sr_mpm: srMpm,
    notes,
    created_at: createdAt,
    rebirth_medal_bonus: rebirthMedalBonus,
  } = progress;

  const srMpmValue = parseCompactNumber(srMpm);
  const totalMedalsValue = parseCompactNumber(totalMedals);
  const estimatedSrPercent = calculateSrPercentage(srMpmValue, totalMedalsValue);
  const baseSrMpmValue = calculateBaseMpm(srMpmValue, rebirthMedalBonus);
  const baseEstimatedSrPercent = calculateSrPercentage(baseSrMpmValue, totalMedalsValue);

  return {
    id,
    userId,
    entryType,
    knightLevel,
    totalMedals,
    srMpm,
    estimatedSrPercent: Number(estimatedSrPercent.toFixed(2)),
    estimatedSrPercentDouble: Number((estimatedSrPercent * 2).toFixed(2)),
    notes,
    createdAt,
    rebirthMedalBonus,
    baseSrMpm: compactifyNumber(baseSrMpmValue),
    baseEstimatedSrPercent: baseEstimatedSrPercent ? Number(baseEstimatedSrPercent.toFixed(2)) : null,
    baseEstimatedSrPercentDouble: baseEstimatedSrPercent ? Number((baseEstimatedSrPercent * 2).toFixed(2)) : null,
  };
}

function hydrateProgresses(progresses) {
  if (!progresses || !Array.isArray(progresses)) {
    return [];
  }
  return progresses.map(hydrateProgress).filter(p => p != null);
}

async function getAllEntries(userId, type = 'sr', limit = 200) {
  const result = await pool.query(
    `SELECT * FROM progress WHERE user_id = $1 AND entry_type = $2 ORDER BY created_at ASC LIMIT $3;`,
    [userId, normalizeEntryType(type), limit]
  );
  return result.rows.map(hydrateProgress).filter(r => !!r);
}

async function getNearbyEntries(type = 'sr', knightLevel, range = 5, excludeId = null, limit = 200) {
  const params = [normalizeEntryType(type), Math.max(0, knightLevel - range), knightLevel + range, limit];
  let query = `SELECT * FROM progress WHERE entry_type = $1 AND knight_level BETWEEN $2 AND $3`;
  if (excludeId !== null) {
    query += ` AND id != $5`;
    params.splice(4, 0, excludeId);
  }
  query += ` ORDER BY knight_level ASC, created_at ASC LIMIT $4;`;

  const result = await pool.query(query, params);
  return result.rows.map(hydrateProgress).filter(r => !!r);
}

async function deleteLatestEntry(userId, type = 'sr') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const latest = await client.query(
      `SELECT * FROM progress WHERE user_id = $1 AND entry_type = $2 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;`,
      [userId, normalizeEntryType(type)]
    );
    if (!latest.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const deleted = latest.rows[0];
    await client.query(`DELETE FROM progress WHERE id = $1;`, [deleted.id]);
    await client.query('COMMIT');
    return hydrateProgress(deleted);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteEntryById(userId, type = 'sr', id) {
  const result = await pool.query(
    `DELETE FROM progress WHERE user_id = $1 AND entry_type = $2 AND id = $3 RETURNING *;`,
    [userId, normalizeEntryType(type), id]
  );
  return result.rows[0] || null;
}

async function getStats() {
  const stats = {};
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await pool.query(`
    SELECT
      SUM(CASE WHEN created_at >= $1 THEN 1 ELSE 0 END) AS count_last_day,
      SUM(CASE WHEN created_at >= $2 THEN 1 ELSE 0 END) AS count_last_week,
      SUM(CASE WHEN entry_type = 'sr' THEN 1 ELSE 0 END) AS total_sr,
      COUNT(*) AS total_entries
    FROM progress;
  `, [oneDayAgo, oneWeekAgo]);

  stats.countLastDay = Number(result.rows[0].count_last_day || 0);
  stats.countLastWeek = Number(result.rows[0].count_last_week || 0);
  stats.totalSr = Number(result.rows[0].total_sr || 0);
  stats.totalEntries = Number(result.rows[0].total_entries || 0);
  return stats;
}

async function getGlobalMpmScatterData() {
  const result = await pool.query(
    `SELECT knight_level, sr_mpm, base_sr_mpm FROM progress WHERE entry_type = 'sr' ORDER BY knight_level ASC;`
  );
  return result.rows;
}

function getMean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function getStdDev(values, mean) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function getAbsoluteOutlierReasons(entry) {
  const reasons = [];
  if (entry.knightLevel <= 0 || entry.knightLevel > 1000) {
    reasons.push(`Knight Level ${entry.knightLevel} is out of bounds (1-1000)`);
  }
  const p = entry.estimatedSrPercent;
  if (p === null || p === undefined || Number.isNaN(p) || p < 0 || p > 100) {
    reasons.push(`Impossible SR % (${p !== null && p !== undefined ? p.toFixed(2) : 'NaN'}%)`);
  }
  const bp = entry.baseEstimatedSrPercent;
  if (bp !== null && bp !== undefined && (Number.isNaN(bp) || bp < 0 || bp > 100)) {
    reasons.push(`Impossible Base SR % (${bp.toFixed(2)}%)`);
  }
  return reasons;
}

function isAbsoluteOutlier(entry) {
  return getAbsoluteOutlierReasons(entry).length > 0;
}

async function getOutliers() {
  const result = await pool.query('SELECT * FROM progress;');
  const allEntries = result.rows.map(hydrateProgress).filter((r) => !!r);

  const outliers = [];

  for (const entry of allEntries) {
    const absReasons = getAbsoluteOutlierReasons(entry);
    if (absReasons.length > 0) {
      entry.outlierReason = absReasons.join('; ');
      outliers.push(entry);
      continue;
    }

    // Find non-absolute-outlier comparisons within same KL +/- 1
    const comparisons = allEntries.filter(
      (o) => o.id !== entry.id &&
        !isAbsoluteOutlier(o) &&
        Math.abs(o.knightLevel - entry.knightLevel) <= 1
    );

    let flagged = false;

    // Check estimatedSrPercent
    if (comparisons.length >= 3) {
      const pValues = comparisons
        .map((o) => o.estimatedSrPercent)
        .filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

      if (pValues.length >= 3) {
        const pMean = getMean(pValues);
        const pStd = getStdDev(pValues, pMean);
        if (pStd > 0) {
          const z = Math.abs(entry.estimatedSrPercent - pMean) / pStd;
          if (z > 3) {
            entry.outlierReason = `SR % Z-score is ${z.toFixed(2)} (> 3) relative to KL +/- 1 (mean=${pMean.toFixed(2)}%, stddev=${pStd.toFixed(2)}%)`;
            outliers.push(entry);
            flagged = true;
          }
        } else {
          // If stddev is 0, check absolute difference is > 1%
          const diff = Math.abs(entry.estimatedSrPercent - pMean);
          if (diff > 1.0) {
            entry.outlierReason = `SR % difference from neighbors is ${diff.toFixed(2)}% (> 1.0%) when neighbor stddev is 0 (mean=${pMean.toFixed(2)}%)`;
            outliers.push(entry);
            flagged = true;
          }
        }
      }
    }

    // Check baseEstimatedSrPercent if not already flagged and if base values are present
    if (!flagged && entry.baseEstimatedSrPercent !== null && entry.baseEstimatedSrPercent !== undefined && !Number.isNaN(entry.baseEstimatedSrPercent)) {
      if (comparisons.length >= 3) {
        const bpValues = comparisons
          .map((o) => o.baseEstimatedSrPercent)
          .filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

        if (bpValues.length >= 3) {
          const bpMean = getMean(bpValues);
          const bpStd = getStdDev(bpValues, bpMean);
          if (bpStd > 0) {
            const z = Math.abs(entry.baseEstimatedSrPercent - bpMean) / bpStd;
            if (z > 3) {
              entry.outlierReason = `Base SR % Z-score is ${z.toFixed(2)} (> 3) relative to KL +/- 1 (mean=${bpMean.toFixed(2)}%, stddev=${bpStd.toFixed(2)}%)`;
              outliers.push(entry);
            }
          } else {
            const diff = Math.abs(entry.baseEstimatedSrPercent - bpMean);
            if (diff > 1.0) {
              entry.outlierReason = `Base SR % difference from neighbors is ${diff.toFixed(2)}% (> 1.0%) when neighbor stddev is 0 (mean=${bpMean.toFixed(2)}%)`;
              outliers.push(entry);
            }
          }
        }
      }
    }
  }

  // Sort by createdAt descending
  outliers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return outliers;
}

module.exports = {
  initDatabase,
  insertProgress,
  getLatestEntry,
  getEntryByIdWithNeighbors,
  getAllEntries,
  getNearbyEntries,
  deleteLatestEntry,
  deleteEntryById,
  getStats,
  getOutliers,
  hydrateProgress,
  getGlobalMpmScatterData,
};
