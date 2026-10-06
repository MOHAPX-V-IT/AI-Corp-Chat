# Deployment / Развёртывание

## Local Docker / Локальный Docker

Run `npm run setup`, set your providers and account details in `.env`, then `docker compose config -q` and `docker compose up -d --build`. Open http://localhost:3088. Docker Desktop/Engine must already be running; source packaging does not start it. Secrets are installation-specific and ignored by Git. / Создайте настройки, подключите провайдеров, проверьте Compose и запустите сборку. Docker должен быть запущен отдельно; упаковка проекта его не запускает.

The source setup can be run before installing dependencies. The container build installs root dependencies and both nested business modules, applies included Gemini patches, builds workspace libraries/frontend and invokes idempotent bootstrap. / Настройка работает до установки зависимостей. Образ устанавливает зависимости и вложенные модули, применяет патчи, собирает библиотеки/клиент и инициализирует пустую установку.

## Public HTTPS / Внешний HTTPS

1. Provision a host and DNS; open only the intended HTTP/HTTPS entry points.
2. In `.env`, set `APP_DOMAIN=chat.example.com`, `DOMAIN_CLIENT=https://chat.example.com` and `DOMAIN_SERVER=https://chat.example.com`.
3. Supply fresh model/embedding/service credentials, review registration and manager permissions.
4. Run:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml config -q
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

RU: Подготовьте сервер/DNS, укажите свой домен и HTTPS-адреса, подключите ключи, проверьте права и запустите оба Compose-файла. Caddy получает сертификат при доступном домене; пример домена не публикует вашу установку автоматически.

## Native development / Разработка без контейнеров

Install root and nested dependencies, run `npm run build` to produce workspace packages. Provide your own reachable MongoDB, vector/RAG and search services. In your ignored `.env`, change `MONGO_URI`, `MEILI_HOST`, `RAG_API_URL`, telemetry URL and `CONFIG_PATH` to local endpoints/paths. Set `APP_ROOT` to this repository's absolute path with forward slashes, and set `SUPPLIER_ARTIFACTS_DIR` to an owned writable local directory. The default `/app` values are container paths. Set browser domains and backend/frontend ports consistently. `npm run backend:dev` and `npm run frontend:dev` run the respective processes; Vite alone does not start databases.

RU: Установите зависимости и соберите общие пакеты. Подключите доступные локальные базы/RAG/поиск. Замените контейнерные URL и `/app`-пути в `.env`: `CONFIG_PATH`, `APP_ROOT` (прямые слеши), каталог результатов MCP. Согласуйте домены и порты клиента/сервера. Команды разработки запускают соответствующие процессы; один Vite не поднимает базы.

## Backups / Резервные копии

Preserve `mongo_data`, `uploads`, `vector_data`, `meili_data` where required, and gateway state. Store `.env`/service keys separately with restricted access and encryption. Test restore using an isolated installation and a copy of source at the same version. Stop or coordinate writers for a consistent backup. / Сохраняйте базы и документы согласованно, ключи — отдельно с ограниченным доступом. Проверяйте восстановление в независимой установке той же версии. Исходный код сам по себе не сохраняет документы/историю.

Do not run `docker compose down -v` as a normal update procedure. Back up, build the new image, recreate the API and verify health/login/export with synthetic records. Changing a database password variable does not automatically rotate credentials inside an existing initialized volume. / Не удаляйте тома при обычном обновлении. Новое значение пароля в конфигурации не меняет автоматически пароль в уже созданной базе.

## Troubleshooting / Диагностика

| Symptom / Симптом | Check / Проверка |
|---|---|
| Cannot connect to Docker daemon | Start Docker Desktop/Engine with Linux containers / Запустите Docker |
| MongoDB authentication fails | Generated URI/password and volume initialization / URI, пароль и существующие тома |
| Model is unavailable or 429 | Your key, model ID, billing, quota; use bounded retries / Свой ключ, модель, квота, ограниченные повторы |
| PDF reading fails with text provider configured | Gemini/Vertex credentials and readable PDF / Отдельные визуальные ключи и качество PDF |
| File search returns no relevant context | Your corpus, embeddings provider and RAG connectivity / Свои документы, эмбеддинги, связь с RAG |
| IPR button is absent | Manager position and agent `ipr_enabled`/target / Роль руководителя и флаги ассистента |
| Manual save returns 409 | Refresh/reconcile the current document revision / Обновите и согласуйте версию |
| MCP download link is wrong | `DOMAIN_CLIENT` and artifact location / Адрес своей установки и каталог |

Check logs with `docker compose logs --tail=100 api rag_api`; redact before sharing. / Проверяйте логи, обезличивая их перед отправкой.
