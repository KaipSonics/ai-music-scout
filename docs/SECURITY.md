# Security audit

The upstream bridge bundled an encoded AI provider key. This change removes it and removes the fabricated AI success fallbacks. Treat the historical key as exposed: revoke/rotate it with its provider, inspect usage/billing and remove it from deployments; deleting the current file does not erase Git history. Never include the old value in a report or PR.

VK access token is masked in Settings and held only in memory until reload. There is no static PIN authentication and no claim that public JavaScript is private. Old unencrypted VK settings are removed on startup; revoke any previously exposed token and protect historical backups.

Direct browser VK transport uses the legacy HTTPS GET protocol, which places the VK token in the request URL. Such URLs may be exposed in network logs or browser developer tools. The optional API server and Tauri transport use HTTPS POST. Errors are sanitized and token values are not intentionally logged. App-controlled errors omit raw request URLs/provider messages. Remote VK profile images use no-referrer. Links are restricted to HTTPS VK hosts; desktop opening does not invoke a shell. No messages are sent automatically.

Web CRM is local to the browser origin; SQLite is local to the desktop app. Neither is encrypted. Use OS account/disk protection and private device access. A multi-user commercial deployment needs authentication and a backend credential vault before sharing access. Native CSP restricts outbound connections to VK and required local IPC; web deployment should also set its own hosting headers.
