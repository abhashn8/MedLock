export const PHI_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "patientName", pattern: /\b(patient|patientName|fullName|firstName|lastName)\b/i },
  { name: "dateOfBirth", pattern: /\b(dob|dateOfBirth|birthDate|birthday)\b/i },
  { name: "ssn", pattern: /\b(ssn|socialSecurityNumber|socialSecurity)\b/i },
  { name: "mrn", pattern: /\b(mrn|medicalRecordNumber|medicalRecordNo)\b/i },
  { name: "email", pattern: /\b(email|emailAddress|userEmail|patientEmail)\b/i },
  { name: "phone", pattern: /\b(phone|phoneNumber|mobile|telephone|cell)\b/i },
  { name: "address", pattern: /\b(address|streetAddress|homeAddress|mailingAddress)\b/i },
  { name: "diagnosis", pattern: /\b(diagnosis|dx|condition|icd10|icdCode)\b/i },
  { name: "insuranceId", pattern: /\b(insuranceId|policyNumber|memberId|insuranceNumber)\b/i },
  { name: "ipAddress", pattern: /\b(ip|ipAddress|clientIp|remoteIp)\b/i },
];

export const RISKY_SINKS: { name: string; pattern: RegExp }[] = [
  { name: "console.log", pattern: /\bconsole\.log\s*\(/ },
  { name: "console.error", pattern: /\bconsole\.error\s*\(/ },
  { name: "console.warn", pattern: /\bconsole\.warn\s*\(/ },
  { name: "console.debug", pattern: /\bconsole\.debug\s*\(/ },
  { name: "console.info", pattern: /\bconsole\.info\s*\(/ },
  { name: "logger.info", pattern: /\blogger\.info\s*\(/ },
  { name: "logger.error", pattern: /\blogger\.error\s*\(/ },
  { name: "logger.warn", pattern: /\blogger\.warn\s*\(/ },
  { name: "logger.debug", pattern: /\blogger\.debug\s*\(/ },
  { name: "Sentry.captureException", pattern: /\bSentry\.captureException\s*\(/ },
  { name: "Sentry.captureMessage", pattern: /\bSentry\.captureMessage\s*\(/ },
  { name: "Sentry.setUser", pattern: /\bSentry\.setUser\s*\(/ },
  { name: "analytics.track", pattern: /\banalytics\.track\s*\(/ },
  { name: "analytics.identify", pattern: /\banalytics\.identify\s*\(/ },
  { name: "mixpanel.track", pattern: /\bmixpanel\.track\s*\(/ },
  { name: "mixpanel.identify", pattern: /\bmixpanel\.identify\s*\(/ },
  { name: "gtag", pattern: /\bgtag\s*\(/ },
  { name: "ga()", pattern: /\bga\s*\(/ },
  { name: "localStorage.setItem", pattern: /\blocalStorage\.setItem\s*\(/ },
  { name: "sessionStorage.setItem", pattern: /\bsessionStorage\.setItem\s*\(/ },
  { name: "datadog.logger", pattern: /\bdatadog\.logger\b/ },
  { name: "DD_LOGS", pattern: /\bDD_LOGS\b/ },
  { name: "posthog.capture", pattern: /\bposthog\.capture\s*\(/ },
  { name: "LogRocket.identify", pattern: /\bLogRocket\.identify\s*\(/ },
];

export interface Finding {
  line: number;
  lineContent: string;
  phiField: string;
  sink: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  filePath: string;
}

export function scanCode(filePath: string, code: string): Finding[] {
  const lines = code.split('\n');
  const findings: Finding[] = [];
  const seen = new Set<string>();

  const criticalKeywords = ['Sentry', 'analytics', 'mixpanel', 'gtag', 'ga()', 'posthog', 'LogRocket'];
  const highKeywords = ['localStorage', 'sessionStorage'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const sink of RISKY_SINKS) {
      if (!sink.pattern.test(line)) continue;

      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'MEDIUM';
      if (criticalKeywords.some((k) => sink.name.includes(k))) severity = 'CRITICAL';
      else if (highKeywords.some((k) => sink.name.includes(k))) severity = 'HIGH';

      const windowStart = Math.max(0, i - 5);
      for (let j = windowStart; j <= i; j++) {
        const windowLine = lines[j];
        for (const phi of PHI_PATTERNS) {
          if (!phi.pattern.test(windowLine)) continue;

          const key = `${i}:${phi.name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          findings.push({
            line: i + 1,
            lineContent: line,
            phiField: phi.name,
            sink: sink.name,
            severity,
            filePath,
          });
        }
      }
    }
  }

  return findings;
}

export function scanFiles(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...scanCode(file.path, file.content));
  }
  return findings;
}
