import { Buffer } from 'buffer';

// Pega tu clave privada entera aquí dentro de las comillas invertidas (`...`)
// Tal cual la tengas guardada o en tu archivo .env local
const rawKey = `PEGAR_AQUÍ_TU_CLAVE_PRIVADA_ENTERA`;

const base64Key = Buffer.from(rawKey).toString('base64');

console.log('\n================ CLAVE EN BASE64 ================\n');
console.log(base64Key);
console.log('\n=================================================\n');
