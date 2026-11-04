
import { Router, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { isAuthorizedDiscordUser } from "./googleSheets.js";

const router = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const BASE_URL = process.env.BASE_URL;

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordTokenData {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}

interface DiscordMember {
  user?: {
    id?: string;
  };
  roles?: string[];
}

// OBTENER UN TOKEN VÁLIDO, RENOVÁNDOLO SI HA CADUCADO
async function getValidDiscordToken(req: Request): Promise<string | null> {
  const session = req.session as any;
  const oauth = session.discordOAuth;

  if (!oauth?.accessToken) {
    return null;
  }

  // Si todavía tiene más de un minuto de validez, reutilizarlo.
  if (oauth.expiresAt && Date.now() < oauth.expiresAt - 60000) {
    return oauth.accessToken;
  }

  if (!oauth.refreshToken || !CLIENT_ID || !CLIENT_SECRET) {
    return null;
  }

  const refreshResponse = await fetch(
    `${DISCORD_API}/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: oauth.refreshToken
      })
    }
  );

  if (!refreshResponse.ok) {
    console.error(
      "No se pudo renovar el token de Discord:",
      refreshResponse.status
    );

    return null;
  }

  const refreshed = await refreshResponse.json() as DiscordTokenData;

  if (!refreshed.access_token) {
    return null;
  }

  // Discord puede devolver un nuevo refresh token.
  session.discordOAuth = {
    accessToken: refreshed.access_token,
    tokenType: refreshed.token_type || "Bearer",
    refreshToken: refreshed.refresh_token || oauth.refreshToken,
    expiresAt: Date.now() + (Number(refreshed.expires_in) || 604800) * 1000
  };

  await new Promise<void>((resolve, reject) => {
    req.session.save(error => {
      if (error) reject(error);
      else resolve();
    });
  });

  return refreshed.access_token;
}

// INICIAR AUTENTICACIÓN CON DISCORD
router.get("/discord", (req: Request, res: Response) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error("Falta configuración OAuth de Discord.");

    return res.status(500).send(
      "Configuración de Discord incompleta."
    );
  }

  const state = randomBytes(32).toString("hex");

  (req.session as any).oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.members.read",
    state
  });

  const authorizeUrl = new URL(
    "https://discord.com/oauth2/authorize"
  );

  authorizeUrl.search = params.toString();

  console.log("Iniciando autenticación con Discord.");

  return res.redirect(authorizeUrl.toString());
});

// RESPUESTA DE DISCORD
router.get("/discord/callback", async (req: Request, res: Response) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send(
        "Configuración de Discord incompleta."
      );
    }

    const code = req.query.code;
    const receivedState = req.query.state;
    const savedState = (req.session as any).oauthState;

    if (
      typeof code !== "string" ||
      typeof receivedState !== "string" ||
      typeof savedState !== "string"
    ) {
      console.error("Callback OAuth incompleto.");

      return res.status(400).send(
        "Autorización incompleta."
      );
    }

    const receivedBuffer = Buffer.from(receivedState);
    const savedBuffer = Buffer.from(savedState);

    if (
      receivedBuffer.length !== savedBuffer.length ||
      !timingSafeEqual(receivedBuffer, savedBuffer)
    ) {
      return res.status(403).send(
        "Estado de autorización no válido."
      );
    }

    delete (req.session as any).oauthState;

    // INTERCAMBIAR EL CÓDIGO POR UN TOKEN
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
      const errorDetails = await tokenResponse.text();

      console.error("Error solicitando token:", {
        status: tokenResponse.status,
        response: errorDetails
      });

      throw new Error(
        "Discord rechazó el intercambio de autorización."
      );
    }

    const tokenData = await tokenResponse.json() as DiscordTokenData;

    if (!tokenData.access_token) {
      throw new Error(
        "Discord no devolvió un token de acceso."
      );
    }

    // OBTENER LOS DATOS DEL USUARIO
    const userResponse = await fetch(
      `${DISCORD_API}/users/@me`,
      {
        headers: {
          Authorization:
            `${tokenData.token_type || "Bearer"} ${tokenData.access_token}`
        }
      }
    );

    if (!userResponse.ok) {
      throw new Error(
        "No se pudo obtener el usuario de Discord."
      );
    }

    const discordUser = await userResponse.json() as {
      id?: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    if (!discordUser.id) {
      throw new Error(
        "Discord no devolvió un ID de usuario."
      );
    }

    console.log("Usuario de Discord identificado.");

    // COMPROBAR AUTORIZACIÓN EN GOOGLE SHEETS
    const authorized = await isAuthorizedDiscordUser(
      discordUser.id
    );

    if (!authorized) {
      console.log(
        "Usuario sin autorización en Google Sheets."
      );

      return res.status(403).send(
        "Tu cuenta de Discord no está autorizada para acceder a WEBLINEGT."
      );
    }

    // CREAR SESIÓN
    req.session.regenerate((error) => {
      if (error) {
        console.error("Error creando sesión:", error);

        return res.status(500).send(
          "No se pudo crear la sesión."
        );
      }

      const session = req.session as any;

      session.user = {
        id: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.global_name,
        avatar: discordUser.avatar
      };

      // TOKEN PRIVADO: SOLO SE GUARDA EN EL SERVIDOR
      session.discordOAuth = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || "Bearer",
        refreshToken: tokenData.refresh_token || null,
        expiresAt:
          Date.now() + (Number(tokenData.expires_in) || 604800) * 1000
      };

      req.session.cookie.maxAge =
        7 * 24 * 60 * 60 * 1000;

      req.session.save((saveError) => {
        if (saveError) {
          console.error(
            "Error guardando sesión:",
            saveError
          );

          return res.status(500).send(
            "No se pudo guardar la sesión."
          );
        }

        console.log("Sesión creada correctamente.");

        return res.redirect(BASE_URL || "/");
      });
    });

  } catch (error) {
    console.error(
      "Error en autenticación Discord:",
      error
    );

    return res.status(500).send(
      "Error durante la autenticación."
    );
  }
});

// CONSULTAR LOS ROLES DEL USUARIO EN UN SERVIDOR
router.get(
  "/discord/roles/:guildId",
  async (req: Request, res: Response) => {
    try {
      const session = req.session as any;

      if (!session.user?.id) {
        return res.status(401).json({
          error: "No has iniciado sesión."
        });
      }

      const guildId = req.params.guildId;

      if (!/^\d{17,20}$/.test(guildId)) {
        return res.status(400).json({
          error: "Identificador de servidor no válido."
        });
      }

      const accessToken = await getValidDiscordToken(req);

      if (!accessToken) {
        return res.status(401).json({
          error: "La autorización de Discord ha caducado. Inicia sesión de nuevo."
        });
      }

      const memberResponse = await fetch(
        `${DISCORD_API}/users/@me/guilds/${guildId}/member`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (memberResponse.status === 404) {
        return res.status(403).json({
          error: "No perteneces a este servidor de Discord."
        });
      }

      if (!memberResponse.ok) {
        const details = await memberResponse.text();

        console.error("Error consultando roles:", {
          status: memberResponse.status,
          response: details
        });

        return res.status(502).json({
          error: "No se pudieron consultar los roles de Discord."
        });
      }

      const member = await memberResponse.json() as DiscordMember;

      // Comprobar que Discord devuelve al mismo usuario de la sesión.
      if (member.user?.id && member.user.id !== session.user.id) {
        return res.status(403).json({
          error: "La identidad de Discord no coincide."
        });
      }

      return res.json({
        userId: session.user.id,
        roles: Array.isArray(member.roles) ? member.roles : []
      });

    } catch (error) {
      console.error(
        "Error consultando roles de Discord:",
        error
      );

      return res.status(500).json({
        error: "Error interno consultando los roles."
      });
    }
  }
);

// CERRAR SESIÓN
router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(
        "Error cerrando sesión:",
        error
      );

      return res.status(500).send(
        "No se pudo cerrar la sesión."
      );
    }

    res.clearCookie("weblinegt.sid");

    return res.redirect("/");
  });
});

export default router;
