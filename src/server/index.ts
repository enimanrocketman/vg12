import "dotenv/config";

import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";

import {
  createAuthToken,
  isValidPassword,
  requireAuth,
} from "./auth.js";
import { RoastGenerationError, roastClaim } from "./roast-service.js";
import {
  apiErrorSchema,
  authRequestSchema,
  authResponseSchema,
  roastRequestSchema,
  roastResponseSchema,
} from "../shared/schemas.js";

const app = express();
const port = Number(process.env.PORT ?? 3101);
const __dirname = dirname(fileURLToPath(import.meta.url));
const builtClientDist = join(__dirname, "../../client");
const devClientDist = join(__dirname, "../client");
const clientDist = existsSync(join(builtClientDist, "index.html"))
  ? builtClientDist
  : devClientDist;

app.use(cors());
app.use(express.json({ limit: "8kb" }));

app.post("/api/auth", (request, response) => {
  const payload = authRequestSchema.safeParse(request.body);

  if (!payload.success) {
    response.status(400).json(
      apiErrorSchema.parse({
        error: payload.error.issues[0]?.message ?? "Invalid request.",
      }),
    );
    return;
  }

  if (!isValidPassword(payload.data.password)) {
    response.status(401).json(apiErrorSchema.parse({ error: "Access denied." }));
    return;
  }

  response.json(authResponseSchema.parse({ token: createAuthToken() }));
});

app.get("/api/health", requireAuth, (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/roast", requireAuth, async (request, response, next) => {
  try {
    const payload = roastRequestSchema.parse(request.body);
    const roast = await roastClaim(payload.claim, payload.sessionId);

    response.json(roastResponseSchema.parse(roast));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(clientDist));

app.get(/^(?!\/api).*/, (_request, response) => {
  response.sendFile(join(clientDist, "index.html"));
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json(
      apiErrorSchema.parse({
        error: error.issues[0]?.message ?? "Invalid request.",
      }),
    );
    return;
  }

  if (error instanceof RoastGenerationError) {
    response
      .status(error.statusCode)
      .json(apiErrorSchema.parse({ error: error.message }));
    return;
  }

  console.error(error);
  response.status(500).json(apiErrorSchema.parse({ error: "Agent misfired." }));
};

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set PORT to a free port.`);
    process.exit(1);
  }

  throw error;
});
