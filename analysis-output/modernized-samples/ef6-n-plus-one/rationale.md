# EF6 N+1 Query → EF Core Eager Loading

## What changed

The legacy code uses Entity Framework 6 with lazy-loading enabled by default. When `GetOrderSummaries()` loads a list of orders and then accesses `order.Customer.Name` inside a loop, EF6 silently fires a separate `SELECT` query to the database for every single row — 500 orders means 501 round-trips. The modernized version switches to **EF Core** and adds a single `.Include(o => o.Customer)` call, which instructs the ORM to emit one SQL `JOIN` query instead. Pagination parameters (`page`, `pageSize`) are also introduced to prevent the query from returning an unbounded number of rows. The `DbContext` is now injected through the constructor rather than being instantiated with `new` inside the method, which makes the service independently testable with an in-memory database.

## Why it's better

The performance difference is dramatic: a table with 500 orders drops from 501 database round-trips to 1. This directly reduces database load, cuts response time, and eliminates a denial-of-service vector where a large table could exhaust database connection pools. Constructor injection also means the service can be tested in isolation without a real database, improving developer confidence when making future changes.

## Standards addressed

- OWASP A05:2021 (resource exhaustion via unbounded N+1 queries)
- Security finding: `legacy-app/LegacyApp/Models/AppDbContext.cs` line 33
