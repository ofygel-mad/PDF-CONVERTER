/**
 * BBC Dashboard — API contracts.
 * Mirrors backend/app/bbc/schemas.py and the dataset payload. Keep both in sync.
 */

/* ── Access ─────────────────────────────────────────────────────────────────── */

export type BbcMe = {
  authenticated: boolean;
  username: string | null;
  role: string | null;
  /** Set when the caller arrived through a department referral link. */
  link_label: string | null;
  /** Когда эта ссылка перестанет работать. null — бессрочная. */
  link_expires_at?: string | null;
  departments: string[];
  blocks: string[];
  is_admin: boolean;
  /** True before the first admin exists — the UI offers initial setup. */
  needs_setup: boolean;
};

export type BbcLink = {
  id: string;
  label: string;
  departments: string[];
  blocks: string[];
  created_at: string | null;
  /** null = permanent («публичная») link. */
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  use_count: number;
  is_active: boolean;
  /** Адрес ссылки. Приходит и при выдаче, и в списке — но только пока она жива. */
  url: string | null;
};

export type BbcOk = { ok: boolean; detail: string | null };

/* ── Data ───────────────────────────────────────────────────────────────────── */

/** Recognition modes, exactly as the backend names them. */
export type BbcMode =
  | "v2:prorata:prepay"
  | "v2:prorata:wip"
  | "v2:start:prepay"
  | "v2:start:wip"
  | "v1:period:prorata:prepay"
  | "v1:period:prorata:wip"
  | "v1:period:start:prepay"
  | "v1:period:start:wip"
  | "v1:avrdate";

/** [year, month, cycle, amount] — compact wire form of one allocation entry. */
export type BbcAllocation = [number, number, number, number];

export type BbcRecognition = {
  alloc: BbcAllocation[];
  /** Earned but not placeable yet — «на исполнении». */
  wip: number;
};

export type BbcPayment = { at: string | null; amount: number | null };

export type BbcRow = {
  /** 1-based row number in the sheet — used by the warnings block. */
  index: number;
  month: number | null;
  /** «ИЮНЬ 2026» либо «Старые (до Мая/Июня 2026)» — строка входящего остатка. */
  period_label: string;
  client: string;
  contract_no: string;
  subject: string;
  firm: string;
  firm_name: string;
  departments: string[];
  employee: string;
  service_kind: string;
  status: string;

  contract_amount: number | null;
  paid_amount: number | null;
  avr_amount: number | null;
  saldo_start: number | null;
  saldo_end: number | null;
  diff_avr_paid: number | null;

  invoiced: boolean | null;
  invoice_no: string;
  invoice_date: string | null;
  paid: boolean | null;
  payments: BbcPayment[];
  avr_signed: boolean | null;
  avr_date: string | null;
  period_start: string | null;
  period_end: string | null;
  signed_at: string | null;

  /**
   * Долг строки — колонка «Дебет / Кредит (в т.ч без АВР)».
   * Считает книга, а не мы: начальный остаток плюс суммы договоров по
   * наступившим периодам, минус оплаты.
   */
  debt: number | null;
  /** Период не наступил («Еще рано»). Это предстоящее, а не долг. */
  debt_pending: boolean;
  /** В колонке долга формульная ошибка — строка идёт в «Предупреждения». */
  debt_broken: boolean;
  /** Долг до учётных периодов. Есть только у строки «Старые…». */
  carry_in: number | null;
  /**
   * Договор вступил в силу. «Вид Услуги» = «нет» означает, что услуга ещё не
   * определена: договор зафиксирован в реестре, но платить по нему не за что.
   * Такие суммы в дебиторку не входят — их и отделы у себя не считают.
   */
  in_force: boolean;

  recognition: Record<BbcMode, BbcRecognition>;
};

export type BbcDimensions = {
  firms: string[];
  departments: string[];
  employees: string[];
  service_kinds: string[];
  statuses: string[];
  clients: string[];
  months: string[];
};

export type BbcCoverage = {
  rows: number;
  with_department: number;
  with_period_start: number;
  with_period_end: number;
  with_contract_amount: number;
  invoiced: number;
  avr_signed: number;
  paid: number;
  one_off_without_end: number;
  unassigned_rows: number;
  with_debt: number;
  debt_pending_rows: number;
  debt_broken_rows: number;
  not_in_force_rows: number;
};

export type BbcSeverity = "critical" | "important" | "info";

export type BbcWarning = {
  code: string;
  severity: BbcSeverity;
  title: string;
  /** What the anomaly does to the numbers. */
  detail: string;
  /** What to change in the source sheet. */
  hint: string;
  count: number;
  amount: number;
  rows: number[];
  truncated: boolean;
  samples: string[];
};

export type BbcWarningsSummary = {
  total: number;
  critical: number;
  important: number;
  info: number;
  rows_affected: number;
  amount_at_risk: number;
};

export type BbcPreset = { mode: BbcMode; title: string };

export type BbcSourceState = {
  fetched_at: string | null;
  row_count: number;
  error: string | null;
};

