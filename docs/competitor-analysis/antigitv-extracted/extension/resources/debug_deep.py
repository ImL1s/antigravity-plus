import uiautomation as auto
import sys

def main():
    print("--- Deep Scan V3 ---")
    auto.SetGlobalSearchTimeout(1.0)
    root = auto.GetRootControl()
    
    for window in root.GetChildren():
        if "Antigravity" in window.Name and window.ClassName == "Chrome_WidgetWin_1":
            print(f"Deep scanning: {window.Name}")
            
            for control, depth in auto.WalkControl(window, maxDepth=18):
                if "Accept" in control.Name:
                    print(f"  [Depth {depth}] Type={control.ControlType} Name='{control.Name}'")

if __name__ == "__main__":
    main()
