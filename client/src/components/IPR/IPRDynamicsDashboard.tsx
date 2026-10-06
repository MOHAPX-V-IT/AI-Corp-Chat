import React, { forwardRef } from 'react';
import type { IprDynamicsResponse, IprDynamicsSkill, IprDynamicsRecommendation, IprActionPlanItem } from '~/data-provider/IPR/types';

const DEPT_LABELS: Record<string, string> = { MP: 'МП', RM: 'РМ', RGR: 'РГР' };

/* ─── COLORS ─── */
// Light palette is intentional: this dashboard is also exported to PDF/PNG (print view).
// Only the brand accent is aligned to teal (#009688).
const COLORS = {
  bg: '#f0f2f5', card: '#ffffff', text: '#0f172a', text2: '#64748b',
  accent: '#009688', accent2: '#00796b', accentBg: '#e0f2f1',
  green: '#10b981', greenBg: '#ecfdf5',
  yellow: '#f59e0b', yellowBg: '#fffbeb',
  red: '#ef4444', redBg: '#fef2f2',
  blue: '#3b82f6', blueBg: '#eff6ff',
  border: '#e2e8f0',
};

const SKILL_COLORS = ['#009688', '#7c3aed', '#f59e0b', '#ef4444', '#3b82f6', '#f97316'];

const priorityMap: Record<string, { label: string; bg: string; color: string }> = {
  critical: { label: 'КРИТИЧ.', bg: COLORS.redBg, color: COLORS.red },
  high: { label: 'ВЫСОКИЙ', bg: COLORS.yellowBg, color: COLORS.yellow },
  medium: { label: 'СРЕДНИЙ', bg: COLORS.blueBg, color: COLORS.blue },
};

const tagTypeMap: Record<string, { bg: string; color: string }> = {
  ok: { bg: COLORS.greenBg, color: COLORS.green },
  fail: { bg: COLORS.redBg, color: COLORS.red },
  warn: { bg: COLORS.yellowBg, color: COLORS.yellow },
};

/* ─── HELPERS ─── */
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatPeriod(from: string, to: string) {
  return `${formatDate(from)} — ${formatDate(to)}`;
}

function scoreToY(score: number, chartHeight = 200, max = 5, topPad = 20) {
  return topPad + chartHeight - (score / max) * chartHeight;
}

function radarPoint(index: number, total: number, score: number, max = 5, radius = 110) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (score / max) * radius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

function radarPolygon(scores: number[], max = 5, radius = 110) {
  return scores
    .map((s, i) => {
      const p = radarPoint(i, scores.length, s, max, radius);
      return `${p.x},${p.y}`;
    })
    .join(' ');
}

