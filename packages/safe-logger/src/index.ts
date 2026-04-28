export const PHI_KEYS: ReadonlySet<string> = new Set<string>([
  "patient",
  "patientname",
  "fullname",
  "firstname",
  "lastname",
  "dob",
  "dateofbirth",
  "birthdate",
  "birthday",
  "ssn",
  "socialsecuritynumber",
  "mrn",
  "medicalrecordnumber",
  "email",
  "emailaddress",
  "useremail",
  "patientemail",
  "phone",
  "phonenumber",
  "mobile",
  "telephone",
  "address",
  "streetaddress",
  "homeaddress",
  "diagnosis",
  "condition",
  "icd10",
  "insuranceid",
  "policynumber",
  "memberid",
  "ipaddress",
  "clientip",
]);

const REDACTED = "[REDACTED]";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;

function looksLikePhiValue(value: string): boolean {
  if (EMAIL_REGEX.test(value)) return true;
  if (SSN_REGEX.test(value)) return true;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return looksLikePhiValue(value) ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (PHI_KEYS.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(child);
      }
    }
    return out;
  }
  return value;
}

export function redactArgs(args: unknown[]): unknown[] {
  return args.map((arg) => redactValue(arg));
}

type ConsoleMethod = "log" | "error" | "warn" | "debug" | "info";

const WRAPPED_METHODS: ConsoleMethod[] = ["log", "error", "warn", "debug", "info"];

export function createSafeConsole(options?: { global?: boolean }): Console {
  const original = globalThis.console;
  const safe = Object.create(original) as Console;

  for (const method of WRAPPED_METHODS) {
    const bound = original[method].bind(original);
    (safe as Record<ConsoleMethod, (...args: unknown[]) => void>)[method] = (
      ...args: unknown[]
    ) => {
      bound(...redactArgs(args));
    };
  }

  if (options?.global !== false) {
    globalThis.console = safe;
  }

  return safe;
}
