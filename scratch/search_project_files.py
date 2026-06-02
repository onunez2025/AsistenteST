import os

keywords = ["conceptodeservicio", "empresa", "area", "visita"]

print("Searching Python files in project:")
for root, dirs, files in os.walk("."):
    for file in files:
        if file.endswith(".py"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                for kw in keywords:
                    if kw in content.lower():
                        print(f"Found '{kw}' in {filepath}")
            except Exception as e:
                pass
