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
