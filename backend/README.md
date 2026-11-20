# Локальный запуск Fitness API

Нужны Node.js 22 или новее, npm, PostgreSQL и psql. Из папки backend на машине с локальной базой под текущей ролью PostgreSQL выполните:

```sh
createdb fitness_tracker_dev
psql -v ON_ERROR_STOP=1 -d fitness_tracker_dev -f migrations/001_initial.sql
psql -v ON_ERROR_STOP=1 -d fitness_tracker_dev -f migrations/002_catalog_ru.sql
npm ci
```

Для запуска задайте переменную PGDATABASE со значением fitness_tracker_dev. При необходимости укажите PGUSER, PGHOST, PGPASSWORD и PGPORT для подключения. Вместо них можно передать строку подключения через DATABASE_URL. Пароли задаются в окружении процесса.

В PowerShell для локального PostgreSQL:

```powershell
$env:PGDATABASE = "fitness_tracker_dev"
$env:PGUSER = "postgres"
npm start
```

В Bash:

```sh
PGDATABASE=fitness_tracker_dev npm start
```

Откройте в браузере:

- http://127.0.0.1:3000/api/health — проверка подключения к базе.
- http://127.0.0.1:3000/api/exercises — каталог из PostgreSQL. Фильтры q, equipment, muscle_id, goal и difficulty можно сочетать. В поиске по названию «е» и «ё» равнозначны.
- http://127.0.0.1:3000/api/exercises?q=жим — поиск по названию. Для полной карточки добавьте числовой id результата к пути /api/exercises/.
- http://127.0.0.1:3000/api/exercisedb/EIeI8Vf — внешняя карточка с русским переводом. Требуется доступ к ExerciseDB. Ответ содержит источник для атрибуции в интерфейсе.

Миграция 001 создаёт схему на пустой базе. Миграция 002 добавляет пять авторских русских записей. Поиск работает локально. Внешние карточки запрашиваются по строковому идентификатору поставщика, их ответы не записываются в PostgreSQL. Для записей тренировок используется числовой id локального упражнения.