/* ─── STYLE HELPERS ─── */
const s = {
  container: { maxWidth: 1140, margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif", color: COLORS.text, lineHeight: 1.6 } as React.CSSProperties,
  card: { background: COLORS.card, borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 18 } as React.CSSProperties,
  cardTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.8, color: COLORS.text2, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${COLORS.border}` } as React.CSSProperties,
  badge: (bg: string, color: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color } as React.CSSProperties),
  grid: (cols: number, gap = 18) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, marginBottom: 18 } as React.CSSProperties),
};

/* ─── LINE CHART ─── */
function LineChart({ skills, checkpointDates }: { skills: IprDynamicsSkill[]; checkpointDates: string[] }) {
  const n = checkpointDates.length;
  const chartLeft = 60, chartRight = 740, chartTop = 20, chartHeight = 200;
  const xStep = n > 1 ? (chartRight - chartLeft) / (n - 1) : 0;

  return (
    <svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
      {/* Grid */}
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={chartLeft} y1={scoreToY(v, chartHeight, 5, chartTop)} x2={chartRight} y2={scoreToY(v, chartHeight, 5, chartTop)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={50} y={scoreToY(v, chartHeight, 5, chartTop) + 4} fontSize={11} fill="#94a3b8" textAnchor="end" fontWeight={600}>{v}</text>
        </g>
      ))}
      {/* X labels */}
      {checkpointDates.map((d, i) => {
        const x = chartLeft + i * xStep;
        return (
          <g key={i}>
            <line x1={x} y1={chartTop} x2={x} y2={chartTop + chartHeight} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,4" />
            <text x={x} y={250} fontSize={12} fill="#0f172a" textAnchor="middle" fontWeight={700}>{formatDate(d)}</text>
            <text x={x} y={264} fontSize={9} fill="#94a3b8" textAnchor="middle" fontWeight={600}>КТ-{i + 1}</text>
          </g>
        );
      })}
      {/* Lines */}
      {skills.map((skill, si) => {
        const color = SKILL_COLORS[si % SKILL_COLORS.length];
        const points = skill.scores.map((sc, i) => `${chartLeft + i * xStep},${scoreToY(sc, chartHeight, 5, chartTop)}`).join(' ');
        const lastX = chartLeft + (skill.scores.length - 1) * xStep;
        const lastY = scoreToY(skill.scores[skill.scores.length - 1], chartHeight, 5, chartTop);
        const lastScore = skill.scores[skill.scores.length - 1];
        return (
          <g key={si}>
            <polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {skill.scores.map((sc, i) => (
              <circle key={i} cx={chartLeft + i * xStep} cy={scoreToY(sc, chartHeight, 5, chartTop)} r={i === skill.scores.length - 1 ? 6 : 4} fill={color} stroke={i === skill.scores.length - 1 ? 'white' : 'none'} strokeWidth={2} />
            ))}
            <text x={lastX + 12} y={lastY + 4} fontSize={11} fontWeight={800} fill={color}>{lastScore.toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── RADAR CHART ─── */
const RADAR_POLY_COLORS = ['#cbd5e1', '#80cbc4', '#4db6ac', '#26a69a', '#009688'];

function RadarChart({ skills }: { skills: IprDynamicsSkill[] }) {
  const n = skills.length;
  const numCp = skills[0]?.scores.length || 0;
  const radius = 100;
  const cx = 280, cy = 160;

  const gridLevels = [1, 2, 3, 4, 5];
  const allCheckpointScores = Array.from({ length: numCp }, (_, cpIdx) =>
    skills.map((sk) => sk.scores[cpIdx] || 0),
  );

  return (
    <svg viewBox="0 0 620 370" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: 620, width: '100%' }}>
      {/* Grid */}
      <g transform={`translate(${cx},${cy})`} fill="none" stroke="#e2e8f0" strokeWidth={1}>
        {gridLevels.map((lv) => (
          <polygon key={lv} points={radarPolygon(Array(n).fill(lv), 5, radius)} />
        ))}
        {skills.map((_, i) => {
          const p = radarPoint(i, n, 5, 5, radius);
          return <line key={i} x1={0} y1={0} x2={p.x} y2={p.y} stroke="#d1d5db" />;
        })}
      </g>
      {/* All checkpoint polygons */}
      {allCheckpointScores.map((scores, cpIdx) => {
        const isFirst = cpIdx === 0;
        const isLast = cpIdx === numCp - 1;
        const alpha = isFirst ? 0.15 : isLast ? 0.2 : 0.08;
        const strokeColor = RADAR_POLY_COLORS[Math.min(cpIdx, RADAR_POLY_COLORS.length - 1)];
        return (
          <g key={cpIdx} transform={`translate(${cx},${cy})`}>
            <polygon
              points={radarPolygon(scores, 5, radius)}
              fill={`${strokeColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`}
              stroke={strokeColor}
              strokeWidth={isLast ? 2.5 : isFirst ? 2 : 1.5}
              strokeDasharray={isFirst ? '6,4' : 'none'}
            />
            {isLast && scores.map((sc, i) => {
              const p = radarPoint(i, n, sc, 5, radius);
              return <circle key={i} cx={p.x} cy={p.y} r={4.5} fill="#009688" />;
            })}
          </g>
        );
      })}
      {/* Labels */}
      {skills.map((sk, i) => {
        const labelDist = radius + 45;
        const p = radarPoint(i, n, 5, 5, labelDist);
        const anchor = p.x > 5 ? 'start' : p.x < -5 ? 'end' : 'middle';
        const firstScore = sk.scores[0] || 0;
        const lastScore = sk.scores[sk.scores.length - 1] || 0;
        return (
          <g key={i}>
            <text x={cx + p.x} y={cy + p.y - 6} fontSize={10} fontWeight={600} fill="#0f172a" textAnchor={anchor}>{sk.name}</text>
            <text x={cx + p.x} y={cy + p.y + 9} fontSize={10} fontWeight={700} textAnchor={anchor}>
              <tspan fill="#94a3b8">{firstScore.toFixed(1)}</tspan>
              <tspan fill="#64748b"> → </tspan>
              <tspan fill="#009688">{lastScore.toFixed(1)}</tspan>
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {allCheckpointScores.map((_, cpIdx) => {
        const xStart = 140 + cpIdx * 90;
        const strokeColor = RADAR_POLY_COLORS[Math.min(cpIdx, RADAR_POLY_COLORS.length - 1)];
        return (
          <g key={cpIdx}>
            <line x1={xStart} y1={350} x2={xStart + 20} y2={350} stroke={strokeColor} strokeWidth={2} strokeDasharray={cpIdx === 0 ? '4,3' : 'none'} />
            <text x={xStart + 26} y={354} fontSize={10} fill="#64748b">КТ-{cpIdx + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── RECOMMENDATION ITEM ─── */
function RecommendationItem({ rec, checkpointCount }: { rec: IprDynamicsRecommendation; checkpointCount: number }) {
  const pri = priorityMap[rec.priority] || priorityMap.medium;
  const barColor = rec.currentProgress >= 70 ? COLORS.green : rec.currentProgress >= 40 ? COLORS.yellow : COLORS.red;
  const cpColors = (rec.checkpointProgress || []).map((p) => p >= 60 ? COLORS.green : p >= 30 ? COLORS.yellow : COLORS.red);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={s.badge(pri.bg, pri.color)}>{pri.label}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{rec.title}</span>
        </div>
        <span style={s.badge(rec.currentProgress >= 70 ? COLORS.greenBg : COLORS.yellowBg, rec.currentProgress >= 70 ? COLORS.green : COLORS.yellow)}>
          {rec.currentProgress}%
        </span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>{rec.description}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${rec.currentProgress}%`, height: '100%', background: `linear-gradient(90deg, ${barColor}dd, ${barColor})`, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: barColor, minWidth: 40, textAlign: 'right' as const }}>{rec.currentProgress}%</span>
      </div>
      {/* Checkpoint mini-bars */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {(rec.checkpointProgress || []).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: cpColors[i] || '#f1f5f9' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: COLORS.text2, marginTop: 2 }}>
        {(rec.checkpointProgress || []).map((p, i) => (
          <span key={i}>КТ-{i + 1}: {p}%</span>
        ))}
      </div>
    </div>
  );
}

