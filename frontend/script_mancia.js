let controller = null;

document.addEventListener('DOMContentLoaded', () => {
    const resultsDiv   = document.getElementById('results');
    const searchButton = document.getElementById('pensataButton');
  
    // Initialize download buttons
    window.downloadUtils.initDownloadButtons('mancia');

    searchButton.addEventListener('click', mancia);

    // Garante que nunca dispare submit se for parar dentro de <form>
    searchButton.setAttribute('type', 'button');



//______________________________________________________________________________________________
// Mancia
//______________________________________________________________________________________________
    async function mancia() {

       
               

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
            
            
            //Clear container at first
            resultsDiv.innerHTML = '';
            
            // _________________________________________________________________________________
            // 1. Random Pensata
            // _________________________________________________________________________________           
            insertLoading(resultsDiv, "Selecting a random Pensata...");

            
            
            //call_random_pensata
            //*****************************************************************************************
            const paramPensata = {
                term: "none", 
                book: "LO" 
            }
            const pensJson = await call_random_pensata(paramPensata);
            //*****************************************************************************************
        
            removeLoading(resultsDiv);
            displayResults(resultsDiv, "Pensata Sorteada:   ●   Léxico de Ortopensatas (2a edição, 2019)", 'title');
            displayResults(resultsDiv, pensJson, 'simple');
            

            // Extrai text da resposta
            const pensataText = pensJson.text;






        // _________________________________________________________________________________
        // 2. Commentary   
        // _________________________________________________________________________________         

        insertLoading(resultsDiv, "Waiting for The Oracle...");
        

        //call_ragbot   
        //***************************************************************************************** 
        const chat_id = getOrCreateChatId();

        const paramRAGbot = {
            query: "Comente a seguinte Pensata: " + pensataText,
            model: MODEL_LLM,
            temperature: TEMPERATURE,
            vector_store_names: OPENAI_RAGBOT,
            instructions: COMMENTARY_INSTRUCTIONS,
        use_session: true,
        chat_id                     // <<< NOVO
        };

         const commentaryData = await call_llm(paramRAGbot);
        if (commentaryData.chat_id) localStorage.setItem('cons_chat_id', commentaryData.chat_id); // <<< NOVO
        
        //***************************************************************************************** 
       
        
        // Display results
        removeLoading(resultsDiv);
        displayResults(resultsDiv, "Comentário", 'title');
        displayResults(resultsDiv, commentaryData, 'ragbot');

        const downloadData = prepareDownloadData(pensataText, commentaryData, "Bibliomancia");

        // Update results for download
        //window.downloadUtils.updateResults(downloadData, "Bibliomancia", 'mancia');

    } catch (error) {
        console.error('Error in mancia:', error);
        resultsDiv.innerHTML = `<div class="error"><p>${error.message || 'An unexpected error occurred'}</p></div>`;
    } finally {
        // Re-enable the search button and restore original state
        if (searchButton) {
        searchButton.disabled = false;
        searchButton.innerHTML = originalButtonState.html;
        searchButton.style.opacity = originalButtonState.opacity;
        searchButton.style.cursor = originalButtonState.cursor;
        }
        clearTimeout(timeoutId);
        controller = null;
    }
    }

});




 // Prepare results for download
 function prepareDownloadData(pensataText, commentaryData, term) {
    // Ensure we have valid text for both items
    const pensataContent = pensataText || "";
    const commentaryContent = commentaryData?.results?.[0]?.text || "";
    
    return {
        results: [{
            text: pensataContent,
            source: "Pensata Sorteada",
            type: "mancia",
            metadata: {
                title: "Pensata Sorteada",
                content: pensataContent,
                order: 1  // Ensure this comes first
            }
        }, {
            text: commentaryContent,
            source: "Comentário",
            type: "mancia",
            metadata: {
                title: "Comentário",
                content: commentaryContent,
                order: 2  // Ensure this comes second
            }
        }],
        search_type: "mancia",
        term: term || "Pensata e Comentário"
    };
}
