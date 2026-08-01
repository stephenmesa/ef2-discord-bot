const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'outliers',
  aliases: [],
  description: 'Generates a CSV of potential outlier records and DMs it to the user. Admin-only.',
  adminOnly: true,
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, buildProgressCsv, sendDmWithAttachment } = context;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const outliers = await db.getOutliers();

      if (outliers.length === 0) {
        return interaction.editReply({ content: 'No potential outlier records found.' });
      }

      const buffer = buildProgressCsv(outliers);
      const sent = await sendDmWithAttachment(interaction.user, 'Here is the CSV file containing potential outlier records.', buffer, 'outliers.csv');

      if (sent) {
        return interaction.editReply({ content: 'Sent potential outlier records to your DMs.' });
      }
      return interaction.editReply({ content: 'Unable to send you a DM. Please enable direct messages from this server and try again.' });
    } catch (error) {
      console.error('Failed to generate outliers CSV:', error);
      return interaction.editReply({ content: 'Something went wrong while generating the outliers CSV.' });
    }
  },
};
