---
name: csv
description: "Use this skill any time a CSV (Comma-Separated Values) file is the primary input or output. This includes tasks to: read, parse, analyze, clean, transform, or export CSV files; create new CSV files from data; merge or split CSV files; perform data analysis on tabular data in CSV format. If the user mentions a CSV file by name, extension, or path, use this skill."
---

# CSV File Handling in EverFern

## Overview

Users may ask you to read, analyze, create, or modify CSV files. Use Python with `pandas` for robust CSV operations on Windows with absolute paths (e.g., `C:\Users\Username\Downloads\data.csv`).

## Reading and Analyzing CSV Files

### Basic CSV Operations with pandas

```python
import pandas as pd

# Read CSV
df = pd.read_csv(r'C:\path\to\file.csv')

# Preview data
print(df.head())           # First 5 rows
print(df.info())           # Column info and types
print(df.describe())       # Statistical summary
print(df.shape)            # Rows and columns count
print(df.columns.tolist()) # Column names

# Analyze data
print(df['ColumnName'].value_counts())  # Count unique values
print(df.isnull().sum())                # Missing values
```

## Data Cleaning and Transformation

### Remove Duplicates

```python
df_clean = df.drop_duplicates()
df_clean.to_csv(r'C:\path\to\output.csv', index=False)
```

### Filter Rows

```python
filtered = df[df['ColumnName'] > 100]
filtered.to_csv(r'C:\path\to\filtered.csv', index=False)
```

### Select Specific Columns

```python
selected = df[['Column1', 'Column2', 'Column3']]
selected.to_csv(r'C:\path\to\selected.csv', index=False)
```

### Handle Missing Values

```python
# Remove rows with missing values
df_clean = df.dropna()

# Fill missing values
df_filled = df.fillna(0)  # Fill with 0
df_filled = df.fillna(df.mean())  # Fill with column mean

df_filled.to_csv(r'C:\path\to\output.csv', index=False)
```

## Creating CSV Files

### From Python Data

```python
import pandas as pd

data = {
    'Name': ['Alice', 'Bob', 'Charlie'],
    'Age': [25, 30, 35],
    'City': ['NYC', 'LA', 'Chicago']
}

df = pd.DataFrame(data)
df.to_csv(r'C:\path\to\new_file.csv', index=False)
```

### From Lists

```python
import csv

data = [
    ['Name', 'Email', 'Phone'],
    ['John', 'john@example.com', '123-456-7890'],
    ['Jane', 'jane@example.com', '098-765-4321']
]

with open(r'C:\path\to\file.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(data)
```

## Data Analysis

### Group By and Aggregation

```python
# Group by a column and calculate statistics
summary = df.groupby('Category')['Amount'].sum()
summary.to_csv(r'C:\path\to\summary.csv')

# Multiple aggregations
summary = df.groupby('Category').agg({
    'Amount': 'sum',
    'Count': 'count',
    'Average': 'mean'
})
summary.to_csv(r'C:\path\to\summary.csv')
```

### Merge CSV Files

```python
df1 = pd.read_csv(r'C:\path\to\file1.csv')
df2 = pd.read_csv(r'C:\path\to\file2.csv')

# Concatenate rows
merged = pd.concat([df1, df2], ignore_index=True)

# Merge by common column
merged = pd.merge(df1, df2, on='CommonColumn')

merged.to_csv(r'C:\path\to\merged.csv', index=False)
```

## Export Options

```python
# Tab-separated
df.to_csv(r'C:\path\to\file.tsv', sep='\t', index=False)

# With encoding
df.to_csv(r'C:\path\to\file.csv', index=False, encoding='utf-8')

# Custom delimiter
df.to_csv(r'C:\path\to\file.csv', sep=';', index=False)
```

## Tips and Best Practices

- **Always check data types**: Use `df.dtypes` to verify columns were parsed correctly
- **Specify encoding**: Use `encoding='utf-8'` or `encoding='latin-1'` if needed
- **Index handling**: Use `index=False` when writing to avoid extra row numbers
- **Large files**: Use `chunksize` parameter for memory efficiency: `pd.read_csv(file, chunksize=1000)`
- **Dialects**: Specify dialect for special CSV formats: `pd.read_csv(file, dialect='excel-tab')`
