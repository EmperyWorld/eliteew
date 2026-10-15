# Fixed Error: Kursorina Deep Synthesis Scale, Library Echo Shield, and Evidence Cleansing

**Product:** `kursorina`  
**Date:** 2026-09-07  
**Status:** `fixed`  
**Severity:** `high`

---

## 1. Symptom

1. **Library Echo Chamber / Duplicate Reading Thrash:**  
   In mission `1c7619a0`, 12 of 24 steps were wasted reading duplicate copies of older risk matrices and Mermaid diagrams previously saved to the user's Content Manager library. The worker repeatedly invoked `read_content` on identical documents.
2. **Binary PDF Garbage in Evidence:**  
   When a PDF download was truncated or parsing failed, `fetch_url.py` fell back to `data.decode("utf-8")`, injecting thousands of characters of raw `%PDF-1.5%` binary stream into the evidence ledger and LLM context window.
3. **Superficial Questionnaire Deliverables:**  
   When requested to generate an enterprise discovery brief or technical questionnaire, Kursorina produced only 7 questions (1 per domain) in a concise Markdown table, lacking depth, answer alternatives (A/B/C/D), and technical impact analysis.
4. **Company Tech Stack Discovery Blindspot:**  
   Searches for client company technical conditions stopped at basic legal/CRM records without querying IT infrastructure, vacancies, or tech stack components.

---

## 2. Failure Layer

- **Catalog Search & Heuristic Decisions (`library.py`, `decide.py`):** `tool_search_library` returned multiple revisions with the same title; `_unread_library_hits` forced reading every hit unconditionally without title deduplication or step limits.
- **Web Content Ingestion (`fetch_url.py`, `tools.py`):** Unchecked fallback decoding raw binary streams for PDF MIME types; lack of binary stream rejection in `tool_fetch_url`.
- **Synthesis System Prompting (`synthesize.py`):** Lack of explicit structure requirements, question quantity quotas (25–35+), and section composition rules for enterprise briefs.
- **Investigation Planning (`plan.py`):** Company facet queries did not incorporate IT infrastructure, vacancies, or tech stack cues.

---

## 3. Root Cause

1. `_unread_library_hits` did not normalize document titles or track already read titles, causing repeat readings of identical files.
2. `fetch_url.py` decoded binary byte arrays as UTF-8 when `_extract_pdf_text` returned empty on corrupt/truncated PDFs.
3. `_SYNTH_SYSTEM` instructed the LLM to create a summary table without mandating question depth (4–6 per domain) or option variants.
4. `query_for_facet` for companies used a generic suffix without checking for tech stack cues.

---

## 4. Cause-Layer Changes

1. **Library Shield & Title Deduplication (`library.py`, `decide.py`):**
   - Added `_normalize_doc_title()` to strip copy suffixes, dates, and non-alphanumeric noise, comparing leading title words.
   - In `tool_search_library`, deduplicate results by normalized title and cap unique documents to 4.
   - In `_unread_library_hits`, skip duplicate titles and cap successful `read_content` steps to a maximum of 2 distinct files per mission.
2. **Safe PDF & Evidence Cleansing (`fetch_url.py`, `tools.py`):**
   - In `fetch_url.py`, prevent raw byte decoding when `is_pdf` is true and extraction yields empty; return a clean diagnostic error.
   - In `tool_fetch_url`, reject text containing `%PDF-` binary signatures or excessive replacement characters.
3. **Company Tech Stack Profiling (`plan.py`):**
   - Enriched `query_for_facet` for companies: when goal mentions tech stack, DBMS, or architecture, target IT infrastructure, vacancies, and architecture queries.
4. **Deep Synthesis Scale & Questionnaire Engine (`synthesize.py`):**
   - Expanded `_SYNTH_SYSTEM` with an 8-chapter structure and mandated at least 4–6 questions per domain (25–35+ questions total in Section 3) with full option variants (A/B/C/D), metrics, purpose, and architectural impact.
   - Expanded `num_predict` to 12,288 tokens and output budget to 64,000 characters.

---

## 5. Verification Result

- `tests/test_kursorina_worker.py`: 117 tests passed in 0.95s, including new tests:
  - `test_unread_library_hits_deduplicates_duplicate_titles_and_caps_steps`
  - `test_query_for_facet_enriches_company_tech_stack_query`
  - `test_synthesize_system_prompt_mandates_exhaustive_chapters_and_questionnaire_matrix`
- Vitest frontend tests: 14 passed in 1.36s.
- Biome check: clean.
- Ruff format and check: clean.
