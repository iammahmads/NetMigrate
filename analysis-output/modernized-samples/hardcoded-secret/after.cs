// ============================================================
// AFTER: Secrets removed from config files; loaded at runtime
//        via environment variables, .NET User Secrets (dev),
//        or Azure Key Vault / AWS Secrets Manager (production).
// Target: .NET 8 / ASP.NET Core 8
//
// Changes:
//   - Web.config eliminated entirely
//   - appsettings.json holds only non-sensitive keys
//   - Connection string loaded from environment variable
//     ConnectionStrings__AppDb (no password in any file)
//   - API key loaded from IConfiguration backed by User Secrets
//     in development and Key Vault in production
//   - debug=true removed; developer exception page gated behind
//     IsDevelopment() check
//   - Forms auth replaced with ASP.NET Core cookie auth with
//     Secure + HttpOnly flags enforced automatically
// ============================================================

// --- appsettings.json (committed to source control — NO secrets) ---
/*
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
*/
// The connection string and API key are intentionally absent from this file.
// They are injected at runtime via one of the sources below.

// --- appsettings.Development.json (committed — still no secrets) ---
/*
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug"
    }
  }
}
*/

// --- .NET User Secrets for local development (never committed to git) ---
// Initialise once per developer machine:
//   dotnet user-secrets init
//   dotnet user-secrets set "ConnectionStrings:AppDb" "Server=localhost;Database=OrdersDb;Trusted_Connection=True;"
//   dotnet user-secrets set "PaymentGateway:ApiKey" "your-local-test-key"
//
// Stored in %APPDATA%\Microsoft\UserSecrets\<project-guid>\secrets.json
// — outside the repository, so they can never be accidentally committed.

// --- Production: environment variables (injected by the platform/CI) ---
// ConnectionStrings__AppDb  = "Server=PROD-SQL-01;Database=OrdersDb;User Id=appuser;Password=$(DB_PASSWORD)"
// PaymentGateway__ApiKey    = "<value injected from Key Vault at deploy time>"
//
// ASP.NET Core's configuration system automatically maps double-underscore (__) to
// the colon (:) separator, so no code changes are needed between environments.

// --- Production: Azure Key Vault (optional, highest assurance) ---
// Add to Program.cs:
//   builder.Configuration.AddAzureKeyVault(
//       new Uri("https://<vault-name>.vault.azure.net/"),
//       new DefaultAzureCredential());
// Secret names: "ConnectionStrings--AppDb", "PaymentGateway--ApiKey"

// --- Program.cs — reading secrets through IConfiguration ---

using Azure.Identity;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// ── Key Vault (production only) ──────────────────────────────────────────────
if (builder.Environment.IsProduction())
{
    var kvUri = builder.Configuration["KeyVaultUri"]
        ?? throw new InvalidOperationException("KeyVaultUri is required in production.");
    builder.Configuration.AddAzureKeyVault(new Uri(kvUri), new DefaultAzureCredential());
}

// ── Database ──────────────────────────────────────────────────────────────────
// GetConnectionString resolves the environment variable ConnectionStrings__AppDb
// or the User Secret "ConnectionStrings:AppDb" — no password ever in a file.
builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("AppDb")
        ?? throw new InvalidOperationException("Connection string 'AppDb' is not configured.")));

// ── Authentication (replaces Forms auth; Secure+HttpOnly enforced by default) ─
builder.Services.AddAuthentication("Cookies")
    .AddCookie(opts =>
    {
        opts.LoginPath = "/Account/Login";
        opts.ExpireTimeSpan = TimeSpan.FromHours(48);
        opts.Cookie.SecurePolicy = CookieSecurePolicy.Always;   // HTTPS-only
        opts.Cookie.HttpOnly = true;                             // not readable by JS
        opts.Cookie.SameSite = SameSiteMode.Lax;
    });

var app = builder.Build();

// ── Developer exception page gated — never shown in production ───────────────
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
    app.UseExceptionHandler("/Error");

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.Run();

// --- Consuming the API key in a service (injected, never hard-coded) ---

public sealed class PaymentService
{
    private readonly string _apiKey;
    private readonly ILogger<PaymentService> _logger;

    // IConfiguration is injected by the DI container; it reads from whichever
    // provider has the value (env var, User Secret, Key Vault) transparently.
    public PaymentService(IConfiguration config, ILogger<PaymentService> logger)
    {
        _apiKey = config["PaymentGateway:ApiKey"]
            ?? throw new InvalidOperationException("PaymentGateway:ApiKey is not configured.");
        _logger = logger;
    }

    public async Task<bool> ChargeAsync(decimal amount)
    {
        _logger.LogInformation("Charging {Amount}", amount);
        // Use _apiKey here — it was never written to disk or source control.
        return await Task.FromResult(true); // placeholder
    }
}
