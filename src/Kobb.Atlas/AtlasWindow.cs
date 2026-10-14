using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shell;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Microsoft.Win32;

namespace Kobb.Atlas;

public sealed class AtlasWindow : Window
{
    private readonly WebView2 browser = new();
    private readonly EnvironmentalData data = new();
    private readonly TextBlock error = new() { Margin = new Thickness(24), TextWrapping = TextWrapping.Wrap, FontSize = 14 };
    private readonly StackPanel windowControls;
    public bool Verification { get; set; }

    public AtlasWindow()
    {
        Title = "KOBB Atlas";
        Icon = Branding.Image();
        Background = Brushes.White;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.CanResize;
        Width = Math.Min(1400, SystemParameters.WorkArea.Width * .94);
        Height = Math.Min(940, SystemParameters.WorkArea.Height * .94);
        MinWidth = Math.Min(920, Width); MinHeight = Math.Min(620, Height);
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        UseLayoutRounding = true;
        WindowChrome.SetWindowChrome(this, new WindowChrome { CaptionHeight = 0, ResizeBorderThickness = new Thickness(5), GlassFrameThickness = new Thickness(0), CornerRadius = new CornerRadius(0) });
        var root = new Grid(); root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(32) }); root.RowDefinitions.Add(new RowDefinition());
        var toolbar = new Grid { Background = new SolidColorBrush(Color.FromRgb(217, 217, 217)) };
        toolbar.MouseLeftButtonDown += (_, args) => { if (args.ClickCount == 2) ToggleSize(); else DragMove(); };
        var label = new TextBlock { Text = "KOBB Atlas", Margin = new Thickness(10, 0, 0, 0), FontSize = 11, VerticalAlignment = VerticalAlignment.Center }; toolbar.Children.Add(label);
        var controls = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        windowControls = controls;
        controls.Children.Add(Control("Fixar na barra de tarefas", "M5 2H11L10 6L13 9H3L6 6ZM8 9V14", async () => await TaskbarPinning.RequestAsync(this)));
        controls.Children.Add(Control("Minimizar", "M2 7H14", () => WindowState = WindowState.Minimized));
        var resize = Control("Maximizar", "M3 2H13V12H3Z", ToggleSize);
        void UpdateResize() {
            var maximized = WindowState == WindowState.Maximized;
            resize.Content = maximized ? new System.Windows.Shapes.Path { Data = Geometry.Parse("M3 5H11V13H3ZM6 5V2H14V10H11"), Stroke = Brushes.Black, StrokeThickness = 1, Width = 16, Height = 14 } : new System.Windows.Shapes.Path { Data = Geometry.Parse("M3 2H13V12H3Z"), Stroke = Brushes.Black, StrokeThickness = 1, Width = 16, Height = 14 };
            resize.ToolTip = maximized ? "Restaurar janela" : "Maximizar"; AutomationProperties.SetName(resize, (string)resize.ToolTip);
        }
        StateChanged += (_, _) => UpdateResize(); UpdateResize(); controls.Children.Add(resize);
        controls.Children.Add(Control("Fechar", "M3 2L13 12M13 2L3 12", Close, true));
        toolbar.Children.Add(controls); root.Children.Add(toolbar);
        var body = new Grid(); body.Children.Add(error); body.Children.Add(browser); Grid.SetRow(body, 1); root.Children.Add(body);
        Content = new Border { BorderBrush = new SolidColorBrush(Color.FromRgb(166, 166, 166)), BorderThickness = new Thickness(1), Child = root };
        SourceInitialized += (_, _) => { var handle = new WindowInteropHelper(this).Handle; HwndSource.FromHwnd(handle)?.AddHook(WindowBounds.Hook); var preference = 1; DwmSetWindowAttribute(handle, 33, ref preference, sizeof(int)); };
        Loaded += async (_, _) => await InitializeAsync();
        Closed += (_, _) => { browser.Dispose(); data.Dispose(); };
    }

    private void ToggleSize() => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    private static Button Control(string name, string geometry, Action action, bool close = false)
    {
        var shape = new System.Windows.Shapes.Path { Data = Geometry.Parse(geometry), Stroke = Brushes.Black, StrokeThickness = 1, Width = 16, Height = 14, Stretch = Stretch.None };
        var button = new Button { Width = 48, Height = 32, Content = shape, Background = Brushes.Transparent, BorderThickness = new Thickness(0), ToolTip = name };
        var style = new Style(typeof(Button));
        style.Setters.Add(new Setter(BackgroundProperty, Brushes.Transparent));
        var template = new ControlTemplate(typeof(Button));
        var border = new FrameworkElementFactory(typeof(Border)); border.Name = "background"; border.SetValue(Border.BackgroundProperty, Brushes.Transparent);
        var presenter = new FrameworkElementFactory(typeof(ContentPresenter)); presenter.SetValue(HorizontalAlignmentProperty, HorizontalAlignment.Center); presenter.SetValue(VerticalAlignmentProperty, VerticalAlignment.Center); border.AppendChild(presenter); template.VisualTree = border;
        var hover = new Trigger { Property = IsMouseOverProperty, Value = true }; hover.Setters.Add(new Setter(Border.BackgroundProperty, close ? Brushes.Red : new SolidColorBrush(Color.FromRgb(188, 188, 188)), "background")); template.Triggers.Add(hover);
        style.Setters.Add(new Setter(TemplateProperty, template)); button.Style = style;
        AutomationProperties.SetName(button, name); button.Click += (_, _) => action();
        return button;
    }

    private async Task InitializeAsync()
    {
        try
        {
            var folder = Path.Combine(AppContext.BaseDirectory, "web");
            if (!File.Exists(Path.Combine(folder, "index.html"))) throw new FileNotFoundException("Os arquivos do Atlas não foram encontrados. Reinstale o software.");
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KOBB", "Atlas", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, profile, new CoreWebView2EnvironmentOptions { Language = "pt-BR" });
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.SetVirtualHostNameToFolderMapping("atlas.kobb.invalid", folder, CoreWebView2HostResourceAccessKind.DenyCors);
            browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            await browser.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.__atlasErrors=[];window.addEventListener('error',e=>window.__atlasErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__atlasErrors.push(String(e.reason)));");
            browser.CoreWebView2.WebMessageReceived += ReceiveMessage;
            browser.CoreWebView2.NavigationStarting += (_, args) => { if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) && uri.Host != "atlas.kobb.invalid") { args.Cancel = true; if (args.IsUserInitiated) OpenLink(uri); } };
            browser.CoreWebView2.NewWindowRequested += (_, args) => { args.Handled = true; if (args.IsUserInitiated && Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri)) OpenLink(uri); };
            if (Verification) browser.CoreWebView2.NavigationCompleted += async (_, args) => {
                for (var attempt = 0; attempt < 25; attempt++)
                {
                    await Task.Delay(1000);
                    if (await browser.ExecuteScriptAsync("document.getElementById('map-status')?.hidden===true") == "true") break;
                }
                var result = await browser.ExecuteScriptAsync("JSON.stringify({title:document.title,solar:document.getElementById('solar-altitude')?.textContent,mapReady:document.getElementById('map-status')?.hidden,wind:document.getElementById('wind-kind')?.textContent,errors:window.__atlasErrors??[]})");
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "kobb-atlas-window-check.json"), result);
                var check = JsonSerializer.Deserialize<string>(result)!;
                using var report = JsonDocument.Parse(check);
                WindowState = WindowState.Maximized; await Task.Delay(300); UpdateLayout();
                var controlsBounds = windowControls.TransformToAncestor(this).TransformBounds(new Rect(windowControls.RenderSize));
                var chromeVisible = controlsBounds.Top >= 0 && controlsBounds.Bottom <= ActualHeight && controlsBounds.Left >= 0 && controlsBounds.Right <= ActualWidth;
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "kobb-atlas-chrome-check.json"), JsonSerializer.Serialize(new { chromeVisible, width = ActualWidth, height = ActualHeight, toolbar = controlsBounds.ToString() }));
                WindowState = WindowState.Normal;
                await Task.Delay(2500);
                var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".tools", "kobb-atlas");
                Directory.CreateDirectory(folder);
                await using (var image = File.Create(Path.Combine(folder, "atlas-native.png"))) await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                Environment.ExitCode = args.IsSuccess && chromeVisible && report.RootElement.GetProperty("errors").GetArrayLength() == 0 && report.RootElement.GetProperty("mapReady").GetBoolean() ? 0 : 1; Close();
            };
            browser.Source = new Uri("https://atlas.kobb.invalid/index.html?v=" + typeof(AtlasWindow).Assembly.GetName().Version);
        }
        catch (Exception exception)
        {
            browser.Visibility = Visibility.Collapsed;
            error.Text = exception is WebView2RuntimeNotFoundException ? "Instale o Microsoft Edge WebView2 Runtime para abrir o Atlas." : exception.Message;
            if (Verification) { File.WriteAllText(Path.Combine(Path.GetTempPath(), "kobb-atlas-window-check.json"), exception.ToString()); Environment.ExitCode = 1; Close(); }
        }
    }

    private async void ReceiveMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (!Uri.TryCreate(args.Source, UriKind.Absolute, out var origin) || origin.Host != "atlas.kobb.invalid" || origin.Scheme != "https") return;
        var id = 0;
        try
        {
            if (args.WebMessageAsJson.Length > 48_000_000) throw new InvalidDataException("Estudo excedeu o limite de exportação.");
            using var message = JsonDocument.Parse(args.WebMessageAsJson);
            id = message.RootElement.GetProperty("id").GetInt32();
            var type = message.RootElement.GetProperty("type").GetString()!;
            var payload = message.RootElement.GetProperty("data");
            object result;
            if (type == "export-capabilities") result = new { dwg = true };
            else if (type == "export-file") result = await FileExport.SaveAsync(this, payload);
            else if (type == "export")
            {
                var dialog = new SaveFileDialog { Title = "Exportar estudo", Filter = "Estudo Atlas (*.json)|*.json", FileName = "atlas-" + DateTime.Now.ToString("yyyy-MM-dd") + ".json", OverwritePrompt = true };
                var saved = dialog.ShowDialog(this) == true;
                if (saved) await File.WriteAllTextAsync(dialog.FileName, JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true }));
                result = new { saved };
            }
            else result = await data.QueryAsync(type, payload);
            if (browser.CoreWebView2 is not null) browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, data = result }));
        }
        catch (Exception exception)
        {
            if (browser.CoreWebView2 is not null) browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, error = exception is OperationCanceledException ? "A consulta excedeu o tempo disponível." : exception.Message }));
        }
    }
    private static void OpenLink(Uri uri) { if (uri.Scheme == "https") Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr handle, int attribute, ref int value, int size);
}
