import requests
import os
import xml.etree.ElementTree as ET
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def inspect_service_request_metadata():
    url = f"{base_url}/$metadata"
    print(f"Fetching metadata from {url}...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code != 200:
        print(f"Error {resp.status_code}")
        return
        
    xml_data = resp.text
    
    # We want to find properties inside <EntityType Name="ServiceRequest">
    # Let's do a simple substring extraction or regex search to find the block
    import re
    # Find EntityType Name="ServiceRequest"
    pattern = r'<EntityType Name="ServiceRequest".*?>(.*?)</EntityType>'
    match = re.search(pattern, xml_data, re.DOTALL)
    if not match:
        print("Could not find EntityType Name='ServiceRequest'")
        # Try finding ServiceRequestCollection entity set
        return
        
    properties_xml = match.group(1)
    
    # Find all Property tags
    # <Property Name="Name" Type="Edm.String" ... />
    prop_pattern = r'<Property Name="([^"]+)" Type="([^"]+)"'
    properties = re.findall(prop_pattern, properties_xml)
    
    print("Found properties in ServiceRequest:")
    for name, ptype in sorted(properties):
        if any(x in name.lower() for x in ["product", "serial", "cust", "type", "date"]):
            print(f"  - {name} ({ptype})")

if __name__ == "__main__":
    inspect_service_request_metadata()
