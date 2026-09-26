using System;
using System.Web;
using System.Web.Mvc;
using LegacyApp.Models;
using LegacyApp.Services;

namespace LegacyApp.Controllers
{
    /// <summary>
    /// ASP.NET MVC 5 controller.
    ///
    /// Legacy pain points:
    ///   1. Direct dependency on System.Web.HttpContext — unavailable in .NET Core.
    ///      HttpContext.Current is a static ambient context; it breaks async code
    ///      and cannot be injected or mocked without extra infrastructure.
    ///   2. Service instantiated via `new` instead of constructor injection.
    ///   3. Session accessed via HttpContext.Current.Session (thread-unsafe in async).
    /// </summary>
    public class OrdersController : Controller
    {
        // Anti-pattern: concrete dependency, not injected
        private readonly IOrderService _orderService = new OrderService();

        // GET /Orders
        public ActionResult Index()
        {
            // System.Web coupling: reading the authenticated username from the static context
            var username = HttpContext.Current.User?.Identity?.Name ?? "anonymous";

            // System.Web coupling: writing to the legacy Session store
            HttpContext.Current.Session["LastPage"] = "Orders";

            var report = new OrderReportService();
            var summaries = report.GetOrderSummaries();

            // Passing raw string list to the view — no typed ViewModel
            ViewBag.Username = username;
            return View(summaries);
        }

        // GET /Orders/Details/5
        public ActionResult Details(int id)
        {
            // System.Web coupling: reading a raw cookie value directly
            var preferredCurrency = HttpContext.Current.Request.Cookies["currency"]?.Value ?? "USD";

            var order = _orderService.GetOrder(id);
            if (order == null)
                return HttpNotFound();

            ViewBag.Currency = preferredCurrency;
            return View(order);
        }

        // POST /Orders/Place
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Place(int customerId, decimal total)
        {
            // System.Web coupling: manually reading the client IP from ServerVariables
            var clientIp = HttpContext.Current.Request.ServerVariables["REMOTE_ADDR"];

            try
            {
                var orderId = _orderService.PlaceOrder(new PlaceOrderRequest
                {
                    CustomerId = customerId,
                    Total = total
                });

                // System.Web coupling: writing to application-level cache
                HttpContext.Current.Application.Lock();
                HttpContext.Current.Application["LastOrderId"] = orderId;
                HttpContext.Current.Application.UnLock();

                return RedirectToAction("Details", new { id = orderId });
            }
            catch (Exception ex)
            {
                // Anti-pattern: exposing exception message directly to the view
                ModelState.AddModelError("", ex.Message);
                return View("Error");
            }
        }
    }
}
