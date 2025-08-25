// display.js - Centralized result rendering functionality (modularized)

// __________________________________________________________________________________________
// DOMPurify
// __________________________________________________________________________________________
// Import or reference DOMPurify for XSS protection (assumed loaded globally)
const sanitizeHtml = window.DOMPurify?.sanitize || (html => html);

// Markdown renderer (usa marked + DOMPurify se disponíveis; senão, fallback simples)
function renderMarkdown(mdText) {
    const input = typeof mdText === 'string' ? mdText : String(mdText || '');
  
    // 0) Se já há HTML de bloco, apenas sanitize e devolve (evita <p><p>...</p></p>)
    const hasBlockHtml = /<\s*(p|div|ul|ol|li|h[1-6]|pre|blockquote|br)\b/i.test(input);
    try {
      if (!hasBlockHtml && window.marked?.parse) {
        const html = window.marked.parse(input);
        return sanitizeHtml(html);
      }
    } catch (e) {
      console.warn('marked falhou, usando fallback:', e);
    }
    if (hasBlockHtml) {
      // Ainda assim, tira <br> duplos e <p> vazios que porventura cheguem prontos
      return sanitizeHtml(
        input
          .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
          .replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, '')
      );
    }
  
    // 1) Normalização de linhas
    let normalized = input
      .replace(/\r\n?/g, '\n')     // CRLF/LF -> LF
      .replace(/[ \t]+\n/g, '\n')  // tira espaços ao fim da linha
      .replace(/\n{3,}/g, '\n\n')  // colapsa 3+ quebras em 2
      .trim();
  
    // 2) Preserva blocos de código antes de mexer em quebras
    normalized = normalized.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${sanitizeHtml(code)}</code></pre>`
    );
  
    // 3) Marcações simples (headers, ênfases, listas mínimas)
    let tmp = normalized
      .replace(/^######\s?(.*)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s?(.*)$/gm, '<h5>$1</h5>')
      .replace(/^####\s?(.*)$/gm, '<h4>$1</h4>')
      .replace(/^###\s?(.*)$/gm, '<h3>$1</h3>')
      .replace(/^##\s?(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s?(.*)$/gm, '<h1>$1</h1>')
      .replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>')
      .replace(/^\s*\*\s+(.*)$/gm, '<li>$1</li>')
      .replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>')
      .replace(/(?:\s*<li>.*<\/li>\s*)+/gs, m => `<ul>${m}</ul>`)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  
    // 4) Quebra em parágrafos (2+ \n). Filtra vazios.
    const paragraphs = tmp.split(/\n{2,}/).filter(p => p.trim().length);
  
    const html = paragraphs.map(p => {
      // dentro do parágrafo, 1 quebra -> <br> (e evita <br><br>)
      const withBreaks = p.replace(/\n/g, '<br>').replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
      return `<p>${sanitizeHtml(withBreaks)}</p>`;
    }).join('');
  
    // 5) Limpeza final: remove <p> vazios e <br> duplicados entre blocos
    const cleaned = html
      .replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, '')
      .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
  
    return sanitizeHtml(cleaned);
  }





// ===== Handlers mapping =====
const renderers = {
    ragbot: showRagbot,
    lexical: showSearch,
    semantical: showSearch,
    title: showTitle,
    simple: showSimple,
    verbetopedia: showVerbetopedia,
};

/**
 * Displays results based on search type
 * @param {HTMLElement} container - The container element
 * @param {Object} data - The data payload
 * @param {string} type - The search type key
 */
function displayResults(container, data, type) {
  if (!container) {
      console.error('Results container not found');
      return;
  }
  const renderer = renderers[type];
  if (!renderer) {
      console.error(`Unknown search type: ${type}`);
      return;
  }
  renderer(container, data);
}

// ===== Utility functions =====
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}





//______________________________________________________________________________________________
// insertLoading
//______________________________________________________________________________________________
function insertLoading(container, message) {
    container.insertAdjacentHTML('beforeend', `
    <div class="loading-container">
        <div class="loading">${message}</div>
    </div>`);
}

function removeLoading(container) {
    const loadingContainer = container.querySelector('.loading-container .loading');
    if (loadingContainer) {
        loadingContainer.closest('.loading-container').remove();
    }
}





// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++




//______________________________________________________________________________________________
// showSearch
//______________________________________________________________________________________________
function showSearch(container, data) {

    if (!container) {
        console.error('Results container not found');
        return;
    }

    // 0) Garantir array de entrada
    const arr = Array.isArray(data.results) ? data.results : [];
    if (!arr.length) {
        container.insertAdjacentHTML(
            'beforeend',
            '<div class="displaybox-container"><div class="displaybox-content">No results to display.</div></div>'
        );
        return;
    }

    // 1) Normalizador de fonte/livro para exibição (remove diretórios e .md)
    const normSourceName = (typeof window !== 'undefined' && typeof window.normSourceName === 'function')
        ? window.normSourceName
        : function _fallbackNormSourceName(src) {
            if (!src) return 'Results';
            let s = String(src);
            s = s.split(/[\\/]/).pop();           // tira diretórios
            s = s.replace(/\.(md|markdown)$/i, ''); // tira extensão
            return s;
        };

   // 2) Agrupar por fonte normalizada
        const groups = arr.reduce((acc, it, idx) => {
            const raw = it?.book || it?.source || it?.file || 'Results';
            const key = normSourceName(raw);
            if (!acc[key]) acc[key] = [];
            acc[key].push({ ...it, _origIndex: idx, _srcRaw: raw, _src: key });
            return acc;
        }, {});
        const groupNames = Object.keys(groups);


    // 3) Resultados do grupo
    // ===========================================================================================
    
    // Resumo superior
    const totalCount = arr.length;
    const perSourceLines = groupNames.map(name => {
        const n = groups[name].length;
        return `<div><strong>${escapeHtml(name)}</strong>: ${n} resultado${n !== 1 ? 's' : ''}</div>`;
    }).join('');

    const summaryHtml = `
    <div style="
        border: 1px solid #ddd;
        background-color: #f7f7f7;
        padding: 10px 12px;
        border-radius: 8px;
        margin: 8px 0 14px 0;
    ">
        <div style="font-weight: bold;">
            Total de parágrafos encontrados: ${totalCount}
        </div>
        ${perSourceLines}
    </div>`;
    
    container.insertAdjacentHTML('beforeend', summaryHtml);




   
    // Processamento GERAL
    // ===========================================================================================

    // Get the checkbox state
    const flag_grouping = document.getElementById('groupResults')?.checked ?? true;

    if (flag_grouping) {

            
        // 4) Render por GRUPOS (cada source name)
        // ===========================================================================================
        groupNames.forEach(groupName => {

            const groupItems = groups[groupName];
            let groupHtml = '';

            // Processa cada item agrupado
            groupItems.forEach((item, idx) => {
                
                const markerHtml = `<span class="paragraph-marker" style="font-size: 10px; color: gray; font-weight: bold; display: inline-block; margin-right: 4px;">[${idx + 1}]</span>`;
                const sourceName = item.source || item.file || item.book || 'Unknown';

                let itemHtml = '';
                itemHtml = format_paragraphs_source (item, sourceName);

                groupHtml += itemHtml;
            });


            // 5) HTML final do grupo
            // =======================================
            const groupHeader = `
                <div class="group-header">
                    <h3>${groupName} <span class="badge">${groupItems.length} itens</span></h3>
                </div>
            `;

            const groupContent = `
                <div class="group-content">
                    ${groupHtml}
                </div>
            `;

            container.insertAdjacentHTML('beforeend', groupHeader + groupContent);

        });



    } else {

        // Reunir os itens de todas as fontes em lista única
        // ===========================================================================================
        const sortedItems = [...arr].sort((b, a) => (b.score || 0) - (a.score || 0));

        console.log('sortedItems', sortedItems);

        let groupHtml = '';

        // Renderizar os itens ordenados
        // ===========================================================================================
        sortedItems.forEach((item, idx) => {

            const markerHtml = `<span class="paragraph-marker" style="font-size: 10px; color: gray; font-weight: bold; display: inline-block; margin-right: 4px;">[${idx + 1}]</span>`;
            const sourceName = item.source || item.file || item.book || 'Unknown';
        

            let itemHtml = '';
            itemHtml = format_paragraphs_source (item, sourceName);

            groupHtml += itemHtml;
        });

       
        // 5) HTML final do grupo
        // =======================================
        const groupHeader = `
        <div class="group-header">
            <h3>Resultados ordenados por score semântico: <span class="badge">${sortedItems.length} itens</span></h3>
        </div>
        `;

        const groupContent = `
            <div class="group-content">
                ${groupHtml}
            </div>
        `;

        container.insertAdjacentHTML('beforeend', groupHeader + groupContent);

    };

}




// ===========================================================================
// format_paragraphs_source
// ===========================================================================
const format_paragraphs_source = (item, sourceName) => {

    let itemHtml = '';
    
    if (sourceName === 'LO') {
        itemHtml = format_paragraph_LO(item);
    }
    else if (sourceName === 'DAC') {
        itemHtml = format_paragraph_DAC(item);
    }
    else if (sourceName === 'CCG') {
        itemHtml = format_paragraph_CCG(item);
    }
    else if (sourceName === 'EC' || sourceName === 'ECALL_DEF' || sourceName === 'ECWV' || sourceName === 'ECALL') {
        itemHtml = format_paragraph_EC(item);
    }
    else {
        itemHtml = format_paragraph_Default(item);
    }
    return itemHtml;    
};





// ===========================================================================
// LO: Content_Text  Markdown_Text Title  Number  Score
// ===========================================================================
const format_paragraph_LO = (item) => {

    console.log('Available properties:', Object.keys(item));
    if (item.metadata) {
        console.log('Metadata properties:', Object.keys(item.metadata));
    }

    // Fields are directly on the item
    const title = item.title || '';
    const paragraph_number = item.number || '';
    const score = item.score || 0.00;
    const text = item.markdown || item.content_text || '';
    const source = item.source || '';

    console.log('---------------[display.js] [format_paragraph_LO] paragraph_number: ', paragraph_number);
    console.log('---------------[display.js] [format_paragraph_LO] title: ', title);
    console.log('---------------[display.js] [format_paragraph_LO] score: ', score);
    console.log('---------------[display.js] [format_paragraph_LO] source: ', source);

    // Add each field to the array only if it has a value
    const badgeParts = [];
    if (source) {
        badgeParts.push(`<span class="metadata-badge estilo1" <strong>${escapeHtml(source)}</strong></span>`);
    }
    if (title) {
        badgeParts.push(`<span class="metadata-badge estilo2"> <strong>${escapeHtml(title)}</strong></span>`);
    }
    if (paragraph_number) {
        badgeParts.push(`<span class="metadata-badge estilo3"> #${escapeHtml(paragraph_number)}</span>`);
    }
    if (score > 0.0) {
        badgeParts.push(`<span class="metadata-badge estilo4"> @${escapeHtml(score)}</span>`);
    }

    // Join the non-empty badges with a space
    metaBadges = badgeParts.join('');

    // Add title to text if score > 0.0 (Semantical Search)
    const textCompleted = (score > 0.0) ? `**${title}**. ${text}` : text;

    // Renderiza markdown
    const rawHtml = renderMarkdown(textCompleted);
    const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

    // Monta HTML final
    const finalHtml = `
    <div class="displaybox-item">
        <div class="displaybox-text markdown-content">${safeHtml}</div>
        ${metaBadges}
    </div>`;


    return finalHtml;
}

  


