import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def get_processing_types():
    url = f"{base_url}/ServiceRequestCollection?$top=500&$select=ProcessingTypeCode,ProcessingTypeCodeText&$format=json"
    print("Fetching ticket processing types...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        unique_types = {}
        for r in results:
            code = r.get('ProcessingTypeCode')
            text = r.get('ProcessingTypeCodeText')
            if code:
                unique_types[code] = text
        print("Unique ProcessingTypeCodes found:")
        for code, text in unique_types.items():
            print(f"  Code: {code} | Text: {text}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    get_processing_types()
