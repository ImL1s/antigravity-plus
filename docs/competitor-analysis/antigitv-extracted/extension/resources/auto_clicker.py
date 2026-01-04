import os
import sys
import time

# Check dependencies first
try:
    import pyautogui
    from PIL import Image
    import cv2
except ImportError as e:
    print(f"ERROR: Missing dependency: {str(e)}")
    print("Please run: pip install pyautogui pillow opencv-python")
    sys.exit(1)

# Disable pyautogui fail-safe to prevent accidental stops if mouse goes to corner
pyautogui.FAILSAFE = False

def flush_print(msg):
    print(msg)
    sys.stdout.flush()

def main():
    flush_print("Antigravity Auto-Accept Script Running...")
    
    # Add user's potential image names
    image_names = ['auto_accept.png', 'accept_button.png', 'accept.png', 'accept_button v2.png']
    image_paths = [os.path.join(script_dir, name) for name in image_names]
    
    flush_print(f"Scanning for images in: {script_dir}")
    found_any_image = False
    for p in image_paths:
        if os.path.exists(p):
            flush_print(f"Found template: {os.path.basename(p)}")
            found_any_image = True
    
    if not found_any_image:
        flush_print(f"WARNING: No images found! searching for: {image_names}")
    
    try:
        while True:
            try:
                # SAFETY CHECK: Only click if mouse position is roughly where the click would be?
                # Better: only click if confidence is HIGH.
                
                for image_path in image_paths:
                    if os.path.exists(image_path):
                        # Increased confidence to avoid random misclicks on similar colored UI elements
                        try:
                            location = pyautogui.locateCenterOnScreen(image_path, confidence=0.9)
                        except Exception:
                            location = None # locateCenter throws sometimes on ImageNotFound
                            
                        if location:
                            # CRITICAL SAFETY: 
                            # Check if the "Accept" button is actually in the foreground / visible?
                            # Taking a quick screenshot of the area to verify is hard without more libs.
                            
                            # Log coordinates first
                            x, y = location
                            flush_print(f"MATCH FOUND at ({x}, {y}) using {os.path.basename(image_path)}")
                            
                            # Small sleep to ensure it wasn't a glitch
                            time.sleep(0.2)
                            
                            # Double check (robustness)
                            loc_check = pyautogui.locateCenterOnScreen(image_path, confidence=0.9)
                            if loc_check:
                                pyautogui.click(loc_check)
                                flush_print("CLICKED!")
                                pyautogui.moveRel(0, 100) # Move away
                                time.sleep(2.0) # Wait for dialog to vanish
                                break
                            else:
                                flush_print("Skipping click - match disappeared (ghost).")
                
                time.sleep(0.5)
                
            except Exception as e:
                # Don't spam logs on common errors
                if "ImageNotFound" not in str(e):
                    flush_print(f"Error in loop: {e}")
                time.sleep(1)
                
    except KeyboardInterrupt:
        flush_print("Script stopping...")

if __name__ == "__main__":
    main()
