import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';


// Inicializar el cliente con los intents necesarios para tu servidor
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

// Función de utilidad para verificar si el usuario tiene el rol 'Dirección'
function verificarDireccion(interaction) {
    const rolDireccion = interaction.guild.roles.cache.find(role => role.name.toLowerCase() === 'dirección');
    if (!rolDireccion) return false;
    return interaction.member.roles.cache.has(rolDireccion.id);
}
client.verificarDireccion = verificarDireccion;

// Almacenamiento en memoria para contadores de ID e hilos por servidor/reporte
const contadoresReportes = new Map(); 
const hilosReportes = new Map();      

function obtenerSiguienteId(guildId) {
    let actual = contadoresReportes.get(guildId) || 0;
    const idFormateado = String(actual).padStart(3, '0');
    contadoresReportes.set(guildId, (actual + 1) % 1000);
    return `🆔 ${idFormateado}`;
}
// Evento cuando el bot está listo y operativo
client.once('ready', async () => {
    console.log(`¡Bot conectado con éxito como ${client.user?.tag}!`);
    
    // Registro automático de todos los comandos de barra (/dash, /veredicto, /msn)
    const commands = [
        new SlashCommandBuilder()
            .setName('dash')
            .setDescription('Abre el panel de control principal de administración y gestión'),
        new SlashCommandBuilder()
            .setName('veredicto')
            .setDescription('Abre el formulario para emitir un veredicto oficial'),
        new SlashCommandBuilder()
            .setName('msn')
            .setDescription('Asistente interactivo para redactar y enviar mensajes personalizados')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Registrando comandos de barra...');
        await rest.put(
            Routes.applicationCommands(1551200581190942862),
            { body: commands },
        );
        console.log('Comandos de barra registrados correctamente.');
    } catch (error) {
        console.error('Error al registrar los comandos:', error);
    }
});
   // Manejador del comando /dash (Panel de control con botones)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'dash') {
        if (!client.verificarDireccion(interaction)) {
            return interaction.reply({
                content: '❌ Solo el rol **@Dirección** puede abrir el panel de control.',
                ephemeral: true
            });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        const embedDash = new EmbedBuilder()
            .setTitle('🏁 REDLINE GT - Panel de Control')
            .setDescription('Selecciona una opción de gestión utilizando los botones inferiores:')
            .setColor(0xED1C24);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_sugerencia')
                .setLabel('Sugerencia')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('btn_reporte')
                .setLabel('Reporte')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('btn_defensa')
                .setLabel('Defensa')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({
            embeds: [embedDash],
            components: [row],
            ephemeral: true
        });
    }

    // Manejadores de los comandos /veredicto y /msn (Optimizados para respuesta instantánea)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'dash') {
        if (!client.verificarDireccion(interaction)) {
            return interaction.reply({
                content: '❌ Solo el rol **@Dirección** puede abrir el panel de control.',
                ephemeral: true
            });
        }

        const embedDash = new EmbedBuilder()
            .setTitle('🏁 REDLINE GT - Panel de Control')
            .setDescription('Selecciona una opción de gestión utilizando los botones inferiores:')
            .setColor(0xED1C24);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_sugerencia').setLabel('Sugerencia').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_reporte').setLabel('Reporte').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('btn_defensa').setLabel('Defensa').setStyle(ButtonStyle.Success)
        );

        return interaction.reply({ embeds: [embedDash], components: [row], ephemeral: true });
    }

    if (interaction.commandName === 'veredicto') {
        if (!client.verificarDireccion(interaction)) {
            return interaction.reply({ content: '❌ Solo el rol **@Dirección** puede usar este comando.', ephemeral: true });
        }

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

        return interaction.showModal(modal);
    }

    if (interaction.commandName === 'msn') {
        if (!client.verificarDireccion(interaction)) {
            return interaction.reply({ content: '❌ Solo el rol **@Dirección** puede usar este comando.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('modal_msn')
            .setTitle('Asistente /msn - Redacción de Mensaje');

        const inputTexto = new TextInputBuilder().setCustomId('msn_texto').setLabel('Texto del mensaje').setStyle(TextInputStyle.Paragraph).setRequired(true);
        const inputCanal = new TextInputBuilder().setCustomId('msn_canal').setLabel('ID del Canal de destino').setStyle(TextInputStyle.Short).setRequired(true);
        const inputRepeticion = new TextInputBuilder().setCustomId('msn_repetir').setLabel('¿Repetir? (Ej: No o Sí)').setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputTexto),
            new ActionRowBuilder().addComponents(inputCanal),
            new ActionRowBuilder().addComponents(inputRepeticion)
        );

        return interaction.showModal(modal);
    }
});
            
  // Manejadores de Botones del Panel (/dash)
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        // 1. Botón de Sugerencia
        if (interaction.customId === 'btn_sugerencia') {
            try {
                await interaction.deferReply({ ephemeral: true });
                const guild = interaction.guild;
                const member = interaction.member;
                const rolDireccion = guild.roles.cache.find(r => r.name.toLowerCase() === 'dirección');
                
                const suggestionChannel = await guild.channels.create({
                    name: `sugerencia-${member.user.username}`,
                    type: 0,
                    permissionOverwrites: [
                        { id: guild.id, deny: ['ViewChannel'] },
                        { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        ...(rolDireccion ? [{ id: rolDireccion.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }] : []),
                    ],
                });

                await suggestionChannel.send(`¡Hola ${member}! Has abierto un canal de sugerencia. El equipo de **Dirección** ha sido incluido aquí.`);
                await interaction.editReply({ content: `✅ Canal de sugerencia creado con éxito: ${suggestionChannel}` });
            } catch (error) {
                console.error('Error al crear canal de sugerencia:', error);
                await interaction.editReply({ content: 'Hubo un error al crear el canal de sugerencia.' }).catch(() => {});
            }
        }

        // 2. Botón de Reporte (Abre el Modal)
        if (interaction.customId === 'btn_reporte') {
            if (!client.verificarDireccion(interaction)) {
                return interaction.reply({ content: '❌ Solo el rol **@Dirección** puede usar esta función.', ephemeral: true });
            }

            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('modal_reporte').setTitle('Crear Nuevo Reporte');

            const inputJornada = new TextInputBuilder().setCustomId('rep_jornada').setLabel('Jornada').setStyle(TextInputStyle.Short).setRequired(true);
            const inputReporta = new TextInputBuilder().setCustomId('rep_reporta').setLabel('Piloto que Reporta').setStyle(TextInputStyle.Short).setRequired(true);
            const inputReportado = new TextInputBuilder().setCustomId('rep_reportado').setLabel('Piloto a Reportar').setStyle(TextInputStyle.Short).setRequired(true);
            const inputDesc = new TextInputBuilder().setCustomId('rep_desc').setLabel('Breve descripción').setStyle(TextInputStyle.Paragraph).setRequired(true);
            const inputVideo = new TextInputBuilder().setCustomId('rep_video').setLabel('Enlace video').setStyle(TextInputStyle.Short).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputJornada),
                new ActionRowBuilder().addComponents(inputReporta),
                new ActionRowBuilder().addComponents(inputReportado),
                new ActionRowBuilder().addComponents(inputDesc),
                new ActionRowBuilder().addComponents(inputVideo)
            );

            await interaction.showModal(modal);
        }

        // 3. Botón de Defensa (Abre el Modal)
        if (interaction.customId === 'btn_defensa') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('modal_defensa').setTitle('Enviar Defensa de Reporte');

            const inputId = new TextInputBuilder().setCustomId('def_id').setLabel('🆔 de Reporte (Ej: 001)').setStyle(TextInputStyle.Short).setRequired(true);
            const inputReporta = new TextInputBuilder().setCustomId('def_reporta').setLabel('Piloto que Reportó').setStyle(TextInputStyle.Short).setRequired(true);
            const inputDefiende = new TextInputBuilder().setCustomId('def_defiende').setLabel('Piloto en Defensa').setStyle(TextInputStyle.Short).setRequired(true);
            const inputDesc = new TextInputBuilder().setCustomId('def_desc').setLabel('Descripción de la defensa').setStyle(TextInputStyle.Paragraph).setRequired(true);
            const inputEnlace = new TextInputBuilder().setCustomId('def_enlace').setLabel('Enlace de video (Opcional)').setStyle(TextInputStyle.Short).setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputId),
                new ActionRowBuilder().addComponents(inputReporta),
                new ActionRowBuilder().addComponents(inputDefiende),
                new ActionRowBuilder().addComponents(inputDesc),
                new ActionRowBuilder().addComponents(inputEnlace)
            );

            await interaction.showModal(modal);
        }

        // Botones de la vista previa de /msn
        if (interaction.customId.startsWith('msn_enviar_')) {
            const idCanal = interaction.customId.split('_')[2];
            try {
                const canalDestino = await interaction.guild.channels.fetch(idCanal);
                if (!canalDestino) {
                    return interaction.reply({ content: '❌ No se encontró el canal de destino.', ephemeral: true });
                }
                const embedOriginal = interaction.message.embeds[0];
                if (!embedOriginal) {
                    return interaction.reply({ content: '❌ Error: No se encontró el contenido.', ephemeral: true });
                }

                await canalDestino.send(embedOriginal.description);
                await interaction.update({ content: `✅ ¡Mensaje enviado con éxito al canal ${canalDestino}!`, embeds: [], components: [] });
            } catch (error) {
                console.error('Error al enviar mensaje /msn:', error);
                await interaction.reply({ content: '❌ Error al enviar el mensaje. Verifica el ID del canal y permisos.', ephemeral: true });
            }
        }

        if (interaction.customId === 'msn_editar') {
            await interaction.update({ content: '✏️ Edición cancelada. Vuelve a ejecutar `/msn` para redactar de nuevo.', embeds: [], components: [] });
        }

        if (interaction.customId === 'msn_cancelar') {
            await interaction.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
        }
    }
});
         // Manejadores de Formularios (Modales)
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;
    const { EmbedBuilder } = require('discord.js');

    // 1. Procesar Reporte (Caja Roja + Hilo automático)
    if (interaction.customId === 'modal_reporte') {
        await interaction.deferReply({ ephemeral: true });
        const jornada = interaction.fields.getTextInputValue('rep_jornada');
        const pilotoReporta = interaction.fields.getTextInputValue('rep_reporta');
        const pilotoReportado = interaction.fields.getTextInputValue('rep_reportado');
        const descripcion = interaction.fields.getTextInputValue('rep_desc');
        const video = interaction.fields.getTextInputValue('rep_video');

        const idReporte = obtenerSiguienteId(interaction.guildId);

        const embedReporte = new EmbedBuilder()
            .setTitle(`REPORTE OFICIAL - ${idReporte}`)
            .setColor(0xED1C24)
            .addFields(
                { name: '📅 Jornada', value: jornada, inline: true },
                { name: '👤 Piloto que Reporta', value: pilotoReporta, inline: true },
                { name: '🎯 Piloto a Reportar', value: pilotoReportado, inline: true },
                { name: '📝 Descripción', value: descripcion },
                { name: '🔗 Enlace de Video', value: video }
            )
            .setTimestamp();

        const mensajeEnviado = await interaction.channel.send({ embeds: [embedReporte] });
        const hilo = await mensajeEnviado.startThread({
            name: `Reporte ${idReporte} - ${pilotoReportado}`,
            autoArchiveDuration: 1440
        });

        hilosReportes.set(`${interaction.guildId}_${idReporte.replace('🆔 ', '')}`, hilo);
        await interaction.editReply({ content: `✅ Reporte ${idReporte} creado y publicado con éxito en el hilo.` });
    }

    // 2. Procesar Defensa (Caja Verde dentro del hilo)
    if (interaction.customId === 'modal_defensa') {
        await interaction.deferReply({ ephemeral: true });
        const idReporteInput = interaction.fields.getTextInputValue('def_id').replace('🆔 ', '').trim();
        const pilotoReporto = interaction.fields.getTextInputValue('def_reporta');
        const pilotoDefiende = interaction.fields.getTextInputValue('def_defiende');
        const descripcion = interaction.fields.getTextInputValue('def_desc');
        const enlace = interaction.fields.getTextInputValue('def_enlace') || 'Sin enlace adjunto';

        const embedDefensa = new EmbedBuilder()
            .setTitle(`DEFENSA - 🆔 ${idReporteInput}`)
            .setColor(0x2ECC71)
            .addFields(
                { name: '👤 Piloto que Reportó', value: pilotoReporto, inline: true },
                { name: '🛡️ Piloto en Defensa', value: pilotoDefiende, inline: true },
                { name: '📝 Descripción de la Defensa', value: descripcion },
                { name: '🔗 Enlace', value: enlace }
            )
            .setTimestamp();

        const claveHilo = `${interaction.guildId}_${idReporteInput}`;
        const hiloReporte = hilosReportes.get(claveHilo);

        if (hiloReporte) {
            await hiloReporte.send({ embeds: [embedDefensa] });
            await interaction.editReply({ content: `✅ Defensa enviada correctamente dentro del hilo del reporte 🆔 ${idReporteInput}.` });
        } else {
            await interaction.channel.send({ embeds: [embedDefensa] });
            await interaction.editReply({ content: `⚠️ No se encontró el hilo en memoria para 🆔 ${idReporteInput}, la defensa se envió en este canal.` });
        }
    }

    // 3. Procesar Veredicto (Caja Azul con Markdown)
    if (interaction.customId === 'modal_veredicto') {
        await interaction.deferReply({ ephemeral: true });
        const idReporte = interaction.fields.getTextInputValue('ver_id');
        const pilotoReporta = interaction.fields.getTextInputValue('ver_reporta');
        const pilotoDefiende = interaction.fields.getTextInputValue('ver_defiende');
        const nota = interaction.fields.getTextInputValue('ver_nota');
        const sancion = interaction.fields.getTextInputValue('ver_sancion');

        const embedVeredicto = new EmbedBuilder()
            .setTitle(`⚖️ VEREDICTO OFICIAL - ${idReporte}`)
            .setColor(0x3498DB)
            .addFields(
                { name: '👤 Piloto que Reporta', value: pilotoReporta, inline: true },
                { name: '🛡️ Piloto que Defiende', value: pilotoDefiende, inline: true },
                { name: '📋 Nota / Argumentos (Markdown)', value: nota },
                { name: '⚠️ Sanción Aplicada', value: sancion }
            )
            .setTimestamp();

        const claveHilo = `${interaction.guildId}_${idReporte.replace('🆔 ', '').trim()}`;
        const hiloReporte = hilosReportes.get(claveHilo);

        if (hiloReporte) {
            await hiloReporte.send({ embeds: [embedVeredicto] });
            await interaction.editReply({ content: `✅ Veredicto emitido y publicado con éxito en el hilo del reporte ${idReporte}.` });
        } else {
            await interaction.channel.send({ embeds: [embedVeredicto] });
            await interaction.editReply({ content: `✅ Veredicto emitido y publicado en este canal para el reporte ${idReporte}.` });
        }
    }

    // 4. Procesar Asistente /msn (Vista Previa con pie REDLINE GT)
    if (interaction.customId === 'modal_msn') {
        await interaction.deferReply({ ephemeral: true });
        const textoUsuario = interaction.fields.getTextInputValue('msn_texto');
        const idCanal = interaction.fields.getTextInputValue('msn_canal');
        const repeticion = interaction.fields.getTextInputValue('msn_repetir');

        const footerTexto = "REDLINE GT";
        const mensajeFinal = `${textoUsuario}\n\n_${footerTexto}_`;

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const embedPreview = new EmbedBuilder()
            .setTitle('🔍 Vista Previa del Mensaje (/msn)')
            .setDescription(mensajeFinal)
            .addFields(
                { name: '📂 Canal Destino (ID)', value: idCanal, inline: true },
                { name: '🔁 Configuración Repetición', value: repeticion, inline: true }
            )
            .setColor(0xED1C24)
            .setTimestamp();

        const rowBotones = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`msn_enviar_${idCanal}`).setLabel('Enviar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('msn_editar').setLabel('Editar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('msn_cancelar').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            content: 'Revisa la vista previa de tu mensaje antes de proceder:',
            embeds: [embedPreview],
            components: [rowBotones]
        });
    }
});

// Iniciar sesión con el token del bot de forma tradicional
client.login(process.env.DISCORD_TOKEN);
                                                               
