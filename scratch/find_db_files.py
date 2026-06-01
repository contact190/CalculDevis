import os
import glob

appdata = os.environ.get('LOCALAPPDATA', '')
search_path = os.path.join(appdata, 'Google/Chrome/User Data/**/IndexedDB/**/CalculDevisDB*')
print("Searching in:", search_path)
files = glob.glob(search_path, recursive=True)
for f in files:
    print(f)
