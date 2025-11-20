// ABOUTME: Extracts base name from group titles by removing count suffix.
// ABOUTME: Handles formats like "example.com (25)" → "example.com".

/**
 * Extracts the base name from a group title by removing the tab count suffix.
 * This allows matching existing groups with new grouping operations.
 *
 * Examples:
 * - "github.com (15)" → "github.com"
 * - "markalston.net (5)" → "markalston.net"
 * - "Development (10)" → "Development"
 *
 * @param {string} groupTitle - The full group title with count
 * @returns {string} The base name without the count suffix
 */
function extractGroupBaseName(groupTitle) {
  if (!groupTitle) return '';
  // Remove the " (count)" suffix using regex
  // Matches: space, opening paren, one or more digits, closing paren, end of string
  return groupTitle.replace(/\s*\(\d+\)$/, '');
}

export { extractGroupBaseName };
