import logging
import os
import re

from dotenv import load_dotenv
from openai import OpenAI

from utils.config import (
    MODEL_LLM, 
    OPENAI_API_KEY, 
    LLM_MAX_RESULTS, 
    DEFAULT_VECTOR_STORE_OPENAI, 
    TEMPERATURE, 
    INSTRUCTIONS_LLM_BACKEND,
    OPENAI_ID_ALLWV, 
    OPENAI_ID_ALLCONS
)



#................................................
# Variáveis de ambiente
#.................................................
load_dotenv()
  

logger = logging.getLogger(__name__)



#................................................
# Controle de sessão
#................................................
_llm_initialized = False
_llm_session_id = None


# Memória simples por conversa (somente em memória / por processo)
_conversation_last_id = {}  # chat_id -> último response.id



# =============================================================================
# Inicializa sessão do LLM (apenas uma vez)
# =============================================================================
def get_llm_session():
    """
    Retorna o último response.id usado para encadear a conversa (se houver).
    Não dispara chamada à API.
    """
    global _llm_initialized, _llm_session_id
    if not _llm_initialized:
        _llm_initialized = True
    return _llm_session_id



# =============================================================================
# Função principal para gerar resposta do LLM
# =============================================================================
def generate_llm_answer(query, model=MODEL_LLM, vector_store_names="ALLWV", temperature=TEMPERATURE, instructions=INSTRUCTIONS_LLM_BACKEND, use_session=True, chat_id="default"):
   
    client = OpenAI(api_key=OPENAI_API_KEY)

    if not query:
        return {"error": "Consulta vazia."}

    # Busca o id real do vector_store
    vector_store_ids = get_vector_store_ids(vector_store_names)

    # Recupera o último response.id dessa conversa
    previous_id = _conversation_last_id.get(chat_id) if use_session else None

    llm_str = {
        "model": model,
        "tools": [{
            "type": "file_search",
            "vector_store_ids": vector_store_ids,
            "max_num_results": int(LLM_MAX_RESULTS)
        }],
        "input": query,
        "instructions": instructions,   # reenvie sempre
        "store": True                   # necessário para encadear
    }

    # adiciona temperature apenas se o modelo NÃO começar com gpt-5
    if not str(model).startswith("gpt-5"):
        llm_str["temperature"] = float(temperature)

    # adiciona previous_response_id se existir
    if previous_id:
        llm_str["previous_response_id"] = previous_id


    try:

        response = client.responses.create(**llm_str)

        # Atualiza o último id desta conversa
        last_id = getattr(response, "id", None)
        if last_id and use_session:
            _conversation_last_id[chat_id] = last_id


        return format_llm_response(response)

    except Exception as e:
        logger.error(f"Erro ao gerar resposta LLM: {str(e)}")
        return {"error": f"Falha ao gerar resposta: {str(e)}"}





def get_vector_store_ids(vector_store_names):

    vector_store_ids = []
    if vector_store_names == "ALLWV":
        vector_store_ids.append(OPENAI_ID_ALLWV)
    elif vector_store_names == "ALLCONS":
        vector_store_ids.append(OPENAI_ID_ALLCONS)
    else:
        vector_store_ids.append(DEFAULT_VECTOR_STORE_OPENAI)

    return vector_store_ids


# =============================================================================
# Formata a resposta para o frontend
# =============================================================================
def format_llm_response(response_main):
    formatted_output = {"text": "", "file_citations": "No citations", "total_tokens_used": "N/A", "search_type": "ragbot"}

    try:
        output_items = getattr(response_main, "output", None)
        if output_items is None and isinstance(response_main, dict):
            output_items = response_main.get("output", None)

        if not output_items:
            if hasattr(response_main, "output_text"):
                formatted_output["text"] = str(getattr(response_main, "output_text", "")).strip()
            elif isinstance(response_main, dict) and "text" in response_main:
                formatted_output["text"] = str(response_main.get("text", "")).strip()
            else:
                formatted_output["text"] = str(response_main).strip() or "Resposta vazia"
            return formatted_output

        def get_attr(item, key, default=None):
            if isinstance(item, dict):
                return item.get(key, default)
            return getattr(item, key, default)

        message_output = next((item for item in output_items if get_attr(item, "type") == "message"), None)
        if message_output:
            content = get_attr(message_output, "content", []) or []
            text_content = next((c for c in content if get_attr(c, "type") == "output_text"), None)
            if text_content:
                formatted_output["text"] = str(get_attr(text_content, "text", "")).strip()

                # --- CITAÇÕES (file_search) -----------------------------------
                citations = []
                annotations = get_attr(text_content, "annotations", []) or []

                # cliente para resolver filename (best-effort)
                _client = None
                _file_name_cache = {}

                for ann in annotations:
                    if get_attr(ann, "type") == "file_citation":
                        file_id = get_attr(ann, "file_id") or get_attr(ann, "id")  # variantes
                        index = get_attr(ann, "index", None)

                        filename = None
                        if file_id:
                            try:
                                if file_id in _file_name_cache:
                                    filename = _file_name_cache[file_id]
                                else:
                                    if _client is None:
                                        _client = OpenAI(api_key=OPENAI_API_KEY)
                                    f = _client.files.retrieve(file_id)
                                    filename = getattr(f, "filename", None)
                                    _file_name_cache[file_id] = filename or file_id
                            except Exception:
                                filename = file_id  # fallback

                        label = filename or "file"
                        if index is not None:
                            citations.append(f"{label}, {index}")
                        else:
                            citations.append(f"{label}")

                formatted_output["file_citations"] = f"[{' ; '.join(citations)}]" if citations else "No citations"
                # ----------------------------------------------------------------

        usage = getattr(response_main, "usage", None)
        if usage:
            formatted_output["total_tokens_used"] = getattr(usage, "total_tokens", "N/A")

    except Exception as e:
        logger.error(f"Erro ao formatar resposta LLM: {str(e)}")
        formatted_output["text"] = "Erro ao processar resposta."

    return formatted_output




# =============================================================================
# Limpa o texto preservando listas
# =============================================================================
def clean_text(text):
    if not text:
        return text

    lines = text.split('\n')
    result_lines = []
    i = 0
    while i < len(lines):
        current_line = lines[i]
        result_lines.append(current_line)
        is_list_item = re.match(r'^\s*\d+\.\s', current_line) or re.match(r'^\s*[•\-\*]\s', current_line)
        if is_list_item and i + 1 < len(lines):
            next_is_list_item = re.match(r'^\s*\d+\.\s', lines[i + 1]) or re.match(r'^\s*[•\-\*]\s', lines[i + 1])
            if not next_is_list_item and lines[i + 1].strip() and not lines[i + 1].startswith('  '):
                result_lines.append('')
        if not current_line.strip():
            while i + 1 < len(lines) and not lines[i + 1].strip():
                i += 1
        i += 1
    return '\n'.join(result_lines)



# ____________________________________________________________________________
# Reset da memória de uma conversa específica
# ____________________________________________________________________________
def reset_conversation_memory(chat_id: str):
    """Remove o último response.id associado a um chat_id."""
    try:
        _conversation_last_id.pop(chat_id, None)
        logger.info(f"Memória da conversa resetada: chat_id={chat_id}")
    except Exception as e:
        logger.error(f"Erro ao resetar memória para chat_id={chat_id}: {e}")

#como usar no frontend