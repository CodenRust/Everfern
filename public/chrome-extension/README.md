# EverFern Web Automation Chrome Extension

A Chrome extension that provides enhanced web automation capabilities for Playwright-based browser automation. The extension activates when Playwright is detected and provides secure communication with the main application.

## Features

- **Playwright Detection**: Automatically detects when Playwright automation is running
- **Extension Activation**: Activates only when Playwright is detected and authorized
- **Element Capture**: Captures interactive elements from the page for automation targeting
- **Visual Effects**: Applies beach color shimmer effects to interactive elements for enhanced visibility
- **Element Highlighting**: Highlights specific elements for visual feedback
- **Secure Messaging**: Implements secure message passing between extension and main application
- **Event Tracking**: Tracks user interactions (clicks, form submissions) for automation logging

## Architecture

### File Structure

```
public/chrome-extension/
├── manifest.json          # Extension manifest with permissions and configuration
├── background.js          # Background service worker for extension lifecycle management
├── content.js             # Content script for page interaction and Playwright detection
├── popup.html             # Popup UI for extension controls
├── popup.js               # Popup script for UI interactions
├── automation.css         # Styles for visual effects and UI components
└── README.md              # This file
```

### Components

#### manifest.json
- Defines extension metadata, permissions, and configuration
- Specifies background service worker and content scripts
- Declares host permissions for all URLs
- Configures popup UI

#### background.js (Service Worker)
- Manages extension lifecycle (install, update, tab changes)
- Handles message routing between content scripts and main application
- Implements Playwright detection logic
- Manages extension state (activation, session management)
- Provides secure messaging protocols
- Handles element capture, highlighting, and shimmer effects

#### content.js (Content Script)
- Runs in page context to interact with DOM
- Detects Playwright automation in the page
- Captures interactive elements with selectors and metadata
- Applies and removes visual effects (shimmer, highlighting)
- Tracks user interactions (clicks, form submissions)
- Communicates with background script via message passing

#### popup.html & popup.js
- Provides user interface for extension controls
- Displays extension status (active/inactive)
- Shows Playwright detection status
- Provides buttons for:
  - Detecting Playwright
  - Activating/deactivating extension
  - Capturing elements
  - Applying/removing shimmer effects
- Shows info and error messages

#### automation.css
- Defines styles for visual effects
- Beach color shimmer animation
- Element highlighting styles
- Loading and status indicators
- Accessibility improvements (dark mode, reduced motion)

## Message Protocol

### Message Types

#### From Content Script to Background

```javascript
{
  type: 'detect-playwright',
  // Response: { success: boolean, detected: boolean }
}

{
  type: 'capture-elements-request',
  // Response: { success: boolean, elements: ElementData[], count: number }
}

{
  type: 'highlight-element-request',
  payload: { selector: string },
  // Response: { success: boolean, selector: string }
}

{
  type: 'apply-shimmer-request',
  // Response: { success: boolean, shimmerActive: boolean }
}

{
  type: 'remove-shimmer-request',
  // Response: { success: boolean, shimmerActive: boolean }
}

{
  type: 'send-to-main-app',
  payload: {
    message: {
      type: string,
      // ... message-specific data
    }
  }
}
```

#### From Popup to Background

```javascript
{
  type: 'activate-extension',
  playwrightDetected: boolean,
  // Response: { success: boolean, activated: boolean, sessionId: string }
}

{
  type: 'deactivate-extension',
  // Response: { success: boolean, activated: boolean }
}

{
  type: 'capture-elements',
  // Response: { success: boolean, elements: ElementData[], count: number }
}

{
  type: 'apply-shimmer',
  // Response: { success: boolean, shimmerActive: boolean }
}

{
  type: 'remove-shimmer',
  // Response: { success: boolean, shimmerActive: boolean }
}

{
  type: 'get-extension-state',
  // Response: { success: boolean, state: ExtensionState }
}
```

## Data Models

### ElementData
```typescript
interface ElementData {
  selector: string;              // CSS selector for the element
  boundingRect: DOMRect;         // Element position and size
  tagName: string;               // HTML tag name
  textContent: string;           // Element text (truncated to 100 chars)
  attributes: Record<string, string>; // Element attributes
  isInteractive: boolean;        // Whether element is interactive
  ariaLabel?: string;            // ARIA label if present
  dataTestId?: string;           // data-testid attribute if present
}
```

