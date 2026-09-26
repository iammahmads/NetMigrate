# WCF Service → ASP.NET Core Minimal API

## What changed

The Windows Communication Foundation (WCF) service contract and implementation were replaced with an ASP.NET Core Minimal API backed by a plain C# service class. WCF's `[ServiceContract]`, `[OperationContract]`, and `[DataContract]` attributes — along with the `System.ServiceModel` assembly — are entirely removed because they have no support on .NET 5 or later. The legacy singleton behaviour (`InstanceContextMode.Single`) created a race condition where every user shared the same object; the new version uses scoped dependency injection so each request gets its own isolated service instance. The old `log4net` library, which predates .NET Core, is replaced with the built-in `Microsoft.Extensions.Logging` framework that works everywhere without extra configuration.

## Why it's better

The new code runs on modern .NET, is testable (dependencies are injected rather than hard-coded), and is secure by default — no shared mutable state, no unauthenticated WSDL endpoint exposed to the public internet, and no cleartext HTTP binding. Stakeholders get a REST API they can call from any language or tool, with standard JSON payloads, instead of a SOAP service that requires specialised WCF client proxies.

## Standards addressed

- PCI-DSS 4.1, FedRAMP SC-8 (transport security — no more `basicHttpBinding` without TLS)
- OWASP A09:2021, FedRAMP SI-11 (no `serviceMetadata httpGetEnabled` or `includeExceptionDetailInFaults`)
- OWASP A01:2021, FedRAMP SC-2 (race condition eliminated via scoped lifetime)
