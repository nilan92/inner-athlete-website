import os

# --- CONFIGURATION ---
# Format: "Old Name": "New SEO Name"
# Note: We omit the file extension (.webp) to handle both mobile/desktop versions easily
mapping = {
    # Product 1: Longline Active Top
    "1": "longline-modest-active-top-black",
    "2": "longline-modest-active-top-navy",
    "3": "longline-modest-active-top-silver",
    "4": "longline-modest-active-top-maroon",

    # Product 2: Sports Hijab
    "5": "performance-sports-hijab-black",
    "6": "performance-sports-hijab-navy",
    "7": "performance-sports-hijab-silver",
    "8": "performance-sports-hijab-maroon",

    # Product 3: Full Set
    "9": "modest-activewear-set-black",
    "10": "modest-activewear-set-navy",
    "11": "modest-activewear-set-silver",
    "12": "modest-activewear-set-maroon",

    # UI / Gallery Images
    "Cover Photo": "innerathlete-modest-activewear-hero",
    "Gallary 01": "breathable-fabric-technology",
    "Gallary 02": "modest-cut-coverage-fit",
    "Gallary 03": "gym-to-street-elegance"
}

# Files to update content in
target_files = ["index.html", "script.js"]
img_dir = "img"

def rename_and_update():
    # 1. Read the content of the code files
    file_contents = {}
    for fname in target_files:
        if os.path.exists(fname):
            with open(fname, 'r', encoding='utf-8') as f:
                file_contents[fname] = f.read()
        else:
            print(f"⚠️ Warning: {fname} not found.")

    # 2. Iterate through mapping and process
    for old_base, new_base in mapping.items():
        # Handle variants (mobile/desktop and spaces/%20)
        variants = [
            (f"{old_base}_mobile.webp", f"{new_base}-mobile.webp"),
            (f"{old_base}_desktop.webp", f"{new_base}-desktop.webp")
        ]

        for old_name, new_name in variants:
            old_path = os.path.join(img_dir, old_name)
            new_path = os.path.join(img_dir, new_name)

            # A. RENAME FILE
            if os.path.exists(old_path):
                try:
                    os.rename(old_path, new_path)
                    print(f"✅ Renamed: {old_name} -> {new_name}")
                except Exception as e:
                    print(f"❌ Error renaming {old_name}: {e}")
            else:
                # Check if maybe it's already renamed
                if not os.path.exists(new_path):
                    print(f"⚠️ File missing: {old_name} (Skipping)")

            # B. UPDATE CODE REFERENCES
            # We need to handle URL encoding for the old names in HTML/JS (spaces = %20)
            old_name_encoded = old_name.replace(" ", "%20")
            
            for fname in file_contents:
                # Replace standard name
                if old_name in file_contents[fname]:
                    file_contents[fname] = file_contents[fname].replace(old_name, new_name)
                    print(f"   Ref updated in {fname}")
                
                # Replace encoded name (common in HTML img src)
                if old_name_encoded in file_contents[fname]:
                    file_contents[fname] = file_contents[fname].replace(old_name_encoded, new_name)
                    print(f"   Ref (encoded) updated in {fname}")

    # 3. Write updated content back to files
    for fname, content in file_contents.items():
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"💾 Saved updates to {fname}")

if __name__ == "__main__":
    rename_and_update()