const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'undo',
  aliases: [],
  description: 'Deletes your most recent SR entry. Usage: undo',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, formatEntry, formatAge } = context;

    const deleted = await db.deleteLatestEntry(interaction.user.id, 'sr');
    if (!deleted) {
      return interaction.reply({ content: 'No SR entries found to undo.', flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({ content: [
      'Deleted latest SR entry:',
      formatEntry(deleted),
      `Recorded ${formatAge(deleted.createdAt)}.`,
    ].join('\n'), flags: MessageFlags.Ephemeral });
  },
};
