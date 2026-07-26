"use client";

/**
 * Blocks that are built but still waiting on their data source, plus the roadmap.
 *
 * They are shown rather than hidden, and each states exactly which data is
 * missing — the same honesty rule as the coverage chips. An empty screen that
 * explains itself is more useful than a hidden feature.
 */
import { RoadmapIcon } from "../icon";
import { SectionCard } from "./shared";

export function RoadmapBlock() {
  const items = [
    {
      title: "Тайм-трекинг и ценообразование",
      what: "Сколько времени сотрудник тратит на каждого клиента, эффективность по нагрузке и, на этой базе, план повышения или понижения цен.",
      missing: "Нужен тайм-трекинг — данных пока нет ни в одной таблице.",
    },
    {
      title: "Аналитика разовых услуг",
      what: "Скорость выполнения работ в часах, насколько растянута оплата после оказания, вывод о целесообразности направления.",
      missing: "Нужна дата завершения — «Период по» у разовых услуг (сейчас пусто у 22 строк).",
    },
    {
      title: "Активы и капитал",
      what: "Балансовый список движимого и недвижимого имущества, арендные объекты (склады, парковки, помещения), потенциальный прирост капитала.",
      missing: "В спецификации помечено как «не начато» — сбор данных ещё не стартовал.",
    },
    {
      title: "ФОТ по табелю",
      what: "Деление зарплаты между циклами по фактически отработанным дням, отпуска и больничные отдельной строкой (§4.2).",
      missing: "Нужен табель учёта рабочего времени — пока не сведён.",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Будущие инструменты"
        subtitle="То, что появится, когда подъедут данные. Каждый пункт честно называет, чего именно не хватает."
      >
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div
              key={item.title}
              className="row-item p-3 animate-fade-in"
              style={{
                animationDuration: "var(--dur-base)",
                animationDelay: `calc(${index} * var(--dur-stagger))`,
                animationFillMode: "backwards",
              }}
            >
              <div className="flex items-start gap-2.5">
                <span style={{ color: "var(--text-muted)", marginTop: 2 }}>
                  <RoadmapIcon size={15} />
                </span>
                <div>
                  <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </h4>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {item.what}
                  </p>
                  <p className="text-xs mt-1.5" style={{ color: "var(--accent-amber)" }}>
                    {item.missing}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
