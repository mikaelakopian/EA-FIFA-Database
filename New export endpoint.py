# --- New Export Endpoint --- START ---
@router.get("/{project_name}/export-data")
async def export_project_data(project_name: str, background_tasks: BackgroundTasks):
    """
    Exports the project's 'data' folder after converting JSON files to TXT (TSV).
    The data is zipped and sent for download.
    """
    project_dir = PROJECTS_DIR / project_name
    source_data_dir = project_dir / "data"

    if not source_data_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Data directory for project '{project_name}' not found.")

    # Create a temporary directory manually
    temp_dir_path_str = tempfile.mkdtemp()
    try:
        temp_dir_path = Path(temp_dir_path_str)
        # Use the manually created temp dir path
        temp_txt_dir = temp_dir_path / "converted_data" 
        temp_zip_path = temp_dir_path / f"{project_name}_data_export.zip"

        conversion_count = 0
        # Walk through the source data directory
        for root, _, files in os.walk(source_data_dir):
            for filename in files:
                source_path = Path(root) / filename
                # Calculate relative path to maintain structure inside temp dir and zip
                relative_path = source_path.relative_to(source_data_dir)
                target_path_in_temp = temp_txt_dir / relative_path

                # Ensure target directory exists
                target_path_in_temp.parent.mkdir(parents=True, exist_ok=True)

                if filename.lower().endswith('.json'):
                    # Convert JSON to TXT
                    target_txt_path = target_path_in_temp.with_suffix('.txt')
                    if convert_json_to_txt(str(source_path), str(target_txt_path)):
                        conversion_count += 1
                else:
                    # Copy other files directly
                    try:
                        shutil.copy2(source_path, target_path_in_temp)
                        # print(f"Copied {source_path} to {target_path_in_temp}")
                    except Exception as e:
                        print(f"Error copying file {source_path}: {e}")

        print(f"Converted {conversion_count} JSON files and copied other files for project '{project_name}'")
        if not any(temp_txt_dir.iterdir()): # Check if the temp directory is actually empty
            raise HTTPException(status_code=404, detail=f"No convertible JSON files found in data directory for project '{project_name}'")

        # Create a ZIP archive of the converted TXT files
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in temp_txt_dir.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_txt_dir)
                    zipf.write(file_path, arcname=arcname)

        print(f"Created ZIP archive: {temp_zip_path}")

        # Return the ZIP file for download, add background task for cleanup
        response = FileResponse(
            path=str(temp_zip_path),
            media_type='application/zip',
            filename=f"{project_name}_data_export.zip",
            background=background_tasks # Pass background tasks instance
        )
        # Add the cleanup task *after* creating the response
        background_tasks.add_task(shutil.rmtree, temp_dir_path_str, ignore_errors=True)
        return response
    except Exception as e:
        # Clean up the temp dir if an error occurs *before* returning the response
        shutil.rmtree(temp_dir_path_str, ignore_errors=True)
        # Re-raise the exception or handle it (e.g., return an error response)
        print(f"Error during export process: {e}") # Log the error
        raise HTTPException(status_code=500, detail=f"Error during data export: {e}")
# --- New Export Endpoint --- END --- 