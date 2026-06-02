# Try reading with utf-16 or fallback to latin-1
try:
    with open("log_errores.txt", "r", encoding="utf-16") as f:
        lines = f.readlines()
except UnicodeError:
    with open("log_errores.txt", "r", encoding="latin-1") as f:
        lines = f.readlines()

print("Searching log_errores.txt:")
count = 0
for idx, line in enumerate(lines):
    if "concepto" in line.lower() or "visita" in line.lower() or "empresa" in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
        count += 1
        if count >= 30:
            print("Truncating results...")
            break
