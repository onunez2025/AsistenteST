import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def test_date(visit_date_str, concept_code):
    print(f"\n--- Testing Visit Date: {visit_date_str} with Concept {concept_code} ---")
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
    
    # Calculate start and end times for the visit date
    start_time = f"{visit_date_str}T08:00:00Z"
    end_time = f"{visit_date_str}T18:00:00Z"
    
    payload = {
        "Name": f"Instalacion Test - {visit_date_str}",
        "ProcessingTypeCode": "SRRQ",
        "BuyerPartyID": "1125569",
        "ProductID": "10018698",
        "InstallationPointID": "147292",
        "ServicePriorityCode": "3",
        "ServiceIssueCategoryID": "CA_1",
        "RequestedFulfillmentPeriodStartDateTime": start_time,
        "RequestedFulfillmentPeriodEndDateTime": end_time,
        "zIDEmpresa_SDK": "1304EXT",
        "zTicketArea_SDK": "000000000000000000000000000000000000000000000000000000000004",
        "zaConceptodeservicio_KUT": concept_code
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
    today = datetime(2026, 5, 29)
    # Test different dates in the future for concept 101 (Estándar)
    # Let's test 1 day, 2 days, 3 days, 5 days, 10 days in the future
    for days in [1, 2, 3, 5, 10]:
        v_date = (today + timedelta(days=days)).strftime("%Y-%m-%d")
        if test_date(v_date, "101"):
            break
