

//______________________________________________________________________________________________
// semantical_formatResponse  --- call from [bridge.js] <call_semantical>
//______________________________________________________________________________________________
function semantical_formatResponse(responseData, term) {
    
  const count = responseData.length;
  const search_type = "semantical";

  //if source contains "ECALL_DEF", change it to "EC"
  responseData.forEach(item => {
    if (item.source === "ECALL_DEF") {
        item.source = "EC";
    }            
  });

  const formattedResponse = {
    count: count,
    search_type: search_type,
    term: term,
    results: responseData,
  };

return formattedResponse;

}





//______________________________________________________________________________________________
// lexical_formatResponse  --- call from [bridge.js] <call_lexical>
//______________________________________________________________________________________________
function lexical_formatResponse(responseData, term) {
    
  const formattedResponse = responseData;

return formattedResponse;

}




//______________________________________________________________________________________________
// llm_formatResponse  --- call from [bridge.js] <call_llm>
//______________________________________________________________________________________________
function llm_formatResponse(responseData) {
    // Group citations by source
    const citationsBySource = responseData.citations
        .replace(/[\[\]]/g, '')  // Remove brackets
        .split(';')              // Split by semicolon
        .map(pair => {
            const [source, page] = pair.split(',').map(s => s.trim());
            return {
                source: source.replace(/\.[^/.]+$/, ''), // Remove file extension
                page: parseInt(page, 10) || 0
            };
        })
        .reduce((acc, {source, page}) => {
            if (!acc[source]) acc[source] = new Set();
            acc[source].add(page);
            return acc;
        }, {});

    // Format the grouped citations
    const formattedCitations = Object.entries(citationsBySource)
        .map(([source, pages]) => 
            `${source}: ${Array.from(pages).sort((a, b) => a - b).join(', ')}`
        )
        .join(' ; ');

    const formattedResponse = {
        text: responseData.text,
        citations: formattedCitations,
        total_tokens_used: responseData.total_tokens_used || 0,
        type: responseData.type || 'ragbot',
        model: responseData.model,
        temperature: responseData.temperature,
    };
    
    return formattedResponse;
}







//______________________________________________________________________________________________
// extractMetadata
//______________________________________________________________________________________________
function extractMetadata(data, type) {
    // Handle case where data is not an array or is null/undefined
    if (!data) {
      console.warn('extractMetadata: No data provided');
      return {};
    }
  
    // Convert single object to array if needed
    const dataArray = Array.isArray(data) ? data : [data];
    const metadata = {};
  
  
    // Common metadata fieldS
    const COMMON_FIELDS = ['title', 'number', 'source'];
  
    // Type-specific field mappings and processing
    const TYPE_CONFIG = {
      ragbot: {
        metadataFields: [...COMMON_FIELDS, 'citations', 'total_tokens_used', 'model', 'temperature']
      },
      lexical: {
        metadataFields: [...COMMON_FIELDS]
      },
      semantical: {
        metadataFields: [...COMMON_FIELDS, 'area', 'theme', 'author', 'sigla', 'date', 'link', 'score', 'argumento', 'section', 'folha']
      },
      mancia: {
        metadataFields: [...COMMON_FIELDS, 'citations', 'total_tokens_used', 'model', 'temperature']
      },
      verbetopedia: {
        metadataFields: [...COMMON_FIELDS, 'area', 'theme', 'author', 'sigla', 'date', 'link', 'score']
      }
    };
  
  
  
    // Get type-specific config
    const config = TYPE_CONFIG[type]
  
    // Process each item in the data array
    dataArray.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
  
      const itemKey = `item_${index}`;
      metadata[itemKey] = {};
  
      // Only include fields that are explicitly defined in metadataFields
      Object.entries(item).forEach(([key, value]) => {
        const isMetadata = config.metadataFields.includes(key);
        const isExcluded = key.startsWith('_') || // Exclude private fields
                         typeof value === 'function'; // Exclude methods
  
        if (isMetadata && !isExcluded) {
          // Handle nested objects and arrays
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            metadata[itemKey][key] = extractMetadata(value, type);
          } else {
            metadata[itemKey][key] = value;
          }
        }
      });
    });
  
    // If there's only one item, return it directly instead of nesting
    const result = Object.keys(metadata).length === 1 ? metadata[Object.keys(metadata)[0]] : metadata;

    return result;
  }
  
  