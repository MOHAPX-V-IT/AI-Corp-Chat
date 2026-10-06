# Verification record / Журнал проверок

**Edition:** AI Corp Chat 0.1.0 · **Date:** 2026-10-06.

Checks run against the independent source copy. No production database, employee records or real uploaded files were used. / Проверки выполнены на независимой копии без рабочих баз, записей сотрудников и реальных пользовательских файлов.

| Check / Проверка | Result / Результат | Scope / Что подтверждено |
|---|---|---|
| Root `npm ci` | PASS | Clean dependency install after synchronizing the existing lockfile / Чистая установка после согласования lockfile |
| Nested MarketAnalysis and SupplierTools `npm ci` | PASS | Both business dependency sets install / Установка обоих наборов зависимостей |
| Final lockfile `npm ci --dry-run --ignore-scripts` | PASS | Manifest/lock consistency / Согласованность манифеста и lockfile |
| `npm run build` | PASS | Shared workspaces and production frontend / Общие пакеты и production-клиент |
| Neutral PWA assets and frontend rebuild | PASS | New icons packaged; compiled client scanned for original organization references / Новые иконки и отсутствие прежних привязок в клиенте |
| Custom data-schema build | PASS | IPR and newcomer factories restored in source, including newcomer target and transaction metadata / Модели ИПР/новичков и поля метаданных восстановлены в исходниках |
| `npm run test:portable` | PASS: 5 tests | Secret setup/idempotence, assistant templates, authenticated market policy, checker behavior, two-sheet market export / Настройка, шаблоны, доступ, проверка исходников и Excel из двух листов |
| `fresh-instance.cjs` | PASS | Disposable MongoDB, bootstrap twice, one initial administrator, 10 assistants, 8 IPR assistants, ACLs, health/login and authenticated module endpoints / Новая база, повторная инициализация и доступность модулей |
| Real DOCX round trip in fresh-instance test | PASS | Upload/parse; edit RU+EN in one revision; previous clause text history; stale revision rejected; Word export / DOCX, правки обоих языков, история, конфликт версии и Word |
| Separate-account translation history | PASS | Second user sees an empty personal list and cannot read another user's document / Второй аккаунт не видит и не читает чужой перевод |
| `mcp-smoke.cjs` | PASS | MCP handshake; 4 tool definitions; comparison Excel and 2 Word generators create actual ZIP-based artifacts / MCP, четыре инструмента и три документа |
| Market export test | PASS | Ranked brands and Others, reconciled totals, formulas, exactly 2 sheets; inconsistent totals block export / Ранжирование, «Другие», суммы, формулы, два листа и блокировка неверных итогов |
| `docker compose config -q` | PASS | Local Compose resolves and validates / Конфигурация локального Compose |
| Public HTTPS Compose overlay | PASS | Both Compose files resolve together / Совместная конфигурация с HTTPS |
| Public-source heuristic scan | PASS | Git-visible source set excludes configuration, keys and runtime data / Публикуемый набор исключает локальные ключи и данные |
| Documentation images | PASS | Real frontend components rendered with synthetic document/table fixtures; no production accounts / Реальные компоненты на синтетических данных |

## Corrections discovered by checks / Исправления по итогам проверки

- Synchronized missing declared database-driver dependencies in the root lockfile. / Добавлены недостающие объявленные зависимости драйверов.
- Made secret setup independent of CRLF line endings. / Генерация настроек работает с Windows-переносами строк.
- Ensured bootstrap exits after successful seeding despite persistent library timers. / Инициализация завершается после успешного заполнения.
- Restored IPR/newcomer model factories and runtime-added schema fields to buildable TypeScript source. / Восстановлены модели и поля, ранее существовавшие только в собранном пакете.
- Included the OCR loader source and automatic Gemini runtime patches. / Включены исходник OCR и автоматическое применение патчей Gemini.
- Removed the private reference-workbook description catalog and its provenance identifiers; kept an empty operator-owned template. / Удалены данные закрытого эталона и его идентификаторы, оставлен пустой шаблон.

## Not verified here / Что здесь не проверялось

- Complete Docker image/stack startup: Docker's Linux engine was not running on this workstation. Compose validation and native API smoke are separate checks. / Полный запуск Docker не выполнялся: Linux Engine не был запущен. Проверка Compose и обычного Node API — разные проверки.
- Live model generation, billing/quotas, Vertex vision, RAG/embeddings, OCR container, email, speech and external supplier/market research. No paid model or external research requests were issued. / Реальные модели, квоты, визуальный провайдер, RAG/OCR, почта, речь и исследование источников не тестировались.
- The entire upstream regression suite, full TypeScript check, lint, penetration tests and certification. The source scan is heuristic and cannot prove the absence of every possible secret. / Полный upstream-набор, типы, lint и аудит безопасности не выполнялись; эвристика не гарантирует отсутствие любого возможного секрета.
- Screenshots demonstrate UI components with explicitly synthetic fixtures, not successful live AI translation or market analysis. / Скриншоты показывают компоненты на синтетических данных, а не реальную генерацию.

Before using the application with real data, configure your own credentials and verify the full stack, role policy, document/model workflows and backups in your environment. / Перед эксплуатацией подключите свои ключи и проверьте всю установку, права, обработку документов и резервное восстановление.
