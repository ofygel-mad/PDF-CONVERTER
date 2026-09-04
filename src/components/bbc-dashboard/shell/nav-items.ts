/**
 * Разделы дашборда — один список на все поверхности навигации.
 *
 * Раньше он жил внутри оболочки, и это работало, пока поверхность была одна:
 * лента вкладок наверху. Теперь их две — сайдбар на десктопе и ящик на
 * телефоне, — и список обязан быть внешним, иначе порядок разделов начнёт
 * расходиться между ними при первой же правке.
 *
 * Порядок здесь — порядок в меню, сверху вниз. Он не случайный: сначала долги
 * (за ними приходят каждый день), потом отчётность, в конце системное.
 */
import {
  AnalyticsIcon,
  CalendarIcon,
  ControlPanelIcon,
  JournalIcon,
  ReceivablesIcon,
  RegistriesIcon,
  ReportsIcon,
  RoadmapIcon,
  SalesIcon,
  TouchesIcon,
  WarningIcon,
} from "../icon";

export type BlockDefinition = {
  key: string;
  title: string;
  short: string;
  icon: typeof ReceivablesIcon;
  /** Право из области видимости, без которого раздел не показывается. */
  requires: string;
};

export const BLOCKS: BlockDefinition[] = [
  { key: "receivables", title: "Дебиторка", short: "Дебиторка", icon: ReceivablesIcon, requires: "receivables" },
  // Журнал касаний стоит сразу за дебиторкой: это её продолжение, а не
  // самостоятельный раздел. Из реестра в него проваливаются по клиенту.
  { key: "touches", title: "Журнал касаний", short: "Журнал касаний", icon: TouchesIcon, requires: "touches" },
  { key: "calendar", title: "Платёжный календарь", short: "Календарь", icon: CalendarIcon, requires: "calendar" },
  { key: "reports", title: "Отчёты", short: "Отчёты", icon: ReportsIcon, requires: "reports" },
  { key: "analytics", title: "Аналитика", short: "Аналитика", icon: AnalyticsIcon, requires: "analytics" },
  // «Журнал операций», а не «Журнал»: рядом теперь стоит журнал касаний, и
  // два одинаковых слова в одном меню читались бы как опечатка.
  { key: "journal", title: "Журнал операций", short: "Журнал операций", icon: JournalIcon, requires: "journal" },
  { key: "sales", title: "Отдел продаж", short: "Продажи", icon: SalesIcon, requires: "sales" },
  { key: "warnings", title: "Предупреждения", short: "Предупреждения", icon: WarningIcon, requires: "warnings" },
  { key: "roadmap", title: "Будущие инструменты", short: "Планы", icon: RoadmapIcon, requires: "roadmap" },
  // «Книги» стоят внизу, у панели управления, а не среди отчётов: это раздел
  // не про цифры, а про то, откуда они берутся. Сначала он назывался «Реестры»
  // и стоял третьим, рядом с журналом касаний, — и оказался неотличим от
  // «Журнала операций» по названию и непонятен по месту.
  //
  // Ключ остался `registries`: у выданных учёток право с таким именем уже
  // записано в базе, и переименование отняло бы у них раздел. Ключ — адрес,
  // название — то, что читает человек; менять их вместе незачем.
  { key: "registries", title: "Книги", short: "Книги", icon: RegistriesIcon, requires: "registries" },
];

/**
 * Панель управления — раздел, но не раздел данных.
 *
 * Область видимости её не ограничивает: у ссылок, выданных раньше, в базе
 * записан список из трёх блоков, и проверка по `scope.blocks` отняла бы у их
 * владельцев собственные настройки. Прятать тут нечего — данные приходят уже
 * отфильтрованными сервером, а это поверхность управления ими.
 *
 * В сайдбаре она прижата к низу и отделена чертой — по той же причине, по
 * которой в ленте вкладок была прижата вправо: это не про цифры, а про то,
 * как цифры считаются.
 */
export const CONTROL_BLOCK: BlockDefinition = {
  key: "control",
  title: "Панель управления",
  short: "Панель управления",
  icon: ControlPanelIcon,
  requires: "control",
};

/**
 * Подпись раздела по ключу — для мест, которые перечисляют разделы, но меню не
 * рисуют: полосы отдела и карточки сотрудника.
 *
 * Заведено после того, как в шапке руководителя отдела вылез английский ключ
 * `touches` посреди русских названий. Причина была не в опечатке: списков
 * названий в продукте жило три — этот, копия в department.ts и ещё одна в
 * access/employees.tsx. Журнал касаний добавили в два из трёх, и полоса отдела
 * честно напечатала ключ, потому что в её копии такого раздела не значилось.
 *
 * Возврат ключа как есть на неизвестном значении оставлен намеренно: выдумывать
 * название разделу, которого нет в списке, — врать. Но теперь список один, и
 * попасть в эту ветку можно только с правами на несуществующий раздел.
 */
const TITLE_BY_KEY: Record<string, string> = Object.fromEntries(
  [...BLOCKS, CONTROL_BLOCK].map((item) => [item.key, item.title]),
);

export function blockTitle(key: string): string {
  return TITLE_BY_KEY[key] ?? key;
}

/** Разделы, доступные вызывающему. Всегда заканчивается панелью управления. */
export function allowedBlocksFor(grantedBlocks: readonly string[]): BlockDefinition[] {
  const granted = new Set(grantedBlocks);
  const all = granted.has("*");
  return [...BLOCKS.filter((item) => all || granted.has(item.requires)), CONTROL_BLOCK];
}
