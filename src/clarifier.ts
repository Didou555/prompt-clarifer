import { QA } from "./session.js";

const GO_KEYWORDS = [
  "go", "commence", "start", "c'est bon", "lance toi", "lance-toi",
  "démarre", "ok go", "assez", "enough", "proceed", "just do it",
];

export function isGoSignal(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return GO_KEYWORDS.some(
    (kw) =>
      normalized === kw ||
      normalized.startsWith(kw + " ") ||
      normalized.endsWith(" " + kw)
  );
}

export type Domain = "ml_onnx" | "ml_h2o" | "data_table" | "ml_general" | "general";

export function detectDomain(prompt: string): Domain {
  if (/onnx/i.test(prompt)) return "ml_onnx";
  if (/h2o|automl|gbm|mojo|pojo/i.test(prompt)) return "ml_h2o";
  if (/data.?table|schema|dataframe|column/i.test(prompt)) return "data_table";
  if (/machine.?learn|deep.?learn|neural|pytorch|tensorflow|sklearn|model|train|predict|classif|regress/i.test(prompt)) return "ml_general";
  return "general";
}

const KB_PREAMBLE = `Before asking your first question, use every connected MCP tool available to gather internal context:

1. If a Confluence or Atlassian MCP tool is available (e.g. mcp__Atlassian_Rovo__search, searchConfluenceUsingCql), search for pages related to the user's request — look for internal standards, architecture decisions, naming conventions, or processes relevant to the topic.
2. If a Jira MCP tool is available (e.g. searchJiraIssuesUsingJql), search for open issues or epics related to the topic to understand current constraints or in-progress work.
3. If a Figma MCP tool is available, look for design specs or component names related to the topic.
4. If any other knowledge base tool is connected (Notion, Linear, GitHub issues, etc.), query it for relevant documentation.

Use the results to ask questions that are specific to your organization's actual workflow, constraints, and standards — not generic questions. If no internal documentation is found, fall back to domain best practices.

Examples of what to search for depending on the detected domain:
- ONNX model → model validation process, opset standards, deployment pipeline
- H2O model → AutoML configuration, MOJO export standards, validation criteria
- Data table → schema conventions, naming standards, data governance rules
- General coding → architecture guidelines, code review standards, tech stack
- General request → any internal process or standard related to the topic`;

const DOMAIN_ANGLES: Record<Domain, string> = {
  ml_onnx:     "Focus on: runtime, opset version, input/output tensor shapes, operators needed.",
  ml_h2o:      "Focus on: algorithm type (GBM/DRF/AutoML), target variable, feature types, export format (MOJO/POJO), training constraints.",
  data_table:  "Focus on: schema/columns, data types, volume, relationships, use case (reporting/ML/API).",
  ml_general:  "Focus on: framework, task type, data format, performance constraints.",
  general:     "Focus on: objective, language/environment, existing context, edge cases.",
};

export function buildClarifySystemPrompt(
  initialPrompt: string,
  qaHistory: QA[],
  domain: Domain
): string {
  const historyText =
    qaHistory.length > 0
      ? qaHistory
          .map((qa, i) =>
            qa.question
              ? `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`
              : `A${i + 1}: ${qa.answer}`
          )
          .join("\n\n")
      : "No questions asked yet.";

  const shouldStop =
    qaHistory.length >= 5 ||
    (qaHistory.length > 0 && isGoSignal(qaHistory[qaHistory.length - 1].answer));

  return `${KB_PREAMBLE}

---

You are a prompt clarification assistant. Your task is to iteratively refine a user's prompt by asking targeted questions.

Initial prompt: "${initialPrompt}"

Q&A history so far:
${historyText}

Detected domain: ${domain}
${DOMAIN_ANGLES[domain]}

${
  shouldStop
    ? "You have enough information. Return ONLY the final enriched prompt, incorporating all answers collected so far. Do not ask any more questions."
    : "Ask the single most relevant next clarifying question for this domain and context. Output ONLY the question — no preamble, no explanation, no punctuation beyond the question mark."
}`;
}

export function buildEnrichedPrompt(initialPrompt: string, qaHistory: QA[]): string {
  if (qaHistory.length === 0) return initialPrompt;

  const context = qaHistory
    .map((qa) => `- ${qa.question}\n  → ${qa.answer}`)
    .join("\n");

  return `${initialPrompt}

## Contexte additionnel recueilli

${context}

---
Prends en compte tout ce contexte pour répondre de façon précise et complète.`;
}
