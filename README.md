# Prompt Clarifier — MCP Agent

> Arrête le ping-pong avec ton LLM. Cet agent te pose les bonnes questions avant d'exécuter ta demande.

## Comment ça marche

```
Tu écris : "Crée un modèle ONNX sans opset"
                    ↓
Prompt Clarifier pose des questions ciblées
                    ↓
Tu réponds (ou tu écris "go" pour arrêter)
                    ↓
Un prompt enrichi et précis est généré
                    ↓
Ton LLM produit exactement ce que tu voulais — du premier coup
```

---

## Installation

### Prérequis — Clé API Anthropic

Cet agent utilise Claude Haiku pour générer ses questions. Tu as besoin d'une clé API Anthropic :
- Crée-en une sur [console.anthropic.com](https://console.anthropic.com)
- Ajoute-la dans la config MCP de ton outil (voir exemples ci-dessous)

---

### Cursor

Ouvre `~/.cursor/mcp.json` (crée-le s'il n'existe pas) :

```json
{
  "mcpServers": {
    "prompt-clarifier": {
      "command": "npx",
      "args": ["-y", "prompt-clarifier-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Redémarre Cursor. L'outil `clarify` est maintenant disponible.

---

### Claude Desktop

Ouvre le fichier de config :
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "prompt-clarifier": {
      "command": "npx",
      "args": ["-y", "prompt-clarifier-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Redémarre Claude Desktop.

---

### VS Code (avec GitHub Copilot ou Continue)

Crée ou ouvre `.vscode/mcp.json` à la racine de ton projet :

```json
{
  "servers": {
    "prompt-clarifier": {
      "command": "npx",
      "args": ["-y", "prompt-clarifier-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

---

### IntelliJ IDEA / PyCharm (version 2025.1+)

1. Ouvre `Settings` → `Tools` → `AI Assistant` → `Model Context Protocol (MCP)`
2. Clique sur `+` pour ajouter un nouveau serveur
3. Choisis **"Command"** comme type
4. Remplis :
   - **Name** : `prompt-clarifier`
   - **Command** : `npx`
   - **Arguments** : `-y prompt-clarifier-mcp`
   - **Environment variables** : `ANTHROPIC_API_KEY=sk-ant-...`
5. Clique `OK` et redémarre l'IDE

> ⚠️ Requiert IntelliJ IDEA / PyCharm 2025.1 ou supérieur avec AI Assistant activé.
> Active le mode **"Codebase"** dans le chat AI Assistant pour que les outils MCP soient disponibles.

---

### Claude Code

```bash
claude mcp add prompt-clarifier npx -- -y prompt-clarifier-mcp
```

Puis ajoute la clé API dans ton environnement ou dans `.claude/settings.json` :
```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-..."
  }
}
```

---

## Utilisation

Dans n'importe quel chat de ton IDE, appelle l'outil `clarify` avec ton prompt :

**Exemple :**
```
Utilise l'outil clarify avec ce prompt : "Crée un modèle ONNX sans opset"
```

L'agent va :
1. Détecter le domaine (ML/ONNX dans cet exemple)
2. Te poser des questions ciblées une par une
3. Générer un prompt enrichi quand tu as répondu (ou quand tu écris **"go"**)

**Pour arrêter les questions à tout moment**, écris simplement :
- `go` / `commence` / `lance-toi` / `c'est bon` / `assez` / `proceed`

---

## Prérequis

- Node.js 18 ou supérieur
- Un IDE avec support MCP (voir liste ci-dessus)

---

## Développement local

```bash
git clone https://github.com/dmi-agentix/prompt-clarifier
cd prompt-clarifier
npm install
npm run build

# Tester avec l'inspecteur MCP
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Contribuer

Les contributions sont les bienvenues ! En particulier :
- Nouvelles banques de questions par domaine (`src/clarifier.ts`)
- Nouveaux mots-clés "stop" dans d'autres langues
- Amélioration de la détection de domaine

---

## Licence

MIT — DMI Agentix
