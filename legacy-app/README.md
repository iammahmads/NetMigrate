# LegacyApp — Hackathon Demo Target

> **⚠️ IMPORTANT: This is synthetic sample data created for a hackathon demo.**

This project is a deliberately constructed legacy ASP.NET (.NET Framework 4.x) application
that exists **purely as an analysis target** for the NetMigrate modernization accelerator.

## What this is

- A small, representative slice of a legacy codebase with intentional pain points
- Contains **no real credentials**, **no real business logic**, and **no real data**
- Was never run in production and is not intended to be
- All connection strings use obviously fake placeholder values (e.g. `Password=SAMPLE_NOT_REAL_1234`)

## Intentional legacy pain points included

| Pain Point | Location |
|---|---|
| WCF service (obsolete in .NET Core/8) | `Services/IOrderService.cs`, `Services/OrderService.cs` |
| Entity Framework 6 with N+1 query | `Models/AppDbContext.cs` |
| `System.Web` / `HttpContext.Current` coupling | `Controllers/OrdersController.cs` |
| Hardcoded fake connection string in Web.config | `Web.config` |
| Deprecated NuGet package (`log4net 1.2.10`) | `LegacyApp.csproj` |

## Do not use this code as a template

This code intentionally contains anti-patterns and deprecated APIs.
It is meant to be **read and analyzed**, not executed or copied.
