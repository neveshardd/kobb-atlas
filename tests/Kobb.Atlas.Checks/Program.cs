using System.IO;
using System.Runtime.InteropServices;
using Kobb.Installer.Domain;
using Kobb.Installer.Services;
using Microsoft.Win32;

var product = Product.Load(args[0]);
var payload = Path.GetFullPath(args[1]);
var sandbox = Path.Combine(Path.GetTempPath(), "kobb-atlas-package-check-" + Guid.NewGuid().ToString("N"));
var locations = new InstallLocations(Path.Combine(sandbox, "products"), Path.Combine(sandbox, "addins"), Path.Combine(sandbox, "desktop")) { Programs = Path.Combine(sandbox, "menu-iniciar") };
var registryPath = @"Software\KOBB\Tests\" + Guid.NewGuid().ToString("N");
var registration = new WindowsDesktopRegistration(RegistryHive.CurrentUser, registryPath);
try
{
    Directory.CreateDirectory(locations.Desktop);
    BinaryManifest.RequireAdministrator(args[2]);
    var service = new DesktopInstallationService(payload, new WindowsShortcuts(), locations, uninstallerExecutable: args[2], registration: registration);
    await service.ValidateAsync(product);
    ApplicationLauncher.VerifyDesktopShell();
    var receipt = await service.InstallAsync(product, new InstallOptions([], true, false), new Progress<InstallProgress>());
    if (receipt.Manifests.Length != 0 || receipt.Shortcuts.Length != 2) throw new Exception("Registro do software inválido.");
    using (var entry = Registry.CurrentUser.OpenSubKey(registryPath + "\\" + product.Id))
    {
        if ((string?)entry?.GetValue("DisplayName") != product.Name || !((string?)entry.GetValue("UninstallString") ?? "").Contains("Desinstalar.exe")) throw new Exception("Registro de Aplicativos não criado.");
    }
    var shellType = Type.GetTypeFromProgID("WScript.Shell")!;
    dynamic shell = Activator.CreateInstance(shellType)!;
    try
    {
        dynamic shortcut = shell.CreateShortcut(receipt.Shortcuts[0]);
        try { if ((string)shortcut.TargetPath != Path.Combine(receipt.Directory, product.Assembly)) throw new Exception("O atalho não aponta para o Atlas instalado."); }
        finally { Marshal.FinalReleaseComObject(shortcut); }
    }
    finally { Marshal.FinalReleaseComObject(shell); }
    foreach (var file in product.Files) if (!File.Exists(PackagePaths.Resolve(receipt.Directory, file.Path))) throw new Exception("Arquivo não instalado.");
    var next = product with { Version = "9.9.9" };
    try
    {
        await new DesktopInstallationService(payload, new WindowsShortcuts(), locations, uninstallerExecutable: args[2], registration: new FailingRegistration(registration))
            .InstallAsync(next, new InstallOptions([], true, false), new Progress<InstallProgress>());
        throw new Exception("Uma falha de registro foi ignorada.");
    }
    catch (IOException) { }
    if (!new WindowsShortcuts().PointsTo(receipt.Shortcuts[0], Path.Combine(receipt.Directory, product.Assembly)) || Directory.Exists(InstallDestination.Directory(next, locations.Products))) throw new Exception("A reversão da atualização não preservou o aplicativo anterior.");
    using (var restored = Registry.CurrentUser.OpenSubKey(registryPath + "\\" + product.Id))
        if ((string?)restored?.GetValue("DisplayVersion") != product.Version) throw new Exception("O registro anterior não foi restaurado.");
    var study = Path.Combine(receipt.Directory, "estudo-do-usuario.json");
    File.WriteAllText(study, "{\"preservar\":true}");
    new UninstallService(locations, registration: registration).Remove(product);
    if (!File.Exists(study) || File.Exists(receipt.Shortcuts[0]) || File.Exists(new InstallationRecords(locations).IndexPath(product))) throw new Exception("A remoção não preservou o estudo ou deixou registros.");
    if (Registry.CurrentUser.OpenSubKey(registryPath + "\\" + product.Id) is not null) throw new Exception("Registro do aplicativo não removido.");
    Console.WriteLine("PASS: UAC, pacote real, SHA-256, menu Iniciar, área de trabalho, registro de Aplicativos, desinstalador, reversão de atualização e preservação de estudos.");
}
finally
{
    var resolved = Path.GetFullPath(sandbox);
    if (resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) && Directory.Exists(resolved)) Directory.Delete(resolved, true);
    Registry.CurrentUser.DeleteSubKeyTree(registryPath, false);
}
