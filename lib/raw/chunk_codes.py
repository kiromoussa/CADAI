"""
CodeComply — Building Code Chunker
Processes raw OCR'd .txt files into structured .md chunk files
ready for embedding into Supabase pgvector.

Usage:
    python chunk_codes.py

Input:  Raw .txt files in lib/raw/ (same folder as this script)
Output: Chunked .md files in lib/raw/chunks/

Run this on your Azure compute or locally.
Install deps: pip install regex tqdm
"""

import re
from pathlib import Path
from tqdm import tqdm

# ── Config ──────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRIPT_DIR
OUT_DIR = SCRIPT_DIR / "chunks"
OUT_DIR.mkdir(exist_ok=True)

# Maps filename patterns to metadata
FILE_CONFIG = {
    "gov.ca.bsc.residential.2025_djvu.txt": {
        "code_body": "California Residential Code",
        "prefix": "CRC",
        "year": 2025,
        # Regex pattern that matches section headers in this file
        "section_pattern": r"^SECTION\s+(R[\d]+(?:[\.\d]+)?)\s*[—–-]+\s*(.+)$",
        "subsection_pattern": r"^(R[\d]{3,}(?:\.[\d]+)*)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["residential", "ADU"],
    },
    "gov.ca.bsc.building.2.2025_djvu.txt": {
        "code_body": "California Building Code",
        "prefix": "CBC",
        "year": 2025,
        "section_pattern": r"^SECTION\s+([\d]+(?:[\.\d]+)?)\s*[—–-]+\s*(.+)$",
        "subsection_pattern": r"^([\d]{3,}(?:\.[\d]+)*)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["multifamily", "commercial", "all"],
    },
    "gov.ca.bsc.electrical.2025_djvu.txt": {
        "code_body": "California Electrical Code",
        "prefix": "CEC",
        "year": 2025,
        # OCR text uses numbered subsections (89.101.1 Title) more than SECTION headers
        "section_pattern": r"^(89\.\d+(?:\.\d+)+)\s+(.+)$",
        "subsection_pattern": r"^(89\.[\d]+(?:\.[\d]+)*)\s+(.+)$",
        "applies_to_default": ["residential", "ADU", "multifamily"],
    },
    "gov.ca.bsc.mechanical.2025_djvu.txt": {
        "code_body": "California Mechanical Code",
        "prefix": "CMC",
        "year": 2025,
        "section_pattern": r"^(\d{3,}(?:\.[\d]+)+)\s*$",
        "title_from_content": True,
        "subsection_pattern": r"^([\d]{3,}(?:\.[\d]+)*)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["residential", "ADU", "multifamily"],
    },
    "gov.ca.bsc.plumbing.2025_djvu.txt": {
        "code_body": "California Plumbing Code",
        "prefix": "CPC",
        "year": 2025,
        "section_pattern": r"^(\d{3,}(?:\.[\d]+)+)\s*$",
        "title_from_content": True,
        "subsection_pattern": r"^([\d]{3,}(?:\.[\d]+)*)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["residential", "ADU", "multifamily"],
    },
    "gov.ca.bsc.green.2025_djvu.txt": {
        "code_body": "California Green Building Standards Code",
        "prefix": "CGBC",
        "year": 2025,
        "section_pattern": r"^SECTION\s+([\d]+(?:[\.\d]+)?)\s*[—–-]+\s*(.+)$",
        "subsection_pattern": r"^([\d]{3,}(?:\.[\d]+)*)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["residential", "ADU", "multifamily", "all"],
    },
    "gov.ca.bsc.fire.2025_djvu.txt": {
        "code_body": "California Fire Code",
        "prefix": "CFC",
        "year": 2025,
        "section_pattern": r"^SECTION\s+([\d]+(?:[\.\d]+)?)\s*[—–-]+\s*(.+)$",
        "subsection_pattern": r"^([\d]{3,}(?:\.[\d]+)*)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["residential", "ADU", "multifamily", "all"],
    },
    "Santa Ana, CA Code of Ordinances.txt": {
        "code_body": "Santa Ana Municipal Code",
        "prefix": "SAC",
        "year": 2025,
        "section_pattern": r"^(Sec\.\s+[\d\-]+\.?|SECTION\s+[\d\-]+\.?)\s+(.+)$",
        "subsection_pattern": r"^([\d]+\.[\d]+\.[\d]+)\s+([A-Z][^.]+?)\.\s",
        "applies_to_default": ["residential", "ADU", "multifamily", "all"],
        "amendment_prefix": "CRC",  # flags local amendments against CRC
    },
}

