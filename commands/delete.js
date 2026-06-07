module.exports = {
  name: 'delete',
  aliases: [],
  description: 'Deletes a specific entry by ID. Usage: delete <sr|raid> <ID>',
  async execute(message, args, context) {
    const { db, parseEntryType, formatEntry, formatAge } = context;

    const type = parseEntryType(args[0]);
    const id = args[1] ? Number(args[1]) : NaN;
    if (!type || !Number.isInteger(id) || id <= 0) {
      return message.reply('Usage: delete <sr|raid> <ID>');
    }

    const deleted = await db.deleteEntryById(message.author.id, type, id);
    if (!deleted) {
      return message.reply(`Could not find a ${type.toUpperCase()} entry with ID ${id}.`);
    }

    return message.reply(
      [`Deleted ${type.toUpperCase()} entry:`, formatEntry(deleted), `Recorded ${formatAge(deleted.created_at)}.`].join('\n')
    );
  },
};
