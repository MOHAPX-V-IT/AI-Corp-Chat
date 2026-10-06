const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { generateShortLivedToken } = require('@librechat/api');
const { deepseekGenerate, recordDeepseekUsage } = require('~/server/services/deepseekClient');

const RAG_FILE_ID = 'ipr-context-document';
// [LOCAL-DEEPSEEK] was Google Gemini (gemini-3-pro-preview). deepseek-v4-flash поддерживает JSON-режим
// надёжно; v4-pro — reasoning, для строгого JSON ненадёжен. Rollback: git reset --hard pre-deepseek
const DYNAMICS_MODEL = process.env.IPR_DYNAMICS_MODEL || 'deepseek-v4-flash';

const JSON_SCHEMA = `{
  "overallScore": { "current": number, "initial": number },
  "iprCompliancePercent": number,
  "activeRisks": number,
  "initialRisks": number,
  "skills": [
    { "name": "string", "emoji": "string (1 emoji)", "scores": [number] }
  ],
  "checkpoints": [
    {
      "date": "YYYY-MM-DD",
      "title": "string (кто и что, кратко)",
      "description": "string (1-2 предложения, суть)",
      "tags": [{ "text": "string (✅/❌/⚠️ + навык)", "type": "ok|fail|warn" }]
    }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium",
      "title": "string (название зоны развития)",
      "description": "string (1 предложение)",
      "currentProgress": number (0-100),
      "checkpointProgress": [number (0-100)]
    }
  ],
  "actionPlan": [
    {
      "priority": "critical|high|medium",
      "developmentArea": "string (зона развития)",
      "changeSummary": "string (суть изменений, 1 предложение)",
      "actionAlgorithm": "string (алгоритм конкретных действий, 2-3 шага через \\n)",
      "speechModule": "string (речевой модуль/скрипт/фразы — или '—' если неприменимо)",
      "expectedResult": "string (ожидаемый результат)",
      "deadline": "string (срок, напр. '2 недели')"
    }
  ],
  "verdict": {
    "title": "string (краткий вердикт, 5-8 слов)",
    "paragraphs": ["string (абзац анализа)", "string", "string"]
  }
}`;

/**
 * Query RAG API for relevant context chunks based on employee skills/issues
 */
async function getRAGContext(queryText) {
  const ragUrl = process.env.RAG_API_URL;
  if (!ragUrl) return '';

  try {
    // Use a system user ID for the token
    const token = generateShortLivedToken('system-ipr-dynamics');
    const response = await axios.post(
      `${ragUrl}/query`,
      {
        file_id: RAG_FILE_ID,
        query: queryText,
        k: 6,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    // Response is array of [document, score] pairs
    const chunks = response.data
      .map((item) => item[0]?.page_content || '')
      .filter(Boolean);

    const context = chunks.join('\n\n---\n\n');
    logger.info(`[IprDynamics] RAG returned ${chunks.length} chunks (${context.length} chars)`);
    return context;
  } catch (error) {
    logger.warn(`[IprDynamics] RAG query failed, proceeding without context: ${error.message}`);
    return '';
  }
}

/**
 * Generate structured dynamics analysis for IPR entries using Gemini.
 * @param {string} employeeName
 * @param {Array} entries - IPR entries sorted chronologically
 * @returns {Promise<object>} Structured dynamics JSON
 */
async function generateDynamicsAnalysis(employeeName, entries, meta = {}) {
  const chronology = entries
    .map((entry, idx) => {
      const date = new Date(entry.eventDate).toLocaleDateString('ru-RU');
      const skills = entry.focusSkills?.join(', ') || 'не указаны';
      return `=== Запись ${idx + 1} (КТ-${idx + 1}) ===
Дата: ${date}
Классификация: ${entry.classification || 'не указана'}
Фокус-навыки: ${skills}
Резюме: ${entry.summary || ''}
Полный анализ:
${entry.fullAnalysis || ''}`;
    })
    .join('\n\n---\n\n');

  // Build search query from skills and issues
  const allSkills = entries.flatMap((e) => e.focusSkills || []);
  const searchQuery = `${allSkills.join(' ')} техники продаж рекомендации визит врач`;

  // Get relevant context from RAG
  const ragContext = await getRAGContext(searchQuery);
  const contextBlock = ragContext
    ? `\nКОНТЕКСТ КОМПАНИИ (релевантные фрагменты из книг товаров и методических материалов):\n${ragContext}\n\nИспользуй этот контекст для формулировки речевых модулей (speechModule), конкретных алгоритмов действий и рекомендаций по продуктам компании в actionPlan.\n`
    : '';

  const prompt = `Ты — аналитик по развитию сотрудников в фармацевтической компании.

Проанализируй ${entries.length} записей ИПР по сотруднику "${employeeName}" и верни СТРОГО JSON по следующей схеме:

${JSON_SCHEMA}

ПРАВИЛА:
1. "skills" — выдели 3-6 ключевых компетенций из ВСЕХ записей. Для каждой поставь оценку 1.0-5.0 на каждую контрольную точку (КТ). Количество scores = количество записей (${entries.length}).
2. "checkpoints" — по одному на каждую запись (${entries.length} штук). Дата, краткое описание, теги ✅/❌/⚠️ по ключевым навыкам.
3. "recommendations" — 2-4 ключевые рекомендации ИПР. Для каждой оцени прогресс 0-100% на каждой КТ. checkpointProgress должен содержать ${entries.length} значений.
4. "overallScore" — общая оценка по шкале 1-10 (initial = на первой КТ, current = на последней).
5. "iprCompliancePercent" — процент выполнения рекомендаций (0-100).
6. "activeRisks" / "initialRisks" — количество активных проблемных зон сейчас vs в начале.
7. "verdict" — AI-вердикт: заголовок + 2-3 абзаца с анализом прогресса, хронических проблем и рекомендациями.
8. "actionPlan" — 3-5 конкретных рекомендаций в формате таблицы ИПР. Каждая с приоритетом, зоной развития, сутью изменений, пошаговым алгоритмом действий, речевым модулем/скриптом (конкретные фразы), ожидаемым результатом и сроком. Если есть контекст компании — используй его для формулировки конкретных речевых модулей с названиями препаратов и техник продаж.
${contextBlock}
ДАННЫЕ ЗАПИСЕЙ ИПР:

${chronology}`;

  const { text: rawText, usage } = await deepseekGenerate({
    prompt,
    model: DYNAMICS_MODEL,
    maxTokens: 8192,
    json: true,
  });
  // Record token spend so this custom DeepSeek call is visible in balance/admin stats.
  await recordDeepseekUsage({
    user: meta.userId,
    conversationId: meta.conversationId,
    model: DYNAMICS_MODEL,
    context: 'ipr-dynamics',
    usage,
  });
  let text = rawText.trim();

  // Strip potential markdown code fences
  text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  const dynamics = JSON.parse(text);

  // Validate essential fields
  if (!dynamics.skills || !dynamics.checkpoints || !dynamics.verdict) {
    throw new Error('Incomplete dynamics data from AI');
  }

  logger.info(
    `[IprDynamics] Generated analysis for ${employeeName}: ` +
    `${dynamics.skills.length} skills, ${dynamics.checkpoints.length} checkpoints, ${(dynamics.actionPlan || []).length} action items`,
  );

  return dynamics;
}

module.exports = { generateDynamicsAnalysis };
