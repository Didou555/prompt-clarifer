import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

export interface QA {
  question: string;
  answer: string;
}

export interface Session {
  id: string;
  initialPrompt: string;
  qaHistory: QA[];
  lastQuestion?: string;
  status: "questioning" | "done";
  createdAt: number;
}

function sessionPath(id: string): string {
  return path.join(os.tmpdir(), `clarifier-session-${id}.json`);
}

export function createSession(initialPrompt: string): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    initialPrompt,
    qaHistory: [],
    status: "questioning",
    createdAt: Date.now(),
  };
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

export function loadSession(id: string): Session | null {
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as Session;
}

export function saveSession(session: Session): void {
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}

export function deleteSession(id: string): void {
  const p = sessionPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
