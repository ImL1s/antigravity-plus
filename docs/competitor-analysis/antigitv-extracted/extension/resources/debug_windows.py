import uiautomation as auto

def main():
    print("Listing all Top-Level Windows:")
    root = auto.GetRootControl()
    for window in root.GetChildren():
        print(f"Name: '{window.Name}', ClassName: '{window.ClassName}'")

if __name__ == "__main__":
    main()
