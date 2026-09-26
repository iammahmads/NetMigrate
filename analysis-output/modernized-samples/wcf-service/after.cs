// ============================================================
// AFTER: WCF replaced with ASP.NET Core Minimal API + plain records
// Target: .NET 8 / ASP.NET Core 8
// Changes:
//   - [ServiceContract]/[OperationContract]/[DataContract]/[DataMember] removed
//   - [DataContract] DTOs replaced with plain C# records (System.Text.Json-friendly)
//   - [ServiceBehavior(InstanceContextMode.Single)] removed — ASP.NET Core DI
//     handles lifetime via AddScoped/AddSingleton registration
//   - log4net replaced with Microsoft.Extensions.Logging ILogger<T>
//   - Direct DbContext construction replaced with constructor injection
//   - Exception swallowing replaced with proper propagation
//   - DateTime.Now replaced with DateTime.UtcNow
//   - Endpoints wired up as a Minimal API group in Program.cs (shown at bottom)
// ============================================================

// --- Models/OrderDtos.cs ---

namespace ModernApp.Models;

public record OrderDto(int Id, string CustomerName, decimal Total, string Status);

public record PlaceOrderRequest(int CustomerId, decimal Total);

// --- Services/IOrderService.cs ---

namespace ModernApp.Services;

public interface IOrderService
{
    Task<OrderDto?> GetOrderAsync(int orderId);
    Task<IReadOnlyList<OrderDto>> GetOrdersForCustomerAsync(int customerId);
    Task<int> PlaceOrderAsync(PlaceOrderRequest request);
}

// --- Services/OrderService.cs ---

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ModernApp.Models;

namespace ModernApp.Services;

// No [ServiceBehavior] — lifetime is controlled by DI registration (AddScoped).
// This eliminates the shared-mutable-state race condition present in the legacy
// InstanceContextMode.Single singleton.
public sealed class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly ILogger<OrderService> _logger;

    public OrderService(AppDbContext db, ILogger<OrderService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<OrderDto?> GetOrderAsync(int orderId)
    {
        _logger.LogInformation("GetOrder called with id={OrderId}", orderId);

        // Exceptions propagate to the caller / middleware — not swallowed.
        // .Include() eliminates the lazy-load N+1 hit on Customer.
        var order = await _db.Orders
            .Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order is null)
            return null;

        return new OrderDto(order.Id, order.Customer.Name, order.Total, order.Status);
    }

    public async Task<IReadOnlyList<OrderDto>> GetOrdersForCustomerAsync(int customerId)
    {
        _logger.LogInformation("GetOrdersForCustomer called for customerId={CustomerId}", customerId);

        // Single JOIN query — no lazy-load round-trips per row.
        return await _db.Orders
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Customer)
            .Select(o => new OrderDto(o.Id, o.Customer.Name, o.Total, o.Status))
            .ToListAsync();
    }

    public async Task<int> PlaceOrderAsync(PlaceOrderRequest request)
    {
        _logger.LogInformation(
            "PlaceOrder for customerId={CustomerId}, total={Total}",
            request.CustomerId, request.Total);

        var order = new Order
        {
            CustomerId = request.CustomerId,
            Total = request.Total,
            OrderDate = DateTime.UtcNow,   // UtcNow for consistent audit timestamps
            Status = "Pending"
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();
        return order.Id;
    }
}

// --- Program.cs (Minimal API wiring) ---
// Shown inline here for clarity; in a real project this lives in Program.cs.

/*
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("AppDb")));

// Scoped lifetime: each HTTP request gets its own OrderService + DbContext,
// eliminating the concurrency hazard from WCF's InstanceContextMode.Single.
builder.Services.AddScoped<IOrderService, OrderService>();

var app = builder.Build();

var orders = app.MapGroup("/orders");

orders.MapGet("/{id:int}", async (int id, IOrderService svc) =>
{
    var dto = await svc.GetOrderAsync(id);
    return dto is null ? Results.NotFound() : Results.Ok(dto);
});

orders.MapGet("/customer/{customerId:int}", async (int customerId, IOrderService svc) =>
    Results.Ok(await svc.GetOrdersForCustomerAsync(customerId)));

orders.MapPost("/", async (PlaceOrderRequest req, IOrderService svc) =>
{
    var newId = await svc.PlaceOrderAsync(req);
    return Results.Created($"/orders/{newId}", new { id = newId });
});

app.Run();
*/
