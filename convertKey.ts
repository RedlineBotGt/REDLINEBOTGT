import { Buffer } from 'buffer';

// Pega tu clave privada entera aquí dentro de las comillas invertidas (`...`)
// Tal cual la tengas guardada o en tu archivo .env local
const rawKey = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDFV4j36m6s49+8\nTDbuoK83rGCkV/G3gb94LWRTV8rgDXC82MJkxxzxI6Qj4MQPug3fU3zJ2caHJvWd\nX0LhuT/5nrwpjbYqWsxVi0eWTyVugowlBOr/lxbnC+SVXFugLgQ8s7Yal4urCjjr\nDNP1QKiIqnCgWE1OK9zbjVcV4sYb5FjS5pdUEW4uX1i4IxEtrqA4xq6z2lEe/swT\nltm9UTyY4Lz5mrYCf3s3s5BxxehlEjgxDnDmGFplIPPSlvZo16BLZ0kpLMuipYGy\nj4b/q6KWgMnsYW2kIJ2H2ajIZI4xu+wKWp6qu18JExq7DzH2o2Y0DDEMFmd4C7lf\nulDid60LAgMBAAECggEAAa4IzpNxW5qZPPVcU2mM4RPosePWSdZnTgpQnAtommxx\nzG3/IAUFFLdVwHyy6kj0whL5MTpoRjfYR+yGmXzBq3Sxp3n2783k/lEnmLZaKRWX\nqr1FT6FDOBzNiZXPrZb69GLs1aSUmaV1KcbIk+iI/jHkJ86YniG7DWvr6mK17QBw\nxxzz8fgkIE8sTbzXQ2Gwh/5ji7NcZzOVnyuPScVvf9V2bR8Wvl21SOqM7RwuvB2U\nKwj41rYdgPj9nSxGY7JbC671jub+2JWnAiRhJYLjt3+PDbHv7cv2CzZTuFQAkp0q\noOEe7I18vCVYKo8X9YAKXtr2XooVnvwTNVIvzWToAQKBgQDhgSOI06SQWi1JX6+8\nE8URkRgdT+VJG2AjdUIwPmOkfAP3qTg6QM+2OXc0E+IrpiRVNZryLx4ocm1vNdUg\nDK+AOtcq8lV0jA/diHBMUtFWytsGIk0ZZRjOIhQduirOVaQQSJ8HZ3/gB8cPlSVs\necYJgsJZjNo7NZGI1uTOoAEZQQKBgQDgB2w9Afn6QctarNnJfwsBJ+7Hf6AO6iwb\n2f67HkpB/jIBUE0hZBw6XcK8N3IgOA4P+lDsA9EaIx3lJitmR/2guEUljw+vY1O/\nbNmujKcSKhVMJaXRL8jcv4tLjOJz4/vBPg3qEvOvcuHOAclJ/N1r4jys9P4OpRBv\nCYo5hNSHSwKBgQDUrilHeOSySHqBwz9JERRCNygZLStAwhLwHj1ops7vaQ+M2wpu\n1oWQha5JbZ9YL4AA5WfXllzJJPLVel4hthUnyVb56Eh0fUzRUUcolMtfIj9kD6HL\nm6/Dahyy1MxegiMUQInMP+846dzyc2YyYr9GZQ7Lyq5gPWufNZ3iysF+gQKBgBO4\nc423Q9MEwarctlsnZMeYRUuob2WAtZtKCENeejju8GXvNKrwzg9RO5gn5VLyvEIp\nzb/I4jpDxxjp0D4zrh7cubGBs2bD/pZGNa9I0Fgn/jHyynLsmujbr55Z64E6G2o6\nVS06t9rE6R2iSJ7LtI4Pnzm2YzrUyuqLU3CWwcKbAoGAYdPsAXeByBsQbEoOzy65\nQQpndEF28AvLU8drfhUAbloM0XJCfQ2X6f9cF/d0pVgdwgfkNo5MBIPHULkXZajU\nKN/6XRKClJe4Snjxh2xVyhiPXQ5X4eMVy56jqIoPL7eQNU9q8KuVtyQUOgH7M48l\nDGqI4fFrZeI2talkqXgeBcM=\n-----END PRIVATE KEY-----`;

const base64Key = Buffer.from(rawKey).toString('base64');

console.log('\n================ CLAVE EN BASE64 ================\n');
console.log(base64Key);
console.log('\n=================================================\n');
