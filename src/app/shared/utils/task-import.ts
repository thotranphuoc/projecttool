import { CreateTaskDto, TaskPriority, TaskStatus } from '../models/task.model';

/** Dòng JSON thô như bạn cung cấp (keys tiếng Việt). */
export interface RawTaskJsonItem {
  'Mã Task': string;
  'Tên Task': string;
  'Start Date': string;
  'End Date': string;
}

/** Một dòng sau khi parse, dùng cho preview + import. */
export interface TaskImportRow {
  code: string;
  name: string;
  startDateText: string;
  endDateText: string;
  startDateIso: string | null;
  endDateIso: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  error?: string;
}

/** Kết quả parse toàn bộ JSON để hiển thị preview. */
export interface TaskImportParseResult {
  rows: TaskImportRow[];
  /** Lỗi ở cấp file (ví dụ JSON không hợp lệ). */
  fatalError?: string;
}

const DEFAULT_STATUS: TaskStatus = 'todo';
const DEFAULT_PRIORITY: TaskPriority = 'medium';

/** Parse chuỗi ngày dd/MM/yyyy → ISO YYYY-MM-DD; trả về null nếu không hợp lệ. */
export function parseDdMmYyyy(dateText: string | undefined | null): string | null {
  if (!dateText) return null;
  const trimmed = dateText.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  // JS Date: month is 0-based
  const d = new Date(Date.UTC(year, month - 1, day));
  // Validate again to avoid 32/13/2026 kiểu sai.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  // Supabase/Postgres đang dùng DATE, có thể gửi 'YYYY-MM-DD'
  return d.toISOString().slice(0, 10);
}

/** Từ mảng Raw JSON tạo ra các dòng preview (kể cả lỗi từng dòng). */
export function buildImportRows(rawItems: RawTaskJsonItem[]): TaskImportRow[] {
  return rawItems.map((item) => {
    const code = (item['Mã Task'] ?? '').toString().trim();
    const name = (item['Tên Task'] ?? '').toString().trim();
    const startDateText = (item['Start Date'] ?? '').toString().trim();
    const endDateText = (item['End Date'] ?? '').toString().trim();

    const startDateIso = parseDdMmYyyy(startDateText);
    const endDateIso = parseDdMmYyyy(endDateText);

    let error: string | undefined;
    if (!code) {
      error = 'Thiếu Mã Task';
    } else if (!name) {
      error = 'Thiếu Tên Task';
    } else if (!startDateIso || !endDateIso) {
      error = 'Ngày không đúng định dạng dd/MM/yyyy';
    } else if (startDateIso > endDateIso) {
      error = 'Start Date lớn hơn End Date';
    }

    return {
      code,
      name,
      startDateText,
      endDateText,
      startDateIso,
      endDateIso,
      status: DEFAULT_STATUS,
      priority: DEFAULT_PRIORITY,
      error,
    };
  });
}

/** Parse raw JSON string (mảng object) → kết quả preview. */
export function parseTaskImportJson(jsonText: string): TaskImportParseResult {
  if (!jsonText.trim()) {
    return { rows: [], fatalError: 'Nội dung trống' };
  }
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      return { rows: [], fatalError: 'JSON phải là một mảng các object' };
    }
    const rows = buildImportRows(parsed as RawTaskJsonItem[]);
    return { rows };
  } catch (e) {
    return { rows: [], fatalError: 'JSON không hợp lệ: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Từ các dòng hợp lệ sinh ra mảng CreateTaskDto để gửi lên Supabase. */
export function toCreateTaskDtos(
  rows: TaskImportRow[],
  projectId: string
): CreateTaskDto[] {
  return rows
    .filter((row) => !row.error && row.startDateIso && row.endDateIso)
    .map((row): CreateTaskDto => ({
      project_id: projectId,
      title: row.name,
      status: row.status ?? DEFAULT_STATUS,
      priority: row.priority ?? DEFAULT_PRIORITY,
      labels: [row.code],
      assignees_preview: [],
      start_date: row.startDateIso,
      due_date: row.endDateIso,
      linked_kr_id: null,
      contribution_weight: 1,
    }));
}

