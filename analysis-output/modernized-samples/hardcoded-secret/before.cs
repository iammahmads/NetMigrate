<!-- ============================================================
     BEFORE: Hardcoded secrets in Web.config
     Source: legacy-app/LegacyApp/Web.config (lines 19-33)
     
     NOTE: This file uses XML, not C#. The .cs extension is used
     here for consistency with the other samples in this folder.
     ============================================================ -->

<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <configSections>
    <section name="entityFramework"
             type="System.Data.Entity.Internal.ConfigFile.EntityFrameworkSection, EntityFramework, Version=6.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"
             requirePermission="false" />
  </configSections>

  <!-- Hardcoded connection string — legacy anti-pattern; should use env vars or secrets manager -->
  <connectionStrings>
    <add name="AppDb"
         connectionString="Server=PROD-SQL-01;Database=OrdersDb;User Id=appuser;Password=SAMPLE_NOT_REAL_1234;MultipleActiveResultSets=True;"
         providerName="System.Data.SqlClient" />
  </connectionStrings>

  <appSettings>
    <add key="webpages:Version" value="3.0.0.0" />
    <add key="webpages:Enabled" value="false" />
    <add key="ClientValidationEnabled" value="true" />
    <add key="UnobtrusiveJavaScriptEnabled" value="true" />
    <!-- Another hardcoded secret anti-pattern: API key stored in config -->
    <add key="PaymentGatewayApiKey" value="FAKE-API-KEY-DO-NOT-USE-9876" />
  </appSettings>

  <system.web>
    <compilation debug="true" targetFramework="4.7.2" />
    <httpRuntime targetFramework="4.7.2" />
    <authentication mode="Forms">
      <forms loginUrl="~/Account/Login" timeout="2880" />
    </authentication>
  </system.web>

</configuration>