# Sections to always skip (administrative, not compliance-relevant)
SKIP_KEYWORDS = [
    "fee schedule", "fees", "penalty", "violation fine", "enforcement",
    "administration", "organization", "council member", "city council",
    "election", "charter", "ward", "mayor", "municipal court",
    "personnel", "procurement", "finance department", "budget",
    "referenced standards", "abbreviations", "symbols",
    "table of contents", "index", "foreword", "preface",
    "reserved", "this page intentionally",
]

# Sections relevant to residential compliance — always keep
KEEP_KEYWORDS = [
    "egress", "escape", "rescue", "sprinkler", "smoke", "carbon monoxide",
    "fire", "ceiling height", "room area", "ventilation", "light",
    "stair", "handrail", "guard", "window", "door", "plumbing",
    "electrical", "energy", "insulation", "foundation", "structural",
    "flood", "seismic", "wind", "load", "bathroom", "kitchen",
    "garage", "adu", "accessory", "dwelling", "residential", "occupancy",
    "exit", "means of egress", "glazing", "safety", "hvac", "mechanical",
    "solar", "green", "water heater", "radon", "termite", "decay",
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def clean_line(line: str) -> str:
    """Remove OCR artifacts and normalize whitespace."""
    # Remove common djvu OCR garbage characters
    line = re.sub(r'[|]{2,}', '', line)
    line = re.sub(r'\[cite:\s*\d+\]', '', line)
    line = re.sub(r'\s{3,}', ' ', line)
    # Remove page headers/footers patterns
    line = re.sub(r'^\d{4}\s+20\d{2}\s+CALIFORNIA.+CODE\s*$', '', line, flags=re.IGNORECASE)
    line = re.sub(r'^INTERNATIONAL CODE COUNCIL\s*$', '', line, flags=re.IGNORECASE)
    line = re.sub(r'^\d{9,}\s*$', '', line)  # ISBN-like numbers
    return line.strip()


def should_skip(title: str, content: str) -> bool:
    """Determine if a section should be skipped."""
    combined = (title + " " + content[:200]).lower()
    # Force keep if compliance-relevant
    for kw in KEEP_KEYWORDS:
        if kw in combined:
            return False
    # Skip if administrative
    for kw in SKIP_KEYWORDS:
        if kw in combined:
            return True
    return False


def extract_cross_references(content: str, prefix: str) -> str:
    """Extract section cross-references from content."""
    # Match patterns like "Section R310.1", "R302.6", "Section 4.201"
    refs = re.findall(
        r'\b(?:Section\s+)?([A-Z]?R?\d{3,}(?:\.\d+)*)\b',
        content
    )
    # Filter to only refs that look like real section numbers
    refs = [r for r in refs if re.match(r'^[A-Z]?\d{3}', r) or re.match(r'^R\d{3}', r)]
    refs = list(dict.fromkeys(refs))  # deduplicate preserving order
    if not refs:
        return "null"
    return ", ".join(refs[:10])  # cap at 10


def infer_applies_to(title: str, content: str, default: list) -> str:
    """Infer which project types this section applies to."""
    combined = (title + " " + content[:500]).lower()
    types = set(default)

    if "one- and two-family" in combined or "single-family" in combined:
        types.add("residential")
    if "adu" in combined or "accessory dwelling" in combined:
        types.add("ADU")
    if "multifamily" in combined or "apartment" in combined or "r-2" in combined:
        types.add("multifamily")
    if "commercial" in combined or "r-3" in combined:
        types.add("commercial")

    return ", ".join(sorted(types))


def format_chunk(
    chunk_id: str,
    code_body: str,
    section: str,
    title: str,
    applies_to: str,
    skip: bool,
    amendment_of: str,
    cross_refs: str,
    content: str,
) -> str:
    return f"""---
CHUNK_ID: {chunk_id}
CODE_BODY: {code_body}
SECTION: {section}
TITLE: {title}
APPLIES_TO: {applies_to}
SKIP: {str(skip).lower()}
AMENDMENT_OF: {amendment_of}
CROSS_REFERENCES: {cross_refs}
CONTENT:
{content.strip()}
---

"""


# ── Main chunker ─────────────────────────────────────────────────────────────

def chunk_file(filename: str, config: dict) -> list[dict]:
    """
    Read a raw code .txt file and split into section chunks.
    Returns list of chunk dicts.
    """
    filepath = RAW_DIR / filename
    if not filepath.exists():
        print(f"  ⚠️  File not found: {filepath}")
        return []

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    section_pat = re.compile(config["section_pattern"], re.MULTILINE | re.IGNORECASE)
    title_on_next_line = config.get("title_on_next_line", False)
    title_from_content = config.get("title_from_content", False)
    chunks = []
    current_section = None
    current_title = None
    current_lines = []
    awaiting_title = False
    in_toc = False  # skip table of contents

    for i, raw_line in enumerate(lines):
        line = clean_line(raw_line)
        if not line:
            if current_lines:
                current_lines.append("")
            continue

        # Detect and skip table of contents block
        if re.match(r'^CONTENTS\s*$', line, re.IGNORECASE):
            in_toc = True
            continue
        if in_toc and re.match(r'^CHAPTER\s+\d', line, re.IGNORECASE):
            in_toc = False
        if in_toc:
            continue

        # Detect section header
        m = section_pat.match(line)
        if m:
            # Save previous chunk
            if current_section and current_lines:
                content = "\n".join(current_lines).strip()
                if len(content) > 50:  # skip empty/stub sections
                    chunks.append({
                        "section": current_section,
                        "title": current_title,
                        "content": content,
                    })
            current_section = m.group(1).strip()
            if title_on_next_line:
                current_title = current_section
                current_lines = []
                awaiting_title = True
                continue
            current_title = m.group(2).strip() if len(m.groups()) > 1 else current_section
            current_lines = []
            awaiting_title = False
            continue

        if awaiting_title and current_section and line:
            current_title = line
            awaiting_title = False
            continue

        if current_section:
            current_lines.append(line)
            if title_from_content and current_title == current_section:
                title_match = re.match(r"^([A-Z][A-Za-z0-9 ,\-/]{8,80})\.?\s*$", line)
                if title_match:
                    current_title = title_match.group(1).strip()

    # Don't forget the last section
    if current_section and current_lines:
        content = "\n".join(current_lines).strip()
        if len(content) > 50:
            chunks.append({
                "section": current_section,
                "title": current_title,
                "content": content,
            })

    return chunks


def process_file(filename: str, config: dict) -> int:
    """Process one code file and write chunked .md output."""
    print(f"\n📄 Processing: {filename}")
    raw_chunks = chunk_file(filename, config)

    if not raw_chunks:
        print(f"  ❌ No chunks extracted — check section_pattern for this file")
        return 0

    prefix = config["prefix"]
    code_body = config["code_body"]
    default_applies = config["applies_to_default"]
    amendment_prefix = config.get("amendment_prefix", None)

    out_lines = [f"# {code_body} — Chunked Code Sections\n",
                 f"# Generated by CodeComply chunk_codes.py\n",
                 f"# Total sections: {len(raw_chunks)}\n\n"]

    kept = 0
    skipped = 0

    for chunk in tqdm(raw_chunks, desc=f"  Formatting {prefix}"):
        section = chunk["section"]
        title = chunk["title"]
        content = chunk["content"]

        chunk_id = f"{prefix}-{section.replace(' ', '-')}"
        applies_to = infer_applies_to(title, content, default_applies)
        skip = should_skip(title, content)
        cross_refs = extract_cross_references(content, prefix)

        # For local amendments (Santa Ana etc), flag if it references a CRC section
        amendment_of = "null"
        if amendment_prefix:
            crc_refs = re.findall(r'\bR\d{3,}(?:\.\d+)*\b', content)
            if crc_refs:
                amendment_of = f"{amendment_prefix}-{crc_refs[0]}"

        out_lines.append(format_chunk(
            chunk_id=chunk_id,
            code_body=code_body,
            section=section,
            title=title,
            applies_to=applies_to,
            skip=skip,
            amendment_of=amendment_of,
            cross_refs=cross_refs,
            content=content,
        ))

        if skip:
            skipped += 1
        else:
            kept += 1

    # Write output file
    out_filename = filename.replace(".txt", "_chunked.md")
    out_path = OUT_DIR / out_filename
    with open(out_path, "w", encoding="utf-8") as f:
        f.writelines(out_lines)

    print(f"  ✅ {kept} chunks kept, {skipped} skipped → {out_path}")
    return kept


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("CodeComply — Building Code Chunker")
    print("=" * 60)

    if not RAW_DIR.exists():
        print(f"\n❌ Raw directory not found: {RAW_DIR.resolve()}")
        return

    total_chunks = 0
    for filename, config in FILE_CONFIG.items():
        if "hocr" in filename.lower():
            continue
        if not (RAW_DIR / filename).exists():
            print(f"\n⏭️  Skipping missing file: {filename}")
            continue
        n = process_file(filename, config)
        total_chunks += n

    print("\n" + "=" * 60)
    print(f"✅ Done. {total_chunks} total chunks written to {OUT_DIR.resolve()}")
    print("\nNext step: run ingest_embeddings.py to embed into Supabase pgvector")
    print("=" * 60)


if __name__ == "__main__":
    main()
