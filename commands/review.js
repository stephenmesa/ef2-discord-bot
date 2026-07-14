const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { formatNumber, buildFooter, getEmbedColor } = require('../utils');

const REVIEW_TIMEOUT = 1 * 60 * 1000; // 1 minute in milliseconds

const generateActionRow = (currentEntry) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('prev_entry')
        .setLabel('⏮️ Previous')
        .setStyle(ButtonStyle.Secondary)
        // Disable if we're at the very first entry
        .setDisabled(currentEntry.prev_id === null),

    new ButtonBuilder()
        .setCustomId('delete_entry')
        .setLabel('🗑️ Delete Entry')
        .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
        .setCustomId('next_entry')
        .setLabel('⏭️ Next')
        .setStyle(ButtonStyle.Secondary)
        // Disable if we're at the latest entry
        .setDisabled(currentEntry.next_id === null)
  );

const generateEmbed = (currentEntry) => {
  const baseMPMFields = [];
  if (currentEntry.rebirthMedalBonus) {
    baseMPMFields.push({
      name: 'Medal Buff %',
      value: `${currentEntry.rebirthMedalBonus}%`,
      inline: true,
    });
  }
  if (currentEntry.baseSrMpm) {
    baseMPMFields.push({
      name: 'Base SR mpm',
      value: `${formatNumber(currentEntry.baseSrMpm)}`,
      inline: true,
    });
  }

  return new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle('✨ Soul Rest Entry')
    .setDescription(`Here is your record.`)
    .addFields(
        { name: '🆔 Entry ID', value: `${currentEntry.id}`, inline: true },
        { name: '⚔️ Knight Level', value: `${currentEntry.knightLevel}`, inline: true },
        { name: '🏅 Medals', value: `${formatNumber(currentEntry.totalMedals)}`, inline: true },
        { name: '⏱️ SR mpm', value: `${formatNumber(currentEntry.srMpm)}`, inline: true },
        { name: '📊 Estimated SR %', value: `${formatNumber(currentEntry.estimatedSrPercent)}%`, inline: true },
        ...baseMPMFields,
    )
    .setTimestamp(currentEntry.createdAt)
    .setFooter(buildFooter());
};

module.exports = {
  name: 'review',
  aliases: [],
  description: 'Review your SR entries. Usage: review',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { db, formatEntry, formatAge } = context;

    let currentEntry = await db.getEntryByIdWithNeighbors(interaction.user.id, 'sr', null); // Get latest entry along with neighbors for navigation

    if (!currentEntry) {
      return interaction.reply({ content: 'No SR progress found. Use `record` or `sr` to add your first entry.', flags: MessageFlags.Ephemeral });
    }

    const recordEmbed = generateEmbed(currentEntry);

    const row = generateActionRow(currentEntry);

    const response = await interaction.reply({
      embeds: [recordEmbed],
      flags: MessageFlags.Ephemeral,
      components: [row],
      withResponse: true,
    });

    const collector = response.resource.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: REVIEW_TIMEOUT
    });

    collector.on('collect', async (i) => {
          // SECURITY CHECK: Ensure ONLY the person who ran the slash command can use these buttons
          if (i.user.id !== interaction.user.id) {
              return await i.reply({ 
                  content: "❌ This menu isn't yours. Run `/review` to view your own history!", 
                  flags: MessageFlags.Ephemeral
              });
          }

          // Reset the internal timer back to 3 minutes on click activity
          collector.resetTimer();
          // await i.deferUpdate(); // Acknowledge the button interaction immediately to avoid "This interaction failed" message

          // Handle Navigation Buttons
          if (i.customId === 'prev_entry') {
              currentEntry = await db.getEntryByIdWithNeighbors(interaction.user.id, 'sr', currentEntry.prev_id);

              const recordEmbed = generateEmbed(currentEntry);
              const row = generateActionRow(currentEntry);

              await i.update({ embeds: [recordEmbed], components: [row], flags: MessageFlags.Ephemeral });
          } 
          else if (i.customId === 'next_entry') {
              currentEntry = await db.getEntryByIdWithNeighbors(interaction.user.id, 'sr', currentEntry.next_id);

              const recordEmbed = generateEmbed(currentEntry);
              const row = generateActionRow(currentEntry);
              await i.update({ embeds: [recordEmbed], components: [row], flags: MessageFlags.Ephemeral });
          } 
          // Handle Delete Button
          else if (i.customId === 'delete_entry') {
              await db.deleteEntryById(interaction.user.id, 'sr', currentEntry.id);
              // Show a quick ephemeral notice and shift the embed display

              if (currentEntry.next_id === null && currentEntry.prev_id === null) {
                  return await i.update({ content: '🗑️ Deleted last entry. No more entries to show.', embeds: [], components: [], flags: MessageFlags.Ephemeral });
              }

              currentEntry = await db.getEntryByIdWithNeighbors(interaction.user.id, 'sr', currentEntry.next_id ?? currentEntry.prev_id); // Try to move forward first, if not possible move backward

              const recordEmbed = generateEmbed(currentEntry);
              const row = generateActionRow(currentEntry);
              await i.update({ content: '🗑️ Deleted entry. Showing next entry...', embeds: [recordEmbed], components: [row], flags: MessageFlags.Ephemeral });
          }
    });
    collector.on('end', async () => {
      // Handle any cleanup if necessary when a button interaction is removed from the collector
      await interaction.editReply({ content: 'Review finished.', components: [], flags: MessageFlags.Ephemeral });
    });
  },
};
