#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  createSession,
  loadSession,
  saveSession,
  deleteSession,
} from "./session.js";
import { isGoSignal, getNextQuestion, buildEnrichedPrompt } from "./clarifier.js";

const server = new Server(
  { name: "prompt-clarifier", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "clarify",
      description:
        "Affine un prompt utilisateur en posant des questions ciblées une par une, puis génère un prompt enrichi prêt à être exécuté par le LLM.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Le prompt initial de l'utilisateur (requis au premier appel).",
          },
          session_id: {
            type: "string",
            description: "ID de session retourné par un appel précédent (pour continuer la conversation).",
          },
          answer: {
            type: "string",
            description: "Réponse de l'utilisateur à la dernière question posée par l'agent.",
          },
        },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "clarify") {
    return { content: [{ type: "text", text: `Outil inconnu : ${request.params.name}` }] };
  }

  const args = request.params.arguments as {
    prompt?: string;
    session_id?: string;
    answer?: string;
  };

  // --- New session ---
  if (!args.session_id) {
    if (!args.prompt) {
      return {
        content: [{ type: "text", text: "Erreur : `prompt` est requis pour démarrer une session." }],
      };
    }
    const session = createSession(args.prompt);
    const firstQuestion = await getNextQuestion(session.initialPrompt, []);
    if (!firstQuestion) {
      deleteSession(session.id);
      return {
        content: [{ type: "text", text: buildEnrichedPrompt(session.initialPrompt, []) }],
      };
    }
    saveSession(session);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            session_id: session.id,
            question: firstQuestion,
            instructions:
              "Réponds à cette question, puis rappelle l'outil clarify avec session_id et answer. Dis 'go' pour générer immédiatement le prompt final.",
          }),
        },
      ],
    };
  }

  // --- Continue existing session ---
  const session = loadSession(args.session_id);
  if (!session) {
    return {
      content: [{ type: "text", text: `Session introuvable : ${args.session_id}` }],
    };
  }

  const answer = args.answer ?? "";

  // User said "go" → generate final prompt now
  if (isGoSignal(answer)) {
    const enriched = buildEnrichedPrompt(session.initialPrompt, session.qaHistory);
    deleteSession(session.id);
    return { content: [{ type: "text", text: enriched }] };
  }

  // Record the answer to the last question asked
  if (session.lastQuestion && answer.trim()) {
    session.qaHistory.push({ question: session.lastQuestion, answer });
  }

  // Ask Claude for the next question
  const nextQuestion = await getNextQuestion(session.initialPrompt, session.qaHistory);
  if (!nextQuestion) {
    const enriched = buildEnrichedPrompt(session.initialPrompt, session.qaHistory);
    deleteSession(session.id);
    return { content: [{ type: "text", text: enriched }] };
  }

  session.lastQuestion = nextQuestion;
  saveSession(session);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          session_id: session.id,
          question: nextQuestion,
          qa_so_far: session.qaHistory.length,
          instructions:
            "Réponds à cette question, puis rappelle l'outil clarify avec session_id et answer. Dis 'go' pour générer immédiatement le prompt final.",
        }),
      },
    ],
  };
});

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write("Erreur : ANTHROPIC_API_KEY non définie.\n");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Prompt Clarifier MCP server v2.0 started (stdio)\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
