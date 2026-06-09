"""
CodeComply — Embedding Ingest Script
Reads chunked .md files and loads them into Supabase pgvector.

Usage:
    python ingest_embeddings.py

Set these env vars in project root .env:
    SUPABASE_URL=
    SUPABASE_SERVICE_ROLE_KEY=
    VOYAGE_API_KEY=
    VOYAGE_EMBEDDING_MODEL=voyage-code-3  (default; 200M free tokens, code-optimized)
    VOYAGE_RPM_BUDGET=120                 (tier-1; voyage-code-3 allows ~2000 RPM)
    VOYAGE_MIN_REQUEST_INTERVAL=0.5
    VOYAGE_TPM_BUDGET=2500000             (tier-1 voyage-code-3 = 3M TPM)
    VOYAGE_BATCH_DELAY=0.5
    VOYAGE_ONLY_FILE=fire                 (optional; process one file by name substring)
    FORCE_REEMBED=1                       (optional; re-embed even if section exists)

Install deps: pip install supabase tqdm python-dotenv
"""

import os
import re
import json
import time
import random
import urllib.error
import urllib.request
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm
from supabase import create_client, Client

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent
load_dotenv(ROOT_DIR / ".env")

CHUNKS_DIR = SCRIPT_DIR / "chunks"
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
VOYAGE_API_KEY = os.environ["VOYAGE_API_KEY"]
EMBEDDING_MODEL = os.getenv("VOYAGE_EMBEDDING_MODEL", "voyage-code-3")
MAX_DOCS_PER_BATCH = int(os.getenv("VOYAGE_MAX_DOCS_PER_BATCH", os.getenv("VOYAGE_BATCH_SIZE", "128")))
MAX_TOKENS_PER_BATCH = int(os.getenv("VOYAGE_MAX_TOKENS_PER_BATCH", "80000"))
VOYAGE_TPM_BUDGET = int(os.getenv("VOYAGE_TPM_BUDGET", "2500000"))
VOYAGE_RPM_BUDGET = int(os.getenv("VOYAGE_RPM_BUDGET", "120"))
VOYAGE_MIN_REQUEST_INTERVAL = float(os.getenv("VOYAGE_MIN_REQUEST_INTERVAL", "0.5"))
VOYAGE_BATCH_DELAY = float(os.getenv("VOYAGE_BATCH_DELAY", "0.5"))
VOYAGE_FILE_DELAY = float(os.getenv("VOYAGE_FILE_DELAY", "1"))
VOYAGE_MAX_RETRIES = int(os.getenv("VOYAGE_MAX_RETRIES", "8"))
ONLY_FILE = os.getenv("VOYAGE_ONLY_FILE", "")
FORCE_REEMBED = os.getenv("FORCE_REEMBED", "").lower() in ("1", "true", "yes")

