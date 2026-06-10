const { MessageFlags, EmbedBuilder } = require('discord.js');
const { formatNumber, getEmbedColor, buildFooter, buildGradeEmbed } = require('../utils');

module.exports = {
  name: 'grade',
  aliases: [],
  description: 'Shows your current SR grade based on nearby SR entries.',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, computePercentile } = context;

    const latest = await db.getLatestEntry(interaction.user.id, 'sr');
    if (!latest) {
      return interaction.reply({ content: 'No SR progress found. Use `record` or `sr` to add your first entry.', flags: MessageFlags.Ephemeral });
    }

    const nearbyEntries = await db.getNearbyEntries(
      'sr',
      Number(latest.knight_level),
      2,
      latest.id
    );

    if (nearbyEntries.length === 0) {
      return interaction.reply({ content: 'No nearby KL entries found for grade comparison. Record more SR progress to build your grade profile.', flags: MessageFlags.Ephemeral });
    }

    const scores = nearbyEntries.map((row) => Number(row.estimated_sr_pct));
    const grade = computePercentile(Number(latest.estimated_sr_pct), scores);

    const gradeEmbed = buildGradeEmbed(latest, grade, nearbyEntries.length);

    return interaction.reply({
      embeds: [gradeEmbed],
      flags: MessageFlags.Ephemeral
    });
  },
};
