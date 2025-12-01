import hashlib
import re
from pathlib import Path

# --- CONFIGURATION ---
# The HTML file you want to update
HTML_FILE = 'index.html'


# ---------------------

def get_file_hash(filepath):
    """Calculates the MD5 hash of a file to use as a version number."""
    try:
        with open(filepath, 'rb') as f:
            # Read file and create 8-char hash
            return hashlib.md5(f.read()).hexdigest()[:8]
    except FileNotFoundError:
        return None


def update_html_versions():
    print(f"--- Scanning {HTML_FILE} for assets ---")

    path = Path(HTML_FILE)
    if not path.exists():
        print(f"Error: {HTML_FILE} not found.")
        return

    original_content = path.read_text(encoding='utf-8')

    # Regex logic:
    # 1. Matches href= or src=
    # 2. Captures the file path (ignoring any existing ?v=...)
    # 3. Replaces the whole tag with path + new ?v=HASH
    pattern = re.compile(r'(href|src)=("|)([^"\']+\.(?:css|js|jpg|jpeg|png|webp|svg))(\?v=[a-f0-9]+)?("|)')

    def replace_match(match):
        attr = match.group(1)  # href or src
        quote = match.group(2)  # " or '
        filepath = match.group(3)  # css/style.css
        # group(4) is the old ?v=... which we ignore/discard
        closing_quote = match.group(5)

        # Skip external links (http/https)
        if filepath.startswith('http') or filepath.startswith('//'):
            return match.group(0)

        # Resolve local file path
        local_path = Path(filepath)

        # Calculate new hash based on file content
        file_hash = get_file_hash(local_path)

        if file_hash:
            # Create the new tag with the new hash
            new_tag = f'{attr}={quote}{filepath}?v={file_hash}{closing_quote}'
            print(f"  [UPDATED] {filepath} -> v={file_hash}")
            return new_tag
        else:
            print(f"  [SKIPPED] File not found locally: {filepath}")
            return match.group(0)

    # Perform the replacement (Cleaned up: direct assignment)
    new_content = pattern.sub(replace_match, original_content)

    # Save changes only if something actually changed
    if new_content != original_content:
        path.write_text(new_content, encoding='utf-8')
        print(f"\n✅ Success! {HTML_FILE} updated.")
    else:
        print(f"\nExample: No changes detected. All versions are up to date.")


if __name__ == '__main__':
    update_html_versions()
