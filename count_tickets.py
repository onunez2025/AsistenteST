import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

def get_ticket_count():
    base_url = os.getenv('SAP_BASE_URL')
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    # "Ayer" relative to 2026-05-08 is 2026-05-07
    yesterday = "2026-05-07"
    
    # Try filtering by RequestedFulfillmentPeriodStartDateTime
    # Format: 2026-05-07T00:00:00Z
    start_date = f"{yesterday}T00:00:00Z"
    end_date = f"2026-05-08T00:00:00Z"
    
    # We use $count to get the number of records
    filter_str = f"RequestedFulfillmentPeriodStartDateTime ge datetime'{start_date}' and RequestedFulfillmentPeriodStartDateTime lt datetime'{end_date}'"
    # Wait, SAP OData v2/v1 uses datetime'YYYY-MM-DDTHH:MM:SS' or just YYYY-MM-DDTHH:MM:SSZ
    # Let's try both or check common patterns.
    # Actually, in C4C OData, it often uses datetime'2026-05-07T00:00:00'
    
    # Try RequestedFulfillmentPeriodStartDateTime
    url = f"{base_url}/ServiceRequestCollection/$count?$filter=RequestedFulfillmentPeriodStartDateTime ge datetime'{yesterday}T00:00:00' and RequestedFulfillmentPeriodStartDateTime lt datetime'2026-05-08T00:00:00'"
    
    print(f"Querying count for {yesterday}...")
    headers = {'Accept': 'text/plain'} # $count returns plain text
    resp = requests.get(url, auth=HTTPBasicAuth(user, password), headers=headers)
    
    if resp.status_code == 200:
        print(f"Tickets with RequestedFulfillmentPeriodStartDateTime on {yesterday}: {resp.text}")
    else:
        print(f"Error querying with RequestedFulfillmentPeriodStartDateTime: {resp.status_code} - {resp.text}")

    # Also try CreationDateTime just in case
    url_creation = f"{base_url}/ServiceRequestCollection/$count?$filter=CreationDateTime ge datetimeoffset'{start_date}' and CreationDateTime lt datetimeoffset'{end_date}'"
    resp_creation = requests.get(url_creation, auth=HTTPBasicAuth(user, password), headers=headers)
    if resp_creation.status_code == 200:
        print(f"Tickets created on {yesterday}: {resp_creation.text}")

if __name__ == "__main__":
    get_ticket_count()