_token_window: list[tuple[float, int]] = []
_request_window: list[float] = []
_cooldown_until = 0.0
_last_request_at = 0.0


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def parse_chunks_from_md(filepath: Path) -> list[dict]:
    """Parse a chunked .md file into list of chunk dicts."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Split on chunk separator
    raw_chunks = content.split("\n---\n")
    chunks = []

    for raw in raw_chunks:
        raw = raw.strip()
        if not raw or not raw.startswith("CHUNK_ID:"):
            continue

        chunk = {}
        # Parse each field
        for field in ["CHUNK_ID", "CODE_BODY", "SECTION", "TITLE",
                      "APPLIES_TO", "SKIP", "AMENDMENT_OF", "CROSS_REFERENCES"]:
            m = re.search(rf"^{field}:\s*(.+)$", raw, re.MULTILINE)
            chunk[field.lower()] = m.group(1).strip() if m else ""

        # Extract CONTENT (everything after CONTENT: line)
        content_match = re.search(r"^CONTENT:\n(.*?)$", raw, re.DOTALL | re.MULTILINE)
        chunk["content"] = content_match.group(1).strip() if content_match else ""

        # Parse applies_to into array
        chunk["applies_to"] = [x.strip() for x in chunk["applies_to"].split(",") if x.strip()]

        # Parse skip bool
        chunk["skip"] = chunk["skip"].lower() == "true"

        # Only include non-empty, non-skipped chunks
        if chunk["content"] and chunk["chunk_id"]:
            chunks.append(chunk)

    return chunks


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def chunk_embedding_text(chunk: dict) -> str:
    return f"{chunk['section']} {chunk['title']}\n{chunk['content']}"[:8000]


def iter_embedding_batches(chunks: list[dict]):
    """Batch by doc count and estimated tokens (Voyage recommends larger batches)."""
    batch: list[dict] = []
    batch_tokens = 0
    for chunk in chunks:
        tok = estimate_tokens(chunk_embedding_text(chunk))
        if batch and (len(batch) >= MAX_DOCS_PER_BATCH or batch_tokens + tok > MAX_TOKENS_PER_BATCH):
            yield batch
            batch = []
            batch_tokens = 0
        batch.append(chunk)
        batch_tokens += tok
    if batch:
        yield batch


def extend_cooldown(seconds: float) -> None:
    global _cooldown_until
    _cooldown_until = max(_cooldown_until, time.time() + seconds)


def record_tokens(tokens: int) -> None:
    _token_window.append((time.time(), tokens))


def record_voyage_request(tokens: int) -> None:
    global _last_request_at
    now = time.time()
    _last_request_at = now
    _request_window.append(now)
    record_tokens(tokens)


def pace_voyage_request(tokens: int) -> None:
    """Throttle by cooldown, min interval, RPM, and TPM (429 is often RPM on free tier)."""
    global _request_window, _last_request_at, _token_window

    now = time.time()
    if now < _cooldown_until:
        wait = _cooldown_until - now
        print(f"  ⏸️  Cooldown, waiting {wait:.0f}s...")
        time.sleep(wait)

    _request_window = [t for t in _request_window if time.time() - t < 60]
    if len(_request_window) >= VOYAGE_RPM_BUDGET:
        oldest = _request_window[0]
        wait = max(0.0, 60 - (time.time() - oldest) + 0.5)
        if wait > 0:
            print(f"  ⏸️  RPM cap ({len(_request_window)}/{VOYAGE_RPM_BUDGET} req/min), waiting {wait:.0f}s...")
            time.sleep(wait)
        _request_window = [t for t in _request_window if time.time() - t < 60]

    if _last_request_at:
        since = time.time() - _last_request_at
        if since < VOYAGE_MIN_REQUEST_INTERVAL:
            time.sleep(VOYAGE_MIN_REQUEST_INTERVAL - since)

    now = time.time()
    _token_window = [(t, n) for t, n in _token_window if now - t < 60]
    used = sum(n for _, n in _token_window)
    if used + tokens > VOYAGE_TPM_BUDGET:
        oldest = _token_window[0][0] if _token_window else now
        wait = max(0.0, 60 - (time.time() - oldest) + 0.5)
        if wait > 0:
            print(f"  ⏸️  TPM cap ({used:,}+{tokens:,} > {VOYAGE_TPM_BUDGET:,}), waiting {wait:.0f}s...")
            time.sleep(wait)
        _token_window = [(t, n) for t, n in _token_window if time.time() - t < 60]


def fetch_existing_sections(jurisdiction: str, code_body: str) -> set[str]:
    sections: set[str] = set()
    offset = 0
    page_size = 1000
    while True:
        resp = (
            supabase.table("code_sections")
            .select("section")
            .eq("jurisdiction", jurisdiction)
            .eq("code_body", code_body)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not resp.data:
            break
        sections.update(r["section"] for r in resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size
    return sections


def get_embedding(texts: list[str]) -> list[list[float]]:
    """Get embeddings for a batch of texts via Voyage AI (retries on 429)."""
    texts = [t[:8000] for t in texts]
    batch_tokens = sum(estimate_tokens(t) for t in texts)
    payload = json.dumps({
        "input": texts,
        "model": EMBEDDING_MODEL,
        "input_type": "document",
    }).encode("utf-8")

    delay = 10
    for attempt in range(VOYAGE_MAX_RETRIES):
        pace_voyage_request(batch_tokens)
        req = urllib.request.Request(
            "https://api.voyageai.com/v1/embeddings",
            data=payload,
            headers={
                "Authorization": f"Bearer {VOYAGE_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.load(resp)
            record_voyage_request(batch_tokens)
            return [item["embedding"] for item in data["data"]]
        except urllib.error.HTTPError as e:
            _request_window.append(time.time())
            if e.code in (429, 503) and attempt < VOYAGE_MAX_RETRIES - 1:
                retry_after = e.headers.get("Retry-After")
                wait = int(retry_after) if retry_after and str(retry_after).isdigit() else delay
                wait += random.uniform(0, min(5, wait * 0.1))
                extend_cooldown(wait)
                print(f"  ⏳ Rate limited ({e.code}), waiting {wait:.0f}s (attempt {attempt + 1}/{VOYAGE_MAX_RETRIES})...")
                time.sleep(wait)
                delay = min(delay * 2, 120)
                continue
            raise


def dedupe_rows(rows: list[dict]) -> list[dict]:
    """One row per (jurisdiction, code_body, section) — required for Postgres upsert."""
    deduped = {}
    for row in rows:
        key = (row["jurisdiction"], row["code_body"], row["section"])
        deduped[key] = row
    return list(deduped.values())


def dedupe_chunks(chunks: list[dict], jurisdiction: str) -> list[dict]:
    deduped = {}
    for c in chunks:
        key = (jurisdiction, c["code_body"], c["section"])
        deduped[key] = c
    return list(deduped.values())


def ingest_chunks(chunks: list[dict], jurisdiction: str):
    """Embed and insert chunks into Supabase."""
    active_chunks = [c for c in chunks if not c["skip"]]
    before = len(active_chunks)
    active_chunks = dedupe_chunks(active_chunks, jurisdiction)
    if before > len(active_chunks):
        print(f"  Deduplicated {before - len(active_chunks)} duplicate section keys")

    if active_chunks and not FORCE_REEMBED:
        code_body = active_chunks[0]["code_body"]
        existing = fetch_existing_sections(jurisdiction, code_body)
        if existing:
            pending = [c for c in active_chunks if c["section"] not in existing]
            skipped = len(active_chunks) - len(pending)
            if skipped:
                print(f"  Skipping {skipped} sections already in Supabase (set FORCE_REEMBED=1 to redo)")
            active_chunks = pending

    if not active_chunks:
        print("  Nothing to embed for this file")
        return

    print(f"  Ingesting {len(active_chunks)} active chunks (skipping {len(chunks) - before} marked skip in source)")

    batches = list(iter_embedding_batches(active_chunks))
    for batch_idx, batch in enumerate(tqdm(batches, desc="  Embedding")):
        texts = [chunk_embedding_text(c) for c in batch]
        batch_tokens = sum(estimate_tokens(t) for t in texts)
        if batch_idx == 0 or len(batches) > 1:
            tqdm.write(f"  batch {batch_idx + 1}/{len(batches)}: {len(batch)} docs, ~{batch_tokens:,} tokens")

        try:
            embeddings = get_embedding(texts)
        except Exception as e:
            extend_cooldown(90)
            print(f"  ⚠️  Embedding failed on batch {batch_idx} after retries: {e}")
            print("  Cooling down 90s, then continuing...")
            time.sleep(90)
            continue

        # Build rows for Supabase
        rows = []
        for chunk, embedding in zip(batch, embeddings):
            rows.append({
                "jurisdiction": jurisdiction,
                "code_year": 2025,
                "code_body": chunk["code_body"],
                "section": chunk["section"],
                "title": chunk["title"],
                "full_text": chunk["content"],
                "summary": chunk["content"][:500],  # placeholder; replace with Claude summary later
                "applies_to": chunk["applies_to"],
                "is_local_amendment": chunk["amendment_of"] not in ("null", "", None),
                "parent_section": None if chunk["amendment_of"] in ("null", "", None) else chunk["amendment_of"],
                "embedding": embedding,
            })

        # Insert into Supabase (dedupe again in case batch boundaries overlap keys)
        rows = dedupe_rows(rows)
        try:
            supabase.table("code_sections").upsert(
                rows,
                on_conflict="jurisdiction,code_body,section"
            ).execute()
        except Exception as e:
            print(f"  ⚠️  Supabase insert error on batch {batch_idx}: {e}")
            time.sleep(2)

        if VOYAGE_BATCH_DELAY > 0:
            time.sleep(VOYAGE_BATCH_DELAY)


def main():
    print("=" * 60)
    print("CodeComply — Embedding Ingest")
    print(f"Model: {EMBEDDING_MODEL} | RPM≤{VOYAGE_RPM_BUDGET}/min | interval≥{VOYAGE_MIN_REQUEST_INTERVAL}s")
    print("=" * 60)

    if not CHUNKS_DIR.exists():
        print(f"❌ Chunks directory not found: {CHUNKS_DIR.resolve()}")
        print("Run chunk_codes.py first.")
        return

    md_files = list(CHUNKS_DIR.glob("*_chunked.md"))
    if not md_files:
        print(f"❌ No chunked .md files found in {CHUNKS_DIR.resolve()}")
        return

    def jurisdiction_for(filename: str) -> str:
        name = filename.lower()
        if "santa ana" in name:
            return "santa_ana_ca"
        if "los angeles" in name:
            return "los_angeles_ca"
        if "long_beach" in name or "long beach" in name:
            return "long_beach_ca"
        return "california"

    for md_file in sorted(md_files):
        if ONLY_FILE and ONLY_FILE.lower() not in md_file.name.lower():
            continue
        print(f"\n📄 Processing: {md_file.name}")
        chunks = parse_chunks_from_md(md_file)
        print(f"  Found {len(chunks)} chunks")

        jurisdiction = jurisdiction_for(md_file.name)

        ingest_chunks(chunks, jurisdiction)
        print(f"  ✅ Done: {md_file.name}")
        if VOYAGE_FILE_DELAY > 0:
            time.sleep(VOYAGE_FILE_DELAY)

    print("\n" + "=" * 60)
    print("✅ All files ingested into Supabase pgvector")
    print("\nTest with a similarity search in Supabase SQL editor:")
    print("""
    select section, title, similarity
    from match_code_sections(
      (select embedding from code_sections limit 1),
      'california',
      5
    );
    """)
    print("=" * 60)


if __name__ == "__main__":
    main()
