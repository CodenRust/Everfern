---
name: docx
description: "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Use when extracting or reorganizing content from .docx files, inserting or replacing images, performing find-and-replace, working with tracked changes or comments, or converting content into a polished Word document. If the user asks for a 'report', 'memo', 'letter', or 'template' as a .docx file, use this skill."
---

# DOCX Creation, Editing, and Analysis in EverFern

## Overview

A .docx file is a ZIP archive containing XML files. In EverFern, you use native Windows tools and Python libraries directly to interact with them. You MUST use Windows paths (e.g., `C:\path\to\file.docx`).

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | `pandoc` or `python-docx` |
| Create new document | Use `python-docx` |
| Edit existing document | Use `python-docx` |

### Reading Content

```powershell
# Text extraction
pandoc "C:\path\to\document.docx" -o "C:\path\to\output.md"
```

---

## Python `python-docx` (Preferred Method)

The primary and safest way to manipulate Word documents in Python is the `python-docx` library.
Install it if necessary: `pip install python-docx`

### Creating a New Document

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Add Title
title = doc.add_heading('Document Title', 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Add Paragraph
p = doc.add_paragraph('This is a paragraph with ')
p.add_run('bold').bold = True
p.add_run(' and ')
p.add_run('italic').italic = True
p.add_run(' text.')

# Add a styled heading
heading = doc.add_heading('Section 1', level=1)
run = heading.runs[0]
run.font.color.rgb = RGBColor(0x42, 0x24, 0xE9)

# Add List
doc.add_paragraph('First item in bulleted list', style='List Bullet')
doc.add_paragraph('First item in numbered list', style='List Number')

# Add Picture
# doc.add_picture(r"C:\path\to\image.png", width=Inches(1.25))

# Add Table
table = doc.add_table(rows=1, cols=3)
table.style = 'Table Grid'
hdr_cells = table.rows[0].cells
hdr_cells[0].text = 'Qty'
hdr_cells[1].text = 'Id'
hdr_cells[2].text = 'Desc'

for item in [[1, '101', 'Spam'], [2, '102', 'Eggs']]:
    row_cells = table.add_row().cells
    row_cells[0].text = str(item[0])
    row_cells[1].text = item[1]
    row_cells[2].text = item[2]

doc.add_page_break()
doc.save(r'C:\path\to\demo.docx')
```

### Editing an Existing Document

```python
from docx import Document

doc = Document(r"C:\path\to\existing_document.docx")

# Read text
for para in doc.paragraphs:
    print(para.text)

# Replace text
for para in doc.paragraphs:
    if 'old_text' in para.text:
        inline = para.runs
        for i in range(len(inline)):
            if 'old_text' in inline[i].text:
                text = inline[i].text.replace('old_text', 'new_text')
                inline[i].text = text

doc.save(r"C:\path\to\modified_document.docx")
```

### Working with Tables

```python
from docx import Document

doc = Document(r"C:\path\to\document_with_table.docx")

# Read a table
table = doc.tables[0]
for row in table.rows:
    for cell in row.cells:
        print(cell.text)

# Modify a cell
table.cell(0, 0).text = "Updated Header"
doc.save(r"C:\path\to\updated.docx")
```

---

## Best Practices

- Always use absolute Windows paths (e.g., `C:\Users\Username\Documents\file.docx`).
- Use `r"..."` strings in Python for Windows paths to avoid escape sequence errors.
- Never manually unzip and edit XML directly unless absolutely necessary. `python-docx` handles the complex relationships within the `.docx` archive.
- Ensure the user has the required fonts installed if specifying them explicitly.
