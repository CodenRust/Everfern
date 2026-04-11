---
name: image-viewer
description: "Use this skill to view and analyze images. When a user provides an image file path (PNG, JPG, JPEG, GIF, BMP, WEBP, etc.), use this skill to display and analyze the image. The skill provides tools to read image metadata, display the image for visual analysis, and extract information from images like screenshots, diagrams, or photos."
---

# Image Viewer Skill

## Overview

This skill allows EverFern to view and analyze images from file paths. Use this when:
- A user provides an image path
- You need to analyze a screenshot or photo
- The user wants to see a visual from a file

## MANDATORY Workflow

### Step 1: Validate the Image Path
First, use the `view_file` tool to read the image file to verify it exists and is valid.

### Step 2: Display the Image
After validating, present the image using standard file presentation tools.

## Supported Formats

- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- BMP (.bmp)
- WEBP (.webp)
- TIFF (.tiff)
- SVG (.svg)

## Best Practices

- Always use absolute paths on Windows
- Check if file exists before attempting to display
- Report file size and dimensions to the user
- If the image is large, mention the resolution