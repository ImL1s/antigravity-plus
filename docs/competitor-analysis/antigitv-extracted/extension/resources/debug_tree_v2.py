import uiautomation as auto
import sys

def main():
    print("--- Debugging UIA Tree V2 ---")
    auto.SetGlobalSearchTimeout(2.0)
    
    root = auto.GetRootControl()
    
    for window in root.GetChildren():
        if window.ClassName == "Chrome_WidgetWin_1":
            print(f"Scanning Window: '{window.Name}'")
            
            # Look for ANY button with 'Accept' in name
            # Walk the tree slightly deeper
            found_btn = False
            for control, depth in auto.WalkControl(window, maxDepth=8):
                if control.ControlType == auto.ControlType.ButtonControl:
                    if "Accept" in control.Name:
                        print(f"  >>> FOUND MATCH: Name='{control.Name}'")
                        found_btn = True
            
            if not found_btn:
                print("  No 'Accept' buttons found in top 8 levels.")

if __name__ == "__main__":
    main()
