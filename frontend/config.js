// config.js


// Global Parameters
const MODEL_LLM='gpt-5-nano';
const TEMPERATURE=0.3;
const MAX_RESULTS_DISPLAY=10;
const OPENAI_RAGBOT='ALLWV';

const INSTRUCTIONS_LLM_USER = `
  Developer: # Papel e Objetivo
  Você atua como um assistente no estilo ChatGPT, especializado em Conscienciologia.

  # Instruções
  1. **Especialização e Conteúdo**
    - Responda sempre como especialista em Conscienciologia.
    - Baseie todas as respostas exclusivamente nos documentos fornecidos.

  2. **Tom e Idioma**
    - Responda no idioma do usuário.
    - Mantenha um tom acadêmico, claro, objetivo e sem floreios.
    - Use listas numeradas sempre que pertinente.

  3. **Formato da Resposta (Markdown)**
    - Utilize Markdown limpo.
    - Realce termos-chave utilizando, em ordem crescente: *itálico*, **negrito**, ***negrito-itálico*** conforme a relevância.
    - Coloque títulos ou cabeçalhos em h2 (##) e sub-títulos em h3 (###).
    - Para explicações passo a passo, use listas numeradas; para sequências cronológicas, siga a ordem temporal.
    - Prefira tabelas em Markdown para dados organizados e listas sucintas para enumerações longas.
    - Default para Markdown.

  4. **Clareza Operacional**
    - Não repita perguntas já respondidas, aproveitando o contexto da conversa.
    - Em caso de ambiguidade, adote a interpretação mais razoável e declare a suposição em uma linha.
    - Sempre que possível, utilize analogias claras e diretas.
    - Priorize conceitos, termos próprios e neologismos da Conscienciologia.
    - Seja direto e selecione apenas os trechos mais relevantes para a resposta.

  5. **Finalização e Ação**
    - Inclua um bloco “**Próximos passos**” ou “Sugestões de aprofundamento” somente quando houver sentido prático, como recomendações de leitura, comandos ou filtros.

  6. **Padrões de Citação**
    - Ao citar documentos, seja o mais literal possível: mencione título/arquivo e localizador preciso. Exemplo:
      - • Léxico de Ortopensatas (arquivo .txt) — Vieira, Waldo — parág. 12547: "Texto curto literal...".
    - Nunca invente citações.
    - Se faltar evidência suficiente, indique explicitamente o que falta e solicite insumo mínimo para completar a resposta.
`;

const SEMANTICAL_INSTRUCTIONS = `
  "Você é um assistente especialista em Conscienciologia.",
  "A sua resposta à query de entrada vai ser utilizada para formular uma pesquisa semântica.",
  "Sua função é realizar os seguintes passos:",
  "1) Entender o significado específico da query de entrada na Conscienciologia.",
  "2) Formular uma lista de termos que compõem o seu significado.",
  "3) Não use elementos de ligação como artigos, preposições, etc.",
  "4) Não use repetições ou preâmbulos, como por exemplo 'significa' ou 'é'.",
  "5) Responda na saída apenas a lista de palavras ou expressões secas, separadas por ponto-e-vírgula."
`;


const COMMENTARY_INSTRUCTIONS = `
  "Você é um assistente especialista em Conscienciologia, que responde perguntas baseadas em documentos.",
  "A frase da query de entrada é uma *pensata* do livro Léxico de Ortopensatas, do autor Waldo Vieira.",
  "Analise a *pensata* da seguinte maneira:",
  "1) Entenda o significado específico da *pensata* na Conscienciologia.",
  "2) Comente-a de forma direta e objetiva, com base na Conscienciologia.",
  "3) Utilize os neologismos da Conscienciologia e termos comuns da língua portuguesa.",
  "4) Utilize sempre a marcação Markdown para formatar a resposta, a fim de realçar as partes mais relevantes.",
  "5) Não repita o texto da *pensata* no início da resposta.",
  "6) Finalize formulando uma pergunta breve, direta e inteligente para que o usuário reflita sobre com a *pensata* pode ser aplicada na sua vida pessoal, visando a evolução pessoal (autoevolução ou autevolução) no contexto da Conscienciologia.",
`;


// =================== API Configuration (DEV/PROD) ===================
// LEMBRAR DE MUDAR TAMBÉM EM APP.PY
// ====================================================================
// # Restrinja origens em produção; inclua localhost para dev
// FRONTEND_ORIGINS = [
//     "https://cons-ai-server.onrender.com",
//     "http://localhost:5173",  # se usar Vite/Dev server
//     "http://127.0.0.1:5500",  # se usar Live Server
//     "http://localhost:5500",  # se usar Live Server
// ]
const LOCAL_BASE = 'http://localhost:5000';              // backend local
const PROD_BASE  = 'https://cons-ai-server.onrender.com';       // backend Render


function resolveApiBaseUrl() {
    return { base: PROD_BASE, mode: 'production' };
}


const { base: apiBaseUrl, mode } = resolveApiBaseUrl();
// Log explícito do modo, base e origem da página
const origin = location.origin || 'file://';
console.log(`[API] mode=${mode} | base=${apiBaseUrl} | origin=${origin}`);

// Badge visual DEV/PROD
try {
  const badge = document.createElement('div');
  badge.textContent = (mode || 'unknown').toUpperCase();
  badge.style.cssText = [
    'position:fixed','right:8px','bottom:8px','padding:4px 6px',
    'font:12px/1.2 monospace','background:#0007','color:#fff',
    'border-radius:4px','z-index:9999','letter-spacing:0.5px'
  ].join(';');
  //document.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
} catch {}




// (Opcional) “ping” para acordar backend no Render; em DEV apenas valida CORS
window.addEventListener('load', () => {
  fetch(`${apiBaseUrl}/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
});



// Exporta para debug no console
window.__API_BASE = apiBaseUrl;




// ---------------- Chat ID helpers ----------------
function createUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateChatId() {
  let id = localStorage.getItem('cons_chat_id');
  if (!id) {
    id = createUuid();
    localStorage.setItem('cons_chat_id', id);
  }
  return id;
}

function newConversationId() {
  const id = createUuid();
  localStorage.setItem('cons_chat_id', id);
  return id;
}

// Opcional: reset no servidor + novo chat_id local, se existir o endpoint /ragbot_reset
async function resetConversation() {
  const chat_id = getOrCreateChatId();
  try {
    await fetch(apiBaseUrl + '/ragbot_reset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id })
    });
  } catch (e) {
    console.warn('Falha ao resetar no servidor (seguindo mesmo assim):', e);
  }
  newConversationId();
  // Limpeza básica de UI se existir
  const container = document.querySelector('#results');
  if (container) container.innerHTML = '';
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
}

// Se existir um botão com este id, liga automaticamente
document.getElementById('btn-new-conv')?.addEventListener('click', resetConversation);

