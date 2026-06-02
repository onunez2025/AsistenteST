import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def get_count_hack():
    base_url = os.getenv('SAP_BASE_URL')
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    # ge 2026-05-07T00:00:00Z
    url1 = f"{base_url}/ServiceRequestCollection/$count?$filter=RequestedFulfillmentPeriodStartDateTime ge '2026-05-07T00:00:00Z'"
    # ge 2026-05-08T00:00:00Z
    url2 = f"{base_url}/ServiceRequestCollection/$count?$filter=RequestedFulfillmentPeriodStartDateTime ge '2026-05-08T00:00:00Z'"
    
    resp1 = requests.get(url1, auth=HTTPBasicAuth(user, password))
    resp2 = requests.get(url2, auth=HTTPBasicAuth(user, password))
    
    if resp1.status_code == 200 and resp2.status_code == 200:
        count1 = int(resp1.text)
        count2 = int(resp2.text)
        yesterday_count = count1 - count2
        print(f"Tickets since 2026-05-07: {count1}")
        print(f"Tickets since 2026-05-08: {count2}")
        print(f"Tickets exactly on 2026-05-07: {yesterday_count}")
    else:
        print(f"Error: {resp1.status_code} / {resp2.status_code}")

if __name__ == "__main__":
    get_count_hack()