export type BbcDataset = {
  revision: number;
  changed_at: string | null;
  scope: { departments: string[]; blocks: string[]; label: string };
  modes: BbcMode[];
  default_mode: BbcMode;
  presets: Record<string, BbcPreset>;
  mode_descriptions: Record<BbcMode, string>;
  rows: BbcRow[];
  dimensions: BbcDimensions;
  coverage: BbcCoverage;
  warnings: BbcWarning[];
  warnings_summary: BbcWarningsSummary;
  sources: Record<string, BbcSourceState>;
};

/* ── Платёжный календарь ────────────────────────────────────────────────────── */

export type BbcCalendarMethod = "contract" | "statistical" | "predictive";

export type BbcLagStats = {
  sample: number;
  median: number;
  mean: number;
  p80: number;
  worst: number;
};

export type BbcExpectation = {
  row_index: number;
  client: string;
  departments: string[];
  amount: number;
  expected_at: string;
  /** Что легло в основу даты: дата счёта или начало периода. */
  anchor: "invoice" | "period";
  /** personal — по истории клиента, global — по общей статистике, plan — по договору. */
  basis: "personal" | "global" | "plan";
  days_overdue: number;
  invoiced: boolean;
};

export type BbcCalendar = {
  method: BbcCalendarMethod;
  title: string;
  hint: string;
  stats: BbcLagStats;
  clients_with_history: number;
  /** Сколько строк реально получили личный прогноз, а не откат на общий. */
  personal_rows: number;
  expectations: BbcExpectation[];
  by_day: Record<string, { amount: number; count: number; overdue: number }>;
  total: number;
  overdue_total: number;
  overdue_count: number;
  accuracy: Array<{ month: string; predicted: number; actual: number; hit_rate: number }>;
  methods: Array<{ key: BbcCalendarMethod; title: string; hint: string }>;
};

/* ── Отдел продаж ───────────────────────────────────────────────────────────── */

export type BbcPayrollLine = {
  name: string;
  role: string;
  fixed: number;
  bonus: number;
  net: number;
  taxes: number;
  total: number;
};

export type BbcSpendLine = { name: string; channel: string; plan: number; fact: number };

export type BbcChannelResult = {
  channel: string;
  spend: number;
  revenue: number;
  deals: number;
  /** Тенге выручки на тенге расхода; null, когда расхода на канал не было. */
  roi: number | null;
};

export type BbcSalesReport = {
  worksheet: string;
  revenue_plan: number;
  revenue_fact: number;
  plan_completion: number;
  per_mop: Array<{ name: string; revenue: number }>;
  payroll_plan: BbcPayrollLine[];
  payroll_fact: BbcPayrollLine[];
  contractors: BbcSpendLine[];
  ad_budget: BbcSpendLine[];
  expense_plan: number;
  expense_fact: number;
  margin_fact: number;
  channels: BbcChannelResult[];
  registry: Array<Record<string, unknown>>;
  tabs: string[];
};

/* ── Журнал ─────────────────────────────────────────────────────────────────── */

export type BbcJournalRow = {
  index: number;
  at: string | null;
  account: string;
  counterparty: string;
  firm: string;
  category: string;
  subcategory: string;
  project: string;
  contract: string;
  comment: string;
  inflow: number;
  outflow: number;
  net: number;
};

export type BbcJournalSummary = {
  group: string;
  group_title: string;
  measure: string;
  measure_title: string;
  items: Array<{ key: string; value: number; count: number; inflow: number; outflow: number }>;
  total: number;
  rows: number;
  covered_rows: number;
  /** Доля операций, попавших в свод: для категории это около трети. */
  coverage: number;
  missing_rows: number;
  missing_value: number;
  truncated: boolean;
};

export type BbcJournalCoverage = {
  rows: number;
  with_date: number;
  with_counterparty: number;
  with_firm: number;
  with_account: number;
  with_category: number;
  with_subcategory: number;
  inflow: number;
  outflow: number;
  net: number;
};

export type BbcJournalPayload = {
  rows: BbcJournalRow[];
  coverage: BbcJournalCoverage;
  dimensions: Record<string, string[]>;
  summary: BbcJournalSummary;
  groups: Array<{ key: string; title: string }>;
  measures: Array<{ key: string; title: string }>;
};

export type BbcMsfoExport = {
  spreadsheet_id: string;
  url: string;
  sheets: string[];
  rows: number;
  exported_at: string;
};

export type BbcRevision = {
  revision: number;
  changed_at: string | null;
  rows: number;
  sources: Record<string, BbcSourceState>;
};

/* ── Legacy (kept: the raw-grid endpoints still exist) ───────────────────────── */

export type BbcStatus = {
  enabled: boolean;
  configured: boolean;
  spreadsheet_id: string | null;
  worksheet_name: string;
  credentials_available: boolean;
  detail: string | null;
};

export type BbcSheetInfo = { title: string; index: number; rows: number; cols: number };

export type BbcSnapshot = {
  worksheet: string;
  headers: string[];
  rows: string[][];
  row_count: number;
  fetched_at: string;
  metrics: Record<string, unknown>;
};
