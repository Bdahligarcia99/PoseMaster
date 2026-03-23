use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub path: String,
    pub name: String,
}

/// Scan a folder recursively for image files
#[tauri::command]
pub fn scan_folder_for_images(folder_path: String) -> Result<Vec<ImageInfo>, String> {
    let path = Path::new(&folder_path);
    
    if !path.exists() {
        return Err("Folder does not exist".to_string());
    }
    
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let image_extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif"];
    let mut images: Vec<ImageInfo> = Vec::new();
    
    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        
        if entry_path.is_file() {
            if let Some(ext) = entry_path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if image_extensions.contains(&ext_lower.as_str()) {
                    let name = entry_path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    
                    images.push(ImageInfo {
                        path: entry_path.to_string_lossy().to_string(),
                        name,
                    });
                }
            }
        }
    }
    
    Ok(images)
}

/// Scan multiple folders recursively for image files
#[tauri::command]
pub fn scan_multiple_folders_for_images(folder_paths: Vec<String>) -> Result<Vec<ImageInfo>, String> {
    let image_extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif"];
    let mut images: Vec<ImageInfo> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    
    for folder_path in folder_paths {
        let path = Path::new(&folder_path);
        
        if !path.exists() {
            errors.push(format!("Folder does not exist: {}", folder_path));
            continue;
        }
        
        if !path.is_dir() {
            errors.push(format!("Path is not a directory: {}", folder_path));
            continue;
        }
        
        for entry in WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();
            
            if entry_path.is_file() {
                if let Some(ext) = entry_path.extension() {
                    let ext_lower = ext.to_string_lossy().to_lowercase();
                    if image_extensions.contains(&ext_lower.as_str()) {
                        let name = entry_path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();
                        
                        images.push(ImageInfo {
                            path: entry_path.to_string_lossy().to_string(),
                            name,
                        });
                    }
                }
            }
        }
    }
    
    // If all folders failed, return error
    if images.is_empty() && !errors.is_empty() {
        return Err(errors.join("; "));
    }
    
    Ok(images)
}

