import { 
    handleDashReporteButton 
} from './dashReporteHandler'; // O el nombre con el que guardaste el handler de reportes

import { 
    handleDashDefensaButton 
} from './dashDefensaHandler'; // O el nombre del handler de defensas

import { 
    handleDashVeredictoButton, 
    handleDashVeredictoChannelSelect, 
    handleDashVeredictoRoleSelect 
} from './veredictoHandler'; // O el nombre del handler de veredictos

import { 
    handleReportButton, 
    handleReportModalSubmit 
} from './reportModal'; // O el archivo del modal de reporte

import { 
    handleDefensaButton, 
    handleDefensaModalSubmit 
} from './defensaModal'; // O el archivo del modal de defensa

import { 
    handleVeredictoModalSubmit 
} from './veredictoModal'; // O el archivo del modal de veredicto

export async function handleComisariosInteraction(interaction: any): Promise<boolean> {
    try {
        // 1. Botones de Configuración desde el /dash
        if (interaction.isButton()) {
            if (interaction.customId === 'dash_btn_setup_reporte') {
                return await handleDashReporteButton(interaction);
            }
            if (interaction.customId === 'dash_btn_setup_defensa') {
                return await handleDashDefensaButton(interaction);
            }
            if (interaction.customId === 'dash_btn_veredicto') {
                return await handleDashVeredictoButton(interaction);
            }
            // 2. Botones públicos para abrir formularios de usuario
            if (interaction.customId === 'btn_abrir_reporte') {
                return await handleReportButton(interaction);
            }
            if (interaction.customId === 'btn_abrir_defensa') {
                return await handleDefensaButton(interaction);
            }
        }

        // 3. Menús desplegables de Veredictos
        if (interaction.isChannelSelectMenu() && interaction.customId === 'dash_select_verd_channel') {
            return await handleDashVeredictoChannelSelect(interaction);
        }
        if (interaction.isRoleSelectMenu() && interaction.customId === 'dash_select_verd_role') {
            return await handleDashVeredictoRoleSelect(interaction);
        }

        // 4. Envíos de Modales (Reportes, Defensas y Veredictos)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_envio_reporte') {
                return await handleReportModalSubmit(interaction);
            }
            if (interaction.customId === 'modal_envio_defensa') {
                return await handleDefensaModalSubmit(interaction);
            }
            if (interaction.customId.startsWith('modal_veredicto_')) {
                return await handleVeredictoModalSubmit(interaction);
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de comisarios:', error);
        return false;
    }
}
