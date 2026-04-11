---
name: txt
description: "Use this skill any time a text file (.txt) is the primary input or output. This includes tasks to: read, analyze, search, transform, or create plain text files; extract text patterns; process logs; create reports; manipulate text content. If the user mentions a text file or .txt path, use this skill."
---

# Text File Handling in EverFern

## Overview

Users may ask you to read, analyze, create, or modify text files. Use Python's file operations for reading/writing text on Windows with absolute paths (e.g., `C:\Users\Username\Downloads\data.txt`).

## Reading Text Files

### Read Entire File

```python
# Read all content
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    content = f.read()
    print(content)

# Read line by line
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    for line in f:
        print(line.strip())

# Read into list
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    print(f"Total lines: {len(lines)}")
```

## Writing Text Files

### Create or Overwrite File

```python
content = "Hello, World!\nLine 2\nLine 3"

with open(r'C:\path\to\output.txt', 'w', encoding='utf-8') as f:
    f.write(content)
```

### Append to File

```python
with open(r'C:\path\to\file.txt', 'a', encoding='utf-8') as f:
    f.write("\nNew line appended")
```

### Write Multiple Lines

```python
lines = [
    "Line 1",
    "Line 2",
    "Line 3",
    "Line 4"
]

with open(r'C:\path\to\output.txt', 'w', encoding='utf-8') as f:
    f.writelines([line + '\n' for line in lines])
```

## Text Processing

### Search and Replace

```python
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Simple replace
new_content = content.replace('old_text', 'new_text')

# Using regular expressions
import re
new_content = re.sub(r'pattern', 'replacement', content)

with open(r'C:\path\to\output.txt', 'w', encoding='utf-8') as f:
    f.write(new_content)
```

### Extract Specific Lines

```python
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Get lines 5-10
selected_lines = lines[4:10]  # Zero-indexed

# Get lines matching pattern
import re
pattern = re.compile(r'keyword')
matching_lines = [line for line in lines if pattern.search(line)]

with open(r'C:\path\to\output.txt', 'w', encoding='utf-8') as f:
    f.writelines(matching_lines)
```

### Count Words, Lines, Characters

```python
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.splitlines()
    words = content.split()
    chars = len(content)

print(f"Lines: {len(lines)}")
print(f"Words: {len(words)}")
print(f"Characters: {chars}")
```

## Data Extraction

### Extract Structured Data

```python
import re

with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract emails
emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content)

# Extract URLs
urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', content)

# Extract numbers
numbers = re.findall(r'\d+', content)

print(f"Emails found: {emails}")
print(f"URLs found: {urls}")
print(f"Numbers found: {numbers}")
```

### Parse Delimited Data

```python
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse pipe-delimited data
data = []
for line in lines:
    fields = [field.strip() for field in line.split('|')]
    data.append(fields)

print(data)
```

## File Merging and Splitting

### Merge Multiple Text Files

```python
import os

files = [
    r'C:\path\to\file1.txt',
    r'C:\path\to\file2.txt',
    r'C:\path\to\file3.txt'
]

with open(r'C:\path\to\merged.txt', 'w', encoding='utf-8') as outfile:
    for file in files:
        with open(file, 'r', encoding='utf-8') as infile:
            outfile.write(infile.read())
            outfile.write('\n')  # Add separator
```

### Split File by Size

```python
def split_file(file_path, lines_per_file=1000):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for i in range(0, len(lines), lines_per_file):
        chunk = lines[i:i + lines_per_file]
        output_file = f'part_{i//lines_per_file}.txt'

        with open(output_file, 'w', encoding='utf-8') as f:
            f.writelines(chunk)

split_file(r'C:\path\to\large_file.txt')
```

## Text Analysis

### Word Frequency

```python
from collections import Counter

with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    content = f.read().lower()
    words = content.split()
    filtered_words = [w for w in words if len(w) > 3]  # Skip short words

word_counts = Counter(filtered_words)
print(word_counts.most_common(20))  # Top 20 words
```

### Unique Lines

```python
with open(r'C:\path\to\file.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

unique_lines = list(set(lines))

with open(r'C:\path\to\output.txt', 'w', encoding='utf-8') as f:
    f.writelines(unique_lines)
```

## Tips and Best Practices

- **Always specify encoding**: Use `encoding='utf-8'` for Windows compatibility
- **Use context managers**: Always use `with` statements for proper file closure
- **Handle errors**: Wrap file operations in try/except blocks
- **Large files**: For very large files, read line-by-line instead of loading all at once
- **Path handling**: Use raw strings (`r'...'`) for Windows paths to avoid escape issues
- **Line endings**: Be aware of different line endings (LF vs CRLF on Windows)
- **Permissions**: Ensure write permissions before trying to create/modify files
