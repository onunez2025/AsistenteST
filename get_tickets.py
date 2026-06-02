import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def get_yesterday_tickets():
    base_url = os.getenv('SAP_BASE_URL')
    user = os.getenv('SAP_USER')
    password = os.getenv('SAP_PASSWORD')
    
    # Yesterday: 2026-05-07
    url = f"{base_url}/ServiceRequestCollection?$top=20&$format=json&$filter=RequestedFulfillmentPeriodStartDateTime ge '2026-05-07T00:00:00Z'&$orderby=RequestedFulfillmentPeriodStartDateTime"
    
    print(f"Querying: {url}")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        data = resp.json()
        results = data.get('d', {}).get('results', [])
        if results:
            r = results[0]
            print(f"Details for Ticket ID: {r.get('ID')}")
            for k, v in sorted(r.items()):
                if 'Date' in k or 'Time' in k or 'Visita' in k or 'Fecha' in k:
                    print(f"{k}: {v}")
        else:
            print("No tickets found for this range.")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    get_yesterday_tickets()
