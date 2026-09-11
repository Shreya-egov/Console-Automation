import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

/**
 * Fills the unified "Microplan Template" that the campaign's upload screen
 * generates, so the filled sheet can be uploaded back.
 *
 * A committed template cannot be used: the workbook the app generates is
 * campaign-specific. Its hidden _h_Meta_h_ sheet carries a campaign uuid, its
 * hidden _h_SimpleLookup_h_ sheet drives the cascading boundary dropdowns, and
 * its "Boundary List" arrives pre-populated with exactly the boundaries that
 * campaign selected. So this always edits the downloaded workbook and leaves
 * every hidden sheet untouched.
 *
 * Layout (verified against hcm-demo on 2026-09-09, BEDNET / CHAD - ITN):
 *   row 1 = localization keys, row 2 = human-readable headers, data from row 3.
 *
 * What the app requires the user to supply:
 *   Boundary List   - "Household Target at village level" is Mandatory; the
 *                     remaining target columns vary by campaign type.
 *   User List       - arrives empty; Phone Number and Employment Type are
 *                     Mandatory, and at least one role is needed.
 *   Facilities List - arrives pre-populated, but facilities default to a
 *                     "Facility Usage" of Inactive.
 */

const SHEET_BOUNDARY = 'Boundary List';
const SHEET_USERS = 'User List';
const SHEET_FACILITIES = 'Facilities List';

/** Row 1 holds localization keys; columns are resolved by key, never by index. */
const KEY_ROW = 1;
/** Data begins on the third row (after the key row and the header row). */
const FIRST_DATA_ROW = 3;

const KEY_BOUNDARY_CODE = 'HCM_ADMIN_CONSOLE_BOUNDARY_CODE';
const KEY_TARGET = 'HCM_ADMIN_CONSOLE_TARGET';
const KEY_FACILITY_USAGE = 'HCM_ADMIN_CONSOLE_FACILITY_USAGE';
const KEY_USER_NAME = 'HCM_ADMIN_CONSOLE_USER_NAME';
const KEY_USER_PHONE = 'HCM_ADMIN_CONSOLE_USER_PHONE_NUMBER';
const KEY_USER_ROLE_1 = 'HCM_ADMIN_CONSOLE_USER_ROLE_MULTISELECT_1';
const KEY_USER_EMPLOYMENT = 'HCM_ADMIN_CONSOLE_USER_EMPLOYMENT_TYPE';
const KEY_USER_USAGE = 'HCM_ADMIN_CONSOLE_USER_USAGE';
const KEY_ROW_ID = 'HCM_ADMIN_CONSOLE____ROW_ID';

/** Boundary-level columns carry the MICROPLAN_ prefix and differ per hierarchy. */
const BOUNDARY_LEVEL_PREFIX = 'MICROPLAN_';

const HOUSEHOLD_TARGET = 100;
const EMPLOYMENT_TYPE = 'Permanent';
const ACTIVE = 'Active';
const ROLE_DISTRIBUTOR = 'DISTRIBUTOR';
const ROLE_WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER';
/** One campaign user is enough to satisfy the User List; it must not be empty. */
const USER_COUNT = 1;

/** Level values of one boundary row, keyed by localization key. */
type BoundaryRow = Record<string, string>;

/** Column index (1-based) for each localization key present on a sheet. */
type ColumnMap = Map<string, number>;

/**
 * Fills the workbook at `downloaded` and writes the result to `filled`.
 *
 * @returns `filled`, for chaining straight into the upload call.
 */
export async function fillMicroplanTemplate(
  downloaded: string,
  filled: string,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(downloaded);

  const boundaries = fillBoundaryTargets(workbook);
  if (boundaries.length === 0) {
    throw new Error(
      `'${SHEET_BOUNDARY}' had no data rows — the campaign's boundaries were not ` +
        `carried into the template, so there is nothing to target.`,
    );
  }

  activateFacilities(workbook);
  const codeByPath = harvestBoundaryCodes(workbook);
  addDistributors(workbook, boundaries[0], codeByPath, USER_COUNT);
  addWarehouseManagerPerLevel(
    workbook,
    boundaries[0],
    codeByPath,
    FIRST_DATA_ROW + USER_COUNT,
  );

  fs.mkdirSync(path.dirname(path.resolve(filled)), { recursive: true });
  await workbook.xlsx.writeFile(filled);
  console.log(
    `[Template] Filled ${boundaries.length} boundary row(s) and added ` +
      `${USER_COUNT} user(s) -> ${filled}`,
  );
  return filled;
}

/**
 * Writes the mandatory household target, plus any campaign-type-specific target
 * columns, for every pre-populated boundary row.
 *
 * @returns each boundary row's level values and service boundary code, so the
 *          users added later sit on a boundary the campaign actually covers.
 */
