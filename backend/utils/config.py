import os
from dotenv import load_dotenv

load_dotenv()
    
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_LLM="gpt-5-nano"
TEMPERATURE=0.3
TOP_K=20 #SIMILARITY SEMANTICAL SEARCH
LLM_MAX_RESULTS=50 #RAGBOT INTERNAL
FECTH_K=150 #SIMILARITY SEMANTICAL SEARCH

# Vector Store ID - FAISS Local
FAISS_ID_DAC="DAC"
FAISS_ID_LO1="LO1"
FAISS_ID_LO2="LO2"
FAISS_ID_QUEST="QUEST"
FAISS_ID_MANUAIS="MANUAIS"
FAISS_ID_ECWV="ECWV"
FAISS_ID_HSRP="HSRP"
FAISS_ID_700EXP="700EXP"
FAISS_ID_PROJ="PROJ"
FAISS_ID_CCG="CCG"
FAISS_ID_ECALL_DEF="ECALL_DEF"

# Vector Store ID - OPENAI
OPENAI_ID_ALLWV="vs_6870595f39dc8191b364854cf46ffc74"
OPENAI_ID_ALLCONS="vs_6870595f39dc8191b364854cf46ffc74"
DEFAULT_VECTOR_STORE_OPENAI=OPENAI_ID_ALLCONS



# ================================================================
# Diretórios base (relativos à pasta backend)
# ================================================================
# => este arquivo está em: .../Simple_v23/backend/config.py
# Portanto, BASE_DIR = .../Simple_v23/backend
# Base directory = .../backend  (1 nível acima do arquivo utils/config.py)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

FILES_SEARCH_DIR = os.path.abspath(os.path.join(BASE_DIR, os.getenv("FILES_SEARCH_DIR", "files")))
FAISS_INDEX_DIR  = os.path.abspath(os.path.join(BASE_DIR, os.getenv("FAISS_INDEX_DIR", "faiss_index")))


INSTRUCTIONS_LLM_BACKEND = "Você é um assistente da Conscienciologia no estilo ChatGPT."

#from utils.config import OPENAI_API_KEY, MODEL_LLM, TEMPERATURE, TOP_K, FAISS_INDEX_DIR, FAISS_ID_DAC, FAISS_ID_LO, FAISS_ID_QUEST, FAISS_ID_MANUAIS, FAISS_ID_ECWV, FAISS_ID_HSRP, FAISS_ID_700EXP, FAISS_ID_PROJ, FAISS_ID_CCG, FAISS_ID_DEF_ECWV, OPENAI_ID_ALLWV, OPENAI_ID_ALLCONS






