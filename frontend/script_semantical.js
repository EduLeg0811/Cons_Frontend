// script_semantical.js

let controller = null;

document.addEventListener('DOMContentLoaded', () => {

    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');



    // Initialize download buttons
    window.downloadUtils.initDownloadButtons('semantical');
    
    searchButton.addEventListener('click', semantical_search);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') semantical_search();
    });

   

    //______________________________________________________________________________________________
    // Semantical Search
    //______________________________________________________________________________________________
    async function semantical_search() {

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


        

        // Cancela requisição anterior, se houver
        if (controller) controller.abort();
        controller = new AbortController();
        let timeoutId = null;
        timeoutId = setTimeout(() => controller.abort(), 30000); // 30s

        try {

            
            // Prepare search    
            // =================
            const term = searchInput.value.trim();
            
            // Validação de termo — sai cedo, mas ainda passa pelo finally
            if (!term) {
                resultsDiv.innerHTML = '<p class="error">Please enter a search term</p>';
                return;
            }
            
            // Get selected books
            let selectedBooks = [];
            document.querySelectorAll('input[name="book"]:checked').forEach(checkbox => {
                selectedBooks.push(checkbox.value);
            });
            
            // If no books selected, select LO by default
            const source = selectedBooks.length > 0 ? selectedBooks : ['LO'];

            // Clear previous results
            resultsDiv.innerHTML = '';

            let newTerm = '';

            // Get the checkbox state
            const flag_definition = document.getElementById('enableDefinition')?.checked ?? true;
           

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
                    chat_id                     // <<< NOVO
                };
               
                const defJson = await call_llm(paramRAGbot);
                if (defJson.chat_id) localStorage.setItem('cons_chat_id', defJson.chat_id);

                //*****************************************************************************************

                // Display results
                // ================
                removeLoading(resultsDiv);
                displayResults(resultsDiv, "Synthesis", 'title');
                displayResults(resultsDiv, defJson, 'simple');

                // If the synthesis is empty, we don't proceed to semantic search
                newTerm = (defJson?.text || '').trim();
                if (!newTerm) {
                    removeLoading(resultsDiv);
                    console.error('Definition error:');
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
                source: source,
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
            const newTitle = `Semantical Search    ●    ${term}`;
            removeLoading(resultsDiv);
            displayResults(resultsDiv, newTitle, 'title');
            displayResults(resultsDiv, semJson, "semantical");


            // Update results using centralized function
            if (window.downloadUtils && window.downloadUtils.updateResults) {
                window.downloadUtils.updateResults(semJson, term, 'semantical');
            }

        } catch (error) {
            console.error('Search error:', error);
            resultsDiv.innerHTML = `<div class="error"><p>${error.name === 'AbortError' ? 'Request timed out' : error.message || 'Error occurred during search'}</p></div>`;
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
