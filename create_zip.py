import os
import zipfile
import shutil

def create_project_zip():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    zip_filename = "OfflineSharedStudentApp.zip"
    zip_path = os.path.join(base_dir, zip_filename)
    
    # Also ensure public directory exists for direct web download
    public_dir = os.path.join(base_dir, "..", "public")
    os.makedirs(public_dir, exist_ok=True)
    public_zip_path = os.path.join(public_dir, zip_filename)

    print(f"Bundling {base_dir} into {zip_path}...")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(base_dir):
            # Skip node_modules, git, and zip itself
            dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist', 'build', '.cache')]
            for file in files:
                if file.endswith('.zip') or file.endswith('.pyc'):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, os.path.dirname(base_dir))
                zipf.write(file_path, rel_path)
                print(f"Added: {rel_path}")

    # Copy to public folder
    shutil.copyfile(zip_path, public_zip_path)
    print(f"Successfully generated {zip_path} ({os.path.getsize(zip_path)} bytes)")
    print(f"Copied to web public folder: {public_zip_path}")

if __name__ == '__main__':
    create_project_zip()
