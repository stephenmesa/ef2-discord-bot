const { MessageFlags } = require('discord.js');

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
      return interaction.reply({ content: 'Please provide a valid entry ID.', flags: MessageFlags.Ephemeral });
    }

    const deleted = await db.deleteEntryById(interaction.user.id, 'sr', id);
    if (!deleted) {
      return interaction.reply({ content: `Could not find an SR entry with ID ${id}.`, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({ content: [
      'Deleted SR entry:',
      formatEntry(deleted),
      `Recorded ${formatAge(deleted.created_at)}.`,
    ].join('\n'), flags: MessageFlags.Ephemeral });
  },
};