// ===========================================================================
// DAC: Content_Text  Markdown  Title  Number  Source  Argumento  Section
// ===========================================================================
const format_paragraph_DAC = (item) => {
    

    console.log('Available properties:', Object.keys(item));
    if (item.metadata) {
        console.log('Metadata properties:', Object.keys(item.metadata));
    }

    // Fields are directly on the item
    const title = item.title || '';
    const paragraph_number = item.number || '';
    const score = item.score || 0.00;
    const text = item.markdown || item.content_text || '';
    const argumento = item.argumento || '';
    const section = item.section || '';
    const source = item.source || '';

    console.log('---------------[display.js] [format_paragraph_DAC] paragraph_number: ', paragraph_number);
    console.log('---------------[display.js] [format_paragraph_DAC] title: ', title);
    console.log('---------------[display.js] [format_paragraph_DAC] score: ', score);
    console.log('---------------[display.js] [format_paragraph_DAC] argumento: ', argumento);
    console.log('---------------[display.js] [format_paragraph_DAC] section: ', section);
    console.log('---------------[display.js] [format_paragraph_DAC] source: ', source);

    // Add each field to the array only if it has a value
    const badgeParts = [];      
    if (source) {
        badgeParts.push(`<span class="metadata-badge estilo1"> <strong>${escapeHtml(source)}</strong></span>`);
    }
    if (title) {
        badgeParts.push(`<span class="metadata-badge estilo2"> <strong>${escapeHtml(title)}</strong></span>`);
    }
    if (argumento) {
        badgeParts.push(`<span class="metadata-badge estilo5"> ${escapeHtml(argumento)}</span>`);
    }
    if (section) {
        badgeParts.push(`<span class="metadata-badge estilo6"> <em> ${escapeHtml(section)}</em></span>`);
    }
    if (paragraph_number) {
        badgeParts.push(`<span class="metadata-badge estilo4"> #${escapeHtml(paragraph_number)}</span>`);
    }
    if (score > 0.0) {
        badgeParts.push(`<span class="metadata-badge estilo9"> @${escapeHtml(score)}</span>`);
    }

    // Join the non-empty badges with a space
    metaBadges = badgeParts.join('');

    // Renderiza markdown
    const rawHtml = renderMarkdown(text);
    const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

    // Monta HTML final
    const finalHtml = `
    <div class="displaybox-item">
        <div class="displaybox-text markdown-content">${safeHtml}</div>
        ${metaBadges}
    </div>`;

    return finalHtml;
}
    
    
  
