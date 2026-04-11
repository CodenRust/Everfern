---
name: xlsx
description: "Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file; create a new spreadsheet from scratch or from other data sources; or convert tabular data. If the user mentions a spreadsheet file by name or path — e.g., 'the xlsx in my downloads' — use this skill."
---

# XLSX Creation, Editing, and Analysis in EverFern

## Overview

A user may ask you to create, edit, or analyze the contents of an .xlsx file. On Windows, use Python libraries like `pandas` and `openpyxl`. Use absolute Windows paths (e.g., `C:\Users\Username\Downloads\data.xlsx`).

## Reading and Analyzing Data

### Data Analysis with pandas

For data analysis, visualization, and basic operations, use **pandas**:

```python
import pandas as pd

# Read Excel
df = pd.read_excel(r'C:\path\to\file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel(r'C:\path\to\file.xlsx', sheet_name=None)  # All sheets as dict

# Analyze
print(df.head())      # Preview data
print(df.info())      # Column info
print(df.describe())  # Statistics

# Write Excel
df.to_excel(r'C:\path\to\output.xlsx', index=False)
```

---

## Modifying Excel Files

If the user wants you to edit existing spreadsheets while keeping formatting, or write formulas, use `openpyxl`.

### CRITICAL: Use Formulas, Not Hardcoded Values

**Always use Excel formulas instead of calculating values in Python and hardcoding them.** This ensures the spreadsheet remains dynamic and updateable.

#### ❌ WRONG - Hardcoding Calculated Values

```python
total = df['Sales'].sum()
sheet['B10'] = total  # Hardcodes 5000
```

#### ✅ CORRECT - Using Excel Formulas

```python
sheet['B10'] = '=SUM(B2:B9)'
```

---

## Common Workflows

### Creating New Excel Files

```python
# pip install openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# Add data
sheet['A1'] = 'Hello'
sheet['B1'] = 'World'
sheet.append(['Row', 'of', 'data'])

# Add formula
sheet['B2'] = '=SUM(A1:A10)'

# Formatting
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')

# Column width
sheet.column_dimensions['A'].width = 20

wb.save(r'C:\path\to\output.xlsx')
```

### Editing Existing Excel Files

```python
# Using openpyxl to preserve formulas and formatting
from openpyxl import load_workbook

# Load existing file
wb = load_workbook(r'C:\path\to\existing.xlsx')
sheet = wb.active  # or wb['SheetName'] for specific sheet

# Working with multiple sheets
for sheet_name in wb.sheetnames:
    print(f"Sheet: {sheet_name}")

# Modify cells
sheet['A1'] = 'New Value'
sheet.insert_rows(2)  # Insert row at position 2
sheet.delete_cols(3)  # Delete column 3

# Add new sheet
new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save(r'C:\path\to\modified.xlsx')
```

---

## Best Practices

### Library Selection

* **pandas**: Best for data analysis, bulk operations, and simple data export
* **openpyxl**: Best for complex formatting, formulas, and Excel-specific features

### Working with openpyxl

* Cell indices are 1-based (row=1, column=1 refers to cell A1)
* To read calculated values instead of formula strings: `load_workbook('file.xlsx', data_only=True)`.
  * **Warning**: If opened with `data_only=True` and saved, formulas are replaced with values and permanently lost. Only use this for reading.
* For large files: Use `read_only=True` for reading.

### Working with pandas

* Specify data types to avoid inference issues: `pd.read_excel('file.xlsx', dtype={'id': str})`
* For large files, read specific columns: `pd.read_excel('file.xlsx', usecols=['A', 'C', 'E'])`
* Handle dates properly: `pd.read_excel('file.xlsx', parse_dates=['date_column'])`

### Formula Checklist

* [ ] **Division by zero**: Check denominators before using `/` in formulas (#DIV/0!)
* [ ] **Wrong references**: Verify all cell references point to intended cells (#REF!)
* [ ] **Cross-sheet references**: Use correct format (Sheet1!A1) for linking sheets
