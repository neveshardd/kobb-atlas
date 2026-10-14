using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using Windows.UI.Shell;

namespace Kobb.Atlas;

public static class TaskbarPinning
{
    public static void Identify() => Marshal.ThrowExceptionForHR(SetCurrentProcessExplicitAppUserModelID("KOBB.Atlas"));

    public static async Task RequestAsync(Window owner)
    {
        owner.Activate();
        try
        {
            var manager = TaskbarManager.GetDefault();
            if (await manager.IsCurrentAppPinnedAsync()) return;
            if (manager.IsPinningAllowed)
            {
                await manager.RequestPinCurrentAppAsync();
                return;
            }
        }
        catch (Exception exception) when (exception is COMException or UnauthorizedAccessException or NotSupportedException) { }
        var shortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "KOBB Atlas.lnk");
        MessageBox.Show(owner, "Nesta versão do Windows, clique com o botão direito no atalho do Atlas e escolha Fixar na barra de tarefas. O atalho será mostrado agora.", "Fixar KOBB Atlas", MessageBoxButton.OK, MessageBoxImage.Information);
        if (File.Exists(shortcut)) Process.Start(new ProcessStartInfo("explorer.exe", "/select,\"" + shortcut + "\"") { UseShellExecute = true });
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
}