// ===========================================================================
// CCG: Content_Text  Markdown_Text  Title  Number  Source  Folha
// ===========================================================================
const format_paragraph_CCG = (item) => {
    

    console.log('Available properties:', Object.keys(item));
    if (item.metadata) {
        console.log('Metadata properties:', Object.keys(item.metadata));
    }

    // Fields are directly on the item
    const title = item.title || '';
    const question_number = item.number || '';
    const score = item.score || 0.00;
    const text = item.markdown || item.content_text || '';
    const folha = item.folha || '';
    const source = item.source || '';

    console.log('---------------[display.js] [format_paragraph_CCG] question_number: ', question_number);
    console.log('---------------[display.js] [format_paragraph_CCG] title: ', title);
    console.log('---------------[display.js] [format_paragraph_CCG] score: ', score);
    console.log('---------------[display.js] [format_paragraph_CCG] folha: ', folha);
    console.log('---------------[display.js] [format_paragraph_CCG] source: ', source);


    // Add each field to the array only if it has a value
    const badgeParts = [];   
    if (source) {
        badgeParts.push(`<span class="metadata-badge estilo1"> <strong>${escapeHtml(source)}</strong></span>`);
    }
    if (title) {
        badgeParts.push(`<span class="metadata-badge estilo2"> <strong>${escapeHtml(title)}</strong></span>`);
    }
    if (folha) {
        badgeParts.push(`<span class="metadata-badge estilo4"> (${escapeHtml(folha)})</span>`);
    }
    if (question_number) {
        badgeParts.push(`<span class="metadata-badge estilo3"> #${escapeHtml(question_number)}</span>`);
    }
    if (score > 0.0) {
        badgeParts.push(`<span class="metadata-badge estilo9"> @${escapeHtml(score)}</span>`);
    }

    // Join the non-empty badges with a space
    metaBadges = badgeParts.join('');
    
    // Renderiza markdown
    const rawHtml = renderMarkdown(text);
    const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

    // Monta HTML final
    const finalHtml = `
    <div class="displaybox-item">
        <div class="displaybox-text markdown-content">${safeHtml}</div>
        ${metaBadges}
    </div>`;

    return finalHtml;
}

  
// ===========================================================================
// EC: Content_Text  Markdown_Text  Title  Number  Source  Area  Theme  Author  Sigla  Date  Link
// ===========================================================================
const format_paragraph_EC = (item) => {
    

    console.log('Available properties:', Object.keys(item));
    if (item.metadata) {
        console.log('Metadata properties:', Object.keys(item.metadata));
    }

    // Fields are directly on the item
    const title = item.title || '';
    const verbete_number = item.number || '';
    const score = item.score || 0.00;
    const text = item.markdown || item.content.text || '';
    const area = item.area || '';
    const theme = item.theme || '';
    const author = item.author || '';
    const sigla = item.sigla || '';
    const date = item.date || '';
    const link = item.link || '';
    const source = 'EC';


    console.log('---------------[display.js] [format_paragraph_EC] verbete_number: ', verbete_number);
    console.log('---------------[display.js] [format_paragraph_EC] title: ', title);
    console.log('---------------[display.js] [format_paragraph_EC] score: ', score);
    console.log('---------------[display.js] [format_paragraph_EC] area: ', area);
    console.log('---------------[display.js] [format_paragraph_EC] theme: ', theme);
    console.log('---------------[display.js] [format_paragraph_EC] author: ', author);
    console.log('---------------[display.js] [format_paragraph_EC] sigla: ', sigla);
    console.log('---------------[display.js] [format_paragraph_EC] date: ', date);
    console.log('---------------[display.js] [format_paragraph_EC] link: ', link);
    console.log('---------------[display.js] [format_paragraph_EC] source: ', source);

    // Add each field to the array only if it has a value
    const badgeParts = [];   
    if (source) {
        badgeParts.push(`<span class="metadata-badge estilo1"> <strong>${escapeHtml(source)}</strong></span>`);
    }
    if (title) {
        badgeParts.push(`<span class="metadata-badge estilo2"> <strong>${escapeHtml(title)}</strong></span> `);
    }
    if (area) {
        badgeParts.push(`<span class="metadata-badge estilo4"> <em> ${escapeHtml(area)}</em></span>`);
    }
    if (verbete_number) {
        badgeParts.push(`<span class="metadata-badge estilo3"> #${escapeHtml(verbete_number)}</span>`);
    }
    if (theme) {
        badgeParts.push(`<span class="metadata-badge estilo5"> ${escapeHtml(theme)}</span>`);
    }
    if (author) {
        badgeParts.push(`<span class="metadata-badge estilo6"> ${escapeHtml(author)}</span>`);
    }
    if (date) {
        badgeParts.push(`<span class="metadata-badge estilo7"> ${escapeHtml(date)}</span>`);
    }
    if (score > 0.0) {
        badgeParts.push(`<span class="metadata-badge estilo9"> @${escapeHtml(score)}</span>`);
    }

    // Join the non-empty badges with a space
    metaBadges = badgeParts.join('');
      
    // Renderiza markdown
    const rawHtml = renderMarkdown(text);
    const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

    // Monta HTML final
    const finalHtml = `
    <div class="displaybox-item">
        <div class="displaybox-text markdown-content">${safeHtml}</div>
        ${metaBadges}
    </div>`;

    return finalHtml;
}

  










