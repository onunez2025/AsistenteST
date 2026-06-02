import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def test_vip():
    print("\n--- Testing with Concept: 121 (VIP) ---")
    token_url = f"{base_url}/ServiceRequestCollection?$top=1&$format=json"
    headers = {
        "x-csrf-token": "fetch",
        "Accept": "application/json"
    }
    resp = requests.get(token_url, auth=HTTPBasicAuth(user, password), headers=headers)
    if resp.status_code != 200:
        print("Failed to get CSRF token")
        return False
        
    csrf_token = resp.headers.get("x-csrf-token")
    cookies = resp.cookies
    
    payload = {
        "Name": "Instalacion VIP - 2026-06-15",
        "ProcessingTypeCode": "SRRQ",
        "BuyerPartyID": "1125569",
        "ProductID": "10018698",
        "InstallationPointID": "147292",
        "ServicePriorityCode": "3",
        "ServiceIssueCategoryID": "CA_1",
        "RequestedFulfillmentPeriodStartDateTime": "2026-06-15T08:00:00Z",
        "RequestedFulfillmentPeriodEndDateTime": "2026-06-15T18:00:00Z",
        "zIDEmpresa_SDK": "1304EXT",
        "zTicketArea_SDK": "000000000000000000000000000000000000000000000000000000000004",
        "zaConceptodeservicio_KUT": "121"
    }
    
    post_url = f"{base_url}/ServiceRequestCollection"
    post_headers = {
        "x-csrf-token": csrf_token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    post_resp = requests.post(post_url, auth=HTTPBasicAuth(user, password), headers=post_headers, cookies=cookies, json=payload)
    if post_resp.status_code in [200, 201]:
        created_data = post_resp.json().get('d', {}).get('results', {})
        print(f"  SUCCESS! Ticket created. ID: {created_data.get('ID')}")
        return True
    else:
        print(f"  FAILED {post_resp.status_code}: {post_resp.text}")
        return False

if __name__ == "__main__":
    test_vip()
