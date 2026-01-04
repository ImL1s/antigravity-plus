import tkinter as tk
import sys

def on_click():
    print("BUTTON CLICKED!")
    label.config(text="CLICKED!", fg="green")
    # Close after a short delay to show success
    root.after(1000, root.destroy)

root = tk.Tk()
root.title("Antigravity Test Popup")
root.geometry("300x150")

# Always stay on top to make it easier to test
root.attributes('-topmost', True)

label = tk.Label(root, text="Antigravity Auto-Accept Test\nScreenshot the button below to train!", pady=10)
label.pack()

# Create a button that mimics a generic action button
btn = tk.Button(root, text="Accept", command=on_click, bg="#0078d7", fg="white", font=("Segoe UI", 10, "bold"), padx=20, pady=5)
btn.pack(pady=20)

print("Test popup started. waiting for click...")
root.mainloop()
