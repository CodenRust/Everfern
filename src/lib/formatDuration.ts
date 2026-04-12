/**
 * Formats a duration in milliseconds to a human-readable string.
 * 
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string
 * 
 * @example
 * formatDuration(5000) // "5.0s"
 * formatDuration(90000) // "1m 30s"
 * formatDuration(3660000) // "1h 1m"
 * formatDuration(undefined) // "Thought for a moment"
 * formatDuration(-100) // "Thought for a moment"
 */
export function formatDuration(milliseconds: number | undefined): string {
  // Handle invalid values (including zero per Requirement 2.5)
  if (
    milliseconds === undefined ||
    milliseconds === null ||
    isNaN(milliseconds) ||
    milliseconds <= 0
  ) {
    return "Thought for a moment";
  }

  const seconds = milliseconds / 1000;

  // Less than 60 seconds: format as "{seconds}s" with 1 decimal
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  // Between 60 seconds and 1 hour: format as "{minutes}m {seconds}s"
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  // 1 hour or more: format as "{hours}h {minutes}m"
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}
