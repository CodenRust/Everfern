# Chrome Extension Usage Guide

## Overview

The EverFern Web Automation extension provides powerful automation capabilities for web pages. This guide explains how to use each feature.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `public/chrome-extension` directory
5. The extension will appear in your extensions list

## Features

### 1. Detect Playwright

**Purpose**: Detect if Playwright automation is running on the current page

**How to Use**:
1. Click the extension icon in the toolbar
2. Click "Detect Playwright" button
3. The extension will check if Playwright is active
4. Status will update to show detection result

**What It Does**:
- Checks for `window.__PLAYWRIGHT__` global
- Checks for `window.pw.browser` object
- Checks for `navigator.webdriver` flag
- Displays detection result in popup

### 2. Activate Extension

**Purpose**: Activate the extension for the current page

**How to Use**:
1. First, detect Playwright (see above)
2. Click "Activate Extension" button
3. The extension will activate and set up event listeners
4. Status indicator will show "Active"

**What It Does**:
- Enables element capture
- Enables shimmer effects
- Sets up click tracking
- Prepares for automation

### 3. Capture Elements

**Purpose**: Capture all interactive elements from the page

**How to Use**:
1. Activate the extension (see above)
2. Click "Capture Elements" button
3. The extension will scan the page
4. A message will show how many elements were captured

**What It Captures**:
- Buttons
- Links
- Input fields
- Select dropdowns
- Textareas
- Elements with role="button" or role="link"
- Elements with onclick handlers
- Elements with data-testid attributes

**Data Captured for Each Element**:
- CSS selector
- Bounding rectangle (position and size)
- Tag name
- Text content
- HTML attributes
- ARIA labels
- data-testid values

### 4. Apply Shimmer

**Purpose**: Apply beach color shimmer effect to interactive elements

**How to Use**:
1. Activate the extension (see above)
2. Click "Apply Shimmer" button
3. All interactive elements will get a shimmer effect
4. Status indicator will show "On"

**What It Does**:
- Adds light pink (#FFB6C1) dashed outline to elements
- Animates the outline with a 2-second loop
- Adds box-shadow for depth effect
- Makes interactive elements more visible

**Visual Effect**:
- Light pink outline that pulses
- Smooth animation loop
- Semi-transparent background
- Helps identify interactive elements

### 5. Remove Shimmer

**Purpose**: Remove the shimmer effect from the page

**How to Use**:
1. Click "Remove Shimmer" button
2. All shimmer effects will be removed
3. Status indicator will show "Off"

**What It Does**:
- Removes shimmer class from all elements
- Clears outline styles
- Removes animation styles
- Restores page to normal appearance

### 6. Deactivate Extension

**Purpose**: Deactivate the extension and clean up

**How to Use**:
1. Click "Deactivate" button
2. The extension will clean up all effects
3. Status indicator will show "Inactive"

**What It Does**:
- Removes all shimmer effects
- Removes all highlights
- Stops tracking interactions
- Clears captured elements
- Resets extension state

## Status Indicators

The popup displays three status indicators:

### Extension Status
- **Inactive** (gray): Extension is not active
- **Active** (green): Extension is active and ready

### Playwright Status
- **Not Detected** (gray): Playwright not found on page
- **Detected** (green): Playwright automation is running

### Shimmer Status
- **Off** (gray): Shimmer effect is not applied
- **On** (green): Shimmer effect is active

## Workflow Examples

### Example 1: Basic Element Capture

1. Open a website
2. Click extension icon
3. Click "Detect Playwright"
4. Click "Activate Extension"
5. Click "Capture Elements"
6. View the count of captured elements

### Example 2: Visual Element Identification

1. Open a website
2. Click extension icon
3. Click "Detect Playwright"
4. Click "Activate Extension"
5. Click "Apply Shimmer"
6. All interactive elements now have shimmer effect
7. Click "Remove Shimmer" when done

### Example 3: Full Automation Setup

1. Open a website
2. Click extension icon
3. Click "Detect Playwright"
4. Click "Activate Extension"
5. Click "Apply Shimmer" (optional, for visibility)
6. Click "Capture Elements"
7. Interact with elements (clicks are tracked)
8. Click "Remove Shimmer" (if applied)
9. Click "Deactivate" when done

## Interaction Tracking

When the extension is active, it automatically tracks:

### Click Events
- Records which element was clicked
- Captures element selector
- Records timestamp
- Sends to main application

### Form Submissions
- Records form submission
- Captures form ID and name
- Counts form fields
- Records timestamp

## Visual Feedback

### Element Highlighting
- When an element is selected, it gets a red border
- Highlight auto-removes after 5 seconds
- Shows element is interactive

### Success Feedback
- Green outline appears on successful interaction
- Flash animation plays
- Indicates operation succeeded

### Error Feedback
- Red outline appears on failed interaction
- Shake animation plays
- Indicates operation failed

## Tips and Tricks

### Tip 1: Use Shimmer for Visibility
Apply shimmer effect to easily see all interactive elements on a page. This is especially useful for complex pages with many elements.

### Tip 2: Capture Before Interaction
Capture elements before interacting with them. This ensures you have a complete list of available elements.

### Tip 3: Check Status Indicators
Always check the status indicators before performing actions. The extension must be active to capture elements or apply shimmer.

### Tip 4: Clean Up After Use
Always click "Deactivate" when done. This ensures all effects are removed and the page is restored to normal.

### Tip 5: Use with Playwright
The extension works best when Playwright is running. Detect Playwright first to ensure compatibility.

## Troubleshooting

### Issue: "Playwright not detected"
**Solution**: Make sure Playwright is running on the page. The extension can only activate when Playwright is detected.

### Issue: "Extension not activated"
**Solution**: Click "Activate Extension" first. You must activate the extension before using other features.

### Issue: Shimmer effect not visible
**Solution**: Make sure you clicked "Apply Shimmer". The effect should appear on all interactive elements.

### Issue: Elements not captured
**Solution**: Make sure the extension is activated and the page has loaded completely. Try refreshing the page and trying again.

### Issue: Buttons are disabled
**Solution**: Check the status indicators. Buttons are disabled based on the current state. For example, "Activate Extension" is disabled if already active.

## Advanced Usage

### Accessing Captured Elements
The captured elements are stored in the extension's local storage and can be accessed by the main application through the messaging API.

### Custom Element Selectors
The extension generates CSS selectors automatically. You can use these selectors in your automation scripts.

### Integration with Main App
The extension sends interaction data to the main application through Chrome's messaging API. The main app can listen for these messages and process them.

## Performance Notes

- Element capture is fast (typically <1 second for 100+ elements)
- Shimmer effect has minimal performance impact
- Interaction tracking is lightweight
- Extension uses minimal memory

## Security Notes

- The extension only works on pages where it's explicitly activated
- No sensitive data is stored in browser storage
- All messages are validated before processing
- The extension cleans up all data on deactivation

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the implementation checklist
3. Check browser console for error messages
4. Verify Playwright is running correctly

## Version

Current Version: 1.0.0

## License

MIT License - See LICENSE file for details
