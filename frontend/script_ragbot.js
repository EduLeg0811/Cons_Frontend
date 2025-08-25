// script_ragbot.js

let controller = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    
    // Initialize download buttons
    window.downloadUtils.initDownloadButtons('ragbot');

    searchButton.addEventListener('click', ragbot);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') ragbot();
    });



    //______________________________________________________________________________________________
    // RAGbot
    //______________________________________________________________________________________________
    async function ragbot() {


      // Save original button state for restoration
      const originalButtonState = {
        html: searchButton.innerHTML,
        opacity: searchButton.style.opacity,
        cursor: searchButton.style.cursor
      };

        // If already disabled, prevent re-entry by click/Enter
        if (searchButton?.disabled) return;

        // Disable and show "searching"
        searchButton.disabled = true;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';
        searchButton.style.opacity = '0.7';
        searchButton.style.cursor = 'not-allowed'

        // Cancel previous request if any
        if (controller) controller.abort();
        controller = new AbortController();
        let timeoutId = null;
        timeoutId = setTimeout(() => controller.abort(), 30000); // 30s




        try {

  
          // Prepare search    
          // =================
          const term = searchInput.value.trim();
          
            // Validate term - exit early but still go through finally
          if (!term) {
              resultsDiv.innerHTML = '<p class="error">Please enter a search term</p>';
                return;
          }

          resultsDiv.innerHTML = '';

          // _______________________________________________
          // Loading
          // _______________________________________________
          insertLoading(resultsDiv, "Waiting for The Oracle...");

             
          //call_ragbot
          //*****************************************************************************************
          // 
          const chat_id = getOrCreateChatId();
          const paramRAGbot = {
            query: term,
            model: MODEL_LLM,
            temperature: TEMPERATURE,
            vector_store_names: OPENAI_RAGBOT,
            instructions: INSTRUCTIONS_LLM_USER,
            use_session: true,
            chat_id
          };
          
          const response = await call_llm(paramRAGbot);
          if (response.chat_id) localStorage.setItem('cons_chat_id', response.chat_id); // <<< NOVO
          // *****************************************************************************************


          removeLoading(resultsDiv);
          displayResults(resultsDiv, "Cons.AI Oracle", 'title');
          displayResults(resultsDiv, response, "ragbot");


          const downloadData = prepareDownloadData(response, term);
          
          // Update results for download
          //window.downloadUtils.updateResults(downloadData, term, 'ragbot');

        } catch (error) {
            console.error('Error in ragbot:', error);
            resultsDiv.innerHTML = `<div class="error"><p>${error.name === 'AbortError' ? 'Request timed out' : error.message || 'An unexpected error occurred'}</p></div>`;
        } finally {
          // Re-enable the search button and restore original state
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







// Prepare results for download
function prepareDownloadData(response, term) {
    // Extract the response text - handle both direct text and results array formats
    const responseText = response?.results?.[0]?.text || response?.text || response || "";
    
    return {
        text: responseText,
        query: term || "",
        model: response?.model || MODEL_LLM,
        temperature: response?.temperature || TEMPERATURE,
        citations: response?.results?.[0]?.citations || [],
        search_type: "ragbot",
    };
}



