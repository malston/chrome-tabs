// ABOUTME: Extracts and normalizes domain names from URLs for tab grouping.
// ABOUTME: Handles special cases like localhost, private IPs, and multi-part TLDs.

/**
 * Checks if an IPv4 address is in a private range according to RFC 1918.
 * Private ranges:
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 *
 * @param {string} ip - The IP address to check
 * @returns {boolean} True if the IP is in a private range
 */
function isPrivateIPv4(ip) {
  // 192.168.0.0/16 - All 192.168.x.x addresses
  if (ip.startsWith('192.168.')) {
    return true;
  }

  // 10.0.0.0/8 - All 10.x.x.x addresses
  if (ip.startsWith('10.')) {
    return true;
  }

  // 172.16.0.0/12 - Only 172.16.x.x through 172.31.x.x
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    }
  }

  return false;
}

/**
 * Extracts the base domain (eTLD+1) from a hostname.
 * Handles common multi-part TLDs like .co.uk, .com.au, etc.
 *
 * @param {string} hostname - The hostname to process
 * @returns {string} The base domain
 */
function extractBaseDomain(hostname) {
  const parts = hostname.split('.');

  // If only one or two parts, return as-is (e.g., "localhost", "example.com")
  if (parts.length <= 2) {
    return hostname;
  }

  // Known multi-part TLDs (country-code TLDs and special cases)
  const multiPartTLDs = [
    'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za',
    'com.au', 'com.br', 'com.cn', 'com.mx', 'com.ar',
    'net.au', 'org.au', 'edu.au',
    'ac.uk', 'gov.uk', 'org.uk',
    'ne.jp', 'or.jp', 'go.jp',
    'github.io', 'gitlab.io', 'netlify.app', 'vercel.app',
    'herokuapp.com', 'azurewebsites.net', 'cloudfront.net'
  ];

  // Check if domain ends with a known multi-part TLD
  for (const tld of multiPartTLDs) {
    if (hostname.endsWith('.' + tld)) {
      // For multi-part TLDs, keep 3 parts: subdomain.domain.tld1.tld2
      // Example: api.example.co.uk → example.co.uk
      return parts.slice(-3).join('.');
    }
  }

  // Default: keep last 2 parts for standard TLDs
  // Example: app.acme.com → acme.com
  return parts.slice(-2).join('.');
}

/**
 * Extracts the base domain from a URL, grouping subdomains together.
 *
 * Examples:
 * - app.acme.com → acme.com
 * - api.github.com → github.com
 * - www.example.co.uk → example.co.uk
 *
 * @param {string} url - The URL to extract the domain from
 * @returns {string} The base domain or special identifier
 */
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
      // Check for RFC 1918 private IP ranges
      if (isPrivateIPv4(domain)) {
        return 'local-network';
      }
      return 'ip-addresses';
    }

    // Extract base domain (eTLD+1) to group subdomains together
    // This groups app.acme.com, api.dev.acme.com → acme.com
    return extractBaseDomain(domain);
  } catch (e) {
    return 'unknown';
  }
}

export { extractDomain };
