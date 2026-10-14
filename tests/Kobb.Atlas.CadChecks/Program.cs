using ACadSharp.IO;
using ACadSharp.Entities;
using ACadSharp.Types.Units;
using Kobb.Atlas;

var source = File.ReadAllBytes(args[0]);
var bytes = DwgExport.Convert(source);
if (!bytes.AsSpan().StartsWith("AC1032"u8)) throw new Exception("Assinatura DWG incorreta.");
await File.WriteAllBytesAsync(args[1], bytes);
var restored = DwgReader.Read(args[1]);
using var input = new MemoryStream(source);
var original = DxfReader.Read(input);
if (restored.Header.InsUnits != UnitsType.Meters) throw new Exception("Unidade incorreta.");
var expected = original.Entities.GroupBy(entity => (entity.ObjectName, entity.Layer.Name)).ToDictionary(group => group.Key, group => group.Count());
var actual = restored.Entities.GroupBy(entity => (entity.ObjectName, entity.Layer.Name)).ToDictionary(group => group.Key, group => group.Count());
if (expected.Count != actual.Count || expected.Any(pair => !actual.TryGetValue(pair.Key, out var count) || count != pair.Value)) throw new Exception("Entidades ou camadas alteradas.");
var expectedLines = original.Entities.OfType<Line>().ToArray();
var actualLines = restored.Entities.OfType<Line>().ToArray();
for (var i = 0; i < expectedLines.Length; i++)
    if (expectedLines[i].StartPoint != actualLines[i].StartPoint || expectedLines[i].EndPoint != actualLines[i].EndPoint || !expectedLines[i].Color.Equals(actualLines[i].Color)) throw new Exception("Geometria ou cor alterada.");
Console.WriteLine($"PASS: DWG salvo em {args[1]}; {restored.Entities.Count} entidades, camadas, cores, geometria 3D e unidades preservadas, sem AutoCAD.");
