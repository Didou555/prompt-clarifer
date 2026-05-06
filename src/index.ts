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
import {
  isGoSignal,
  buildClarifySystemPrompt,
  buildEnrichedPrompt,
  detectDomain,
} from "./clarifier.js";

const server = new Server(
  { name: "prompt-clarifier", version: "3.0.2" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "clarify",
      description:
        "Returns a system prompt and user message that instruct the IDE's own LLM to ask targeted clarifying questions one at a time, then produces an enriched prompt once enough context is gathered. The MCP server manages session state only — no LLM calls are made server-side.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The initial user prompt (required on first call).",
          },
          session_id: {
            type: "string",
            description: "Session ID returned by a previous call (to continue the conversation).",
          },
          answer: {
            type: "string",
            description: "The user's answer to the last clarifying question.",
          },
        },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "clarify") {
    return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }] };
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
        content: [{ type: "text", text: "Error: `prompt` is required to start a session." }],
      };
    }
    const session = createSession(args.prompt);
    const domain = detectDomain(args.prompt);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            session_id: session.id,
            system_prompt: buildClarifySystemPrompt(args.prompt, [], domain),
            user_message: `Here is the user prompt to clarify: ${args.prompt}`,
            instructions:
              "Ask the first clarifying question now. Include the session_id in your response so the user knows to pass it back.",
          }),
        },
      ],
    };
  }

  // --- Continue existing session ---
  const session = loadSession(args.session_id);
  if (!session) {
    return {
      content: [{ type: "text", text: `Session not found: ${args.session_id}` }],
    };
  }

  const answer = args.answer ?? "";

  // Save the answer to session
  if (answer.trim()) {
    session.qaHistory.push({ question: "", answer });
    saveSession(session);
  }

  // Go signal or max questions reached → return final enriched prompt
  if (isGoSignal(answer) || session.qaHistory.length >= 5) {
    const enriched = buildEnrichedPrompt(session.initialPrompt, session.qaHistory);
    deleteSession(session.id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ final_prompt: enriched }),
        },
      ],
    };
  }

  const domain = detectDomain(session.initialPrompt);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          session_id: session.id,
          system_prompt: buildClarifySystemPrompt(session.initialPrompt, session.qaHistory, domain),
          user_message: `The user answered: ${answer}. Ask the next question.`,
          qa_count: session.qaHistory.length,
        }),
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Prompt Clarifier MCP server v3.0.1 started (stdio)\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
