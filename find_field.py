import requests
import os
import xml.etree.ElementTree as ET
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def find_visit_date_field():
    url = os.getenv('SAP_BASE_URL') + '/$metadata?sap-label=true'
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    print(f"Fetching metadata from {url}...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code != 200:
        print(f"Error fetching metadata: {resp.status_code}")
        return

    xml_data = resp.text
    
    # Simple search for labels in the metadata
    import re
    pattern = r'<Property Name="([^"]+)" Type="([^"]+)"[^>]+sap:label="([^"]+)"'
    matches = re.findall(pattern, xml_data)
    
    print("Found properties with 'Visita' in label:")
    for name, ptype, label in matches:
        if 'Visita' in label:
            print(f"Field: {name} | Label: {label}")

if __name__ == "__main__":
    find_visit_date_field()