### PlaywrightSession
```typescript
interface PlaywrightSession {
  id: string;                    // Unique session ID
  active: boolean;               // Whether session is active
  url: string;                   // Current page URL
  title: string;                 // Page title
  startTime: string;             // ISO timestamp of session start
  automationLevel: string;       // Automation level (basic, enhanced, visual)
}
```

### ExtensionState
```typescript
interface ExtensionState {
  activated: boolean;            // Whether extension is activated
  playwrightSession?: PlaywrightSession; // Current Playwright session
  capturedElements: ElementData[]; // Recently captured elements
  shimmerActive: boolean;        // Whether shimmer effect is active
  communicationChannel: string;  // Communication method (websocket, postmessage, storage)
}
```

## Playwright Detection

The extension detects Playwright through multiple methods:

1. **Global Object Detection**: Checks for `window.__PLAYWRIGHT__`
2. **Browser API Detection**: Checks for `window.pw.browser`
3. **WebDriver Flag**: Checks for `navigator.webdriver === true`
4. **Script Analysis**: Scans page scripts for Playwright references

## Security Considerations

- **Message Validation**: All messages are validated for required fields
- **Permission Scoping**: Extension only activates when Playwright is detected
- **No Sensitive Data Storage**: Extension doesn't store sensitive data in browser storage
- **Secure Messaging**: Uses Chrome's native message passing API
- **Cleanup on Deactivation**: Removes all visual effects and clears temporary data when deactivated

## Visual Effects

### Beach Color Shimmer
- Applied to interactive elements (buttons, links, inputs, etc.)
- Uses light pink color (#FFB6C1) with animated opacity
- Creates visual indication of interactive elements
- Can be toggled on/off via popup UI

### Element Highlighting
- Highlights specific elements with red border and shadow
- Auto-removes after 5 seconds
- Used for visual feedback during automation

## Performance Considerations

- **Efficient Element Capture**: Uses CSS selectors to find interactive elements
- **Visibility Checking**: Skips hidden elements to reduce overhead
- **Deduplication**: Prevents capturing duplicate elements
- **Lazy Loading**: Only applies effects when explicitly requested
- **Memory Management**: Cleans up resources on deactivation

## Browser Compatibility

- Chrome 88+
- Edge 88+
- Brave 1.20+
- Other Chromium-based browsers

## Installation

1. Place the extension directory in your project
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension will appear in your extensions list

## Usage

1. Navigate to a page with Playwright automation
2. Click the extension icon in the toolbar
3. Click "Detect Playwright" to verify automation is running
4. Click "Activate Extension" to enable automation features
5. Use the available controls:
   - **Capture Elements**: Get list of interactive elements
   - **Apply Shimmer**: Highlight interactive elements with visual effect
   - **Remove Shimmer**: Remove visual effects

## Development

### Adding New Message Types

1. Add handler in `background.js` `handleMessage()` function
2. Add corresponding content script handler in `content.js`
3. Update message protocol documentation
4. Add UI button in `popup.html` if user-facing

### Modifying Visual Effects

1. Edit `automation.css` for style changes
2. Update `SHIMMER_CONFIG` in `content.js` for effect parameters
3. Test with various page layouts and color schemes

### Testing

1. Load extension in Chrome developer mode
2. Open DevTools (F12) to view console logs
3. Check background service worker logs in `chrome://extensions/`
4. Use popup UI to test all features

## Troubleshooting

### Extension Not Detecting Playwright
- Verify Playwright is actually running on the page
- Check browser console for errors
- Ensure page has fully loaded before detection

### Shimmer Effect Not Visible
- Check if elements are actually interactive
- Verify CSS is being applied (inspect element)
- Check for CSS conflicts with page styles

### Messages Not Being Received
- Verify content script is injected (check page source)
- Check for Content Security Policy (CSP) violations
- Ensure background service worker is active

## Future Enhancements

- [ ] Screenshot capture functionality
- [ ] Element selection via click-to-select
- [ ] Integration with main application via WebSocket
- [ ] Advanced element filtering and search
- [ ] Automation recording and playback
- [ ] Custom visual effect themes
- [ ] Performance metrics and logging
