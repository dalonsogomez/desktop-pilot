export interface UiTarsAction {
  type: "click" | "left_double" | "right_single" | "drag" | "hotkey" | "type" | "scroll" | "wait" | "finished";
  // For click/double/right/scroll
  startBox?: [number, number];
  // For drag
  endBox?: [number, number];
  // For hotkey
  key?: string;
  // For type/finished
  content?: string;
  // For scroll
  direction?: "up" | "down" | "left" | "right";
}

export interface UiTarsTurn {
  thought: string;
  actions: UiTarsAction[];
}

const ACTION_RE = /Action:\s*(\w+)\(([^)]*)\)/g;
const THOUGHT_RE = /Thought:\s*([^\n]+(?:\n(?!Action:)[^\n]*)*)/;

export function parseUiTarsOutput(text: string): UiTarsTurn {
  const thoughtMatch = text.match(THOUGHT_RE);
  const thought = thoughtMatch?.[1].trim() ?? "";

  const actions: UiTarsAction[] = [];
  // Reset lastIndex before executing
  ACTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ACTION_RE.exec(text)) !== null) {
    const name = m[1];
    const args = m[2];
    actions.push(parseAction(name, args));
  }
  return { thought, actions };
}

function parseAction(name: string, argsRaw: string): UiTarsAction {
  const args = parseKwargs(argsRaw);
  switch (name) {
    case "click":
      return { type: "click", startBox: parseBox(args.start_box) };
    case "left_double":
      return { type: "left_double", startBox: parseBox(args.start_box) };
    case "right_single":
      return { type: "right_single", startBox: parseBox(args.start_box) };
    case "drag":
      return { type: "drag", startBox: parseBox(args.start_box), endBox: parseBox(args.end_box) };
    case "hotkey":
      return { type: "hotkey", key: stripQuotes(args.key) };
    case "type":
      return { type: "type", content: stripQuotes(args.content) };
    case "scroll":
      return { type: "scroll", startBox: parseBox(args.start_box), direction: stripQuotes(args.direction) as UiTarsAction["direction"] };
    case "wait":
      return { type: "wait" };
    case "finished":
      return { type: "finished", content: stripQuotes(args.content ?? "''") };
    default:
      throw new Error(`Unknown UI-TARS action: ${name}`);
  }
}

function parseKwargs(raw: string): Record<string, string> {
  // Splits by comma, but respects [...] and '...' grouping
  const result: Record<string, string> = {};
  const parts: string[] = [];
  let depth = 0, inQuote = false, current = "";
  for (const c of raw) {
    if (c === "'" || c === '"') inQuote = !inQuote;
    if (!inQuote && c === "[") depth++;
    if (!inQuote && c === "]") depth--;
    if (!inQuote && depth === 0 && c === ",") {
      parts.push(current); current = ""; continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const key = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    result[key] = val;
  }
  return result;
}

function parseBox(raw: string | undefined): [number, number] {
  if (!raw) return [0, 0];
  const m = raw.match(/\[(\d+)\s*,\s*(\d+)\]/);
  if (!m) return [0, 0];
  return [parseInt(m[1]), parseInt(m[2])];
}

function stripQuotes(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

export function denormalizeCoords(box: [number, number], width: number, height: number): [number, number] {
  return [Math.round(box[0] * width / 1000), Math.round(box[1] * height / 1000)];
}
