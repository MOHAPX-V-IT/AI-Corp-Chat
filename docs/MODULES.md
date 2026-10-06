# Module guide / Руководство по модулям

| Module / Модуль | Entry / Вход | Saved output / Результат | Dependencies / Зависимости |
|---|---|---|---|
| Chat / Чат | `/c/new`, conversation messages and attachments | Personal messages, ratings, exports | Chosen provider; retrieval when enabled |
| Assistants / Ассистенты | Assistant catalog and builder | Instructions, tools, grants | Configured model, own knowledge corpus |
| Market / Рынок | `/market-analysis`, spreadsheets/documents and conversation | Analysis memory, source metadata, market and dosage tables, two-sheet XLSX | Text model, Gemini/Vertex for visual reading, detailed authorized data |
| Translation / Перевод | `/translation`, DOCX/PDF | Bilingual columns, revision counter, clause history, RU/EN DOCX | Text model, Gemini/Vertex for visual PDF reading |
| Transcripts / Транскрипты | `/transcripts`, permitted manager uploads | Stored transcript material and analyses | Role access and parser/model |
| IPR / ИПР | `/ipr`, Save to IPR on enabled coaching agents | Employee history, analyses, dynamics | RM/RGR/ROP/TRAINER/admin policy and model |

## Market / Рынок

EN: Upload authorized exports and describe the intended market. The agent studies structure before mapping columns, remembers agreed scope, uses programmatic calculations and asks only blocking questions. Public DSM Group/AlphaRM research complements uploads; conflicting or overlapping sources must remain distinguishable. Human review checks reporting period, units, brand grouping, dosage and registration fields, missing values and comments. A single export button produces two user-facing Excel sheets; technical provenance/check structures remain in application state.

RU: Загрузите разрешённую выгрузку и опишите рынок. Агент изучает структуру до сопоставления колонок, сохраняет договорённости, использует программные расчёты и задаёт только необходимые вопросы. Публичные материалы DSM Group/AlphaRM дополняют исходники; противоречащие или пересекающиеся источники нельзя незаметно смешивать. При проверке уточните период, единицы, группировку брендов, дозировки, регистрацию, пропуски и комментарии. Одна кнопка отдаёт два пользовательских листа Excel; технические проверки и происхождение данных остаются в приложении.

## Translation / Перевод

EN: Upload DOCX or readable PDF (20 MB; PDF up to 80 pages), wait for processing, open preview, select a clause and either ask the assistant or choose manual editing. Both Russian and English fields are editable regardless of source language. Save validates the captured revision, records previous clause texts, advances one document revision when content changes and updates preview/export. The original upload is retained. A 409 means another change won the race: refresh the document before reconciling edits. The draggable chat is constrained only by the browser viewport.

RU: Загрузите DOCX или читаемый PDF (до 20 МБ, PDF до 80 страниц), дождитесь обработки и выберите пункт в предпросмотре. Попросите ИИ изменить его либо откройте ручную правку: доступны оба языка независимо от языка исходника. Сохранение проверяет актуальность версии, записывает прежний текст пункта, создаёт новую версию при изменении и обновляет предпросмотр/экспорт. Оригинал загрузки сохраняется. Ошибка 409 означает конкурирующую правку: обновите документ и согласуйте изменения. Чат перемещается по всей видимой области браузера.

## Development / Развитие

EN: Analyze your own transcript with a coaching assistant whose `ipr_enabled` flag is set. Eligible managers can save the completed analysis to the selected employee/category, search history and request dynamics. Original employee histories are deliberately absent. Admin/ROP/TRAINER may see broader records than RM; this hierarchy differs from personal translation ownership. Saved AI advice is not an employment decision.

RU: Разберите свой транскрипт ассистентом с флагом `ipr_enabled`. Руководитель с нужными правами сохраняет результат для выбранного сотрудника/категории, ищет историю и анализирует динамику. Прежней истории сотрудников в копии нет. Администратор/РОП/тренер могут видеть больше записей, чем РМ; это отличается от личного доступа к переводам. Рекомендации ИИ не являются кадровым решением.

## Supplier tools / Инструменты поставщиков

The `supplier-tools` MCP server preserves `check_supplier_reputation`, `create_comparison_xlsx`, `create_bilingual_docx` and `create_reputation_report_docx`. It uses your configured public application URL for download links and its own artifact directory. Source web pages and model interpretation need independent verification. / MCP-сервер сохраняет проверку репутации, сравнительный Excel, билингвальный Word и отчёт о репутации. Ссылки используют URL вашей установки и отдельный каталог результатов; источники и интерпретации требуют проверки.
