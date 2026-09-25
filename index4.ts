import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// 2. Evento cuando el bot enciende (¡Mete la limpieza aquí dentro!)
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user?.tag}`);

    try {
        // Borra TODOS los comandos globales antiguos de golpe
        await client.application?.commands.set([]);
        console.log('🧹 Todos los comandos antiguos han sido eliminados de Discord.');
    } catch (error) {
        console.error('❌ Error al limpiar los comandos:', error);
    }
});


// 3. Manejador único de interacciones (Comandos y Botones)
client.on('interactionCreate', async (interaction) => {
    try {
        // Manejo de Comandos Slash
        if (interaction.isChatInputCommand()) {
            
            // Comando /dash
            if (interaction.commandName === 'dash') {
                const embedDash = new EmbedBuilder()
                    .setTitle('🏁 REDLINE GT - Panel de Control')
                    .setDescription('Selecciona una opción de gestión utilizando los botones inferiores:')
                    .setColor(0xED1C24);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_sugerencia').setLabel('Sugerencia').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_reporte').setLabel('Reporte').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_defensa').setLabel('Defensa').setStyle(ButtonStyle.Success)
                );

                return await interaction.reply({ embeds: [embedDash], components: [row], ephemeral: true });
            }

            // Comando /msn
            if (interaction.commandName === 'msn') {
                const channelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('select_canal_msn')
                    .setPlaceholder('Selecciona el canal de destino...')
                    .setChannelTypes([ChannelType.GuildText])
                    .setMaxValues(1);

                const row = new ActionRowBuilder().addComponents(channelSelect);

                return await interaction.reply({
                    content: '📢 **[1/3]** ¿A qué canal quieres enviar este mensaje?',
                    components: [row],
                    ephemeral: true
                });
            }

            // Comando /veredicto
            if (interaction.commandName === 'veredicto') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_veredicto')
                    .setTitle('Emitir Veredicto');

                const inputId = new TextInputBuilder().setCustomId('ver_id').setLabel('🆔 de Reporte').setStyle(TextInputStyle.Short).setRequired(true);
                const inputReporta = new TextInputBuilder().setCustomId('ver_reporta').setLabel('Piloto que Reporta').setStyle(TextInputStyle.Short).setRequired(true);
                const inputDefiende = new TextInputBuilder().setCustomId('ver_defiende').setLabel('Piloto que Defiende').setStyle(TextInputStyle.Short).setRequired(true);
                const inputNota = new TextInputBuilder().setCustomId('ver_nota').setLabel('Nota (Markdown soportado)').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const inputSancion = new TextInputBuilder().setCustomId('ver_sancion').setLabel('Sanción').setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputId),
                    new ActionRowBuilder().addComponents(inputReporta),
                    new ActionRowBuilder().addComponents(inputDefiende),
                    new ActionRowBuilder().addComponents(inputNota),
                    new ActionRowBuilder().addComponents(inputSancion)
                );

                return await interaction.showModal(modal);
            }
        }

        // Manejo de Botones del /dash
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_sugerencia' || interaction.customId === 'btn_reporte' || interaction.customId === 'btn_defensa') {
                return await interaction.reply({ content: `Has pulsado el botón: ${interaction.customId}`, ephemeral: true });
            }
        }

    } catch (error) {
        console.error('❌ Error en interactionCreate:', error);
    }
});

// 4. Conexión del bot (¡Vital para que responda!)
client.login(process.env.DISCORD_TOKEN);
                                                          
