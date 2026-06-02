import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def test_fields():
    # Fetch top 1 from IndividualCustomerCollection
    url = f"{base_url}/IndividualCustomerCollection?$top=1&$format=json"
    print(f"Fetching from IndividualCustomerCollection...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        if results:
            print("Keys in IndividualCustomerCollection:")
            for k in sorted(results[0].keys()):
                print(f"  {k}: {results[0][k]}")
        else:
            print("No records found in IndividualCustomerCollection")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    test_fields()
