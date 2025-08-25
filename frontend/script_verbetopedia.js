// script_verbetopedia.js

let controller = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    const downloadButtons = document.querySelector('.download-buttons');

    // Initialize download buttons as hidden
    if (downloadButtons) {
        downloadButtons.style.display = 'none';
    }

    searchButton.addEventListener('click', verbetopedia);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') verbetopedia();
    });




    //______________________________________________________________________________________________
    // Verbetopedia
    //______________________________________________________________________________________________
    async function verbetopedia() {



         // Save original button state for restoration
         const originalButtonState = {
            html: searchButton.innerHTML,
            opacity: searchButton.style.opacity,
            cursor: searchButton.style.cursor
        };
        

        // Se já estiver desabilitado, evita reentrância por clique/Enter
        if (searchButton?.disabled) return;

        // Desabilita e mostra "searching"
        searchButton.disabled = true;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        searchButton.style.opacity = '0.7';
        searchButton.style.cursor = 'not-allowed';


        let timeoutId = null;

        // Cancela requisição anterior, se houver
        if (controller) controller.abort();
        controller = new AbortController();
        timeoutId = setTimeout(() => {
            if (controller) controller.abort();
        }, 30000);

        try {

            
            // Prepare search    
            // =================
            const term = searchInput.value.trim();
            
            // Validação de termo — sai cedo, mas ainda passa pelo finally
            if (!term) {
                resultsDiv.innerHTML = '<p class="error">Please enter a search term</p>';
                if (downloadButtons) downloadButtons.style.display = 'none';
                return;
            }

            // Clear previous results
            resultsDiv.innerHTML = '';

            // Get the checkbox state
            const flag_definition = document.getElementById('enableDefinition')?.checked ?? true;
            let newTerm = '';

            if (flag_definition) {
                // _________________________________________________________________________________
                // Definition - RAGbot
                // _________________________________________________________________________________

                insertLoading(resultsDiv, "Formulating a synthesis or definition");

             
                //call_ragbot
                //*****************************************************************************************
                // 
                const chat_id = getOrCreateChatId();
                
                const paramRAGbot = {
                    query: "TEXTO DE ENTRADA: " + term + ".",
                    model: MODEL_LLM,
                    temperature: TEMPERATURE,
                    vector_store_id: OPENAI_RAGBOT,
                    instructions: SEMANTICAL_INSTRUCTIONS,
                    use_session: true,
                    chat_id                 
                };
               
                const defJson = await call_llm(paramRAGbot);
                if (defJson.chat_id) localStorage.setItem('cons_chat_id', defJson.chat_id);

                //*****************************************************************************************

                

                // Display results
                // ================
                removeLoading(resultsDiv);
                //displayResults(resultsDiv, "Synthesis", 'title');
                displayResults(resultsDiv, defJson, 'simple');

                // If the synthesis is empty, we don't proceed to semantic search
                newTerm = (defJson?.text || '').trim();
                if (!newTerm) {
                    insertLoading(resultsDiv, "Sem síntese suficiente para buscar semelhanças.");
                    return;
                }

            } else {
                newTerm = term;
            }   




            // _________________________________________________________________________________
            // Semantical Search
            // _________________________________________________________________________________

            insertLoading(resultsDiv, "Searching for semantical similarities...");

            
            //call_semantical
            //*****************************************************************************************
             const paramSem = {
                term: term + ": " + newTerm + ".",
                source: ["EC"],
                model: MODEL_LLM,
            };
            
            const semJson = await call_semantical(paramSem);

            //*****************************************************************************************
                
            // Get max results from input or use default
            const maxResults = parseInt(document.getElementById('maxResults')?.value) || MAX_RESULTS_DISPLAY;

            // Restrict display to first maxResults if results exist
            if (semJson.results && Array.isArray(semJson.results)) {
                semJson.results = semJson.results.slice(0, maxResults);
            } else {
                semJson.results = [];
            }

            // Display results
            const newTitle = `Verbetopedia    ●    ${term}`;
            removeLoading(resultsDiv);
            //displayResults(resultsDiv, newTitle, 'title');
            displayResults(resultsDiv, semJson, "verbetopedia");

            console.log(`********Script_verbetopedia.js - verbetopedia*** [semJson]:`, semJson);

            // Update results using centralized function
            // if (window.downloadUtils && window.downloadUtils.updateResults) {
            //     window.downloadUtils.updateResults(semJson, term, 'semantical');
            // }

        } catch (error) {
            console.error('Search error:', error);
            resultsDiv.innerHTML = `<div class="error"><p>${error.name === 'AbortError' ? 'Request timed out' : error.message || 'Error occurred during search'}</p></div>`;
            const downloadButtons = document.querySelector('.download-buttons');
            if (downloadButtons) downloadButtons.style.display = 'none';
        } finally {
            // Always restore button state
            if (searchButton) {
                searchButton.disabled = false;
                searchButton.innerHTML = originalButtonState.html;
                searchButton.style.opacity = originalButtonState.opacity;
                searchButton.style.cursor = originalButtonState.cursor;
            }
            if (timeoutId) clearTimeout(timeoutId);
            controller = null;
        }
    }
});