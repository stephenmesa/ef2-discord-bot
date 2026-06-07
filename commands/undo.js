module.exports = {
  name: 'undo',
  aliases: [],
  description: 'Deletes your most recent SR entry. Usage: undo',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, formatEntry, formatAge } = context;

    const deleted = await db.deleteLatestEntry(interaction.user.id, 'sr');
    if (!deleted) {
      return interaction.reply('No SR entries found to undo.');
    }

    return interaction.reply([
      'Deleted latest SR entry:',
      formatEntry(deleted),
      `Recorded ${formatAge(deleted.created_at)}.`,
    ].join('\n'));
  },
};