// ===========================================================================
// Default: Content_Text  Markdown_Text Title  Number  Score
// ===========================================================================
const format_paragraph_Default = (item) => {

    console.log('Available properties:', Object.keys(item));
    if (item.metadata) {
        console.log('Metadata properties:', Object.keys(item.metadata));
    }

    // Fields are directly on the item
    const title = item.title || '';
    const paragraph_number = item.number || '';
    const score = item.score || 0.00;
    const text = item.markdown || item.content_text || '';
    const source = item.source || '';

    console.log('---------------[display.js] [format_paragraph_Default] paragraph_number: ', paragraph_number);
    console.log('---------------[display.js] [format_paragraph_Default] title: ', title);
    console.log('---------------[display.js] [format_paragraph_Default] score: ', score);
    console.log('---------------[display.js] [format_paragraph_Default] source: ', source);

    // Add each field to the array only if it has a value
    const badgeParts = [];
    if (source) {
        badgeParts.push(`<span class="metadata-badge estilo1" <strong>${escapeHtml(source)}</strong></span>`);
    }
    // if (title) {
    //     badgeParts.push(`<span class="metadata-badge estilo2"> <strong>${escapeHtml(title)}</strong></span>`);
    // }
    if (paragraph_number) {
        badgeParts.push(`<span class="metadata-badge estilo3"> #${escapeHtml(paragraph_number)}</span>`);
    }
    if (score > 0.0) {
        badgeParts.push(`<span class="metadata-badge estilo4"> @${escapeHtml(score)}</span>`);
    }

    // Join the non-empty badges with a space
    metaBadges = badgeParts.join('');

    // Add title to text if score > 0.0 (Semantical Search)
    const textCompleted = (score > 0.0) ? `**${title}**. ${text}` : text;

    // Renderiza markdown
    const rawHtml = renderMarkdown(textCompleted);
    const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

    // Monta HTML final
    const finalHtml = `
    <div class="displaybox-item">
        <div class="displaybox-text markdown-content">${safeHtml}</div>
        ${metaBadges}
    </div>`;


    return finalHtml;
}














