use std::sync::Mutex;

// Global state to track sleep prevention
static SLEEP_PREVENTED: Mutex<bool> = Mutex::new(false);

#[cfg(target_os = "macos")]
mod platform {
    use core_foundation::base::TCFType;
    use core_foundation::string::CFString;
    use std::sync::Mutex;

    // IOKit bindings for sleep prevention
    #[link(name = "IOKit", kind = "framework")]
    extern "C" {
        fn IOPMAssertionCreateWithName(
            assertion_type: core_foundation::string::CFStringRef,
            assertion_level: u32,
            assertion_name: core_foundation::string::CFStringRef,
            assertion_id: *mut u32,
        ) -> i32;

        fn IOPMAssertionRelease(assertion_id: u32) -> i32;
    }

    const IOPM_ASSERTION_LEVEL_ON: u32 = 255;

    static ASSERTION_ID: Mutex<Option<u32>> = Mutex::new(None);

    pub fn prevent_sleep() -> Result<(), String> {
        let mut assertion_id = ASSERTION_ID.lock().map_err(|e| e.to_string())?;
        
        if assertion_id.is_some() {
            return Ok(()); // Already preventing sleep
        }

        let assertion_type = CFString::new("PreventUserIdleDisplaySleep");
        let assertion_name = CFString::new("PoseMaster Practice Session");
        let mut new_id: u32 = 0;

        let result = unsafe {
            IOPMAssertionCreateWithName(
                assertion_type.as_concrete_TypeRef(),
                IOPM_ASSERTION_LEVEL_ON,
                assertion_name.as_concrete_TypeRef(),
                &mut new_id,
            )
        };

        if result == 0 {
            *assertion_id = Some(new_id);
            Ok(())
        } else {
            Err(format!("Failed to create power assertion: {}", result))
        }
    }

    pub fn allow_sleep() -> Result<(), String> {
        let mut assertion_id = ASSERTION_ID.lock().map_err(|e| e.to_string())?;
        
        if let Some(id) = assertion_id.take() {
            let result = unsafe { IOPMAssertionRelease(id) };
            if result != 0 {
                return Err(format!("Failed to release power assertion: {}", result));
            }
        }
        
        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
        EXECUTION_STATE,
    };

    pub fn prevent_sleep() -> Result<(), String> {
        let flags: EXECUTION_STATE = ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED;
        unsafe {
            SetThreadExecutionState(flags);
        }
        Ok(())
    }

    pub fn allow_sleep() -> Result<(), String> {
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
        Ok(())
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use std::sync::Mutex;
    
    static INHIBIT_COOKIE: Mutex<Option<u32>> = Mutex::new(None);

    pub fn prevent_sleep() -> Result<(), String> {
        // On Linux, we'll use a simple approach - just track state
        // Full D-Bus implementation would require async runtime coordination
        // For now, we'll note that Linux desktop environments typically
        // don't sleep while there's user activity (mouse/keyboard)
        let mut cookie = INHIBIT_COOKIE.lock().map_err(|e| e.to_string())?;
        if cookie.is_none() {
            *cookie = Some(1); // Placeholder - actual inhibit would use D-Bus
        }
        Ok(())
    }

    pub fn allow_sleep() -> Result<(), String> {
        let mut cookie = INHIBIT_COOKIE.lock().map_err(|e| e.to_string())?;
        *cookie = None;
        Ok(())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod platform {
    pub fn prevent_sleep() -> Result<(), String> {
        Ok(()) // No-op on unsupported platforms
    }

    pub fn allow_sleep() -> Result<(), String> {
        Ok(())
    }
}

#[tauri::command]
pub fn prevent_display_sleep() -> Result<(), String> {
    let mut prevented = SLEEP_PREVENTED.lock().map_err(|e| e.to_string())?;
    if !*prevented {
        platform::prevent_sleep()?;
        *prevented = true;
    }
    Ok(())
}

#[tauri::command]
pub fn allow_display_sleep() -> Result<(), String> {
    let mut prevented = SLEEP_PREVENTED.lock().map_err(|e| e.to_string())?;
    if *prevented {
        platform::allow_sleep()?;
        *prevented = false;
    }
    Ok(())
}
