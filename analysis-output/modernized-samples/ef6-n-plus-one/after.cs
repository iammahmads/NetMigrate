// ============================================================
// AFTER: EF Core DbContext with eager-loading (.Include) and
//        constructor-injected connection string
// Target: .NET 8 / EF Core 8
//
// Changes:
//   - System.Data.Entity (EF6) → Microsoft.EntityFrameworkCore (EF Core)
//   - Parameterless constructor → DbContextOptions<T> injection (no "name=AppDb")
//   - virtual navigation properties kept but lazy-loading proxy removed;
//     explicit .Include() is now the only way to load related data
//   - OrderReportService moved to its own class; DbContext injected via constructor
//   - N+1 loop replaced with a single JOIN query using .Include(o => o.Customer)
//   - Synchronous ToList() → async ToListAsync() throughout
//   - No pagination added here; shown as a parameter for illustration
// ============================================================

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ModernApp.Models;

// ── DbContext ────────────────────────────────────────────────────────────────

public class AppDbContext : DbContext
{
    // DbContextOptions is injected by the DI container, which reads the
    // connection string from IConfiguration (env var / Key Vault — not a
    // hardcoded "name=AppDb" string).
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Lazy-loading proxies are NOT enabled.  All related data must be
        // loaded explicitly with .Include() — making query cost visible and
        // intentional rather than hidden inside property accessors.
        modelBuilder.Entity<Order>()
            .HasOne(o => o.Customer)
            .WithMany(c => c.Orders)
            .HasForeignKey(o => o.CustomerId);
    }
}

// ── Service ──────────────────────────────────────────────────────────────────

namespace ModernApp.Services;

public sealed class OrderReportService
{
    private readonly AppDbContext _db;

    // DbContext injected — no "new AppDbContext()" anywhere in the class.
    // This makes the service unit-testable with an in-memory provider.
    public OrderReportService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Returns "CustomerName — $Total" summaries.
    ///
    /// FIX: .Include(o => o.Customer) tells EF Core to emit a single SQL JOIN
    /// rather than one SELECT per order row.  500 orders = 1 database call,
    /// not 501.
    /// </summary>
    public async Task<IReadOnlyList<string>> GetOrderSummariesAsync(
        int page = 1, int pageSize = 100)
    {
        // One query, one round-trip, with optional pagination to prevent
        // unbounded result sets (addresses the resource-exhaustion risk).
        return await _db.Orders
            .Include(o => o.Customer)          // <-- the critical fix
            .OrderBy(o => o.Id)                // stable ordering for pagination
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => $"{o.Customer.Name} — ${o.Total:F2}")
            .ToListAsync();
    }
}

// ── DI registration in Program.cs ───────────────────────────────────────────
/*
builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("AppDb")));

builder.Services.AddScoped<OrderReportService>();
*/

// ── Unit-test example (xUnit + EF Core InMemory provider) ───────────────────
/*
public class OrderReportServiceTests
{
    [Fact]
    public async Task GetOrderSummariesAsync_ReturnsSingleQueryResult()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("test-db")
            .Options;

        await using var db = new AppDbContext(options);
        db.Customers.Add(new Customer { Id = 1, Name = "Alice" });
        db.Orders.Add(new Order { Id = 1, CustomerId = 1, Total = 49.99m, Status = "Pending" });
        await db.SaveChangesAsync();

        var svc = new OrderReportService(db);
        var result = await svc.GetOrderSummariesAsync();

        Assert.Single(result);
        Assert.Equal("Alice — $49.99", result[0]);
    }
}
*/
