import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def search_nunez():
    # Let's search using FormattedName in IndividualCustomerCollection
    search_term = "OSCAR"
    url = f"{base_url}/IndividualCustomerCollection?$filter=substringof('{search_term}', FormattedName)&$format=json"
    print(f"Querying IndividualCustomerCollection for FormattedName containing '{search_term}'...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        print(f"Found {len(results)} individual customers:")
        for r in results:
            print(f"  - CustomerID: {r.get('CustomerID')} | FormattedName: {r.get('FormattedName')}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    search_nunez()
