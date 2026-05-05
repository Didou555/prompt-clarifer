import { Session } from "./session.js";

// ─── Stop keywords ───────────────────────────────────────────────────────────
// If the user's answer contains one of these, stop questioning and build prompt

const STOP_KEYWORDS = [
  "go", "start", "proceed", "just do it", "enough", "that's enough",
  "commence", "lance", "lance-toi", "lance toi", "démarre", "demarre",
  "c'est bon", "cest bon", "ok go", "assez", "suffit", "vas-y", "vas y",
  "allez", "do it", "let's go", "lets go", "ok", "start now", "begin",
];

export function isStopSignal(answer: string): boolean {
  const normalized = answer.toLowerCase().trim();
  return STOP_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(kw + " ") || normalized.endsWith(" " + kw));
}

// ─── Domain detection ────────────────────────────────────────────────────────

const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  ml_onnx: [/onnx/i, /opset/i, /tensor/i, /inference/i, /model.*export/i],
  ml_general: [/model/i, /train/i, /dataset/i, /neural/i, /pytorch/i, /tensorflow/i, /keras/i, /embedding/i],
  docker: [/docker/i, /container/i, /dockerfile/i, /compose/i, /kubernetes/i, /k8s/i, /pod/i],
  database: [/sql/i, /query/i, /database/i, /postgres/i, /mysql/i, /mongo/i, /index/i, /migration/i],
  api: [/api/i, /endpoint/i, /rest/i, /graphql/i, /webhook/i, /request/i, /response/i],
  frontend: [/react/i, /vue/i, /angular/i, /component/i, /css/i, /html/i, /ui/i, /interface/i],
  backend: [/server/i, /node/i, /express/i, /fastapi/i, /django/i, /flask/i, /spring/i],
  devops: [/ci\/cd/i, /pipeline/i, /jenkins/i, /github.action/i, /deploy/i, /terraform/i, /ansible/i],
  testing: [/test/i, /unittest/i, /jest/i, /pytest/i, /selenium/i, /playwright/i, /mock/i],
  security: [/auth/i, /jwt/i, /oauth/i, /encrypt/i, /password/i, /permission/i, /role/i],
};

export function detectDomain(prompt: string): string {
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    if (patterns.some((p) => p.test(prompt))) return domain;
  }
  return "general";
}

// ─── Question banks per domain ───────────────────────────────────────────────