// ________________________________________________________________________________________
// Show RAGbot
// ________________________________________________________________________________________
 // Expected data format from /ragbot:
  // {
  //   results: [{ text: string, citations: array }],
  //   total_tokens_used: number,
  //   type: 'ragbot',
  //   model: string,
  //   temperature: number
  // }
  function showRagbot(container, data) {
    const text = data?.text || 'No text available.';
    const mdHtml = renderMarkdown(text);

    // ***********************************************************************
    // Extract metadata
    // ***********************************************************************
    // ragbot: {
    //   metadataFields: ['title', 'number', 'source', 'citations', 'total_tokens_used', 'model', 'temperature']
    // }
    // ***********************************************************************
    metadata = extractMetadata(data, 'ragbot');

    const citations = metadata?.citations;
    const total_tokens_used = metadata?.total_tokens_used;
    const model = metadata?.model;
    const temperature = metadata?.temperature;
    
    // Badge do número absoluto do parágrafo no arquivo (se presente)
    const metaInfo = `
    <div class="metadata-container">
      <span class="metadata-badge citation">Citations: ${citations}</span>
      <span class="metadata-badge model">Model: ${model}</span>
      <span class="metadata-badge temperature">Temperature: ${temperature}</span>
      <span class="metadata-badge tokens">Tokens: ${total_tokens_used}</span>
    </div>
    `;  
  
  const html = `
    <div class="displaybox-container">
      <div class="displaybox-content">
        <div class="displaybox-text markdown-content">${mdHtml}</div> <!-- <<< -->
        ${metaInfo}
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}


// ________________________________________________________________________________________
// Show Title
// ________________________________________________________________________________________
function showTitle(container, text) {
    const cleanText = renderMarkdown(text);
    const html = `
            <h3 class="displaybox-header" style="color: blue; font-weight: bold; font-size: 16px; margin-bottom: 10px;"><strong>${cleanText}</strong></h3>`;

    container.insertAdjacentHTML('beforeend', html);
}

// ________________________________________________________________________________________
// Show Simple
// ________________________________________________________________________________________
 // Expected data format from /simple:
  // {
  //   results: [{ text: string, citations: array }],
  //   total_tokens_used: number,
  //   type: 'simple',
  //   model: string,
  //   temperature: number
  // }
  function showSimple(container, data) {
    const text = data.text;
    const mdHtml = renderMarkdown(text); // <<<

    const html = `
    <div class="displaybox-container" style="background-color:rgb(255, 254, 236);">
        <div class="displaybox-content">
            <div class="displaybox-text markdown-content">${mdHtml}</div>  <!-- <<< -->
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
}




