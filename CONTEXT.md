# Prompt Clarifier — Context pour Claude Code

## Vision du projet

Un serveur MCP ("Model Context Protocol") qui s'intègre dans n'importe quel IDE
(Cursor, VS Code, IntelliJ 2025.1+, PyCharm, Claude Desktop, Claude Code)
et qui aide l'utilisateur à affiner son prompt AVANT que le LLM ne l'exécute.

## Problème résolu

L'utilisateur écrit un prompt vague → le LLM produit un résultat partiel ou incorrect
→ ping-pong de corrections → perte de temps.

L'agent intercepte le prompt, pose des questions ciblées une par une,
et génère un prompt enrichi et précis que le LLM peut exécuter correctement du premier coup.

## Décisions architecturales actées

### 1. Serveur MCP pur
- Un package npm : `npx @prompt-clarifier/agent`
- Zéro serveur externe, zéro clé API propre
- Utilise le LLM déjà connecté dans l'IDE de l'utilisateur
- Installation : 3 lignes JSON dans la config de l'IDE

### 2. L'agent questionne TOUJOURS
- Pas d'algorithme de détection d'ambiguïté
- Si l'utilisateur appelle @clarify, il veut être questionné par définition
- L'agent pose des questions intelligentes une par une
- L'utilisateur peut dire "go" / "commence" / "c'est bon" à tout moment
- L'agent démarre alors avec ce qu'il a collecté

### 3. Mémoire via fichier de session local
- Fichier JSON temporaire : `/tmp/clarifier-session-{id}.json`
- Contient : prompt initial, Q&A history, statut
- Persiste entre les appels MCP (qui sont stateless par nature)
- Supprimé automatiquement après génération du prompt final

### 4. Flow conversationnel
```
User appelle l'outil "clarify" avec son prompt
        ↓
Agent analyse le prompt et le domaine détecté
        ↓
Agent pose sa première question
        ↓
User répond (ou dit "go")
        ↓
Agent pose la question suivante (ou génère le prompt final si "go")
        ↓
... jusqu'à ce que l'agent estime avoir assez d'infos OU que l'user dise "go"
        ↓
Agent génère et retourne le prompt enrichi final
```

### 5. Détection du "go"
Mots-clés reconnus (FR + EN) :
- "go", "commence", "start", "c'est bon", "lance toi", "lance-toi",
  "démarre", "ok go", "assez", "enough", "proceed", "just do it"

## Structure du projet

```
prompt-clarifier/
├── CONTEXT.md              ← ce fichier
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts            ← point d'entrée MCP server
│   ├── clarifier.ts        ← logique de questions intelligentes
│   └── session.ts          ← gestion mémoire session locale
├── README.md               ← guide installation par IDE
└── .npmignore
```

## Stack technique
- TypeScript + Node.js 18+
- `@modelcontextprotocol/sdk` — SDK MCP officiel
- Zéro autre dépendance externe (pas d'Anthropic SDK, pas de base de données)

## Ce qu'il reste à faire après génération initiale
1. `npm install` pour installer les dépendances
2. `npm run build` pour compiler TypeScript
3. `npm run dev` pour tester localement
4. Ajouter la config dans Cursor ou Claude Desktop pour tester
5. `npm publish` quand prêt

## Commandes utiles
```bash
npm install
npm run build
npm run dev        # mode watch pour développement
npm test           # tests unitaires
```

## Points d'attention pour Claude Code
- Le serveur MCP communique via stdio (stdin/stdout), pas via HTTP
- Les sessions sont stockées dans /tmp/ — pas dans le répertoire du projet
- Tester avec `npx @modelcontextprotocol/inspector` pour déboguer le serveur MCP
- La logique de questions est dans clarifier.ts — c'est là que l'intelligence réside
