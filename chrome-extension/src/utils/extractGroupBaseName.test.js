/**
 * Unit Tests for extractGroupBaseName function
 *
 * Tests the group base name extraction logic including:
 * - Standard group names with counts
 * - Edge cases (empty, null, undefined)
 * - Different count formats
 * - Names with parentheses
 * - Special characters
 */

// Import the extractGroupBaseName function
const { extractGroupBaseName } = require('./extractGroupBaseName.js');

// Test suite
describe('extractGroupBaseName', () => {

  describe('Standard Group Names', () => {
    test('should extract base name from domain with count', () => {
      expect(extractGroupBaseName('github.com (15)')).toBe('github.com');
    });

    test('should extract base name from domain with single digit count', () => {
      expect(extractGroupBaseName('github.com (5)')).toBe('github.com');
    });

    test('should extract base name from domain with large count', () => {
      expect(extractGroupBaseName('github.com (100)')).toBe('github.com');
    });

    test('should extract base name from subdomain with count', () => {
      expect(extractGroupBaseName('markalston.net (10)')).toBe('markalston.net');
    });

    test('should extract base name from custom group name', () => {
      expect(extractGroupBaseName('Development (10)')).toBe('Development');
    });

    test('should extract base name from multi-word group name', () => {
      expect(extractGroupBaseName('Work Projects (25)')).toBe('Work Projects');
    });

    test('should extract base name from name with special characters', () => {
      expect(extractGroupBaseName('api.example.com (7)')).toBe('api.example.com');
    });

    test('should extract base name from name with hyphens', () => {
      expect(extractGroupBaseName('my-project.com (12)')).toBe('my-project.com');
    });

    test('should extract base name from name with underscores', () => {
      expect(extractGroupBaseName('my_project (8)')).toBe('my_project');
    });
  });

  describe('Edge Cases - No Count Suffix', () => {
    test('should return original name if no count suffix', () => {
      expect(extractGroupBaseName('github.com')).toBe('github.com');
    });

    test('should return original name if no parentheses', () => {
      expect(extractGroupBaseName('Development')).toBe('Development');
    });

    test('should return original name if parentheses without count', () => {
      expect(extractGroupBaseName('github.com (abc)')).toBe('github.com (abc)');
    });

    test('should return original name if empty parentheses', () => {
      expect(extractGroupBaseName('github.com ()')).toBe('github.com ()');
    });

    test('should return original name if count not at end', () => {
      expect(extractGroupBaseName('(5) github.com')).toBe('(5) github.com');
    });

    test('should return original name if count in middle', () => {
      expect(extractGroupBaseName('github (5) com')).toBe('github (5) com');
    });
  });

  describe('Edge Cases - Empty and Invalid Input', () => {
    test('should return empty string for empty input', () => {
      expect(extractGroupBaseName('')).toBe('');
    });

    test('should return empty string for null', () => {
      expect(extractGroupBaseName(null)).toBe('');
    });

    test('should return empty string for undefined', () => {
      expect(extractGroupBaseName(undefined)).toBe('');
    });
  });

  describe('Edge Cases - Multiple Parentheses', () => {
    test('should only remove last count suffix', () => {
      expect(extractGroupBaseName('github.com (old) (15)')).toBe('github.com (old)');
    });

    test('should handle nested parentheses', () => {
      expect(extractGroupBaseName('Project (v1.0) (10)')).toBe('Project (v1.0)');
    });

    test('should preserve non-count parentheses', () => {
      expect(extractGroupBaseName('My App (beta)')).toBe('My App (beta)');
    });

    test('should handle parentheses with spaces', () => {
      expect(extractGroupBaseName('My Project ( 10 )')).toBe('My Project ( 10 )');
    });
  });

  describe('Edge Cases - Whitespace', () => {
    test('should handle leading spaces in count', () => {
      expect(extractGroupBaseName('github.com ( 15)')).toBe('github.com ( 15)');
    });

    test('should handle trailing spaces in count', () => {
      expect(extractGroupBaseName('github.com (15 )')).toBe('github.com (15 )');
    });

    test('should handle no space before parentheses', () => {
      expect(extractGroupBaseName('github.com(15)')).toBe('github.com');
    });

    test('should handle multiple spaces before parentheses', () => {
      expect(extractGroupBaseName('github.com  (15)')).toBe('github.com');
    });

    test('should handle tabs before parentheses', () => {
      expect(extractGroupBaseName('github.com\t(15)')).toBe('github.com');
    });

    test('should handle name with only whitespace and count', () => {
      expect(extractGroupBaseName('   (5)')).toBe('');
    });
  });

  describe('Edge Cases - Special Count Formats', () => {
    test('should handle count with leading zeros', () => {
      expect(extractGroupBaseName('github.com (05)')).toBe('github.com');
    });

    test('should handle very large count', () => {
      expect(extractGroupBaseName('github.com (99999)')).toBe('github.com');
    });

    test('should not remove decimal numbers', () => {
      expect(extractGroupBaseName('github.com (3.14)')).toBe('github.com (3.14)');
    });

    test('should not remove negative numbers', () => {
      expect(extractGroupBaseName('github.com (-5)')).toBe('github.com (-5)');
    });

    test('should not remove numbers with letters', () => {
      expect(extractGroupBaseName('github.com (5a)')).toBe('github.com (5a)');
    });
  });

  describe('Real-World Examples', () => {
    test('should handle typical domain groups', () => {
      const examples = [
        ['github.com (25)', 'github.com'],
        ['google.com (10)', 'google.com'],
        ['stackoverflow.com (5)', 'stackoverflow.com'],
        ['example.co.uk (3)', 'example.co.uk'],
        ['localhost (8)', 'localhost']
      ];

      examples.forEach(([input, expected]) => {
        expect(extractGroupBaseName(input)).toBe(expected);
      });
    });

    test('should handle custom group names', () => {
      const examples = [
        ['Work Tabs (15)', 'Work Tabs'],
        ['Personal (8)', 'Personal'],
        ['Research (20)', 'Research'],
        ['Shopping (3)', 'Shopping'],
        ['Documentation (12)', 'Documentation']
      ];

      examples.forEach(([input, expected]) => {
        expect(extractGroupBaseName(input)).toBe(expected);
      });
    });

    test('should handle markalston.net subdomains', () => {
      const examples = [
        ['markalston.net (5)', 'markalston.net'],
        ['markalston.net (10)', 'markalston.net'],
        ['markalston.net (1)', 'markalston.net']
      ];

      examples.forEach(([input, expected]) => {
        expect(extractGroupBaseName(input)).toBe(expected);
      });
    });

    test('should handle IP-based groups', () => {
      expect(extractGroupBaseName('local-network (6)')).toBe('local-network');
      expect(extractGroupBaseName('ip-addresses (3)')).toBe('ip-addresses');
    });
  });

  describe('Consistency and Idempotency', () => {
    test('should return same result for same input', () => {
      const input = 'github.com (15)';
      expect(extractGroupBaseName(input)).toBe(extractGroupBaseName(input));
    });

    test('should be idempotent - applying twice has same effect', () => {
      const input = 'github.com (15)';
      const once = extractGroupBaseName(input);
      const twice = extractGroupBaseName(once);
      expect(once).toBe(twice);
    });

    test('should handle repeated calls with different counts', () => {
      expect(extractGroupBaseName('github.com (15)')).toBe('github.com');
      expect(extractGroupBaseName('github.com (20)')).toBe('github.com');
      expect(extractGroupBaseName('github.com (5)')).toBe('github.com');
    });
  });

  describe('Unicode and International Characters', () => {
    test('should handle unicode characters in group name', () => {
      expect(extractGroupBaseName('日本語 (5)')).toBe('日本語');
    });

    test('should handle emoji in group name', () => {
      expect(extractGroupBaseName('Work 🔥 (10)')).toBe('Work 🔥');
    });

    test('should handle accented characters', () => {
      expect(extractGroupBaseName('Français (8)')).toBe('Français');
    });

    test('should handle cyrillic characters', () => {
      expect(extractGroupBaseName('Русский (3)')).toBe('Русский');
    });
  });
});
