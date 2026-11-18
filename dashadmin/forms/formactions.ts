import { 
    ButtonInteraction,
    StringSelectMenuInteraction, 
    ChannelSelectMenuInteraction,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    FileUploadBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    TextChannel,
    MessageFlags 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo, guardarFormulario } from './formsstorage';
import { appendSheetData, readSheetData } from '../../dashsheet/sheetsService';

// Mapa temporal para recordar qué formulario y canal de publicación se están configurando durante el flujo de colocación
export const colocationContext = new Map<string, { titulo: string; canalPublicacionId: string }>();

// 1. Maneja el clic en el botón "Formulario" (Colocar) del panel
export async function handleDashColocarButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_colocar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay formularios guardados en este servidor para colocar.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('dash_select_colocar_form')
        .setPlaceholder('📌 Selecciona el formulario que deseas colocar...');

    for (const titulo of titulos.slice(0, 25)) {
        const form = formularios[titulo];
        selectMenu.addOptions({
            label: titulo,
            value: titulo,
            description: `Preguntas: ${form.preguntas.length}`
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
        content: '📌 **Colocar Formulario:** Selecciona de la lista el formulario que deseas publicar:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Maneja la selección del formulario para colocar
export async function handleDashColocarFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_colocar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`dash_channel_publi_${encodeURIComponent(tituloFormulario)}`)
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder('📺 Selecciona el canal donde se PUBLICARÁ el botón...');

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({
        content: `📌 Has seleccionado el formulario: **"${tituloFormulario}"**.\nAhora selecciona el canal donde se **enviará el botón**:`,
        components: [row]
    });

    return true;
}

// 3. Selecciona el canal de publicación y pide el canal de respuestas
export async function handleDashColocarPubliChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('dash_channel_publi_')) return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const encodedTitle = interaction.customId.replace('dash_channel_publi_', '');
    const tituloFormulario = decodeURIComponent(encodedTitle);
    const canalPubliId = interaction.channels.first()?.id;

    if (!canalPubliId) {
        await interaction.update({ content: '❌ No se seleccionó ningún canal válido.', components: [] });
        return true;
    }

    colocationContext.set(interaction.user.id, { titulo: tituloFormulario, canalPublicacionId: canalPubliId });

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('dash_channel_respuestas_final')
        .setChannelTypes(ChannelType.GuildType ? ChannelType.GuildText : ChannelType.GuildText)
        .setPlaceholder('📥 Selecciona el canal donde llegarán las RESPUESTAS...');

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({
        content: `📺 Canal de publicación seleccionado (<#${canalPubliId}>).\n\n📌 **Paso final:** Selecciona el canal de **respuestas**:`,
        components: [row]
    });

    return true;
}

// 4. Canal de respuestas final, guarda y publica el botón
export async function handleDashColocarRespuestasChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_channel_respuestas_final') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const context = colocationContext.get(interaction.user.id);
    if (!context) {
        await interaction.update({ content: '❌ Se perdió la sesión de colocación. Vuelve a iniciar.', components: [] });
        return true;
    }

    const canalRespuestasId = interaction.channels.first()?.id;
    if (!canalRespuestasId) {
        await interaction.update({ content: '❌ No se seleccionó un canal de respuestas válido.', components: [] });
        return true;
    }

    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, context.titulo);
    if (!formulario) {
        await interaction.update({ content: '❌ El formulario ya no existe.', components: [] });
        return true;
    }

    const canalDestinoPubli = await interaction.guild?.channels.fetch(context.canalPublicacionId) as TextChannel;
    if (!canalDestinoPubli) {
        await interaction.update({ content: '❌ No se encontró el canal de publicación.', components: [] });
        return true;
    }

    await guardarFormulario(interaction.guildId, context.titulo, canalRespuestasId, formulario.preguntas, formulario.solicitarLogo);
    colocationContext.delete(interaction.user.id);

    const serverName = interaction.guild?.name || 'Servidor';
    const botonAzul = new ButtonBuilder()
        .setCustomId(`open_form_${encodeURIComponent(context.titulo)}`)
        .setLabel(context.titulo.substring(0, 80))
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonAzul);
    await canalDestinoPubli.send({ content: `**FORMULARIOS**\n\n— *${serverName}*`, components: [row] });

    await interaction.update({
        content: `✅ ¡Formulario **"${context.titulo}"** colocado con éxito!\n- **Botón en:** <#${context.canalPublicacionId}>\n- **Respuestas en:** <#${canalRespuestasId}>`,
        components: []
    });

    return true;
}