function fillBoundaryTargets(workbook: ExcelJS.Workbook): BoundaryRow[] {
  const sheet = requireSheet(workbook, SHEET_BOUNDARY);
  const columns = keyToColumn(sheet);
  const rows: BoundaryRow[] = [];

  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (isBlank(row, columns.get(KEY_BOUNDARY_CODE))) continue;

    // Every target column is numeric; the mandatory one is KEY_TARGET and the
    // rest are campaign-type specific (e.g. TARGET_BEDNET_COLUMN_2/3).
    for (const [key, column] of columns) {
      if (key.startsWith(KEY_TARGET)) {
        row.getCell(column).value = HOUSEHOLD_TARGET;
      }
    }

    const captured: BoundaryRow = {};
    for (const [key, column] of columns) {
      if (key.startsWith(BOUNDARY_LEVEL_PREFIX) || key === KEY_BOUNDARY_CODE) {
        captured[key] = readString(row.getCell(column));
      }
    }
    rows.push(captured);
  }
  return rows;
}

/** Facilities arrive pre-populated but Inactive; a campaign needs them usable. */
function activateFacilities(workbook: ExcelJS.Workbook): void {
  const sheet = requireSheet(workbook, SHEET_FACILITIES);
  const columns = keyToColumn(sheet);
  const usageColumn = columns.get(KEY_FACILITY_USAGE);
  if (usageColumn === undefined) return;

  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (isBlank(row, columns.get(KEY_BOUNDARY_CODE))) continue;
    row.getCell(usageColumn).value = ACTIVE;
  }
}

/**
 * Appends the campaign's distributor users at the deepest boundary level.
 *
 * The level is resolved with the same contiguous-path walk the warehouse managers
 * use, so the distributor always sits at exactly the level the deepest warehouse
 * manager does. Copying whichever boundary cells happened to be non-empty could
 * straddle a gap in the path and put the two on different levels.
 *
 * Phone numbers are generated per run so repeated runs do not collide on an
 * already-registered number.
 */
function addDistributors(
  workbook: ExcelJS.Workbook,
  boundary: BoundaryRow,
  codeByPath: Map<string, string>,
  userCount: number,
): void {
  const sheet = requireSheet(workbook, SHEET_USERS);
  const columns = keyToColumn(sheet);
  const levels = orderedLevelKeys(columns);
  const boundaryPath = levelPath(boundary, levels, levels.length);

  const stamp = Date.now() % 100000;
  for (let i = 0; i < userCount; i++) {
    const row = sheet.getRow(FIRST_DATA_ROW + i);

    boundaryPath.forEach((value, depth) => {
      setIfPresent(row, columns, levels[depth], value);
    });
    const code = codeByPath.get(boundaryPath.join('|'));
    if (code !== undefined) {
      setIfPresent(row, columns, KEY_BOUNDARY_CODE, code);
    }

    // 10-digit number starting with 9, unique per run and per row.
    const phone = `9${pad(stamp, 5)}${pad(i, 4)}`;
    setIfPresent(row, columns, KEY_USER_NAME, `AutoTestUser${stamp}${i}`);
    setIfPresent(row, columns, KEY_USER_PHONE, phone);
    setIfPresent(row, columns, KEY_USER_ROLE_1, ROLE_DISTRIBUTOR);
    setIfPresent(row, columns, KEY_USER_EMPLOYMENT, EMPLOYMENT_TYPE);
    setIfPresent(row, columns, KEY_USER_USAGE, ACTIVE);
    // __ROW_ID is assigned by the server for new rows; leave it empty.
    setIfPresent(row, columns, KEY_ROW_ID, '');
  }
  console.log(
    `[Template] ${ROLE_DISTRIBUTOR} placed at ` +
      `${boundaryPath.length === 0 ? '(no boundary)' : boundaryPath.join(' / ')}`,
  );
}

/**
 * Adds one WAREHOUSE_MANAGER per boundary level, each scoped to a successively
 * deeper slice of the campaign's boundary path — a country-level manager, a
 * province-level one, and so on down to the village.
 *
 * @param boundary   the deepest boundary row, as captured from Boundary List
 * @param codeByPath service boundary codes keyed by joined level path
 * @param startRow   first free row in the User List (1-based)
 */
