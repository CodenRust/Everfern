import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # This regex looks for the broken pattern: fontFamily: 'JetBrains Mono', 'Fira Code', monospace
    # or fontFamily: 'JetBrains Mono', 'Courier New', monospace
    # and replaces it with a properly quoted string.
    # We look for fontFamily: followed by three comma-separated single-quoted strings (or bare monospace)
    
    # Pattern explanation:
    # fontFamily:\s*
    # '([^']+)'\s*,\s*        -> Group 1: JetBrains Mono
    # '([^']+)'\s*,\s*        -> Group 2: Fira Code or Courier New
    # (monospace|'monospace') -> Group 3: monospace
    
    pattern = r"fontFamily:\s*'JetBrains Mono',\s*'([^']+)',\s*(monospace|'monospace')"
    replacement = r"fontFamily: \"'JetBrains Mono', 'Fira Code', monospace\""
    
    new_content = re.sub(pattern, replacement, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)

fix_file(r'c:\Users\srini\EverFern-Mono\everfern-desktop\apps\desktop\src\app\chat\page.tsx')
fix_file(r'c:\Users\srini\EverFern-Mono\everfern-desktop\apps\desktop\src\app\chat\ArtifactsPanel.tsx')
print("Fix complete")
