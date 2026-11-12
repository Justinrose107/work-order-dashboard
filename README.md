# Work Order Review on GitHub Pages

The published index.html is a self-contained encrypted workspace hosted directly by GitHub Pages. It does not redirect to another hosting provider. It contains the verified 1,417-order review and seven reason categories, encrypted with AES-256-GCM. A password-derived 256-bit key uses PBKDF2-SHA256 with 600,000 iterations and a random salt.

The shared password, decrypted work-order records and customer names are not present in published source. Only the encrypted index.html, .nojekyll and this README are intended for upload. Never upload plaintext data.js, unencrypted dashboard files or Excel exports to the public repository.

Users unlock the content in their browser. The optional eight-hour tab session stores the derived decryption key in sessionStorage, not the plaintext password. Lock workspace removes that tab key. Regional feedback remains in browser localStorage and can be backed up/imported; it is not a shared online database.

This provides encryption rather than server-side account authorization. People with the password can save decrypted content. Old encrypted versions in Git history remain decryptable with their original password, so encryption cannot revoke copies already shared. Use a strong password and share it only with the intended team.

The build script reads a hidden JSON line from stdin and never writes the password to disk or command arguments. Public source uses a hash-based Content Security Policy and makes no network calls to unlock the dashboard. HTTPS is required for browser cryptography.
