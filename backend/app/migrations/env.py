from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings

# Список метаданных живёт в отдельном модуле, а не здесь: этот файл при импорте
# запускает миграции (см. низ файла), поэтому взять список отсюда не может ни
# тест, ни что-либо ещё.
from app.migrations.metadata import target_metadata

config = context.config

# `fileConfig` перенастраивает логирование всего процесса. Для alembic из
# командной строки это ровно то, что нужно. А вот при вызове из приложения
# (`app.main._run_migrations` на старте) он затирал настройки uvicorn: после
# миграций пропадал журнал запросов и менялся формат строк. Приложение просило
# привести схему в порядок, а получало заодно другое логирование.
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)


#: Заглушка из alembic.ini. Настоящим адресом не является и означает «не задан».
_PLACEHOLDER_URL = "driver://user:pass@localhost/dbname"


def get_url() -> str:
    """Адрес базы: явно заданный в конфигурации, иначе из настроек приложения.

    Раньше здесь безусловно возвращался `settings.database_url`, и заданный
    вызывающим `sqlalchemy.url` молча игнорировался. Это не замечалось, потому
    что оба источника давали один и тот же адрес — но означало, что прогнать
    миграции на другой базе через `Config` было невозможно в принципе: alembic
    послушно шёл в ту, что в настройках. Первым же на это наступил тест,
    которому нужна временная база, а не рабочая.
    """
    explicit = (config.get_main_option("sqlalchemy.url", "") or "").strip()
    if explicit and explicit != _PLACEHOLDER_URL:
        return explicit
    return settings.database_url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
