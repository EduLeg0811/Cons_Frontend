from collections import defaultdict
import logging
import os
import re
from typing import Any, DefaultDict, Dict, List
import unicodedata

from utils.config import FILES_SEARCH_DIR


# =============================================================================================
# Função principal: Lexical Search
# =============================================================================================
def lexical_search_in_files(search_term: str, source: List[str]) -> List[Dict[str, Any]]:
    """
    results = [
    {
        "paragraph": "Texto do parágrafo encontrado",
        "paragraph_number": 12,
        "book": "LivroA.md"
    },
    {
        "paragraph": "Outro parágrafo com o termo buscado",
        "paragraph_number": 25,
        "book": "LivroA.md"
    },
    {
        "paragraph": "Mais um exemplo",
        "paragraph_number": 7,
        "book": "LivroB.md"
    }
    ]

    Extrair apenas o texto dos parágrafos
    paragraphs = [item["paragraph"] for item in results]

    Extrair apenas os números de parágrafo (ignorando None)
    numbers = [item["paragraph_number"] for item in results if item["paragraph_number"] is not None]

    Extrair todos os livros distintos
    books = list({item["book"] for item in results})

    """
    results: List[Dict[str, Any]] = []
    found_books = set()

    # Lista todos os arquivos .md disponíveis
    all_files = _list_markdown_files(FILES_SEARCH_DIR)
    file_map = {os.path.splitext(os.path.basename(f))[0].upper(): f for f in all_files}

    # Seleciona apenas os arquivos pedidos pelo usuário
    matching_files = []
    for book in source:
        book_upper = book.upper()
        if book_upper in file_map:
            matching_files.append(file_map[book_upper])
            found_books.add(book_upper)

    if not matching_files:
        missing_books = ", ".join(source)
        error_msg = f"No matching files found for books: {missing_books}"
        logging.error(error_msg)
        raise ValueError(error_msg)

    not_found = set(b.upper() for b in source) - found_books
    if not_found:
        logging.warning(f"Could not find files for books: {', '.join(not_found)}")

    # Processa cada arquivo
    for file_path in matching_files:
        try:
            content = _read_markdown_file(file_path)
            book = os.path.splitext(os.path.basename(file_path))[0]
            matches = _search_in_content(content, search_term)

            for match in matches or []:
                results.append({
                    "markdown": match.get("paragraph_text"),
                    "number": match.get("paragraph_number"),
                    "source": book,
                })

        except Exception as e:
            logging.error(f"Error processing file {file_path}: {str(e)}")

    logging.info(f"<<<<<lexical_search_in_files>>>>> Found {len(results)} matches for '{search_term}'")
    return results


# =============================================================================================
# Função auxiliar: Processar parágrafos encontrados
# =============================================================================================
def process_found_paragraph(paragraph: str, search_term: str) -> str:
    """
    Processa um parágrafo encontrado para reestruturá-lo com base em "|" e no termo de busca.

    Regras:
    - Se houver 2 ou mais ocorrências de "|":
      * Mantém o primeiro trecho.
      * Adiciona apenas os subtrechos que contêm o termo de busca.
    - Caso contrário, retorna o parágrafo original.

    Args:
        paragraph (str): O parágrafo encontrado.
        search_term (str): O termo buscado.

    Returns:
        str: O parágrafo processado (ou original se não houver modificação).
    """
    if not search_term:
        return paragraph

    search_term_lower = search_term.lower()

    if paragraph.count("|") >= 2:
        subtrechos = paragraph.split("|")
        if not subtrechos:
            return paragraph

        novo_paragrafo_partes = [subtrechos[0].strip()]

        for subtrecho in subtrechos[1:]:
            subtrecho_limpo = subtrecho.strip()
            if search_term_lower in subtrecho_limpo.lower():
                novo_paragrafo_partes.append(subtrecho_limpo)

        # Se nenhum subtrecho relevante foi encontrado, descarta
        if len(novo_paragrafo_partes) == 1:
            return ""

        resultado = " ".join(novo_paragrafo_partes)
        resultado = resultado.replace("|", "").replace("\\", "").replace("\n", "").strip()

        return resultado
    else:
        return paragraph


