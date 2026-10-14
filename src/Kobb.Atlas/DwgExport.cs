using System.IO;
using ACadSharp;
using ACadSharp.IO;

namespace Kobb.Atlas;

public static class DwgExport
{
    public static byte[] Convert(byte[] dxf)
    {
        using var input = new MemoryStream(dxf, false);
        var document = DxfReader.Read(input);
        if (document.Entities.Count == 0) throw new InvalidDataException("O desenho não contém entidades CAD.");
        document.CreateDefaults();
        document.TableStyles.Clear();
        document.Header.Version = ACadVersion.AC1032;
        document.Header.InsUnits = ACadSharp.Types.Units.UnitsType.Meters;
        using var output = new MemoryStream();
        DwgWriter.Write(output, document, new DwgWriterConfiguration { CloseStream = false });
        var bytes = output.ToArray();
        using var verification = new MemoryStream(bytes, false);
        var restored = DwgReader.Read(verification);
        if (restored.Entities.Count != document.Entities.Count) throw new InvalidDataException("Não foi possível preservar todas as entidades no DWG.");
        return bytes;
    }
}
