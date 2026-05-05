import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export interface QAPair {
  question: string;
  answer: string;
}

export interface Session {
  id: string;
  originalPrompt: string;
  detectedDomain: string;
  history: QAPair[];
  status: "questioning" | "done";
  createdAt: number;
}

const SESSION_DIR = os.tmpdir();
const SESSION_PREFIX = "clarifier-session-";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function sessionPath(id: string): string {
  return path.join(SESSION_DIR, `${SESSION_PREFIX}${id}.json`);
}

export function createSession(originalPrompt: string, detectedDomain: string): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    originalPrompt,
    detectedDomain,
    history: [],
    status: "questioning",
    createdAt: Date.now(),
  };
  saveSession(session);
  return session;
}

export function saveSession(session: Session): void {
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), "utf-8");
}

export function loadSession(id: string): Session | null {
  const filePath = sessionPath(id);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const session: Session = JSON.parse(raw);

    // Expire sessions older than TTL
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      deleteSession(id);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function deleteSession(id: string): void {
  const filePath = sessionPath(id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function addQAPair(session: Session, question: string, answer: string): Session {
  session.history.push({ question, answer });
  saveSession(session);
  return session;
}

// Cleanup expired sessions on startup
export function cleanupExpiredSessions(): void {
  try {
    const files = fs.readdirSync(SESSION_DIR);
    for (const file of files) {
      if (!file.startsWith(SESSION_PREFIX)) continue;
      const id = file.replace(SESSION_PREFIX, "").replace(".json", "");
      loadSession(id); // loadSession already deletes expired ones
    }
  } catch {
    // Silently ignore cleanup errors
  }
}
