import Anthropic from "@anthropic-ai/sdk";
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

const client = new Anthropic();

const SYSTEM_PROMPT = `Tu es un agent expert en amélioration de prompts. Ton rôle est d'analyser un prompt utilisateur et l'historique des questions/réponses déjà échangées, puis de décider de la prochaine action.

Règles strictes :
1. Si des précisions importantes manquent encore pour bien exécuter la demande, pose UNE SEULE question — la plus pertinente selon le domaine et le contexte réel du prompt.
2. Si tu as suffisamment d'informations pour que le LLM puisse répondre précisément (ou après 5 questions maximum), réponds uniquement avec le mot : DONE
3. La question doit être concrète et adaptée au domaine détecté automatiquement (code, data science, design, rédaction, business, DevOps, etc.)
4. Ne pose jamais une question générique si le contexte est déjà clair. Chaque question doit débloquer une information réellement utile.
5. Réponds UNIQUEMENT avec la question ou le mot DONE — aucune explication, aucun préambule, aucune ponctuation superflue.`;

export async function getNextQuestion(
  initialPrompt: string,
  qaHistory: QA[]
): Promise<string | null> {
  if (qaHistory.length >= 5) return null;

  const historyText =
    qaHistory.length > 0
      ? qaHistory
          .map((qa, i) => `Q${i + 1}: ${qa.question}\nR${i + 1}: ${qa.answer}`)
          .join("\n\n")
      : "Aucune question posée pour l'instant.";

  const userMessage = `Prompt initial de l'utilisateur :
"${initialPrompt}"

Historique des questions/réponses :
${historyText}

Quelle est la prochaine question à poser, ou dois-tu répondre DONE ?`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "";

  if (text.toUpperCase() === "DONE" || text === "") return null;
  return text;
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
