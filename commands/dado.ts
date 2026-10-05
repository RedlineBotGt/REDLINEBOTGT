import { 
    ChatInputCommandInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ModalSubmitInteraction, 
    MessageFlags 
} from 'discord.js';

// 1. Ejecuta el comando /dado y abre el modal preguntando las caras
export async function execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_dado_lanza')
        .setTitle('🎲 Lanzar Dado');

    const inputCaras = new TextInputBuilder()
        .setCustomId('dado_caras_input')
        .setLabel('¿Cuántas caras tiene el dado?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 6, 20, 100...')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputCaras)
    );

    await interaction.showModal(modal);
}

// 2. Procesa la respuesta y genera el número aleatorio
export async function handleDadoModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_dado_lanza') return false;

    const carasStr = interaction.fields.getTextInputValue('dado_caras_input').trim();
    const caras = parseInt(carasStr, 10);

    if (isNaN(caras) || caras <= 1) {
        await interaction.reply({
            content: '❌ Por favor, introduce un número de caras válido (mayor que 1).',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    // Número al azar entre 1 y el número de caras indicado
    const resultado = Math.floor(Math.random() * caras) + 1;

    // Se publica para que todos en el canal puedan ver la tirada
    await interaction.reply({
        content: `🎲 **¡Lanzamiento de Dado!**\n> Dado de **${caras} caras**: Ha salido el **${resultado}** 🎯`
    });

    return true;
}
