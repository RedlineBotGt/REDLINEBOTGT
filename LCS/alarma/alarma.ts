import { 
    SlashCommandBuilder, 
    CommandInteraction, 
    ChannelType 
} from 'discord.js';
import { getAlarmasCollection } from './alarmaworker';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * 📦 Estructura de datos completa para las alarmas de LCS en MongoDB
 */
export interface AlarmaLCS {
    _id?: any;
    guildId: string;
    channelId: string;
    titulo: string;
    dia: string;
    hora: string;
    texto: string;
    creadoPor: string;
    activa: boolean;
    esRecurrente: boolean;
    horasIntervalo?: number;
    diasIntervalo?: number;
    totalAvisos?: number;
    avisosRestantes?: number;
    proximaEjecucion?: Date;
}

export const data = new SlashCommandBuilder()
    .setName('alarma')
    .setDescription('Programa o configura una alarma/mensaje automático para LCS')
    .addStringOption(option =>
        option.setName('titulo')
            .setDescription('Título identificativo de la alarma')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('canal')
            .setDescription('Canal donde se enviará el mensaje')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
    .addStringOption(option =>
        option.setName('dia')
            .setDescription('Día de ejecución (Ej: 2026-11-01 o Todos)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('hora')
            .setDescription('Hora de envío en formato 24h (Ej: 21:00)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('texto')
            .setDescription('Texto o mensaje que se enviará')
            .setRequired(true));

export async function execute(interaction: CommandInteraction) {
    if (interaction.guildId !== LCS_GUILD_ID) {
        return interaction.reply({ 
            content: '❌ Este comando es exclusivo y solo se puede usar en el servidor autorizado de LCS.', 
            ephemeral: true 
        });
    }

    const titulo = interaction.options.get('titulo')?.value as string;
    const channel = interaction.options.get('canal')?.channel;
    const dia = interaction.options.get('dia')?.value as string;
    const hora = interaction.options.get('hora')?.value as string;
    const texto = interaction.options.get('texto')?.value as string;

    // Validación básica de formato HH:mm (ej: 09:30 o 21:00)
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora)) {
        return interaction.reply({
            content: '❌ Formato de hora incorrecto. Debe ser **HH:mm** (Ejemplo: `14:30` o `09:00`).',
            ephemeral: true
        });
    }

    // Normalizar a dos dígitos (ej: "9:00" -> "09:00")
    const [h, m] = hora.split(':');
    const horaFormateada = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;

    try {
        const collection = await getAlarmasCollection();
        const nuevaAlarma: AlarmaLCS = {
            guildId: LCS_GUILD_ID,
            channelId: channel!.id,
            titulo: titulo,
            dia: dia,
            hora: horaFormateada,
            texto: texto,
            creadoPor: interaction.user.id,
            activa: true,
            esRecurrente: false // Vía slash directo es de único aviso por defecto
        };

        await collection.insertOne(nuevaAlarma);

        await interaction.reply({ 
            content: `✅ **Alarma guardada y programada con éxito para LCS**\n📌 **Título:** ${titulo}\n📌 **Canal:** <#${channel?.id}>\n📅 **Día:** ${dia}\n⏰ **Hora:** ${horaFormateada}\n💬 **Texto:** ${texto}`, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error al guardar la alarma:', error);
        await interaction.reply({
            content: '❌ Ocurrió un error al guardar la alarma en la base de datos.',
            ephemeral: true
        });
    }
}
