module.exports = {
  name: 'undo',
  aliases: [],
  description: 'Deletes your most recent SR entry. Usage: undo',
  async execute(message, args, context) {
    const { db, formatEntry, formatAge } = context;

    if (args.length > 0) {
      return message.reply('Usage: undo');
    }

    const deleted = await db.deleteLatestEntry(message.author.id, 'sr');
    if (!deleted) {
      return message.reply('No SR entries found to undo.');
    }

    return message.reply([
      'Deleted latest SR entry:',
      formatEntry(deleted),
      `Recorded ${formatAge(deleted.created_at)}.`,
    ].join('\n'));
  },
};