# =============================================================================================
# Função auxiliar: Listar arquivos .md
# =============================================================================================
def _list_markdown_files(source_dir: str = FILES_SEARCH_DIR) -> List[str]:
    """
    Lista todos os arquivos .md no diretório especificado.

    Args:
        source_dir (str): Caminho da pasta onde procurar arquivos markdown.

    Returns:
        List[str]: Lista com paths completos dos arquivos encontrados.
    """
    try:
        md_path = os.path.abspath(source_dir)

        files = [
            os.path.join(md_path, f)
            for f in os.listdir(md_path)
            if f.lower().endswith(".md")
        ]

        all_files = os.listdir(md_path)
        logging.info(f"<<<<<_list_markdown_files>>>>> All files in directory ({len(all_files)}): {all_files}")

        return files

    except Exception as e:
        logging.error(f"Error in _list_markdown_files: {str(e)}")
        raise


# =============================================================================================
# Função auxiliar: Ler arquivo .md
# =============================================================================================
def _read_markdown_file(path: str, encodings: tuple = ("utf-8", "cp1252")) -> str:
    """
    Lê o conteúdo de um arquivo markdown, testando múltiplos encodings.

    Args:
        path (str): Caminho do arquivo.
        encodings (tuple): Encodings a testar em sequência.

    Returns:
        str: Conteúdo do arquivo como string.

    Raises:
        Exception: Se nenhum encoding funcionar.
    """
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            logging.error(f"<<<<<_read_markdown_file>>>>> Error decoding {path} with encoding {enc}")
            continue
    raise Exception(f"Não foi possível decodificar {path} com os encodings {encodings}")




# =============================================================================================
# Função auxiliar: Buscar dentro do conteúdo
# =============================================================================================
# topo do arquivo


def _strip_accents(s: str) -> str:
    # remove acentos mantendo apenas letras “base”
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def _normalize_for_match(s: str) -> str:
    # normaliza para comparação: sem acentos, minúsculo
    return _strip_accents(s or '').lower()


def _search_in_content(content: str, search_term: str, match_mode: str = "word") -> List[Dict[str, Any]]:
    """
    Busca termo no conteúdo, retornando parágrafos "reais" por linha não vazia,
    com número absoluto do parágrafo no arquivo (1..N).
    - match_mode: "word" (usa limites de palavra) ou "substring" (contém).
    - acentos são ignorados (normalização NFD).
    """
    if not content or not search_term:
        return []

    # quebra simples: 1 linha = 1 parágrafo visual
    paras = [p.strip() for p in content.split("\n") if p.strip()]

    # normalizações
    term_norm = _normalize_for_match(search_term)
    if not term_norm:
        return []

    # padrão para "word" (limites de palavra após normalização)
    # \b funciona bem em ASCII; após remover acentos é suficiente p/ PT-BR
    if match_mode == "word":
        pattern = re.compile(rf"\b{re.escape(term_norm)}\b", flags=re.IGNORECASE)
        def match_fun(pnorm: str) -> bool:
            return bool(pattern.search(pnorm))
    else:  # "substring"
        def match_fun(pnorm: str) -> bool:
            return term_norm in pnorm

    results: List[Dict[str, Any]] = []
    for idx, paragraph in enumerate(paras, start=1):
        pnorm = _normalize_for_match(paragraph)

        if match_fun(pnorm):
            processed = process_found_paragraph(paragraph, search_term)
            if processed and processed.strip():
                results.append({
                    "paragraph_text": processed,   # mantém original (com acentos)
                    "paragraph_number": idx,       # número absoluto
                })

    return results











def group_lexical(results: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Agrupa os resultados de lexical_search_in_files por livro.

    Args:
        results (List[Dict[str, Any]]): Saída da função lexical_search_in_files,
            contendo uma lista de dicionários com as chaves:
            - paragraph (str)
            - paragraph_number (int | None)
            - book (str)

    Returns:
        Dict[str, List[Dict[str, Any]]]: Dicionário agrupado por livro.
            Exemplo:
            {
                "LivroA.md": [
                    {"paragraph": "...", "paragraph_number": 12, "book": "LivroA.md"},
                    {"paragraph": "...", "paragraph_number": 25, "book": "LivroA.md"},
                ],
                "LivroB.md": [
                    {"paragraph": "...", "paragraph_number": 7, "book": "LivroB.md"},
                ]
            }

    #USO:
    # Busca simples (lista plana)
    results = lexical_search_in_files("consciência", ["LivroA", "LivroB"])

    # Agrupamento por livro
    grouped = group_lexical(results)

    print(grouped.keys())       # livros encontrados
    print(grouped["LivroA.md"]) # lista de parágrafos só do LivroA



    """
    grouped: DefaultDict[str, List[Dict[str, Any]]] = defaultdict(list)

    for item in results:
        book = item.get("book", "UNKNOWN")
        grouped[book].append(item)

    return dict(grouped)




