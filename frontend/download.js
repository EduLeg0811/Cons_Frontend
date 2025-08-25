// Global variables
let lastResults = null;
let currentSearchType = '';
let currentSearchTerm = '';

/**
 * Initialize download buttons for a specific search type
 * @param {string} searchType - Type of search (lexical, semantical, verbetopedia, mancia, ragbot)
 * @param {string} searchTerm - Current search term
 */
function initDownloadButtons(searchType, searchTerm = '') {
    currentSearchType = searchType;
    currentSearchTerm = searchTerm;
    
    const downloadDocx = document.getElementById('downloadDocx');
    const downloadButtons = document.querySelector('.download-buttons');
    
    // Remove existing event listeners to avoid duplicates
    if (downloadDocx) {
        const newDownloadDocx = downloadDocx.cloneNode(true);
        downloadDocx.parentNode.replaceChild(newDownloadDocx, downloadDocx);
        newDownloadDocx.addEventListener('click', handleDocxDownload);
    }
    
    // Show/hide download buttons container based on results
    if (downloadButtons) {
        const hasResults = lastResults && 
                         ((Array.isArray(lastResults) && lastResults.length > 0) || 
                          (lastResults.results && lastResults.results.length > 0));
        downloadButtons.style.display = hasResults ? 'block' : 'none';
    }
}

/**
 * Handle DOCX download button click
 */
async function handleDocxDownload() {
    if (!lastResults || (Array.isArray(lastResults) ? lastResults.length === 0 : !lastResults.results || lastResults.results.length === 0)) {
        alert("No results to download.");
        return;
    }
    
    const button = this;
    const originalHtml = button?.innerHTML;
    
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
        button.disabled = true;
    }
    
    try {
        await downloadResults('docx', lastResults, currentSearchTerm, currentSearchType);
    } catch (error) {
        console.error('Download failed:', error);
        alert('Download failed. Please try again.');
    } finally {
        if (button) {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    }
}

/**
 * Update results and initialize download buttons
 * @param {Object|Array} data - Search results data
 * @param {string} term - Search term
 * @param {string} searchType - Type of search
 * @returns {Object} The stored results
 */
function updateResults(data, term, searchType) {
    lastResults = data;
    currentSearchTerm = term;
    currentSearchType = searchType;
    initDownloadButtons(searchType, term);
    return lastResults;
}

// Initialize download buttons when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const downloadDocx = document.getElementById('downloadDocx');
        if (downloadDocx) {
            downloadDocx.addEventListener('click', handleDocxDownload);
        }
    });
} else {
    const downloadDocx = document.getElementById('downloadDocx');
    if (downloadDocx) {
        downloadDocx.addEventListener('click', handleDocxDownload);
    }
}

// Make functions available globally
window.downloadUtils = {
    initDownloadButtons,
    updateResults,
    downloadResults
};






/**
 * Sends the processed results to the backend and triggers a download.
 * 
 * @param {'pdf'|'docx'} format - The desired download format
 * @param {Object} resultsData - The search results to download, structure varies by search type
 * @param {string} searchTerm - The original search term
 * @param {string} searchType - The type of search
 */
async function downloadResults(format, resultsData, searchTerm, searchType) {
  // Handle different result structures - could be direct array or object with results array
  const term = resultsData?.term || searchTerm || 'results';
  const type = resultsData?.search_type || searchType || '';
  const resultsArray = Array.isArray(resultsData) ? resultsData : (resultsData?.results || []);
  
  if (resultsArray.length === 0) {
    alert("No results to download.");
    return;
  }

  // Sanitize and trim the search term for the filename
  let safeTerm = (term || 'results')
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')        // Replace spaces with dashes
    .toLowerCase()
    .substring(0, 50);           // Limit length

  // Get the download button and set loading state
  const button = document.querySelector(`#download${format === 'markdown' ? 'Md' : 'Docx'}`);
  const originalHtml = button?.innerHTML;
  
  if (button) {
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
    button.disabled = true;
  }

  try {

    // ***************************************************************************************
    // Call Download with the search type
    // ***************************************************************************************
    const response = await call_download(format, resultsArray, term, type);
    
    // ***************************************************************************************
        
    const blob = await response.blob();
    
    // Get filename from Content-Disposition header or generate one
    let filename = `${safeTerm}.${format}`;
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Create and trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error('Download failed:', error);
    alert(`Download failed: ${error.message}`);
  } finally {
    // Restore button state
    if (button) {
      button.innerHTML = originalHtml;
      button.disabled = false;
    }
  }
}
