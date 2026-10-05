import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    ModalSubmitInteraction, 
    Client,
    TextChannel, 
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let eventsCollection: any = null;

async function getEventsCollection() {
    if (!eventsCollection) {
        await clientMongo.connect();
        eventsCollection = clientMongo.db('redline_bot').collection('event_jobs');
        console.log('📅 [MongoDB] Conectado al sistema de eventos de simracing.');
    }
    return eventsCollection;
}

const eventSessions = new Map<string, any>();

// 1. Botón del Dashboard para iniciar la creación de un Evento
export async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_event_create') return false;

    eventSessions.set(interaction.user.id, {});

    const modal = new ModalBuilder()
        .setCustomId('modal_event_create')
        .setTitle('📅 Crear Evento / Campeonato (1/4)');

    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Título del Evento')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: GP de España - F1 / GT3...')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('event_desc')
        .setLabel('Descripción / Detalles del Evento')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Horarios, normativa, circuitos...')
        .setRequired(true);

    const imageInput = new TextInputBuilder()
        .setCustomId('event_image')
        .setLabel('URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Procesar modal de creación y pedir canal
export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const title = interaction.fields.getTextInputValue('event_title');
    const description = interaction.fields.getTextInputValue('event_desc');
    const image = interaction.fields.getTextInputValue('event_image').trim();

    eventSessions.set(interaction.user.id, { title, description, image: image || null });

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('event_select_channel')
        .setPlaceholder('📢 Selecciona el canal para publicar el evento...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '📅 **Organizador de Eventos (2/4):** Selecciona el canal de destino:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 3. Canal seleccionado -> Pide rol del campeonato
export async function handleEventChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_channel') return false;

    const channelId = interaction.values[0];
    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.channelId = channelId;

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('event_select_role')
        .setPlaceholder('🏷️ Selecciona el rol del campeonato a mencionar...');

    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowSkip = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_skip_role').setLabel('Omitir mención de rol').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
        content: `📢 Canal seleccionado (<#${channelId}>).\n**Paso 3/4:** Selecciona el rol del campeonato a mencionar:`,
        components: [rowRole, rowSkip]
    });

    return true;
}

// 4. Rol seleccionado o saltado -> Pregunta si se desea configurar intervalo y repetición
export async function handleEventRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_role' && interaction.customId !== 'event_skip_role') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        if (interaction.isRepliable()) {
            await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        }
        return true;
    }

    if (interaction.isRoleSelectMenu()) {
        session.roleId = interaction.values[0];
    } else {
        session.roleId = null;
    }

    const rowRepeat = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_repeat_yes').setLabel('🔄 Sí, configurar intervalo y repetición').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('event_repeat_no').setLabel('⚡ Enviar / Programar única vez').setStyle(ButtonStyle.Secondary)
    );

    const contentMsg = '📅 **Paso 4/4:** ¿Deseas programar este evento para una fecha específica o configurarlo con intervalo recurrente?';

    if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
        await interaction.followUp({ content: contentMsg, components: [rowRepeat], flags: [MessageFlags.Ephemeral] });
    } else if (interaction.isRepliable()) {
        await interaction.update({ content: contentMsg, components: [rowRepeat] });
    }

    return true;
}

// 5A. Si pulsa NO repetir -> Pide fecha y hora única mediante modal rápido
export async function handleEventRepeatNoButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_no') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_single_datetime')
        .setTitle('Fecha y Hora del Evento');

    const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Fecha (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/10/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Hora peninsular (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 5B. Si pulsa SÍ repetir -> Abre el Modal con la 1ª publicación + Intervalo (Días, Horas, Minutos) + Nº total
export async function handleEventRepeatYesButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_yes') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_repeat')
        .setTitle('Configurar Evento con Intervalo');

    const dateInput = new TextInputBuilder()
        .setCustomId('event_first_date')
        .setLabel('📅 Fecha 1ª publicación (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/10/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_first_time')
        .setLabel('⏰ Hora 1ª publicación (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    const daysInput = new TextInputBuilder()
        .setCustomId('event_interval_days')
        .setLabel('Intervalo: Días')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 0')
        .setRequired(false);

    const hoursInput = new TextInputBuilder()
        .setCustomId('event_interval_hours')
        .setLabel('Intervalo: Horas')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 2')
        .setRequired(false);

    const minutesInput = new TextInputBuilder()
        .setCustomId('event_interval_minutes')
        .setLabel('Intervalo: Minutos')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 30')
        .setRequired(false);

    const timesInput = new TextInputBuilder()
        .setCustomId('event_repeat_times')
        .setLabel('Nº total de envíos (ej: 3)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 3 (Mínimo 2)')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(minutesInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}
