# Prompt Clarifier — MCP Agent

![version](https://img.shields.io/badge/version-3.0.4-blue)

> Stop the back-and-forth with your LLM. This agent asks the right questions before executing your request.

## How it works

```
You write: "Create an ONNX model without opset"
                    ↓
The MCP server detects the domain and returns a system prompt
                    ↓
Your IDE's own LLM asks targeted questions (no external LLM)
                    ↓
You answer (or type "go" to stop)
                    ↓
An enriched, precise prompt is generated
                    ↓
Your LLM produces exactly what you wanted — on the first try
```

---

## Architecture

The MCP server is **LLM-agnostic**: it makes no external API calls and requires no API key.

| Responsibility | Who handles it |
| --- | --- |
| Domain detection | MCP server |
| Session state (Q&A history) | MCP server |
| Question generation | Your IDE's LLM (Junie, Cursor, Claude Code, Copilot…) |
| Knowledge base search | Your IDE's LLM (Confluence, Jira, Figma, Notion, Linear, GitHub Issues…) |

**Call flow:**

- **First call** (`prompt`) — the server creates a session, detects the domain, and returns a `system_prompt` + `user_message` that your IDE injects into its LLM to generate the first question.
- **Subsequent calls** (`session_id` + `answer`) — the server saves the answer and returns an updated `system_prompt`. After 5 answers or the word "go", it returns the enriched `final_prompt`.

---

## Automatically detected domains

| Domain | Detected patterns | Question focus |
| --- | --- | --- |
| `ml_onnx` | `onnx` | runtime, opset, tensor shapes, operators |
| `ml_h2o` | `h2o`, `automl`, `gbm`, `mojo`, `pojo` | algorithm type, target variable, export format |
| `data_table` | `datatable`, `schema`, `dataframe`, `column` | schema, data types, volume, use case |
| `ml_general` | `pytorch`, `tensorflow`, `sklearn`, `model`… | framework, task type, data format |
| `general` | (everything else) | objective, environment, existing context |

---

## Knowledge base search

The returned system prompt instructs your IDE's LLM to **use its connected MCP tools** to gather internal context before formulating questions. This produces questions tailored to your organization's actual standards and workflows rather than generic ones.

Supported platforms (if connected in your IDE):

| Platform | MCP tool used | What is searched |
| --- | --- | --- |
| **Confluence** (Atlassian Rovo) | `searchConfluenceUsingCql` | Internal standards, architecture decisions, naming conventions |
| **Jira** (Atlassian Rovo) | `searchJiraIssuesUsingJql` | Open issues, epics, current constraints |
| **Figma** | Figma MCP tool | Design specs, component names |
| **Notion** | Notion MCP tool | Internal documentation |
| **Linear** | Linear MCP tool | Open issues, roadmap |
| **GitHub Issues** | GitHub MCP tool | Open issues, discussions |

If none of these tools are connected, the LLM falls back to domain best practices.

---

## Installation

> **No API key required.** The server makes no external LLM calls.

### Option 1 — Global install (recommended)

```bash
npm install -g prompt-clarifier-mcp
```

Then use `prompt-clarifier-mcp` as the command in your IDE config instead of `npx`:

```json
{
  "command": "prompt-clarifier-mcp",
  "args": []
}
```

### Option 2 — On-demand via npx

No install needed. Use `npx -y prompt-clarifier-mcp` directly in your IDE config (see examples below). The package is fetched automatically on first run.

---

### Cursor

Open `~/.cursor/mcp.json` (create it if it does not exist):

```json
{
  "mcpServers": {
    "prompt-clarifier": {
      "command": "npx",
      "args": ["-y", "prompt-clarifier-mcp"]
    }
  }
}
```

Restart Cursor. The `clarify` tool is now available.

---

### Claude Desktop

Open the config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "prompt-clarifier": {
      "command": "npx",
      "args": ["-y", "prompt-clarifier-mcp"]
    }
  }
}
```

Restart Claude Desktop.

---

### VS Code (with GitHub Copilot or Continue)

Create or open `.vscode/mcp.json` at the root of your project:

```json
{
  "servers": {
    "prompt-clarifier": {
      "command": "npx",
      "args": ["-y", "prompt-clarifier-mcp"]
    }
  }
}
```

---

### IntelliJ IDEA / PyCharm (2025.1+)

1. Open `Settings` → `Tools` → `AI Assistant` → `Model Context Protocol (MCP)`
2. Click `+` to add a new server
3. Choose **"Command"** as the type
4. Fill in:
   - **Name**: `prompt-clarifier`
   - **Command**: `npx`
   - **Arguments**: `-y prompt-clarifier-mcp`
5. Click `OK` and restart the IDE

> Enable **"Codebase"** mode in the AI Assistant chat for MCP tools to be available.

---

### Claude Code

```bash
claude mcp add prompt-clarifier npx -- -y prompt-clarifier-mcp
```

---

## Usage

In any IDE chat, call the `clarify` tool with your prompt:

```
Use the clarify tool with this prompt: "Create an ONNX model without opset"
```

The server will:
1. Detect the domain (`ml_onnx` in this example)
2. Return a system prompt your LLM uses to ask targeted questions
3. Record each answer in the session
4. Generate the enriched prompt after 5 answers or as soon as you type **"go"**

**To stop questions at any time**, simply write:
- `go` / `commence` / `start` / `proceed` / `just do it` / `enough`

---

## Response format

**First call:**
```json
{
  "session_id": "uuid",
  "system_prompt": "...",
  "user_message": "Here is the user prompt to clarify: ...",
  "instructions": "Ask the first clarifying question now. Include the session_id..."
}
```

**Subsequent calls:**
```json
{
  "session_id": "uuid",
  "system_prompt": "...",
  "user_message": "The user answered: ... Ask the next question.",
  "qa_count": 2
}
```

> Pass back the `question` field (the question your LLM just asked) alongside `answer` so the session history stays complete and the enriched prompt includes the full Q&A context.

**Final response:**
```json
{
  "final_prompt": "Initial prompt\n\n## Additional context collected\n..."
}
```

---

## Requirements

- Node.js 18 or higher
- An IDE with MCP support (see list above)

---

## Local development

```bash
git clone https://github.com/Didou555/prompt-clarifer
cd prompt-clarifer
npm install
npm run build

# Test with the MCP inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Contributing

Contributions are welcome! In particular:
- New domain detection patterns (`src/clarifier.ts` → `detectDomain`)
- New stop keywords in other languages (`GO_KEYWORDS`)
- New question angles per domain (`DOMAIN_ANGLES`)

---

## License

MIT
