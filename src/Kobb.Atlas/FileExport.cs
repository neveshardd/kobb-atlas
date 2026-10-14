using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using Microsoft.Win32;

namespace Kobb.Atlas;

public static class FileExport
{
    public static string? CoreConsole()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Autodesk");
        if (!Directory.Exists(root)) return null;
        return Directory.EnumerateDirectories(root, "AutoCAD *").OrderByDescending(path => path).Select(path => Path.Combine(path, "accoreconsole.exe")).FirstOrDefault(File.Exists);
    }

    public static async Task<object> SaveAsync(Window owner, JsonElement payload)
    {
        var format = payload.GetProperty("format").GetString();
        var filters = new Dictionary<string, string> { ["pdf"] = "PDF (*.pdf)|*.pdf", ["png"] = "Imagem PNG (*.png)|*.png", ["dxf"] = "Desenho CAD (*.dxf)|*.dxf", ["dwg"] = "Desenho AutoCAD (*.dwg)|*.dwg", ["json"] = "Dados do estudo (*.json)|*.json" };
        if (format is null || !filters.TryGetValue(format, out var filter)) throw new InvalidDataException("Formato de exportação inválido.");
        var bytes = Convert.FromBase64String(payload.GetProperty("content").GetString()!);
        if (bytes.Length == 0 || bytes.Length > 32_000_000) throw new InvalidDataException("Arquivo de exportação excedeu o limite de tamanho.");
        if (format == "pdf" && !bytes.AsSpan().StartsWith("%PDF-"u8)) throw new InvalidDataException("PDF inválido.");
        if (format == "png" && !bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) throw new InvalidDataException("PNG inválido.");
        if ((format == "dxf" || format == "dwg") && !Encoding.UTF8.GetString(bytes).Contains("\r\nENTITIES\r\n", StringComparison.Ordinal)) throw new InvalidDataException("Desenho CAD inválido.");
        var filename = Path.GetFileName(payload.GetProperty("filename").GetString() ?? "atlas." + format);
        var dialog = new SaveFileDialog { Title = "Exportar estudo", Filter = filter, FileName = Path.ChangeExtension(filename, format), DefaultExt = format, AddExtension = true, OverwritePrompt = true };
        if (dialog.ShowDialog(owner) != true) return new { saved = false };
        if (format == "dwg") bytes = await ConvertDwgAsync(bytes);
        await File.WriteAllBytesAsync(dialog.FileName, bytes);
        return new { saved = true };
    }

    public static async Task<byte[]> ConvertDwgAsync(byte[] dxf)
    {
        var executable = CoreConsole() ?? throw new InvalidOperationException("DWG requer AutoCAD instalado e licenciado. Use DXF para exportar sem AutoCAD.");
        var directory = Path.Combine(Path.GetTempPath(), "kobb-atlas-cad-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var input = Path.Combine(directory, "study.dxf"); var output = Path.Combine(directory, "study.dwg"); var script = Path.Combine(directory, "convert.scr");
            await File.WriteAllBytesAsync(input, dxf);
            var path = output.Replace('\\', '/');
            await File.WriteAllTextAsync(script, $"(setvar \"FILEDIA\" 0)\n(setvar \"INSUNITS\" 6)\n(command \"_.SAVEAS\" \"2018\" \"{path}\")\n_.QUIT\n", Encoding.ASCII);
            var start = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = directory };
            foreach (var argument in new[] { "/i", input, "/s", script, "/l", "en-US" }) start.ArgumentList.Add(argument);
            using var process = Process.Start(start) ?? throw new InvalidOperationException("Não foi possível iniciar a conversão CAD.");
            var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException) { process.Kill(true); await process.WaitForExitAsync(); throw new InvalidOperationException("O AutoCAD demorou para converter o desenho. Verifique a licença ou exporte DXF."); }
            await Task.WhenAll(stdout, stderr);
            if (!File.Exists(output)) throw new InvalidOperationException("O AutoCAD não gerou o DWG. Verifique a licença ou exporte DXF.");
            var result = await File.ReadAllBytesAsync(output);
            if (result.Length < 100 || !result.AsSpan().StartsWith("AC10"u8)) throw new InvalidDataException("O AutoCAD não gerou um DWG válido.");
            return result;
        }
        finally
        {
            var resolved = Path.GetFullPath(directory);
            if (resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) && Directory.Exists(resolved)) Directory.Delete(resolved, true);
        }
    }
}
