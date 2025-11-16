/**
 * Unit Tests for extractDomain function
 *
 * Tests the domain extraction logic including:
 * - Standard domains
 * - www prefix removal
 * - Localhost handling
 * - IP address handling (private and public)
 * - Edge cases and error scenarios
 */

// Mock Chrome APIs (not needed for extractDomain, but included for consistency)
global.chrome = {
  tabs: {
    query: jest.fn(),
    remove: jest.fn()
  }
};

// The extractDomain function (duplicated from background.js for testing)
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }

    // Handle localhost
    if (domain.startsWith('localhost')) {
      return 'localhost';
    }

    // Handle IP addresses - group private IPs together
    if (/^[\d.:]+$/.test(domain)) {
      if (domain.startsWith('192.168.') || domain.startsWith('172.') || domain.startsWith('10.')) {
        return 'local-network';
      }
      return 'ip-addresses';
    }

    return domain;
  } catch (e) {
    return 'unknown';
  }
}

// Test suite
describe('extractDomain', () => {
  beforeEach(() => {
    // Reset mocks before each test (for consistency with other test files)
    jest.clearAllMocks();
  });

  describe('Standard Domains', () => {
    test('should extract domain from simple URL', () => {
      expect(extractDomain('https://github.com')).toBe('github.com');
    });

    test('should extract domain from URL with path', () => {
      expect(extractDomain('https://github.com/user/repo')).toBe('github.com');
    });

    test('should extract domain from URL with query params', () => {
      expect(extractDomain('https://github.com/search?q=test')).toBe('github.com');
    });

    test('should extract domain from URL with hash', () => {
      expect(extractDomain('https://github.com/user/repo#readme')).toBe('github.com');
    });

    test('should extract domain from URL with port', () => {
      expect(extractDomain('https://example.com:8080/path')).toBe('example.com');
    });

    test('should extract subdomain', () => {
      expect(extractDomain('https://api.github.com')).toBe('api.github.com');
    });

    test('should extract multi-level subdomain', () => {
      expect(extractDomain('https://foo.bar.example.com')).toBe('foo.bar.example.com');
    });

    test('should handle http protocol', () => {
      expect(extractDomain('http://example.com')).toBe('example.com');
    });
  });

  // www prefix removal tests
  describe('WWW Prefix Removal', () => {
    test('should remove www prefix', () => {
      expect(extractDomain('https://www.github.com')).toBe('github.com');
    });

    test('should remove www from domain with path', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
    });

    test('should handle www subdomain with additional subdomains', () => {
      expect(extractDomain('https://www.api.example.com')).toBe('api.example.com');
    });

    test('should not remove www if not at start', () => {
      expect(extractDomain('https://api.www.example.com')).toBe('api.www.example.com');
    });

    test('should handle WWW in different case', () => {
      // Note: hostname is already lowercased by URL API
      expect(extractDomain('https://WWW.github.com')).toBe('github.com');
    });
  });

  // Localhost tests
  describe('Localhost Handling', () => {
    test('should return "localhost" for localhost URL', () => {
      expect(extractDomain('http://localhost')).toBe('localhost');
    });

    test('should return "localhost" for localhost with port', () => {
      expect(extractDomain('http://localhost:3000')).toBe('localhost');
    });

    test('should return "localhost" for localhost with path', () => {
      expect(extractDomain('http://localhost:8080/api/users')).toBe('localhost');
    });

    test('should return "localhost" for localhost with query params', () => {
      expect(extractDomain('http://localhost:3000?debug=true')).toBe('localhost');
    });
  });

  // IP address tests
  describe('IP Address Handling', () => {

    // Private IP addresses
    describe('Private IP Addresses', () => {
      test('should return "local-network" for 192.168.x.x', () => {
        expect(extractDomain('http://192.168.1.1')).toBe('local-network');
      });

      test('should return "local-network" for 192.168.x.x with port', () => {
        expect(extractDomain('http://192.168.1.100:8080')).toBe('local-network');
      });

      test('should return "local-network" for 10.x.x.x', () => {
        expect(extractDomain('http://10.0.0.1')).toBe('local-network');
      });

      test('should return "local-network" for 10.x.x.x with path', () => {
        expect(extractDomain('http://10.1.2.3/admin')).toBe('local-network');
      });

      test('should return "local-network" for 172.x.x.x', () => {
        expect(extractDomain('http://172.16.0.1')).toBe('local-network');
      });

      test('should return "local-network" for 172.x.x.x with port and path', () => {
        expect(extractDomain('http://172.20.10.5:3000/api')).toBe('local-network');
      });
    });

    // Public IP addresses
    describe('Public IP Addresses', () => {
      test('should return "ip-addresses" for public IPv4', () => {
        expect(extractDomain('http://8.8.8.8')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for public IPv4 with port', () => {
        expect(extractDomain('http://8.8.8.8:80')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for another public IPv4', () => {
        expect(extractDomain('http://1.1.1.1')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for public IPv4 with path', () => {
        expect(extractDomain('http://93.184.216.34/test')).toBe('ip-addresses');
      });
    });
  });

  // Edge cases and error scenarios
  describe('Edge Cases and Error Scenarios', () => {

    test('should return "unknown" for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('unknown');
    });

    test('should return "unknown" for malformed URL', () => {
      expect(extractDomain('http://')).toBe('unknown');
    });

    test('should return "unknown" for empty string', () => {
      expect(extractDomain('')).toBe('unknown');
    });

    test('should return "unknown" for null', () => {
      expect(extractDomain(null)).toBe('unknown');
    });

    test('should return "unknown" for undefined', () => {
      expect(extractDomain(undefined)).toBe('unknown');
    });

    test('should handle chrome:// URLs', () => {
      expect(extractDomain('chrome://extensions')).toBe('extensions');
    });

    test('should handle chrome-extension:// URLs', () => {
      const result = extractDomain('chrome-extension://abcdefghijklmnop/popup.html');
      expect(result).toBe('abcdefghijklmnop');
    });

    test('should handle file:// URLs', () => {
      expect(extractDomain('file:///Users/user/file.html')).toBe('');
    });

    test('should handle about:blank', () => {
      expect(extractDomain('about:blank')).toBe('');
    });

    test('should handle data URLs', () => {
      expect(extractDomain('data:text/html,<h1>Test</h1>')).toBe('');
    });

    test('should handle blob URLs', () => {
      expect(extractDomain('blob:https://example.com/uuid')).toBe('');
    });

    test('should handle FTP URLs', () => {
      expect(extractDomain('ftp://ftp.example.com')).toBe('ftp.example.com');
    });

    test('should handle very long domain names', () => {
      const longDomain = 'a'.repeat(63) + '.com';
      expect(extractDomain(`https://${longDomain}`)).toBe(longDomain);
    });

    test('should handle URLs with special characters in path', () => {
      expect(extractDomain('https://example.com/path?query=hello%20world')).toBe('example.com');
    });

    test('should handle URLs with authentication', () => {
      expect(extractDomain('https://user:pass@example.com')).toBe('example.com');
    });

    test('should handle URLs with www and authentication', () => {
      expect(extractDomain('https://user:pass@www.example.com')).toBe('example.com');
    });

    test('should handle international domain names (punycode)', () => {
      expect(extractDomain('https://xn--e1afmkfd.xn--p1ai')).toBe('xn--e1afmkfd.xn--p1ai');
    });
  });

  // Consistency tests
  describe('Consistency and Idempotency', () => {
    test('should return same result for same input', () => {
      const url = 'https://www.github.com/user/repo';
      expect(extractDomain(url)).toBe(extractDomain(url));
    });

    test('should handle URLs with different protocols consistently', () => {
      expect(extractDomain('http://example.com')).toBe(extractDomain('https://example.com'));
    });

    test('should handle case insensitivity in domain', () => {
      expect(extractDomain('https://Example.Com')).toBe('example.com');
    });
  });
});
