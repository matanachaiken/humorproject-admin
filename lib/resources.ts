// Tables the admin area can fully create, read, update and delete. Each one
// is described here once; the pages under app/(admin)/[resource] and the
// server actions that validate input all read from this list.
// Plain data, so it's safe to import from client components too.

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "checkbox" | "select" | "relation";
  hint?: string;
  required?: boolean;
  maxLength?: number;
  // Lowercased before saving (domains, emails).
  lowercase?: boolean;
  pattern?: { regex: string; message: string };
  options?: { value: string; label: string }[];
  // For "relation": the table to pick a row from and the column to show.
  relation?: { table: string; label: string };
  defaultValue?: string | number | boolean;
  // Shown as a column on the list page.
  list?: boolean;
  mono?: boolean;
};

export type Resource = {
  key: string;
  table: string;
  title: string;
  singular: string;
  description: string;
  fields: Field[];
  orderBy: { column: string; ascending: boolean }[];
  searchable: string[];
  hasUpdatedAt: boolean;
  // Shown on the delete button, e.g. what stops working.
  deleteWarning?: string;
};

const notes: Field = { name: "notes", label: "Notes", type: "textarea", maxLength: 500, hint: "For admins only." };
const active: Field = { name: "is_active", label: "Active", type: "checkbox", defaultValue: true, list: true };

export const RESOURCES: Resource[] = [
  {
    key: "terms",
    table: "terms",
    title: "Terms",
    singular: "term",
    description: "Campus and city slang. Active terms are given to the riff writer, which uses them in captions when they fit.",
    fields: [
      { name: "term", label: "Term", type: "text", required: true, maxLength: 60, list: true },
      { name: "meaning", label: "Meaning", type: "textarea", required: true, maxLength: 300, list: true, hint: "One sentence the AI can understand." },
      active,
    ],
    orderBy: [{ column: "term", ascending: true }],
    searchable: ["term", "meaning"],
    hasUpdatedAt: true,
  },
  {
    key: "examples",
    table: "generation_examples",
    title: "Generation examples",
    singular: "example",
    description: "Riffs shown to the riff writer to set the tone. The 8 newest active examples go into every riff prompt.",
    fields: [
      { name: "theme", label: "Theme", type: "text", required: true, maxLength: 200, list: true },
      { name: "idea", label: "Idea", type: "text", required: true, maxLength: 200, list: true, hint: "What the user typed." },
      { name: "caption", label: "Caption", type: "textarea", required: true, maxLength: 280, list: true },
      { name: "image_prompt", label: "Image prompt", type: "textarea", maxLength: 2000, hint: "Optional, for reference." },
      active,
      notes,
    ],
    orderBy: [{ column: "created_at", ascending: false }],
    searchable: ["theme", "idea", "caption"],
    hasUpdatedAt: true,
  },
  {
    key: "models",
    table: "llm_models",
    title: "LLM models",
    singular: "model",
    description: "Text models are tried in priority order (lowest first) until one answers. The first active image model draws every riff.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, maxLength: 80, list: true },
      { name: "provider_id", label: "Provider", type: "relation", required: true, relation: { table: "llm_providers", label: "name" }, list: true },
      { name: "model_key", label: "Model ID", type: "text", required: true, maxLength: 120, list: true, mono: true, hint: "Exactly what the provider's API calls it, e.g. gemini-3.5-flash." },
      {
        name: "kind",
        label: "Kind",
        type: "select",
        required: true,
        list: true,
        options: [
          { value: "text", label: "Text (Google Gemini only)" },
          { value: "image", label: "Image (Cloudflare only)" },
        ],
      },
      { name: "priority", label: "Priority", type: "number", required: true, defaultValue: 100, list: true, hint: "Lower runs first." },
      active,
      notes,
    ],
    orderBy: [{ column: "kind", ascending: false }, { column: "priority", ascending: true }],
    searchable: ["name", "model_key"],
    hasUpdatedAt: true,
  },
  {
    key: "providers",
    table: "llm_providers",
    title: "LLM providers",
    singular: "provider",
    description: "The AI companies Daily Riff calls. Turning a provider off skips all of its models.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, maxLength: 80, list: true },
      {
        name: "slug",
        label: "Slug",
        type: "text",
        required: true,
        maxLength: 40,
        lowercase: true,
        list: true,
        mono: true,
        pattern: { regex: "^[a-z0-9-]+$", message: "Slug can only have lowercase letters, numbers and dashes." },
        hint: "Daily Riff knows how to call \"google\" (text) and \"cloudflare\" (images).",
      },
      { name: "api_base_url", label: "API base URL", type: "text", maxLength: 300, mono: true },
      {
        name: "api_key_env",
        label: "API key env var",
        type: "text",
        maxLength: 80,
        list: true,
        mono: true,
        pattern: { regex: "^[A-Z0-9_]*$", message: "Use the variable's NAME, like GEMINI_API_KEY, never the key itself." },
        hint: "The NAME of the environment variable that holds the key. Never paste a key here.",
      },
      active,
      notes,
    ],
    orderBy: [{ column: "name", ascending: true }],
    searchable: ["name", "slug"],
    hasUpdatedAt: true,
    deleteWarning: "A provider can't be deleted while models still use it.",
  },
  {
    key: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    singular: "domain",
    description:
      "New Daily Riff accounts must use an email at one of these domains (subdomains count) or be on the whitelist. Existing accounts are never affected. If this list and the whitelist are both empty, anyone can sign up.",
    fields: [
      {
        name: "domain",
        label: "Domain",
        type: "text",
        required: true,
        maxLength: 120,
        lowercase: true,
        list: true,
        mono: true,
        pattern: { regex: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$", message: "Enter a domain like columbia.edu, without the @." },
      },
      { ...notes, hint: undefined, list: true },
    ],
    orderBy: [{ column: "domain", ascending: true }],
    searchable: ["domain", "notes"],
    hasUpdatedAt: false,
  },
  {
    key: "whitelist",
    table: "whitelisted_emails",
    title: "Whitelisted emails",
    singular: "email",
    description: "Specific people who may create an account even though their email's domain isn't allowed.",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "text",
        required: true,
        maxLength: 254,
        lowercase: true,
        list: true,
        mono: true,
        pattern: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", message: "Enter a full email address." },
      },
      { ...notes, hint: "Who they are, or why they're allowed.", list: true },
    ],
    orderBy: [{ column: "email", ascending: true }],
    searchable: ["email", "notes"],
    hasUpdatedAt: false,
  },
];

