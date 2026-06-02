import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def test_filters():
    base_url = os.getenv('SAP_BASE_URL')
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    date_val = "2026-05-07T00:00:00Z"
    
    filters = [
        f"RequestedFulfillmentPeriodStartDateTime ge datetimeoffset'{date_val}'",
        f"RequestedFulfillmentPeriodStartDateTime ge datetime'{date_val[:19]}'",
        f"RequestedFulfillmentPeriodStartDateTime ge {date_val}",
        f"RequestedFulfillmentPeriodStartDateTime ge '{date_val}'"
    ]
    
    for f in filters:
        url = f"{base_url}/ServiceRequestCollection/$count?$filter={f}"
        resp = requests.get(url, auth=HTTPBasicAuth(user, password))
        print(f"Filter: {f} | Status: {resp.status_code} | Result: {resp.text[:100]}")

if __name__ == "__main__":
    test_filters()
