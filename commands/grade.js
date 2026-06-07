module.exports = {
  name: 'grade',
  aliases: [],
  description: 'Shows your current SR grade based on nearby SR entries.',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, computePercentile, formatEntry } = context;

    const latest = await db.getLatestEntry(interaction.user.id, 'sr');
    if (!latest) {
      return interaction.reply('No SR progress found. Use `record` or `sr` to add your first entry.');
    }

    const nearbyEntries = await db.getNearbyEntries(
      interaction.user.id,
      'sr',
      Number(latest.knight_level),
      5,
      latest.id
    );

    if (nearbyEntries.length === 0) {
      return interaction.reply('No nearby entries available to compute a grade. Record more entries around your current KL.');
    }

    const scores = nearbyEntries.map((row) => Number(row.estimated_sr_pct));
    const grade = computePercentile(Number(latest.estimated_sr_pct), scores);
    return interaction.reply(
      [`Your latest SR entry:`, formatEntry(latest), `Grade percentile among ${nearbyEntries.length} nearby entries: ${grade}%`].join('\n')
    );
  },
};