export function getResource(key: string) {
  return RESOURCES.find((r) => r.key === key) ?? null;
}

// Parses and validates a submitted form against a resource's fields.
export function parseRecord(resource: Resource, formData: FormData) {
  const values: Record<string, string | number | boolean | null> = {};
  for (const field of resource.fields) {
    const raw = formData.get(field.name);
    if (field.type === "checkbox") {
      values[field.name] = raw === "on";
      continue;
    }
    let text = String(raw ?? "").trim();
    if (field.lowercase) text = text.toLowerCase();
    if (!text) {
      if (field.required) return { error: `${field.label} is required.` };
      values[field.name] = null;
      continue;
    }
    if (field.maxLength && text.length > field.maxLength) {
      return { error: `${field.label} must be ${field.maxLength} characters or fewer.` };
    }
    if (field.pattern && !new RegExp(field.pattern.regex).test(text)) return { error: field.pattern.message };
    if (field.type === "number" || field.type === "relation") {
      const n = Number(text);
      if (!Number.isInteger(n)) return { error: `${field.label} must be a whole number.` };
      values[field.name] = n;
      continue;
    }
    if (field.type === "select" && !field.options?.some((o) => o.value === text)) {
      return { error: `Pick a ${field.label.toLowerCase()}.` };
    }
    values[field.name] = text;
  }
  return { values };
}
