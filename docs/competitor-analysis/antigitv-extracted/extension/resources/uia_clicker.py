import uiautomation as auto
import time
import sys
import re
import argparse
from datetime import datetime

def flush_print(msg):
    # Add timestamp [HH:MM:SS]
    ts = datetime.now().strftime("[%H:%M:%S]")
    print(f"{ts} {msg}")
    sys.stdout.flush()

def click_button(button, button_type, click_delay):
    """Helper function to handle button clicking with retries and different methods"""
    if not button.Exists(0, 0):
        return False
        
    name = button.Name
    try:
        flush_print(f"Found {button_type} button: {name}")
    except:
        flush_print(f"Found {button_type} button (name unprintable)")
        
    if button.IsEnabled:
        if click_delay > 0:
            time.sleep(click_delay)
            
        clicked_successfully = False
        
        # Method 1: Invoke Pattern (Modern UIA) - No Mouse, No Focus
        if not clicked_successfully:
            try:
                button.Invoke()
                flush_print(f"Success: {button_type} button invoked via UIA Pattern!")
                clicked_successfully = True
                time.sleep(0.5)
                return True
            except Exception as e:
                flush_print(f"Invoke failed: {e}")

        # Method 2: Legacy IAccessible Pattern - No Mouse, No Focus
        if not clicked_successfully:
            try:
                legacy = button.GetLegacyIAccessiblePattern()
                if legacy:
                    legacy.DoDefaultAction()
                    flush_print(f"Success: {button_type} button invoked via LegacyIAccessible!")
                    clicked_successfully = True
                    time.sleep(0.5)
                    return True
            except Exception as e:
                flush_print(f"Legacy IAccessible failed: {e}")

        # Method 3: Physical Click (Last Resort - MOVES MOUSE)
        if not clicked_successfully:
            try:
                button.Click(simulateMove=False)
                flush_print(f"Fallback: {button_type} button physical click used (Mouse Moved)")
                return True
            except Exception as e:
                flush_print(f"Physical click failed: {e}")
                
    return False

def main():
    flush_print("Antigravity UIA Auto-Accept Service Started")
    flush_print("Using Windows UI Automation (Background Capable)")
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--pattern", default="Accept.*", help="Accept button name regex pattern")
    parser.add_argument("--confirm-pattern", default="Confirm.*", help="Confirm button name regex pattern")
    parser.add_argument("--delay", type=float, default=0.0, help="Delay in seconds before clicking")
    args, unknown = parser.parse_known_args()
    
    accept_pattern = args.pattern
    confirm_pattern = args.confirm_pattern
    click_delay = args.delay
        
    flush_print(f"Accept Button Pattern: '{accept_pattern}'")
    flush_print(f"Confirm Button Pattern: '{confirm_pattern}'")
    flush_print(f"Click Delay: {click_delay}s")
    
    # Ensure stdout is utf-8 to avoid crashes on special symbols like ↵
    sys.stdout.reconfigure(encoding='utf-8')
    
    # Set global search timeout to minimal
    auto.SetGlobalSearchTimeout(1.0)
    root = auto.GetRootControl()
    
    try:
        while True:
            try:
                # Iterating root children is safer to find the right window
                for window in root.GetChildren():
                    if window.ClassName != "Chrome_WidgetWin_1":
                        continue
                    
                    # Try to find and click Accept button
                    accept_button = window.ButtonControl(searchDepth=15, RegexName=accept_pattern)
                    if click_button(accept_button, "Accept", click_delay):
                        # If we clicked Accept, also look for a Confirm button
                        time.sleep(0.5)  # Small delay to allow any confirmation dialog to appear
                        confirm_button = window.ButtonControl(searchDepth=15, RegexName=confirm_pattern)
                        if confirm_button.Exists(0, 0):
                            click_button(confirm_button, "Confirm", click_delay)
                        break
                    
                    # If no Accept button found, try just the Confirm button
                    confirm_button = window.ButtonControl(searchDepth=15, RegexName=confirm_pattern)
                    if click_button(confirm_button, "Confirm", click_delay):
                        break
                            
            except Exception as e:
                pass
            
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        flush_print("Stopping UIA Service...")

if __name__ == "__main__":
    main()
