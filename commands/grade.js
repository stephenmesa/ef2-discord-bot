const { MessageFlags, EmbedBuilder } = require('discord.js');
const { formatNumber, getEmbedColor, buildFooter } = require('../utils');

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
      interaction.user.id,
      'sr',
      Number(latest.knight_level),
      5,
      latest.id
    );

    if (nearbyEntries.length === 0) {
      return interaction.reply({ content: 'No nearby entries available to compute a grade. Record more entries around your current KL.', flags: MessageFlags.Ephemeral });
    }

    const scores = nearbyEntries.map((row) => Number(row.estimated_sr_pct));
    const grade = computePercentile(Number(latest.estimated_sr_pct), scores);

    const srEmbed = new EmbedBuilder()
        .setColor(getEmbedColor())
        .setTitle('✨ Latest Soul Rest Entry')
        .setDescription(`Here is the current grading breakdown for your entry.`)
        .addFields(
            { name: '🆔 Entry ID', value: `${latest.id}`, inline: true },
            { name: '⚔️ Knight Level', value: `${latest.knight_level}`, inline: true },
            { name: '🏅 Medals', value: `${formatNumber(latest.total_medals)}`, inline: true },
        )
        .addFields(
            { name: '📊 SR MPM', value: `**${formatNumber(latest.sr_mpm)}**`, inline: true },
            { name: '📈 SR %', value: `**${Number(latest.estimated_sr_pct).toFixed(2)}%**`, inline: true },
            { name: '⚡ Double SR %', value: `**${Number(latest.estimated_double_sr_pct).toFixed(2)}%**`, inline: true },
        )
        .addFields(
            { 
                name: '🏆 Grade Percentile', 
                value: `**${grade}** *(among ${nearbyEntries.length} nearby ${nearbyEntries.length === '1' ? 'entry' : 'entries'})*`, 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter(buildFooter());

    return interaction.reply({
      embeds: [srEmbed],
      flags: MessageFlags.Ephemeral
    });
  },
};
