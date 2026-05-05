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
  addQAPair,
  deleteSession,
  cleanupExpiredSessions,
} from "./session.js";

import {
  detectDomain,
  getNextQuestion,
  buildEnrichedPrompt,
  isStopSignal,
} from "./clarifier.js";

// ─── MCP Server setup ────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "prompt-clarifier",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "clarify",
        description:
          "Affine et clarifie un prompt utilisateur avant de l'envoyer au LLM. " +
          "L'agent pose des questions ciblées une par une pour comprendre exactement ce que l'utilisateur veut créer. " +
          "Réponds aux questions ou écris 'go' pour générer le prompt enrichi avec ce qui a été collecté. " +
          "Utilise cet outil quand tu veux un résultat précis du premier coup sans ping-pong.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Ton prompt initial ou ta réponse à la question précédente de l'agent.",
            },
            session_id: {
              type: "string",
              description:
                "ID de session retourné par l'appel précédent. Omets ce champ pour démarrer une nouvelle session.",
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

// ─── Tool execution ──────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "clarify") {
    return {
      content: [{ type: "text", text: "Outil inconnu." }],
      isError: true,
    };
  }

  const { prompt, session_id } = request.params.arguments as {
    prompt: string;
    session_id?: string;
  };

  // ── Cas 1 : nouvelle session ────────────────────────────────────────────
  if (!session_id) {
    const domain = detectDomain(prompt);
    const session = createSession(prompt, domain);
    const nextQuestion = getNextQuestion(session);

    if (!nextQuestion) {
      // Aucune question à poser (ne devrait pas arriver)
      const enriched = buildEnrichedPrompt(session);
      deleteSession(session.id);
      return {
        content: [{ type: "text", text: enriched }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text:
            `📋 **Prompt reçu** : "${prompt}"\n` +
            `🔍 **Domaine détecté** : ${domain}\n\n` +
            `Pour que le LLM te donne exactement ce que tu veux du premier coup, ` +
            `je vais te poser quelques questions. Tu peux répondre normalement, ` +
            `ou écrire **"go"** à tout moment pour que je génère le prompt enrichi avec ce que j'ai.\n\n` +
            `**Question 1 :** ${nextQuestion}\n\n` +
            `_(session_id: ${session.id})_`,
        },
      ],
    };
  }

  // ── Cas 2 : session existante ───────────────────────────────────────────
  const session = loadSession(session_id);

  if (!session) {
    return {
      content: [
        {
          type: "text",
          text:
            "⚠️ Session expirée ou introuvable. Lance un nouvel appel à `clarify` avec ton prompt initial pour recommencer.",
        },
      ],
      isError: true,
    };
  }

  // Récupère la dernière question posée
  const questions = getQuestionBank(session.detectedDomain);
  const lastQuestionIndex = session.history.length;
  const lastQuestion = questions[lastQuestionIndex] ?? "Question précédente";

  // Enregistre la réponse de l'utilisateur
  addQAPair(session, lastQuestion, prompt);

  // Vérifie si l'utilisateur veut arrêter
  if (isStopSignal(prompt)) {
    const enriched = buildEnrichedPrompt(session);
    deleteSession(session.id);
    return {
      content: [
        {
          type: "text",
          text:
            `✅ **Prompt enrichi généré !**\n\n` +
            `Copie ce prompt et envoie-le directement à ton LLM :\n\n` +
            `---\n\n${enriched}\n\n---`,
        },
      ],
    };
  }

  // Pose la prochaine question
  const nextQuestion = getNextQuestion(session);

  if (!nextQuestion) {
    // Plus de questions → on génère
    const enriched = buildEnrichedPrompt(session);
    deleteSession(session.id);
    return {
      content: [
        {
          type: "text",
          text:
            `✅ **Prompt enrichi généré !**\n\n` +
            `Copie ce prompt et envoie-le directement à ton LLM :\n\n` +
            `---\n\n${enriched}\n\n---`,
        },
      ],
    };
  }

  const questionNumber = session.history.length + 1;

  return {
    content: [
      {
        type: "text",
        text:
          `**Question ${questionNumber} :** ${nextQuestion}\n\n` +
          `_(ou écris **"go"** pour générer le prompt avec ce que j'ai déjà)_\n\n` +
          `_(session_id: ${session_id})_`,
      },
    ],
  };
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getQuestionBank(domain: string): string[] {
  // On réimporte les questions depuis clarifier pour éviter la duplication
  // En pratique, clarifier.ts expose getNextQuestion qui gère ça
  // Cette fonction est un fallback pour récupérer la question précédente
  const banks: Record<string, string[]> = {
    ml_onnx: [
      "Quel runtime va exécuter ce modèle ? (ex: ONNX Runtime, TensorFlow, PyTorch, OpenCV...)",
      "Quels types d'opérations le modèle doit-il contenir ? (ex: Conv2D, LSTM, Linear, Attention...)",
      "Quel format et quelle forme pour les tenseurs d'entrée ? (ex: float32 [batch, 3, 224, 224])",
      "Quel format et quelle forme pour les tenseurs de sortie ?",
      "Le modèle sera-t-il utilisé pour de l'inférence seule, ou aussi pour du fine-tuning ?",
      "Y a-t-il des contraintes de version ONNX opset ? (ex: opset 11, 13, 17...)",
    ],
    general: [
      "Quel est l'objectif final de ce que tu veux créer ?",
      "Dans quel langage ou environnement téchnique travailles-tu ?",
      "Y a-t-il des contraintes spécifiques à respecter ? (performance, compatibilité, style...)",
      "Ce code s'intègre dans un projet existant ? Si oui, quel contexte ?",
      "Y a-t-il des cas limites ou comportements particuliers à gérer ?",
    ],
  };
  return banks[domain] ?? banks["general"];
}

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  cleanupExpiredSessions();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Le serveur MCP communique via stdio — pas de console.log ici
  // Les logs iraient dans stderr si nécessaire
  process.stderr.write("Prompt Clarifier MCP server started\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
