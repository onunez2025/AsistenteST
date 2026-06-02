import requests
import os
import re
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def inspect():
    url = f"{base_url}/$metadata"
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code != 200:
        print("Error")
        return
        
    xml_data = resp.text
    pattern = r'<EntityType Name="ServiceRequest".*?>(.*?)</EntityType>'
    match = re.search(pattern, xml_data, re.DOTALL)
    if not match:
        return
        
    properties_xml = match.group(1)
    prop_pattern = r'<Property Name="([^"]+)"'
    properties = re.findall(prop_pattern, properties_xml)
    
    print("All properties in ServiceRequest:")
    for name in sorted(properties):
        print(f"  - {name}")

if __name__ == "__main__":
    inspect()
