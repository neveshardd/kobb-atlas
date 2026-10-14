using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using Microsoft.Win32;

namespace Kobb.Atlas;

public static class FileExport
{
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
        if (format == "dwg") bytes = await Task.Run(() => DwgExport.Convert(bytes));
        var temporary = dialog.FileName + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await File.WriteAllBytesAsync(temporary, bytes);
            if (new FileInfo(temporary).Length != bytes.Length) throw new IOException("O arquivo exportado não foi gravado por completo.");
            File.Move(temporary, dialog.FileName, true);
            if (!File.Exists(dialog.FileName)) throw new IOException("O arquivo exportado não foi encontrado no destino.");
            return new { saved = true, path = dialog.FileName };
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

}
