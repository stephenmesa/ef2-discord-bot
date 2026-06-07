module.exports = {
  name: 'undo',
  aliases: [],
  description: 'Deletes your most recent SR or raid entry. Usage: undo <sr|raid>',
  async execute(message, args, context) {
    const { db, parseEntryType, formatEntry, formatAge } = context;

    const type = parseEntryType(args[0]);
    if (!type) {
      return message.reply('Usage: undo <sr|raid>');
    }

    const deleted = await db.deleteLatestEntry(message.author.id, type);
    if (!deleted) {
      return message.reply(`No ${type.toUpperCase()} entries found to undo.`);
    }

    return message.reply(
      [`Deleted latest ${type.toUpperCase()} entry:`, formatEntry(deleted), `Recorded ${formatAge(deleted.created_at)}.`].join('\n')
    );
  },
};
