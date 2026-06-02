import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def get_details():
    ticket_id = "886088"
    url = f"{base_url}/ServiceRequestCollection?$filter=ID eq '{ticket_id}'&$format=json"
    print(f"Fetching all properties for ticket {ticket_id}...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        if results:
            t = results[0]
            print(f"All properties for ticket ID {ticket_id}:")
            for k, v in sorted(t.items()):
                print(f"  {k}: {v}")
        else:
            print("Ticket not found.")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    get_details()
