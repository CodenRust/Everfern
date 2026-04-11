---
name: json
description: "Use this skill any time a JSON (JavaScript Object Notation) file is the primary input or output. This includes tasks to: read, parse, validate, analyze, or modify JSON files; create new JSON files; merge or transform JSON structures; extract data from JSON; convert data to JSON format. If the user mentions a JSON file by name, extension, or path (.json), use this skill."
---

# JSON File Handling in EverFern

## Overview

Users may ask you to read, analyze, create, or modify JSON files. Use Python with built-in `json` module or `pandas` for structured data. Use absolute Windows paths (e.g., `C:\Users\Username\Downloads\data.json`).

## Reading JSON Files

### Read and Parse JSON

```python
import json

# Read JSON file
with open(r'C:\path\to\file.json', 'r') as f:
    data = json.load(f)

# Print formatted JSON
print(json.dumps(data, indent=2))

# Get specific values
value = data['key']
nested_value = data['parent']['child']
```

### Read with pandas (for tabular JSON)

```python
import pandas as pd

# Read JSON file as DataFrame
df = pd.read_json(r'C:\path\to\file.json')

# Preview data
print(df.head())
print(df.info())
```

## Writing JSON Files

### Write Python Objects as JSON

```python
import json

data = {
    'name': 'John',
    'age': 30,
    'email': 'john@example.com',
    'hobbies': ['reading', 'coding', 'gaming']
}

# Write to file (formatted)
with open(r'C:\path\to\output.json', 'w') as f:
    json.dump(data, f, indent=2)

# Write minified (compact)
with open(r'C:\path\to\output_minified.json', 'w') as f:
    json.dump(data, f)
```

## Parsing and Transforming JSON

### Parse JSON String

```python
import json

json_string = '{"name": "Alice", "age": 25}'
data = json.loads(json_string)  # Parse string
print(data['name'])
```

### Convert JSON to String

```python
json_string = json.dumps(data, indent=2)
print(json_string)
```

### Validate JSON

```python
import json

def validate_json(json_file):
    try:
        with open(json_file, 'r') as f:
            json.load(f)
        print("✓ Valid JSON")
        return True
    except json.JSONDecodeError as e:
        print(f"✗ Invalid JSON: {e}")
        return False

validate_json(r'C:\path\to\file.json')
```

## Data Transformation

### Extract and Transform Data

```python
import json

# Read JSON
with open(r'C:\path\to\input.json', 'r') as f:
    data = json.load(f)

# Transform (example: extract specific fields)
transformed = [
    {'id': item['id'], 'name': item['name']}
    for item in data
]

# Write transformed data
with open(r'C:\path\to\output.json', 'w') as f:
    json.dump(transformed, f, indent=2)
```

### Flatten Nested JSON

```python
import json
import pandas as pd

with open(r'C:\path\to\nested.json', 'r') as f:
    data = json.load(f)

# Flatten to DataFrame then back to JSON
df = pd.json_normalize(data)
flattened = json.loads(df.to_json(orient='records'))

with open(r'C:\path\to\flattened.json', 'w') as f:
    json.dump(flattened, f, indent=2)
```

### Merge Multiple JSON Files

```python
import json

files = [
    r'C:\path\to\file1.json',
    r'C:\path\to\file2.json',
    r'C:\path\to\file3.json'
]

merged = []
for file in files:
    with open(file, 'r') as f:
        merged.extend(json.load(f))

with open(r'C:\path\to\merged.json', 'w') as f:
    json.dump(merged, f, indent=2)
```

## Query and Filter JSON

### Filter Arrays in JSON

```python
import json

with open(r'C:\path\to\file.json', 'r') as f:
    data = json.load(f)

# Filter: get items where age > 25
filtered = [item for item in data if item['age'] > 25]

with open(r'C:\path\to\filtered.json', 'w') as f:
    json.dump(filtered, f, indent=2)
```

### Group JSON Data

```python
import json
from itertools import groupby

with open(r'C:\path\to\file.json', 'r') as f:
    data = json.load(f)

# Group by category
grouped = {}
for item in data:
    category = item['category']
    if category not in grouped:
        grouped[category] = []
    grouped[category].append(item)

with open(r'C:\path\to\grouped.json', 'w') as f:
    json.dump(grouped, f, indent=2)
```

## Special Cases

### Handle Large JSON Files

```python
import json

# Process in chunks
def process_large_json(file_path, chunk_size=1000):
    with open(file_path, 'r') as f:
        data = json.load(f)

    for i in range(0, len(data), chunk_size):
        chunk = data[i:i + chunk_size]
        # Process chunk
        print(f"Processing {len(chunk)} items...")

        # Save chunk results
        with open(f'output_{i}.json', 'w') as out:
            json.dump(chunk, out)

process_large_json(r'C:\path\to\large_file.json')
```

### Add UTF-8 BOM (for Excel compatibility)

```python
import json

with open(r'C:\path\to\file.json', 'w', encoding='utf-8-sig') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
```

## Tips and Best Practices

- **Always validate**: Use `try/except` with `json.JSONDecodeError` when reading untrusted JSON
- **Pretty print**: Use `indent=2` or `indent=4` for human-readable output
- **Encoding**: Always specify `encoding='utf-8'` for Windows compatibility
- **Escape characters**: Use `ensure_ascii=False` to preserve non-ASCII characters
- **Large files**: For very large JSON, consider streaming or chunking
- **Comments**: JSON doesn't support comments; use separate `.jsonc` files if comments are needed
