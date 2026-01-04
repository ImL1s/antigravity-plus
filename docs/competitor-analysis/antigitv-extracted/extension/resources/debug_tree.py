import uiautomation as auto
import sys

def main():
    print("--- Debugging UIA Tree for Antigravity ---")
    auto.SetGlobalSearchTimeout(2.0)
    
    # Find the main VS Code / Antigravity window
    print("Looking for Chrome_WidgetWin_1...")
    windows = auto.WindowControl(ClassName="Chrome_WidgetWin_1")
    
    found = False
    for window in windows.GetChildren():
        if window.ClassName != "Chrome_WidgetWin_1":
            continue
            
        print(f"Found Window: '{window.Name}'")
        found = True
        
        # Search efficiently for buttons
        print("  Scanning for buttons (depth=15)...")
        buttons = window.ButtonControl(searchDepth=15)
        
        count = 0
        matches = []
        
        # We can't easily iterate matches with `ButtonControl` as a walker in one go without GetChildren loop or WalkScope
        # Let's use WalkControl
        for control, depth in auto.WalkControl(window, maxDepth=12):
            if control.ControlType == auto.ControlType.ButtonControl:
                name = control.Name
                print(f"    [Button] Name='{name}'")
                if "Accept" in name:
                    matches.append(control)
            if control.ControlType == auto.ControlType.TextControl:
                if "Run command" in control.Name:
                    print(f"    [Text] '{control.Name}' found!")

        print(f"  Found {len(matches)} potential 'Accept' buttons.")
        for btn in matches:
            print(f"    -> MATCHED: '{btn.Name}'")
            
    if not found:
        print("No Antigravity/VSCode window found.")

if __name__ == "__main__":
    main()
