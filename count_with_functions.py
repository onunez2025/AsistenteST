import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def get_count_with_functions():
    base_url = os.getenv('SAP_BASE_URL')
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    # Yesterday: 2026-05-07
    filter_query = "day(RequestedFulfillmentPeriodStartDateTime) eq 7 and month(RequestedFulfillmentPeriodStartDateTime) eq 5 and year(RequestedFulfillmentPeriodStartDateTime) eq 2026"
    url = f"{base_url}/ServiceRequestCollection/$count?$filter={filter_query}"
    
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        print(f"Total tickets para ayer (functions): {resp.text}")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    get_count_with_functions()
