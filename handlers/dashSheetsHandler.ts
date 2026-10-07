// 🛡️ Manejador seguro para la selección del canal
export async function handleSheetsChannelSelect(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.guild) return;

    // ⚡ DEFERIR INMEDIATAMENTE PARA EVITAR EL TIMEOUT
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
        } catch (err) {
            console.error('❌ Error al diferir la interacción del canal:', err);
            return;
        }
    }

    try {
        const userId = interaction.user.id;
        const channelId = interaction.values[0];

        const state = userSheetState.get(userId) || { content: '', title: '' };
        userSheetState.set(userId, { ...state, channelId });

        await interaction.followUp({ content: '📁 Canal seleccionado correctamente.', flags: [MessageFlags.Ephemeral] });
    } catch (err) {
        console.error('❌ Error al seleccionar el canal:', err);
    }
}

// 🛡️ Manejador seguro para la selección del rol
export async function handleSheetsRoleSelect(interaction: RoleSelectMenuInteraction) {
    if (!interaction.guild) return;

    // ⚡ DEFERIR INMEDIATAMENTE PARA EVITAR EL TIMEOUT
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
        } catch (err) {
            console.error('❌ Error al diferir la interacción del rol:', err);
            return;
        }
    }

    try {
        const userId = interaction.user.id;
        const roleId = interaction.values[0];

        const state = userSheetState.get(userId) || { content: '', title: '' };
        userSheetState.set(userId, { ...state, roleId });

        await interaction.followUp({ content: '🔔 Rol seleccionado correctamente.', flags: [MessageFlags.Ephemeral] });
    } catch (err) {
        console.error('❌ Error al seleccionar el rol:', err);
    }
}
