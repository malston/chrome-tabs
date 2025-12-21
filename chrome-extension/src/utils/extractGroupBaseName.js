// ABOUTME: Extracts base name from group titles by removing count suffix.
// ABOUTME: Handles formats like "example.com (25)" → "example.com".

/**
 * Extracts the base name from a group title by removing the tab count suffix.
 * Primarily used for backward compatibility with older group formats that
 * included tab counts in the title. Also enables matching existing groups
 * with new grouping operations regardless of their title format.
 *
 * Examples:
 * - "github.com (15)" → "github.com"  // Legacy format with count
 * - "github.com" → "github.com"        // Current format (unchanged)
 * - "Development (10)" → "Development"
 *
 * @param {string} groupTitle - The group title (with or without count suffix)
 * @returns {string} The base name without the count suffix
 */
function extractGroupBaseName(groupTitle) {
  if (!groupTitle) return '';
  // Remove the " (count)" suffix using regex
  // Matches: space, opening paren, one or more digits, closing paren, end of string
  return groupTitle.replace(/\s*\(\d+\)$/, '');
}

export { extractGroupBaseName };
