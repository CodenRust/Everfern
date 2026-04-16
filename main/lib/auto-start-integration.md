# Auto-Start Integration

This document describes the auto-start integration implemented in the main process (`main/main.ts`).

## Overview

The auto-start integration allows EverFern to automatically start when the system boots and run in the background, minimized to the system tray.

## Implementation

### Command Line Detection

The main process checks for the `--auto-start` command line argument:

```typescript
const isAutoStartMode = process.argv.includes('--auto-start');
```

### Window Behavior

When launched in auto-start mode:

1. The main window is created with `show: false` to prevent it from appearing
2. The system tray is initialized first
3. Instead of showing the window, the app is minimized to tray
4. If system tray is not supported, the window is minimized instead

### IPC Handlers

The following IPC handlers are available for the frontend:

- `autostart:get-status` - Check if auto-start is currently enabled
- `autostart:enable` - Enable auto-start functionality
- `autostart:disable` - Disable auto-start functionality
- `autostart:get-info` - Get platform-specific auto-start information
- `autostart:validate-support` - Validate if auto-start is supported on current platform

### Integration with System Tray

The auto-start functionality is tightly integrated with the system tray manager:

- In auto-start mode, the app hides to tray instead of showing the window
- Users can restore the window by clicking the tray icon
- The tray context menu provides options to show/hide the window and quit the app

## Usage

### For Users

1. Enable auto-start through the application settings
2. The app will register itself with the operating system's startup registry
3. On next system boot, EverFern will start automatically in the background
4. Click the system tray icon to restore the main window

### For Developers

The auto-start functionality is automatically initialized when the main process starts. No additional setup is required.

### Testing

Integration tests are available in `main/lib/__tests__/auto-start-integration.test.ts` to verify:

- Command line argument detection
- IPC handler functionality
- Error handling
- Integration with system tray

## Platform Support

Auto-start is supported on:

- **Windows**: Uses Windows Registry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`)
- **macOS**: Uses LaunchAgent plist files (`~/Library/LaunchAgents/`)
- **Linux**: Uses XDG autostart desktop files (`~/.config/autostart/`)

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 2.1**: Auto-start launches EverFern in background mode
- **Requirement 2.9**: Settings toggle to enable/disable auto-start functionality
- **Requirement 2.2**: EverFern minimizes to system tray in auto-start mode
- **Requirement 2.3**: Tray icon allows window restoration
- **Requirement 2.4**: Context menu provides show/hide functionality

## Error Handling

The implementation includes comprehensive error handling:

- IPC handlers return success/error status
- Platform validation checks for required dependencies
- Graceful fallback when system tray is not supported
- Detailed error logging for debugging

## Security Considerations

- Auto-start registration requires appropriate system permissions
- The implementation follows platform-specific security guidelines
- No sensitive data is stored in startup registry entries
