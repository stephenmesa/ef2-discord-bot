module.exports = {
  name: 'delete',
  aliases: [],
  description: 'Deletes a specific entry by ID. Usage: delete <ID>',
  async execute(message, args, context) {
    const { db, formatEntry, formatAge } = context;

    const id = args[0] ? Number(args[0]) : NaN;
    if (!Number.isInteger(id) || id <= 0) {
      return message.reply('Usage: delete <ID>');
    }

    const deleted = await db.deleteEntryById(message.author.id, 'sr', id);
    if (!deleted) {
      return message.reply(`Could not find an SR entry with ID ${id}.`);
    }

    return message.reply([
      'Deleted SR entry:',
      formatEntry(deleted),
      `Recorded ${formatAge(deleted.created_at)}.`,
    ].join('\n'));
  },
};