// ________________________________________________________________________________________
// Show Verbetopedia (simplificada — ordenação por score)
// ________________________________________________________________________________________

function showVerbetopedia(container, data) {
    if (!container) {
        console.error('Results container not found');
        return;
    }

    // 0) Garantir array de entrada
    const arr = Array.isArray(data.results) ? data.results : [];
    if (!arr.length) {
        container.insertAdjacentHTML(
            'beforeend',
            '<div class="displaybox-container"><div class="displaybox-content">No results to display.</div></div>'
        );
        return;
    }

    // 1) Extrair metadados antes para usar score
    const items = arr.map(item => {
        const metaData = extractMetadata(item, 'verbetopedia');
        return { ...item, _meta: metaData };
    });

    // 2) Ordenar por score decrescente
    items.sort((a, b) => {
        const sa = (typeof a._meta.score === 'number') ? a._meta.score : -Infinity;
        const sb = (typeof b._meta.score === 'number') ? b._meta.score : -Infinity;
        return sa - sb; // menor primeiro
    });

    // 3) Gera HTML de cada item
    const contentHtml = items.map(item => {
        // Conteúdo principal
        let content = (
            (typeof item.markdown === 'string' && item.markdown) ||
            (typeof item.page_content === 'string' && item.page_content) ||
            (typeof item.text === 'string' && item.text) ||
            ''
        );

        const rawHtml  = renderMarkdown(content);
        const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

        const metaData = item._meta;

        const titleHtml = `<strong>${metaData.title}</strong> (${metaData.area})  ●  <em>${metaData.author}</em>  ●  #${metaData.number}  ●  ${metaData.date}`;

        const scoreHtml = (typeof metaData.score === 'number' && !Number.isNaN(metaData.score))
            ? `<span class="rag-badge">Score: ${metaData.score.toFixed(2)}</span>` : '';

        return `
        <div class="displaybox-item">
            <div class="displaybox-header" style="text-align: left; padding-left: 0;">
                <span class="header-text">${titleHtml}</span>
            </div>
            <div class="displaybox-text">
                <span class="displaybox-text markdown-content">${safeHtml}</span>
                <span class="metadata-badge">${scoreHtml}</span>
            </div>
        </div>
        `;
    }).join('');

    // 4) Bloco final (único grupo — EC)
    const groupHtml = `
    <div class="displaybox-group">
        <div class="displaybox-header">
            <span style="color: blue; font-size: 16px; font-weight: bold;">Enciclopédia da Conscienciologia</span>
            <span class="score-badge" style="font-size: 12px">${items.length} resultado${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="displaybox-content">
            ${contentHtml}
        </div>
    </div>
    `;

    container.insertAdjacentHTML('beforeend', groupHtml);
}







