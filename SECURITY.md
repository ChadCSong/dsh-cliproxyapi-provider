# Security Policy

Please report vulnerabilities through GitHub's private vulnerability reporting for this repository. Do not open
a public issue for an unpatched vulnerability. If private reporting is unavailable, open a non-sensitive issue
asking the maintainer to establish a private contact channel without including vulnerability details.

The plugin treats the CPA API key as a DSH credential reference. A valid report includes any path that logs,
persists, renders, or transmits that secret somewhere other than the configured CPA endpoint.
