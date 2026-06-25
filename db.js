const { Pool } = require('pg');

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
      rebirth_medal_bonus TEXT
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
    ALTER TABLE progress ADD COLUMN IF NOT EXISTS rebirth_medal_bonus TEXT;
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
    rebirthMedalBonus
  } = entry;

  const result = await pool.query(
    `INSERT INTO progress (user_id, entry_type, knight_level, total_medals, sr_mpm, estimated_sr_pct, estimated_double_sr_pct, notes, rebirth_medal_bonus)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *;`,
    [userId, normalizeEntryType(type), knightLevel, totalMedals, srMpm, estimatedSrPct, estimatedDoubleSrPct, notes || null, rebirthMedalBonus || null]
  );

  return result.rows[0];
}

async function getLatestEntry(userId, type = 'sr') {
  const result = await pool.query(
    `SELECT * FROM progress WHERE user_id = $1 AND entry_type = $2 ORDER BY created_at DESC LIMIT 1;`,
    [userId, normalizeEntryType(type)]
  );
  return result.rows[0] || null;
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
  return result.rows[0] || null;
}

async function getAllEntries(userId, type = 'sr', limit = 200) {
  const result = await pool.query(
    `SELECT * FROM progress WHERE user_id = $1 AND entry_type = $2 ORDER BY created_at ASC LIMIT $3;`,
    [userId, normalizeEntryType(type), limit]
  );
  return result.rows;
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
  return result.rows;
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
    return deleted;
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
};
