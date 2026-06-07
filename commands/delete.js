module.exports = {
  name: 'delete',
  aliases: [],
  description: 'Deletes a specific entry by ID. Usage: delete <ID>',
  slashOptions: [
    {
      name: 'id',
      description: 'The ID of the entry to delete',
      type: 4, // INTEGER
      required: true,
    },
  ],
  async execute(interaction, args, context) {
    const { db, formatEntry, formatAge } = context;

    const id = args[0];
    if (!Number.isInteger(id) || id <= 0) {
      return interaction.reply('Please provide a valid entry ID.');
    }

    const deleted = await db.deleteEntryById(interaction.user.id, 'sr', id);
    if (!deleted) {
      return interaction.reply(`Could not find an SR entry with ID ${id}.`);
    }

    return interaction.reply([
      'Deleted SR entry:',
      formatEntry(deleted),
      `Recorded ${formatAge(deleted.created_at)}.`,
    ].join('\n'));
  },
};
