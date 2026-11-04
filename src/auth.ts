import { Router, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { isAuthorizedDiscordUser } from "./googleSheets.js";

const router = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;

const BASE_URL = process.env.BASE_URL!;

const DISCORD_API = "https://discord.com/api/v10";

router.get("/discord", (req: Request, res: Response) => {
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
return res.status(500).send("Configuración de Discord incompleta.");
}

const state = randomBytes(32).toString("hex");

(req.session as any).oauthState = state;

const params = new URLSearchParams({
client_id: CLIENT_ID,
redirect_uri: REDIRECT_URI,
response_type: "code",
scope: "identify",
state
});

res.redirect(
"https://discord.com/oauth2/authorize?${params.toString()}"
);
});

router.get("/discord/callback", async (req: Request, res: Response) => {
try {
const code = req.query.code;
const receivedState = req.query.state;
const savedState = (req.session as any).oauthState;

if (
  typeof code !== "string" ||
  typeof receivedState !== "string" ||
  typeof savedState !== "string"
) {
  return res.status(400).send("Autorización incompleta.");
}

const receivedBuffer = Buffer.from(receivedState);
const savedBuffer = Buffer.from(savedState);

if (
  receivedBuffer.length !== savedBuffer.length ||
  !timingSafeEqual(receivedBuffer, savedBuffer)
) {
  return res.status(403).send("Estado de autorización no válido.");
}

delete (req.session as any).oauthState;

const tokenResponse = await fetch(
  `${DISCORD_API}/oauth2/token`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI
    })
  }
);

if (!tokenResponse.ok) {
  throw new Error("Discord rechazó el intercambio de autorización.");
}

const tokenData = await tokenResponse.json() as {
  access_token?: string;
  token_type?: string;
};

if (!tokenData.access_token) {
  throw new Error("Discord no devolvió un token de acceso.");
}

const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
  headers: {
    Authorization: `${tokenData.token_type || "Bearer"} ${tokenData.access_token}`
  }
});

if (!userResponse.ok) {
  throw new Error("No se pudo obtener el usuario de Discord.");
}

const discordUser = await userResponse.json() as {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

if (!discordUser.id) {
  throw new Error("Discord no devolvió un ID de usuario.");
}

const authorized = await isAuthorizedDiscordUser(discordUser.id);

if (!authorized) {
  return res.status(403).send(
    "Tu cuenta de Discord no está autorizada para acceder a WEBLINEGT."
  );
}

req.session.regenerate((error) => {
  if (error) {
    console.error("Error creando sesión:", error);
    return res.status(500).send("No se pudo crear la sesión.");
  }

  (req.session as any).user = {
    id: discordUser.id,
    username: discordUser.username,
    globalName: discordUser.global_name,
    avatar: discordUser.avatar
  };

  req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;

  req.session.save((saveError) => {
    if (saveError) {
      console.error("Error guardando sesión:", saveError);
      return res.status(500).send("No se pudo guardar la sesión.");
    }

    return res.redirect(BASE_URL);
  });
});

} catch (error) {
console.error("Error en autenticación Discord:", error);
return res.status(500).send("Error durante la autenticación.");
}
});

router.post("/logout", (req: Request, res: Response) => {
req.session.destroy((error) => {
if (error) {
return res.status(500).send("No se pudo cerrar la sesión.");
}

res.clearCookie("weblinegt.sid");
return res.redirect("/");

});
});

export default router;