const DOMAIN_QUESTIONS: Record<string, string[]> = {
  ml_onnx: [
    "Quel runtime va exécuter ce modèle ? (ex: ONNX Runtime, TensorFlow, PyTorch, OpenCV...)",
    "Quels types d'opérations le modèle doit-il contenir ? (ex: Conv2D, LSTM, Linear, Attention...)",
    "Quel format et quelle forme pour les tenseurs d'entrée ? (ex: float32 [batch, 3, 224, 224])",
    "Quel format et quelle forme pour les tenseurs de sortie ?",
    "Le modèle sera-t-il utilisé pour de l'inférence seule, ou aussi pour du fine-tuning ?",
    "Y a-t-il des contraintes de version ONNX opset ? (ex: opset 11, 13, 17...)",
  ],
  ml_general: [
    "Quel framework ML utilises-tu ? (PyTorch, TensorFlow, JAX, scikit-learn...)",
    "Quelle est la tâche du modèle ? (classification, régression, génération, détection...)",
    "Quel est le format et la structure de tes données d'entrée ?",
    "Quelles sont tes contraintes de performance ? (latence, taille du modèle, GPU/CPU...)",
    "As-tu un dataset prêt ou faut-il en générer un pour tester ?",
  ],
  docker: [
    "Quel OS de base pour l'image ? (ubuntu, alpine, debian...)",
    "Quelle application ou service doit tourner dans le container ?",
    "Y a-t-il des ports à exposer ? Si oui, lesquels ?",
    "Des volumes à monter ? (données persistantes, configs...)",
    "Des variables d'environnement nécessaires ?",
    "Mode de déploiement : docker run seul, docker-compose, ou Kubernetes ?",
  ],
  database: [
    "Quel SGBD utilises-tu ? (PostgreSQL, MySQL, MongoDB, SQLite...)",
    "Quelle est la structure de la table / collection concernée ?",
    "Quels sont les volumes de données attendus ? (ordre de grandeur)",
    "Y a-t-il des contraintes de performance ou des index existants ?",
    "Est-ce une opération de lecture, écriture, ou migration ?",
  ],
  api: [
    "Quel framework utilises-tu ? (Express, FastAPI, Django, Spring...)",
    "Quel est le format attendu en entrée ? (JSON, form-data, query params...)",
    "Quel est le format de réponse attendu ?",
    "Y a-t-il une authentification à gérer ? (JWT, API key, OAuth...)",
    "Des cas d'erreur spécifiques à gérer ?",
  ],
  frontend: [
    "Quel framework utilises-tu ? (React, Vue, Angular, Svelte, vanilla...)",
    "Ce composant doit-il gérer un état local ou un état global ?",
    "Y a-t-il des interactions utilisateur spécifiques ? (click, drag, form...)",
    "Des contraintes de style ? (CSS module, Tailwind, styled-components...)",
    "Le composant doit-il être responsive ? Sur quels breakpoints ?",
  ],
  backend: [
    "Quel langage et framework ? (Node/Express, Python/FastAPI, Java/Spring...)",
    "Ce code s'intègre dans un projet existant ou c'est greenfield ?",
    "Y a-t-il une base de données impliquée ? Laquelle ?",
    "Des contraintes de performance ou de scalabilité ?",
    "Faut-il gérer des erreurs spécifiques ou des cas limites ?",
  ],
  devops: [
    "Quel outil CI/CD utilises-tu ? (Jenkins, GitHub Actions, GitLab CI...)",
    "Sur quelle infrastructure déploies-tu ? (AWS, GCP, Azure, bare metal...)",
    "Quelles étapes le pipeline doit-il inclure ? (build, test, deploy...)",
    "Y a-t-il des secrets ou credentials à gérer ?",
    "Des conditions de déclenchement spécifiques ? (push, PR, tag...)",
  ],
  testing: [
    "Quel framework de test utilises-tu ? (Jest, Pytest, JUnit, Playwright...)",
    "Qu'est-ce qui doit exactement être testé ? (unit, integration, e2e...)",
    "Y a-t-il des dépendances à mocker ?",
    "Quels cas limites ou cas d'erreur faut-il couvrir ?",
    "Faut-il tester des comportements asynchrones ?",
  ],
  security: [
    "Quel mécanisme d'authentification utilises-tu ? (JWT, session, OAuth...)",
    "Quels rôles ou permissions doivent être gérés ?",
    "Y a-t-il des données sensibles à chiffrer ou masquer ?",
    "Sur quel backend / framework s'intègre cette sécurité ?",
    "Des vecteurs d'attaque spécifiques à protéger ? (XSS, CSRF, injection...)",
  ],
  general: [
    "Quel est l'objectif final de ce que tu veux créer ?",
    "Dans quel langage ou environnement téchnique travailles-tu ?",
    "Y a-t-il des contraintes spécifiques à respecter ? (performance, compatibilité, style...)",
    "Ce code s'intègre dans un projet existant ? Si oui, quel contexte ?",
    "Y a-t-il des cas limites ou comportements particuliers à gérer ?",
  ],
};

// ─── Next question logic ─────────────────────────────────────────────────────

export function getNextQuestion(session: Session): string | null {
  const questions = DOMAIN_QUESTIONS[session.detectedDomain] ?? DOMAIN_QUESTIONS["general"];
  const askedCount = session.history.length;

  // Max 5 questions unless user keeps answering
  if (askedCount >= questions.length) return null;

  return questions[askedCount] ?? null;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

export function buildEnrichedPrompt(session: Session): string {
  const lines: string[] = [];

  lines.push(`## Demande enrichie`);
  lines.push(``);
  lines.push(`**Demande originale :** ${session.originalPrompt}`);
  lines.push(``);

  if (session.history.length > 0) {
    lines.push(`**Précisions apportées :**`);
    for (const { question, answer } of session.history) {
      lines.push(`- **${question}**`);
      lines.push(`  → ${answer}`);
    }
    lines.push(``);
  }

  lines.push(`**Instructions :** Traite cette demande en tenant compte de TOUTES les précisions ci-dessus.`);
  lines.push(`Ne fais aucune hypothèse silencieuse — si une information manque, dis-le explicitement.`);
  lines.push(`Produis un résultat complet et directement utilisable.`);

  return lines.join("\n");
}
