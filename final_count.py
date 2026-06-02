import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def get_yesterday_count():
    base_url = os.getenv('SAP_BASE_URL')
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    # Yesterday: 2026-05-07
    # Today: 2026-05-08
    
    filter_query = "(RequestedFulfillmentPeriodStartDateTime ge '2026-05-07T00:00:00Z') and (RequestedFulfillmentPeriodStartDateTime lt '2026-05-08T00:00:00Z')"
    url = f"{base_url}/ServiceRequestCollection/$count?$filter={filter_query}"
    
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        print(f"Total tickets con fecha de visita (RequestedFulfillmentPeriodStartDateTime) ayer (2026-05-07): {resp.text}")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    get_yesterday_count()
