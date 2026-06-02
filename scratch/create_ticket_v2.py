import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def create_ticket():
    # 1. Fetch CSRF token and session cookies
    print("Fetching CSRF token...")
    token_url = f"{base_url}/ServiceRequestCollection?$top=1&$format=json"
    headers = {
        "x-csrf-token": "fetch",
        "Accept": "application/json"
    }
    
    resp = requests.get(token_url, auth=HTTPBasicAuth(user, password), headers=headers)
    if resp.status_code != 200:
        print(f"Failed to fetch CSRF token: {resp.status_code} - {resp.text}")
        return
        
    csrf_token = resp.headers.get("x-csrf-token")
    cookies = resp.cookies
    
    if not csrf_token:
        print("No CSRF token returned.")
        return
        
    print(f"CSRF Token obtained: {csrf_token}")
    
    # 2. Build payload with required SDK and KUT custom fields
    payload = {
        "Name": "Instalacion - RAPIDUCHA SOLE PRIME",
        "ProcessingTypeCode": "SRRQ",
        "BuyerPartyID": "1125569",
        "ProductID": "10018698",
        "InstallationPointID": "147292",
        "RequestedFulfillmentPeriodStartDateTime": "2026-06-15T08:00:00Z",
        "RequestedFulfillmentPeriodEndDateTime": "2026-06-15T18:00:00Z",
        "zIDEmpresa_SDK": "1304EXT",
        "zTicketArea_SDK": "000000000000000000000000000000000000000000000000000000000004",
        "zaConceptodeservicio_KUT": "101"
    }
    
    post_url = f"{base_url}/ServiceRequestCollection"
    post_headers = {
        "x-csrf-token": csrf_token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    print("Sending POST request to create ticket...")
    post_resp = requests.post(post_url, auth=HTTPBasicAuth(user, password), headers=post_headers, cookies=cookies, json=payload)
    
    if post_resp.status_code in [200, 201]:
        created_data = post_resp.json().get('d', {}).get('results', {})
        print("Success! Ticket created.")
        print(f"Ticket ID: {created_data.get('ID')}")
    else:
        print(f"Error {post_resp.status_code}: {post_resp.text}")

if __name__ == "__main__":
    create_ticket()
