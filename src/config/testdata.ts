import { config, type EnvName } from './env';

/**
 * Environment-scoped test data.
 *
 * Values differ per environment (a complaint type configured on demo may not
 * exist on uat), so a key is looked up under the current environment first and
 * falls back to the shared block. Ported from testdata.properties in the Java
 * suite, where the same env-prefix convention was used.
 */
type DataBlock = Record<string, string[]>;

const SHARED: DataBlock = {
  HRMS_ROLES: [
    'Campaign Manager',
    'HRMS Admin',
    'PGR Administrator',
    'National Supervisor',
    'Distributor',
  ],
  HRMS_NAME: ['Automated-Test'],
  HRMS_GENDER: ['Female'],
  HRMS_DOB: ['2008-05-26'],
  HRMS_EMAIL: ['test@abc.com'],
  HRMS_ADDRESS: ['test address'],
  HRMS_TYPE: ['Permanent'],
  HRMS_DOA: ['2026-05-26'],
  HRMS_DEPARTMENT: ['Other', 'eGov'],
  HRMS_DESIGNATION: ['Health Officer'],
  HRMS_DEACTIVATION_REMARKS: ['Deactivating employee'],
};

const PER_ENV: Record<EnvName, DataBlock> = {
  uat: {
    COMPLAINT_TYPES: [
      'Not Enough Stock: Dept-eGov',
      'Sync Not Working: Dept-eGov',
      'Performance Issue: Dept-eGov',
      'Security Issue: Dept-eGov',
      'Data Issue: Dept-eGov',
      'User Account Issue: Dept-eGov',
      'Technical Issue: Dept-eGov',
    ],
    REJECTION_REASON: [
      'Resolved or Closed Issue',
      'Non-actionable Issue',
      'Insufficient or Missing Information',
      'Duplicate Complaint',
      'Invalid Complaint',
    ],
    ASSIGN_EMPLOYEE: ['Auto-Test-User'],
    HRMS_DEACTIVATION_REASON: [
      'User not present',
      'User not working',
      'Order by Commissioner',
      'Others',
    ],
    HRMS_REACTIVATION_REASON: ['Order by Commissioner', 'Others'],
  },
  demo: {
    COMPLAINT_TYPES: [
      'Technical Issue: Dept-eGov',
      'User Account Issue: Dept-eGov',
      'Data Issue: Dept-eGov',
      'Security Issue: Dept-eGov',
      'Performance Issue: Dept-eGov',
    ],
    REJECTION_REASON: [
      'Resolved or Closed Issue',
      'Non-actionable Issue',
      'Insufficient or Missing Information',
      'Duplicate Complaint',
      'Invalid Complaint',
    ],
    ASSIGN_EMPLOYEE: ['Auto-Test-User'],
    HRMS_DEACTIVATION_REASON: ['Order by Commissioner', 'Others'],
    HRMS_REACTIVATION_REASON: ['Order by Commissioner', 'Others'],
  },
  qa: {},
};

/** All configured values for a key, in declaration order. */
export function all(key: string): string[] {
  return PER_ENV[config.envName][key] ?? SHARED[key] ?? [];
}

/** The first configured value for a key. Throws if the key is not configured. */
export function get(key: string): string {
  const values = all(key);
  if (values.length === 0) {
    throw new Error(
      `No test data for "${key}" on environment "${config.envName}" — add it to src/config/testdata.ts`,
    );
  }
  return values[0];
}

/**
 * A random value for a key.
 *
 * Used where any configured value is equally valid (a department, a rejection
 * reason), so runs exercise the whole list over time instead of one entry
 * forever. Call it once per test and keep the result — calling it twice can
 * return two different values and break a multi-step flow.
 */
export function pickOne(key: string): string {
  const values = all(key);
  if (values.length === 0) {
    throw new Error(
      `No test data for "${key}" on environment "${config.envName}" — add it to src/config/testdata.ts`,
    );
  }
  return values[Math.floor(Math.random() * values.length)];
}
