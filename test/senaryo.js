// Test için gerçek Claude Code hook gövdeleriyle aynı biçimde olay dizisi üretir.
// Uygulamayla birlikte gelmez, yalnızca geliştirme kontrolü içindir.
const O = 'abc12345-0000-4000-8000-000000000001';
const temel = { session_id: O, transcript_path: '/tmp/t.jsonl', cwd: '/Users/solazan/GitHub/Fainera', permission_mode: 'default' };
const e = (hook_event_name, ek = {}) => ({ ...temel, hook_event_name, ...ek });
const arac = (kim, tool_name, tool_input, olay = 'PreToolUse', ek = {}) =>
  e(olay, { ...(kim ? { agent_id: 'ag-' + kim, agent_type: kim } : {}), tool_name, tool_input, tool_use_id: 'toolu_' + Math.random().toString(36).slice(2), ...ek });

export const SENARYO = [
  e('SessionStart', { source: 'startup', agent_type: 'sef', model: 'claude-fable-5-1' }),
  e('UserPromptSubmit', { prompt: 'Fee sitesindeki canonical, H1 ve partner sayfası sorunlarını çöz', source: 'user' }),
  e('TaskCreated', { task_id: '1', task_subject: 'Canonical etiketlerini sayfaya özel yap' }),
  e('TaskCreated', { task_id: '2', task_subject: 'Partner sayfalarını sunucu tarafında üret' }),
  e('TaskCreated', { task_id: '3', task_subject: 'Register, partners ve campaigns sayfalarına H1 ekle' }),
  e('TaskCreated', { task_id: '4', task_subject: 'Site haritasındaki 404 adresleri temizle' }),
  e('TaskCreated', { task_id: '5', task_subject: 'Muhasebe hesabını testle doğrula' }),
  ...['seo', 'frontend', 'backend', 'arastirmaci', 'qa'].flatMap((k) => [
    arac(null, 'Agent', { name: k, subagent_type: k, description: k + ' görevi', prompt: '...' }),
    e('SubagentStart', { agent_id: 'ag-' + k, agent_type: k }),
  ]),
  arac('seo', 'TaskUpdate', { taskId: '1', status: 'in_progress', owner: 'seo' }, 'PostToolUse', { tool_response: {} }),
  arac('frontend', 'TaskUpdate', { taskId: '2', status: 'in_progress', owner: 'frontend' }, 'PostToolUse', { tool_response: {} }),
  arac('backend', 'TaskUpdate', { taskId: '5', status: 'in_progress', owner: 'backend' }, 'PostToolUse', { tool_response: {} }),
  arac('seo', 'WebFetch', { url: 'https://fee.fainera.com/partners/bybit', prompt: 'canonical' }),
  arac('arastirmaci', 'WebSearch', { query: 'next.js app router canonical metadata' }),
  arac('backend', 'Bash', { command: 'cargo test accounting', description: 'muhasebe testlerini çalıştır' }),
  arac('frontend', 'Read', { file_path: '/Users/solazan/GitHub/Fainera/app/partners/[slug]/page.tsx' }),
  arac('qa', 'Grep', { pattern: 'Partner Not Found' }),
  arac('seo', 'SendMessage', { to: 'frontend', summary: 'Canonical ortak şablonda sabit, sayfa bazlı olmalı', message: '...' }),
  arac('frontend', 'Edit', { file_path: '/Users/solazan/GitHub/Fainera/app/layout.tsx' }),
  e('PermissionRequest', { agent_id: 'ag-frontend', agent_type: 'frontend', tool_name: 'Edit', tool_input: { file_path: '/Users/solazan/GitHub/Fainera/app/layout.tsx' } }),
  e('TaskCompleted', { task_id: '4', task_subject: 'Site haritasındaki 404 adresleri temizle', teammate_name: 'seo' }),
  e('TeammateIdle', { teammate_name: 'qa', team_name: 'session-abc12345' }),
  e('Stop', { stop_hook_active: false, last_assistant_message: 'Ekip çalışıyor.' }),
];
