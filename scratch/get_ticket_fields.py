import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def get_ticket_fields():
    # Fetch 5 tickets to inspect fields
    url = f"{base_url}/ServiceRequestCollection?$top=5&$format=json"
    print("Fetching from ServiceRequestCollection...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        print(f"Found {len(results)} tickets.")
        for r in results:
            print(f"\n--- Ticket ID: {r.get('ID')} ---")
            print(f"  Name: {r.get('Name')}")
            print(f"  ProcessingTypeCode: {r.get('ProcessingTypeCode')} | Text: {r.get('ProcessingTypeCodeText')}")
            print(f"  CustomerID: {r.get('CustomerID')}")
            print(f"  CreationDateTime: {r.get('CreationDateTime')}")
            print(f"  RequestedFulfillmentPeriodStartDateTime: {r.get('RequestedFulfillmentPeriodStartDateTime')}")
            print(f"  RequestedFulfillmentPeriodEndDateTime: {r.get('RequestedFulfillmentPeriodEndDateTime')}")
            
            # Print any other date fields or custom fields
            for k, v in sorted(r.items()):
                if 'Date' in k or 'Time' in k or 'Visita' in k or 'Fecha' in k or 'KUT' in k:
                    print(f"    {k}: {v}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    get_ticket_fields()
