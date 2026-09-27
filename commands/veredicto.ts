import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('veredicto')
    .setDescription('Emite un veredicto oficial de carrera (Solo Staff/Comisarios)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages); // Restringe el uso por defecto a moderadores/administradores

export async function execute(interaction: ChatInputCommandInteraction) {
    // Verificación de seguridad extra por código
    if (!interaction.memberPermissions || (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator))) {
        await interaction.reply({
            content: '❌ No tienes permisos suficientes para ejecutar este comando.',
            ephemeral: true
        });
        return;
    }

    // Aquí iniciaremos el flujo con los desplegables de canal y rol
    await interaction.reply({
        content: '⚙️ Iniciando sistema de veredictos...',
        ephemeral: true
    });
}
