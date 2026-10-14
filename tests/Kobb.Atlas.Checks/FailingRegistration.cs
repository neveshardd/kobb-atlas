using System.IO;
using Kobb.Installer.Domain;
using Kobb.Installer.Services;

internal sealed class FailingRegistration(IDesktopRegistration inner) : IDesktopRegistration
{
    public void Register(Product product, InstallReceipt receipt) { inner.Register(product, receipt); throw new IOException("Falha de teste no registro."); }
    public void Remove(Product product, string directory) => inner.Remove(product, directory);
    public void Rollback(Product product) => inner.Rollback(product);
}
