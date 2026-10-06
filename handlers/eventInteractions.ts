import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    ModalSubmitInteraction, 
    MessageFlags,
    RoleSelectMenuBuilder,
    ButtonStyle,
    ButtonBuilder
} from 'discord.js';
import { getEventsCollection } from './interactionRouter';

// Memoria temporal para la sesión de creación de eventos de cada usuario
export const eventSessions = new Map<string, any>();

// 🛡️️ ENRUTADOR LOCAL DE EVENTOS (PARTE 1)
export async function handleEventInteraction(interaction: any): Promise<boolean> {
    try {
        // 1. Botones del flujo de eventos
        if (interaction.isButton()) {
            if (interaction.customId === 'dash_btn_event_create') return await handleDashEventButton(interaction);
            if (interaction.customId === 'event_proceed_to_modal') return await handleEventProceedToModal(interaction);
            if (interaction.customId === 'event_publish_now') return await handleEventPublishNowButton(interaction);
            if (interaction.customId === 'event_config_repeat') return await handleEventConfigRepeatButton(interaction);
            if (['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(interaction.customId)) return await handleEventRsvpButton(interaction);
        }
        
        // 2. Modales
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_event_create') return await handleEventModalSubmit(interaction);
            if (interaction.customId === 'modal_event_repeat') return await handleEventRepeatModalSubmit(interaction);
        }

        // 3. Menú de Canales (Guardado silencioso en sesión)
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'event_select_channel') {
                let session = eventSessions.get(interaction.user.id) || {};
                session.channelId = interaction.values[0];
                eventSessions.set(interaction.user.id, session);
                await interaction.deferUpdate();
                return true;
            }
        }

        // 4. Menú de Roles (Guardado silencioso en sesión)
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'event_select_role') {
                let session = eventSessions.get(interaction.user.id) || {};
                session.roleId = interaction.values[0];
                eventSessions.set(interaction.user.id, session);
                await interaction.deferUpdate();
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el manejador de eventos:', error);
        return false;
    }
}

// --- PASO 1 y 2: Desplegables apilados (Canal + Rol) ---
async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    eventSessions.set(interaction.user.id, {});

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('event_select_channel')
        .setPlaceholder('📢 Selecciona el canal de publicación...')
        .addChannelTypes(ChannelType.GuildText);

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('event_select_role')
        .setPlaceholder('🏷️ Selecciona el rol a mencionar...');

    const rowChannel = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);
    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_proceed_to_modal')
            .setLabel('Continuar al Formulario')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➡️')
    );

    await interaction.reply({
        content: '📅 **Organizador de Eventos:** Selecciona el canal y el rol en los menús desplegables y pulsa **Continuar**:',
        components: [rowChannel, rowRole, rowButton],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- Validación y apertura del Modal Principal (5 preguntas) ---
async function handleEventProceedToModal(interaction: ButtonInteraction): Promise<boolean> {
    const session = eventSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId) {
        await interaction.reply({ 
            content: '❌ Debes seleccionar tanto un **canal** como un **rol** en los menús antes de continuar.', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId('modal_event_create')
        .setTitle('📅 Detalles del Evento');

    const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Día del evento (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 25/06/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Hora del evento CET (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Título del Evento')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: GP de España - GT3')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('event_desc')
        .setLabel('Descripción (Opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Normativa, horarios, circuitos...')
        .setRequired(false);

    const imageInput = new TextInputBuilder()
        .setCustomId('event_image')
        .setLabel('ID o URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://... o ID')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return true;
}

// --- Procesar Modal y ofrecer Bifurcación ---
async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.date = interaction.fields.getTextInputValue('event_date').trim();
    session.time = interaction.fields.getTextInputValue('event_time').trim();
    session.title = interaction.fields.getTextInputValue('event_title').trim();
    session.description = interaction.fields.getTextInputValue('event_desc').trim() || 'Sin descripción detallada.';
    session.image = interaction.fields.getTextInputValue('event_image').trim() || null;

    const rowFork = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_publish_now')
            .setLabel('🚀 Publicar Ya (Ipso Facto)')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('event_config_repeat')
            .setLabel('⚙️ Configurar Repetición / Programación')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content: `📋 **Datos guardados.** ¿Cómo deseas proceder?\n• **Publicar Ya:** Se lanza al instante al canal seleccionado.\n• **Programar:** Añade opciones de recurrencia y primer envío.`,
        components: [rowFork],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
