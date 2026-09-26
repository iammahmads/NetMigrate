using System.Collections.Generic;
using System.Data.Entity;

namespace LegacyApp.Models
{
    /// <summary>
    /// Entity Framework 6 DbContext.
    /// Legacy pain point: EF6 has no first-class .NET Core support and requires
    /// a separate Microsoft.EntityFrameworkCore migration path.
    /// </summary>
    public class AppDbContext : DbContext
    {
        public AppDbContext() : base("name=AppDb") { }

        public DbSet<Customer> Customers { get; set; }
        public DbSet<Order> Orders { get; set; }
    }

    // ---------------------------------------------------------------------------
    // Intentional N+1 anti-pattern — representative of real legacy pain
    // ---------------------------------------------------------------------------

    public class OrderReportService
    {
        /// <summary>
        /// Returns a flat list of "CustomerName — OrderTotal" strings.
        ///
        /// BUG (N+1): For each order row returned by the first query, a second
        /// round-trip is issued to load the related Customer.  With 500 orders
        /// this produces 501 database calls.  The fix is a single JOIN via
        /// .Include(o => o.Customer), but legacy code often omits this.
        /// </summary>
        public IEnumerable<string> GetOrderSummaries()
        {
            using (var db = new AppDbContext())
            {
                // First query — loads all orders WITHOUT the related customer
                var orders = db.Orders.ToList();   // <-- missing .Include(o => o.Customer)

                var summaries = new List<string>();
                foreach (var order in orders)
                {
                    // Each iteration fires a separate SELECT to resolve order.Customer
                    // because lazy-loading is enabled by default in EF6.
                    var customerName = order.Customer.Name;   // N+1 here
                    summaries.Add($"{customerName} — ${order.Total:F2}");
                }
                return summaries;
            }
        }
    }
}
