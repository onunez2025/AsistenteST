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
        print("No CSRF token returned in response headers.")
        return
        
    print(f"Successfully obtained CSRF token: {csrf_token}")
    
    # 2. Build the POST payload for ticket creation
    # Visit date: 15/06/2026
    # Let's schedule it from 2026-06-15T08:00:00Z to 2026-06-15T18:00:00Z
    # We use BuyerPartyID instead of CustomerID
    payload = {
        "Name": "Instalacion - RAPIDUCHA SOLE PRIME",
        "ProcessingTypeCode": "SRRQ",
        "BuyerPartyID": "1125569",
        "ProductID": "10018698",
        "InstallationPointID": "147292",
        "RequestedFulfillmentPeriodStartDateTime": "2026-06-15T08:00:00Z",
        "RequestedFulfillmentPeriodEndDateTime": "2026-06-15T18:00:00Z"
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
        ticket_id = created_data.get('ID')
        print(f"Success! Ticket created successfully.")
        print(f"Ticket ID: {ticket_id}")
        for k, v in sorted(created_data.items()):
            if not isinstance(v, dict):
                print(f"  {k}: {v}")
    else:
        print(f"Error creating ticket: {post_resp.status_code}")
        print(f"Response: {post_resp.text}")

if __name__ == "__main__":
    create_ticket()
