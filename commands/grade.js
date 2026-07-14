const { MessageFlags } = require('discord.js');
const {
  buildGradeEmbed,
  assessProgress,
} = require('../utils');

module.exports = {
  name: 'grade',
  aliases: [],
  description: 'Shows your current SR grade based on nearby SR entries.',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db } = context;

    const latest = await db.getLatestEntry(interaction.user.id, 'sr');
    if (!latest) {
      return interaction.reply({ content: 'No SR progress found. Use `/record` to add your first entry.', flags: MessageFlags.Ephemeral });
    }

    const nearbyEntries = await db.getNearbyEntries(
      'sr',
      Number(latest.knightLevel),
      1,
      latest.id
    );

    if (nearbyEntries.length === 0) {
      return interaction.reply({ content: 'No nearby KL entries found for grade comparison. Record more SR progress to build your grade profile.', flags: MessageFlags.Ephemeral });
    }

    const progresses = nearbyEntries.map((row) => ({ 
      kl: Number(row.knightLevel),
      percentage: row.estimatedSrPercent,
      basePercentage: row.baseEstimatedSrPercent ? Number(row.baseEstimatedSrPercent) : null,
    }));
    const assessment = assessProgress({
      percentage: latest.estimatedSrPercent,
      basePercentage: latest.baseEstimatedSrPercent ? Number(latest.baseEstimatedSrPercent) : null,
    }, progresses);

    const gradeEmbed = buildGradeEmbed(latest, assessment);

    return interaction.reply({
      embeds: [gradeEmbed],
      flags: MessageFlags.Ephemeral
    });
  },
};