/// Get an image file as base64 for display
#[tauri::command]
pub fn get_image_as_base64(image_path: String) -> Result<String, String> {
    let path = Path::new(&image_path);
    
    if !path.exists() {
        return Err("Image file does not exist".to_string());
    }
    
    let data = fs::read(path).map_err(|e| format!("Failed to read image: {}", e))?;
    
    // Determine MIME type from extension
    let mime_type = match path.extension().and_then(|e| e.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("tiff") | Some("tif") => "image/tiff",
        _ => "image/jpeg",
    };
    
    let base64_data = BASE64.encode(&data);
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[derive(Debug, Deserialize)]
pub struct SaveAnnotatedImageRequest {
    pub original_path: String,
    pub drawing_data_url: String, // Base64 PNG from canvas
    pub output_folder: String,
}

/// Save an annotated image (original + drawing overlay merged)
#[tauri::command]
pub fn save_annotated_image(request: SaveAnnotatedImageRequest) -> Result<String, String> {
    use image::{GenericImageView, ImageBuffer, Rgba, imageops};
    
    let original_path = Path::new(&request.original_path);
    let output_folder = Path::new(&request.output_folder);
    
    // Create output folder if it doesn't exist
    if !output_folder.exists() {
        fs::create_dir_all(output_folder)
            .map_err(|e| format!("Failed to create output folder: {}", e))?;
    }
    
    // Load original image
    let original = image::open(original_path)
        .map_err(|e| format!("Failed to open original image: {}", e))?;
    
    let (width, height) = original.dimensions();
    
    // Parse base64 drawing data
    let drawing_data = if request.drawing_data_url.starts_with("data:image/png;base64,") {
        &request.drawing_data_url["data:image/png;base64,".len()..]
    } else {
        return Err("Invalid drawing data format".to_string());
    };
    
    let drawing_bytes = BASE64.decode(drawing_data)
        .map_err(|e| format!("Failed to decode drawing data: {}", e))?;
    
    let drawing = image::load_from_memory(&drawing_bytes)
        .map_err(|e| format!("Failed to load drawing image: {}", e))?;
    
    // Resize drawing to match original if needed
    let drawing_resized = if drawing.dimensions() != (width, height) {
        imageops::resize(&drawing, width, height, imageops::FilterType::Lanczos3)
    } else {
        drawing.to_rgba8()
    };
    
    // Create output image by compositing
    let mut output: ImageBuffer<Rgba<u8>, Vec<u8>> = original.to_rgba8();
    
    // Overlay drawing onto original (alpha blending)
    for (x, y, drawing_pixel) in drawing_resized.enumerate_pixels() {
        if drawing_pixel[3] > 0 {
            // Alpha > 0, blend the pixel
            let base_pixel = output.get_pixel_mut(x, y);
            let alpha = drawing_pixel[3] as f32 / 255.0;
            let inv_alpha = 1.0 - alpha;
            
            base_pixel[0] = (drawing_pixel[0] as f32 * alpha + base_pixel[0] as f32 * inv_alpha) as u8;
            base_pixel[1] = (drawing_pixel[1] as f32 * alpha + base_pixel[1] as f32 * inv_alpha) as u8;
            base_pixel[2] = (drawing_pixel[2] as f32 * alpha + base_pixel[2] as f32 * inv_alpha) as u8;
            base_pixel[3] = 255;
        }
    }
    
    // Generate output filename
    let original_stem = original_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    
    let output_filename = format!("{}_annotated.png", original_stem);
    let output_path = output_folder.join(&output_filename);
    
    // Save the output image
    output.save(&output_path)
        .map_err(|e| format!("Failed to save annotated image: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

/// Save a PDF file from base64 data
#[tauri::command]
pub fn save_pdf(base64_data: String, output_path: String) -> Result<String, String> {
    let path = Path::new(&output_path);
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }
    }
    
    // Decode base64 data
    let pdf_bytes = BASE64.decode(&base64_data)
        .map_err(|e| format!("Failed to decode PDF data: {}", e))?;
    
    // Write to file
    fs::write(path, pdf_bytes)
        .map_err(|e| format!("Failed to save PDF: {}", e))?;
    
    Ok(output_path)
}

// --- URL image commands ---

#[derive(Debug, Serialize, Deserialize)]
pub struct UrlValidationResult {
    pub url: String,
    pub valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub url: String,
    pub local_path: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Validate URL list - check URLs are accessible images
#[tauri::command]
pub async fn validate_url_list(urls: Vec<String>) -> Result<Vec<UrlValidationResult>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut results = Vec::with_capacity(urls.len());
    for url in urls {
        let result = match client.head(&url).send().await {
            Ok(resp) => {
                let status = resp.status();
                let valid = status.is_success()
                    && resp
                        .headers()
                        .get("content-type")
                        .and_then(|v| v.to_str().ok())
                        .map(|ct| ct.to_lowercase().starts_with("image/"))
                        .unwrap_or(false);
                UrlValidationResult {
                    url: url.clone(),
                    valid,
                    error: if valid {
                        None
                    } else if !status.is_success() {
                        Some(format!("HTTP {}", status))
                    } else {
                        Some("Not an image (invalid content-type)".to_string())
                    },
                }
            }
            Err(e) => UrlValidationResult {
                url: url.clone(),
                valid: false,
                error: Some(e.to_string()),
            },
        };
        results.push(result);
    }
    Ok(results)
}

fn extension_from_content_type(ct: &str) -> &str {
    let ct = ct.to_lowercase();
    if ct.contains("jpeg") || ct.contains("jpg") {
        "jpg"
    } else if ct.contains("png") {
        "png"
    } else if ct.contains("gif") {
        "gif"
    } else if ct.contains("webp") {
        "webp"
    } else if ct.contains("bmp") {
        "bmp"
    } else if ct.contains("tiff") {
        "tiff"
    } else {
        "jpg"
    }
}

/// Download a single image to cache (for progressive download with progress UI)
#[tauri::command]
pub async fn download_single_url_image(
    url: String,
    cache_folder: String,
    collection_id: String,
    index: usize,
) -> Result<DownloadResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let cache_path = Path::new(&cache_folder);
    if !cache_path.exists() {
        fs::create_dir_all(cache_path)
            .map_err(|e| format!("Failed to create cache folder: {}", e))?;
    }

    let result = match client.get(&url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                DownloadResult {
                    url: url.clone(),
                    local_path: String::new(),
                    success: false,
                    error: Some(format!("HTTP {}", resp.status())),
                }
            } else {
                let content_type = resp
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("image/jpeg");
                let ext = extension_from_content_type(content_type);
                let filename = format!("{}_{:04}.{}", collection_id, index, ext);
                let local_path = cache_path.join(&filename);

                match resp.bytes().await {
                    Ok(bytes) => {
                        if let Err(e) = fs::write(&local_path, &bytes) {
                            DownloadResult {
                                url: url.clone(),
                                local_path: String::new(),
                                success: false,
                                error: Some(format!("Failed to write file: {}", e)),
                            }
                        } else {
                            DownloadResult {
                                url: url.clone(),
                                local_path: local_path.to_string_lossy().to_string(),
                                success: true,
                                error: None,
                            }
                        }
                    }
                    Err(e) => DownloadResult {
                        url: url.clone(),
                        local_path: String::new(),
                        success: false,
                        error: Some(e.to_string()),
                    },
                }
            }
        }
        Err(e) => DownloadResult {
            url: url.clone(),
            local_path: String::new(),
            success: false,
            error: Some(e.to_string()),
        },
    };
    Ok(result)
}

