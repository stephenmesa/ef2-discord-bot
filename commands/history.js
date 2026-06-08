const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'history',
  aliases: [],
  description: 'Sends your entry history as a CSV file via DM. Usage: history',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, buildProgressCsv, sendDmWithAttachment } = context;

    const rows = await db.getAllEntries(interaction.user.id, 'sr', 500);
    if (!rows.length) {
      return interaction.reply({ content: 'No SR history found. Use record/sr to add entries.', flags: MessageFlags.Ephemeral });
    }

    const csvBuffer = buildProgressCsv(rows);
    const sent = await sendDmWithAttachment(
      interaction.user,
      `Here is your SR history (${rows.length} entries).`,
      csvBuffer,
      `sr-history.csv`
    );

    if (sent) {
      return interaction.reply({ content: 'Sent your SR history to your DMs.', flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ content: 'Unable to send you a DM. Please enable direct messages and try again.', flags: MessageFlags.Ephemeral });
  },
};