// 5. Clic en el botón publicado para abrir el modal al usuario
export async function handleFormButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('open_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este botón solo se puede usar dentro de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('open_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario || !formulario.preguntas) {
        await interaction.reply({ content: '❌ Este formulario ya no está disponible.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const preguntasValidas = formulario.preguntas.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    if (preguntasValidas.length === 0) {
        await interaction.reply({ content: '❌ Este formulario no tiene preguntas válidas.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(`submit_form_${encodeURIComponent(tituloFormulario)}`)
        .setTitle(formulario.titulo.substring(0, 45));

    preguntasValidas.slice(0, 5).forEach((pregunta, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`p_${index}`)
            .setLabel(pregunta.substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    });

    await interaction.showModal(modal);
    return true;
}

// Respuestas pendientes de adjuntar el logo. Caducan a los 15 minutos.
interface PendingFormSubmission {
    userId: string;
    guildId: string;
    titulo: string;
    answers: string[];
    expiresAt: number;
}

const pendingFormSubmissions = new Map<string, PendingFormSubmission>();

async function finalizarEnvioFormulario(
    interaction: ModalSubmitInteraction,
    formulario: Awaited<ReturnType<typeof obtenerFormularioPorTitulo>>,
    answers: string[],
    logo?: { url: string; name: string }
): Promise<void> {
    const guild = interaction.guild;
    if (!formulario || !formulario.canalRespuestas || !guild) {
        await interaction.editReply({ content: '❌ Formulario o canal de respuestas no disponible.' });
        return;
    }

    let resumen = `📥 **Nueva Respuesta de Formulario**\n📋 **Formulario:** *${formulario.titulo}*\n👤 **Usuario:** <@${interaction.user.id}>\n\n`;
    formulario.preguntas.forEach((pregunta, index) => {
        resumen += `> **${pregunta}**\n${answers[index] || ''}\n\n`;
    });
    const serverName = guild.name || 'Servidor';
    resumen += `— *${serverName}*`;

    const tituloNormalizado = formulario.titulo
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (tituloNormalizado === 'inscripcioncup') {
        try {
            const idPsn = answers[0] || '';
            const apodoGt7 = answers[1] || '';
            const rawNumero = (answers[2] || '').trim();
            const numeroFormateado = `#${rawNumero.replace(/^#/, '')}`;
            const rowData = [
                interaction.user.username,
                `<@${interaction.user.id}>`,
                idPsn,
                apodoGt7,
                numeroFormateado
            ];

            await appendSheetData('Inscripción!A:E', [rowData]);
            console.log('✅ [Google Sheets] Inscripción añadida correctamente a la pestaña "Inscripción".');

            try {
                const member = await guild.members.fetch(interaction.user.id).catch(() => null);
                if (member) {
                    const roleGtCup2 = guild.roles.cache.find(
                        r => r.name.toLowerCase() === 'gtcup2' || r.name.toLowerCase() === 'gt cup 2'
                    );
                    if (roleGtCup2) {
                        await member.roles.add(roleGtCup2);
                        console.log(`🏷️ [Roles] Rol @${roleGtCup2.name} asignado a ${interaction.user.username}.`);
                    } else {
                        console.warn('⚠️ [Roles] No se encontró el rol "GtCup2" en el servidor.');
                    }
                }
            } catch (roleErr) {
                console.error('❌ Error asignando el rol @GtCup2:', roleErr);
            }

            try {
                const sheetRows = await readSheetData('Inscripción!A:E');
                if (sheetRows && sheetRows.length > 0) {
                    let listaTexto = '🏁 **LISTA OFICIAL DE INSCRITOS (GtCup2)**\n\n';
                    sheetRows.forEach((row, idx) => {
                        const mencionUsuario = row[1] || `<@${interaction.user.id}>`;
                        const apodo = row[3] || row[0] || 'Piloto';
                        const dorsal = row[4] || '';
                        listaTexto += `**${idx + 1}.** ${mencionUsuario} (${apodo}) - Dorsal: \`${dorsal}\`\n`;
                    });
                    listaTexto += `\n— *Total inscritos: ${sheetRows.length}*`;
                    const canalRespuestas = await guild.channels.fetch(formulario.canalRespuestas) as TextChannel;
                    if (canalRespuestas && canalRespuestas.isTextBased()) {
                        await canalRespuestas.send({ content: listaTexto });
                    }
                }
            } catch (listErr) {
                console.error('❌ Error publicando la lista de inscritos:', listErr);
            }
        } catch (sheetError) {
            console.error('❌ Error al guardar la inscripción en Google Sheets:', sheetError);
        }
    }

    try {
        const canalRespuestas = await guild.channels.fetch(formulario.canalRespuestas) as TextChannel;
        if (!canalRespuestas || !canalRespuestas.isTextBased()) {
            await interaction.editReply({ content: '❌ No se encontró el canal de respuestas.' });
            return;
        }

        const files = logo ? [{ attachment: logo.url, name: logo.name || 'logo-equipo' }] : [];
        await canalRespuestas.send({ content: resumen, files });
        await interaction.editReply({ content: '✅ ¡Tus respuestas se han enviado correctamente!' });
    } catch (error) {
        console.error('❌ Error al enviar respuestas:', error);
        await interaction.editReply({ content: '❌ Ocurrió un error al enviar las respuestas.' });
    }
}

// 6. Envío de respuestas. Si el formulario pide logo, se retiene todo hasta recibirlo.
export async function handleFormSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('submit_form_')) return false;

    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ Solo dentro de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('submit_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario || !formulario.canalRespuestas) {
        await interaction.editReply({ content: '❌ Formulario o canal de respuestas no disponible.' });
        return true;
    }

    const answers = formulario.preguntas.map((_, index) => interaction.fields.getTextInputValue(`p_${index}`));

    if (formulario.solicitarLogo) {
        for (const [oldToken, oldPending] of pendingFormSubmissions) {
            if (oldPending.expiresAt < Date.now()) pendingFormSubmissions.delete(oldToken);
        }
        const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        pendingFormSubmissions.set(token, {
            userId: interaction.user.id,
            guildId: interaction.guildId,
            titulo: tituloFormulario,
            answers,
            expiresAt: Date.now() + 15 * 60 * 1000
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`form_logo_attach_${token}`)
                .setLabel('Adjuntar logo del equipo')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({
            content: '🖼️ **Ahora adjunta el logo de tu equipo.**\n\nTus respuestas están guardadas temporalmente. El formulario no se enviará hasta que adjuntes la imagen.',
            components: [row]
        });
        return true;
    }

    await finalizarEnvioFormulario(interaction, formulario, answers);
    return true;
}

// 7. Botón intermedio que abre el selector de imagen del móvil/ordenador.
export async function handleFormLogoAttachButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('form_logo_attach_')) return false;

    const token = interaction.customId.replace('form_logo_attach_', '');
    const pending = pendingFormSubmissions.get(token);

    if (!pending || pending.expiresAt < Date.now()) {
        pendingFormSubmissions.delete(token);
        await interaction.reply({ content: '⌛ Esta solicitud ha caducado. Vuelve a abrir el formulario y rellénalo de nuevo.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    if (pending.userId !== interaction.user.id || pending.guildId !== interaction.guildId) {
        await interaction.reply({ content: '❌ Esta solicitud pertenece a otro usuario.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const upload = new FileUploadBuilder()
        .setCustomId('team_logo')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

    const modal = new ModalBuilder()
        .setCustomId(`form_logo_submit_${token}`)
        .setTitle('Logo de tu equipo')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Logo del equipo')
                .setDescription('Adjunta una imagen desde tu móvil o dispositivo')
                .setFileUploadComponent(upload)
        );

    await interaction.showModal(modal);
    return true;
}

// 8. Recepción obligatoria del logo y envío conjunto de respuestas + imagen.
export async function handleFormLogoSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('form_logo_submit_')) return false;

    const token = interaction.customId.replace('form_logo_submit_', '');
    const pending = pendingFormSubmissions.get(token);

    if (!pending || pending.expiresAt < Date.now()) {
        pendingFormSubmissions.delete(token);
        await interaction.reply({ content: '⌛ Esta solicitud ha caducado. Vuelve a abrir el formulario y rellénalo de nuevo.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    if (pending.userId !== interaction.user.id || pending.guildId !== interaction.guildId) {
        await interaction.reply({ content: '❌ Esta solicitud pertenece a otro usuario.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const uploads = interaction.fields.getUploadedFiles('team_logo', true);
    const attachment = uploads?.first();
    if (!attachment) {
        await interaction.reply({ content: '❌ Debes adjuntar una imagen para completar el formulario.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const isImage = attachment.contentType
        ? attachment.contentType.startsWith('image/')
        : /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(attachment.name || '');
    if (!isImage) {
        const retryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`form_logo_attach_${token}`).setLabel('Volver a adjuntar imagen').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({
            content: '❌ El archivo debe ser una imagen. Pulsa el botón para seleccionar el logo correcto.',
            components: [retryRow],
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const formulario = await obtenerFormularioPorTitulo(pending.guildId, pending.titulo);
    if (!formulario || !formulario.canalRespuestas) {
        pendingFormSubmissions.delete(token);
        await interaction.editReply({ content: '❌ El formulario o su canal de respuestas ya no están disponibles.' });
        return true;
    }

    pendingFormSubmissions.delete(token);
    await finalizarEnvioFormulario(interaction, formulario, pending.answers, {
        url: attachment.url,
        name: attachment.name || 'logo-equipo.png'
    });
    return true;
}
