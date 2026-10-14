using System.Runtime.InteropServices;
using System.Text;
using System.Xml.Linq;

internal static class BinaryManifest
{
    public static void RequireAdministrator(string file)
    {
        var module = LoadLibraryEx(file, IntPtr.Zero, 2);
        if (module == IntPtr.Zero) throw new InvalidOperationException("Não foi possível ler o manifesto do instalador.");
        try
        {
            var resource = FindResource(module, new IntPtr(1), new IntPtr(24));
            if (resource == IntPtr.Zero) throw new InvalidOperationException("Manifesto do instalador não encontrado.");
            var pointer = LockResource(LoadResource(module, resource));
            var bytes = new byte[SizeofResource(module, resource)];
            Marshal.Copy(pointer, bytes, 0, bytes.Length);
            var manifest = XDocument.Parse(Encoding.UTF8.GetString(bytes).Trim('\uFEFF', '\0'));
            var level = manifest.Descendants().Single(element => element.Name.LocalName == "requestedExecutionLevel").Attribute("level")?.Value;
            if (level != "requireAdministrator") throw new InvalidOperationException("O instalador de software não solicita permissão administrativa.");
        }
        finally { FreeLibrary(module); }
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindResource(IntPtr module, IntPtr name, IntPtr type);
    [DllImport("kernel32.dll")]
    private static extern IntPtr LoadResource(IntPtr module, IntPtr resource);
    [DllImport("kernel32.dll")]
    private static extern IntPtr LockResource(IntPtr resource);
    [DllImport("kernel32.dll")]
    private static extern uint SizeofResource(IntPtr module, IntPtr resource);
    [DllImport("kernel32.dll")]
    private static extern bool FreeLibrary(IntPtr module);
}
