using System;
using System.Collections.Generic;

namespace LegacyApp.Models
{
    public class Customer
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public DateTime CreatedAt { get; set; }

        public virtual ICollection<Order> Orders { get; set; }
    }

    public class Order
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public DateTime OrderDate { get; set; }
        public decimal Total { get; set; }
        public string Status { get; set; }

        // virtual = EF6 lazy-loading proxy hook (requires proxies enabled — another legacy concern)
        public virtual Customer Customer { get; set; }
    }
}
