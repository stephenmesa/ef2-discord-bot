module.exports = {
  name: 'grade',
  aliases: [],
  description: 'Shows your current SR grade based on nearby SR entries.',
  async execute(message, args, context) {
    const { db, computePercentile, formatEntry } = context;

    const latest = await db.getLatestEntry(message.author.id, 'sr');
    if (!latest) {
      return message.reply('No SR progress found. Use `record` or `sr` to add your first entry.');
    }

    const nearbyEntries = await db.getNearbyEntries(
      message.author.id,
      'sr',
      Number(latest.knight_level),
      5,
      latest.id
    );

    if (nearbyEntries.length === 0) {
      return message.reply('No nearby entries available to compute a grade. Record more entries around your current KL.');
    }

    const scores = nearbyEntries.map((row) => Number(row.estimated_sr_pct));
    const grade = computePercentile(Number(latest.estimated_sr_pct), scores);
    return message.reply(
      [`Your latest SR entry:`, formatEntry(latest), `Grade percentile among ${nearbyEntries.length} nearby entries: ${grade}%`].join('\n')
    );
  },
};
