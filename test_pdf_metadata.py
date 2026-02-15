
import os
from langchain_community.document_loaders import PyPDFLoader

# Create a dummy PDF if possible, or just mock the loader behavior check
# Actually, I can't easily create a PDF here without reportlab or similar.
# I will trust the library behavior but check if I can inspect the code logic via search if needed.
# Instead, I'll create a script that tries to load an existing PDF if one exists, 
# or I'll just skip this if I can't find one.

# Let's check if there are any PDFs in data/uploads
if os.path.exists("data/uploads"):
    files = [f for f in os.listdir("data/uploads") if f.endswith(".pdf")]
    if files:
        fpath = os.path.join("data/uploads", files[0])
        print(f"Testing with {fpath}")
        loader = PyPDFLoader(fpath)
        docs = loader.load()
        if docs:
            print(f"First page metadata: {docs[0].metadata}")
    else:
        print("No PDFs found to test.")
else:
    print("No uploads directory found.")
