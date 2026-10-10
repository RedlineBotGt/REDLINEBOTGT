import { Client, GatewayIntentBits, Collection, Interaction, Message } from 'discord.js';
import { MongoClient, Collection as MongoCollection } from 'mongodb';
import { handleGlobalInteraction } from './generalinteraction';
import { setupNicknameSystem } from './dashadmin/nickname/nicknamemanager';
import { setupWelcomeSystem } from './dashadmin/welcome/welcomemanager'; // ➔ Sistema de bienvenidas y despedidas
import { setupAvisosSystem } from './dashadmin/avisos/avisosmanager'; // ➔ Sistema de avisos y logs
import { setupPollSystem, handleEncuestaReactionAdd } from './dashadmin/encuestas/encuestasmanager'; // ➔ Sistema de Encuestas
import { handleClubMessage } from './dashadmin/club/clubactions'; // ➔ Importación del escuchador de mensajes GT Club
import express from 'express';

// 🌐 Configuración del servidor Express para satisfacer el requisito de puertos de Render (Plan Gratuito)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🚗 REDLINE GT Bot está en línea y funcionando perfectamente.');
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor web HTTP activo en el puerto ${PORT}`);
});

// 📌 Importación de comandos Slash principales
import * as dashCommand from './commands/dash';
import * as dashStaffCommand from './commands/dashstaff';
import * as dadoCommand from './commands/dado';
import * as borrarCommand from './commands/borrar';
import * as msnCommand from './commands/msn'; // ➔ Comando msn
import * as draftCommand from './commands/draft'; // ➔ Comando draft
import * as listaCommand from './commands/lista'; // ➔ Comando Lista
import * as clubCommand from './commands/club'; // ➔ Comando Club
import * as clubclasCommand from './commands/clubclas'; // ➔ Comando Club Clasificación General
import * as transCommand from './commands/trans'; // ➔ Comando Traducción
import * as dashSheetsCommand from './dashsheet/dashsheet';
import * as dashAdminCommand from './dashadmin/dashadmin'; // ➔ Comando dashadmin

/**
 * 📦 Conexión centralizada y segura a la colección de eventos de MongoDB
 */
let cachedCollection: MongoCollection | null = null;

export async function getEventsCollection(): Promise<MongoCollection> {
    if (cachedCollection) return cachedCollection;

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.
