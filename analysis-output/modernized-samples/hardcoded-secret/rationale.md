# Hardcoded Secrets → Environment Variables / Secrets Manager

## What changed

The database password and payment gateway API key were stored in plain text inside `Web.config`, which is committed to source control — meaning anyone with read access to the repository also has production credentials. In the modernized version, `Web.config` is replaced with `appsettings.json` that contains **no secrets at all**. Sensitive values are injected at runtime through one of three layered sources: `.NET User Secrets` for a developer's local machine (stored outside the repo), **environment variables** set by the deployment pipeline, or **Azure Key Vault** for production (accessed via managed identity, no passwords stored anywhere).

## Why it's better

Secrets that never touch the file system or source control cannot be leaked through a repository breach, a misconfigured backup, or a junior developer accidentally pushing a `.config` file. Rotating a credential now requires changing one environment variable or Key Vault entry — no code change, no redeployment of the application binary. The `debug=true` flag and `includeExceptionDetailInFaults` setting are also removed, so production error details are no longer exposed to end users.

## Standards addressed

- PCI-DSS 3.2.1, FedRAMP SC-28, HIPAA §164.312(a)(2)(iv) (database password at rest)
- PCI-DSS 2.2.4, FedRAMP SC-28 (API key in configuration)
- OWASP A09:2021, FedRAMP SI-11 (debug mode disabled in production)
- OWASP A07:2021, PCI-DSS 8.1.4 (auth cookie now Secure + HttpOnly)