// ________________________________________________________________________________________
// Show Verbetopedia
// ________________________________________________________________________________________

function showVerbetopedia2(container, data) {
    if (!container) {
        console.error('Results container not found');
        return;
    }

    // 0) Garantir array de entrada
    const arr = Array.isArray(data.results) ? data.results : [];
    if (!arr.length) {
        container.insertAdjacentHTML(
            'beforeend',
            '<div class="displaybox-container"><div class="displaybox-content">No results to display.</div></div>'
        );
        return;
    }

    // 3) Agrupar por fonte normalizada
    const groups = arr.reduce((acc, it, idx) => {
        const raw = it?.book || it?.source || it?.file || 'Results';
        const key = normSourceName(raw);
        if (!acc[key]) acc[key] = [];
        acc[key].push({ ...it, _origIndex: idx, _srcRaw: raw, _src: key });
        return acc;
    }, {});
    const groupNames = Object.keys(groups);

    // 5) Render EC
    groupNames.forEach(groupName => {
        // Ordena por source
        const items = groups[groupName].slice().sort((a, b) => {
            const na = Number.isFinite(a?.source) ? a.source : Infinity;
            const nb = Number.isFinite(b?.source) ? b.source : Infinity;
            return na - nb;  // Agora ordena do menor para o maior score
        });

        // Gera linhas
        const contentHtml = items.map((item, idx) => {
            // 5.1) Conteúdo de parágrafo (markdown)
            let content = (
                (typeof item.markdown === 'string' && item.markdown) ||
                (typeof item.page_content === 'string' && item.page_content) ||
                (typeof item.text === 'string' && item.text) ||
                ''  
            );
            
            const rawHtml = renderMarkdown(content);
            const safeHtml = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);

            // Extract metadata
            const metaData = extractMetadata(item, 'verbetopedia');
           
            // Join badges into a single string  
            const titleHtml = `<strong>${metaData.title}</strong> (${metaData.area})  ●  <em>${metaData.author}</em>  ●  ${metaData.number}  ●  ${metaData.date}`;

            const scoreHtml = (typeof metaData.score === 'number' && !Number.isNaN(metaData.score))
                ? `<span class="rag-badge">Score: ${metaData.score.toFixed(2)}</span>` : '';

            // Título acima do texto, agrupando em um único filho do flex
            return `
            <div class="displaybox-item">
                <div class="displaybox-header" style="text-align: left; padding-left: 0;">
                    <span class="header-text">${titleHtml}</span>
                </div>
                <div class="displaybox-text">
                    <span class="displaybox-text markdown-content">${safeHtml}</span>
                    <span class="metadata-badge">${scoreHtml}</span>
                </div>
            </div>
            `;

        }).join('');

        // Header do grupo + conteúdo
        const groupHtml = `
        <div class="displaybox-group">
            <div class="displaybox-header">
                <span style="color: blue; font-size: 16px; font-weight: bold;">Enciclopédia da Conscienciologia</span>
                <span class="score-badge" style="font-size: 12px">${items.length} resultado${items.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="displaybox-content">
                ${contentHtml}
            </div>
        </div>
        `;
        container.insertAdjacentHTML('beforeend', groupHtml);
    });
}
