// ============================================================
// BEFORE: WCF service contract and implementation
// Source: legacy-app/LegacyApp/Services/IOrderService.cs
//         legacy-app/LegacyApp/Services/OrderService.cs
// ============================================================

// --- IOrderService.cs ---

using System.Collections.Generic;
using System.ServiceModel;

namespace LegacyApp.Services
{
    /// <summary>
    /// WCF service contract.
    /// Legacy pain point: WCF (System.ServiceModel) is not supported on .NET Core or .NET 5+.
    /// Migration path: replace with ASP.NET Core minimal API, gRPC, or CoreWCF (community port).
    /// </summary>
    [ServiceContract(Namespace = "http://legacyapp.example.com/orders")]
    public interface IOrderService
    {
        [OperationContract]
        OrderDto GetOrder(int orderId);

        [OperationContract]
        IList<OrderDto> GetOrdersForCustomer(int customerId);

        [OperationContract]
        int PlaceOrder(PlaceOrderRequest request);
    }

    [System.Runtime.Serialization.DataContract]
    public class OrderDto
    {
        [System.Runtime.Serialization.DataMember] public int Id { get; set; }
        [System.Runtime.Serialization.DataMember] public string CustomerName { get; set; }
        [System.Runtime.Serialization.DataMember] public decimal Total { get; set; }
        [System.Runtime.Serialization.DataMember] public string Status { get; set; }
    }

    [System.Runtime.Serialization.DataContract]
    public class PlaceOrderRequest
    {
        [System.Runtime.Serialization.DataMember] public int CustomerId { get; set; }
        [System.Runtime.Serialization.DataMember] public decimal Total { get; set; }
    }
}

// --- OrderService.cs ---

using System;
using System.Collections.Generic;
using System.Linq;
using System.ServiceModel;
using LegacyApp.Models;
using log4net;

namespace LegacyApp.Services
{
    /// <summary>
    /// WCF service implementation.
    ///
    /// Legacy pain points:
    ///   1. [ServiceBehavior] with InstanceContextMode.Single is a concurrency hazard.
    ///   2. log4net 1.2.10 is a .NET 1.x-era library with no .NET Core support.
    ///   3. Direct DbContext construction (no DI) makes unit testing hard.
    ///   4. Swallowing exceptions and returning null hides failures silently.
    /// </summary>
    [ServiceBehavior(InstanceContextMode = InstanceContextMode.Single,
                     ConcurrencyMode = ConcurrencyMode.Single)]
    public class OrderService : IOrderService
    {
        // log4net 1.2.10 — deprecated, .NET 1.x only, no .NET Core support
        private static readonly ILog _log =
            LogManager.GetLogger(typeof(OrderService));

        public OrderDto GetOrder(int orderId)
        {
            _log.InfoFormat("GetOrder called with id={0}", orderId);
            try
            {
                using (var db = new AppDbContext())
                {
                    // Missing .Include() — will trigger a lazy-load for Customer
                    var order = db.Orders.FirstOrDefault(o => o.Id == orderId);
                    if (order == null) return null;

                    return new OrderDto
                    {
                        Id = order.Id,
                        CustomerName = order.Customer.Name,   // lazy-load N+1 risk
                        Total = order.Total,
                        Status = order.Status
                    };
                }
            }
            catch (Exception ex)
            {
                // Anti-pattern: swallowing the exception after logging
                _log.Error("GetOrder failed", ex);
                return null;
            }
        }

        public IList<OrderDto> GetOrdersForCustomer(int customerId)
        {
            _log.InfoFormat("GetOrdersForCustomer called for customerId={0}", customerId);
            using (var db = new AppDbContext())
            {
                // N+1: no .Include(o => o.Customer) — each DTO mapping hits the DB again
                return db.Orders
                    .Where(o => o.CustomerId == customerId)
                    .ToList()
                    .Select(o => new OrderDto
                    {
                        Id = o.Id,
                        CustomerName = o.Customer.Name,   // lazy-load per row
                        Total = o.Total,
                        Status = o.Status
                    })
                    .ToList();
            }
        }

        public int PlaceOrder(PlaceOrderRequest request)
        {
            _log.InfoFormat("PlaceOrder for customerId={0}, total={1}",
                request.CustomerId, request.Total);

            using (var db = new AppDbContext())
            {
                var order = new Order
                {
                    CustomerId = request.CustomerId,
                    Total = request.Total,
                    OrderDate = DateTime.Now,   // anti-pattern: use UtcNow
                    Status = "Pending"
                };
                db.Orders.Add(order);
                db.SaveChanges();
                return order.Id;
            }
        }
    }
}
