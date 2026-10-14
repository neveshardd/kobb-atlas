using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace Kobb.Atlas;

public static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--export-icon") { _ = new Application(); Branding.ExportIcon(args[1]); return 0; }
        if (args.Contains("--verify-runtime"))
        {
            try
            {
                var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                if (!File.Exists(Path.Combine(AppContext.BaseDirectory, "web", "index.html"))) throw new FileNotFoundException("Interface não encontrada.");
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "kobb-atlas-runtime-check.txt"), "KOBB Atlas " + typeof(Program).Assembly.GetName().Version!.ToString(3) + " · WebView2 " + version);
                return 0;
            }
            catch { return 1; }
        }
        var application = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        TaskbarPinning.Identify();
        var window = new AtlasWindow();
        if (args.Contains("--pin-to-taskbar"))
        {
            var requested = false;
            window.ContentRendered += async (_, _) => { if (requested) return; requested = true; await TaskbarPinning.RequestAsync(window); };
        }
        if (args.Contains("--verify-window")) window.Verification = true;
        application.Run(window);
        return Environment.ExitCode;
    }
}
