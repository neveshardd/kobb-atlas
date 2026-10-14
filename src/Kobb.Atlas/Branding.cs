using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Kobb.Atlas;

public static class Branding
{
    public static DrawingImage Image()
    {
        var source = new BitmapImage(new Uri("pack://application:,,,/kobb-atlas;component/Assets/atlas-logo.png"));
        var group = new DrawingGroup { OpacityMask = new ImageBrush(source) { Stretch = Stretch.Uniform } };
        group.Children.Add(new GeometryDrawing(new SolidColorBrush(Color.FromRgb(128, 128, 128)), null, new RectangleGeometry(new Rect(0, 0, 256, 256))));
        group.Freeze();
        var image = new DrawingImage(group); image.Freeze(); return image;
    }
    public static void ExportIcon(string destination)
    {
        var source = Image();
        var sizes = new[] { 16, 24, 32, 48, 64, 128, 256 };
        var frames = sizes.Select(size =>
        {
            using var encoded = new MemoryStream();
            var bitmap = new RenderTargetBitmap(size, size, 96, 96, PixelFormats.Pbgra32);
            var drawing = new DrawingVisual();
            RenderOptions.SetBitmapScalingMode(drawing, BitmapScalingMode.HighQuality);
            using (var context = drawing.RenderOpen()) context.DrawImage(source, new Rect(0, 0, size, size));
            bitmap.Render(drawing);
            var png = new PngBitmapEncoder(); png.Frames.Add(BitmapFrame.Create(bitmap)); png.Save(encoded);
            return encoded.ToArray();
        }).ToArray();
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(destination))!);
        using var output = new BinaryWriter(File.Create(destination));
        output.Write((ushort)0); output.Write((ushort)1); output.Write((ushort)sizes.Length);
        var offset = 6 + sizes.Length * 16;
        for (var index = 0; index < sizes.Length; index++)
        {
            output.Write((byte)(sizes[index] == 256 ? 0 : sizes[index])); output.Write((byte)(sizes[index] == 256 ? 0 : sizes[index])); output.Write((byte)0); output.Write((byte)0);
            output.Write((ushort)1); output.Write((ushort)32); output.Write((uint)frames[index].Length); output.Write((uint)offset); offset += frames[index].Length;
        }
        foreach (var frame in frames) output.Write(frame);
    }
}
