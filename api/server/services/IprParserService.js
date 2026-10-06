const { logger } = require('@librechat/data-schemas');
const { deepseekGenerate, recordDeepseekUsage } = require('~/server/services/deepseekClient');

// [LOCAL-DEEPSEEK] was Google Gemini (gemini-3-flash-preview). Rollback: git reset --hard pre-deepseek
const IPR_PARSE_MODEL = process.env.IPR_PARSE_MODEL || 'deepseek-v4-flash';

/**
 * Parse conversation dialog and extract IPR data using AI
 * @param {Object} conversation - Conversation object with messages
 * @returns {Promise<Object>} - Parsed IPR data
 */
async function parseDialogForIpr(conversation, options = {}) {
  try {
    const messages = conversation.messages || [];

    // Log message structures for debugging
    if (messages.length > 1) {
      const aiMsg = messages[1];
      if (Array.isArray(aiMsg.content)) {
        logger.info(`[IprParserService] AI content array has ${aiMsg.content.length} items`);
        aiMsg.content.forEach((part, idx) => {
          const preview = JSON.stringify(part).substring(0, 300);
          logger.debug(`[IprParserService] Content[${idx}] type=${part.type}: ${preview}...`);
        });
      }
    }

    // Extract text from messages (handle different formats)
    // dialogText - всё включая thinking (для AI парсера - больше контекста)
    // displayText - без thinking (для отображения в "Полный анализ")
    const extractedMessages = messages.map((msg, msgIdx) => {
      const sender = msg.isCreatedByUser ? 'Менеджер' : 'AI';
      let fullText = '';
      let displayText = '';

      if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
        fullText = msg.text;
        displayText = msg.text;
      } else if (typeof msg.content === 'string') {
        fullText = msg.content;
        displayText = msg.content;
      } else if (Array.isArray(msg.content)) {
        const allParts = [];
        const visibleParts = [];

        msg.content.forEach((part) => {
          if (typeof part === 'string') {
            allParts.push(part);
            visibleParts.push(part);
          } else if (part.text) {
            allParts.push(part.text);
            visibleParts.push(part.text);
          } else if (part.think) {
            allParts.push(part.think); // для AI парсера
            // НЕ добавляем в visibleParts - убираем thinking из отображения
          } else if (part.content) {
            allParts.push(part.content);
            visibleParts.push(part.content);
          }
        });

        fullText = allParts.filter(t => t).join('\n\n');
        displayText = visibleParts.filter(t => t).join('\n\n');
      } else if (msg.content && typeof msg.content === 'object') {
        const t = msg.content.text || msg.content.content || '';
        fullText = t || msg.content.think || JSON.stringify(msg.content);
        displayText = t;
      }

      logger.debug(`[IprParserService] Message ${msgIdx}: sender=${sender}, fullText=${fullText.length} chars, displayText=${displayText.length} chars`);
      return { sender, fullText, displayText };
    });

    const dialogText = extractedMessages
      .map(m => `${m.sender}: ${m.fullText}`)
      .join('\n\n');

    const displayDialogText = extractedMessages
      .map(m => `**${m.sender}:**\n${m.displayText}`)
      .filter(m => m.trim() !== '**Менеджер:**\n' && m.trim() !== '**AI:**\n')
      .join('\n\n---\n\n');

    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDateRu = new Date().toLocaleDateString('ru-RU'); // DD.MM.YYYY

    // Log the dialog text for debugging
    logger.debug(`[IprParserService] Dialog text (${dialogText.length} chars):\n${dialogText.substring(0, 500)}...`);

    const { iprTarget } = options;

    let prompt;
    if (iprTarget === 'NEWCOMER_MP') {
      prompt = `Ты - AI ассистент, который анализирует диалоги об адаптации новых сотрудников и извлекает данные для ИПР (Индивидуальный План Развития новичка).

ТЕКУЩАЯ ДАТА: ${currentDateRu} (${currentDate})

Из диалога извлеки JSON:
{
  "employeeName": "ФИО нового сотрудника (новичка)",
  "eventDate": "YYYY-MM-DD",
  "classification": "Анализ адаптации | Анализ собеседования | План онбординга | Оценка прогресса | Анализ Big Five",
  "focusSkills": ["навык1", "навык2", "навык3"],
  "summary": "Развёрнутое резюме до 10 предложений"
}

ВАЖНЫЕ ТРЕБОВАНИЯ:

1. **employeeName**: Ищи ФИО нового сотрудника / новичка / кандидата:
   - Это может быть в контексте: "новичок Иванов", "кандидат Петрова А.", "сотрудник на испытательном сроке"
   - Также может быть в системном контексте профиля новичка
   - Если не найдено - поставь "Не указано"

2. **eventDate**:
   - Если дата указана явно - используй её
   - Если НЕ указана - используй ТЕКУЩУЮ ДАТУ: ${currentDate}

3. **focusSkills**: Извлеки ВСЕ компетенции и навыки, которые обсуждались:
   - Продуктовое знание, техника продаж, коммуникация, работа с CRM, знание рынка
   - Soft skills: стрессоустойчивость, обучаемость, командная работа, самоорганизация
   - Адаптационные навыки: понимание процессов, встраивание в команду, инициативность
   - Минимум 2-3 навыка

4. **classification**:
   - "Анализ собеседования" - если разбор результатов интервью или резюме кандидата
   - "План онбординга" - если составление или обсуждение плана адаптации
   - "Анализ адаптации" - если оценка хода адаптации, прогресса новичка
   - "Оценка прогресса" - если промежуточная или итоговая оценка работы новичка
   - "Анализ Big Five" - если обсуждение результатов личностного теста

5. **summary**: Развёрнутое резюме (до 10 предложений) в ДЕЛОВОМ стиле. Что анализировалось, какие сильные стороны выявлены у новичка, какие зоны роста, рекомендации по адаптации

ДИАЛОГ:

${dialogText}`;
    } else {
      prompt = `Ты - AI ассистент, который анализирует диалоги менеджеров и извлекает данные для ИПР (Индивидуальный План Развития).

ТЕКУЩАЯ ДАТА: ${currentDateRu} (${currentDate})

Из диалога извлеки JSON:
{
  "employeeName": "ФИО сотрудника или инициалы",
  "eventDate": "YYYY-MM-DD",
  "classification": "Серия визитов | Двойной визит | Тройной визит | Анализ коучинга | Анализ одного визита",
  "focusSkills": ["навык1", "навык2", "навык3"],
  "summary": "Развёрнутое резюме до 10 предложений: ключевые выводы, сильные и слабые стороны, что улучшить"
}

ВАЖНЫЕ ТРЕБОВАНИЯ:

1. **employeeName**: Ищи ФИО или инициалы в ЛЮБОМ формате:
   - "Иванов Иван Иванович", "Иванова А.", "РМ Петров", "МП Сидоров А.А."
   - Даже если указано как "РМ Ослопова А." - извлеки "Ослопова А."
   - Если не найдено - поставь "Не указано"

2. **eventDate**:
   - Если дата указана явно (например "13 февраля", "сегодня", "17.10.2023") - используй её
   - Если НЕ указана - используй ТЕКУЩУЮ ДАТУ: ${currentDate}

3. **focusSkills**: ОБЯЗАТЕЛЬНО извлеки ВСЕ навыки/компетенции, которые обсуждались:
   - "продажи", "работа с возражениями", "SPIN-техника", "установление контакта", "презентация", "триггеры", "закрытие сделки"
   - Ищи навыки в тексте диалога, особенно в разделах "Рекомендации", "Области развития", "План развития"
   - Минимум 2-3 навыка, если они есть в диалоге

4. **classification**:
   - "Анализ коучинга" - если коуч-сессия, обратная связь, развивающая беседа, анализ работы менеджера
   - "Двойной визит" / "Тройной визит" - если РМ/РГР ездил с МП к клиентам
   - "Серия визитов" - если анализ нескольких визитов подряд
   - "Анализ одного визита" - если разбор одного визита, записи звонка/встречи

5. **summary**: Развёрнутое резюме (до 10 предложений) в ДЕЛОВОМ стиле, без метафор и креатива. Строго по фактам: что анализировалось, какие сильные стороны выявлены, какие проблемы обнаружены, что конкретно нужно улучшить. Пиши как для официального отчёта руководителю

ДИАЛОГ:

${dialogText}`;
    }

    const { text: rawText, usage } = await deepseekGenerate({
      prompt,
      model: IPR_PARSE_MODEL,
      maxTokens: 2048,
      json: true,
    });
    // Record token spend so this custom DeepSeek call is visible in balance/admin stats.
    await recordDeepseekUsage({
      user: options.userId,
      conversationId: options.conversationId,
      agentId: options.agentId,
      model: IPR_PARSE_MODEL,
      context: 'ipr-parse',
      usage,
    });
    let text = rawText.trim();
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(text);

    // Log AI response for debugging
    logger.debug(`[IprParserService] DeepSeek response: ${JSON.stringify(parsed, null, 2)}`);

    // Set defaults if missing
    if (!parsed.employeeName) {
      parsed.employeeName = 'Не указано';
    }

    if (!parsed.eventDate) {
      parsed.eventDate = new Date().toISOString().split('T')[0];
    }

    if (!parsed.classification) {
      parsed.classification = 'Не определено';
    }

    if (!parsed.focusSkills || !Array.isArray(parsed.focusSkills)) {
      parsed.focusSkills = [];
    }

    if (!parsed.summary) {
      parsed.summary = 'Краткое резюме недоступно';
    }

    // ВАЖНО: fullAnalysis = весь диалог БЕЗ thinking (чистый текст для отображения)
    parsed.fullAnalysis = displayDialogText;

    logger.debug(`[IprParserService] Successfully parsed dialog for IPR: ${parsed.employeeName}, ${parsed.eventDate}, fullAnalysis=${dialogText.length} chars`);
    return parsed;
  } catch (error) {
    logger.error('[IprParserService] parseDialogForIpr error:', error);
    throw error;
  }
}

module.exports = {
  parseDialogForIpr,
};
