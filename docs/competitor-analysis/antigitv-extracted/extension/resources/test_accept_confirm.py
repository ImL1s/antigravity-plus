import tkinter as tk
import sys
import time

def on_accept():
    print("ACCEPT BUTTON CLICKED!")
    label.config(text="ACCEPT CLICKED!", fg="green")
    # Don't close immediately so we can see the effect
    root.after(2000, lambda: label.config(text="Waiting for next click...", fg="black"))

def on_confirm():
    print("CONFIRM BUTTON CLICKED!")
    label.config(text="CONFIRM CLICKED!", fg="blue")
    root.after(2000, lambda: label.config(text="Waiting for next click...", fg="black"))

root = tk.Tk()
root.title("Antigravity Test Dual Popup")
root.geometry("400x200")
root.attributes('-topmost', True)

label = tk.Label(root, text="Antigravity Auto-Accept Test\nButtons: Accept & Confirm", pady=10)
label.pack()

btn_accept = tk.Button(root, text="Accept", command=on_accept, bg="#0078d7", fg="white", font=("Segoe UI", 10, "bold"), padx=20, pady=5)
btn_accept.pack(pady=10)

btn_confirm = tk.Button(root, text="Confirm", command=on_confirm, bg="#28a745", fg="white", font=("Segoe UI", 10, "bold"), padx=20, pady=5)
btn_confirm.pack(pady=10)

print("Test popup started. waiting for clicks on Accept or Confirm...")
sys.stdout.flush()
root.mainloop()
