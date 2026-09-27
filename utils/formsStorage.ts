import fs from 'fs';
import path from 'path';

// Ruta donde se guardará el archivo JSON
const filePath = path.join(process.cwd(), 'forms.json');

// Estructura de un formulario
export interface FormularioData {
    titulo: string;
    canalRespuestas: string;
    preguntas: string[];
}

// 1. Obtener todos los formularios guardados
export function obtenerFormularios(): Record<string, FormularioData> {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error al leer forms.json:', error);
        return {};
    }
}

// 2. Guardar o actualizar un formulario (usando el Título como clave única)
export function guardarFormulario(titulo: string, canalRespuestas: string, preguntas: string[]) {
    const formularios = obtenerFormularios();

    formularios[titulo] = {
        titulo,
        canalRespuestas,
        preguntas
    };

    fs.writeFileSync(filePath, JSON.stringify(formularios, null, 2), 'utf-8');
}

// 3. Buscar un formulario específico por su título
export function obtenerFormularioPorTitulo(titulo: string): FormularioData | null {
    const formularios = obtenerFormularios();
    return formularios[titulo] || null;
}