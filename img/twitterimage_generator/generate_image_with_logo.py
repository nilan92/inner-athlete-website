import os
import glob
from PIL import Image, ImageFilter, ImageDraw, ImageFont

def generate_social_preview_branded(
    input_path, 
    text_logo="iA",
    font_filename="Audiowide-Regular.ttf"
):
    # Standard dimensions for Twitter/OpenGraph
    target_size = (1200, 630)
    blur_radius = 50
    darken_factor = 0.7
    
    # Generate an output filename (e.g., "image.jpg" -> "PREVIEW_image.jpg")
    filename = os.path.basename(input_path)
    output_path = os.path.join(os.path.dirname(input_path), f"PREVIEW_{filename}")

    # --- Check for Font ---
    if not os.path.exists(font_filename):
        print(f"⚠️  SKIPPING: Font file '{font_filename}' not found.")
        print("    Please download Audiowide from Google Fonts and place the .ttf file in this folder.")
        return

    try:
        # 1. Open the original image
        img = Image.open(input_path).convert("RGBA")
        
        # 2. Create the Background (Blurred)
        bg_img = img.copy()
        target_ratio = target_size[0] / target_size[1]
        img_ratio = img.width / img.height
        
        # Resize logic for background (Fill)
        if img_ratio > target_ratio:
            scale = target_size[1] / img.height
            new_width = int(img.width * scale)
            bg_img = bg_img.resize((new_width, target_size[1]), Image.Resampling.LANCZOS)
            left = (bg_img.width - target_size[0]) / 2
            bg_img = bg_img.crop((left, 0, left + target_size[0], target_size[1]))
        else:
            scale = target_size[0] / img.width
            new_height = int(img.height * scale)
            bg_img = bg_img.resize((target_size[0], new_height), Image.Resampling.LANCZOS)
            top = (bg_img.height - target_size[1]) / 2
            bg_img = bg_img.crop((0, top, target_size[0], top + target_size[1]))
            
        bg_img = bg_img.filter(ImageFilter.GaussianBlur(blur_radius))

        # Darken background
        if darken_factor < 1.0:
            overlay = Image.new('RGBA', target_size, (0, 0, 0, int(255 * (1 - darken_factor))))
            bg_img = Image.alpha_composite(bg_img, overlay)

        # 3. Process the Foreground (Contain)
        fg_img = img.copy()
        # Scale to fit with 10% margin
        scale_factor = min(target_size[0] / fg_img.width, target_size[1] / fg_img.height)
        margin_scale = 0.90 
        final_scale = scale_factor * margin_scale
        new_fg_width = int(fg_img.width * final_scale)
        new_fg_height = int(fg_img.height * final_scale)
        
        fg_img = fg_img.resize((new_fg_width, new_fg_height), Image.Resampling.LANCZOS)
        
        # Paste foreground
        x_offset = (target_size[0] - new_fg_width) // 2
        y_offset = (target_size[1] - new_fg_height) // 2
        bg_img.paste(fg_img, (x_offset, y_offset), fg_img if fg_img.mode == 'RGBA' else None)

        # 4. Add Text Overlay
        draw = ImageDraw.Draw(bg_img)
        font_size = 150
        text_color = (255, 255, 255)
        font = ImageFont.truetype(font_filename, font_size)
        draw.text((50, 30), text_logo, font=font, fill=text_color)
        
        # 5. Save
        final_img = bg_img.convert("RGB")
        final_img.save(output_path, quality=95)
        print(f"✅ Created: {output_path}")

    except Exception as e:
        print(f"❌ Error processing {filename}: {e}")

# --- AUTO-RUN LOGIC ---
if __name__ == "__main__":
    print("--- Starting Auto-Generator ---")
    
    # Get current directory
    current_folder = os.getcwd()
    
    # Extensions to look for
    valid_extensions = ['*.jpg', '*.jpeg', '*.png', '*.webp']
    
    found_images = []
    
    # Gather all images
    for ext in valid_extensions:
        found_images.extend(glob.glob(os.path.join(current_folder, ext)))
        # Also check for uppercase versions (JPG, PNG)
        found_images.extend(glob.glob(os.path.join(current_folder, ext.upper())))

    # Filter out files
    images_to_process = []
    for img_path in found_images:
        filename = os.path.basename(img_path)
        
        # SKIP images that are already generated previews (to prevent loops)
        if filename.startswith("PREVIEW_"):
            continue
            
        images_to_process.append(img_path)

    # Run the generator
    if not images_to_process:
        print("No new images found in this folder.")
    else:
        print(f"Found {len(images_to_process)} images. Processing...")
        for img in images_to_process:
            generate_social_preview_branded(img)
            
    print("--- Done ---")