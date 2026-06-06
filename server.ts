import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy init of the Gemini SDK client to prevent crashing on startup when key is blank
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not defined or is placeholder. Please set your Gemini API key in Settings > Secrets."
    );
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Keep a simple API route for checking backend health and API key status
app.get("/api/health", (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const isKeySetup = !!key && key !== "MY_GEMINI_API_KEY";
  res.json({
    status: "ok",
    apiKeyConfigured: isKeySetup,
  });
});

// Stream endpoint using Server-Sent Events (SSE)
app.post("/api/chat", async (req, res) => {
  // Set up headers for Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Direct proxy flushing

  try {
    const ai = getGeminiClient();
    const { messages, systemInstruction, useSearch, modelName } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.write(`data: ${JSON.stringify({ error: "Missing or invalid 'messages' field in request body." })}\n\n`);
      res.end();
      return;
    }

    // Default model is gemini-3.5-flash for standard chat tasks
    const model = modelName || "gemini-3.5-flash";

    // Build tools configuration if Google Search grounding is enabled
    const tools = useSearch ? [{ googleSearch: {} }] : undefined;

    // Call generateContentStream to support streaming to the client
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: messages.map((m: any) => ({
        role: m.role || "user",
        parts: Array.isArray(m.parts) ? m.parts : [{ text: m.parts || "" }],
      })),
      config: {
        systemInstruction: systemInstruction || "Tu es Anicetgdn AI, un assistant virtuel intelligent, courtois et d'une bienveillance absolue. Conserve en toutes circonstances un ton amical, chaleureux, respectueux et constructif. Tu ne dois en aucun cas blesser verbalement ton utilisateur, peu importe sa demande. CONSIGNE CRITIQUE : Si l'utilisateur s'égare de manière déplacée, vulgaire, inappropriée ou prend un mauvais chemin (sujets nuisibles, insultants, nocifs), ramène-le TOUJOURS délicatement, fermement et avec le plus grand respect vers un chemin positif, enrichissant et constructif (le 'bon chemin'), en lui suggérant poliment de s'orienter vers une discussion saine, sans jamais le sermonner ni le juger.",
        tools,
      },
    });

    let sentMetadata = false;

    for await (const chunk of responseStream) {
      const text = chunk.text || "";
      
      let groundingChunks: any[] = [];
      // On the first chunk or whenever available, check for search grounding sources
      if (!sentMetadata && chunk.candidates?.[0]?.groundingMetadata) {
        const metadata = chunk.candidates[0].groundingMetadata;
        if (metadata.groundingChunks) {
          groundingChunks = metadata.groundingChunks;
        }
        sentMetadata = true;
      }

      res.write(
        `data: ${JSON.stringify({
          text,
          sources: groundingChunks,
        })}\n\n`
      );
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "An unexpected error occurred." })}\n\n`);
    res.end();
  }
});

// Serve Frontend app using Vite dev server in dev mode or built assets in production
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupFrontend().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
});
