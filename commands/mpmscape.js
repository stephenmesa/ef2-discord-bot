const { MessageFlags, AttachmentBuilder } = require('discord.js');

module.exports = {
  name: 'mpmscape',
  aliases: [],
  description: 'Generates a scatterplot of all MPM entries across Knight Levels.',
  slashOptions: [
    {
      name: 'type',
      description: 'Which MPM type to plot: Standard MPM (default) or Base MPM',
      type: 3, // STRING
      required: false,
      choices: [
        { name: 'Standard MPM', value: 'standard' },
        { name: 'Base MPM', value: 'base' },
      ],
    },
  ],
  async execute(interaction, args, context) {
    const { db, buildScatterChartBuffer } = context;

    const mpmType = interaction.options.getString('type') || 'standard';

    const entries = await db.getGlobalMpmScatterData();

    if (!entries || entries.length === 0) {
      return interaction.reply({
        content: 'No SR entries found in the database to plot.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      // Defer reply because QuickChart calls an external API which might exceed 3s
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const buffer = await buildScatterChartBuffer(entries, mpmType);
      const attachment = new AttachmentBuilder(buffer, { name: `mpmscape-${mpmType}.png` });

      return interaction.editReply({
        content: `Here is the global scatterplot of every ${mpmType === 'base' ? 'Base ' : ''}MPM across Knight Levels.`,
        files: [attachment],
      });
    } catch (error) {
      console.error('Failed to generate mpmscape:', error);
      const errorMsg = 'An error occurred while generating the scatterplot chart.';
      if (interaction.deferred) {
        return interaction.editReply({ content: errorMsg });
      }
      return interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
    }
  },
};
