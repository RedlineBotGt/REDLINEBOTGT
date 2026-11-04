import { Router, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { isAuthorizedDiscordUser } from "./googleSheets.js";

const router = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const BASE_URL = process.env.BASE_URL;

const DISCORD_API = "https://discord.com/api/v10";

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
    scope: "identify",
    state
  });

  // CONSTRUIR LA URL DE AUTORIZACIÓN
  const authorizeUrl = new URL(
    "https://discord.com/oauth2/authorize"
  );

  authorizeUrl.search = params.toString();

  console.log("Iniciando autenticación con Discord.");
  console.log("URL OAuth generada:", authorizeUrl.toString());

  return res.redirect(authorizeUrl.toString());
});

// RESPUESTA DE DISCORD
router.get("/discord/callback", async (req: Request, res: Response) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      console.error("Falta configuración OAuth de Discord.");
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
      console.error("Callback incompleto:", {
        hasCode: typeof code === "string",
        hasState: typeof receivedState === "string",
        hasSavedState: typeof savedState === "string",
        discordError: req.query.error
      });

      return res.status(400).send("Autorización incompleta.");
    }

    const receivedBuffer = Buffer.from(receivedState);
    const savedBuffer = Buffer.from(savedState);

    if (
      receivedBuffer.length !== savedBuffer.length ||
      !timingSafeEqual(receivedBuffer, savedBuffer)
    ) {
      console.error("El estado OAuth no coincide.");
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

      console.error("Error de Discord al solicitar token:", {
        status: tokenResponse.status,
        response: errorDetails
      });

      throw new Error(
        "Discord rechazó el intercambio de autorización."
      );
    }

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      token_type?: string;
    };

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
      const errorDetails = await userResponse.text();

      console.error("Error obteniendo usuario de Discord:", {
        status: userResponse.status,
        response: errorDetails
      });

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

      (req.session as any).user = {
        id: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.global_name,
        avatar: discordUser.avatar
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