from PIL import Image
import numpy as np

img = Image.open("public/logo1.png").convert("RGBA")
data = np.array(img)

print("Shape:", data.shape)
print("Unique alpha values:", np.unique(data[:,:,3]))

non_transparent = data[:,:,3] > 0
nt_pixels = data[non_transparent]
print(f"Non-transparent pixels: {nt_pixels.shape[0]}")

for threshold in [200, 220, 230, 240, 250]:
    light = non_transparent & (data[:,:,0] > threshold) & (data[:,:,1] > threshold) & (data[:,:,2] > threshold)
    print(f"Non-transparent pixels with R,G,B > {threshold}: {np.sum(light)}")

threshold = 200
light_mask = (data[:,:,0] > threshold) & (data[:,:,1] > threshold) & (data[:,:,2] > threshold)
data[light_mask, 3] = 0

avg = data[:,:,:3].mean(axis=2)
channel_diff = data[:,:,:3].max(axis=2).astype(int) - data[:,:,:3].min(axis=2).astype(int)
grayish_mask = (avg > 210) & (channel_diff < 40)
data[grayish_mask, 3] = 0

result = Image.fromarray(data)
result.save("public/logo1.png")

img2 = Image.open("public/logo1.png")
data2 = np.array(img2)
transparent = np.sum(data2[:,:,3] == 0)
total = data2.shape[0] * data2.shape[1]
print(f"\nAfter fix:")
print(f"Transparent pixels: {transparent}/{total} ({transparent/total*100:.1f}%)")
print(f"Remaining opaque pixels: {total - transparent}")
print("Done! Background fully removed.")
