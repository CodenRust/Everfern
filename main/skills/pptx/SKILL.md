---
name: pptx
description: "Use this skill any time a .pptx file (PowerPoint presentation) is involved — as input, output, or both. This includes creating slide decks, reading or extracting text from a .pptx file, editing or modifying existing presentations, or combining slides. If a .pptx file needs to be opened, created, or touched, use this skill."
---

# PPTX Skill for EverFern

## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | Python `python-pptx` |
| Create from scratch | Python `python-pptx` |

---

## Reading Content

**Requirement:** `pip install python-pptx`

```python
from pptx import Presentation

# Open presentation
prs = Presentation(r"C:\path\to\presentation.pptx")
print(f"Total Slides: {len(prs.slides)}")

# Extract text
for i, slide in enumerate(prs.slides, 1):
    print(f"\n--- Slide {i} ---")
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for paragraph in shape.text_frame.paragraphs:
            print(paragraph.text)
```

---

## Creating from Scratch

Use `python-pptx` to programmatically build presentations on Windows.

### Basic Presentation

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN

prs = Presentation()

# Available Master Slide Layouts (0-8 by default):
# 0: Title Slide
# 1: Title and Content
# 2: Section Header
# 3: Two Content
# 4: Comparison
# 5: Title Only
# 6: Blank
# 7: Content with Caption
# 8: Picture with Caption

# Title Slide
title_slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(title_slide_layout)
title = slide.shapes.title
subtitle = slide.placeholders[1]

title.text = "Hello, EverFern!"
subtitle.text = "Agentic Desktop Assistant"

# Standard Slide
bullet_slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(bullet_slide_layout)
shapes = slide.shapes
title_shape = shapes.title
body_shape = shapes.placeholders[1]

title_shape.text = "Features"

tf = body_shape.text_frame
tf.text = "Core workflow"

p = tf.add_paragraph()
p.text = "Mandatory Planning"
p.level = 1

p = tf.add_paragraph()
p.text = "Human-in-the-loop review"
p.level = 2

# Add Picture
# (assuming you have a local image)
img_path = r"C:\path\to\image.jpg"
# blank_slide_layout = prs.slide_layouts[6]
# slide = prs.slides.add_slide(blank_slide_layout)
# left = top = Inches(1)
# height = Inches(5.5)
# pic = slide.shapes.add_picture(img_path, left, top, height=height)

prs.save(r"C:\path\to\output.pptx")
```

---

## Best Practices

* **Always use absolute Windows paths** (e.g., `C:\Users\Username\file.pptx`).
* **Use Raw Strings**: Path formatting in Python should use `r"C:\..."` or escaped slashes to prevent `\n` or `\t` bugs.
* **Avoid Complex Shapes Elements**: `python-pptx` handles basic objects (text generation, static templates). For heavy data-driven visualizations, use Matplotlib/Seaborn and embed them as images.
