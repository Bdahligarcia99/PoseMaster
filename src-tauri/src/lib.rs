mod commands;
mod sleep_prevention;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder_for_images,
            commands::scan_multiple_folders_for_images,
            commands::save_annotated_image,
            commands::get_image_as_base64,
            commands::save_pdf,
            sleep_prevention::prevent_display_sleep,
            sleep_prevention::allow_display_sleep,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
