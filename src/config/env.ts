import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Run configuration, read from .env (local) or from the process environment (CI).
 *
 * .env values win over exported shell variables so that a developer's local file
 * is authoritative when it exists; CI writes no .env and is served by the
 * process environment alone.
 */
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

/** Environment key used to scope test data — derived from the URL under test. */
export type EnvName = 'uat' | 'demo' | 'qa';

function read(key: string, fallback?: string): string | undefined {
  const value = process.env[key];
  return value !== undefined && value !== '' ? value : fallback;
}

function required(key: string): string {
  const value = read(key);
  if (!value) {
    throw new Error(
      `Missing required config: ${key}. Copy .env.template to .env and fill it in, ` +
        `or export ${key} before running.`,
    );
  }
  return value;
}

function toNumber(key: string, fallback: number): number {
  const raw = read(key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Config ${key} must be a number, got "${raw}"`);
  }
  return parsed;
}

function envNameFrom(baseUrl: string): EnvName {
  if (baseUrl.includes('demo')) return 'demo';
  if (baseUrl.includes('qa')) return 'qa';
  return 'uat';
}

const baseUrl = required('BASE_URL');

export const config = {
  baseUrl,
  envName: envNameFrom(baseUrl),

  /**
   * Credentials are only read when a test actually logs in, so `playwright test
   * --list` and typechecking work without them.
   */
  get username(): string {
    return required('USERNAME');
  },
  get password(): string {
    return required('PASSWORD');
  },

  browser: read('BROWSER', 'chromium') as 'chromium' | 'chrome',
  headless: read('HEADLESS', 'false') === 'true',

  workers: toNumber('WORKERS', 2),
  retries: toNumber('RETRIES', process.env.CI ? 1 : 0),

  /** Boundary hierarchy the campaign flow selects. */
  hierarchyName: read('HIERARCHY_NAME', 'CHAD - ITN') as string,

  /** Where the downloaded and filled microplan templates are kept for inspection. */
  templateDir: path.resolve(__dirname, '../../templates'),
} as const;

/** One-line banner so a run's target environment is visible in the log. */
export function describeRun(): string {
  return [
    `BASE_URL : ${config.baseUrl}`,
    `ENV      : ${config.envName}`,
    `BROWSER  : ${config.browser}`,
    `HEADLESS : ${config.headless}`,
  ].join('\n');
}