/* ─── ACTION PLAN TABLE ─── */
function ActionPlanTable({ items }: { items: IprActionPlanItem[] }) {
  if (!items || items.length === 0) return null;

  const cellStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 12, borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'top', lineHeight: 1.5 };
  const headerStyle: React.CSSProperties = { ...cellStyle, fontSize: 10, fontWeight: 700, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: 0.5, background: '#f8fafc', whiteSpace: 'nowrap' };

  return (
    <div style={{ ...s.card, marginTop: 18, padding: 0, overflow: 'hidden' }}>
      <div style={{ ...s.cardTitle, padding: '18px 24px 0', marginBottom: 12 }}><span>📋</span> План действий ИПР</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={headerStyle}>Приоритет</th>
              <th style={headerStyle}>Зона развития</th>
              <th style={headerStyle}>Суть изменений</th>
              <th style={headerStyle}>Алгоритм действий</th>
              <th style={headerStyle}>Речевой модуль</th>
              <th style={headerStyle}>Ожидаемый результат</th>
              <th style={headerStyle}>Срок</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const pri = priorityMap[item.priority] || priorityMap.medium;
              return (
                <tr key={i}>
                  <td style={cellStyle}><span style={s.badge(pri.bg, pri.color)}>{pri.label}</span></td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{item.developmentArea}</td>
                  <td style={cellStyle}>{item.changeSummary}</td>
                  <td style={{ ...cellStyle, whiteSpace: 'pre-line' }}>{item.actionAlgorithm}</td>
                  <td style={{ ...cellStyle, fontStyle: item.speechModule === '—' ? 'italic' : 'normal', color: item.speechModule === '—' ? COLORS.text2 : COLORS.text }}>{item.speechModule}</td>
                  <td style={cellStyle}>{item.expectedResult}</td>
                  <td style={{ ...cellStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.deadline}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── MAIN DASHBOARD ─── */
const IPRDynamicsDashboard = forwardRef<HTMLDivElement, { data: IprDynamicsResponse }>(
  ({ data }, ref) => {
    const { dynamics: d } = data;
    const checkpointDates = d.checkpoints.map((cp) => cp.date);

    const trendStr = (curr: number, init: number) => {
      const diff = curr - init;
      if (diff > 0) return { text: `↑ ${init} → ${curr}`, color: COLORS.green };
      if (diff < 0) return { text: `↓ ${init} → ${curr}`, color: COLORS.red };
      return { text: `= ${curr}`, color: COLORS.yellow };
    };

    const scoreTrend = trendStr(d.overallScore.current, d.overallScore.initial);
    const riskTrend = d.activeRisks < d.initialRisks
      ? { text: `↓ было ${d.initialRisks}`, color: COLORS.green }
      : { text: `= ${d.activeRisks}`, color: COLORS.yellow };

    return (
      <div ref={ref} style={{ ...s.container, background: COLORS.bg, padding: 32 }}>
        {/* HEADER */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18 }}>S</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Трекинг динамики ИПР</div>
              <div style={{ fontSize: 12, color: COLORS.text2 }}>AI Corp Chat — Автоматический анализ прогресса</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, background: COLORS.accentBg, padding: '8px 16px', borderRadius: 10 }}>
            {formatPeriod(data.period.from, data.period.to)} · {d.checkpoints.length} контр. точек
          </div>
        </div>

        {/* PROFILE */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, background: COLORS.card, borderRadius: 14, padding: '18px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {[
            { label: 'Сотрудник', val: data.employeeName },
            { label: 'Должность', val: DEPT_LABELS[data.employeeDepartment] || data.employeeDepartment, accent: true },
            { label: 'Руководитель', val: data.managerName },
            { label: 'Записей', val: String(data.entriesCount) },
            { label: 'Период', val: `${data.period.days} дней` },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: item.accent ? COLORS.accent : COLORS.text }}>{item.val}</div>
            </div>
          ))}
        </div>

        {/* TOP METRICS */}
        <div style={s.grid(4, 14)}>
          {[
            { number: d.overallScore.current.toFixed(1), sub: 'Общий скор', color: COLORS.accent, trend: scoreTrend },
            { number: `${d.iprCompliancePercent}%`, sub: 'Выполнение ИПР', color: COLORS.green, trend: { text: `↑ с 0%`, color: COLORS.green } },
            { number: String(d.activeRisks), sub: 'Активных рисков', color: COLORS.yellow, trend: riskTrend },
            { number: String(d.checkpoints.length), sub: 'Контрольных точек', color: COLORS.blue, trend: { text: `${data.period.days} дней`, color: COLORS.yellow } },
          ].map((m, i) => (
            <div key={i} style={{ ...s.card, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: m.color }}>{m.number}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 }}>{m.sub}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: m.trend.color }}>{m.trend.text}</div>
            </div>
          ))}
        </div>

        {/* LINE CHART */}
        <div style={s.card}>
          <div style={s.cardTitle}><span>📈</span> Динамика компетенций по контрольным точкам</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14, fontSize: 12, fontWeight: 600 }}>
            {d.skills.map((sk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 4, borderRadius: 2, background: SKILL_COLORS[i % SKILL_COLORS.length] }} />
                {sk.emoji} {sk.name}
              </div>
            ))}
          </div>
          <LineChart skills={d.skills} checkpointDates={checkpointDates} />
        </div>

        {/* RADAR */}
        {d.skills.length >= 3 && (
          <div style={s.card}>
            <div style={s.cardTitle}><span>🕸️</span> Профиль компетенций: КТ-1 vs КТ-{d.checkpoints.length}</div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <RadarChart skills={d.skills} />
            </div>
          </div>
        )}

        {/* TIMELINE + IPR COMPLIANCE */}
        <div style={s.grid(2)}>
          {/* Timeline */}
          <div style={s.card}>
            <div style={s.cardTitle}><span>📅</span> Хронология сессий</div>
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 8, top: 4, bottom: 4, width: 3, background: `linear-gradient(to bottom, ${COLORS.accent}, ${COLORS.accent2})`, borderRadius: 2 }} />
              {d.checkpoints.map((cp, i) => {
                const hasOk = cp.tags.some((t) => t.type === 'ok');
                const hasFail = cp.tags.some((t) => t.type === 'fail');
                const dotColor = hasFail && !hasOk ? COLORS.red : hasFail ? COLORS.yellow : COLORS.green;
                return (
                  <div key={i} style={{ position: 'relative', marginBottom: i < d.checkpoints.length - 1 ? 22 : 0 }}>
                    <div style={{ position: 'absolute', left: -24, top: 4, width: 14, height: 14, borderRadius: '50%', background: dotColor, border: '3px solid white', boxShadow: `0 0 0 2px ${dotColor}` }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>КТ-{i + 1} · {formatDate(cp.date)}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{cp.title}</div>
                    <div style={{ fontSize: 13, color: COLORS.text2, marginTop: 4, lineHeight: 1.5 }}>{cp.description}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {cp.tags.map((tag, ti) => {
                        const tc = tagTypeMap[tag.type] || tagTypeMap.warn;
                        return <span key={ti} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: tc.bg, color: tc.color }}>{tag.text}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IPR Compliance */}
          <div style={s.card}>
            <div style={s.cardTitle}><span>✅</span> Выполнение рекомендаций ИПР</div>
            {d.recommendations.map((rec, i) => (
              <RecommendationItem key={i} rec={rec} checkpointCount={d.checkpoints.length} />
            ))}
            <div style={{ marginTop: 18, padding: 14, background: COLORS.accentBg, borderRadius: 10, fontSize: 12, color: COLORS.accent, fontWeight: 600, textAlign: 'center' }}>
              Средний прогресс по ИПР: {d.iprCompliancePercent}%
            </div>
          </div>
        </div>

        {/* VERDICT */}
        <div style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, borderRadius: 16, padding: '28px 32px', color: 'white', marginTop: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Вердикт AI: {d.verdict.title}</h3>
          {d.verdict.paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.8, opacity: 0.95, marginTop: i > 0 ? 10 : 0 }}>{p}</p>
          ))}
        </div>

        {/* ACTION PLAN TABLE */}
        {d.actionPlan && <ActionPlanTable items={d.actionPlan} />}

        {/* FOOTER */}
        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.text2 }}>
          Сгенерировано автоматически · AI Corp Chat · {formatDate(data.period.to)} · Анализ {data.entriesCount} записей ИПР
        </div>
      </div>
    );
  },
);

IPRDynamicsDashboard.displayName = 'IPRDynamicsDashboard';

export default IPRDynamicsDashboard;