/// Download images from URLs to cache folder (bulk - use download_single_url_image for progress)
#[tauri::command]
pub async fn download_url_images(
    urls: Vec<String>,
    cache_folder: String,
    collection_id: String,
) -> Result<Vec<DownloadResult>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let cache_path = Path::new(&cache_folder);
    if !cache_path.exists() {
        fs::create_dir_all(cache_path)
            .map_err(|e| format!("Failed to create cache folder: {}", e))?;
    }

    let mut results = Vec::with_capacity(urls.len());
    for (i, url) in urls.iter().enumerate() {
        let result = match client.get(url).send().await {
            Ok(resp) => {
                if !resp.status().is_success() {
                    results.push(DownloadResult {
                        url: url.clone(),
                        local_path: String::new(),
                        success: false,
                        error: Some(format!("HTTP {}", resp.status())),
                    });
                    continue;
                }
                let content_type = resp
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("image/jpeg");
                let ext = extension_from_content_type(content_type);
                let filename = format!("{}_{:04}.{}", collection_id, i, ext);
                let local_path = cache_path.join(&filename);

                match resp.bytes().await {
                    Ok(bytes) => {
                        if let Err(e) = fs::write(&local_path, &bytes) {
                            DownloadResult {
                                url: url.clone(),
                                local_path: String::new(),
                                success: false,
                                error: Some(format!("Failed to write file: {}", e)),
                            }
                        } else {
                            DownloadResult {
                                url: url.clone(),
                                local_path: local_path.to_string_lossy().to_string(),
                                success: true,
                                error: None,
                            }
                        }
                    }
                    Err(e) => DownloadResult {
                        url: url.clone(),
                        local_path: String::new(),
                        success: false,
                        error: Some(e.to_string()),
                    },
                }
            }
            Err(e) => DownloadResult {
                url: url.clone(),
                local_path: String::new(),
                success: false,
                error: Some(e.to_string()),
            },
        };
        results.push(result);
    }
    Ok(results)
}

/// Fetch single image from URL as base64 (for streaming mode)
#[tauri::command]
pub async fn fetch_url_image_as_base64(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "image/jpeg".to_string());

    let mime_type = if content_type.to_lowercase().contains("jpeg")
        || content_type.to_lowercase().contains("jpg")
    {
        "image/jpeg"
    } else if content_type.to_lowercase().contains("png") {
        "image/png"
    } else if content_type.to_lowercase().contains("gif") {
        "image/gif"
    } else if content_type.to_lowercase().contains("webp") {
        "image/webp"
    } else if content_type.to_lowercase().contains("bmp") {
        "image/bmp"
    } else if content_type.to_lowercase().contains("tiff") {
        "image/tiff"
    } else {
        "image/jpeg"
    };

    let bytes = resp.bytes().await.map_err(|e| format!("Failed to read body: {}", e))?;
    let base64_data = BASE64.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

/// Delete cached collection
#[tauri::command]
pub fn delete_url_cache(cache_folder: String) -> Result<(), String> {
    let path = Path::new(&cache_folder);
    if path.exists() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete cache: {}", e))?;
    }
    Ok(())
}