function addWarehouseManagerPerLevel(
  workbook: ExcelJS.Workbook,
  boundary: BoundaryRow,
  codeByPath: Map<string, string>,
  startRow: number,
): void {
  const sheet = requireSheet(workbook, SHEET_USERS);
  const columns = keyToColumn(sheet);
  const levels = orderedLevelKeys(columns);

  const stamp = Date.now() % 100000;
  let written = 0;
  for (let depth = 1; depth <= levels.length; depth++) {
    const boundaryPath = levelPath(boundary, levels, depth);
    // Hierarchy is shallower than this depth, so there is no level to scope to.
    if (boundaryPath.length < depth) continue;

    const row = sheet.getRow(startRow + written);
    for (let i = 0; i < depth; i++) {
      setIfPresent(row, columns, levels[i], boundaryPath[i]);
    }

    // Boundary List only carries the deepest boundary's code, so the codes for
    // shallower levels come from whichever sheet happens to list them.
    const code = codeByPath.get(boundaryPath.join('|'));
    if (code !== undefined) {
      setIfPresent(row, columns, KEY_BOUNDARY_CODE, code);
    } else {
      console.log(
        `[Template] no service boundary code found for ${boundaryPath.join(' / ')} — leaving it blank`,
      );
    }

    // Offset the phone series so it cannot collide with the distributor's.
    const phone = `9${pad(stamp, 5)}${pad(50 + written, 4)}`;
    setIfPresent(row, columns, KEY_USER_NAME, `AutoWhMgrL${depth}${stamp}`);
    setIfPresent(row, columns, KEY_USER_PHONE, phone);
    setIfPresent(row, columns, KEY_USER_ROLE_1, ROLE_WAREHOUSE_MANAGER);
    setIfPresent(row, columns, KEY_USER_EMPLOYMENT, EMPLOYMENT_TYPE);
    setIfPresent(row, columns, KEY_USER_USAGE, ACTIVE);
    setIfPresent(row, columns, KEY_ROW_ID, '');
    written++;
  }
  console.log(
    `[Template] added ${written} ${ROLE_WAREHOUSE_MANAGER} user(s), one per boundary level`,
  );
}

/**
 * Service boundary codes keyed by their joined level path, harvested from every
 * sheet that lists them. Boundary List holds only the campaign's target
 * boundaries, while Facilities List carries rows at several depths, so the two
 * together cover more levels than either alone.
 */
function harvestBoundaryCodes(workbook: ExcelJS.Workbook): Map<string, string> {
  const byPath = new Map<string, string>();

  for (const sheetName of [SHEET_BOUNDARY, SHEET_FACILITIES]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;
    const columns = keyToColumn(sheet);
    const codeColumn = columns.get(KEY_BOUNDARY_CODE);
    if (codeColumn === undefined) continue;
    const levels = orderedLevelKeys(columns);

    for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const code = readString(row.getCell(codeColumn));
      if (code === '') continue;

      const boundaryPath: string[] = [];
      for (const key of levels) {
        const value = readString(row.getCell(columns.get(key) as number));
        if (value === '') break;
        boundaryPath.push(value);
      }
      const joined = boundaryPath.join('|');
      if (boundaryPath.length > 0 && !byPath.has(joined)) {
        byPath.set(joined, code);
      }
    }
  }
  return byPath;
}

/**
 * The boundary path as a contiguous list of level values, shallowest first,
 * truncated to `depth`. Stops at the first empty level so a caller can never
 * straddle a gap in the path.
 */
function levelPath(boundary: BoundaryRow, levels: string[], depth: number): string[] {
  const boundaryPath: string[] = [];
  for (let i = 0; i < depth && i < levels.length; i++) {
    const value = boundary[levels[i]];
    if (!value) break;
    boundaryPath.push(value);
  }
  return boundaryPath;
}

/** Boundary-level column keys in sheet order, shallowest level first. */
function orderedLevelKeys(columns: ColumnMap): string[] {
  return [...columns.entries()]
    .filter(([key]) => key.startsWith(BOUNDARY_LEVEL_PREFIX))
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key);
}

// --- helpers ---

function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) {
    const present = workbook.worksheets.map((w) => w.name).join(', ');
    throw new Error(
      `Template has no '${name}' sheet. Sheets present: ${present} — the template format has changed.`,
    );
  }
  return sheet;
}

/** Maps each localization key in row 1 to its column index. */
function keyToColumn(sheet: ExcelJS.Worksheet): ColumnMap {
  const columns: ColumnMap = new Map();
  sheet.getRow(KEY_ROW).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const key = readString(cell);
    if (key !== '') columns.set(key, columnNumber);
  });
  return columns;
}

function setIfPresent(
  row: ExcelJS.Row,
  columns: ColumnMap,
  key: string,
  value: string,
): void {
  const column = columns.get(key);
  if (column !== undefined) row.getCell(column).value = value;
}

function isBlank(row: ExcelJS.Row, column: number | undefined): boolean {
  if (column === undefined) return true;
  return readString(row.getCell(column)) === '';
}

function readString(cell: ExcelJS.Cell | undefined): string {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(Math.trunc(value));
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
    if ('text' in value) return String(value.text).trim();
    if ('result' in value && value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
  }
  return '';
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0').slice(-width);
}
