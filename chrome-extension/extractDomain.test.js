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

// Mock Chrome APIs (required for background.js to load)
global.chrome = {
  tabs: {
    query: jest.fn(),
    remove: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    create: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  tabGroups: {
    query: jest.fn(),
    update: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  bookmarks: {
    get: jest.fn(),
    getChildren: jest.fn(),
    create: jest.fn()
  },
  windows: {
    WINDOW_ID_CURRENT: 1
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Import the extractDomain function from background.js
const { extractDomain } = require('./background.js');

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

    test('should extract base domain from subdomain', () => {
      expect(extractDomain('https://api.github.com')).toBe('github.com');
    });

    test('should extract base domain from multi-level subdomain', () => {
      expect(extractDomain('https://foo.bar.example.com')).toBe('example.com');
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
      expect(extractDomain('https://www.api.example.com')).toBe('example.com');
    });

    test('should extract base domain even with www in middle', () => {
      expect(extractDomain('https://api.www.example.com')).toBe('example.com');
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
    describe('Private IP Addresses (RFC 1918)', () => {
      // 192.168.0.0/16 - All 192.168.x.x addresses are private
      test('should return "local-network" for 192.168.x.x', () => {
        expect(extractDomain('http://192.168.1.1')).toBe('local-network');
      });

      test('should return "local-network" for 192.168.x.x with port', () => {
        expect(extractDomain('http://192.168.1.100:8080')).toBe('local-network');
      });

      test('should return "local-network" for 192.168.0.0 (start of range)', () => {
        expect(extractDomain('http://192.168.0.0')).toBe('local-network');
      });

      test('should return "local-network" for 192.168.255.255 (end of range)', () => {
        expect(extractDomain('http://192.168.255.255')).toBe('local-network');
      });

      // 10.0.0.0/8 - All 10.x.x.x addresses are private
      test('should return "local-network" for 10.x.x.x', () => {
        expect(extractDomain('http://10.0.0.1')).toBe('local-network');
      });

      test('should return "local-network" for 10.x.x.x with path', () => {
        expect(extractDomain('http://10.1.2.3/admin')).toBe('local-network');
      });

      test('should return "local-network" for 10.0.0.0 (start of range)', () => {
        expect(extractDomain('http://10.0.0.0')).toBe('local-network');
      });

      test('should return "local-network" for 10.255.255.255 (end of range)', () => {
        expect(extractDomain('http://10.255.255.255')).toBe('local-network');
      });

      // 172.16.0.0/12 - Only 172.16.x.x through 172.31.x.x are private
      test('should return "local-network" for 172.16.x.x (start of private range)', () => {
        expect(extractDomain('http://172.16.0.1')).toBe('local-network');
      });

      test('should return "local-network" for 172.20.x.x (middle of private range)', () => {
        expect(extractDomain('http://172.20.10.5:3000/api')).toBe('local-network');
      });

      test('should return "local-network" for 172.31.x.x (end of private range)', () => {
        expect(extractDomain('http://172.31.255.255')).toBe('local-network');
      });

      test('should return "local-network" for 172.16.0.0 (start of range)', () => {
        expect(extractDomain('http://172.16.0.0')).toBe('local-network');
      });

      // Public 172.x.x.x addresses (NOT in 172.16-31 range)
      test('should return "ip-addresses" for 172.15.x.x (public - before private range)', () => {
        expect(extractDomain('http://172.15.0.1')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for 172.32.x.x (public - after private range)', () => {
        expect(extractDomain('http://172.32.0.1')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for 172.0.x.x (public)', () => {
        expect(extractDomain('http://172.0.0.1')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for 172.100.x.x (public)', () => {
        expect(extractDomain('http://172.100.1.1')).toBe('ip-addresses');
      });

      test('should return "ip-addresses" for 172.255.x.x (public)', () => {
        expect(extractDomain('http://172.255.255.255')).toBe('ip-addresses');
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
      expect(extractDomain('ftp://ftp.example.com')).toBe('example.com');
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

  describe('Base Domain Extraction (Subdomain Grouping)', () => {
    test('should group subdomains under base domain', () => {
      expect(extractDomain('https://vcsa.markalston.net')).toBe('markalston.net');
      expect(extractDomain('https://opsman.lab.markalston.net')).toBe('markalston.net');
      expect(extractDomain('https://minio.lab.markalston.net')).toBe('markalston.net');
      expect(extractDomain('https://concourse.lab.markalston.net')).toBe('markalston.net');
    });

    test('should handle single subdomain', () => {
      expect(extractDomain('https://api.github.com')).toBe('github.com');
      expect(extractDomain('https://mail.google.com')).toBe('google.com');
      expect(extractDomain('https://docs.microsoft.com')).toBe('microsoft.com');
    });

    test('should handle multiple nested subdomains', () => {
      expect(extractDomain('https://a.b.c.example.com')).toBe('example.com');
      expect(extractDomain('https://deep.nested.subdomain.test.com')).toBe('test.com');
    });

    test('should handle multi-part TLDs (co.uk)', () => {
      expect(extractDomain('https://api.example.co.uk')).toBe('example.co.uk');
      expect(extractDomain('https://www.bbc.co.uk')).toBe('bbc.co.uk');
      expect(extractDomain('https://shop.amazon.co.uk')).toBe('amazon.co.uk');
    });

    test('should handle multi-part TLDs (com.au)', () => {
      expect(extractDomain('https://api.example.com.au')).toBe('example.com.au');
      expect(extractDomain('https://www.news.com.au')).toBe('news.com.au');
    });

    test('should handle other country-code TLDs', () => {
      expect(extractDomain('https://api.example.co.jp')).toBe('example.co.jp');
      expect(extractDomain('https://test.example.co.kr')).toBe('example.co.kr');
      expect(extractDomain('https://blog.example.co.nz')).toBe('example.co.nz');
    });

    test('should handle platform-specific domains (github.io)', () => {
      expect(extractDomain('https://username.github.io')).toBe('username.github.io');
      expect(extractDomain('https://project.gitlab.io')).toBe('project.gitlab.io');
      expect(extractDomain('https://app.netlify.app')).toBe('app.netlify.app');
      expect(extractDomain('https://mysite.vercel.app')).toBe('mysite.vercel.app');
    });

    test('should handle cloud platform domains', () => {
      expect(extractDomain('https://app.herokuapp.com')).toBe('app.herokuapp.com');
      expect(extractDomain('https://site.azurewebsites.net')).toBe('site.azurewebsites.net');
      expect(extractDomain('https://dist.cloudfront.net')).toBe('dist.cloudfront.net');
    });

    test('should preserve base domain for 2-part domains', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
      expect(extractDomain('https://github.com')).toBe('github.com');
      expect(extractDomain('https://google.net')).toBe('google.net');
    });

    test('should handle single-part domains', () => {
      expect(extractDomain('https://localhost')).toBe('localhost');
    });

    test('should group all markalston.net subdomains together', () => {
      const urls = [
        'https://vcsa.markalston.net/ui',
        'https://opsman.lab.markalston.net/login',
        'https://minio.lab.markalston.net:9001',
        'https://concourse.lab.markalston.net/',
        'https://esxi-nuc-01.lab.markalston.net/ui',
      ];

      const domains = urls.map(url => extractDomain(url));

      // All should resolve to 'markalston.net'
      expect(domains.every(domain => domain === 'markalston.net')).toBe(true);
    });

    test('should maintain distinct groups for different base domains', () => {
      expect(extractDomain('https://api.acme.com')).toBe('acme.com');
      expect(extractDomain('https://api.example.com')).toBe('example.com');
      expect(extractDomain('https://api.test.org')).toBe('test.org');

      // They should all be different
      expect(extractDomain('https://api.acme.com')).not.toBe(extractDomain('https://api.example.com'));
    });
  });
});
