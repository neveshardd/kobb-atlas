using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Text.Json;

namespace Kobb.Atlas;

public sealed class EnvironmentalData : IDisposable
{
    private readonly HttpClient client = new() { Timeout = TimeSpan.FromSeconds(35) };
    private readonly Dictionary<string, (DateTimeOffset Expires, string Value)> cache = [];

    public EnvironmentalData() => client.DefaultRequestHeaders.UserAgent.ParseAdd($"KOBB-Atlas/{typeof(EnvironmentalData).Assembly.GetName().Version!.ToString(3)} (+https://kobbstudio.com.br)");

    public async Task<object> QueryAsync(string type, JsonElement data)
    {
        var key = type + data.GetRawText();
        if (cache.TryGetValue(key, out var item) && item.Expires > DateTimeOffset.UtcNow) return JsonSerializer.Deserialize<JsonElement>(item.Value);
        string url;
        string? body = null;
        const string hourly = "wind_speed_10m,wind_direction_10m,temperature_2m,surface_pressure";
        if (type == "geocode")
        {
            var query = data.GetProperty("query").GetString() ?? "";
            if (query.Length is < 2 or > 150) throw new ArgumentException("Informe uma cidade.");
            url = "https://geocoding-api.open-meteo.com/v1/search?count=6&language=pt&format=json&name=" + Uri.EscapeDataString(query);
        }
        else
        {
            var precision = type == "noise" ? "F5" : "F4";
            var latitude = Number(data, "latitude", -85, 85).ToString(precision, CultureInfo.InvariantCulture);
            var longitude = Number(data, "longitude", -180, 180).ToString(precision, CultureInfo.InvariantCulture);
            var common = $"latitude={latitude}&longitude={longitude}&hourly={hourly}&wind_speed_unit=ms&timezone=UTC";
            switch (type)
            {
                case "elevation": url = $"https://api.open-meteo.com/v1/elevation?latitude={latitude}&longitude={longitude}"; break;
                case "forecast": url = "https://api.open-meteo.com/v1/forecast?" + common + "&forecast_days=16&past_days=7"; break;
                case "history":
                    var date = DateOnly.ParseExact(data.GetProperty("date").GetString()!, "yyyy-MM-dd", CultureInfo.InvariantCulture);
                    if (date.Year < 1940 || date.ToDateTime(TimeOnly.MinValue) > DateTime.UtcNow.AddDays(-5)) throw new ArgumentException("Reanálise disponível desde 1940, com atraso de atualização.");
                    url = $"https://archive-api.open-meteo.com/v1/archive?{common}&models=era5&start_date={date.AddDays(-1):yyyy-MM-dd}&end_date={date.AddDays(1):yyyy-MM-dd}"; break;
                case "noise":
                    var radius = (int)Number(data, "radius", 100, 1000);
                    var around = $"around:{radius},{latitude},{longitude}";
                    body = $"[out:json][timeout:25];(nwr({around})[amenity~\"^(place_of_worship|school|university|college|kindergarten|hospital|clinic|theatre|cinema|nightclub|bar|community_centre|townhall)$\"];nwr({around})[landuse=industrial];nwr({around})[building=industrial];nwr({around})[man_made=works];);out center tags;";
                    url = "https://overpass-api.de/api/interpreter"; break;
                default: throw new ArgumentException("Consulta desconhecida.");
            }
        }
        using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, url);
        if (body is not null) request.Content = new FormUrlEncodedContent([new("data", body)]);
        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode) throw new HttpRequestException($"Serviço indisponível ({(int)response.StatusCode}).");
        var raw = await response.Content.ReadAsStringAsync();
        if (raw.Length > 8_000_000) throw new InvalidDataException("Resposta da fonte excedeu o limite.");
        using var document = JsonDocument.Parse(raw);
        if (document.RootElement.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.True) throw new InvalidDataException("A fonte não forneceu dados para esta consulta.");
        var result = new { payload = document.RootElement.Clone(), retrievedAt = DateTimeOffset.UtcNow };
        var value = JsonSerializer.Serialize(result);
        if (cache.Count > 80) cache.Clear();
        cache[key] = (DateTimeOffset.UtcNow.AddMinutes(type == "history" ? 1440 : 10), value);
        return result;
    }

    private static double Number(JsonElement data, string name, double min, double max)
    {
        var value = data.GetProperty(name).GetDouble();
        if (!double.IsFinite(value) || value < min || value > max) throw new ArgumentException("Coordenada ou alcance inválido.");
        return value;
    }
    public void Dispose() => client.Dispose();
}
